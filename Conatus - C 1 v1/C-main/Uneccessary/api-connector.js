// src/services/api/apiConnector.js
import { createClient } from '@supabase/supabase-js';
import { handleApiError } from '../errorHandler';

// Initialize Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

/**
 * API Connector Service
 * 
 * Provides a unified interface for all backend services and handles:
 * - Authentication
 * - Error management
 * - Request/response formatting
 * - Streaming responses
 * - Caching
 */
class ApiConnector {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL;
    this.supabase = supabase;
    
    // Bind authentication state to ensure API connector knows about auth changes
    this.setupAuthListener();
  }

  /**
   * Listen for authentication state changes
   */
  setupAuthListener() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        console.log('User signed in, session available');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing token');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });
  }

  /**
   * Get the current auth token
   * @returns {Promise<string|null>} The JWT token or null if not authenticated
   */
  async getAuthToken() {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    try {
      const token = await this.getAuthToken();
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      };
      
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, data: errorData };
      }
      
      // Return null for 204 No Content
      if (response.status === 204) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { 
      method: 'GET', 
      ...options 
    });
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    });
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options
    });
  }

  /**
   * Stream a response from the server (for LLM responses)
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {function} onChunk - Callback for each chunk
   * @param {function} onError - Callback for errors
   * @param {function} onComplete - Callback for completion
   * @returns {function} Cancel function
   */
  async streamResponse(endpoint, data, onChunk, onError, onComplete) {
    try {
      const token = await this.getAuthToken();
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const url = `${this.baseUrl}${endpoint}`;
      const controller = new AbortController();
      const { signal } = controller;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
        signal
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, data: errorData };
      }
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      const read = async () => {
        try {
          const { done, value } = await reader.read();
          
          if (done) {
            // Handle any remaining buffer
            if (buffer.trim()) {
              try {
                const parsedData = JSON.parse(buffer);
                onChunk(parsedData);
              } catch (e) {
                console.error('Error parsing final buffer:', e);
              }
            }
            onComplete();
            return;
          }
          
          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete events in buffer
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            // Parse the "data: " prefix
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6); // Remove 'data: ' prefix
              
              if (dataStr === '[DONE]') {
                continue; // End of stream marker
              }
              
              try {
                const parsedData = JSON.parse(dataStr);
                onChunk(parsedData);
              } catch (e) {
                console.error('Error parsing event data:', e);
              }
            }
          }
          
          // Continue reading
          read();
        } catch (error) {
          // Don't report errors if the request was intentionally aborted
          if (error.name !== 'AbortError') {
            const handled = handleApiError(error);
            onError(handled);
          }
        }
      };
      
      // Start reading the stream
      read();
      
      // Return a function to cancel the stream
      return () => {
        controller.abort();
      };
    } catch (error) {
      const handled = handleApiError(error);
      onError(handled);
      onComplete();
      return () => {}; // Return a no-op cancel function
    }
  }
}

// Create a singleton instance
const apiConnector = new ApiConnector();

export default apiConnector;
