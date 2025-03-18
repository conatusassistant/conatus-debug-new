// src/services/error-handling.js
import { toast } from 'react-toastify';
import * as Sentry from '@sentry/react';

class ErrorHandlingService {
  constructor() {
    this.errorHandlers = {};
    this.setupGlobalHandlers();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
  }
  
  setupGlobalHandlers() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error);
    });
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason);
    });
    
    // Register default handlers
    this.registerErrorHandler('network', this.handleNetworkError.bind(this));
    this.registerErrorHandler('auth', this.handleAuthError.bind(this));
    this.registerErrorHandler('validation', this.handleValidationError.bind(this));
    this.registerErrorHandler('service', this.handleServiceError.bind(this));
    this.registerErrorHandler('rate_limit', this.handleRateLimitError.bind(this));
  }
  
  registerErrorHandler(errorType, handler) {
    this.errorHandlers[errorType] = handler;
  }
  
  async handleError(error) {
    // Track errors in monitoring system
    this.trackError(error);
    
    // Get error type and find appropriate handler
    const errorType = this.getErrorType(error);
    const handler = this.errorHandlers[errorType];
    
    if (handler) {
      return handler(error);
    }
    
    // Default error handling
    console.error('Unhandled error:', error);
    toast.error('Something went wrong. Please try again.');
    
    // Return recovery action if possible
    return { type: 'notification', message: error.message || 'An error occurred' };
  }
  
  getErrorType(error) {
    // Network errors
    if (
      error.message?.includes('network') ||
      error.message?.includes('connection') ||
      error.name === 'NetworkError' ||
      error instanceof TypeError && error.message?.includes('fetch')
    ) {
      return 'network';
    }
    
    // Authentication errors
    if (
      error.status === 401 ||
      error.message?.includes('unauthorized') ||
      error.message?.includes('authentication') ||
      error.message?.includes('token')
    ) {
      return 'auth';
    }
    
    // Validation errors
    if (
      error.status === 400 ||
      error.message?.includes('validation') ||
      error.errors || // Common validation error format
      (error.data && error.data.errors)
    ) {
      return 'validation';
    }
    
    // Service availability errors
    if (
      error.status === 503 ||
      error.status === 504 ||
      error.message?.includes('unavailable') ||
      error.message?.includes('timeout')
    ) {
      return 'service';
    }
    
    // Rate limiting
    if (
      error.status === 429 ||
      error.message?.includes('rate limit') ||
      error.message?.includes('too many requests')
    ) {
      return 'rate_limit';
    }
    
    // Default
    return 'unknown';
  }
  
  trackError(error) {
    // In development, just console log
    if (process.env.NODE_ENV === 'development') {
      console.error('Error tracked:', error);
      return;
    }
    
    // In production, send to Sentry or similar service
    try {
      Sentry.captureException(error);
    } catch (sentryError) {
      console.error('Failed to track error:', sentryError);
    }
  }
  
  // Handler for network errors
  handleNetworkError(error) {
    // Check if we should retry
    const key = error.url || 'generic-network-error';
    const attempts = this.retryAttempts.get(key) || 0;
    
    if (attempts < this.maxRetries) {
      this.retryAttempts.set(key, attempts + 1);
      
      // Exponential backoff
      const delay = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s, etc.
      
      toast.info('Connection issue. Retrying...', {
        autoClose: delay
      });
      
      return { type: 'retry', delay };
    }
    
    // Max retries reached
    this.retryAttempts.delete(key); // Reset counter
    
    toast.error('Network error. Please check your connection and try again.');
    return { type: 'notification', message: 'Network error. Please check your connection.' };
  }
  
  // Handler for authentication errors
  handleAuthError(error) {
    // Clear any sensitive data
    localStorage.removeItem('access_token');
    
    toast.error('Your session has expired. Please sign in again.');
    
    // Redirect to login, preserving the current URL for after login
    const currentPath = encodeURIComponent(window.location.pathname);
    return { type: 'redirect', path: `/login?redirect=${currentPath}` };
  }
  
  // Handler for validation errors
  handleValidationError(error) {
    // Extract validation messages
    let messages = [];
    
    if (error.errors) {
      messages = Object.values(error.errors).flat();
    } else if (error.data && error.data.errors) {
      messages = Object.values(error.data.errors).flat();
    } else if (error.message) {
      messages = [error.message];
    }
    
    if (messages.length > 0) {
      toast.error(messages[0]); // Show first error
    } else {
      toast.error('Please check your input and try again.');
    }
    
    return { 
      type: 'validation', 
      errors: error.errors || (error.data && error.data.errors) || {},
      message: messages[0] || 'Validation error'
    };
  }
  
  // Handler for service errors
  handleServiceError(error) {
    toast.error('Service temporarily unavailable. Please try again later.');
    
    return { 
      type: 'notification', 
      message: 'Service temporarily unavailable. Please try again later.'
    };
  }
  
  // Handler for rate limit errors
  handleRateLimitError(error) {
    // Extract retry-after header if available
    let retryAfter = 60; // Default to 60 seconds
    
    if (error.headers && error.headers.get) {
      const retryHeader = error.headers.get('Retry-After');
      if (retryHeader) {
        retryAfter = parseInt(retryHeader, 10);
      }
    }
    
    toast.warning(`Rate limit reached. Please try again in ${retryAfter} seconds.`);
    
    return { 
      type: 'rate_limit', 
      retryAfter,
      message: `Rate limit reached. Please try again in ${retryAfter} seconds.`
    };
  }
}

export default new ErrorHandlingService();
