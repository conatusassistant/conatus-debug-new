// src/services/api/llmService.js
import apiConnector from './apiConnector';

/**
 * LLM Service
 * 
 * Handles interactions with the LLM backend services for querying, streaming, and managing conversations.
 */
export const llmService = {
  /**
   * Send a query to the appropriate LLM
   * @param {string} query - User's query 
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} LLM response
   */
  async sendQuery(query, options = {}) {
    return apiConnector.post('/query', {
      query,
      conversation_id: options.conversationId,
      provider: options.providerId,
      context: options.context || {}
    });
  },
  
  /**
   * Stream a query response from the LLM
   * @param {string} query - User's query
   * @param {Object} options - Additional options
   * @param {function} onChunk - Callback for response chunks
   * @param {function} onError - Callback for errors
   * @param {function} onComplete - Callback for completion
   * @returns {function} Cancel function
   */
  streamQuery(query, options = {}, onChunk, onError, onComplete) {
    return apiConnector.streamResponse('/query/stream', {
      query,
      conversation_id: options.conversationId,
      provider: options.providerId,
      context: options.context || {}
    }, onChunk, onError, onComplete);
  },
  
  /**
   * Get conversation history
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} Conversation messages
   */
  async getConversation(conversationId) {
    return apiConnector.get(`/conversations/${conversationId}`);
  },
  
  /**
   * Get all user conversations
   * @param {Object} options - Pagination options
   * @returns {Promise<Array>} List of conversations
   */
  async getConversations(options = {}) {
    const query = new URLSearchParams();
    
    if (options.limit) {
      query.append('limit', options.limit);
    }
    
    if (options.offset) {
      query.append('offset', options.offset);
    }
    
    return apiConnector.get(`/conversations?${query.toString()}`);
  },
  
  /**
   * Create a new conversation
   * @param {string} title - Conversation title
   * @returns {Promise<Object>} Created conversation
   */
  async createConversation(title) {
    return apiConnector.post('/conversations', { title });
  },
  
  /**
   * Rename a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} title - New title
   * @returns {Promise<Object>} Updated conversation
   */
  async renameConversation(conversationId, title) {
    return apiConnector.put(`/conversations/${conversationId}`, { title });
  },
  
  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<void>}
   */
  async deleteConversation(conversationId) {
    return apiConnector.delete(`/conversations/${conversationId}`);
  }
};

// src/services/api/automationService.js
import apiConnector from './apiConnector';

/**
 * Automation Service
 * 
 * Handles interactions with the automation backend services for creating, updating,
 * and managing automations.
 */
export const automationService = {
  /**
   * Get all user automations
   * @returns {Promise<Array>} List of automations
   */
  async getAutomations() {
    return apiConnector.get('/automations');
  },
  
  /**
   * Get a specific automation
   * @param {string} automationId - Automation ID
   * @returns {Promise<Object>} Automation details
   */
  async getAutomation(automationId) {
    return apiConnector.get(`/automations/${automationId}`);
  },
  
  /**
   * Create a new automation
   * @param {Object} automationData - Automation configuration
   * @returns {Promise<Object>} Created automation
   */
  async createAutomation(automationData) {
    return apiConnector.post('/automations', automationData);
  },
  
  /**
   * Update an existing automation
   * @param {string} automationId - Automation ID
   * @param {Object} automationData - Updated configuration
   * @returns {Promise<Object>} Updated automation
   */
  async updateAutomation(automationId, automationData) {
    return apiConnector.put(`/automations/${automationId}`, automationData);
  },
  
  /**
   * Delete an automation
   * @param {string} automationId - Automation ID
   * @returns {Promise<void>}
   */
  async deleteAutomation(automationId) {
    return apiConnector.delete(`/automations/${automationId}`);
  },
  
  /**
   * Toggle automation enabled status
   * @param {string} automationId - Automation ID
   * @param {boolean} enabled - Enabled status
   * @returns {Promise<Object>} Updated automation
   */
  async toggleAutomation(automationId, enabled) {
    return apiConnector.put(`/automations/${automationId}/toggle`, { enabled });
  },
  
  /**
   * Execute an automation manually
   * @param {string} automationId - Automation ID
   * @returns {Promise<Object>} Execution result
   */
  async executeAutomation(automationId) {
    return apiConnector.post(`/automations/${automationId}/execute`);
  },
  
  /**
   * Get automation execution history
   * @param {string} automationId - Automation ID
   * @returns {Promise<Array>} Execution history
   */
  async getAutomationHistory(automationId) {
    return apiConnector.get(`/automations/${automationId}/history`);
  },
  
  /**
   * Get available triggers
   * @returns {Promise<Array>} Available triggers
   */
  async getTriggers() {
    return apiConnector.get('/automations/triggers');
  },
  
  /**
   * Get available actions
   * @returns {Promise<Array>} Available actions
   */
  async getActions() {
    return apiConnector.get('/automations/actions');
  }
};

