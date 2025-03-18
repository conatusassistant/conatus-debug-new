// src/services/errorHandler.js
/**
 * Frontend error handling service
 * 
 * Provides unified error handling across the application.
 */
class ErrorHandler {
  constructor() {
    this.store = null;
  }

  /**
   * Initialize error handler with Redux store
   * @param {Object} store - Redux store
   */
  init(store) {
    this.store = store;
    
    // Set up global error handler
    this.setupGlobalErrorHandler();
  }

  /**
   * Set up global error handler for uncaught exceptions
   */
  setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        type: 'uncaught_exception'
      });
      
      // Don't prevent default handling
      return false;
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: event.reason?.message || 'Unhandled Promise rejection',
        stack: event.reason?.stack,
        type: 'unhandled_rejection'
      });
      
      // Don't prevent default handling
      return false;
    });
  }

  /**
   * Handle API error responses
   * @param {Error} error - Error object from API call
   * @returns {Object} Standardized error object
   */
  handleApiError(error) {
    // Create a standardized error object
    let errorObj = {
      message: 'An unexpected error occurred',
      statusCode: 500,
      type: 'SERVER_ERROR'
    };
    
    // If it's an API error with response
    if (error.response) {
      const { status, data } = error.response;
      
      errorObj = {
        statusCode: status,
        message: data.error?.message || 'Request failed',
        type: data.error?.type || 'SERVER_ERROR',
        details: data.error?.details || null
      };
    } else if (error.request) {
      // The request was made but no response was received
      errorObj = {
        statusCode: 0,
        message: 'No response from server. Please check your connection.',
        type: 'NETWORK_ERROR'
      };
    } else if (error.message) {
      // Regular error with message
      errorObj = {
        message: error.message,
        type: 'CLIENT_ERROR'
      };
    }
    
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', errorObj);
      if (error.stack) {
        console.error(error.stack);
      }
    }
    
    // Capture error for monitoring
    this.captureError(errorObj);
    
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
   * Capture error for monitoring
   * @param {Object} error - Error details
   */
  captureError(error) {
    // In a real app, this would send the error to a service like Sentry
    // For now, we'll just log it
    console.error('Error captured:', error);
    
    // If we had a monitoring service, we would add code like:
    // 
    // if (typeof window.Sentry !== 'undefined') {
    //   window.Sentry.captureException(error);
    // }
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Handle API error and return standardized error
 * @param {Error} error - API error 
 * @returns {Object} Standardized error object
 */
export const handleApiError = (error) => {
  return errorHandler.handleApiError(error);
};

/**
 * Get user-friendly error message
 * @param {Object} error - Error object
 * @returns {string} User-friendly message
 */
export const getUserErrorMessage = (error) => {
  return errorHandler.getUserMessage(error);
};

export default errorHandler;

// src/services/monitoringService.js
/**
 * Monitoring Service
 * 
 * Handles performance monitoring, error tracking, and usage analytics.
 */
class MonitoringService {
  constructor() {
    this.traces = {};
    this.eventListeners = {};
  }

  /**
   * Initialize the monitoring service
   */
  init() {
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
  }

  /**
   * Set up performance monitoring
   */
  setupPerformanceMonitoring() {
    if (window.performance && window.performance.getEntriesByType) {
      // Monitor page load time
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.trackPageLoad();
        }, 0);
      });
    }
  }

  /**
   * Track page load performance
   */
  trackPageLoad() {
    try {
      const perfEntries = window.performance.getEntriesByType('navigation');
      
      if (perfEntries && perfEntries.length > 0) {
        const navigationEntry = perfEntries[0];
        
        const metrics = {
          loadTime: navigationEntry.loadEventEnd - navigationEntry.startTime,
          domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime,
          firstPaint: 0,
          firstContentfulPaint: 0
        };
        
        // Get first paint and first contentful paint
        const paintEntries = window.performance.getEntriesByType('paint');
        if (paintEntries) {
          paintEntries.forEach(entry => {
            if (entry.name === 'first-paint') {
              metrics.firstPaint = entry.startTime;
            }
            if (entry.name === 'first-contentful-paint') {
              metrics.firstContentfulPaint = entry.startTime;
            }
          });
        }
        
        // In a real app, send these metrics to your analytics service
        console.debug('Page Load Metrics:', metrics);
      }
    } catch (error) {
      console.error('Error tracking page load:', error);
    }
  }

  /**
   * Create a trace for performance monitoring
   * @param {string} name - Trace name
   * @returns {Object} Trace object with methods
   */
  createTrace(name) {
    const traceId = `${name}_${Date.now()}`;
    const startTime = performance.now();
    let endTime = null;
    const spans = [];
    let currentSpan = null;
    
    this.traces[traceId] = {
      name,
      startTime,
      spans
    };
    
    return {
      startSpan: (spanName) => {
        if (currentSpan) {
          // End the previous span
          currentSpan.endTime = performance.now();
          currentSpan.duration = currentSpan.endTime - currentSpan.startTime;
        }
        
        currentSpan = {
          name: spanName,
          startTime: performance.now(),
          endTime: null,
          duration: null
        };
        
        spans.push(currentSpan);
        
        return this;
      },
      
      endSpan: () => {
        if (currentSpan) {
          currentSpan.endTime = performance.now();
          currentSpan.duration = currentSpan.endTime - currentSpan.startTime;
          currentSpan = null;
        }
        
        return this;
      },
      
      end: () => {
        // End any current span
        if (currentSpan) {
          currentSpan.endTime = performance.now();
          currentSpan.duration = currentSpan.endTime - currentSpan.startTime;
        }
        
        endTime = performance.now();
        this.traces[traceId].endTime = endTime;
        this.traces[traceId].duration = endTime - startTime;
        
        // In a real app, send this trace to your monitoring service
        console.debug('Trace completed:', this.traces[traceId]);
        
        // Emit trace event
        this.emit('trace:completed', {
          id: traceId,
          name,
          duration: endTime - startTime,
          spans: spans.map(span => ({
            name: span.name,
            duration: span.duration
          }))
        });
        
        return endTime - startTime;
      },
      
      getDuration: () => {
        if (endTime) {
          return endTime - startTime;
        }
        return performance.now() - startTime;
      }
    };
  }

  /**
   * Track UI interaction
   * @param {string} action - Interaction name
   * @param {Object} details - Additional details
   */
  trackInteraction(action, details = {}) {
    try {
      // In a real app, send this to your analytics service
      console.debug('UI Interaction:', { action, details });
      
      // Emit event
      this.emit('interaction', { action, details });
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  /**
   * Track automation execution
   * @param {string} automationType - Type of automation
   * @param {boolean} success - Whether execution was successful
   * @param {number} durationMs - Execution duration in milliseconds
   */
  trackAutomationExecution(automationType, success, durationMs = null) {
    try {
      // In a real app, send this to your analytics service
      console.debug('Automation Execution:', {
        type: automationType,
        success,
        durationMs
      });
      
      // Emit event
      this.emit('automation:execution', {
        type: automationType,
        success,
        durationMs
      });
    } catch (error) {
      console.error('Error tracking automation execution:', error);
    }
  }

  /**
   * Log error
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  error(message, error, context = {}) {
    try {
      // In a real app, send this to your error monitoring service
      console.error(message, error, context);
      
      // Emit event
      this.emit('error', { message, error, context });
    } catch (e) {
      console.error('Error in error logging:', e);
    }
  }

  /**
   * Log warning
   * @param {string} message - Warning message
   * @param {Object} context - Additional context
   */
  warning(message, context = {}) {
    try {
      // In a real app, send this to your monitoring service
      console.warn(message, context);
      
      // Emit event
      this.emit('warning', { message, context });
    } catch (e) {
      console.error('Error in warning logging:', e);
    }
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    this.eventListeners[event].push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this.eventListeners[event]) {
      return;
    }
    
    this.eventListeners[event] = this.eventListeners[event].filter(
      listener => listener !== callback
    );
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    if (!this.eventListeners[event]) {
      return;
    }
    
    this.eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('Error in event listener:', e);
      }
    });
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

