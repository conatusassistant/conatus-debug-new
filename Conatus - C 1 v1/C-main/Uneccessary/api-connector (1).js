// src/services/api-connector.js
import { store } from '../store';
import { refreshToken, logout } from '../store/auth';
import ErrorHandlingService from './error-handling';
import CacheService from './cache-service';

class ApiConnector {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || '/api/v1';
    this.pendingRefresh = null;
    
    // Namespace services for organized access
    this.llm = new LLMService(this);
    this.automation = new AutomationService(this);
    this.integration = new IntegrationService(this);
    this.social = new SocialService(this);
  }

  // Token refresh with mutex pattern to prevent race conditions
  async getAccessToken() {
    const token = localStorage.getItem('access_token');
    const expiry = localStorage.getItem('token_expiry');
    
    if (!token || !expiry) {
      throw new Error('No authentication token');
    }
    
    if (Date.now() > parseInt(expiry) - 60000) {
      // Token expiring soon, refresh it
      if (!this.pendingRefresh) {
        this.pendingRefresh = store.dispatch(refreshToken())
          .then(result => result.payload?.token)
          .catch(error => {
            // If refresh fails, logout and redirect to login
            store.dispatch(logout());
            window.location.href = '/login';
            throw error;
          })
          .finally(() => {
            this.pendingRefresh = null;
          });
      }
      await this.pendingRefresh;
    }
    
    return localStorage.getItem('access_token');
  }

  // Enhanced request method with error handling, caching, and retry logic
  async request(endpoint, options = {}) {
    const { useCache = false, cacheTTL = null, skipAuth = false } = options;
    delete options.useCache;
    delete options.cacheTTL;
    delete options.skipAuth;
    
    // Check cache first if enabled
    if (useCache) {
      const cacheKey = `${endpoint}:${JSON.stringify(options.body || {})}`;
      const cachedResponse = CacheService.get('data', cacheKey);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    try {
      // Add auth token if required
      const headers = { ...options.headers };
      
      if (!skipAuth) {
        const token = await this.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        // Handle different error types
        const error = await response.json().catch(() => ({ message: response.statusText }));
        
        // Add response status to error object
        error.status = response.status;
        
        throw error;
      }
      
      // Handle no-content responses
      if (response.status === 204) {
        return { success: true };
      }
      
      const data = await response.json();
      
      // Cache successful responses if enabled
      if (useCache) {
        const cacheKey = `${endpoint}:${JSON.stringify(options.body || {})}`;
        CacheService.set('data', cacheKey, data, cacheTTL);
      }
      
      return data;
    } catch (error) {
      // Use error handling service for consistent error processing
      const recovery = await ErrorHandlingService.handleError(error);
      
      // Retry if recommended by error handler and not already retried
      if (recovery.type === 'retry' && !options.retried) {
        await new Promise(resolve => setTimeout(resolve, recovery.delay || 1000));
        return this.request(endpoint, { ...options, retried: true });
      }
      
      throw error;
    }
  }

  // Streaming method for real-time responses (like LLM)
  async stream(endpoint, onChunk, options = {}) {
    try {
      const headers = { ...options.headers };
      
      if (!options.skipAuth) {
        const token = await this.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || response.statusText);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events in buffer
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last incomplete chunk
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              onChunk(parsed);
            } catch (e) {
              console.error('Error parsing stream chunk:', e);
              onChunk({ type: 'error', error: e.message });
            }
          }
        }
      }
    } catch (error) {
      // Use error handling service
      ErrorHandlingService.handleError(error);
      onChunk({ type: 'error', error: error.message });
    }
  }
}

// LLM-specific service
class LLMService {
  constructor(apiConnector) {
    this.api = apiConnector;
  }
  
  async query(message, conversationId = null, options = {}) {
    const endpoint = '/query';
    const body = {
      query: message,
      conversation_id: conversationId,
      ...options
    };
    
    // Use cache for identical queries if not part of a conversation
    const useCache = !conversationId && !options.provider;
    
    return this.api.request(endpoint, {
      method: 'POST',
      body,
      useCache
    });
  }
  
