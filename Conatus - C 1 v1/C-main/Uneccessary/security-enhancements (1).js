// backend/services/security/TokenService.js
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const LoggingService = require('../logging/LoggingService');

/**
 * Service for secure token handling and encryption
 */
class TokenService {
  constructor() {
    // Initialize environment variables
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new Error('Invalid TOKEN_ENCRYPTION_KEY. Must be at least 32 characters long.');
    }
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Algorithm configurations
    this.algorithm = 'aes-256-gcm';
    this.ivLength = 16; // For AES, this is always 16 bytes
    this.authTagLength = 16; // For GCM mode
  }
  
  /**
   * Encrypt a token or sensitive data
   * @param {string} plainText - Token or data to encrypt
   * @returns {string} Encrypted token as hex string
   */
  encryptToken(plainText) {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        this.algorithm, 
        Buffer.from(this.encryptionKey, 'utf8').slice(0, 32), 
        iv
      );
      
      // Encrypt the token
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV, encrypted data, and auth tag
      const result = iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
      
      return result;
    } catch (error) {
      LoggingService.error('Error encrypting token', error);
      throw new Error('Token encryption failed');
    }
  }
  
  /**
   * Decrypt an encrypted token
   * @param {string} encryptedText - Encrypted token
   * @returns {string} Decrypted token
   */
  decryptToken(encryptedText) {
    try {
      // Split the encrypted text into its components
      const [ivHex, encryptedDataHex, authTagHex] = encryptedText.split(':');
      
      // Convert hex strings to buffers
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedData = Buffer.from(encryptedDataHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm, 
        Buffer.from(this.encryptionKey, 'utf8').slice(0, 32), 
        iv
      );
      
      // Set authentication tag
      decipher.setAuthTag(authTag);
      
      // Decrypt the token
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      LoggingService.error('Error decrypting token', error);
      throw new Error('Token decryption failed');
    }
  }
  
  /**
   * Store a service token securely
   * @param {string} userId - User ID
   * @param {string} service - Service identifier
   * @param {Object} tokens - Token data (access_token, refresh_token, etc.)
   * @returns {Promise<Object>} Result of storage operation
   */
  async storeServiceToken(userId, service, tokens) {
    try {
      // Encrypt the tokens
      const encryptedTokens = this.encryptToken(JSON.stringify(tokens));
      
      // Calculate expiration time if provided
      let expiresAt = null;
      if (tokens.expires_in) {
        expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);
      }
      
      // Store in database
      const { data, error } = await this.supabase
        .from('service_tokens')
        .upsert({
          user_id: userId,
          service_id: service,
          encrypted_tokens: encryptedTokens,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_id'
        });
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      LoggingService.error('Error storing service token', error);
      throw new Error('Failed to store service token');
    }
  }
  
  /**
   * Retrieve a service token
   * @param {string} userId - User ID
   * @param {string} service - Service identifier
   * @returns {Promise<Object|null>} Token data or null if not found
   */
  async getServiceToken(userId, service) {
    try {
      // Query database
      const { data, error } = await this.supabase
        .from('service_tokens')
        .select('encrypted_tokens, expires_at')
        .eq('user_id', userId)
        .eq('service_id', service)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      // Check if token is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // Token is expired, try to refresh
        return null;
      }
      
      // Decrypt token
      const tokenData = JSON.parse(this.decryptToken(data.encrypted_tokens));
      
      return tokenData;
    } catch (error) {
      LoggingService.error('Error retrieving service token', error);
      return null;
    }
  }
  
  /**
   * Update a stored token (e.g., after refresh)
   * @param {string} userId - User ID
   * @param {string} service - Service identifier
   * @param {Object} tokens - New token data
   * @returns {Promise<boolean>} Success status
   */
  async updateServiceToken(userId, service, tokens) {
    try {
      return await this.storeServiceToken(userId, service, tokens);
    } catch (error) {
      LoggingService.error('Error updating service token', error);
      return false;
    }
  }
  
  /**
   * Delete a stored token
   * @param {string} userId - User ID
   * @param {string} service - Service identifier
   * @returns {Promise<boolean>} Success status
   */
  async deleteServiceToken(userId, service) {
    try {
      const { error } = await this.supabase
        .from('service_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('service_id', service);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      LoggingService.error('Error deleting service token', error);
      return false;
    }
  }
  
  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} Random token as hex string
   */
  generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

module.exports = new TokenService();

// backend/middleware/ValidationMiddleware.js
const { validationResult, check } = require('express-validator');
const LoggingService = require('../services/logging/LoggingService');

/**
 * Common validation rules for endpoints
 */