export default monitoringService;

// src/services/offlineService.js
/**
 * Offline Service
 * 
 * Provides offline support and synchronization when connection is restored.
 */
class OfflineService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingActions = [];
    this.eventListeners = {};
  }

  /**
   * Initialize offline service
   */
  init() {
    // Set up online/offline event listeners
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Load pending actions from local storage
    this.loadPendingActions();
  }

  /**
   * Handle when the device comes online
   */
  handleOnline() {
    this.isOnline = true;
    
    // Emit online event
    this.emit('online');
    
    // Process pending actions
    this.processPendingActions();
  }

  /**
   * Handle when the device goes offline
   */
  handleOffline() {
    this.isOnline = false;
    
    // Emit offline event
    this.emit('offline');
  }

  /**
   * Queue an action to be executed when online
   * @param {string} type - Action type
   * @param {Object} data - Action data
   * @param {number} priority - Priority (higher = more important)
   */
  queueAction(type, data, priority = 1) {
    const action = {
      id: Date.now().toString(),
      type,
      data,
      priority,
      createdAt: new Date().toISOString()
    };
    
    this.pendingActions.push(action);
    this.savePendingActions();
    
    // If online, process immediately
    if (this.isOnline) {
      this.processPendingActions();
    }
    
    return action.id;
  }

  /**
   * Process pending actions
   */
  async processPendingActions() {
    if (!this.isOnline || this.pendingActions.length === 0) {
      return;
    }
    
    // Sort by priority (higher first)
    this.pendingActions.sort((a, b) => b.priority - a.priority);
    
    // Process each action
    const actionsToProcess = [...this.pendingActions];
    const successfulActions = [];
    
    for (const action of actionsToProcess) {
      try {
        // Emit event for this action
        await this.emit(`process:${action.type}`, action);
        
        // Mark as successful
        successfulActions.push(action.id);
      } catch (error) {
        console.error(`Error processing offline action ${action.type}:`, error);
      }
    }
    
    // Remove successful actions
    this.pendingActions = this.pendingActions.filter(
      action => !successfulActions.includes(action.id)
    );
    
    // Save updated pending actions
    this.savePendingActions();
  }

  /**
   * Save pending actions to local storage
   */
  savePendingActions() {
    try {
      localStorage.setItem('offlinePendingActions', JSON.stringify(this.pendingActions));
    } catch (error) {
      console.error('Error saving pending actions:', error);
    }
  }

  /**
   * Load pending actions from local storage
   */
  loadPendingActions() {
    try {
      const savedActions = localStorage.getItem('offlinePendingActions');
      if (savedActions) {
        this.pendingActions = JSON.parse(savedActions);
      }
    } catch (error) {
      console.error('Error loading pending actions:', error);
      this.pendingActions = [];
    }
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    this.eventListeners[event].push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this.eventListeners[event]) {
      return;
    }
    
    this.eventListeners[event] = this.eventListeners[event].filter(
      listener => listener !== callback
    );
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @returns {Promise<void>}
   */
  async emit(event, data) {
    if (!this.eventListeners[event]) {
      return;
    }
    
    // Execute listeners sequentially
    for (const callback of this.eventListeners[event]) {
      try {
        await callback(data);
      } catch (e) {
        console.error('Error in event listener:', e);
        throw e;
      }
    }
  }
}

// Create singleton instance
const offlineService = new OfflineService();

export default offlineService;
