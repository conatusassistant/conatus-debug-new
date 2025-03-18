// backend/services/classification/ClassificationService.js
/**
 * Query Classification Service
 * 
 * This service analyzes user queries and routes them to the most appropriate LLM provider
 * based on the architecture defined in the Conatus system design.
 */

const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const natural = require('natural');
const { OpenAI } = require('openai');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize tokenizer for feature extraction
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

class ClassificationService {
  constructor() {
    // Provider mapping based on characteristics
    this.providers = {
      CLAUDE: {
        name: 'Claude',
        bestFor: ['CODING', 'REASONING', 'EXPLANATION'],
        apiConfig: {
          url: 'https://api.anthropic.com/v1/messages',
          key: process.env.CLAUDE_API_KEY
        }
      },
      PERPLEXITY: {
        name: 'Perplexity',
        bestFor: ['SEARCH', 'RESEARCH', 'CURRENT_EVENTS'],
        apiConfig: {
          url: 'https://api.perplexity.ai/chat/completions',
          key: process.env.PERPLEXITY_API_KEY
        }
      },
      OPENAI: {
        name: 'OpenAI',
        bestFor: ['CREATIVE', 'SUMMARIZATION', 'EMOTIONAL'],
        apiConfig: {
          key: process.env.OPENAI_API_KEY
        }
      },
      DEEPSEEK: {
        name: 'DeepSeek',
        bestFor: ['TECHNICAL', 'PROGRAMMING', 'DOCUMENTATION'],
        apiConfig: {
          url: 'https://api.deepseek.com/v1/chat/completions',
          key: process.env.DEEPSEEK_API_KEY
        }
      }
    };
    
    // Keywords for rule-based classification
    this.keywordMap = {
      CODING: ['code', 'function', 'algorithm', 'program', 'script', 'programming', 'python', 'javascript', 'java', 'class', 'method'],
      SEARCH: ['find', 'search', 'locate', 'where', 'when', 'latest', 'discover', 'lookup', 'info about', 'information on'],
      CREATIVE: ['write', 'story', 'poem', 'creative', 'imagine', 'fiction', 'compose', 'design', 'art', 'creative', 'invent'],
      TECHNICAL: ['technical', 'documentation', 'specification', 'architecture', 'system', 'protocol', 'analysis', 'deep dive', 'explain how'],
      REASONING: ['reason', 'logic', 'analyze', 'philosophy', 'ethics', 'argument', 'debate', 'implications', 'consequences'],
      CURRENT_EVENTS: ['news', 'current', 'today', 'recent', 'latest', 'event', 'update', 'happening']
    };
  }

  /**
   * Classify a query and determine the optimal LLM provider
   * @param {string} query - User's query text
   * @param {Object} context - Additional context for classification
   * @returns {Promise<string>} - Provider identifier (CLAUDE, PERPLEXITY, etc.)
   */
  async classifyQuery(query, context = {}) {
    try {
      // 1. Check cache first for similar queries
      const cacheResult = await this.checkCache(query);
      if (cacheResult) {
        console.log(`Cache hit for query classification: ${cacheResult}`);
        return cacheResult;
      }
      
      // 2. Apply rule-based classification first (faster than ML)
      const ruleBasedResult = this.applyRules(query);
      if (ruleBasedResult && ruleBasedResult.confidence > 0.8) {
        console.log(`Rule-based classification result: ${ruleBasedResult.provider} (${ruleBasedResult.confidence})`);
        this.cacheResult(query, ruleBasedResult.provider);
        return ruleBasedResult.provider;
      }
      
      // 3. Apply ML-based classification for more nuanced queries
      const mlResult = await this.classifyWithML(query, context);
      
      // 4. Apply fallback logic if confidence is low
      if (mlResult.confidence < 0.6) {
        const fallbackProvider = this.determineFallback(mlResult.category, context);
        console.log(`Low confidence, using fallback: ${fallbackProvider}`);
        this.cacheResult(query, fallbackProvider);
        return fallbackProvider;
      }
      
      // 5. Cache result for future similar queries
      this.cacheResult(query, mlResult.provider);
      
      return mlResult.provider;
    } catch (error) {
      console.error('Error in query classification:', error);
      // Default to OpenAI as a safe fallback
      return 'OPENAI';
    }
  }
  
