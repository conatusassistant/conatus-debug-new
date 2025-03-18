// backend/services/llm/CostOptimizerService.js
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const { encode } = require('gpt-3-encoder');
const LoggingService = require('../logging/LoggingService');

class CostOptimizerService {
  constructor() {
    // Initialize Redis client
    this.redis = new Redis(process.env.REDIS_URL);
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // LLM Provider pricing (per 1K tokens, in USD)
    this.providerPricing = {
      CLAUDE: {
        'claude-3-opus-20240229': {
          input: 0.015,
          output: 0.075
        },
        'claude-3-sonnet-20240229': {
          input: 0.003,
          output: 0.015
        },
        'claude-3-haiku-20240307': {
          input: 0.00025,
          output: 0.00125
        }
      },
      OPENAI: {
        'gpt-4-turbo': {
          input: 0.01,
          output: 0.03
        },
        'gpt-3.5-turbo': {
          input: 0.0005,
          output: 0.0015
        }
      },
      PERPLEXITY: {
        'sonar-medium-online': {
          input: 0.004,
          output: 0.008
        },
        'sonar-small-online': {
          input: 0.002,
          output: 0.004
        }
      },
      DEEPSEEK: {
        'deepseek-coder': {
          input: 0.002,
          output: 0.006
        },
        'deepseek-chat': {
          input: 0.001,
          output: 0.003
        }
      }
    };
    
    // Daily and monthly budget limits
    this.budgetLimits = {
      development: {
        daily: 50,   // $50 per day
        monthly: 500 // $500 per month
      },
      production: {
        daily: 200,   // $200 per day
        monthly: 3000 // $3000 per month
      }
    };
    
    // Current environment
    this.environment = process.env.NODE_ENV || 'development';
    
    // Initialize usage statistics tracking
    this.initializeUsageTracking();
  }
  
  /**
   * Initialize usage tracking
   */
  async initializeUsageTracking() {
    try {
      // Set up daily usage reset
      const now = new Date();
      const tomorrowMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0
      );
      
      // Calculate time until midnight
      const msUntilMidnight = tomorrowMidnight.getTime() - now.getTime();
      
      // Schedule daily reset
      setTimeout(() => {
        this.resetDailyUsage();
        // Set up daily interval
        setInterval(() => {
          this.resetDailyUsage();
        }, 24 * 60 * 60 * 1000); // 24 hours
      }, msUntilMidnight);
      
      // Set up monthly usage reset (first day of month)
      if (now.getDate() === 1 && now.getHours() < 1) {
        // If it's the first day of month and before 1 AM
        this.resetMonthlyUsage();
      }
      
      const firstDayNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1, 0, 0, 0
      );
      
      const msUntilNextMonth = firstDayNextMonth.getTime() - now.getTime();
      
      // Schedule monthly reset
      setTimeout(() => {
        this.resetMonthlyUsage();
        // Set up monthly interval (approximately)
        setInterval(() => {
          const date = new Date();
          if (date.getDate() === 1) {
            this.resetMonthlyUsage();
          }
        }, 24 * 60 * 60 * 1000); // Check every 24 hours
      }, msUntilNextMonth);
      
