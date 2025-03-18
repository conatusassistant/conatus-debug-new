# Conatus: Enhanced Frontend-Backend Integration Strategy

## Executive Summary

This document provides an in-depth strategy for integrating the frontend UI/UX design with the backend architecture of Conatus, addressing any discrepancies between components while ensuring a cohesive system. The integration strategy follows a modular, microservices approach with serverless architecture as specified in both the architectural plan and software requirements specification.

## Architecture Overview

Conatus implements a hybrid architecture with:

1. **Frontend Layer**: React-based UI with state management via React Context/Redux
2. **API Gateway Layer**: AWS API Gateway providing unified access to backend services
3. **Service Layer**: Serverless Lambda functions for business logic
4. **Data Layer**: Supabase for persistence and real-time sync, Redis for caching
5. **Integration Layer**: OAuth connectors to third-party services
6. **LLM Classification Layer**: Logic for routing queries to appropriate AI models

### System Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   React Client  │────▶│  AWS API Gateway │────▶│ Lambda Functions  │
└─────────────────┘     └──────────────────┘     └───────────────────┘
         │                                                 │
         │                                                 ▼
         │                                        ┌───────────────────┐
         │                                        │  Service Layer    │
         │                                        │  - LLM Router     │
         │                                        │  - Auth Service   │
         │                                        │  - Automation Eng │
         ▼                                        └───────────────────┘
┌─────────────────┐                                        │
│ Supabase Client │◀───────────────────────────────────────┘
└─────────────────┘                                        │
         │                                                 ▼
         ▼                                        ┌───────────────────┐
┌─────────────────┐                               │ External Services │
│  Supabase DB    │                               │ - LLM APIs        │
│  - PostgreSQL   │                               │ - OAuth Providers │
└─────────────────┘                               └───────────────────┘
         │
         ▼
