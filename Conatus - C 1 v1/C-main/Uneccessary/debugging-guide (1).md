# Conatus: Integration Debugging Guide

This guide provides strategies for debugging common integration issues between the frontend and backend components of the Conatus platform.

## Common Integration Issues and Solutions

### 1. Authentication Flow Problems

#### Issue: Token invalidation or refresh failures

**Symptoms:**
- Sudden 401 errors
- Users being unexpectedly logged out
- Requests failing after period of inactivity

**Debugging Steps:**
1. Check token expiration handling in API connector
2. Verify Supabase JWT configuration
3. Examine token refresh logic

**Solution Example:**
```javascript
// Enhanced token refresh handling
const executeWithFreshToken = async (apiCall) => {
  try {
    return await apiCall();
  } catch (error) {
    if (error.status === 401) {
      // Token expired, attempt refresh
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        // Refresh failed, redirect to login
        throw new Error('Authentication expired, please log in again');
      }
      
      // Retry original call with fresh token
      return await apiCall();
    }
    throw error;
  }
};
```

### 2. LLM Response Streaming Issues

#### Issue: Streaming responses rendering incorrectly

**Symptoms:**
- Text appears out of order
- Duplicate chunks appearing
- Stream never completes

**Debugging Steps:**
1. Check event stream parsing logic
2. Verify client-side chunk handling
3. Examine server-side stream generation

**Solution Example:**
```javascript
// Improved stream handling
const streamElements = document.getElementById('stream-container');
let buffer = '';

const streamQuery = async (query) => {
  try {
    const response = await fetch('/api/v1/query/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Process text by line boundaries
      buffer += decoder.decode(value, { stream: true });
      
      // Split on double newline which separates SSE events
      const events = buffer.split('\n\n');
      
      // The last element might be incomplete, keep it in the buffer
      buffer = events.pop() || '';
      
      // Process complete events
      for (const eventStr of events) {
        if (eventStr.trim() === '') continue;
        
        const dataMatch = /^data: (.+)$/m.exec(eventStr);
        if (dataMatch && dataMatch[1]) {
          try {
            const eventData = JSON.parse(dataMatch[1]);
            handleStreamChunk(eventData);
          } catch (e) {
            console.error('Error parsing event data:', e);
          }
        }
      }
    }
    
    // Handle any remaining buffer
    if (buffer.trim() !== '') {
      const dataMatch = /^data: (.+)$/m.exec(buffer);
      if (dataMatch && dataMatch[1]) {
        try {
          const eventData = JSON.parse(dataMatch[1]);
          handleStreamChunk(eventData);
        } catch (e) {
          console.error('Error parsing final event data:', e);
        }
      }
    }
    
  } catch (error) {
    console.error('Stream error:', error);
    streamElements.innerHTML += `<div class="error">Error: ${error.message}</div>`;
  }
};
```

### 3. State Synchronization Conflicts

#### Issue: Race conditions in multi-device sync

**Symptoms:**
- Data appearing to revert unexpectedly
- Duplicate items appearing
- Different state on different devices

**Debugging Steps:**
1. Enable verbose logging of realtime events
2. Check timestamp-based conflict resolution
3. Verify Redux store updates from realtime events

**Solution Example:**
```javascript
// State synchronization with conflict resolution
const handleRealtimeUpdate = (payload) => {
  const { new: newRecord, old: oldRecord, eventType } = payload;
  
  // Log full payload in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Realtime update:', eventType, payload);
  }
  
  switch (eventType) {
    case 'INSERT':
      // Check if we already have this record locally (might have created it)
      const existingItem = store.getState().conversations.items
        .find(item => item.id === newRecord.id);
      
      if (!existingItem) {
        // New remote item, add to store
        store.dispatch(addConversation(newRecord));
      }
      break;
      
    case 'UPDATE':
      // Check if our local version is newer than the remote update
      const localItem = store.getState().conversations.items
        .find(item => item.id === newRecord.id);
      
      if (localItem) {
        const localUpdatedAt = new Date(localItem.updated_at).getTime();
        const remoteUpdatedAt = new Date(newRecord.updated_at).getTime();
        
        if (remoteUpdatedAt >= localUpdatedAt) {
          // Remote is newer or same age, update local
          store.dispatch(updateConversation(newRecord));
        } else {
          // Local is newer, re-push our changes
          console.log('Local data newer than remote update, pushing local version');
          saveConversation(localItem);
        }
      } else {
        // We don't have this item locally, add it
        store.dispatch(addConversation(newRecord));
      }
      break;
      
    // Handle other event types...
  }
};
```

