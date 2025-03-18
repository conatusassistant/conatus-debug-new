// backend/services/optimization/LLMOptimizationService.js
/**
 * LLM Cost Optimization Service
 * 
 * Implements strategies to reduce API costs while maintaining quality:
 * 1. Token usage tracking and budgeting
 * 2. Intelligent model selection based on query complexity
 * 3. Request batching and deduplication
 * 4. Context window optimization
 */

const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const tiktoken = require("tiktoken");
const natural = require('natural');
const { v4: uuidv4 } = require('uuid');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

class LLMOptimizationService {
  constructor() {
    // Provider configurations with cost per 1K tokens
    this.providerConfigs = {
      CLAUDE: {
        models: {
          'claude-3-opus-20240229': {
            inputCostPer1K: 15, // $15 per 1M input tokens
            outputCostPer1K: 75, // $75 per 1M output tokens
            contextWindow: 200000,
            priority: 1 // Lower is higher priority
          },
          'claude-3-sonnet-20240229': {
            inputCostPer1K: 3, // $3 per 1M input tokens
            outputCostPer1K: 15, // $15 per 1M output tokens
            contextWindow: 200000,
            priority: 2
          },
          'claude-3-haiku-20240307': {
            inputCostPer1K: 0.25, // $0.25 per 1M input tokens
            outputCostPer1K: 1.25, // $1.25 per 1M output tokens
            contextWindow: 200000,
            priority: 3
          }
        },
        defaultModel: 'claude-3-haiku-20240307',
        capabilities: ['reasoning', 'coding', 'explanation']
      },
      PERPLEXITY: {
        models: {
          'sonar-medium-online': {
            inputCostPer1K: 0.8, // $0.8 per 1M input tokens
            outputCostPer1K: 2.4, // $2.4 per 1M output tokens
            contextWindow: 12000,
            priority: 1
          },
          'sonar-small-online': {
            inputCostPer1K: 0.4, // $0.4 per 1M input tokens 
            outputCostPer1K: 1.2, // $1.2 per 1M output tokens
            contextWindow: 12000,
            priority: 2
          }
        },
        defaultModel: 'sonar-small-online',
        capabilities: ['search', 'research', 'current_events']
      },
      OPENAI: {
        models: {
          'gpt-4-turbo': {
            inputCostPer1K: 10, // $10 per 1M input tokens
            outputCostPer1K: 30, // $30 per 1M output tokens
            contextWindow: 128000,
            priority: 1
          },
          'gpt-3.5-turbo': {
            inputCostPer1K: 0.5, // $0.5 per 1M input tokens
            outputCostPer1K: 1.5, // $1.5 per 1M output tokens
            contextWindow: 16000, 
            priority: 2
          }
        },
        defaultModel: 'gpt-3.5-turbo',
        capabilities: ['creative', 'summarization']
      },
      DEEPSEEK: {
        models: {
          'deepseek-coder': {
            inputCostPer1K: 0.8, // $0.8 per 1M input tokens
            outputCostPer1K: 0.8, // $0.8 per 1M output tokens
            contextWindow: 32000,
            priority: 1
          }
        },
        defaultModel: 'deepseek-coder',
        capabilities: ['programming', 'technical']
      }
    };
    
    // Initialize tokenizers
    this.tokenizers = {
      CLAUDE: null, // Will be initialized on demand
      OPENAI: null,
      defaultTokenizer: new natural.WordTokenizer()
    };
    
    // Request batching queues
    this.batchQueues = {
      classification: [], // For classification requests
      simple: [] // For simple, non-conversational queries
    };
    
    // Set up periodic batch processing
    setInterval(() => this.processBatchQueue('classification'), 1000); // Process every 1 second
    setInterval(() => this.processBatchQueue('simple'), 2000); // Process every 2 seconds
  }