  streamQuery(message, onChunk, conversationId = null, options = {}) {
    const endpoint = '/query/stream';
    const body = {
      query: message,
      conversation_id: conversationId,
      ...options
    };
    
    return this.api.stream(endpoint, onChunk, {
      method: 'POST',
      body
    });
  }
  
  // Added support for provider-specific queries
  async queryWithProvider(message, provider, conversationId = null, options = {}) {
    return this.query(message, conversationId, { ...options, provider });
  }
}

// Automation-specific service
class AutomationService {
  constructor(apiConnector) {
    this.api = apiConnector;
  }
  
  async list() {
    return this.api.request('/automations', {
      method: 'GET',
      useCache: true,
      cacheTTL: 300000 // 5 minutes
    });
  }
  
  async get(id) {
    return this.api.request(`/automations/${id}`, {
      method: 'GET',
      useCache: true
    });
  }
  
  async create(automation) {
    const result = await this.api.request('/automations', {
      method: 'POST',
      body: automation
    });
    
    // Invalidate list cache after creating
    CacheService.invalidate('data', '/automations');
    
    return result;
  }
  
  async update(id, automation) {
    const result = await this.api.request(`/automations/${id}`, {
      method: 'PUT',
      body: automation
    });
    
    // Invalidate related caches
    CacheService.invalidate('data', '/automations');
    CacheService.invalidate('data', `/automations/${id}`);
    
    return result;
  }
  
  async delete(id) {
    const result = await this.api.request(`/automations/${id}`, {
      method: 'DELETE'
    });
    
    // Invalidate related caches
    CacheService.invalidate('data', '/automations');
    CacheService.invalidate('data', `/automations/${id}`);
    
    return result;
  }
  
  async detectAutomation(message) {
    return this.api.request('/automations/detect', {
      method: 'POST',
      body: { message }
    });
  }
  
  async executeInstant(automation) {
    return this.api.request('/automations/execute', {
      method: 'POST',
      body: automation
    });
  }
}

// Integration-specific service
class IntegrationService {
  constructor(apiConnector) {
    this.api = apiConnector;
  }
  
  async listServices() {
    return this.api.request('/integrations/services', {
      method: 'GET',
      useCache: true
    });
  }
  
  async getConnectedServices() {
    return this.api.request('/integrations/connected', {
      method: 'GET',
      useCache: true,
      cacheTTL: 60000 // 1 minute cache due to potential changes
    });
  }
  
  async connectService(serviceId) {
    const result = await this.api.request('/integrations/connect', {
      method: 'POST',
      body: { service: serviceId }
    });
    
    // Invalidate connected services cache
    CacheService.invalidate('data', '/integrations/connected');
    
    return result;
  }
  
  async disconnectService(serviceId) {
    const result = await this.api.request(`/integrations/${serviceId}/disconnect`, {
      method: 'POST'
    });
    
    // Invalidate connected services cache
    CacheService.invalidate('data', '/integrations/connected');
    
    return result;
  }
}

// Social-specific service
class SocialService {
  constructor(apiConnector) {
    this.api = apiConnector;
  }
  
  async getFeed(page = 1, category = null) {
    const params = new URLSearchParams();
    params.append('page', page);
    if (category) {
      params.append('category', category);
    }
    
    return this.api.request(`/social/feed?${params.toString()}`, {
      method: 'GET',
      useCache: true,
      cacheTTL: 300000 // 5 minutes
    });
  }
  
  async getPost(id) {
    return this.api.request(`/social/posts/${id}`, {
      method: 'GET',
      useCache: true
    });
  }
  
  async createPost(post) {
    const result = await this.api.request('/social/posts', {
      method: 'POST',
      body: post
    });
    
    // Invalidate feed cache
    CacheService.invalidate('data', '/social/feed');
    
    return result;
  }
  
  async votePost(id, vote) {
    return this.api.request(`/social/posts/${id}/vote`, {
      method: 'POST',
      body: { vote }
    });
  }
  
  async shareTemplate(automationId, post) {
    return this.api.request(`/social/templates/${automationId}/share`, {
      method: 'POST',
      body: post
    });
  }
  
  async importTemplate(templateId) {
    return this.api.request(`/social/templates/${templateId}/import`, {
      method: 'POST'
    });
  }
}

export default new ApiConnector();