      LoggingService.info('Usage tracking initialized');
    } catch (error) {
      LoggingService.error('Failed to initialize usage tracking', error);
    }
  }
  
  /**
   * Reset daily usage statistics
   */
  async resetDailyUsage() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Archive yesterday's usage before resetting
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Get all provider usage keys for yesterday
      const keys = await this.redis.keys(`usage:${yesterdayStr}:*`);
      
      // Archive each provider's usage
      for (const key of keys) {
        const usage = await this.redis.hgetall(key);
        if (Object.keys(usage).length > 0) {
          const provider = key.split(':')[2];
          
          // Store in database
          await this.supabase.from('llm_usage_daily').insert({
            date: yesterdayStr,
            provider,
            queries: parseInt(usage.queries || 0),
            prompt_tokens: parseInt(usage.prompt_tokens || 0),
            completion_tokens: parseInt(usage.completion_tokens || 0),
            estimated_cost: parseFloat(usage.estimated_cost || 0).toFixed(4),
            environment: this.environment
          });
        }
      }
      
      LoggingService.info(`Daily usage reset for ${today}`);
    } catch (error) {
      LoggingService.error('Failed to reset daily usage', error);
    }
  }
  
  /**
   * Reset monthly usage statistics
   */
  async resetMonthlyUsage() {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Get previous month
      let previousMonth = currentMonth - 1;
      let previousYear = currentYear;
      if (previousMonth < 0) {
        previousMonth = 11;
        previousYear--;
      }
      
      const previousMonthStr = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}`;
      
      // Get monthly usage from database
      const { data: dailyUsage, error } = await this.supabase
        .from('llm_usage_daily')
        .select('provider, prompt_tokens, completion_tokens, estimated_cost')
        .like('date', `${previousMonthStr}-%`)
        .eq('environment', this.environment);
      
      if (error) {
        throw error;
      }
      
      // Aggregate by provider
      const providerUsage = {};
      
      for (const usage of dailyUsage) {
        if (!providerUsage[usage.provider]) {
          providerUsage[usage.provider] = {
            prompt_tokens: 0,
            completion_tokens: 0,
            estimated_cost: 0
          };
        }
        
        providerUsage[usage.provider].prompt_tokens += usage.prompt_tokens;
        providerUsage[usage.provider].completion_tokens += usage.completion_tokens;
        providerUsage[usage.provider].estimated_cost += parseFloat(usage.estimated_cost);
      }
      
      // Store monthly aggregates
      for (const [provider, usage] of Object.entries(providerUsage)) {
        await this.supabase.from('llm_usage_monthly').insert({
          month: previousMonthStr,
          provider,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          estimated_cost: usage.estimated_cost.toFixed(4),
          environment: this.environment
        });
      }
      
      // Reset monthly usage in Redis
      const monthKey = `monthly_usage:${this.environment}`;
      await this.redis.del(monthKey);
      
      LoggingService.info(`Monthly usage reset for ${previousMonthStr}`);
    } catch (error) {
      LoggingService.error('Failed to reset monthly usage', error);
    }
  }
  
  /**
   * Calculate estimated cost for a query
   * @param {string} provider - Provider ID (CLAUDE, OPENAI, etc.)
   * @param {string} model - Model name
   * @param {number} promptTokens - Number of prompt tokens
   * @param {number} completionTokens - Number of completion tokens
   * @returns {number} Estimated cost in USD
   */
  calculateCost(provider, model, promptTokens, completionTokens) {
    try {
      const pricing = this.providerPricing[provider]?.[model];
      
      if (!pricing) {
        // Fallback to average pricing if specific model not found
        const fallbackPricing = {
          CLAUDE: { input: 0.01, output: 0.03 },
          OPENAI: { input: 0.005, output: 0.015 },
          PERPLEXITY: { input: 0.003, output: 0.006 },
          DEEPSEEK: { input: 0.0015, output: 0.0045 }
        };
        
        const fallback = fallbackPricing[provider] || { input: 0.005, output: 0.015 };
        
        return (
          (promptTokens / 1000) * fallback.input +
          (completionTokens / 1000) * fallback.output
        );
      }
      
      // Calculate cost based on pricing
      return (
        (promptTokens / 1000) * pricing.input +
        (completionTokens / 1000) * pricing.output
      );
    } catch (error) {
      LoggingService.error('Error calculating cost', error);
      // Return a reasonable fallback
      return (promptTokens + completionTokens) * 0.00001;
    }
  }
  
  /**
   * Count tokens in a text string
   * @param {string} text - Text to count tokens for
   * @returns {number} Token count
   */
  countTokens(text) {
    try {
      // Use GPT tokenizer (works reasonably well for most models)
      return encode(text).length;
    } catch (error) {
      LoggingService.error('Error counting tokens', error);
      // Fallback to approximate count (assumes ~4 chars per token)
      return Math.ceil(text.length / 4);
    }
  }
  
  /**
   * Check if query can be served from cache
   * @param {string} query - User query
   * @param {string} provider - Provider ID
   * @returns {Promise<Object|null>} Cached response or null
   */
  async checkCache(query, provider) {
    try {
      // Generate cache key
      const normalizedQuery = query.toLowerCase().trim();
      const tokens = normalizedQuery.split(/\s+/)
        .filter(token => token.length > 3)
        .map(token => token.toLowerCase());
      
      const sortedTokens = [...new Set(tokens)].sort();
      const cacheKey = `${provider}:${sortedTokens.join('_')}`;
      
      // Check Redis cache
      const cached = await this.redis.get(`llm_cache:${cacheKey}`);
      
      if (cached) {
        // Update cache hit counter
        await this.redis.hincrby('cache_metrics', 'hits', 1);
        return JSON.parse(cached);
      }
      
      // Update cache miss counter
      await this.redis.hincrby('cache_metrics', 'misses', 1);
      return null;
    } catch (error) {
      LoggingService.error('Error checking cache', error);
      return null;
    }
  }
  
  /**
   * Store response in cache
   * @param {string} query - User query
   * @param {string} provider - Provider ID
   * @param {Object} response - Response to cache
   * @param {number} ttl - Time to live in seconds (default 1 hour)
   */
  async cacheResponse(query, provider, response, ttl = 3600) {
    try {
      // Generate cache key
      const normalizedQuery = query.toLowerCase().trim();
      const tokens = normalizedQuery.split(/\s+/)
        .filter(token => token.length > 3)
        .map(token => token.toLowerCase());
      
      const sortedTokens = [...new Set(tokens)].sort();
      const cacheKey = `${provider}:${sortedTokens.join('_')}`;
      
      // Store in Redis with TTL
      await this.redis.set(
        `llm_cache:${cacheKey}`,
        JSON.stringify(response),
        'EX',
        ttl
      );
    } catch (error) {
      LoggingService.error('Error caching response', error);
    }
  }
  
  /**
   * Implement semantic caching with embeddings
   * @param {string} query - User query
   * @param {Array} embeddings - Query embeddings
   * @returns {Promise<Object|null>} Semantically similar cached response or null
   */
  async checkSemanticCache(query, embeddings) {
    // This is a placeholder for semantic caching implementation
    // Would require vector database like Pinecone or Qdrant
    return null;
  }
  
  /**
   * Track usage for a query
   * @param {string} provider - Provider ID
   * @param {string} model - Model name
   * @param {number} promptTokens - Number of prompt tokens
   * @param {number} completionTokens - Number of completion tokens
   * @param {string} userId - User ID
   */
  async trackUsage(provider, model, promptTokens, completionTokens, userId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `usage:${today}:${provider}`;
      
      // Calculate cost
      const cost = this.calculateCost(provider, model, promptTokens, completionTokens);
      
      // Update provider-specific usage
      await this.redis.hincrby(key, 'queries', 1);
      await this.redis.hincrby(key, 'prompt_tokens', promptTokens);
      await this.redis.hincrby(key, 'completion_tokens', completionTokens);
      await this.redis.hincrbyfloat(key, 'estimated_cost', cost);
      
      // Update daily totals
      const dailyKey = `daily_usage:${this.environment}`;
      await this.redis.hincrbyfloat(dailyKey, 'cost', cost);
      
      // Update monthly totals
      const monthlyKey = `monthly_usage:${this.environment}`;
      await this.redis.hincrbyfloat(monthlyKey, 'cost', cost);
      
      // Update user-specific usage if userId provided
      if (userId) {
        const userKey = `user_usage:${userId}:${today}`;
        await this.redis.hincrby(userKey, 'queries', 1);
        await this.redis.hincrby(userKey, 'prompt_tokens', promptTokens);
        await this.redis.hincrby(userKey, 'completion_tokens', completionTokens);
        await this.redis.hincrbyfloat(userKey, 'estimated_cost', cost);
        
        // Set expiration for user keys (30 days)
        await this.redis.expire(userKey, 30 * 24 * 60 * 60);
      }
      
      // Set expiration for daily keys (30 days)
      await this.redis.expire(key, 30 * 24 * 60 * 60);
      
      // Log usage
      LoggingService.debug('LLM usage tracked', {
        provider,
        model,
        promptTokens,
        completionTokens,
        cost,
        userId
      });
    } catch (error) {
      LoggingService.error('Error tracking usage', error);
    }
  }
  
  /**
   * Check if budget limits are reached
   * @returns {Promise<Object>} Budget status
   */
  async checkBudgetLimits() {
    try {
      const dailyKey = `daily_usage:${this.environment}`;
      const monthlyKey = `monthly_usage:${this.environment}`;
      
      // Get current usage
      const dailyCost = parseFloat(await this.redis.hget(dailyKey, 'cost') || '0');
      const monthlyCost = parseFloat(await this.redis.hget(monthlyKey, 'cost') || '0');
      
      // Get limits
      const { daily: dailyLimit, monthly: monthlyLimit } = this.budgetLimits[this.environment];
      
      // Calculate percentages
      const dailyPercentage = (dailyCost / dailyLimit) * 100;
      const monthlyPercentage = (monthlyCost / monthlyLimit) * 100;
      
      // Determine if limits are reached
      const isDailyLimitReached = dailyCost >= dailyLimit;
      const isMonthlyLimitReached = monthlyCost >= monthlyLimit;
      const isWarningLevel = dailyPercentage >= 80 || monthlyPercentage >= 80;
      
      // Log if reaching limits
      if (isDailyLimitReached || isMonthlyLimitReached) {
        LoggingService.warn('Budget limit reached', {
          daily: { cost: dailyCost, limit: dailyLimit, percentage: dailyPercentage },
          monthly: { cost: monthlyCost, limit: monthlyLimit, percentage: monthlyPercentage }
        });
      } else if (isWarningLevel) {
        LoggingService.info('Budget warning level reached', {
          daily: { cost: dailyCost, limit: dailyLimit, percentage: dailyPercentage },
          monthly: { cost: monthlyCost, limit: monthlyLimit, percentage: monthlyPercentage }
        });
      }
      
      return {
        daily: {
          cost: dailyCost,
          limit: dailyLimit,
          percentage: dailyPercentage,
          limitReached: isDailyLimitReached
        },
        monthly: {
          cost: monthlyCost,
          limit: monthlyLimit,
          percentage: monthlyPercentage,
          limitReached: isMonthlyLimitReached
        },
        isLimitReached: isDailyLimitReached || isMonthlyLimitReached,
        isWarningLevel
      };
    } catch (error) {
      LoggingService.error('Error checking budget limits', error);
      
      // Return a conservative response if error occurs
      return {
        isLimitReached: false,
        isWarningLevel: true,
        error: true
      };
    }
  }
  
  /**
   * Get an appropriate model based on cost efficiency
   * @param {string} provider - Provider ID
   * @param {string} preferredModel - Preferred model
   * @param {Object} context - Query context
   * @returns {string} Selected model name
   */
  getEfficientModel(provider, preferredModel, context = {}) {
    try {
      // Check if budget limits are approaching
      const budgetStatus = context.budgetStatus || {
        isWarningLevel: false,
        isLimitReached: false
      };
      
      // If no budget issues, use preferred model
      if (!budgetStatus.isWarningLevel && !budgetStatus.isLimitReached) {
        return preferredModel;
      }
      
      // If budget limit reached, use most economical model
      if (budgetStatus.isLimitReached) {
        const models = Object.keys(this.providerPricing[provider] || {});
        
        if (models.length === 0) {
          return preferredModel;
        }
        
        // Find cheapest model based on output cost
        let cheapestModel = models[0];
        let lowestCost = this.providerPricing[provider][cheapestModel].output;
        
        for (const model of models) {
          const cost = this.providerPricing[provider][model].output;
          if (cost < lowestCost) {
            lowestCost = cost;
            cheapestModel = model;
          }
        }
        
        return cheapestModel;
      }
      
      // If warning level, use mid-tier model
      if (budgetStatus.isWarningLevel) {
        const models = Object.keys(this.providerPricing[provider] || {});
        
        if (models.length <= 1) {
          return preferredModel;
        }
        
        // Sort models by output cost
        const sortedModels = models.sort((a, b) => {
          const costA = this.providerPricing[provider][a].output;
          const costB = this.providerPricing[provider][b].output;
          return costA - costB;
        });
        
        // Use second cheapest model if available
        if (sortedModels.length >= 2) {
          return sortedModels[1];
        }
        
        return sortedModels[0];
      }
      
      return preferredModel;
    } catch (error) {
      LoggingService.error('Error selecting efficient model', error);
      return preferredModel;
    }
  }
}

module.exports = new CostOptimizerService();
