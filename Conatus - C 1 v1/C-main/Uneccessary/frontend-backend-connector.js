// src/services/api-connector.js
/**
 * API Connector Service
 * 
 * This service handles all communication between the frontend and backend,
 * implementing the connection strategy outlined in the architectural plan.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

// API URL from environment
const API_URL = process.env.REACT_APP_API_URL;

// Create headers with authentication
const getHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

/**
 * LLM Query Service
 * Handles routing to appropriate LLM based on query type
 */
export const LLMService = {
  /**
   * Send a query to the backend for classification and processing
   * @param {string} query - The user's query text
   * @param {string} conversationId - Optional ID of existing conversation
   * @param {Object} context - Additional context for the query
   * @returns {Promise<Object>} - The LLM response
   */
  async sendQuery(query, conversationId = null, context = {}) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          conversation_id: conversationId,
          context
        })
      });
      
      if (!response.ok) {
        throw new Error(`Query failed with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('LLM query error:', error);
      throw error;
    }
  },
  
  /**
   * Stream a query response from the backend
   * @param {string} query - The user's query text
   * @param {string} conversationId - Optional ID of existing conversation
   * @param {Object} context - Additional context for the query
   * @param {Function} onChunk - Callback for each chunk of the stream
   * @returns {Promise<void>}
   */
  async streamQuery(query, conversationId = null, context = {}, onChunk) {
    try {
      const headers = await getHeaders();
      headers['Accept'] = 'text/event-stream';
      
      const response = await fetch(`${API_URL}/api/v1/query/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          conversation_id: conversationId,
          context
        })
      });
      
      if (!response.ok) {
        throw new Error(`Stream query failed with status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value);
        const events = chunk
          .split('\n\n')
          .filter(Boolean)
          .map(eventStr => {
            const dataStr = eventStr.replace(/^data: /, '');
            try {
              return JSON.parse(dataStr);
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);
        
        for (const event of events) {
          onChunk(event);
        }
      }
    } catch (error) {
      console.error('LLM stream error:', error);
      throw error;
    }
  }
};

/**
 * Automation Service
 * Handles both Home tab (instant) and Library tab (configured) automations
 */
export const AutomationService = {
  /**
   * Detect if a message can be automated
   * @param {string} message - User message to analyze
   * @returns {Promise<Object|null>} - Automation details if detected, null otherwise
   */
  async detectAutomation(message) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/automations/detect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) {
        throw new Error(`Automation detection failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.automation || null;
    } catch (error) {
      console.error('Automation detection error:', error);
      return null;
    }
  },
  
  /**
   * Execute an instant automation
   * @param {Object} automation - Automation details
   * @returns {Promise<Object>} - Execution result
   */
  async executeInstant(automation) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/automations/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(automation)
      });
      
      if (!response.ok) {
        throw new Error(`Automation execution failed with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Automation execution error:', error);
      throw error;
    }
  },
  
  /**
   * Get all configured automations
   * @returns {Promise<Array>} - List of configured automations
   */
  async getConfigured() {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/automations`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch automations with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch automations error:', error);
      throw error;
    }
  },
  
  /**
   * Create a new configured automation
   * @param {Object} automation - Automation configuration
   * @returns {Promise<Object>} - Created automation
   */
  async createConfigured(automation) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/automations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(automation)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create automation with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Create automation error:', error);
      throw error;
    }
  },
  
  /**
   * Update an existing automation
   * @param {string} id - Automation ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated automation
   */
  async updateConfigured(id, updates) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/automations/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update automation with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Update automation error:', error);
      throw error;
    }
  },
  
  /**
   * Toggle an automation's enabled status
   * @param {string} id - Automation ID
   * @param {boolean} enabled - Whether the automation should be enabled
   * @returns {Promise<Object>} - Updated automation
   */
  async toggleEnabled(id, enabled) {
    return this.updateConfigured(id, { enabled });
  },
  
  /**
   * Delete an automation
   * @param {string} id - Automation ID to delete
   * @returns {Promise<void>}
   */
  async deleteAutomation(id) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/automations/${id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete automation with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Delete automation error:', error);
      throw error;
    }
  }
};

/**
 * Integration Service
 * Handles connections to third-party services
 */
