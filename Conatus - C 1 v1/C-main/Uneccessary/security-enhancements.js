// backend/services/security/TokenService.js
/**
 * Token Service
 * 
 * Handles secure token operations including encryption, decryption,
 * and secure storage of service credentials.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

class TokenService {
  constructor() {
    // Encryption key should be set in environment variables
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    
    // Validate encryption key
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      console.error('WARNING: Insecure or missing TOKEN_ENCRYPTION_KEY. Service tokens will not be properly secured.');
      // Generate a temporary key - not secure for production!
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
    }
  }

  /**
   * Encrypt a token
   * @param {string} token - Token to encrypt
   * @returns {string} Encrypted token
   */
  encryptToken(token) {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(this.encryptionKey, 'hex'),
        iv
      );
      
      // Encrypt the token
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the auth tag
      const authTag = cipher.getAuthTag();
      
      // Return the encrypted token with IV and auth tag
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Token encryption error:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt a token
   * @param {string} encryptedToken - Encrypted token
   * @returns {string} Decrypted token
   */
  decryptToken(encryptedToken) {
    try {
      // Split the encrypted data
      const [ivHex, authTagHex, encryptedHex] = encryptedToken.split(':');
      
      // Convert from hex
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(this.encryptionKey, 'hex'),
        iv
      );
      
      // Set auth tag
      decipher.setAuthTag(authTag);
      
      // Decrypt the token
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Token decryption error:', error);
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Store a token securely
   * @param {string} userId - User ID
   * @param {string} serviceName - Service name
   * @param {string} token - Token to store
   * @returns {Promise<void>}
   */
  async storeToken(userId, serviceName, token) {
    try {
      // Encrypt the token
      const encryptedToken = this.encryptToken(token);
      
      // Store in database
      await supabase
        .from('service_tokens')
        .insert({
          user_id: userId,
          service_name: serviceName,
          encrypted_token: encryptedToken,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_used_at: null
        })
        .onConflict(['user_id', 'service_name'])
        .update({ 
          encrypted_token: encryptedToken,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Token storage error:', error);
      throw new Error('Failed to store token');
    }
  }

  /**
   * Retrieve a token
   * @param {string} userId - User ID
   * @param {string} serviceName - Service name
   * @returns {Promise<string>} Decrypted token
   */
  async retrieveToken(userId, serviceName) {
    try {
      // Retrieve encrypted token from database
      const { data, error } = await supabase
        .from('service_tokens')
        .select('encrypted_token')
        .eq('user_id', userId)
        .eq('service_name', serviceName)
        .single();
      
      if (error || !data) {
        throw new Error(`Token not found for service: ${serviceName}`);
      }
      
      // Update last used timestamp
      await supabase
        .from('service_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('service_name', serviceName);
      
      // Decrypt the token
      return this.decryptToken(data.encrypted_token);
    } catch (error) {
      console.error('Token retrieval error:', error);
      throw new Error(`Failed to retrieve token for service: ${serviceName}`);
    }
  }

  /**
   * Delete a token
   * @param {string} userId - User ID
   * @param {string} serviceName - Service name
   * @returns {Promise<boolean>} Success status
   */
  async deleteToken(userId, serviceName) {
    try {
      await supabase
        .from('service_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('service_name', serviceName);
      
      return true;
    } catch (error) {
      console.error('Token deletion error:', error);
      return false;
    }
  }

  /**
   * Check if a token exists
   * @param {string} userId - User ID
   * @param {string} serviceName - Service name
   * @returns {Promise<boolean>} Whether token exists
   */
  async hasToken(userId, serviceName) {
    try {
      const { data, error } = await supabase
        .from('service_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('service_name', serviceName)
        .single();
      
      return !error && !!data;
    } catch (error) {
      console.error('Token check error:', error);
      return false;
    }
  }

  /**
   * Rotate encryption key
   * @param {string} newKey - New encryption key
   * @returns {Promise<boolean>} Success status
   */
  async rotateEncryptionKey(newKey) {
    try {
      // Validate new key
      if (!newKey || newKey.length < 32) {
        throw new Error('Invalid encryption key. Must be at least 32 bytes.');
      }
      
      // Get all tokens
      const { data, error } = await supabase
        .from('service_tokens')
        .select('id, user_id, service_name, encrypted_token');
      
      if (error) {
        throw error;
      }
      
      // Re-encrypt each token with the new key
      const oldKey = this.encryptionKey;
      
      for (const item of data) {
        // Decrypt with old key
        this.encryptionKey = oldKey;
        const token = this.decryptToken(item.encrypted_token);
        
        // Encrypt with new key
        this.encryptionKey = newKey;
        const newEncryptedToken = this.encryptToken(token);
        
        // Update in database
        await supabase
          .from('service_tokens')
          .update({ encrypted_token: newEncryptedToken })
          .eq('id', item.id);
      }
      
      // Set new key as current
      this.encryptionKey = newKey;
      
      return true;
    } catch (error) {
      console.error('Key rotation error:', error);
      throw new Error('Failed to rotate encryption key');
    }
  }
}

module.exports = new TokenService();

// backend/middleware/securityMiddleware.js
/**
 * Security Middleware
 * 
 * Provides security-related middleware for Express application.
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * Configure security middleware
 * @param {Express} app - Express application
 */
exports.configureSecurityMiddleware = (app) => {
  // Set security headers with Helmet
  app.use(helmet());
  
  // Enable CORS with appropriate configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));
  
  // Parse cookies
  app.use(cookieParser(process.env.COOKIE_SECRET));
  
  // Prevent XSS attacks
  app.use(xss());
  
  // Prevent HTTP Parameter Pollution
  app.use(hpp());
  
  // Rate limiting for all requests
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again after 15 minutes'
  });
  
  // Apply general rate limiter to all routes
  app.use(generalLimiter);
  
  // More restrictive rate limit for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts, please try again after an hour'
  });
  
  // Apply auth rate limiter to auth routes
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  
  // CSRF protection for state-changing operations
  if (process.env.NODE_ENV === 'production') {
    app.use(csurf({ 
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'strict'
      }
    }));
    
    // Add CSRF token to requests
    app.use((req, res, next) => {
      res.locals.csrfToken = req.csrfToken();
      next();
    });
  }
};

