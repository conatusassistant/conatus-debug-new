// services/error-monitoring.js
import * as Sentry from '@sentry/browser';
import { BrowserTracing } from '@sentry/tracing';
import config from '../config';

class ErrorMonitoringService {
  constructor() {
    this.initialized = false;
    this.environment = config.environment || 'development';
    this.enabled = this.environment !== 'development';
    this.sentryDsn = config.sentryDsn;
    this.errorMapping = {
      // Map common errors to user-friendly messages
      'auth/invalid-email': 'The email address is not valid.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'network/request-failed': 'Network connection error. Please check your internet connection.',
      'api/rate-limit': 'You\'ve reached the rate limit. Please try again later.',
      'api/quota-exceeded': 'Service quota exceeded. Please try again later.',
      'llm/provider-unavailable': 'The AI service is temporarily unavailable. We\'ve switched to an alternative provider.',
      'service/connection-failed': 'Failed to connect to a service. Please check your connection settings.',
      'automation/execution-error': 'There was an error executing your automation. Please try again.',
      'default': 'Something went wrong. Please try again later.'
    };
  }

  /**
   * Initialize error monitoring
   */
  initialize() {
    if (this.initialized || !this.enabled || !this.sentryDsn) {
      return;
    }

    Sentry.init({
      dsn: this.sentryDsn,
      integrations: [new BrowserTracing()],
      tracesSampleRate: 0.2,
      environment: this.environment,
      beforeSend: (event) => {
        // Don't send errors in development
        if (this.environment === 'development') {
          return null;
        }
        
        // Remove sensitive data
        if (event.request && event.request.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
        }
        
        return event;
      }
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(event.reason || 'Unhandled Promise Rejection');
    });

    this.initialized = true;
    console.log('Error monitoring initialized');
  }

  /**
   * Capture an exception
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  captureException(error, context = {}) {
    // Always log to console
    console.error('Error captured:', error, context);
    
    if (!this.initialized || !this.enabled) {
      return;
    }

    Sentry.withScope((scope) => {
      // Add additional context
      Object.keys(context).forEach(key => {
        scope.setExtra(key, context[key]);
      });
      
      // Capture the exception
      Sentry.captureException(error);
    });
  }

  /**
   * Log a message at a specific level
   * @param {string} level - Log level (debug, info, warning, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    // Map level to console method
    const method = {
      debug: 'debug',
      info: 'info',
      warning: 'warn',
      error: 'error'
    }[level] || 'log';

    // Log to console
    console[method](`[${level.toUpperCase()}] ${message}`, data);
    
    // If error level, also send to Sentry
    if (level === 'error' && this.initialized && this.enabled) {
      Sentry.captureMessage(message, {
        level,
        extra: data
      });
    }
  }

  /**
   * Get a user-friendly error message
   * @param {Error|Object|string} error - Error object, code, or message
   * @returns {string} User-friendly error message
   */
  getUserFriendlyMessage(error) {
    // Extract error code
    let errorCode = 'default';
    
    if (typeof error === 'string') {
      errorCode = error;
    } else if (error && error.code) {
      errorCode = error.code;
    } else if (error && error.message) {
      // Try to find error code in message
      const match = error.message.match(/\[(.*?)\]/);
      if (match && match[1]) {
        errorCode = match[1];
      }
    }
    
    // Return mapped message or default
    return this.errorMapping[errorCode] || this.errorMapping.default;
  }

  /**
   * Set current user for error tracking
   * @param {Object} user - User object
   */
  setUser(user) {
    if (!this.initialized || !this.enabled) {
      return;
    }

    if (user && user.id) {
      Sentry.setUser({
        id: user.id,
        email: user.email
      });
    } else {
      Sentry.setUser(null);
    }
  }
}

export default new ErrorMonitoringService();