const validationRules = {
  userId: check('userId').isString().trim().escape(),
  email: check('email').isEmail().normalizeEmail(),
  password: check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  conversationId: check('conversationId').optional().isUUID(),
  query: check('query').isString().trim().not().isEmpty().withMessage('Query is required'),
  serviceId: check('serviceId').isString().trim().not().isEmpty(),
  automationId: check('automationId').optional().isUUID(),
  limit: check('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  page: check('page').optional().isInt({ min: 1 }).toInt(),
  content: check('content').isString().trim().not().isEmpty()
};

/**
 * Create validation middleware for specific routes
 * @param {Array} rules - Array of validation rules
 * @returns {Function} Express middleware
 */
const validate = (rules) => {
  return async (req, res, next) => {
    // Apply all rules
    await Promise.all(rules.map(rule => rule.run(req)));
    
    // Check for validation errors
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    // Log validation errors
    LoggingService.warn('Request validation failed', {
      method: req.method,
      url: req.url,
      errors: errors.array()
    });
    
    // Return validation errors
    return res.status(400).json({
      status: 'error',
      errors: errors.array()
    });
  };
};

// Export validation middleware functions
module.exports = {
  validate,
  rules: validationRules,
  
  // Predefined validation middleware for common routes
  validateQuery: validate([
    validationRules.query
  ]),
  
  validateConversation: validate([
    validationRules.conversationId.optional(),
    validationRules.query
  ]),
  
  validateService: validate([
    validationRules.serviceId
  ]),
  
  validateAutomation: validate([
    validationRules.serviceId,
    check('params').isObject().withMessage('Params must be an object')
  ]),
  
  validateList: validate([
    validationRules.limit.optional(),
    validationRules.page.optional()
  ])
};

// backend/middleware/RateLimitMiddleware.js
const Redis = require('ioredis');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const LoggingService = require('../services/logging/LoggingService');

/**
 * Rate limiting middleware using Redis
 */
class RateLimitMiddleware {
  constructor() {
    // Initialize Redis client
    this.redisClient = new Redis(process.env.REDIS_URL);
    
    // Create rate limiters for different resources
    this.rateLimiters = {
      // API rate limiter - 100 requests per minute per IP
      api: new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'ratelimit:api',
        points: 100, // Number of requests
        duration: 60, // Per minute
        blockDuration: 60 // Block for 1 minute if exceeded
      }),
      
      // LLM query rate limiter - 10 queries per minute per user
      query: new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'ratelimit:query',
        points: 10, // Number of queries
        duration: 60, // Per minute
        blockDuration: 60 // Block for 1 minute if exceeded
      }),
      
      // Automation rate limiter - 5 automations per minute per user
      automation: new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'ratelimit:automation',
        points: 5, // Number of automations
        duration: 60, // Per minute
        blockDuration: 60 // Block for 1 minute if exceeded
      }),
      
      // OAuth rate limiter - 10 requests per hour per IP
      oauth: new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'ratelimit:oauth',
        points: 10, // Number of requests
        duration: 60 * 60, // Per hour
        blockDuration: 60 * 10 // Block for 10 minutes if exceeded
      })
    };
  }
  
  /**
   * API rate limiting middleware
   * @returns {Function} Express middleware
   */
  apiLimiter() {
    return async (req, res, next) => {
      try {
        // Get IP address
        const ip = req.ip || req.connection.remoteAddress;
        
        // Consume points
        await this.rateLimiters.api.consume(ip);
        next();
      } catch (error) {
        if (error instanceof Error) {
          LoggingService.error('Rate limit error', error);
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
          });
        }
        
        // Rate limit exceeded
        LoggingService.warn('API rate limit exceeded', {
          ip: req.ip,
          method: req.method,
          url: req.url
        });
        
        // Set rate limit headers
        res.set('Retry-After', Math.ceil(error.msBeforeNext / 1000));
        res.set('X-RateLimit-Limit', this.rateLimiters.api.points);
        res.set('X-RateLimit-Remaining', error.remainingPoints < 0 ? 0 : error.remainingPoints);
        res.set('X-RateLimit-Reset', new Date(Date.now() + error.msBeforeNext).toISOString());
        
        return res.status(429).json({
          status: 'error',
          code: 'api/rate-limit',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(error.msBeforeNext / 1000)
        });
      }
    };
  }
  
  /**
   * LLM query rate limiting middleware
   * @returns {Function} Express middleware
   */
  queryLimiter() {
    return async (req, res, next) => {
      try {
        // Get user ID or IP address
        const key = req.user?.id || req.ip;
        
        // Consume points
        await this.rateLimiters.query.consume(key);
        next();
      } catch (error) {
        if (error instanceof Error) {
          LoggingService.error('Rate limit error', error);
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
          });
        }
        
        // Rate limit exceeded
        LoggingService.warn('Query rate limit exceeded', {
          user: req.user?.id || 'anonymous',
          ip: req.ip
        });
        
        // Set rate limit headers
        res.set('Retry-After', Math.ceil(error.msBeforeNext / 1000));
        
        return res.status(429).json({
          status: 'error',
          code: 'query/rate-limit',
          message: 'LLM query rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(error.msBeforeNext / 1000)
        });
      }
    };
  }
  
  /**
   * Automation rate limiting middleware
   * @returns {Function} Express middleware
   */
  automationLimiter() {
    return async (req, res, next) => {
      try {
        // Get user ID or IP address
        const key = req.user?.id || req.ip;
        
        // Consume points
        await this.rateLimiters.automation.consume(key);
        next();
      } catch (error) {
        if (error instanceof Error) {
          LoggingService.error('Rate limit error', error);
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
          });
        }
        
        // Rate limit exceeded
        LoggingService.warn('Automation rate limit exceeded', {
          user: req.user?.id || 'anonymous',
          ip: req.ip
        });
        
        return res.status(429).json({
          status: 'error',
          code: 'automation/rate-limit',
          message: 'Automation rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(error.msBeforeNext / 1000)
        });
      }
    };
  }
  
  /**
   * OAuth rate limiting middleware
   * @returns {Function} Express middleware
   */
  oauthLimiter() {
    return async (req, res, next) => {
      try {
        // Get IP address
        const ip = req.ip;
        
        // Consume points
        await this.rateLimiters.oauth.consume(ip);
        next();
      } catch (error) {
        if (error instanceof Error) {
          LoggingService.error('Rate limit error', error);
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
          });
        }
        
        // Rate limit exceeded
        LoggingService.warn('OAuth rate limit exceeded', {
          ip: req.ip
        });
        
        return res.status(429).json({
          status: 'error',
          code: 'oauth/rate-limit',
          message: 'Too many OAuth requests. Please try again later.',
          retryAfter: Math.ceil(error.msBeforeNext / 1000)
        });
      }
    };
  }
}

