/**
 * Base API Client
 * 
 * This module provides a reusable API client with authentication, error handling,
 * retry logic, and standardized response handling.
 */

import { createClient } from '@supabase/supabase-js';

// Error types for specific handling
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

// API Error class with typed errors
export class ApiError extends Error {
  type: ErrorType;
  status: number;
  body?: any;
  retryable: boolean;
  
  constructor(message: string, type: ErrorType, status: number, body?: any, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.status = status;
    this.body = body;
    this.retryable = retryable;
  }
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableStatusCodes: number[];
  retryableErrorTypes: ErrorType[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 500, // ms
  maxDelay: 5000, // ms
  backoffFactor: 2, 
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorTypes: [ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.RATE_LIMIT]
};

// Request options
export interface RequestOptions {
  retryConfig?: Partial<RetryConfig>;
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

// Define hardcoded values
const supabaseUrl = "https://rtukhuijpcljqzqkqoxz.supabase.co"; 
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0dWtodWlqcGNsanF6cWtxb3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjMyMjAwOCwiZXhwIjoyMDU3ODk4MDA4fQ.cP1BcOP1lJ_3f0UDLIE5iu1puNXWwlf-gLEUGW5-Jx4";  // Replace with your actual key
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Sleep utility for delay between retries
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate backoff delay with jitter for retries
 * @param attempt Current attempt number
 * @param config Retry configuration
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff with full jitter
  const exponentialDelay = Math.min(
    config.maxDelay,
    config.initialDelay * Math.pow(config.backoffFactor, attempt)
  );
  
  // Add jitter to prevent thundering herd problem
  return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Check if error is retryable based on configuration
 * @param error The error to check
 * @param config Retry configuration
 * @returns Boolean indicating if the error is retryable
 */
function isRetryableError(error: ApiError, config: RetryConfig): boolean {
  if (error.retryable) return true;
  
  if (config.retryableErrorTypes.includes(error.type)) {
    return true;
  }
  
  if (error.status && config.retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  return false;
}

/**
 * Process response and convert to appropriate error type if needed
 * @param response Fetch response
 * @returns Processed response or throws typed error
 */
async function processResponse(response: Response): Promise<Response> {
  if (response.ok) return response;
  
  let errorBody: any;
  let errorMessage = response.statusText || 'Unknown error';
  let errorType = ErrorType.UNKNOWN;
  let retryable = false;
  
  try {
    errorBody = await response.json();
    errorMessage = errorBody.message || errorBody.error || errorMessage;
  } catch (e) {
    // Response doesn't have valid JSON
  }
  
  // Determine error type based on status code
  switch (response.status) {
    case 400:
      errorType = ErrorType.VALIDATION;
      break;
    case 401:
      errorType = ErrorType.AUTHENTICATION;
      break;
    case 403:
      errorType = ErrorType.AUTHORIZATION;
      break;
    case 408:
      errorType = ErrorType.TIMEOUT;
      retryable = true;
      break;
    case 429:
      errorType = ErrorType.RATE_LIMIT;
      retryable = true;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      errorType = ErrorType.SERVER;
      retryable = true;
      break;
    default:
      if (response.status >= 500) {
        errorType = ErrorType.SERVER;
        retryable = true;
      }
  }
  
  throw new ApiError(
    errorMessage,
    errorType,
    response.status,
    errorBody,
    retryable
  );
}

/**
 * Base API client with retry logic and error handling
 */
class ApiClient {
  private baseUrl: string;
  private defaultOptions: RequestOptions;
  
  constructor(baseUrl: string, defaultOptions: RequestOptions = {}) {
    this.baseUrl = baseUrl;
    this.defaultOptions = defaultOptions;
  }
  
  /**
   * Get JWT token from Supabase for authorization
   * @returns JWT token or null if not authenticated
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }
  
  /**
   * Make an API request with retry logic
   * @param endpoint API endpoint path
   * @param method HTTP method
   * @param data Request data
   * @param options Request options
   * @returns Response data
   */
  async request<T>(
    endpoint: string,
    method: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    // Merge default and request-specific options
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };
    
    // Build retry config
    const retryConfig: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...(mergedOptions.retryConfig || {})
    };
    
    // Build request URL
    const url = `${this.baseUrl}${endpoint}`;
    
    // Build request headers
    const token = await this.getAuthToken();
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(mergedOptions.headers || {})
    });
    
    // Build request init object
    const requestInit: RequestInit = {
      method,
      headers,
      signal: mergedOptions.signal,
    };
    
    // Add request body for non-GET requests
    if (method !== 'GET' && data) {
      requestInit.body = JSON.stringify(data);
    }
    
    // Initialize variables for retry logic
    let attempts = 0;
    let lastError: ApiError | null = null;
    