┌─────────────────┐
│  Redis Cache    │
└─────────────────┘
```

## Key Integration Points

### 1. Unified State Management Strategy

#### Current Design Approach

The UI/UX design may implement component-specific state, while the backend needs a consistent data model across multiple services.

#### Integration Solution

Implement a three-tier state management strategy:

1. **Ephemeral UI State**: React local state for transient UI elements
   ```javascript
   // Component-level state
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   ```

2. **Application State**: Redux/Context for cross-component shared state
   ```javascript
   // Using Redux Toolkit
   const conversationSlice = createSlice({
     name: 'conversations',
     initialState: {
       items: [],
       activeId: null,
       loading: false
     },
     reducers: {/*...*/},
     extraReducers: (builder) => {
       builder
         .addCase(fetchConversations.pending, (state) => {
           state.loading = true;
         })
         .addCase(fetchConversations.fulfilled, (state, action) => {
           state.loading = false;
           state.items = action.payload;
         });
     }
   });
   ```

3. **Persistent State**: Supabase subscriptions for real-time sync
   ```javascript
   // In a React hook
   useEffect(() => {
     const subscription = supabase
       .from('conversations')
       .on('*', payload => {
         // Update Redux store
         dispatch(updateConversation(payload.new));
       })
       .subscribe();
     
     return () => {
       supabase.removeSubscription(subscription);
     };
   }, [dispatch]);
   ```

### 2. Advanced LLM Classification & Routing

#### Current Design Approach

The UI may treat all AI interactions uniformly, while the backend implements sophisticated routing between different LLM providers.

#### Integration Solution

Create a transparent routing system that shields frontend from complexity:

1. **Frontend Query Interface**:
   ```javascript
   // Single query interface regardless of LLM provider
   const sendQuery = async (message) => {
     setLoading(true);
     try {
       const response = await api.post('/api/v1/query', {
         content: message,
         conversation_id: activeConversation,
         context: {
           previous_messages: recentMessages,
           user_preferences: preferences
         }
       });
       return response.data;
     } finally {
       setLoading(false);
     }
   };
   ```

2. **Backend Classification Service**:
   ```javascript
   // backend/services/classification.js
   class QueryClassifier {
     constructor() {
       // Initialize lightweight classification model
       this.model = new ClassificationModel({
         categories: ['CODING', 'RESEARCH', 'CREATIVE', 'TECHNICAL']
       });
       
       // Provider mapping
       this.providerMap = {
         'CODING': 'CLAUDE',
         'RESEARCH': 'PERPLEXITY',
         'CREATIVE': 'OPENAI',
         'TECHNICAL': 'DEEPSEEK'
       };
     }
     
     async classify(query, context = {}) {
       // Extract features from query
       const features = this.extractFeatures(query);
       
       // Apply pre-classification rules
       const ruleBasedCategory = this.applyRules(query);
       if (ruleBasedCategory) {
         return this.providerMap[ruleBasedCategory];
       }
       
       // Use model for classification
       const prediction = await this.model.predict(features);
       const category = prediction.category;
       
       // Apply fallback logic if confidence is low
       if (prediction.confidence < 0.7) {
         return this.determineFallback(category, context);
       }
       
       return this.providerMap[category];
     }
     
     // Helper methods
     extractFeatures(query) {/*...*/}
     applyRules(query) {/*...*/}
     determineFallback(category, context) {/*...*/}
   }
   ```

3. **Streaming Response Handler**:
   ```javascript
   // backend/api/routes/query.js
   router.post('/', async (req, res) => {
     const { content, conversation_id, context } = req.body;
     const userId = req.user.id;
     
     // Enable streaming for supported clients
     const supportsStreaming = 
       req.headers['accept'] === 'text/event-stream';
     
     if (supportsStreaming) {
       // Set headers for streaming
       res.setHeader('Content-Type', 'text/event-stream');
       res.setHeader('Cache-Control', 'no-cache');
       res.setHeader('Connection', 'keep-alive');
       
       // Start processing asynchronously
       (async () => {
         try {
           // Classify query and get provider
           const provider = await classifier.classify(content, context);
           
           // Send provider info to client
           res.write(`data: ${JSON.stringify({ 
             event: 'provider_selected', 
             provider 
           })}\n\n`);
           
           // Stream response from LLM
           const stream = await llmService.streamQuery(
             content, 
             provider, 
             context
           );
           
           stream.on('data', (chunk) => {
             res.write(`data: ${JSON.stringify({ 
               event: 'chunk', 
               content: chunk.toString() 
             })}\n\n`);
           });
           
           stream.on('end', () => {
             res.write(`data: ${JSON.stringify({ 
               event: 'end' 
             })}\n\n`);
             res.end();
           });
           
           stream.on('error', (error) => {
             res.write(`data: ${JSON.stringify({ 
               event: 'error', 
               error: error.message 
             })}\n\n`);
             res.end();
           });
         } catch (error) {
           res.write(`data: ${JSON.stringify({ 
             event: 'error', 
             error: error.message 
           })}\n\n`);
           res.end();
         }
       })();
     } else {
       // Handle non-streaming clients
       try {
         const provider = await classifier.classify(content, context);
         const response = await llmService.query(
           content, 
           provider, 
           context
         );
         res.json(response);
       } catch (error) {
         res.status(500).json({ error: error.message });
       }
     }
   });
   ```

### 3. Two-Tier Automation System Integration

#### Current Design Approach

The UI may not distinguish between the two types of automations described in your architecture.

#### Integration Solution

Implement a unified frontend that handles both types through different flows:

1. **Detection Service** for Home Tab automations:
   ```javascript
   // backend/services/automation-detection.js
   class AutomationDetectionService {
     constructor() {
       this.patterns = [
         {
           type: 'message_scheduling',
           regex: /(?:schedule|send)\s+(?:a\s+)?(?:message|msg|text)\s+(?:to|for)\s+([a-zA-Z]+)\s+(?:at|on|tomorrow|in)\s+(.+?)(?:\s+saying\s+)(.+)/i,
           extractParams: (matches) => ({
             recipient: matches[1],
             time: matches[2],
             content: matches[3]
           }),
           service: 'messaging'
         },
         // Additional patterns
       ];
     }
     
     detectAutomation(message) {
       for (const pattern of this.patterns) {
         const matches = message.match(pattern.regex);
         if (matches) {
           return {
             type: pattern.type,
             params: pattern.extractParams(matches),
             service: pattern.service
           };
         }
       }
       
       return null;
     }
     
     // Advanced NLP-based detection for complex cases
     async detectWithNLP(message) {
       // Implement more sophisticated detection using NLP
     }
   }
   ```

2. **Unified Automation Management**:
   ```javascript
   // src/store/automations.js
   import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
   import api from '../services/api';
   
   // Action for Home Tab (instant) automation
   export const executeInstantAutomation = createAsyncThunk(
     'automations/executeInstant',
     async ({ type, params }, { rejectWithValue }) => {
       try {
         const response = await api.post('/api/v1/automations/execute', {
           type,
           params
         });
         return response.data;
       } catch (error) {
         return rejectWithValue(error.response?.data || error.message);
       }
     }
   );
   
   // Action for Library Tab (configured) automation
   export const createConfiguredAutomation = createAsyncThunk(
     'automations/createConfigured',
     async ({ name, trigger, action, params }, { rejectWithValue }) => {
       try {
         const response = await api.post('/api/v1/automations', {
           name,
           trigger,
           action,
           params
         });
         return response.data;
       } catch (error) {
         return rejectWithValue(error.response?.data || error.message);
       }
     }
   );
   
   const automationsSlice = createSlice({
     name: 'automations',
     initialState: {
       configured: [],
       instant: {
         recent: [],
         suggested: []
       },
       status: 'idle',
       error: null
     },
     reducers: {
       addSuggestion(state, action) {
         state.instant.suggested.push(action.payload);
       }
     },
     extraReducers: (builder) => {
       // Handle async thunk actions
     }
   });
   ```

3. **WorkflowBuilder Component** for Library Tab:
   ```javascript
   // src/components/automation/WorkflowBuilder.js
   import React, { useState } from 'react';
   import { useDispatch } from 'react-redux';
   import { createConfiguredAutomation } from '../../store/automations';
   
   const WorkflowBuilder = () => {
     const dispatch = useDispatch();
     const [workflow, setWorkflow] = useState({
       name: '',
       trigger: { type: '', config: {} },
       action: { type: '', config: {} },
       enabled: true
     });
     
     const handleTriggerSelection = (triggerType) => {
       setWorkflow({
         ...workflow,
         trigger: { type: triggerType, config: {} }
       });
     };
     
     const handleActionSelection = (actionType) => {
       setWorkflow({
         ...workflow,
         action: { type: actionType, config: {} }
       });
     };
     
     const handleSubmit = (e) => {
       e.preventDefault();
       dispatch(createConfiguredAutomation(workflow));
     };
     
     return (
       <div className="workflow-builder">
         <h2>Create Automation</h2>
         <form onSubmit={handleSubmit}>
           {/* Name input */}
           <div className="form-group">
             <label>Automation Name</label>
             <input
               type="text"
               value={workflow.name}
               onChange={(e) => setWorkflow({
                 ...workflow,
                 name: e.target.value
               })}
               required
             />
           </div>
           
           {/* Trigger selection */}
           <div className="form-group">
             <label>When this happens...</label>
             <TriggerSelector
               onSelect={handleTriggerSelection}
               selected={workflow.trigger.type}
             />
             
             {workflow.trigger.type && (
               <TriggerConfig
                 type={workflow.trigger.type}
                 config={workflow.trigger.config}
                 onChange={(config) => setWorkflow({
                   ...workflow,
                   trigger: {
                     ...workflow.trigger,
                     config
                   }
                 })}
               />
             )}
           </div>
           
           {/* Action selection */}
           <div className="form-group">
             <label>Do this...</label>
             <ActionSelector
               onSelect={handleActionSelection}
               selected={workflow.action.type}
             />
             
             {workflow.action.type && (
               <ActionConfig
                 type={workflow.action.type}
                 config={workflow.action.config}
                 onChange={(config) => setWorkflow({
                   ...workflow,
                   action: {
                     ...workflow.action,
                     config
                   }
                 })}
               />
             )}
           </div>
           
           {/* Enable/disable toggle */}
           <div className="form-group">
             <label>
               <input
                 type="checkbox"
                 checked={workflow.enabled}
                 onChange={(e) => setWorkflow({
                   ...workflow,
                   enabled: e.target.checked
                 })}
               />
               Enable this automation
             </label>
           </div>
           
           <button type="submit">Create Automation</button>
         </form>
       </div>
     );
   };
   
   export default WorkflowBuilder;
   ```

### 4. Service Integration Architecture

#### Current Design Approach

The UI may have a simplified view of service connections, while the backend needs to handle complex OAuth flows and token management.

#### Integration Solution

Create a secure, unified service connection layer:

1. **ConnectionManager Component**:
   ```javascript
   // src/components/integrations/ConnectionManager.js
   import React, { useState, useEffect } from 'react';
   import { useSelector, useDispatch } from 'react-redux';
   import { fetchIntegrations, connectService, disconnectService } from '../../store/integrations';
   import OAuthButton from './OAuthButton';
   
   const ConnectionManager = () => {
     const dispatch = useDispatch();
     const { services, loading } = useSelector(state => state.integrations);
     
     useEffect(() => {
       dispatch(fetchIntegrations());
     }, [dispatch]);
     
     const handleConnect = (serviceName) => {
       dispatch(connectService(serviceName));
     };
     
     const handleDisconnect = (serviceName) => {
       dispatch(disconnectService(serviceName));
     };
     
     // Group services by category
     const categories = services.reduce((acc, service) => {
       const { category } = service;
       if (!acc[category]) {
         acc[category] = [];
       }
       acc[category].push(service);
       return acc;
     }, {});
     
     return (
       <div className="connection-manager">
         <h2>Connected Services</h2>
         
         {loading ? (
           <div className="loading">Loading services...</div>
         ) : (
           Object.entries(categories).map(([category, services]) => (
             <div key={category} className="service-category">
               <h3>{category}</h3>
               
               <div className="service-list">
                 {services.map(service => (
                   <div key={service.id} className="service-item">
                     <div className="service-info">
                       <img 
                         src={service.icon} 
                         alt={service.name} 
                         className="service-icon" 
                       />
                       <span className="service-name">{service.name}</span>
                     </div>
                     
                     <div className="service-status">
                       {service.connected ? (
                         <>
                           <span className="connected-label">Connected</span>
                           <button 
                             onClick={() => handleDisconnect(service.name)}
                             className="disconnect-button"
                           >
                             Disconnect
                           </button>
                         </>
                       ) : (
                         <OAuthButton
                           service={service.name}
                           label={service.name}
                           icon={service.icon}
                           onSuccess={() => {/* Handle success */}}
                         />
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           ))
         )}
       </div>
     );
   };
   
   export default ConnectionManager;
   ```

2. **OAuth Flow Service**:
   ```javascript
   // backend/services/oauth.js
   const crypto = require('crypto');
   const { createClient } = require('@supabase/supabase-js');
   
   class OAuthService {
     constructor() {
       this.supabase = createClient(
         process.env.SUPABASE_URL,
         process.env.SUPABASE_SERVICE_KEY
       );
       
       // Service configurations
       this.services = {
         'gmail': {
           authUrl: 'https://accounts.google.com/o/oauth2/auth',
           tokenUrl: 'https://oauth2.googleapis.com/token',
           clientId: process.env.GOOGLE_CLIENT_ID,
           clientSecret: process.env.GOOGLE_CLIENT_SECRET,
           scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
           redirectUri: `${process.env.API_URL}/api/v1/integrations/gmail/callback`
         },
         // Additional service configurations
       };
     }
     
     async generateAuthUrl(serviceName, userId) {
       const service = this.services[serviceName];
       if (!service) {
         throw new Error(`Service ${serviceName} not configured`);
       }
       
       // Generate and store state parameter to prevent CSRF
       const state = crypto.randomBytes(16).toString('hex');
       
       // Store state in database with expiration
       await this.supabase
         .from('oauth_states')
         .insert({
           state,
           user_id: userId,
           service: serviceName,
           expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
         });
       
       // Construct authorization URL
       const authUrl = new URL(service.authUrl);
       authUrl.searchParams.append('client_id', service.clientId);
       authUrl.searchParams.append('redirect_uri', service.redirectUri);
       authUrl.searchParams.append('scope', service.scopes.join(' '));
       authUrl.searchParams.append('response_type', 'code');
       authUrl.searchParams.append('state', state);
       authUrl.searchParams.append('access_type', 'offline');
       authUrl.searchParams.append('prompt', 'consent');
       
       return authUrl.toString();
     }
     
     async handleCallback(serviceName, code, state) {
       // Verify state parameter
       const { data: stateData, error: stateError } = await this.supabase
         .from('oauth_states')
         .select('user_id')
         .eq('state', state)
         .gt('expires_at', new Date())
         .single();
       
       if (stateError || !stateData) {
         throw new Error('Invalid or expired state parameter');
       }
       
       const userId = stateData.user_id;
       
       // Exchange code for tokens
       const service = this.services[serviceName];
       const tokenResponse = await fetch(service.tokenUrl, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/x-www-form-urlencoded'
         },
         body: new URLSearchParams({
           code,
           client_id: service.clientId,
           client_secret: service.clientSecret,
           redirect_uri: service.redirectUri,
           grant_type: 'authorization_code'
         })
       });
       
       const tokens = await tokenResponse.json();
       
       if (tokens.error) {
         throw new Error(`Token exchange error: ${tokens.error}`);
       }
       
       // Store tokens in database (encrypted)
       await this.supabase
         .from('integrations')
         .upsert({
           user_id: userId,
           service_name: serviceName,
           service_category: this.getServiceCategory(serviceName),
           credentials: {
             access_token: tokens.access_token,
             refresh_token: tokens.refresh_token,
             expires_at: Date.now() + tokens.expires_in * 1000
           },
           connected_at: new Date()
         }, {
           onConflict: 'user_id,service_name'
         });
       
       // Clean up state
       await this.supabase
         .from('oauth_states')
         .delete()
         .eq('state', state);
       
       return { userId, serviceName };
     }
     
     async refreshToken(userId, serviceName) {
       // Implementation for token refresh logic
     }
     
     getServiceCategory(serviceName) {
       const categoryMap = {
         'gmail': 'Communication',
         'whatsapp': 'Communication',
         'doordash': 'Food',
         'uber': 'Transportation',
         // Additional mappings
       };
       
       return categoryMap[serviceName] || 'Other';
     }
   }
   
   module.exports = new OAuthService();
   ```

### 5. Enhanced Social Experience Integration

#### Current Design Approach

The Social tab may be treated as a simple content feed, while the backend architecture describes a more sophisticated community platform.

#### Integration Solution

Create a rich social experience with template sharing:

1. **Social Feed Component**:
   ```javascript
   // src/components/social/ContentFeed.js
   import React, { useState, useEffect } from 'react';
   import { useSelector, useDispatch } from 'react-redux';
   import { fetchPosts, upvotePost, fetchMorePosts } from '../../store/social';
   import PostCard from './PostCard';
   import Spinner from '../common/Spinner';
   
   const ContentFeed = () => {
     const dispatch = useDispatch();
     const { posts, loading, hasMore, filters } = useSelector(state => state.social);
     const [page, setPage] = useState(1);
     
     useEffect(() => {
       dispatch(fetchPosts({ page: 1, filters }));
       setPage(1);
     }, [dispatch, filters]);
     
     const handleLoadMore = () => {
       const nextPage = page + 1;
       dispatch(fetchMorePosts({ page: nextPage, filters }));
       setPage(nextPage);
     };
     
     const handleUpvote = (postId) => {
       dispatch(upvotePost(postId));
     };
     
     if (loading && page === 1) {
       return <Spinner />;
     }
     
     return (
       <div className="content-feed">
         {posts.map(post => (
           <PostCard
             key={post.id}
             post={post}
             onUpvote={() => handleUpvote(post.id)}
           />
         ))}
         
         {hasMore && (
           <div className="load-more">
             <button 
               onClick={handleLoadMore}
               disabled={loading}
             >
               {loading ? 'Loading...' : 'Load More'}
             </button>
           </div>
         )}
         
         {posts.length === 0 && !loading && (
           <div className="empty-state">
             <h3>No posts found</h3>
             <p>Try adjusting your filters or be the first to share!</p>
           </div>
         )}
       </div>
     );
   };
   
   export default ContentFeed;
   ```

2. **Template Sharing**:
   ```javascript
   // src/components/social/ShareTemplate.js
   import React, { useState } from 'react';
   import { useDispatch, useSelector } from 'react-redux';
   import { shareTemplate } from '../../store/social';
   
   const ShareTemplate = ({ automation, onClose }) => {
     const dispatch = useDispatch();
     const [title, setTitle] = useState(automation.name);
     const [description, setDescription] = useState('');
     const [tags, setTags] = useState([]);
     const [isPublic, setIsPublic] = useState(true);
     const [submitting, setSubmitting] = useState(false);
     
     const handleSubmit = async (e) => {
       e.preventDefault();
       setSubmitting(true);
       
       try {
         await dispatch(shareTemplate({
           automationId: automation.id,
           title,
           description,
           tags,
           isPublic
         })).unwrap();
         
         onClose();
       } catch (error) {
         // Handle error
         console.error('Error sharing template:', error);
       } finally {
         setSubmitting(false);
       }
     };
     
     const handleTagInput = (e) => {
       if (e.key === 'Enter' && e.target.value) {
         e.preventDefault();
         const newTag = e.target.value.trim();
         if (newTag && !tags.includes(newTag)) {
           setTags([...tags, newTag]);
           e.target.value = '';
         }
       }
     };
     
     const removeTag = (tag) => {
       setTags(tags.filter(t => t !== tag));
     };
     
     return (
       <div className="share-template-modal">
         <h2>Share Automation Template</h2>
         
         <form onSubmit={handleSubmit}>
           <div className="form-group">
             <label htmlFor="template-title">Title</label>
             <input
               id="template-title"
               type="text"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               required
             />
           </div>
           
           <div className="form-group">
             <label htmlFor="template-description">Description</label>
             <textarea
               id="template-description"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               rows={4}
             />
           </div>
           
           <div className="form-group">
             <label htmlFor="template-tags">Tags</label>
             <div className="tags-input">
               {tags.map(tag => (
                 <span key={tag} className="tag">
                   {tag}
                   <button 
                     type="button" 
                     onClick={() => removeTag(tag)}
                     className="remove-tag"
                   >
                     &times;
                   </button>
                 </span>
               ))}
               <input
                 type="text"
                 onKeyDown={handleTagInput}
                 placeholder="Add tag and press Enter"
               />
             </div>
           </div>
           
           <div className="form-group">
             <label>
               <input
                 type="checkbox"
                 checked={isPublic}
                 onChange={(e) => setIsPublic(e.target.checked)}
               />
               Share publicly with the community
             </label>
           </div>
           
           <div className="form-actions">
             <button 
               type="button" 
               onClick={onClose}
               disabled={submitting}
             >
               Cancel
             </button>
             <button 
               type="submit"
               disabled={submitting}
               className="primary"
             >
               {submitting ? 'Sharing...' : 'Share Template'}
             </button>
           </div>
         </form>
       </div>
     );
   };
   
   export default ShareTemplate;
   ```

### 6. Cross-Device Synchronization

#### Current Design Approach

The UI may not account for multi-device usage, while the backend architecture emphasizes seamless transitions.

#### Integration Solution

Implement robust state synchronization:

1. **Supabase Realtime Channel Setup**:
   ```javascript
   // src/services/sync.js
   import { supabase } from '../lib/supabase';
   import store from '../store';
   import { updateConversation, addMessage } from '../store/conversations';
   import { updateAutomation, updateAutomationExecution } from '../store/automations';
   import { addNotification } from '../store/notifications';
   
   class SyncService {
     constructor() {
       this.subscriptions = [];
       this.userId = null;
     }
     
     init(userId) {
       if (this.userId === userId) return;
       
       // Clean up existing subscriptions
       this.cleanup();
       
       this.userId = userId;
       
       // Set up realtime subscriptions
       this.subscribeToConversations();
       this.subscribeToMessages();
       this.subscribeToAutomations();
       this.subscribeToNotifications();
     }
     
     subscribeToConversations() {
       const subscription = supabase
         .from(`conversations:user_id=eq.${this.userId}`)
         .on('*', payload => {
           const { eventType, new: newRecord, old: oldRecord } = payload;
           
           switch (eventType) {
             case 'INSERT':
               store.dispatch(updateConversation(newRecord));
               break;
             case 'UPDATE':
               store.dispatch(updateConversation(newRecord));
               break;
             case 'DELETE':
               // Handle conversation deletion
               break;
           }
         })
         .subscribe();
       
       this.subscriptions.push(subscription);
     }
     
     subscribeToMessages() {
       // Similar implementation for messages
     }
     
     subscribeToAutomations() {
       // Similar implementation for automations
     }
     
     subscribeToNotifications() {
       // Similar implementation for notifications
     }
     
     handleStateChange(payload) {
       // Update local state based on server changes
     }
     
     cleanup() {
       this.subscriptions.forEach(subscription => {
         supabase.removeSubscription(subscription);
       });
       
       this.subscriptions = [];
       this.userId = null;
     }
   }
   
   export default new SyncService();
   ```

2. **Session Handoff Component**:
   ```javascript
   // src/components/sync/DeviceHandoff.js
   import React, { useEffect, useState } from 'react';
   import { useSelector } from 'react-redux';
   import { supabase } from '../../lib/supabase';
   
   const DeviceHandoff = () => {
     const { user } = useSelector(state => state.auth);
     const [activeSessions, setActiveSessions] = useState([]);
     const [handoffRequests, setHandoffRequests] = useState([]);
     
     useEffect(() => {
       if (!user) return;
       
       // Register current device
       const registerDevice = async () => {
         const deviceId = localStorage.getItem('device_id') || generateDeviceId();
         localStorage.setItem('device_id', deviceId);
         
         await supabase
           .from('active_sessions')
           .upsert({
             user_id: user.id,
             device_id: deviceId,
             device_name: getDeviceName(),
             last_active: new Date(),
             is_current: true
           }, {
             onConflict: 'user_id,device_id'
           });
       };
       
       registerDevice();
       
       // Subscribe to active sessions
       const sessionsSubscription = supabase
         .from(`active_sessions:user_id=eq.${user.id}`)
         .on('*', handleSessionUpdates)
         .subscribe();
       
       // Subscribe to handoff requests
       const handoffSubscription = supabase
         .from(`session_handoffs:user_id=eq.${user.id}`)
         .on('*', handleHandoffUpdates)
         .subscribe();
       
       return () => {
         supabase.removeSubscription(sessionsSubscription);
         supabase.removeSubscription(handoffSubscription);
       };
     }, [user]);
     
     const handleSessionUpdates = (payload) => {
       // Update active sessions list
     };
     
     const handleHandoffUpdates = (payload) => {
       // Update handoff requests
     };
     
     const initiateHandoff = async (targetDeviceId) => {
       const currentDeviceId = localStorage.getItem('device_id');
       const { conversation_id } = getCurrentState();
       
       await supabase
         .from('session_handoffs')
         .insert({
           user_id: user.id,
           source_device_id: currentDeviceId,
           target_device_id: targetDeviceId,
           state: { conversation_id },
           created_at: new Date()
         });
     };
     
     const acceptHandoff = async (handoffId) => {
       // Accept incoming handoff and apply state
     };
     
     // Helper functions
     const generateDeviceId = () => {/*...*/};
     const getDeviceName = () => {/*...*/};
     const getCurrentState = () => {/*...*/};
     
     return (
       <div className="device-handoff">
         {handoffRequests.length > 0 && (
           <div className="handoff-requests">
             <h3>Continue from another device</h3>
             {handoffRequests.map(request => (
               <div key={request.id} className="handoff-request">
                 <p>Continue from {request.source_device_name}</p>
                 <button onClick={() => acceptHandoff(request.id)}>
                   Accept
                 </button>
                 <button className="secondary">
                   Decline
                 </button>
               </div>
             ))}
           </div>
         )}
         
         {activeSessions.length > 1 && (
           <div className="active-devices">
             <h3>Your Active Devices</h3>
             {activeSessions
               .filter(session => !session.is_current)
               .map(session => (
                 <div key={session.device_id} className="device">
                   <span>{session.device_name}</span>
                   <button onClick={() => initiateHandoff(session.device_id)}>
                     Continue there
                   </button>
                 </div>
               ))}
           </div>
         )}
       </div>
     );
   };
   
   export default DeviceHandoff;
   ```

## Debugging and Testing Strategies

### 1. API Integration Testing

Create a comprehensive test suite for API integration:

```javascript
// tests/api-integration.test.js
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../backend/api');

describe('API Integration Tests', () => {
  let supabase;
  let authToken;
  let userId;
  
  beforeAll(async () => {
    // Set up test environment
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Create test user
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    });
    
    userId = data.user.id;
    authToken = data.session.access_token;
  });
  
  describe('Conversation API', () => {
    test('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test Conversation' });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Conversation');
    });
    
    test('should list user conversations', async () => {
      const response = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
    
    // Additional tests
  });
  
  describe('Query Router', () => {
    test('should classify and route a query', async () => {
      const response = await request(app)
        .post('/api/v1/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Write a Python function to calculate Fibonacci numbers',
          conversation_id: null
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('provider');
      expect(response.body.provider).toBe('CLAUDE'); // Should route coding to Claude
    });
    
    // Additional tests
  });
  
  // More test suites
});
```

### 2. Frontend-Backend Integration Debugging Tools

Create a debugging toolkit for troubleshooting integration issues:

```javascript
// src/utils/debug.js
class DebugTools {
  constructor() {
    this.enabled = process.env.NODE_ENV === 'development';
    this.logLevel = localStorage.getItem('debug_level') || 'info';
    this.logs = [];
  }
  
  log(level, component, message, data) {
    if (!this.enabled) return;
    
    const logLevels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = logLevels.indexOf(this.logLevel);
    const messageLevelIndex = logLevels.indexOf(level);
    
    if (messageLevelIndex > currentLevelIndex) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      component,
      message,
      data
    };
    
    this.logs.push(logEntry);
    
    // Keep log size manageable
    if (this.logs.length > 1000) {
      this.logs.shift();
    }
    
    // Console output with styling
    const styles = {
      error: 'background: #ff5252; color: white; padding: 2px 4px;',
      warn: 'background: #ffab40; color: black; padding: 2px 4px;',
      info: 'background: #2196f3; color: white; padding: 2px 4px;',
      debug: 'background: #4caf50; color: white; padding: 2px 4px;'
    };
    
    console.log(
      `%c${level.toUpperCase()}%c [${timestamp}] %c${component}%c: ${message}`,
      styles[level],
      '',
      'font-weight: bold;',
      'font-weight: normal;',
      data
    );
  }
  
  error(component, message, data) {
    this.log('error', component, message, data);
  }
  
  warn(component, message, data) {
    this.log('warn', component, message, data);
  }
  
  info(component, message, data) {
    this.log('info', component, message, data);
  }
  
  debug(component, message, data) {
    this.log('debug', component, message, data);
  }
  
  startApiCall(endpoint, payload) {
    if (!this.enabled) return null;
    
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    this.debug('API', `Request started: ${endpoint}`, {
      requestId,
      endpoint,
      payload
    });
    
    return {
      requestId,
      startTime,
      endpoint,
      complete: (response, error) => {
        const duration = performance.now() - startTime;
        
        if (error) {
          this.error('API', `Request failed: ${endpoint}`, {
            requestId,
            endpoint,
            duration,
            error
          });
        } else {
          this.debug('API', `Request completed: ${endpoint}`, {
            requestId,
            endpoint,
            duration,
            response
          });
        }
      }
    };
  }
  
  getLogs() {
    return [...this.logs];
  }
  
  setLogLevel(level) {
    if (['error', 'warn', 'info', 'debug'].includes(level)) {
      this.logLevel = level;
      localStorage.setItem('debug_level', level);
    }
  }
  
  // Developer UI component for viewing logs
  renderDebugPanel() {
    if (!this.enabled) return null;
    
    // Implementation of a debug panel component
  }
}