module.exports = new RateLimitMiddleware();

// backend/middleware/SecurityMiddleware.js
const helmet = require('helmet');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const LoggingService = require('../services/logging/LoggingService');

/**
 * Security middleware for Express app
 */
class SecurityMiddleware {
  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  
  /**
   * Apply all security middleware to Express app
   * @param {Object} app - Express app
   */
  applyMiddleware(app) {
    // Apply Helmet for security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "*.cloudflare.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "*.googleapis.com"],
          imgSrc: ["'self'", "data:", "*.cloudinary.com"],
          connectSrc: ["'self'", process.env.SUPABASE_URL, "*.anthropic.com", "*.openai.com", "*.perplexity.ai", "*.deepseek.com"],
          frameSrc: ["'self'"],
          fontSrc: ["'self'", "data:", "*.googleapis.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      }
    }));
    
    // Apply CORS
    app.use(cors({
      origin: this.getCorsOrigins(),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400 // 24 hours
    }));
    
    // Prevent clickjacking
    app.use((req, res, next) => {
      res.setHeader('X-Frame-Options', 'DENY');
      next();
    });
    
    // Apply auth middleware
    app.use(this.authMiddleware.bind(this));
    
    LoggingService.info('Security middleware applied');
  }
  
  /**
   * Get CORS origins based on environment
   * @returns {Function|Array} CORS origin configuration
   */
  getCorsOrigins() {
    const environment = process.env.NODE_ENV || 'development';
    
    if (environment === 'development') {
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8000'
      ];
    }
    
    if (environment === 'production') {
      return [
        'https://conatus.app',
        'https://www.conatus.app',
        process.env.FRONTEND_URL
      ].filter(Boolean);
    }
    
    // Dynamic origin validation
    return (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check against allowed origins
      const allowedOrigins = [
        'https://conatus.app',
        'https://www.conatus.app',
        process.env.FRONTEND_URL,
        'http://localhost:3000'
      ].filter(Boolean);
      
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.conatus.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    };
  }
  
  /**
   * Authentication middleware using Supabase JWT
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next function
   */
  async authMiddleware(req, res, next) {
    try {
      // Get authorization header
      const authHeader = req.headers.authorization;
      
      // Skip auth for public routes
      if (this.isPublicRoute(req.path)) {
        return next();
      }
      
      if (!authHeader) {
        return res.status(401).json({
          status: 'error',
          code: 'auth/missing-token',
          message: 'Authentication required'
        });
      }
      
      // Extract token
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          status: 'error',
          code: 'auth/invalid-token',
          message: 'Invalid authentication token'
        });
      }
      
      // Verify token with Supabase
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error || !user) {
        LoggingService.warn('Invalid auth token', { error });
        return res.status(401).json({
          status: 'error',
          code: 'auth/invalid-token',
          message: 'Invalid or expired authentication token'
        });
      }
      
      // Set user in request
      req.user = user;
      next();
    } catch (error) {
      LoggingService.error('Auth middleware error', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  }
  
  /**
   * Check if route is public (doesn't require authentication)
   * @param {string} path - Request path
   * @returns {boolean} Is public route
   */
  isPublicRoute(path) {
    const publicRoutes = [
      '/api/v1/health',
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/refresh',
      '/api/v1/auth/forgot-password'
    ];
    
    // Check exact matches
    if (publicRoutes.includes(path)) {
      return true;
    }
    
    // Check OAuth callback routes
    if (path.startsWith('/api/v1/integrations/') && path.endsWith('/callback')) {
      return true;
    }
    
    return false;
  }
}

module.exports = new SecurityMiddleware();