  /**
   * Select the optimal model based on query complexity and cost constraints
   * @param {string} provider - LLM provider (CLAUDE, OPENAI, etc.)
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {string} - Selected model identifier
   */
  selectOptimalModel(provider, query, context = {}) {
    const config = this.providerConfigs[provider];
    
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    // If user specified a model, use it if available
    if (context.model && config.models[context.model]) {
      return context.model;
    }
    
    // Start with the default model
    let selectedModel = config.defaultModel;
    
    // Calculate token count to estimate cost
    const tokenCount = this.estimateTokenCount(query, provider);
    const estimatedResponseTokens = Math.min(tokenCount * 2, 1500); // Rough estimate of response size
    
    // Check budget constraints if available
    if (context.userBudget) {
      // Find the cheapest model that fits the budget
      let lowestCost = Infinity;
      
      for (const [modelId, modelConfig] of Object.entries(config.models)) {
        // Skip models that aren't suitable for the capabilities needed
        if (context.requiredCapabilities) {
          const hasCapabilities = context.requiredCapabilities.every(
            cap => config.capabilities.includes(cap)
          );
          if (!hasCapabilities) continue;
        }
        
        // Calculate estimated cost
        const estimatedCost = 
          (tokenCount * modelConfig.inputCostPer1K / 1000) + 
          (estimatedResponseTokens * modelConfig.outputCostPer1K / 1000);
        
        // Check if this model is cheaper than current selection and fits budget
        if (estimatedCost < lowestCost && estimatedCost <= context.userBudget) {
          lowestCost = estimatedCost;
          selectedModel = modelId;
        }
      }
    } else {
      // No explicit budget, use complexity-based selection
      
      // Calculate complexity score (basic version)
      const complexity = this.calculateComplexity(query);
      
      if (complexity > 0.8) {
        // Use the highest priority model for complex queries
        selectedModel = Object.entries(config.models)
          .sort((a, b) => a[1].priority - b[1].priority)[0][0];
      } else if (complexity < 0.4) {
        // Use the lowest priority model for simple queries
        selectedModel = Object.entries(config.models)
          .sort((a, b) => b[1].priority - a[1].priority)[0][0];
      }
      // For medium complexity, stick with the default model
    }
    
    return selectedModel;
  }

  /**
   * Calculate a complexity score for a query
   * @param {string} query - User query
   * @returns {number} - Complexity score between 0 and 1
   */
  calculateComplexity(query) {
    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Factors that indicate complexity
    const complexityFactors = {
      length: 0,
      questionComplexity: 0,
      technicalTerms: 0,
      codeDetection: 0,
      multipartQuery: 0
    };
    
    // 1. Length factor - longer queries tend to be more complex
    const wordCount = normalizedQuery.split(/\s+/).length;
    complexityFactors.length = Math.min(wordCount / 100, 1); // Cap at 100 words
    
    // 2. Question complexity
    const questionWords = ['what', 'when', 'where', 'who', 'why', 'how'];
    const hasBasicQuestion = questionWords.some(word => normalizedQuery.includes(word));
    const hasComplexQuestion = normalizedQuery.includes('explain') || 
                              normalizedQuery.includes('analyze') ||
                              normalizedQuery.includes('compare') ||
                              normalizedQuery.includes('difference between');
    
    complexityFactors.questionComplexity = hasComplexQuestion ? 0.8 : (hasBasicQuestion ? 0.4 : 0);
    
    // 3. Technical terms
    const technicalTerms = [
      'algorithm', 'function', 'programming', 'code', 'api', 'data structure',
      'implement', 'architecture', 'protocol', 'optimization', 'performance', 
      'complexity', 'analysis', 'system', 'design', 'infrastructure'
    ];
    
    const technicalTermCount = technicalTerms.filter(term => normalizedQuery.includes(term)).length;
    complexityFactors.technicalTerms = Math.min(technicalTermCount / 5, 1);
    
    // 4. Code detection
    const codeIndicators = [
      'function', 'class', 'method', 'variable', 'object', 'array',
      'json', 'http', 'api', 'endpoint', 'database', 'query', 'async',
      'promise', 'callback', 'event', 'listener', 'handler', 'component'
    ];
    
    const codeIndicatorCount = codeIndicators.filter(term => normalizedQuery.includes(term)).length;
    complexityFactors.codeDetection = Math.min(codeIndicatorCount / 4, 1);
    
    // 5. Multi-part queries
    const parts = normalizedQuery.split(/\band\b|\bthen\b|\balso\b|\bplus\b|\badditionally\b|\bmoreover\b|\bfurthermore\b/);
    complexityFactors.multipartQuery = Math.min((parts.length - 1) / 3, 1);
    
    // Calculate weighted average
    const weights = {
      length: 0.15,
      questionComplexity: 0.25,
      technicalTerms: 0.2,
      codeDetection: 0.3,
      multipartQuery: 0.1
    };
    
    let totalScore = 0;
    for (const [factor, score] of Object.entries(complexityFactors)) {
      totalScore += score * weights[factor];
    }
    
    return totalScore;
  }

