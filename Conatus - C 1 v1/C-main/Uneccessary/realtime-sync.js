// src/services/realtime/realtimeService.js
import { createClient } from '@supabase/supabase-js';
import store from '../../store';
import {
  addMessage,
  updateMessage
} from '../../store/conversations';
import { 
  fetchAutomations
} from '../../store/automations';
import {
  fetchConnectedServices
} from '../../store/integrations';

// Initialize Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

/**
 * Realtime Service
 * 
 * Manages Supabase Realtime subscriptions for cross-device synchronization.
 */
class RealtimeService {
  constructor() {
    this.subscriptions = {};
    this.userId = null;
    
    // Set up auth state listener
    this.setupAuthListener();
  }

  /**
   * Set up Supabase auth state listener
   */
  setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        this.userId = session.user.id;
        this.subscribeToUserChannels();
      } else if (event === 'SIGNED_OUT') {
        this.unsubscribeFromAll();
        this.userId = null;
      }
    });
  }

  /**
   * Initialize subscriptions for the current user
   * @returns {Promise<void>}
   */
  async init() {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        this.userId = data.session.user.id;
        this.subscribeToUserChannels();
      }
    } catch (error) {
      console.error('Error initializing realtime service:', error);
    }
  }

  /**
   * Subscribe to user-specific channels
   */
  subscribeToUserChannels() {
    if (!this.userId) return;
    
    // Subscribe to user's conversations
    this.subscribeToConversations();
    
    // Subscribe to user's automations
    this.subscribeToAutomations();
    
    // Subscribe to user's integrations
    this.subscribeToIntegrations();
  }

  /**
   * Subscribe to conversation changes
   */
  subscribeToConversations() {
    if (this.subscriptions.conversations) {
      this.subscriptions.conversations.unsubscribe();
    }
    
    // Subscribe to changes in conversations
    this.subscriptions.conversations = supabase
      .channel('conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${this.userId}`
      }, this.handleConversationChange)
      .subscribe();
    
    // Subscribe to changes in messages
    this.subscriptions.messages = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `user_id=eq.${this.userId}`
      }, this.handleMessageChange)
      .subscribe();
  }

  /**
   * Subscribe to automation changes
   */
  subscribeToAutomations() {
    if (this.subscriptions.automations) {
      this.subscriptions.automations.unsubscribe();
    }
    
    this.subscriptions.automations = supabase
      .channel('automations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'automations',
        filter: `user_id=eq.${this.userId}`
      }, this.handleAutomationChange)
      .subscribe();
  }

  /**
   * Subscribe to integration changes
   */
  subscribeToIntegrations() {
    if (this.subscriptions.integrations) {
      this.subscriptions.integrations.unsubscribe();
    }
    
    this.subscriptions.integrations = supabase
      .channel('integrations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'integrations',
        filter: `user_id=eq.${this.userId}`
      }, this.handleIntegrationChange)
      .subscribe();
  }

  /**
   * Handle conversation changes from Supabase Realtime
   * @param {Object} payload - Realtime payload
   */
  handleConversationChange = (payload) => {
    // Reload conversations after any change
    const { event, new: newRecord } = payload;
    
    // Get current state
    const state = store.getState();
    const conversations = state.conversations.conversations;
    
    // Handle event types
    switch (event) {
      case 'INSERT':
        // Check if we already have this record locally
        if (!conversations.some(c => c.id === newRecord.id)) {
          // Reload conversations if this is a new conversation
          // This ensures we get all fields and properties correctly
          this.fetchConversations();
        }
        break;
        
      case 'UPDATE':
        // Check if the title changed
        const existingConversation = conversations.find(c => c.id === newRecord.id);
        if (existingConversation && existingConversation.title !== newRecord.title) {
          // Reload conversations to get updated title
          this.fetchConversations();
        }
        break;
        
      case 'DELETE':
        // Reload conversations
        this.fetchConversations();
        break;
        
      default:
        break;
    }
  }

  /**
   * Handle message changes from Supabase Realtime
   * @param {Object} payload - Realtime payload
   */
  handleMessageChange = (payload) => {
    const { event, new: newRecord } = payload;
    
    // Get current state
    const state = store.getState();
    const messages = state.conversations.messages;
    
    switch (event) {
      case 'INSERT': {
        // Add message to the appropriate conversation
        const conversationId = newRecord.conversation_id;
        
        // Format the message to match our app's format
        const message = {
          id: newRecord.id,
          role: newRecord.role,
          content: newRecord.content,
          provider: newRecord.provider,
          timestamp: newRecord.created_at,
          loading: false
        };
        
        // Check if we already have this message (to avoid duplicates)
        if (messages[conversationId] && 
            !messages[conversationId].some(m => m.id === message.id)) {
          store.dispatch(addMessage({
            conversationId,
            message
          }));
        }
        break;
      }
        
      case 'UPDATE': {
        // Update an existing message
        const conversationId = newRecord.conversation_id;
        
        // Check if we have this message
        if (messages[conversationId]) {
          const existingMessage = messages[conversationId].find(
            m => m.id === newRecord.id
          );
          
          if (existingMessage) {
            store.dispatch(updateMessage({
              conversationId,
              messageId: newRecord.id,
              content: newRecord.content,
              loading: false,
              provider: newRecord.provider
            }));
          }
        }
        break;
      }
        
      default:
        break;
    }
  }

  /**
   * Handle automation changes from Supabase Realtime
   * @param {Object} payload - Realtime payload
   */
  handleAutomationChange = () => {
    // For simplicity, just reload all automations when any change happens
    // This could be optimized in a production app
    this.fetchAutomations();
  }

  /**
   * Handle integration changes from Supabase Realtime
   * @param {Object} payload - Realtime payload
   */
  handleIntegrationChange = () => {
    // Reload integrations when any change happens
    this.fetchIntegrations();
  }

  /**
   * Fetch conversations from API
   */
  fetchConversations() {
    // Use setTimeout to avoid multiple rapid reloads
    if (this.conversationsTimeout) {
      clearTimeout(this.conversationsTimeout);
    }
    
    this.conversationsTimeout = setTimeout(() => {
      // We'll use our existing Redux action
      // This will be dispatched through our store
      // const { fetchConversations } = require('../../store/conversations');
      // store.dispatch(fetchConversations());
      
      // For now, just reload the page to avoid circular dependencies
      // In a real app, you'd restructure this to avoid the issue
      window.location.reload();
    }, 500);
  }

  /**
   * Fetch automations from API
   */
  fetchAutomations() {
    // Use setTimeout to avoid multiple rapid reloads
    if (this.automationsTimeout) {
      clearTimeout(this.automationsTimeout);
    }
    
    this.automationsTimeout = setTimeout(() => {
      store.dispatch(fetchAutomations());
    }, 500);
  }

  /**
   * Fetch integrations from API
   */
  fetchIntegrations() {
    // Use setTimeout to avoid multiple rapid reloads
    if (this.integrationsTimeout) {
      clearTimeout(this.integrationsTimeout);
    }
    
    this.integrationsTimeout = setTimeout(() => {
      store.dispatch(fetchConnectedServices());
    }, 500);
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeFromAll() {
    Object.values(this.subscriptions).forEach(subscription => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    });
    
    this.subscriptions = {};
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.unsubscribeFromAll();
  }
}

// Create a singleton instance
const realtimeService = new RealtimeService();

export default realtimeService;
