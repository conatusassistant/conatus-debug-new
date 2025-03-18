// backend/api/routes/query-router.js
/**
 * Query Router API Endpoints
 * 
 * Handles routing of user queries to appropriate LLM providers
 * and manages both streaming and non-streaming responses.
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Import services
const ClassificationService = require('../../services/classification/ClassificationService');
const LLMService = require('../../services/llm/LLMService');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * @route POST /api/v1/query
 * @description Process a user query and route to the appropriate LLM
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const { query, conversation_id, provider, context = {} } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Valid query is required' });
    }
    
    // Add user ID to context
    const enrichedContext = {
      ...context,
      userId
    };
    
    // If conversation_id is provided, fetch conversation history
    if (conversation_id) {
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: true })
          .limit(10); // Limit to last 10 messages for context
        
        if (!error && messages) {
          enrichedContext.history = messages;
        }
      } catch (historyError) {
        console.error('Error fetching conversation history:', historyError);
        // Continue without history rather than failing the request
      }
    }
    
    // Process the query with the LLM service
    const response = await LLMService.routeQuery(query, provider, enrichedContext);
    
    // Save the query and response to the database
    try {
      // First, ensure conversation exists or create it
      let conversationId = conversation_id;
      
      if (!conversationId) {
        // Create a new conversation
        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            title: query.substring(0, 100), // Use the beginning of the query as the title
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (convError) {
          console.error('Error creating conversation:', convError);
        } else {
          conversationId = newConversation.id;
        }
      }
      
      if (conversationId) {
        // Save user query
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: query,
          created_at: new Date().toISOString()
        });
        
        // Save assistant response
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: response.content,
          created_at: new Date().toISOString(),
          llm_provider: response.provider,
          tokens_used: response.tokenUsage?.total_tokens || 0,
          metadata: {
            model: response.model,
            fromCache: response.fromCache || false,
            references: response.references || []
          }
        });
        
        // Update conversation timestamp
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
        
        // Add conversation_id to the response
        response.conversation_id = conversationId;
      }
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      // Continue rather than failing the request
    }
    
    // Return the response to the client
    res.json(response);
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({ error: 'Error processing query', message: error.message });
  }
});

/**
 * @route POST /api/v1/query/stream
 * @description Stream a user query response from the appropriate LLM
 * @access Private
 */