  /**
   * Optimize prompt to reduce token usage
   * @param {string} prompt - Original prompt
   * @param {Object} context - Context with history, etc.
   * @returns {string} - Optimized prompt
   */
  optimizePrompt(prompt, context = {}) {
    // If no context or history, just return the prompt
    if (!context.history || !Array.isArray(context.history) || context.history.length === 0) {
      return prompt;
    }
    
    // Get the provider and model
    const provider = context.provider || 'OPENAI';
    const model = context.model || this.providerConfigs[provider]?.defaultModel;
    
    if (!model) {
      return prompt; // Can't optimize without model info
    }
    
    // Get token count for the prompt
    const promptTokens = this.estimateTokenCount(prompt, provider);
    
    // Get context window size for the model
    const contextWindow = this.getContextWindowSize(provider, model);
    
    // If prompt already fits, no need to optimize
    if (promptTokens < contextWindow * 0.75) {
      return prompt;
    }
    
    // Summarize or remove older history items to fit within context window
    let optimizedHistory = [...context.history];
    const targetTokenCount = contextWindow * 0.75; // Target 75% of context window
    
    // Start removing oldest messages first
    while (optimizedHistory.length > 2) { // Keep at least the last user message
      const historyTokenCount = this.estimateHistoryTokenCount(optimizedHistory, provider);
      
      if (promptTokens + historyTokenCount <= targetTokenCount) {
        break;
      }
      
      // Remove oldest message
      optimizedHistory.shift();
    }
    
    // If still too large, summarize history
    if (optimizedHistory.length > 2) {
      const historyTokenCount = this.estimateHistoryTokenCount(optimizedHistory, provider);
      
      if (promptTokens + historyTokenCount > targetTokenCount) {
        // Replace older messages with a summary
        const oldMessages = optimizedHistory.slice(0, -2);
        const recentMessages = optimizedHistory.slice(-2);
        
        const summary = `[Previous conversation summary: The user and assistant discussed ${this.generateTopicSummary(oldMessages)}]`;
        
        optimizedHistory = [{ role: 'system', content: summary }, ...recentMessages];
      }
    }
    
    // Replace history in context
    context.history = optimizedHistory;
    
    return prompt;
  }

  /**
   * Generate a topic summary from conversation history
   * @param {Array} messages - Conversation messages
   * @returns {string} - Topic summary
   */
  generateTopicSummary(messages) {
    if (!messages || messages.length === 0) {
      return "various topics";
    }
    
    // Extract all content
    const allContent = messages
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();
    
    // Extract potential topics using basic keyword frequency
    const words = allContent.split(/\W+/).filter(word => word.length > 3);
    const wordFrequency = {};
    
    for (const word of words) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
    
    // Sort by frequency
    const sortedWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    if (sortedWords.length > 0) {
      return sortedWords.join(', ');
    }
    
    return "various topics";
  }

  /**
   * Add a request to the batch queue
   * @param {string} queueType - Type of queue (classification, simple)
   * @param {Object} request - Request data
   * @param {function} resolve - Resolve function for the promise
   * @param {function} reject - Reject function for the promise
   * @returns {Promise} - Promise that resolves with the result
   */
  addToBatchQueue(queueType, request, resolve, reject) {
    const requestId = uuidv4();
    
    this.batchQueues[queueType].push({
      id: requestId,
      request,
      resolve,
      reject,
      timestamp: Date.now()
    });
    
    // If queue gets too big, process immediately
    if (this.batchQueues[queueType].length >= 10) {
      this.processBatchQueue(queueType);
    }
  }

