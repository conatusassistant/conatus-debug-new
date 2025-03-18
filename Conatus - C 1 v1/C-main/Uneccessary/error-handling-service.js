// backend/services/ErrorHandlingService.js
/**
 * Error Handling Service
 * 
 * Provides standardized error handling across the application.
 * Creates consistent error objects with appropriate status codes.
 */

class ErrorHandlingService {
  // Standard error types
  static errorTypes = {
    AUTHENTICATION: 'AUTHENTICATION_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE_ERROR',
    INTEGRATION: 'INTEGRATION_ERROR',
    RATE_LIMIT: 'RATE_LIMIT_ERROR',
    SERVER: 'SERVER_ERROR',
    CLIENT: 'CLIENT_ERROR'
  };
  
  // HTTP status code mapping
  static statusCodes = {
    [this.errorTypes.AUTHENTICATION]: 401,
    [this.errorTypes.AUTHORIZATION]: 403,
    [this.errorTypes.VALIDATION]: 400,
    [this.errorTypes.NOT_FOUND]: 404,
    [this.errorTypes.SERVICE_UNAVAILABLE]: 503,
    [this.errorTypes.INTEGRATION]: 502,
    [this.errorTypes.RATE_LIMIT]: 429,
    [this.errorTypes.SERVER]: 500,
    [this.errorTypes.CLIENT]: 400
  };
  
  /**
   * Create a standardized error object
   * @param {string} type - Error type from errorTypes
   * @param {string} message - Human-readable error message
   * @param {any} details - Additional error details (optional)
   * @param {Error} originalError - Original error object (optional)
   * @returns {Object} Standardized error object
   */
  static createError(type, message, details = null, originalError = null) {
    // Default to SERVER_ERROR if type is invalid
    const errorType = this.errorTypes[type] || this.errorTypes.SERVER;
    
    // Get appropriate status code
    const statusCode = this.statusCodes[errorType] || 500;
    
    // Create error object
    const error = {
      type: errorType,
      message,
      statusCode,
      timestamp: new Date().toISOString()
    };
    
    // Add details if provided
    if (details) {
      error.details = details;
    }
    
    // Add original error stack in development
    if (originalError && process.env.NODE_ENV === 'development') {
      error.stack = originalError.stack;
    }
    
    // Add request ID if available in the request context
    if (global.requestId) {
      error.requestId = global.requestId;
    }
    
    return error;
  }
  
  /**
   * Authentication error (401)
   * @param {string} message - Error message
   * @param {any} details - Additional details
   * @returns {Object} Error object
   */
  static authenticationError(message = 'Authentication required', details = null) {
    return this.createError('AUTHENTICATION', message, details);
  }
  
  /**
   * Authorization error (403)
   * @param {string} message - Error message
   * @param {any} details - Additional details
   * @returns {Object} Error object
   */
  static authorizationError(message = 'Permission denied', details = null) {
    return this.createError('AUTHORIZATION', message, details);
  }
  
  /**
   * Validation error (400)
   * @param {string} message - Error message
   * @param {any} details - Validation error details
   * @returns {Object} Error object
   */
  static validationError(message = 'Validation failed', details = null) {
    return this.createError('VALIDATION', message, details);
  }
  
  /**
   * Not found error (404)
   * @param {string} message - Error message
   * @param {any} details - Additional details
   * @returns {Object} Error object
   */
  static notFoundError(message = 'Resource not found', details = null) {
    return this.createError('NOT_FOUND', message, details);
  }
  
  /**
   * Service unavailable error (503)
   * @param {string} message - Error message
   * @param {any} details - Additional details
   * @returns {Object} Error object
   */
  static serviceUnavailableError(message = 'Service temporarily unavailable', details = null) {
    return this.createError('SERVICE_UNAVAILABLE', message, details);
  }
  
  /**
   * Integration error for third-party services (502)
   * @param {string} message - Error message
   * @param {any} details - Additional details
   * @param {Error} originalError - Original error from the service
   * @returns {Object} Error object
   */
  static integrationError(message = 'Integration error', details = null, originalError = null) {
    return this.createError('INTEGRATION', message, details, originalError);
  }
  
  /**
   * Rate limit error (429)
   * @param {string} message - Error message
   * @param {any} details - Additional details like retry-after
   * @returns {Object} Error object
   */
  static rateLimitError(message = 'Rate limit exceeded', details = null) {
    return this.createError('RATE_LIMIT', message, details);
  }
  
  /**
   * Server error (500)
   * @param {string} message - Error message
   * @param {any} details - Additional details
   * @param {Error} originalError - Original error object
   * @returns {Object} Error object
   */
  static serverError(message = 'Internal server error', details = null, originalError = null) {
    return this.createError('SERVER', message, details, originalError);
  }
  
  /**
   * Client error (400)
   * @param {string} message - Error message
   * @param {any} details - Additional details
   * @returns {Object} Error object
   */
  static clientError(message = 'Bad request', details = null) {
    return this.createError('CLIENT', message, details);
  }
  