  /**
   * Apply rule-based classification using keyword matching
   * @param {string} query - User query
   * @returns {Object|null} - Classification result or null if no strong match
   */
  applyRules(query) {
    // Normalize the query
    const normalizedQuery = query.toLowerCase();
    
    // Check for explicit model requests
    if (/\b(use|with|via|through|using)\s+(claude|anthropic)\b/i.test(normalizedQuery)) {
      return { provider: 'CLAUDE', confidence: 0.95, category: 'EXPLICIT_REQUEST' };
    }
    
    if (/\b(use|with|via|through|using)\s+(perplexity)\b/i.test(normalizedQuery)) {
      return { provider: 'PERPLEXITY', confidence: 0.95, category: 'EXPLICIT_REQUEST' };
    }
    
    if (/\b(use|with|via|through|using)\s+(gpt|openai|chatgpt)\b/i.test(normalizedQuery)) {
      return { provider: 'OPENAI', confidence: 0.95, category: 'EXPLICIT_REQUEST' };
    }
    
    if (/\b(use|with|via|through|using)\s+(deepseek)\b/i.test(normalizedQuery)) {
      return { provider: 'DEEPSEEK', confidence: 0.95, category: 'EXPLICIT_REQUEST' };
    }
    
    // Extract tokens from query
    const tokens = tokenizer.tokenize(normalizedQuery);
    const stems = tokens.map(token => stemmer.stem(token));
    
    // Calculate category scores based on keyword matches
    const categoryScores = {};
    let totalMatches = 0;
    
    for (const [category, keywords] of Object.entries(this.keywordMap)) {
      const matches = keywords.filter(keyword => 
        normalizedQuery.includes(keyword) || 
        stems.some(stem => stem === stemmer.stem(keyword))
      );
      
      categoryScores[category] = matches.length;
      totalMatches += matches.length;
    }
    
    // Find category with highest score
    let bestCategory = null;
    let highestScore = 0;
    
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > highestScore) {
        highestScore = score;
        bestCategory = category;
      }
    }
    
    // Calculate confidence based on match strength
    if (bestCategory && highestScore > 0) {
      const confidence = Math.min(0.7 + (highestScore * 0.1), 0.9);
      
      // Map category to provider
      const provider = this.mapCategoryToProvider(bestCategory);
      
      return { 
        provider, 
        confidence, 
        category: bestCategory 
      };
    }
    
    // No strong match found
    return null;
  }
  
  /**
   * Classify query using OpenAI for more nuanced understanding
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Classification result
   */
  async classifyWithML(query, context = {}) {
    try {
      // Use a lightweight model for classification to reduce cost
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a classification system that determines the optimal LLM to use for a query. 
            Respond with JSON only in this format: {"category": "CATEGORY_NAME", "confidence": CONFIDENCE_SCORE, "reasoning": "brief explanation"}
            
            Possible categories:
            - CODING: Programming tasks, code generation, debugging (maps to Claude)
            - REASONING: Complex reasoning, logical analysis, multi-step thinking (maps to Claude)
            - EXPLANATION: Detailed explanations of complex concepts (maps to Claude)
            - SEARCH: Information retrieval, factual questions, lookup tasks (maps to Perplexity)
            - RESEARCH: In-depth research questions requiring synthesis (maps to Perplexity)
            - CURRENT_EVENTS: Recent news, events, or developments (maps to Perplexity)
            - CREATIVE: Creative writing, ideation, artistic content (maps to OpenAI)
            - SUMMARIZATION: Content summarization, extraction (maps to OpenAI)
            - EMOTIONAL: Empathetic responses, subjective content (maps to OpenAI)
            - TECHNICAL: Specialized technical documentation or analysis (maps to DeepSeek)
            - PROGRAMMING: Specialized programming tasks (maps to DeepSeek)
            - DOCUMENTATION: Creating technical documentation (maps to DeepSeek)
            `
          },
          {
            role: 'user',
            content: `Classify this query: "${query}"`
          }
        ],
        temperature: 0,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });
      
      // Parse the response
      const content = response.choices[0].message.content;
      const result = JSON.parse(content);
      
      // Map the category to a provider
      const provider = this.mapCategoryToProvider(result.category);
      
      return {
        provider,
        confidence: result.confidence,
        category: result.category,
        reasoning: result.reasoning
      };
    } catch (error) {
      console.error('Error in ML classification:', error);
      // Fallback to basic classification
      const ruleResult = this.applyRules(query) || { 
        provider: 'OPENAI', 
        confidence: 0.5, 
        category: 'FALLBACK' 
      };
      return ruleResult;
    }
  }
  
  /**
   * Map a category to the appropriate provider
   * @param {string} category - Query category
   * @returns {string} - Provider identifier
   */
  mapCategoryToProvider(category) {
    // Find provider that lists this category in bestFor
    for (const [provider, details] of Object.entries(this.providers)) {
      if (details.bestFor.includes(category)) {
        return provider;
      }
    }
    
    // Default fallback
    return 'OPENAI';
  }
  
  /**
   * Check if a similar query exists in cache
   * @param {string} query - User query
   * @returns {Promise<string|null>} - Cached provider or null
   */
  async checkCache(query) {
    try {
      // Normalize the query
      const normalizedQuery = query.toLowerCase();
      
      // Generate a semantic hash for the query (simplified version)
      const queryHash = this.generateQueryHash(normalizedQuery);
      
      // Check Redis cache
      const cachedProvider = await redis.get(`query_class:${queryHash}`);
      return cachedProvider;
    } catch (error) {
      console.error('Error checking classification cache:', error);
      return null;
    }
  }
  
  /**
   * Cache a classification result
   * @param {string} query - User query
   * @param {string} provider - Provider identifier
   */
  async cacheResult(query, provider) {
    try {
      // Normalize the query
      const normalizedQuery = query.toLowerCase();
      
      // Generate a semantic hash for the query
      const queryHash = this.generateQueryHash(normalizedQuery);
      
      // Store in Redis with 1-hour expiration
      await redis.set(`query_class:${queryHash}`, provider, 'EX', 3600);
    } catch (error) {
      console.error('Error caching classification result:', error);
    }
  }
  
  /**
   * Generate a hash for query caching
   * @param {string} query - Normalized query
   * @returns {string} - Query hash
   */
  generateQueryHash(query) {
    // Extract key terms (simplified approach)
    const tokens = tokenizer.tokenize(query)
      .filter(token => token.length > 3)  // Remove short tokens
      .map(token => stemmer.stem(token)); // Stem for better matching
    
    // Remove common stop words
    const stopWords = ['the', 'and', 'a', 'to', 'of', 'for', 'in', 'on', 'is', 'that', 'it', 'with', 'as', 'be', 'this', 'was', 'are'];
    const filteredTokens = tokens.filter(token => !stopWords.includes(token));
    
    // Sort for consistency and join
    const sortedTokens = filteredTokens.sort();
    return sortedTokens.join('_');
  }
  
  /**
   * Determine fallback provider when confidence is low
   * @param {string} category - Classified category
   * @param {Object} context - Request context
   * @returns {string} - Fallback provider
   */
  determineFallback(category, context) {
    // Check if user has preference
    if (context.userPreference && this.providers[context.userPreference]) {
      return context.userPreference;
    }
    
    // Check service availability
    if (context.serviceStatus) {
      const availableProviders = Object.keys(this.providers).filter(
        provider => context.serviceStatus[provider] === 'available'
      );
      
      if (availableProviders.length > 0) {
        // Use first available provider
        return availableProviders[0];
      }
    }
    
    // Default fallback is OpenAI (generally most reliable)
    return 'OPENAI';
  }
  
  /**
   * Get provider configuration for a given provider ID
   * @param {string} providerId - Provider identifier
   * @returns {Object} - Provider configuration
   */
  getProviderConfig(providerId) {
    return this.providers[providerId] || this.providers.OPENAI;
  }
}

module.exports = new ClassificationService();