// src/services/api/integrationService.js
import apiConnector from './apiConnector';

/**
 * Integration Service
 * 
 * Handles interactions with third-party service integrations through OAuth.
 */
export const integrationService = {
  /**
   * Get all connected services
   * @returns {Promise<Array>} List of connected services
   */
  async getConnectedServices() {
    return apiConnector.get('/integrations');
  },
  
  /**
   * Initiate OAuth flow for a service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<Object>} OAuth initialization data
   */
  async connectService(serviceId) {
    return apiConnector.post(`/integrations/${serviceId}/connect`);
  },
  
  /**
   * Disconnect a service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async disconnectService(serviceId) {
    return apiConnector.delete(`/integrations/${serviceId}`);
  },
  
  /**
   * Check if a service is connected
   * @param {string} serviceId - Service identifier
   * @returns {Promise<boolean>} Connection status
   */
  async isServiceConnected(serviceId) {
    try {
      const result = await apiConnector.get(`/integrations/${serviceId}/status`);
      return result.connected;
    } catch (error) {
      console.error(`Error checking service status: ${error.message}`);
      return false;
    }
  },
  
  /**
   * Get all supported services
   * @returns {Promise<Array>} List of supported services
   */
  async getSupportedServices() {
    return apiConnector.get('/integrations/supported');
  }
};

// src/services/api/socialService.js
import apiConnector from './apiConnector';

/**
 * Social Service
 * 
 * Handles interactions with the social backend services for sharing and discovering content.
 */
export const socialService = {
  /**
   * Get social feed content
   * @param {Object} options - Feed options
   * @returns {Promise<Array>} Feed items
   */
  async getFeed(options = {}) {
    const query = new URLSearchParams();
    
    if (options.category) {
      query.append('category', options.category);
    }
    
    if (options.sort) {
      query.append('sort', options.sort);
    }
    
    if (options.limit) {
      query.append('limit', options.limit);
    }
    
    if (options.offset) {
      query.append('offset', options.offset);
    }
    
    return apiConnector.get(`/social/feed?${query.toString()}`);
  },
  
  /**
   * Get a specific post
   * @param {string} postId - Post ID
   * @returns {Promise<Object>} Post details
   */
  async getPost(postId) {
    return apiConnector.get(`/social/posts/${postId}`);
  },
  
  /**
   * Create a new post
   * @param {Object} postData - Post data
   * @returns {Promise<Object>} Created post
   */
  async createPost(postData) {
    return apiConnector.post('/social/posts', postData);
  },
  
  /**
   * Delete a post
   * @param {string} postId - Post ID
   * @returns {Promise<void>}
   */
  async deletePost(postId) {
    return apiConnector.delete(`/social/posts/${postId}`);
  },
  
  /**
   * Upvote a post
   * @param {string} postId - Post ID
   * @returns {Promise<Object>} Updated post
   */
  async upvotePost(postId) {
    return apiConnector.post(`/social/posts/${postId}/upvote`);
  },
  
  /**
   * Get comments for a post
   * @param {string} postId - Post ID
   * @returns {Promise<Array>} Comments
   */
  async getComments(postId) {
    return apiConnector.get(`/social/posts/${postId}/comments`);
  },
  
  /**
   * Add a comment to a post
   * @param {string} postId - Post ID
   * @param {string} content - Comment content
   * @returns {Promise<Object>} Created comment
   */
  async addComment(postId, content) {
    return apiConnector.post(`/social/posts/${postId}/comments`, { content });
  },
  
  /**
   * Share an automation template
   * @param {string} automationId - Automation ID
   * @param {Object} shareData - Share data (title, description)
   * @returns {Promise<Object>} Shared template
   */
  async shareTemplate(automationId, shareData) {
    return apiConnector.post(`/social/templates`, {
      automation_id: automationId,
      ...shareData
    });
  },
  
  /**
   * Import a shared template
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Imported automation
   */
  async importTemplate(templateId) {
    return apiConnector.post(`/social/templates/${templateId}/import`);
  }
};

// src/services/api/index.js
import apiConnector from './apiConnector';
import { llmService } from './llmService';
import { automationService } from './automationService';
import { integrationService } from './integrationService';
import { socialService } from './socialService';

// Export all services
export {
  apiConnector,
  llmService,
  automationService,
  integrationService,
  socialService
};