    // Retry loop
    while (attempts <= retryConfig.maxRetries) {
      try {
        // Add delay for retry attempts (not for the first attempt)
        if (attempts > 0) {
          const delay = calculateBackoffDelay(attempts, retryConfig);
          console.info(`Retrying request to ${endpoint} (attempt ${attempts}/${retryConfig.maxRetries}) after ${delay}ms`);
          await sleep(delay);
        }
        
        // Create timeout controller if needed
        let timeoutController: AbortController | null = null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        if (mergedOptions.timeout && !mergedOptions.signal) {
          timeoutController = new AbortController();
          requestInit.signal = timeoutController.signal;
          
          timeoutId = setTimeout(() => {
            timeoutController?.abort();
          }, mergedOptions.timeout);
        }
        
        try {
          // Make request
          const response = await fetch(url, requestInit);
          
          // Process response
          const processedResponse = await processResponse(response);
          
          // Parse JSON response
          const result = await processedResponse.json();
          
          // Clear timeout if set
          if (timeoutId) clearTimeout(timeoutId);
          
          return result as T;
        } catch (error) {
          // Clear timeout if set
          if (timeoutId) clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          lastError = new ApiError(
            'Network error. Please check your connection.',
            ErrorType.NETWORK,
            0,
            null,
            true
          );
        } 
        // Handle timeout errors
        else if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = new ApiError(
            'Request timed out. Please try again.',
            ErrorType.TIMEOUT,
            408,
            null,
            true
          );
        }
        // Use existing ApiError or create generic one
        else if (error instanceof ApiError) {
          lastError = error;
        } else {
          lastError = new ApiError(
            error instanceof Error ? error.message : String(error),
            ErrorType.UNKNOWN,
            0,
            null,
            false
          );
        }
        
        // Determine if we should retry
        if (isRetryableError(lastError, retryConfig) && attempts < retryConfig.maxRetries) {
          attempts++;
          continue;
        }
        
        // Log details about the error
        console.error(`API Error (${lastError.type}):`, {
          endpoint,
          method,
          statusCode: lastError.status,
          message: lastError.message,
          body: lastError.body,
          attempt: attempts
        });
        
        // Re-throw the error if no more retries
        throw lastError;
      }
    }
    
    // This should never happen due to the throw in the catch block,
    // but TypeScript needs it for type safety
    throw lastError || new ApiError('Unknown error', ErrorType.UNKNOWN, 0);
  }
  
  /**
   * GET request
   * @param endpoint API endpoint
   * @param options Request options
   * @returns Response data
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, 'GET', undefined, options);
  }
  
  /**
   * POST request
   * @param endpoint API endpoint
   * @param data Request data
   * @param options Request options
   * @returns Response data
   */
  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, 'POST', data, options);
  }
  
  /**
   * PUT request
   * @param endpoint API endpoint
   * @param data Request data
   * @param options Request options
   * @returns Response data
   */
  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, 'PUT', data, options);
  }
  
  /**
   * PATCH request
   * @param endpoint API endpoint
   * @param data Request data
   * @param options Request options
   * @returns Response data
   */
  async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, 'PATCH', data, options);
  }
  
  /**
   * DELETE request
   * @param endpoint API endpoint
   * @param options Request options
   * @returns Response data
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, 'DELETE', undefined, options);
  }
  
  /**
   * Stream response for real-time data (e.g., chat responses)
   * @param endpoint API endpoint
   * @param method HTTP method
   * @param data Request data
   * @param onChunk Callback for each chunk of data
   * @param options Request options
   */
  async stream(
    endpoint: string,
    method: string,
    data: any,
    onChunk: (chunk: any) => void,
    options: RequestOptions = {}
  ): Promise<void> {
    // Merge default and request-specific options
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };
    
    // Build request URL
    const url = `${this.baseUrl}${endpoint}`;
    
    // Build request headers
    const token = await this.getAuthToken();
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(mergedOptions.headers || {})
    });
    
    // Build request init object
    const requestInit: RequestInit = {
      method,
      headers,
      signal: mergedOptions.signal,
    };
    
    // Add request body for non-GET requests
    if (method !== 'GET' && data) {
      requestInit.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, requestInit);
      
      if (!response.ok) {
        await processResponse(response);
      }
      
      if (!response.body) {
        throw new ApiError('Stream response body is null', ErrorType.UNKNOWN, response.status);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // Handle Server-Sent Events format
        if (chunk.startsWith('data:')) {
          const dataLines = chunk
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.substring(5).trim());
          
          for (const dataLine of dataLines) {
            if (dataLine === '[DONE]') break;
            
            try {
              const parsedData = JSON.parse(dataLine);
              onChunk(parsedData);
            } catch (e) {
              // If it's not valid JSON, pass the raw chunk
              onChunk(dataLine);
            }
          }
        } else {
          // Handle plain text chunks
          onChunk(chunk);
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : String(error),
        ErrorType.UNKNOWN,
        0
      );
    }
  }
}

// Create API client instances for different services
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

export const apiClient = new ApiClient(apiBaseUrl, {
  timeout: 10000, // 10 second default timeout
  retryConfig: {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000
  }
});

/**
 * Error handler hook for use in components
 * @param error Error to handle
 * @returns Standardized error message for user display
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Unable to connect to server. Please check your internet connection and try again.';
        
      case ErrorType.AUTHENTICATION:
        return 'Your session has expired. Please sign in again.';
        
      case ErrorType.AUTHORIZATION:
        return 'You don\'t have permission to perform this action.';
        
      case ErrorType.VALIDATION:
        return error.message || 'The information provided is invalid. Please check your inputs and try again.';
        
      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please try again later.';
        
      case ErrorType.TIMEOUT:
        return 'The request took too long to complete. Please try again.';
        
      case ErrorType.SERVER:
        return 'We\'re experiencing server issues. Please try again later.';
        
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
}

export default apiClient;