  /**
   * Handle and standardize error response
   * @param {Error} error - Original error
   * @param {string} defaultMessage - Default message if none is provided
   * @returns {Object} Standardized error object
   */
  static handleError(error, defaultMessage = 'An unexpected error occurred') {
    // If error is already standardized, return it
    if (error.type && error.statusCode) {
      return error;
    }
    
    // If it's a known API error with status code
    if (error.response && error.response.status) {
      const statusCode = error.response.status;
      const message = error.response.data?.message || error.message || defaultMessage;
      
      // Map status code to error type
      switch (statusCode) {
        case 400:
          return this.clientError(message, error.response.data);
        case 401:
          return this.authenticationError(message);
        case 403:
          return this.authorizationError(message);
        case 404:
          return this.notFoundError(message);
        case 429:
          return this.rateLimitError(message, {
            retryAfter: error.response.headers['retry-after']
          });
        case 502:
          return this.integrationError(message, error.response.data, error);
        case 503:
          return this.serviceUnavailableError(message);
        default:
          return this.serverError(message, error.response.data, error);
      }
    }
    
    // For network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return this.serviceUnavailableError(
        'Service connection failed',
        { code: error.code },
        error
      );
    }
    
    // For validation errors (e.g., from Joi)
    if (error.name === 'ValidationError' || error.isJoi) {
      return this.validationError(
        error.message || 'Validation failed',
        error.details,
        error
      );
    }
    
    // Default to server error
    return this.serverError(
      error.message || defaultMessage,
      null,
      error
    );
  }
  
  /**
   * Express middleware for error handling
   * @returns {Function} Express middleware
   */
  static errorHandler() {
    return (err, req, res, next) => {
      // Set request ID in global context for error logging
      global.requestId = req.id || req.headers['x-request-id'];
      
      // Standardize the error
      const standardError = this.handleError(err);
      
      // Log error (with different levels based on type)
      if (standardError.statusCode >= 500) {
        console.error('Server error:', standardError);
        if (standardError.stack) {
          console.error(standardError.stack);
        }
      } else if (standardError.statusCode >= 400) {
        console.warn('Client error:', standardError);
      }
      
      // Remove stack from response in production
      if (process.env.NODE_ENV === 'production') {
        delete standardError.stack;
      }
      
      // Send error response
      res.status(standardError.statusCode).json({
        error: standardError
      });
    };
  }
}

module.exports = ErrorHandlingService;

// backend/middleware/errorMiddleware.js
const ErrorHandlingService = require('../services/ErrorHandlingService');
const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to add request ID to all requests
 */
exports.requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

/**
 * Middleware to handle 404 errors
 */
exports.notFoundMiddleware = (req, res, next) => {
  const error = ErrorHandlingService.notFoundError(
    `Route not found: ${req.method} ${req.originalUrl}`
  );
  res.status(404).json({ error });
};

/**
 * Error handling middleware
 */
exports.errorHandlerMiddleware = ErrorHandlingService.errorHandler();

// frontend/src/services/errorHandler.js
/**
 * Frontend error handling service
 * Provides consistent error handling and display for API errors
 */

import { logout } from '../store/auth';

class ErrorHandler {
  constructor(store) {
    this.store = store;
  }
  
  /**
   * Initialize error handler with Redux store
   * @param {Object} store - Redux store
   */
  init(store) {
    this.store = store;
  }
  
  /**
   * Handle API error responses
   * @param {Error} error - Error object from API call
   * @param {Function} dispatch - Redux dispatch function
   * @returns {Object} Standardized error object
   */
  handleApiError(error, dispatch) {
    // Extract error details
    let errorObj = {
      message: 'An unexpected error occurred',
      statusCode: 500,
      type: 'SERVER_ERROR'
    };
    
    // If it's an Axios error with response
    if (error.response) {
      const { status, data } = error.response;
      
      errorObj = {
        statusCode: status,
        message: data.error?.message || 'Request failed',
        type: data.error?.type || 'SERVER_ERROR',
        details: data.error?.details || null
      };
      
      // Handle authentication errors
      if (status === 401) {
        // Log out user on authentication errors
        dispatch(logout());
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorObj = {
        statusCode: 0,
        message: 'No response from server. Please check your connection.',
        type: 'NETWORK_ERROR'
      };
    }
    
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', errorObj);
      if (error.stack) {
        console.error(error.stack);
      }
    }
    
    return errorObj;
  }
  
  /**
   * Get user-friendly error message
   * @param {Object} error - Error object
   * @returns {string} User-friendly error message
   */
  getUserMessage(error) {
    const defaultMessage = 'Something went wrong. Please try again.';
    
    // If not an object, return as is or default
    if (!error || typeof error !== 'object') {
      return error?.toString() || defaultMessage;
    }
    
    // Use provided message or create one based on status code
    if (error.message) {
      return error.message;
    }
    
    // If we have a status code, provide a more specific message
    if (error.statusCode) {
      switch (error.statusCode) {
        case 400:
          return 'The request contains invalid parameters.';
        case 401:
          return 'You need to log in to access this feature.';
        case 403:
          return 'You don\'t have permission to access this resource.';
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'Server error. Our team has been notified.';
        case 502:
        case 503:
          return 'Service temporarily unavailable. Please try again later.';
        default:
          return defaultMessage;
      }
    }
    
    return defaultMessage;
  }
  
  /**
   * Show error notification to user
   * @param {Object} error - Error object
   * @param {Function} dispatch - Redux dispatch function
   */
  showErrorNotification(error, dispatch) {
    const message = this.getUserMessage(error);
    
    // Add notification action creator import
    // import { addNotification } from '../store/notifications';
    
    // Uncomment when notification system is implemented
    // dispatch(addNotification({
    //   type: 'error',
    //   message,
    //   duration: 5000
    // }));
    
    // For now, just log to console
    console.error('ERROR:', message);
  }
}

export default new ErrorHandler();