export const debugTools = new DebugTools();

// API interceptor
export const apiInterceptor = (api) => {
  // Wrap fetch or axios to log all API calls
  const originalFetch = api.fetch;
  
  api.fetch = async (url, options) => {
    const debug = debugTools.startApiCall(url, options.body);
    
    try {
      const response = await originalFetch(url, options);
      debug?.complete(response);
      return response;
    } catch (error) {
      debug?.complete(null, error);
      throw error;
    }
  };
  
  return api;
};
```

### 3. Monitoring and Alerts

Implement a comprehensive monitoring system:

```javascript
// backend/monitoring/index.js
const AWS = require('aws-sdk');
const Redis = require('ioredis');

// Initialize CloudWatch
const cloudwatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION
});

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL);

class MonitoringService {
  constructor() {
    this.namespace = 'Conatus';
    this.defaultDimensions = [
      {
        Name: 'Environment',
        Value: process.env.NODE_ENV
      }
    ];
  }
  
  async recordMetric(name, value, unit = 'Count', dimensions = []) {
    try {
      await cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: name,
            Dimensions: [...this.defaultDimensions, ...dimensions],
            Value: value,
            Unit: unit,
            Timestamp: new Date()
          }
        ]
      }).promise();
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }
  
  async trackLLMUsage(provider, tokens, success) {
    // Record usage metrics
    await this.recordMetric('LLMTokensUsed', tokens, 'Count', [
      { Name: 'Provider', Value: provider }
    ]);
    
    if (!success) {
      await this.recordMetric('LLMErrors', 1, 'Count', [
        { Name: 'Provider', Value: provider }
      ]);
    }
    
    // Update daily usage counters in Redis
    const date = new Date().toISOString().split('T')[0];
    const key = `metrics:llm:${date}:${provider}`;
    
    await redis.hincrby(key, 'tokens', tokens);
    await redis.hincrby(key, 'requests', 1);
    
    if (!success) {
      await redis.hincrby(key, 'errors', 1);
    }
    
    // Set expiration for Redis keys (keep for 30 days)
    await redis.expire(key, 60 * 60 * 24 * 30);
  }
  
  async trackAPIUsage(endpoint, latency, statusCode) {
    // Record API metrics
    await this.recordMetric('APILatency', latency, 'Milliseconds', [
      { Name: 'Endpoint', Value: endpoint }
    ]);
    
    await this.recordMetric('APIRequests', 1, 'Count', [
      { Name: 'Endpoint', Value: endpoint },
      { Name: 'StatusCode', Value: statusCode.toString() }
    ]);
    
    // Update API usage counters in Redis
    const date = new Date().toISOString().split('T')[0];
    const key = `metrics:api:${date}:${endpoint}`;
    
    await redis.hincrby(key, 'requests', 1);
    await redis.hincrby(key, `status_${statusCode}`, 1);
    await redis.hincrbyfloat(key, 'total_latency', latency);
    
    // Set expiration for Redis keys (keep for 30 days)
    await redis.expire(key, 60 * 60 * 24 * 30);
  }
  
  async trackAutomationExecution(automationType, success, duration) {
    // Record automation metrics
    await this.recordMetric('AutomationExecutions', 1, 'Count', [
      { Name: 'Type', Value: automationType },
      { Name: 'Success', Value: success ? 'True' : 'False' }
    ]);
    
    if (duration) {
      await this.recordMetric('AutomationDuration', duration, 'Milliseconds', [
        { Name: 'Type', Value: automationType }
      ]);
    }
    
    // Update automation counters in Redis
    const date = new Date().toISOString().split('T')[0];
    const key = `metrics:automation:${date}:${automationType}`;
    
    await redis.hincrby(key, 'executions', 1);
    await redis.hincrby(key, success ? 'successes' : 'failures', 1);
    
    if (duration) {
      await redis.hincrbyfloat(key, 'total_duration', duration);
    }
    
    // Set expiration for Redis keys (keep for 30 days)
    await redis.expire(key, 60 * 60 * 24 * 30);
  }
  
  async getMetricsSummary(timeframe = 'day') {
    // Implementation to return metrics summary
  }
  
  async checkSystemHealth() {
    // Implementation to check system health
  }
}