export const IntegrationService = {
  /**
   * Get all connected services
   * @returns {Promise<Array>} - List of connected services
   */
  async getConnections() {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/integrations`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch integrations with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch integrations error:', error);
      throw error;
    }
  },
  
  /**
   * Initiate OAuth flow for a service
   * @param {string} service - Service name to connect
   * @returns {Promise<string>} - OAuth URL to redirect to
   */
  async initiateOAuth(service) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/integrations/${service}/auth`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initiate OAuth with status: ${response.status}`);
      }
      
      const { authUrl } = await response.json();
      return authUrl;
    } catch (error) {
      console.error('OAuth initiation error:', error);
      throw error;
    }
  },
  
  /**
   * Complete OAuth flow after redirect
   * @param {string} service - Service name
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @returns {Promise<Object>} - Connection result
   */
  async completeOAuth(service, code, state) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/integrations/${service}/callback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, state })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to complete OAuth with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('OAuth completion error:', error);
      throw error;
    }
  },
  
  /**
   * Disconnect a service
   * @param {string} service - Service name to disconnect
   * @returns {Promise<void>}
   */
  async disconnect(service) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/integrations/${service}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to disconnect service with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Service disconnection error:', error);
      throw error;
    }
  }
};

/**
 * Social Service
 * Handles social tab functionality
 */
export const SocialService = {
  /**
   * Get social feed content
   * @param {Object} filters - Content filters
   * @param {number} page - Page number for pagination
   * @returns {Promise<Object>} - Paginated feed content
   */
  async getFeed(filters = {}, page = 1) {
    try {
      const headers = await getHeaders();
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        ...filters
      });
      
      const response = await fetch(`${API_URL}/api/v1/social/feed?${queryParams}`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch social feed with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch social feed error:', error);
      throw error;
    }
  },
  
  /**
   * Share an automation template
   * @param {Object} template - Template to share
   * @returns {Promise<Object>} - Shared template
   */
  async shareTemplate(template) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/social/templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(template)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to share template with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Share template error:', error);
      throw error;
    }
  },
  
  /**
   * Upvote a social post
   * @param {string} postId - Post ID to upvote
   * @returns {Promise<Object>} - Updated post
   */
  async upvotePost(postId) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/social/posts/${postId}/upvote`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upvote post with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Upvote post error:', error);
      throw error;
    }
  },
  
  /**
   * Add a comment to a post
   * @param {string} postId - Post ID
   * @param {string} content - Comment content
   * @returns {Promise<Object>} - Created comment
   */
  async addComment(postId, content) {
    try {
      const headers = await getHeaders();
      
      const response = await fetch(`${API_URL}/api/v1/social/posts/${postId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add comment with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }
};

/**
 * Supabase Realtime Sync Service
 * Handles real-time data synchronization across devices
 */
export const SyncService = {
  subscriptions: [],
  
  /**
   * Initialize sync service for a user
   * @param {string} userId - User ID to sync
   * @param {Function} onConversationUpdate - Callback for conversation updates
   * @param {Function} onMessageUpdate - Callback for message updates
   * @param {Function} onAutomationUpdate - Callback for automation updates
   */
  initialize(userId, onConversationUpdate, onMessageUpdate, onAutomationUpdate) {
    this.cleanup(); // Clear any existing subscriptions
    
    // Subscribe to conversations
    const conversationSubscription = supabase
      .from(`conversations:user_id=eq.${userId}`)
      .on('*', payload => {
        onConversationUpdate(payload);
      })
      .subscribe();
    
    this.subscriptions.push(conversationSubscription);
    
    // Subscribe to messages
    const messageSubscription = supabase
      .from('messages')
      .on('INSERT', payload => {
        onMessageUpdate(payload);
      })
      .subscribe();
    
    this.subscriptions.push(messageSubscription);
    
    // Subscribe to automations
    const automationSubscription = supabase
      .from(`automations:user_id=eq.${userId}`)
      .on('*', payload => {
        onAutomationUpdate(payload);
      })
      .subscribe();
    
    this.subscriptions.push(automationSubscription);
  },
  
  /**
   * Clean up all subscriptions
   */
  cleanup() {
    this.subscriptions.forEach(subscription => {
      supabase.removeSubscription(subscription);
    });
    
    this.subscriptions = [];
  }
};

/**
 * Main API connector that combines all services
 */
const ApiConnector = {
  llm: LLMService,
  automation: AutomationService,
  integration: IntegrationService,
  social: SocialService,
  sync: SyncService,
  supabase
};

export default ApiConnector;
