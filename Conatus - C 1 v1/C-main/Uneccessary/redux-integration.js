// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth';
import conversationsReducer from './conversations';
import automationsReducer from './automations';
import integrationsReducer from './integrations';
import socialReducer from './social';
import uiReducer from './ui';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    conversations: conversationsReducer,
    automations: automationsReducer,
    integrations: integrationsReducer,
    social: socialReducer,
    ui: uiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore certain non-serializable values in state
        ignoredActions: ['conversations/streamResponse/pending'],
        ignoredPaths: ['conversations.streamController']
      }
    })
});

export default store;

// src/store/auth.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Async thunks
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signInWithProvider = createAsyncThunk(
  'auth/signInWithProvider',
  async (provider, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return null;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (email, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updatePassword = createAsyncThunk(
  'auth/updatePassword',
  async (password, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getUser = createAsyncThunk(
  'auth/getUser',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    session: null,
    loading: true,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Sign in
    builder.addCase(signIn.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(signIn.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.loading = false;
      state.error = null;
    });
    builder.addCase(signIn.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to sign in';
    });
    
    // Sign in with provider
    builder.addCase(signInWithProvider.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(signInWithProvider.fulfilled, (state) => {
      // OAuth flow will be handled by redirect, so we just update loading state
      state.loading = false;
    });
    builder.addCase(signInWithProvider.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to sign in';
    });
    
    // Sign up
    builder.addCase(signUp.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(signUp.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.loading = false;
      state.error = null;
    });
    builder.addCase(signUp.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to sign up';
    });
    
    // Sign out
    builder.addCase(signOut.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(signOut.fulfilled, (state) => {
      state.user = null;
      state.session = null;
      state.loading = false;
      state.error = null;
    });
    builder.addCase(signOut.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to sign out';
    });
    
    // Reset password
    builder.addCase(resetPassword.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(resetPassword.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(resetPassword.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to reset password';
    });
    
    // Update password
    builder.addCase(updatePassword.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updatePassword.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(updatePassword.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to update password';
    });
    
    // Get user
    builder.addCase(getUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getUser.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.loading = false;
      state.error = null;
    });
    builder.addCase(getUser.rejected, (state, action) => {
      state.user = null;
      state.session = null;
      state.loading = false;
      state.error = action.payload || 'Failed to get user';
    });
  }
});

export const { clearError } = authSlice.actions;

export default authSlice.reducer;

// src/store/conversations.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { llmService } from '../services/api/llmService';

// Async thunks
export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async (options, { rejectWithValue }) => {
    try {
      return await llmService.getConversations(options);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchConversation = createAsyncThunk(
  'conversations/fetchConversation',
  async (conversationId, { rejectWithValue }) => {
    try {
      return await llmService.getConversation(conversationId);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createConversation = createAsyncThunk(
  'conversations/createConversation',
  async (title, { rejectWithValue }) => {
    try {
      return await llmService.createConversation(title);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const renameConversation = createAsyncThunk(
  'conversations/renameConversation',
  async ({ conversationId, title }, { rejectWithValue }) => {
    try {
      return await llmService.renameConversation(conversationId, title);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteConversation = createAsyncThunk(
  'conversations/deleteConversation',
  async (conversationId, { rejectWithValue }) => {
    try {
      await llmService.deleteConversation(conversationId);
      return conversationId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const sendQuery = createAsyncThunk(
  'conversations/sendQuery',
  async ({ query, conversationId, options }, { rejectWithValue }) => {
    try {
      return await llmService.sendQuery(query, {
        conversationId,
        ...options
      });
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const streamResponse = createAsyncThunk(
  'conversations/streamResponse',
  async ({ query, conversationId, options }, { 
    dispatch, 
    rejectWithValue,
    signal
  }) => {
    try {
      const responseChunks = [];
      let provider = null;
      
      // Create a response object that will be built up over time
      const response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        loading: true,
        timestamp: new Date().toISOString()
      };
      
      // Add empty assistant message to state immediately
      dispatch(addMessage({
        conversationId,
        message: response
      }));
      
      // Use a promise to handle the streaming
      return await new Promise((resolve, reject) => {
        const cancelStream = llmService.streamQuery(
          query,
          { conversationId, ...options },
          (chunk) => {
            // Append content or store provider info
            if (chunk.type === 'content' && chunk.content) {
              responseChunks.push(chunk.content);
              const content = responseChunks.join('');
              
              // Update message as it streams in
              dispatch(updateMessage({
                conversationId,
                messageId: response.id,
                content,
                loading: true
              }));
            } else if (chunk.type === 'provider') {
              provider = chunk.provider;
            }
          },
          (error) => {
            // Handle error
            reject(error);
          },
          () => {
            // Handle completion
            const fullContent = responseChunks.join('');
            
            // Update message as completed
            dispatch(updateMessage({
              conversationId,
              messageId: response.id,
              content: fullContent,
              loading: false,
              provider
            }));
            
            resolve({
              id: response.id,
              content: fullContent,
              provider,
              timestamp: new Date().toISOString()
            });
          }
        );
        
        // Abort the stream if the thunk is cancelled
        signal.addEventListener('abort', () => {
          cancelStream();
        });
      });
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to stream response');
    }
  }
);

// Slice
const conversationsSlice = createSlice({
  name: 'conversations',
  initialState: {
    conversations: [],
    currentConversation: null,
    messages: {},
    loading: false,
    error: null,
    streamController: null
  },
  reducers: {
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
    },
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      
      state.messages[conversationId].push(message);
    },
    updateMessage: (state, action) => {
      const { conversationId, messageId, content, loading, provider } = action.payload;
      
      if (state.messages[conversationId]) {
        const messageIndex = state.messages[conversationId].findIndex(
          msg => msg.id === messageId
        );
        
        if (messageIndex !== -1) {
          if (content !== undefined) {
            state.messages[conversationId][messageIndex].content = content;
          }
          
          if (loading !== undefined) {
            state.messages[conversationId][messageIndex].loading = loading;
          }
          
          if (provider !== undefined) {
            state.messages[conversationId][messageIndex].provider = provider;
          }
        }
      }
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch conversations
    builder.addCase(fetchConversations.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchConversations.fulfilled, (state, action) => {
      state.conversations = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchConversations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to fetch conversations';
    });
    
    // Fetch conversation
    builder.addCase(fetchConversation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchConversation.fulfilled, (state, action) => {
      const { id, messages } = action.payload;
      state.currentConversation = id;
      state.messages[id] = messages;
      state.loading = false;
    });
    builder.addCase(fetchConversation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to fetch conversation';
    });
    
    // Create conversation
    builder.addCase(createConversation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createConversation.fulfilled, (state, action) => {
      state.conversations.unshift(action.payload);
      state.currentConversation = action.payload.id;
      state.messages[action.payload.id] = [];
      state.loading = false;
    });
    builder.addCase(createConversation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to create conversation';
    });
    
    // Rename conversation
    builder.addCase(renameConversation.fulfilled, (state, action) => {
      const index = state.conversations.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.conversations[index] = action.payload;
      }
    });
    
    // Delete conversation
    builder.addCase(deleteConversation.fulfilled, (state, action) => {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
      if (state.currentConversation === action.payload) {
        state.currentConversation = null;
      }
      delete state.messages[action.payload];
    });
    
    // Send query
    builder.addCase(sendQuery.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(sendQuery.fulfilled, (state, action) => {
      const { conversationId } = action.meta.arg;
      
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      
      // Add the user query and response to the messages
      state.messages[conversationId].push({
        id: `user-${Date.now()}`,
        role: 'user',
        content: action.meta.arg.query,
        timestamp: new Date().toISOString()
      });
      
      state.messages[conversationId].push({
        id: action.payload.id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: action.payload.content,
        provider: action.payload.provider,
        timestamp: new Date().toISOString()
      });
      
      state.loading = false;
    });
    builder.addCase(sendQuery.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to send query';
    });
    
    // Stream response
    builder.addCase(streamResponse.pending, (state, action) => {
      const { conversationId, query } = action.meta.arg;
      
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      
      // Add the user query to the messages
      state.messages[conversationId].push({
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        timestamp: new Date().toISOString()
      });
      
      state.loading = true;
      state.error = null;
    });
    builder.addCase(streamResponse.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(streamResponse.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to stream response';
    });
  }
});

export const {
  setCurrentConversation,
  addMessage,
  updateMessage,
  clearError
} = conversationsSlice.actions;

export default conversationsSlice.reducer;

// src/store/automations.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { automationService } from '../services/api/automationService';
import { integrationService } from '../services/api/integrationService';

// Async thunks
export const fetchAutomations = createAsyncThunk(
  'automations/fetchAutomations',
  async (_, { rejectWithValue }) => {
    try {
      return await automationService.getAutomations();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAutomation = createAsyncThunk(
  'automations/fetchAutomation',
  async (automationId, { rejectWithValue }) => {
    try {
      return await automationService.getAutomation(automationId);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createAutomation = createAsyncThunk(
  'automations/createAutomation',
  async (automationData, { rejectWithValue }) => {
    try {
      return await automationService.createAutomation(automationData);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateAutomation = createAsyncThunk(
  'automations/updateAutomation',
  async ({ id, ...automationData }, { rejectWithValue }) => {
    try {
      return await automationService.updateAutomation(id, automationData);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteAutomation = createAsyncThunk(
  'automations/deleteAutomation',
  async (automationId, { rejectWithValue }) => {
    try {
      await automationService.deleteAutomation(automationId);
      return automationId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const toggleAutomation = createAsyncThunk(
  'automations/toggleAutomation',
  async ({ id, enabled }, { rejectWithValue }) => {
    try {
      return await automationService.toggleAutomation(id, enabled);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const executeAutomation = createAsyncThunk(
  'automations/executeAutomation',
  async (automationId, { rejectWithValue }) => {
    try {
      return await automationService.executeAutomation(automationId);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAutomationHistory = createAsyncThunk(
  'automations/fetchAutomationHistory',
  async (automationId, { rejectWithValue }) => {
    try {
      const history = await automationService.getAutomationHistory(automationId);
      return { automationId, history };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchServices = createAsyncThunk(
  'automations/fetchServices',
  async (_, { rejectWithValue }) => {
    try {
      const [connected, supported] = await Promise.all([
        integrationService.getConnectedServices(),
        integrationService.getSupportedServices()
      ]);
      
      // Organize services by category
      const servicesByCategory = {};
      
      supported.forEach(service => {
        if (!servicesByCategory[service.category]) {
          servicesByCategory[service.category] = [];
        }
        
        // Check if service is connected
        const isConnected = connected.some(conn => conn.id === service.id);
        
        servicesByCategory[service.category].push({
          ...service,
          connected: isConnected
        });
      });
      
      return servicesByCategory;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Slice
const automationsSlice = createSlice({
  name: 'automations',
  initialState: {
    automations: [],
    currentAutomation: null,
    services: null,
    history: {},
    loading: false,
    loadingServices: false,
    executing: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch automations
    builder.addCase(fetchAutomations.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAutomations.fulfilled, (state, action) => {
      state.automations = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchAutomations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to fetch automations';
    });
    
    // Fetch automation
    builder.addCase(fetchAutomation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAutomation.fulfilled, (state, action) => {
      state.currentAutomation = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchAutomation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to fetch automation';
    });
    
    // Create automation
    builder.addCase(createAutomation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createAutomation.fulfilled, (state, action) => {
      state.automations.push(action.payload);
      state.currentAutomation = action.payload;
      state.loading = false;
    });
    builder.addCase(createAutomation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to create automation';
    });
    
    // Update automation
    builder.addCase(updateAutomation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updateAutomation.fulfilled, (state, action) => {
      const index = state.automations.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.automations[index] = action.payload;
      }
      state.currentAutomation = action.payload;
      state.loading = false;
    });
    builder.addCase(updateAutomation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to update automation';
    });
    
    // Delete automation
    builder.addCase(deleteAutomation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(deleteAutomation.fulfilled, (state, action) => {
      state.automations = state.automations.filter(a => a.id !== action.payload);
      if (state.currentAutomation && state.currentAutomation.id === action.payload) {
        state.currentAutomation = null;
      }
      state.loading = false;
    });
    builder.addCase(deleteAutomation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to delete automation';
    });
    
    // Toggle automation
    builder.addCase(toggleAutomation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(toggleAutomation.fulfilled, (state, action) => {
      const index = state.automations.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.automations[index] = action.payload;
      }
      if (state.currentAutomation && state.currentAutomation.id === action.payload.id) {
        state.currentAutomation = action.payload;
      }
      state.loading = false;
    });
    builder.addCase(toggleAutomation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to toggle automation';
    });
    
    // Execute automation
    builder.addCase(executeAutomation.pending, (state) => {
      state.executing = true;
      state.error = null;
    });
    builder.addCase(executeAutomation.fulfilled, (state) => {
      state.executing = false;
    });
    builder.addCase(executeAutomation.rejected, (state, action) => {
      state.executing = false;
      state.error = action.payload || 'Failed to execute automation';
    });
    
    // Fetch automation history
    builder.addCase(fetchAutomationHistory.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAutomationHistory.fulfilled, (state, action) => {
      const { automationId, history } = action.payload;
      state.history[automationId] = history;
      state.loading = false;
    });
    builder.addCase(fetchAutomationHistory.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to fetch automation history';
    });
    
    // Fetch services
    builder.addCase(fetchServices.pending, (state) => {
      state.loadingServices = true;
      state.error = null;
    });
    builder.addCase(fetchServices.fulfilled, (state, action) => {
      state.services = action.payload;
      state.loadingServices = false;
    });
    builder.addCase(fetchServices.rejected, (state, action) => {
      state.loadingServices = false;
      state.error = action.payload || 'Failed to fetch services';
    });
  }
});

export const { clearError } = automationsSlice.actions;

export default automationsSlice.reducer;

// src/store/integrations.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { integrationService } from '../services/api/integrationService';

// Async thunks
export const fetchConnectedServices = createAsyncThunk(
  'integrations/fetchConnectedServices',
  async (_, { rejectWithValue }) => {
    try {
      return await integrationService.getConnectedServices();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSupportedServices = createAsyncThunk(
  'integrations/fetchSupportedServices',
  async (_, { rejectWithValue }) => {
    try {
      return await integrationService.getSupportedServices();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const connectService = createAsyncThunk(
  'integrations/connectService',
  async (serviceId, { rejectWithValue }) => {
    try {
      return await integrationService.connectService(serviceId);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const disconnectService = createAsyncThunk(
  'integrations/disconnectService',
  async (serviceId, { rejectWithValue }) => {
    try {
      await integrationService.disconnectService(serviceId);
      return serviceId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const checkServiceStatus = createAsyncThunk(
  'integrations/checkServiceStatus',
  async (serviceId, { rejectWithValue }) => {
    try {
      const connected = await integrationService.isServiceConnected(serviceId);
      return { serviceId, connected };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Slice
const integrationsSlice = createSlice({
  name: 'integrations',
  initialState: {
    connectedServices: [],
    supportedServices: [],
    loading: false,
    connecting: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch connected services
    builder.addCase(fetchConnectedServices.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchConnectedServices.fulfilled, (state, action) => {
      state.connectedServices = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchConnectedServices.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to fetch connected services';
    });
    
    // Fetch supported services
    builder.addCase(fetchSupportedServices.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchSupportedServices.fulfilled, (state, action) => {
      state.supportedServices = action.payload;
      state.loading = false;
    });
    builder.addCase(fetchSupportedServices.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to fetch supported services';
    });
    
    // Connect service
    builder.addCase(connectService.pending, (state) => {
      state.connecting = true;
      state.error = null;
    });
    builder.addCase(connectService.fulfilled, (state) => {
      state.connecting = false;
    });
    builder.addCase(connectService.rejected, (state, action) => {
      state.connecting = false;
      state.error = action.payload || 'Failed to connect service';
    });
    
    // Disconnect service
    builder.addCase(disconnectService.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(disconnectService.fulfilled, (state, action) => {
      state.connectedServices = state.connectedServices.filter(
        service => service.id !== action.payload
      );
      state.loading = false;
    });
    builder.addCase(disconnectService.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || 'Failed to disconnect service';
    });
    
    // Check service status
    builder.addCase(checkServiceStatus.fulfilled, (state, action) => {
      const { serviceId, connected } = action.payload;
      
      // Update supported services
      const supportedIndex = state.supportedServices.findIndex(
        service => service.id === serviceId
      );
      
      if (supportedIndex !== -1) {
        state.supportedServices[supportedIndex].connected = connected;
      }
      
      // Update connected services
      if (connected) {
        if (!state.connectedServices.some(service => service.id === serviceId)) {
          // Add to connected services if not already there
          const service = state.supportedServices.find(s => s.id === serviceId);
          if (service) {
            state.connectedServices.push({
              id: service.id,
              name: service.name,
              category: service.category,
              connected: true
            });
          }
        }
      } else {
        // Remove from connected services if not connected
        state.connectedServices = state.connectedServices.filter(
          service => service.id !== serviceId
        );
      }
    });
  }
});

export const { clearError } = integrationsSlice.actions;

export default integrationsSlice.reducer;