  /**
   * Process a batch queue of requests
   * @param {string} queueType - Type of queue to process
   */
  async processBatchQueue(queueType) {
    const queue = this.batchQueues[queueType];
    
    if (queue.length === 0) {
      return;
    }
    
    // Take all current items in the queue
    const batch = [...queue];
    this.batchQueues[queueType] = [];
    
    try {
      if (queueType === 'classification') {
        await this.processBatchClassification(batch);
      } else if (queueType === 'simple') {
        await this.processBatchSimpleQueries(batch);
      }
    } catch (error) {
      console.error(`Error processing batch queue (${queueType}):`, error);
      
      // Reject all requests in the batch
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }

  /**
   * Process a batch of classification requests
   * @param {Array} batch - Batch of requests
   */
  async processBatchClassification(batch) {
    // Deduplicate requests with identical text
    const uniqueRequests = {};
    const requestMap = {};
    
    for (const item of batch) {
      const requestText = item.request.query;
      
      if (!uniqueRequests[requestText]) {
        uniqueRequests[requestText] = item.request;
        requestMap[requestText] = [item];
      } else {
        requestMap[requestText].push(item);
      }
    }
    
    // Process unique requests
    const classificationResults = {};
    
    for (const [requestText, request] of Object.entries(uniqueRequests)) {
      try {
        // Check cache first
        const cacheKey = `classification:${this.generateQueryHash(requestText)}`;
        const cachedResult = await redis.get(cacheKey);
        
        if (cachedResult) {
          classificationResults[requestText] = JSON.parse(cachedResult);
        } else {
          // Actually process the classification
          const result = await this.actuallyClassifyQuery(requestText, request.context);
          
          // Cache the result
          await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour cache
          
          classificationResults[requestText] = result;
        }
      } catch (error) {
        console.error(`Error classifying query: ${requestText}`, error);
        classificationResults[requestText] = { error };
      }
    }
    
    // Resolve or reject each request
    for (const [requestText, items] of Object.entries(requestMap)) {
      const result = classificationResults[requestText];
      
      if (result.error) {
        items.forEach(item => item.reject(result.error));
      } else {
        items.forEach(item => item.resolve(result));
      }
    }
  }

  /**
   * Process a batch of simple queries
   * @param {Array} batch - Batch of requests
   */
  async processBatchSimpleQueries(batch) {
    // Implement batching for simple queries
    // This would depend on the specific LLM APIs that support batching
    // For now, just process them individually
    
    for (const item of batch) {
      try {
        const result = await this.actuallyProcessQuery(item.request);
        item.resolve(result);
      } catch (error) {
        console.error('Error processing simple query:', error);
        item.reject(error);
      }
    }
  }

  /**
   * Placeholder for actual classification implementation
   * @param {string} query - Query to classify
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Classification result
   */
  async actuallyClassifyQuery(query, context = {}) {
    // This would be implemented in the ClassificationService
    // Just a placeholder for the batching mechanism
    return {
      provider: 'OPENAI',
      category: 'general',
      confidence: 0.8
    };
  }

  /**
   * Placeholder for actual query processing
   * @param {Object} request - Request object
   * @returns {Promise<Object>} - Query result
   */
  async actuallyProcessQuery(request) {
    // This would be implemented in the LLMService
    // Just a placeholder for the batching mechanism
    return {
      content: "This is a placeholder response",
      provider: request.provider || 'OPENAI',
      model: request.model || 'gpt-3.5-turbo'
    };
  }

  /**
   * Track token usage and costs
   * @param {string} userId - User ID
   * @param {string} provider - LLM provider
   * @param {string} model - LLM model
   * @param {number} inputTokens - Input token count
   * @param {number} outputTokens - Output token count
   */
  async trackTokenUsage(userId, provider, model, inputTokens, outputTokens) {
    try {
      const timestamp = new Date().toISOString();
      const date = timestamp.split('T')[0]; // YYYY-MM-DD
      const month = date.substring(0, 7); // YYYY-MM
      
      // Get model configuration
      const modelConfig = this.providerConfigs[provider]?.models[model];
      
      if (!modelConfig) {
        console.warn(`Unknown model for cost tracking: ${provider}/${model}`);
        return;
      }
      
      // Calculate costs
      const inputCost = (inputTokens / 1000) * modelConfig.inputCostPer1K;
      const outputCost = (outputTokens / 1000) * modelConfig.outputCostPer1K;
      const totalCost = inputCost + outputCost;
      
      // Insert usage record
      await supabase.from('token_usage').insert({
        user_id: userId,
        provider,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        input_cost: inputCost,
        output_cost: outputCost,
        total_cost: totalCost,
        timestamp
      });
      
      // Update daily and monthly aggregates in Redis
      const dailyKey = `usage:${date}:${userId}:${provider}:${model}`;
      const monthlyKey = `usage:${month}:${userId}:${provider}:${model}`;
      
      // Update daily counters
      await redis.hincrby(dailyKey, 'input_tokens', inputTokens);
      await redis.hincrby(dailyKey, 'output_tokens', outputTokens);
      await redis.hincrby(dailyKey, 'total_tokens', inputTokens + outputTokens);
      await redis.hincrbyfloat(dailyKey, 'input_cost', inputCost);
      await redis.hincrbyfloat(dailyKey, 'output_cost', outputCost);
      await redis.hincrbyfloat(dailyKey, 'total_cost', totalCost);
      
      // Set expiration on daily counter (30 days)
      await redis.expire(dailyKey, 60 * 60 * 24 * 30);
      
      // Update monthly counters
      await redis.hincrby(monthlyKey, 'input_tokens', inputTokens);
      await redis.hincrby(monthlyKey, 'output_tokens', outputTokens);
      await redis.hincrby(monthlyKey, 'total_tokens', inputTokens + outputTokens);
      await redis.hincrbyfloat(monthlyKey, 'input_cost', inputCost);
      await redis.hincrbyfloat(monthlyKey, 'output_cost', outputCost);
      await redis.hincrbyfloat(monthlyKey, 'total_cost', totalCost);
      
      // Set expiration on monthly counter (90 days)
      await redis.expire(monthlyKey, 60 * 60 * 24 * 90);
      
      // Check if user is approaching budget limit
      await this.checkBudgetLimits(userId, month, totalCost);
    } catch (error) {
      console.error('Error tracking token usage:', error);
    }
  }

  /**
   * Check if user is approaching budget limits
   * @param {string} userId - User ID
   * @param {string} month - Month in YYYY-MM format
   * @param {number} currentCost - Cost of current request
   */
  async checkBudgetLimits(userId, month, currentCost) {
    try {
      // Get user budget settings
      const { data: budgetSettings, error } = await supabase
        .from('user_settings')
        .select('monthly_budget, budget_alert_threshold')
        .eq('user_id', userId)
        .single();
      
      if (error || !budgetSettings || !budgetSettings.monthly_budget) {
        return; // No budget set
      }
      
      const monthlyBudget = budgetSettings.monthly_budget;
      const alertThreshold = budgetSettings.budget_alert_threshold || 0.8; // Default 80%
      
      // Get current monthly usage
      const { data: usage, error: usageError } = await supabase
        .from('token_usage')
        .select('total_cost')
        .eq('user_id', userId)
        .like('timestamp', `${month}%`);
      
      if (usageError) {
        console.error('Error getting usage for budget check:', usageError);
        return;
      }
      
      // Calculate total usage for the month
      const totalMonthlyUsage = usage.reduce((total, record) => total + record.total_cost, 0) + currentCost;
      
      // Check if approaching or exceeding budget
      const usageRatio = totalMonthlyUsage / monthlyBudget;
      
      if (usageRatio >= 1.0) {
        // Over budget - create notification and set user preferences to use cheaper models
        await this.createBudgetNotification(userId, 'exceeded', totalMonthlyUsage, monthlyBudget);
        await this.updateUserPreferences(userId, 'budget_exceeded');
      } else if (usageRatio >= alertThreshold) {
        // Approaching budget - create notification
        await this.createBudgetNotification(userId, 'approaching', totalMonthlyUsage, monthlyBudget);
      }
    } catch (error) {
      console.error('Error checking budget limits:', error);
    }
  }

  /**
   * Create a budget notification for the user
   * @param {string} userId - User ID
   * @param {string} type - Notification type (approaching, exceeded)
   * @param {number} currentUsage - Current usage amount
   * @param {number} budget - Budget amount
   */
  async createBudgetNotification(userId, type, currentUsage, budget) {
    try {
      // Format amounts as USD
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      });
      
      const currentUsageFormatted = formatter.format(currentUsage);
      const budgetFormatted = formatter.format(budget);
      
      let title, message;
      
      if (type === 'exceeded') {
        title = 'Monthly Budget Exceeded';
        message = `You've exceeded your monthly budget of ${budgetFormatted}. Current usage: ${currentUsageFormatted}. Your preferences have been adjusted to use more cost-effective models.`;
      } else {
        title = 'Approaching Monthly Budget';
        message = `You're approaching your monthly budget of ${budgetFormatted}. Current usage: ${currentUsageFormatted}.`;
      }
      
      // Insert notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'budget',
        title,
        message,
        read: false,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating budget notification:', error);
    }
  }

  /**
   * Update user preferences in response to budget status
   * @param {string} userId - User ID
   * @param {string} reason - Reason for update (budget_exceeded, etc.)
   */
  async updateUserPreferences(userId, reason) {
    try {
      if (reason === 'budget_exceeded') {
        // Update user preferences to use cheaper models
        await supabase
          .from('user_settings')
          .update({
            preferred_model_tier: 'budget',
            cost_optimization_level: 'aggressive',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  }

  /**
   * Estimate token count for a text
   * @param {string} text - Text to estimate tokens for
   * @param {string} provider - LLM provider
   * @returns {number} - Estimated token count
   */
  estimateTokenCount(text, provider = 'OPENAI') {
    if (!text) return 0;
    
    try {
      if (provider === 'OPENAI' && !this.tokenizers.OPENAI) {
        // Initialize OpenAI tokenizer
        this.tokenizers.OPENAI = tiktoken.get_encoding("cl100k_base");
      }
      
      // Use appropriate tokenizer based on provider
      if (provider === 'OPENAI' && this.tokenizers.OPENAI) {
        return this.tokenizers.OPENAI.encode(text).length;
      }
      
      // Fallback to word-based estimation with typical ratios
      const words = text.split(/\s+/).length;
      
      // Tokens are typically 0.75x to 1.5x the number of words depending on language
      const tokenMultipliers = {
        CLAUDE: 1.3,
        OPENAI: 1.3,
        PERPLEXITY: 1.3,
        DEEPSEEK: 1.3,
        DEFAULT: 1.3
      };
      
      return Math.ceil(words * (tokenMultipliers[provider] || tokenMultipliers.DEFAULT));
    } catch (error) {
      console.error('Error estimating token count:', error);
      
      // Fallback to very simple estimation
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Estimate token count for conversation history
   * @param {Array} history - Conversation history
   * @param {string} provider - LLM provider
   * @returns {number} - Estimated token count
   */
  estimateHistoryTokenCount(history, provider) {
    if (!history || !Array.isArray(history)) return 0;
    
    // Sum up token counts for each message
    return history.reduce((total, message) => {
      return total + this.estimateTokenCount(message.content, provider);
    }, 0);
  }

  /**
   * Get the context window size for a model
   * @param {string} provider - LLM provider
   * @param {string} model - Model name
   * @returns {number} - Context window size
   */
  getContextWindowSize(provider, model) {
    const modelConfig = this.providerConfigs[provider]?.models[model];
    
    if (modelConfig && modelConfig.contextWindow) {
      return modelConfig.contextWindow;
    }
    
    // Default values if unknown
    const defaults = {
      CLAUDE: 100000,
      OPENAI: 8000,
      PERPLEXITY: 4000,
      DEEPSEEK: 8000
    };
    
    return defaults[provider] || 4000;
  }

  /**
   * Generate a hash for query deduplication and caching
   * @param {string} query - Query text
   * @returns {string} - Hash string
   */
  generateQueryHash(query) {
    if (!query) return '';
    
    // Normalize the query
    const normalized = query.toLowerCase().trim();
    
    // Extract significant terms (non-stopwords longer than 3 chars)
    const terms = normalized
      .split(/\W+/)
      .filter(term => term.length > 3)
      .filter(term => !this.isStopWord(term));
    
    // Sort for consistency
    terms.sort();
    
    return terms.join('_');
  }

  /**
   * Check if a word is a common stop word
   * @param {string} word - Word to check
   * @returns {boolean} - Is a stop word
   */
  isStopWord(word) {
    const stopWords = [
      'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you',
      'this', 'but', 'his', 'from', 'they', 'say', 'she', 'will',
      'one', 'all', 'would', 'there', 'their', 'what', 'out', 'about',
      'who', 'get', 'which', 'when', 'make', 'can', 'like', 'time',
      'just', 'him', 'know', 'take', 'person', 'into', 'year', 'your',
      'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
      'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also'
    ];
    
    return stopWords.includes(word.toLowerCase());
  }
}

module.exports = new LLMOptimizationService();