module.exports = new MonitoringService();
```

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)

1. **Set up infrastructure**
   - Supabase project and database schema
   - AWS Lambda and API Gateway configuration
   - Redis cluster setup

2. **Core backend services**
   - Authentication and user management
   - Basic conversation handling
   - Initial LLM integration (start with one provider)

3. **Basic frontend shell**
   - Tab navigation structure
   - Authentication screens
   - Chat interface prototype

### Phase 2: Core Functionality (Weeks 3-4)

1. **Complete LLM classification system**
   - Implement all LLM providers
   - Build query routing logic
   - Add streaming support

2. **Home Tab automation**
   - Implement intent detection
   - Create first service connectors (Gmail, WhatsApp)
   - Build automation confirmation UI

3. **State synchronization**
   - Implement Supabase Realtime subscriptions
   - Set up cross-device state management
   - Create offline support

### Phase 3: Library Tab and Integrations (Weeks 5-6)

1. **Workflow builder**
   - Create visual automation builder
   - Implement trigger-action system
   - Build execution monitoring

2. **Service integrations**
   - Implement OAuth flows for all services
   - Create unified connection management
   - Build token refresh and security

3. **Context awareness**
   - Implement time-based triggers
   - Add location awareness (if opted in)
   - Create pattern recognition system

### Phase 4: Social Experience (Weeks 7-8)

1. **Content feed**
   - Implement post creation and display
   - Build upvoting system
   - Create comment functionality

2. **Template sharing**
   - Implement automation template export/import
   - Create showcase functionality
   - Build discovery system

3. **Community engagement**
   - Implement personalized recommendations
   - Create trending content display
   - Build engagement metrics

### Phase 5: Optimization and Polish (Weeks 9-10)

1. **Performance optimization**
   - Implement tiered caching strategy
   - Optimize bundle size and loading times
   - Create lazy loading for non-critical components

2. **Monitoring and debugging**
   - Set up comprehensive logging
   - Create monitoring dashboards
   - Implement alert system

3. **Mobile optimization**
   - Enhance responsive design
   - Optimize touch interactions
   - Improve offline capabilities