### 4. OAuth Integration Failures

#### Issue: OAuth flow not completing correctly

**Symptoms:**
- OAuth popup closing without completion
- Redirect errors
- Authentication state not updating after OAuth

**Debugging Steps:**
1. Check OAuth configuration (redirect URIs, scopes)
2. Examine CORS settings
3. Verify OAuth state parameter handling

**Solution Example:**
```javascript
// Enhanced OAuth flow with better error handling
const initiateOAuth = (service) => {
  return new Promise((resolve, reject) => {
    // Generate random state for CSRF protection
    const state = generateRandomState();
    
    // Store state in sessionStorage for verification
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_service', service);
    
    // Track when the flow started for timeout detection
    sessionStorage.setItem('oauth_start', Date.now().toString());
    
    // Create popup window
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    
    const popup = window.open(
      `/api/v1/integrations/${service}/auth?state=${state}`,
      `Connect ${service}`,
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Check if popup was blocked
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      reject(new Error('Popup blocked by browser. Please allow popups for this site.'));
      return;
    }
    
    // Check for timeout
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('OAuth flow timed out. Please try again.'));
    }, 120000); // 2 minute timeout
    
    // Handle messages from popup
    const messageHandler = (event) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_SUCCESS') {
        // Verify state matches to prevent CSRF
        if (event.data.state !== sessionStorage.getItem('oauth_state')) {
          reject(new Error('OAuth state mismatch. Please try again.'));
          return;
        }
        
        clearTimeout(timeoutId);
        window.removeEventListener('message', messageHandler);
        resolve(event.data.result);
      } else if (event.data.type === 'OAUTH_ERROR') {
        clearTimeout(timeoutId);
        window.removeEventListener('message', messageHandler);
        reject(new Error(event.data.error || 'OAuth flow failed'));
      }
    };
    
    window.addEventListener('message', messageHandler);
  });
};
```

### 5. Automation Execution Failures

#### Issue: Automations not triggering correctly

**Symptoms:**
- Actions not executing when conditions met
- Missing or incorrect parameters
- Permissions errors during execution

**Debugging Steps:**
1. Enable detailed logging for automation execution
2. Check service connection status and permissions
3. Verify parameter extraction from natural language

**Solution Example:**
```javascript
// Enhanced automation execution with detailed logging
const executeAutomation = async (automation) => {
  try {
    // Log automation execution attempt
    console.log('Executing automation:', automation.id, automation.type);
    
    // Check if required service is connected
    const serviceStatus = await checkServiceStatus(automation.service);
    if (!serviceStatus.connected) {
      throw new Error(`Service ${automation.service} not connected`);
    }
    
    // Validate parameters
    const validationResult = validateParameters(automation.params, automation.type);
    if (!validationResult.valid) {
      throw new Error(`Invalid parameters: ${validationResult.errors.join(', ')}`);
    }
    
    // Log parameters after validation
    console.log('Validated parameters:', automation.params);
    
    // Execute the automation
    const result = await api.post('/api/v1/automations/execute', {
      type: automation.type,
      params: automation.params,
      service: automation.service
    });
    
    // Log successful execution
    console.log('Automation executed successfully:', result.data);
    return result.data;
  } catch (error) {
    // Enhanced error logging
    console.error('Automation execution failed:', {
      automation: {
        id: automation.id,
        type: automation.type,
        service: automation.service
      },
      error: {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      }
    });
    
    throw error;
  }
};
```

## Advanced Debugging Techniques

### 1. API Request/Response Logger

Create a middleware to log all API interactions:

```javascript
// api-logger.js
const createApiLogger = (api) => {
  const originalFetch = api.fetch;
  
  api.fetch = async (url, options = {}) => {
    const startTime = performance.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    // Log request
    console.group(`API Request: ${requestId}`);
    console.log('URL:', url);
    console.log('Method:', options.method || 'GET');
    console.log('Headers:', options.headers);
    
    if (options.body) {
      try {
        console.log('Body:', JSON.parse(options.body));
      } catch (e) {
        console.log('Body:', options.body);
      }
    }
    
    try {
      // Make the request
      const response = await originalFetch(url, options);
      
      // Clone the response so we can read the body
      const clonedResponse = response.clone();
      
      // Log response
      console.log('Status:', response.status);
      console.log('StatusText:', response.statusText);
      console.log('Headers:', Object.fromEntries([...response.headers.entries()]));
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await clonedResponse.json();
          console.log('Response Body:', data);
        } else {
          const text = await clonedResponse.text();
          console.log('Response Body:', text);
        }
      } catch (e) {
        console.log('Could not parse response body');
      }
      
      const endTime = performance.now();
      console.log('Duration:', `${(endTime - startTime).toFixed(2)}ms`);
      console.groupEnd();
      
      return response;
    } catch (error) {
      // Log error
      console.log('Error:', error);
      console.log('Duration:', `${(performance.now() - startTime).toFixed(2)}ms`);
      console.groupEnd();
      
      throw error;
    }
  };
  
  return api;
};

export default createApiLogger;
```

### 2. State Diffing for Redux

Track exactly what changed in the Redux store:

```javascript
// redux-logger.js
const createReduxLogger = (store) => {
  const originalDispatch = store.dispatch;
  
  store.dispatch = (action) => {
    console.group(`Action: ${action.type}`);
    console.log('Action:', action);
    
    const prevState = store.getState();
    console.log('Previous State:', prevState);
    
    const result = originalDispatch(action);
    
    const nextState = store.getState();
    console.log('Next State:', nextState);
    
    // Calculate what changed
    const changes = {};
    Object.keys(nextState).forEach(key => {
      if (prevState[key] !== nextState[key]) {
        changes[key] = {
          from: prevState[key],
          to: nextState[key]
        };
      }
    });
    
    console.log('Changes:', changes);
    console.groupEnd();
    
    return result;
  };
  
  return store;
};

export default createReduxLogger;
```

### 3. Realtime Event Monitor

Create a debugger specifically for Supabase Realtime events:

```javascript
// realtime-monitor.js
const createRealtimeMonitor = (supabase) => {
  const originalSubscribe = supabase.channel;
  
  supabase.channel = (name, options) => {
    const channel = originalSubscribe(name, options);
    
    const originalOn = channel.on;
    channel.on = (event, callback) => {
      return originalOn(event, (payload) => {
        console.group(`Realtime Event: ${name} - ${event}`);
        console.log('Payload:', payload);
        console.groupEnd();
        
        return callback(payload);
      });
    };
    
    return channel;
  };
  
  return supabase;
};

export default createRealtimeMonitor;
```

### 4. Automation Execution Tracer

Create detailed execution traces for automation workflows:

```javascript
// automation-tracer.js
class AutomationTracer {
  constructor() {
    this.traces = {};
  }
  
  startTrace(automationId) {
    const traceId = `${automationId}_${Date.now()}`;
    this.traces[traceId] = {
      automationId,
      startTime: Date.now(),
      steps: [],
      status: 'running'
    };
    
    console.log(`Starting automation trace: ${traceId}`);
    return traceId;
  }
  
  addStep(traceId, step) {
    if (!this.traces[traceId]) {
      console.warn(`Trace ${traceId} not found`);
      return;
    }
    
    const timestamp = Date.now();
    const elapsed = timestamp - this.traces[traceId].startTime;
    
    this.traces[traceId].steps.push({
      ...step,
      timestamp,
      elapsed
    });
    
    console.log(`Automation trace ${traceId} step:`, {
      ...step, 
      elapsed: `${elapsed}ms`
    });
  }
  
  endTrace(traceId, status, result) {
    if (!this.traces[traceId]) {
      console.warn(`Trace ${traceId} not found`);
      return;
    }
    
    const timestamp = Date.now();
    const duration = timestamp - this.traces[traceId].startTime;
    
    this.traces[traceId].endTime = timestamp;
    this.traces[traceId].duration = duration;
    this.traces[traceId].status = status;
    this.traces[traceId].result = result;
    
    console.log(`Automation trace ${traceId} completed:`, {
      status,
      duration: `${duration}ms`,
      result
    });
    
    // Save trace to localStorage for later analysis
    this.saveTrace(traceId);
    
    return this.traces[traceId];
  }
  
  saveTrace(traceId) {
    try {
      const traces = JSON.parse(localStorage.getItem('automation_traces') || '[]');
      traces.push(this.traces[traceId]);
      
      // Keep only the last 50 traces
      while (traces.length > 50) {
        traces.shift();
      }
      
      localStorage.setItem('automation_traces', JSON.stringify(traces));
    } catch (e) {
      console.error('Error saving automation trace:', e);
    }
  }
  
  getTraces() {
    try {
      return JSON.parse(localStorage.getItem('automation_traces') || '[]');
    } catch (e) {
      console.error('Error loading automation traces:', e);
      return [];
    }
  }
  
  renderTraceUI() {
    // Implementation for a trace viewer UI component
  }
}

export default new AutomationTracer();
```

## Integration Test Scripts

### 1. End-to-End Authentication Flow Test