/**
 * Supabase authentication middleware
 * Verifies JWT tokens from Supabase Auth
 */
exports.authMiddleware = async (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    // Add user to request
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized - Authentication failed' });
  }
};

/**
 * Permissions middleware
 * Checks if user has required permissions
 * @param {Array} requiredPermissions - Permissions required for this route
 */
exports.requirePermissions = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized - Authentication required' });
      }
      
      // Get user permissions
      const { data: userPermissions, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', req.user.id);
      
      if (error) {
        console.error('Permission fetch error:', error);
        return res.status(500).json({ error: 'Error fetching permissions' });
      }
      
      // Check if user has all required permissions
      const permissions = userPermissions.map(p => p.permission);
      
      const hasAllPermissions = requiredPermissions.every(
        permission => permissions.includes(permission)
      );
      
      if (!hasAllPermissions) {
        return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

/**
 * Authorization middleware for resource ownership
 * Checks if user owns the requested resource
 * @param {string} resourceType - Type of resource to check (e.g. 'conversations', 'automations')
 * @param {string} paramName - Name of parameter containing resource ID
 */
exports.requireOwnership = (resourceType, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized - Authentication required' });
      }
      
      // Get resource ID from params
      const resourceId = req.params[paramName];
      
      if (!resourceId) {
        return res.status(400).json({ error: `Missing resource ID parameter: ${paramName}` });
      }
      
      // Check resource ownership in database
      const { data, error } = await supabase
        .from(resourceType)
        .select('user_id')
        .eq('id', resourceId)
        .single();
      
      if (error || !data) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      // Check if user owns the resource
      if (data.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden - Not your resource' });
      }
      
      // Add resource to request
      req.resource = data;
      
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ error: 'Ownership check failed' });
    }
  };
};

// backend/middleware/validators.js
/**
 * Input Validation Middleware
 * 
 * Provides validation middleware for API inputs
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validate request
 * @returns {Function} Express middleware
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }
  
  next();
};

/**
 * Validation rules for user registration
 */
exports.registerRules = [
  body('email')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain a special character')
];

/**
 * Validation rules for login
 */
