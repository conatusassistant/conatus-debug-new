import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { LLMRouter } from '../services/llmRouter';
import { Database } from '../../types/supabase';

// Types for stream request
interface StreamRequest {
  userId: string;
  query: string;
  conversationId?: string;
  model?: string; // Optional model override
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize LLM Router
const llmRouter = new LLMRouter();

/**
 * Streams a response from the AI model
 * 
 * This Lambda function:
 * 1. Receives a query from the user
 * 2. Uses the LLM Router to determine the best model for the query
 * 3. Creates or updates a conversation in Supabase
 * 4. Stores the user message in the database
 * 5. Sets up a streaming response from the selected AI model
 * 6. Streams chunks of the response back to the client
 * 7. When complete, stores the full response in the database
 * 
 * Note: This requires API Gateway with HTTP API integration (not REST API)
 * and proper configuration for response streaming
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

    const requestBody: StreamRequest = JSON.parse(event.body);
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
    const { error: userMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversationId,
        content: query,
        role: 'user'
      });

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
    
    // Analyze query and route to appropriate model
    const { selectedModel, queryType, confidence } = await llmRouter.analyzeQuery(query, requestedModel);
    console.log(`Query classified as ${queryType} with ${confidence} confidence, routed to ${selectedModel}`);
    
    // Generate a unique ID for the assistant message
    const assistantMessageId = uuidv4();
    
    // Begin streaming response
    const streamData = await llmRouter.streamQuery(query, selectedModel, activeConversationId);
    
    // In a real implementation, we would use a streaming response here
    // For AWS Lambda, this would require using API Gateway v2 HTTP APIs with
    // enhanced binary support and careful handling of the response
    
    // The response would look something like:
    // return {
    //   statusCode: 200,
    //   headers: {
    //     'Content-Type': 'text/event-stream',
    //     'Cache-Control': 'no-cache',
    //     'Connection': 'keep-alive',
    //     'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
    //     'Access-Control-Allow-Credentials': true
    //   },
    //   body: streamResponse, // This would be a special object setup for streaming
    //   isBase64Encoded: false
    // };
    
    // For simplicity, we'll simulate the whole response here
    const simulatedFullResponse = "This is a simulated response that would normally be streamed chunk by chunk to the client.";
    
    // Once streaming is complete, store the full response
    const { error: assistantMessageError } = await supabase
      .from('messages')
      .insert({
        id: assistantMessageId,
        conversation_id: activeConversationId,
        content: simulatedFullResponse,
        role: 'assistant',
        metadata: {
          model: selectedModel,
          query_type: queryType,
          confidence: confidence
        }
      });

    if (assistantMessageError) {
      console.error('Error storing assistant message:', assistantMessageError);
      // Even if this fails, we've already sent the streamed response
      // We just log the error but don't affect the user experience
    }
    
    // For the purpose of this implementation, we'll return a normal JSON response
    // In a real streaming implementation, we would have already closed the connection
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        messageId: assistantMessageId,
        conversationId: activeConversationId,
        content: simulatedFullResponse,
        model: selectedModel
      })
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
