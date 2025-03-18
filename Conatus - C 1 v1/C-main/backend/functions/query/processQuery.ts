import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { LLMRouter } from '../services/llmRouter';
import { Database } from '../../types/supabase';

// Types for query request
interface QueryRequest {
  userId: string;
  query: string;
  conversationId?: string;
  model?: string; // Optional model override
}

// Types for query response
interface QueryResponse {
  messageId: string;
  conversationId: string;
  content: string;
  model: string;
  error?: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize LLM Router
const llmRouter = new LLMRouter();

/**
 * Process a query from the user
 * 
 * This Lambda function:
 * 1. Receives a query from the user
 * 2. Uses the LLM Router to determine the best model for the query
 * 3. Creates or updates a conversation in Supabase
 * 4. Stores the user message in the database
 * 5. Gets a response from the selected AI model
 * 6. Stores the AI response in the database
 * 7. Returns the response to the user
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const requestBody: QueryRequest = JSON.parse(event.body);
    const { userId, query, conversationId, model: requestedModel } = requestBody;

    if (!userId || !query) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ error: 'Missing required fields: userId, query' })
      };
    }

    // Initialize Supabase client
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Create a transaction to ensure data consistency
    let activeConversationId = conversationId;
    let conversationTitle = '';
    let userMessageId = '';

    // If no conversationId provided, create a new conversation
    if (!activeConversationId) {
      // Generate a title from the query (first few words)
      conversationTitle = query.split(' ').slice(0, 5).join(' ') + '...';
      
      // Create new conversation
      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: conversationTitle
        })
        .select('id')
        .single();

      if (conversationError) {
        console.error('Error creating conversation:', conversationError);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
            'Access-Control-Allow-Credentials': true
          },
          body: JSON.stringify({ error: 'Failed to create conversation' })
        };
      }

      activeConversationId = newConversation.id;
    }

    // Store user message
    const { data: userMessage, error: userMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversationId,
        content: query,
        role: 'user'
      })
      .select('id')
      .single();

    if (userMessageError) {
      console.error('Error storing user message:', userMessageError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ error: 'Failed to store user message' })
      };
    }

    userMessageId = userMessage.id;
    
    // Analyze query and route to appropriate model
    const { selectedModel, queryType, confidence } = await llmRouter.analyzeQuery(query, requestedModel);
    console.log(`Query classified as ${queryType} with ${confidence} confidence, routed to ${selectedModel}`);
    
    // Process query with selected model
    const { content, error: llmError } = await llmRouter.processQuery(query, selectedModel, activeConversationId);
    
    if (llmError) {
      console.error('Error processing query with LLM:', llmError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ error: 'Failed to process query' })
      };
    }
    
    // Generate a unique ID for the assistant message
    const assistantMessageId = uuidv4();
    
    // Store assistant response
    const { error: assistantMessageError } = await supabase
      .from('messages')
      .insert({
        id: assistantMessageId,
        conversation_id: activeConversationId,
        content: content,
        role: 'assistant',
        metadata: {
          model: selectedModel,
          query_type: queryType,
          confidence: confidence
        }
      });

    if (assistantMessageError) {
      console.error('Error storing assistant message:', assistantMessageError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ error: 'Failed to store assistant message' })
      };
    }
    
    // Prepare and return response
    const response: QueryResponse = {
      messageId: assistantMessageId,
      conversationId: activeConversationId,
      content: content,
      model: selectedModel
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