exports.loginRules = [
  body('email')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * Validation rules for creating automations
 */
exports.createAutomationRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
  
  body('workflow')
    .notEmpty().withMessage('Workflow is required')
    .isObject().withMessage('Workflow must be an object'),
  
  body('workflow.trigger')
    .notEmpty().withMessage('Trigger is required')
    .isObject().withMessage('Trigger must be an object'),
  
  body('workflow.action')
    .notEmpty().withMessage('Action is required')
    .isObject().withMessage('Action must be an object')
];

/**
 * Validation rules for querying LLM
 */
exports.queryRules = [
  body('query')
    .notEmpty().withMessage('Query is required')
    .isLength({ max: 5000 }).withMessage('Query must be at most 5000 characters'),
  
  body('conversation_id')
    .optional()
    .isUUID().withMessage('Invalid conversation ID')
];

// frontend/src/services/security.js
/**
 * Frontend Security Service
 * 
 * Provides security utilities for the frontend application.
 */

class SecurityService {
  constructor() {
    this.csrfToken = null;
  }

  /**
   * Initialize security service
   */
  init() {
    // Get CSRF token from meta tag if available
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    
    if (csrfMeta) {
      this.csrfToken = csrfMeta.getAttribute('content');
    }
    
    // Set up content security policy violation reporting
    this.setupCSPReporting();
  }

  /**
   * Set up CSP violation reporting
   */
  setupCSPReporting() {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.warn('CSP violation:', {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        originalPolicy: e.originalPolicy
      });
      
      // Report to backend
      this.reportSecurityIssue('csp-violation', {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        originalPolicy: e.originalPolicy,
        url: window.location.href
      });
    });
  }

  /**
   * Get CSRF token
   * @returns {string} CSRF token
   */
  getCSRFToken() {
    return this.csrfToken;
  }

  /**
   * Create headers with CSRF token
   * @param {Object} headers - Existing headers
   * @returns {Object} Headers with CSRF token
   */
  addCSRFHeader(headers = {}) {
    if (this.csrfToken) {
      return {
        ...headers,
        'X-CSRF-Token': this.csrfToken
      };
    }
    
    return headers;
  }

  /**
   * Sanitize HTML string
   * @param {string} html - HTML string to sanitize
   * @returns {string} Sanitized HTML
   */
  sanitizeHTML(html) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = html;
    return tempDiv.innerHTML;
  }

  /**
   * Sanitize user input
   * @param {string} input - User input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (!input) return '';
    
    // Remove potential script tags and other dangerous content
    return String(input)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/on\w+='[^']*'/g, '')
      .replace(/on\w+=\S+/g, '');
  }

  /**
   * Validate email address
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check password strength
   * @param {string} password - Password to check
   * @returns {Object} Strength assessment
   */
  checkPasswordStrength(password) {
    const result = {
      score: 0, // 0-4, higher is stronger
      feedback: [],
      isStrong: false
    };
    
    // Check length
    if (password.length < 8) {
      result.feedback.push('Password should be at least 8 characters long');
    } else {
      result.score += 1;
    }
    
    // Check for lowercase letters
    if (!/[a-z]/.test(password)) {
      result.feedback.push('Add lowercase letters');
    } else {
      result.score += 1;
    }
    
    // Check for uppercase letters
    if (!/[A-Z]/.test(password)) {
      result.feedback.push('Add uppercase letters');
    } else {
      result.score += 1;
    }
    
    // Check for numbers
    if (!/[0-9]/.test(password)) {
      result.feedback.push('Add numbers');
    } else {
      result.score += 1;
    }
    
    // Check for special characters
    if (!/[^a-zA-Z0-9]/.test(password)) {
      result.feedback.push('Add special characters');
    } else {
      result.score += 1;
    }
    
    // Minimum 3/5 score to be considered strong
    result.isStrong = result.score >= 3;
    
    return result;
  }

  /**
   * Report a security issue to the backend
   * @param {string} type - Issue type
   * @param {Object} details - Issue details
   * @returns {Promise<void>}
   */
  async reportSecurityIssue(type, details) {
    try {
      await fetch('/api/v1/security/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.addCSRFHeader()
        },
        body: JSON.stringify({
          type,
          details,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }),
        // Use keepalive to ensure the request completes even if the page is closed
        keepalive: true
      });
    } catch (error) {
      console.error('Failed to report security issue:', error);
    }
  }
}

export default new SecurityService();