router.post('/stream', async (req, res) => {
  const { query, conversation_id, provider, context = {} } = req.body;
  const userId = req.user.id;
  
  // Validate input
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Valid query is required' });
  }
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Helper function to send SSE data
  const sendEvent = (eventType, data) => {
    res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`);
  };
  
  // Add user ID to context
  const enrichedContext = {
    ...context,
    userId
  };
  
  // Variables to store full response for saving to DB
  let fullContent = '';
  let responseProvider = '';
  let responseModel = '';
  let tokenUsage = null;
  
  try {
    // If conversation_id is provided, fetch conversation history
    if (conversation_id) {
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: true })
          .limit(10); // Limit to last 10 messages for context
        
        if (!error && messages) {
          enrichedContext.history = messages;
        }
      } catch (historyError) {
        console.error('Error fetching conversation history:', historyError);
        // Continue without history rather than failing the request
      }
    }
    
    // First, classify the query to get the provider
    const selectedProvider = provider || await ClassificationService.classifyQuery(query, enrichedContext);
    responseProvider = selectedProvider;
    
    // Send provider information to the client
    sendEvent('provider', { provider: selectedProvider });
    
    // Create a stream for the response
    const stream = await LLMService.streamQuery(query, selectedProvider, enrichedContext);
    
    // Set up event handlers
    stream.on('data', (chunk) => {
      try {
        const data = JSON.parse(chunk.toString());
        
        if (data.type === 'content') {
          // Send content chunk to client
          sendEvent('content', { content: data.content });
          fullContent += data.content;
        } else if (data.type === 'provider') {
          // Update provider if it changed
          responseProvider = data.provider;
          sendEvent('provider', { provider: data.provider });
        } else if (data.type === 'fallback') {
          // Provider fallback occurred
          sendEvent('fallback', { 
            original: data.original, 
            fallback: data.fallback 
          });
          responseProvider = data.fallback;
        } else if (data.type === 'end') {
          // End of stream, with token usage
          tokenUsage = data.tokenUsage;
          sendEvent('end', { tokenUsage });
        } else if (data.type === 'error') {
          // Error in stream
          sendEvent('error', { error: data.error });
        }
      } catch (e) {
        console.error('Error handling stream chunk:', e);
      }
    });
    
    // Handle stream end
    stream.on('end', async () => {
      try {
        // Save the query and response to the database
        let conversationId = conversation_id;
        
        if (!conversationId) {
          // Create a new conversation
          const { data: newConversation, error: convError } = await supabase
            .from('conversations')
            .insert({
              user_id: userId,
              title: query.substring(0, 100), // Use the beginning of the query as the title
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (convError) {
            console.error('Error creating conversation:', convError);
          } else {
            conversationId = newConversation.id;
            sendEvent('conversation', { id: conversationId });
          }
        }
        
        if (conversationId) {
          // Save user query
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: query,
            created_at: new Date().toISOString()
          });
          
          // Save assistant response
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullContent,
            created_at: new Date().toISOString(),
            llm_provider: responseProvider,
            tokens_used: tokenUsage?.total_tokens || 0,
            metadata: {
              model: responseModel,
              fromCache: false,
              streaming: true
            }
          });
          
          // Update conversation timestamp
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }
      } catch (dbError) {
        console.error('Error saving streamed response to database:', dbError);
      }
      
      // End the response
      res.end();
    });
    
    // Handle errors
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      sendEvent('error', { error: error.message });
      res.end();
    });
    
    // Handle client disconnect
    req.on('close', () => {
      stream.destroy();
    });
  } catch (error) {
    console.error('Error processing streaming query:', error);
    sendEvent('error', { error: error.message });
    res.end();
  }
});

/**
 * @route POST /api/v1/query/classify
 * @description Classify a query without executing it
 * @access Private
 */
router.post('/classify', async (req, res) => {
  try {
    const { query, context = {} } = req.body;
    
    // Validate input
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Valid query is required' });
    }
    
    // Add user ID to context
    const enrichedContext = {
      ...context,
      userId: req.user.id
    };
    
    // Classify the query
    const provider = await ClassificationService.classifyQuery(query, enrichedContext);
    
    // Get provider details
    const providerDetails = ClassificationService.getProviderConfig(provider);
    
    res.json({
      provider,
      providerName: providerDetails.name,
      bestFor: providerDetails.bestFor,
      query
    });
  } catch (error) {
    console.error('Error classifying query:', error);
    res.status(500).json({ error: 'Error classifying query', message: error.message });
  }
});

/**
 * @route GET /api/v1/query/providers
 * @description Get information about available LLM providers
 * @access Private
 */
router.get('/providers', async (req, res) => {
  try {
    // Get provider information from the classification service
    const providerInfo = Object.entries(ClassificationService.providers).map(([id, details]) => ({
      id,
      name: details.name,
      bestFor: details.bestFor
    }));
    
    res.json(providerInfo);
  } catch (error) {
    console.error('Error fetching provider information:', error);
    res.status(500).json({ error: 'Error fetching provider information', message: error.message });
  }
});

/**
 * @route GET /api/v1/query/history/:conversationId
 * @description Get messages from a conversation
 * @access Private
 */
router.get('/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    // Verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
    
    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, content, created_at, llm_provider, tokens_used, metadata')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (msgError) {
      return res.status(500).json({ error: 'Error fetching messages', message: msgError.message });
    }
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({ error: 'Error fetching conversation history', message: error.message });
  }
});

module.exports = router;