```javascript
// test-auth-flow.js
const testAuthFlow = async () => {
  console.group('Authentication Flow Test');
  
  try {
    // Step 1: Sign Out
    console.log('1. Signing out');
    await supabase.auth.signOut();
    console.log('✓ Signed out successfully');
    
    // Step 2: Sign Up
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'Test@123456';
    
    console.log('2. Signing up with:', testEmail);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    
    if (signUpError) throw signUpError;
    console.log('✓ Signed up successfully', signUpData.user.id);
    
    // Step 3: Sign Out again
    console.log('3. Signing out');
    await supabase.auth.signOut();
    console.log('✓ Signed out successfully');
    
    // Step 4: Sign In
    console.log('4. Signing in');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError) throw signInError;
    console.log('✓ Signed in successfully');
    
    // Step 5: Get Session
    console.log('5. Getting session');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) throw sessionError;
    console.log('✓ Session retrieved successfully');
    
    // Step 6: Get User
    console.log('6. Getting user');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    console.log('✓ User retrieved successfully', userData.user.email);
    
    // Step 7: Test Protected API
    console.log('7. Testing protected API');
    const response = await fetch('/api/v1/user/profile', {
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`
      }
    });
    
    if (!response.ok) throw new Error(`Protected API failed: ${response.status}`);
    const profileData = await response.json();
    console.log('✓ Protected API access successful', profileData);
    
    console.log('✅ Authentication Flow Test PASSED');
  } catch (error) {
    console.error('❌ Authentication Flow Test FAILED', error);
  }
  
  console.groupEnd();
};
```

### 2. LLM Query Integration Test

```javascript
// test-llm-query.js
const testLLMQuery = async () => {
  console.group('LLM Query Integration Test');
  
  try {
    // Step 1: Get valid auth token
    console.log('1. Getting auth token');
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) throw new Error('No active session');
    const token = session.session.access_token;
    console.log('✓ Got valid token');
    
    // Step 2: Test simple query (should route to OpenAI)
    console.log('2. Testing simple query (OpenAI)');
    const simpleQuery = 'Write a short poem about technology';
    
    const simpleResponse = await fetch('/api/v1/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query: simpleQuery })
    });
    
    if (!simpleResponse.ok) {
      throw new Error(`Simple query failed: ${simpleResponse.status}`);
    }
    
    const simpleResult = await simpleResponse.json();
    console.log('✓ Simple query succeeded', {
      provider: simpleResult.provider,
      responsePreview: simpleResult.content.substring(0, 100) + '...'
    });
    
    // Step 3: Test coding query (should route to Claude)
    console.log('3. Testing coding query (Claude)');
    const codingQuery = 'Write a Python function to find the fibonacci sequence';
    
    const codingResponse = await fetch('/api/v1/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query: codingQuery })
    });
    
    if (!codingResponse.ok) {
      throw new Error(`Coding query failed: ${codingResponse.status}`);
    }
    
    const codingResult = await codingResponse.json();
    console.log('✓ Coding query succeeded', {
      provider: codingResult.provider,
      responsePreview: codingResult.content.substring(0, 100) + '...'
    });
    
    // Step 4: Test search query (should route to Perplexity)
    console.log('4. Testing search query (Perplexity)');
    const searchQuery = 'Find information about the latest SpaceX launch';
    
    const searchResponse = await fetch('/api/v1/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query: searchQuery })
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Search query failed: ${searchResponse.status}`);
    }
    
    const searchResult = await searchResponse.json();
    console.log('✓ Search query succeeded', {
      provider: searchResult.provider,
      responsePreview: searchResult.content.substring(0, 100) + '...'
    });
    
    // Step 5: Test streaming query
    console.log('5. Testing streaming query');
    
    const streamingQuery = 'Explain quantum computing in simple terms';
    let streamingComplete = false;
    let chunks = [];
    
    // Simulate streaming response handling
    await new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `/api/v1/query/stream?token=${encodeURIComponent(token)}&query=${encodeURIComponent(streamingQuery)}`
      );
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          chunks.push(data);
          console.log(`Received chunk ${chunks.length}:`, data.content.substring(0, 20) + '...');
        } catch (e) {
          console.error('Error parsing event data:', e);
        }
      };
      
      eventSource.onerror = (error) => {
        eventSource.close();
        if (!streamingComplete) {
          reject(new Error('Streaming query failed'));
        }
      };
      
      eventSource.addEventListener('complete', () => {
        streamingComplete = true;
        eventSource.close();
        resolve();
      });
      
      // Set timeout for test
      setTimeout(() => {
        eventSource.close();
        if (!streamingComplete) {
          reject(new Error('Streaming query timed out'));
        }
      }, 30000);
    });
    
    console.log(`✓ Streaming query succeeded with ${chunks.length} chunks`);
    
    console.log('✅ LLM Query Integration Test PASSED');
  } catch (error) {
    console.error('❌ LLM Query Integration Test FAILED', error);
  }
  
  console.groupEnd();
};
```

## Troubleshooting Checklist

### Frontend-Backend Connection Issues

- [ ] Check CORS configuration in API Gateway
- [ ] Verify API URLs match between environments
- [ ] Confirm authentication tokens are being properly sent
- [ ] Test API endpoints directly with Postman/curl
- [ ] Check for network errors in browser console
- [ ] Verify SSL certificate validity

### State Synchronization Problems

- [ ] Enable Supabase realtime logging
- [ ] Check for duplicate subscription handlers
- [ ] Verify Supabase RLS policies
- [ ] Test for race conditions with concurrent updates
- [ ] Check Redux store update logic
- [ ] Verify localStorage/sessionStorage usage

### Authentication Failures

- [ ] Check token expiration and refresh logic
- [ ] Verify Supabase project configuration
- [ ] Test sign in/sign out flow manually
- [ ] Check for cookie settings issues (SameSite, Secure, etc.)
- [ ] Verify CORS headers for authentication endpoints
- [ ] Test with multiple browsers and private windows

### Automation Execution Issues

- [ ] Check service connection status
- [ ] Verify OAuth token validity and permissions
- [ ] Test automation manually via API endpoints
- [ ] Check for parameter validation errors
- [ ] Verify Make.com scenario configuration (if used)
- [ ] Test with simplified automation first

### Performance Optimization

- [ ] Implement selective subscription to Supabase tables
- [ ] Add Redis caching for frequent queries
- [ ] Use pagination for large data sets
- [ ] Implement lazy loading for components
- [ ] Add debounce for user input events
- [ ] Optimize bundle size with code splitting
