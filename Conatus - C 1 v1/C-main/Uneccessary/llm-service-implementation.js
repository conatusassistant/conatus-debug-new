// backend/services/llm/LLMService.js
/**
 * LLM Service
 * 
 * Handles routing queries to appropriate LLM providers and manages responses.
 * Implements the multi-LLM strategy described in the Conatus architecture.
 */

const fetch = require('node-fetch');
const { Readable } = require('stream');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');

// Import the ClassificationService
const ClassificationService = require('../classification/ClassificationService');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class LLMService {
  constructor() {
    // Configure provider-specific clients and settings
    this.providers = {
      CLAUDE: {
        processQuery: this.processClaudeQuery.bind(this),
        streamQuery: this.streamClaudeQuery.bind(this),
        models: {
          default: 'claude-3-opus-20240229',
          fallback: 'claude-3-sonnet-20240229'
        }
      },
      PERPLEXITY: {
        processQuery: this.processPerplexityQuery.bind(this),
        streamQuery: this.streamPerplexityQuery.bind(this),
        models: {
          default: 'sonar-medium-online',
          fallback: 'sonar-small-online'
        }
      },
      OPENAI: {
        processQuery: this.processOpenAIQuery.bind(this),
        streamQuery: this.streamOpenAIQuery.bind(this),
        models: {
          default: 'gpt-4-turbo',
          fallback: 'gpt-3.5-turbo'
        }
      },
      DEEPSEEK: {
        processQuery: this.processDeepSeekQuery.bind(this),
        streamQuery: this.streamDeepSeekQuery.bind(this),
        models: {
          default: 'deepseek-coder',
          fallback: 'deepseek-chat'
        }
      }
    };
  }

  /**
   * Route a query to the appropriate LLM provider
   * @param {string} query - User's query text
   * @param {string} providerId - Provider identifier (if already classified)
   * @param {Object} context - Additional context for the query
   * @returns {Promise<Object>} - LLM response
   */
  async routeQuery(query, providerId = null, context = {}) {
    try {
      // Generate a unique ID for this query
      const queryId = uuidv4();
      
      // Get the provider if not already specified
      const provider = providerId || await ClassificationService.classifyQuery(query, context);
      
      // Check if we can use cache
      if (context.allowCache !== false) {
        const cachedResponse = await this.checkCache(query, provider);
        if (cachedResponse) {
          // Log cache hit
          await this.logQueryUsage(queryId, provider, query, cachedResponse, true);
          return {
            ...cachedResponse,
            provider,
            fromCache: true
          };
        }
      }
      
      // Check provider availability
      const isAvailable = await this.checkProviderAvailability(provider);
      
      // If provider is not available, fall back to a different one
      const actualProvider = isAvailable ? provider : this.getFallbackProvider(provider);
      
      // Get the appropriate processing function
      const processFn = this.providers[actualProvider].processQuery;
      
      if (!processFn) {
        throw new Error(`Provider ${actualProvider} not supported`);
      }
      
      // Process the query with the selected provider
      const startTime = Date.now();
      const response = await processFn(query, context);
      const endTime = Date.now();
      
      // Get token usage
      const tokenUsage = response.tokenUsage || this.estimateTokenUsage(query, response.content);
      
      // Log query for analytics
      await this.logQueryUsage(
        queryId, 
        actualProvider, 
        query, 
        response, 
        false,
        endTime - startTime,
        tokenUsage
      );
      
      // Cache the response if appropriate
      if (response.cacheable !== false && context.allowCache !== false) {
        await this.cacheResponse(query, actualProvider, response);
      }
      
      // Return the response with provider information
      return {
        ...response,
        provider: actualProvider,
        fromCache: false
      };
    } catch (error) {
      console.error('Error routing query:', error);
      
      // Use OpenAI as fallback for errors
      try {
        const fallbackResponse = await this.processOpenAIQuery(query, {
          ...context,
          isFallback: true
        });
        
        return {
          ...fallbackResponse,
          provider: 'OPENAI',
          fromCache: false,
          fallback: true,
          error: error.message
        };
      } catch (fallbackError) {
        // If even the fallback fails, return a graceful error
        return {
          content: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
          provider: 'ERROR',
          error: error.message
        };
      }
    }
  }

  /**
   * Stream a query response from the appropriate LLM provider
   * @param {string} query - User's query text
   * @param {string} providerId - Provider identifier (if already classified)
   * @param {Object} context - Additional context for the query
   * @returns {Promise<Readable>} - Stream of response chunks
   */
  async streamQuery(query, providerId = null, context = {}) {
    // Create a readable stream to return to the client
    const outputStream = new Readable({
      read() {} // Required but we push data manually
    });
    
    try {
      // Generate a unique ID for this query
      const queryId = uuidv4();
      
      // Get the provider if not already specified
      const provider = providerId || await ClassificationService.classifyQuery(query, context);
      
      // Send provider information as first chunk
      outputStream.push(JSON.stringify({
        type: 'provider',
        provider
      }));
      
      // Check provider availability
      const isAvailable = await this.checkProviderAvailability(provider);
      
      // If provider is not available, fall back to a different one
      const actualProvider = isAvailable ? provider : this.getFallbackProvider(provider);
      
      // If we had to fall back, inform the client
      if (actualProvider !== provider) {
        outputStream.push(JSON.stringify({
          type: 'fallback',
          original: provider,
          fallback: actualProvider
        }));
      }
      
      // Get the appropriate streaming function
      const streamFn = this.providers[actualProvider].streamQuery;
      
      if (!streamFn) {
        throw new Error(`Provider ${actualProvider} does not support streaming`);
      }
      
      // Start timing
      const startTime = Date.now();
      
      // Variables to track the full response and token usage
      let fullContent = '';
      let tokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      
      // Create a handler for content chunks
      const handleChunk = (chunk) => {
        outputStream.push(JSON.stringify({
          type: 'content',
          content: chunk
        }));
        
        fullContent += chunk;
      };
      
      // Stream the query with the selected provider
      await streamFn(query, handleChunk, context);
      
      // Calculate end time and estimate token usage
      const endTime = Date.now();
      if (!tokenUsage.total_tokens) {
        tokenUsage = this.estimateTokenUsage(query, fullContent);
      }
      
      // Log query for analytics
      await this.logQueryUsage(
        queryId, 
        actualProvider, 
        query, 
        { content: fullContent }, 
        false,
        endTime - startTime,
        tokenUsage
      );
      
      // Cache the complete response
      await this.cacheResponse(query, actualProvider, { 
        content: fullContent,
        tokenUsage
      });
      
      // Send end of stream marker
      outputStream.push(JSON.stringify({
        type: 'end',
        tokenUsage
      }));
      
      // End the stream
      outputStream.push(null);
    } catch (error) {
      console.error('Error streaming query:', error);
      
      // Send error information
      outputStream.push(JSON.stringify({
        type: 'error',
        error: error.message
      }));
      
      // End the stream
      outputStream.push(null);
    }
    
    return outputStream;
  }

  /**
   * Process a query using Claude (Anthropic)
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Claude response
   */
  async processClaudeQuery(query, context = {}) {
    try {
      const anthropicUrl = 'https://api.anthropic.com/v1/messages';
      const model = context.model || this.providers.CLAUDE.models.default;
      
      // Prepare conversation history if provided
      const messages = [];
      
      if (context.history && Array.isArray(context.history)) {
        // Map conversation history to Anthropic format
        for (const msg of context.history) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Prepare the request body
      const requestBody = {
        model,
        messages,
        max_tokens: context.maxTokens || 1024,
        temperature: context.temperature || 0.7
      };
      
      // Make the API request
      const response = await fetch(anthropicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        content: data.content[0].text,
        tokenUsage: {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens
        },
        model: data.model,
        cacheable: true
      };
    } catch (error) {
      console.error('Error with Claude API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.processClaudeQuery(query, {
          ...context,
          isFallback: true,
          model: this.providers.CLAUDE.models.fallback
        });
      }
      
      throw error;
    }
  }

  /**
   * Stream a query using Claude (Anthropic)
   * @param {string} query - User query
   * @param {function} onChunk - Callback for content chunks
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async streamClaudeQuery(query, onChunk, context = {}) {
    try {
      const anthropicUrl = 'https://api.anthropic.com/v1/messages';
      const model = context.model || this.providers.CLAUDE.models.default;
      
      // Prepare conversation history if provided
      const messages = [];
      
      if (context.history && Array.isArray(context.history)) {
        // Map conversation history to Anthropic format
        for (const msg of context.history) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Prepare the request body
      const requestBody = {
        model,
        messages,
        max_tokens: context.maxTokens || 1024,
        temperature: context.temperature || 0.7,
        stream: true
      };
      
      // Make the API request
      const response = await fetch(anthropicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API error: ${errorData || response.statusText}`);
      }
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              // End of stream
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta' && 
                  parsed.delta.type === 'text_delta') {
                // Send the text chunk to the callback
                onChunk(parsed.delta.text);
              }
            } catch (e) {
              console.error('Error parsing Claude stream:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error with Claude streaming API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.streamClaudeQuery(query, onChunk, {
          ...context,
          isFallback: true,
          model: this.providers.CLAUDE.models.fallback
        });
      }
      
      throw error;
    }
  }

  /**
   * Process a query using OpenAI
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - OpenAI response
   */
  async processOpenAIQuery(query, context = {}) {
    try {
      const model = context.model || this.providers.OPENAI.models.default;
      
      // Prepare messages array
      const messages = [];
      
      // Add system message if provided
      if (context.systemPrompt) {
        messages.push({
          role: 'system',
          content: context.systemPrompt
        });
      }
      
      // Add conversation history if provided
      if (context.history && Array.isArray(context.history)) {
        messages.push(...context.history);
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Call the OpenAI API
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: context.temperature || 0.7,
        max_tokens: context.maxTokens || 1024
      });
      
      return {
        content: completion.choices[0].message.content,
        tokenUsage: {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens
        },
        model: completion.model,
        cacheable: true
      };
    } catch (error) {
      console.error('Error with OpenAI API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.processOpenAIQuery(query, {
          ...context,
          isFallback: true,
          model: this.providers.OPENAI.models.fallback
        });
      }
      
      throw error;
    }
  }

  /**
   * Stream a query using OpenAI
   * @param {string} query - User query
   * @param {function} onChunk - Callback for content chunks
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async streamOpenAIQuery(query, onChunk, context = {}) {
    try {
      const model = context.model || this.providers.OPENAI.models.default;
      
      // Prepare messages array
      const messages = [];
      
      // Add system message if provided
      if (context.systemPrompt) {
        messages.push({
          role: 'system',
          content: context.systemPrompt
        });
      }
      
      // Add conversation history if provided
      if (context.history && Array.isArray(context.history)) {
        messages.push(...context.history);
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Call the OpenAI API with streaming
      const stream = await openai.chat.completions.create({
        model,
        messages,
        temperature: context.temperature || 0.7,
        max_tokens: context.maxTokens || 1024,
        stream: true
      });
      
      // Process the stream
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          onChunk(chunk.choices[0].delta.content);
        }
      }
    } catch (error) {
      console.error('Error with OpenAI streaming API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.streamOpenAIQuery(query, onChunk, {
          ...context,
          isFallback: true,
          model: this.providers.OPENAI.models.fallback
        });
      }
      
      throw error;
    }
  }

  /**
   * Process a query using Perplexity
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Perplexity response
   */
  async processPerplexityQuery(query, context = {}) {
    try {
      const perplexityUrl = 'https://api.perplexity.ai/chat/completions';
      const model = context.model || this.providers.PERPLEXITY.models.default;
      
      // Prepare messages array
      const messages = [];
      
      // Add system message if provided
      if (context.systemPrompt) {
        messages.push({
          role: 'system',
          content: context.systemPrompt || 'You are a helpful assistant that provides accurate and current information with sources when possible.'
        });
      }
      
      // Add conversation history if provided
      if (context.history && Array.isArray(context.history)) {
        messages.push(...context.history);
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Prepare the request body
      const requestBody = {
        model,
        messages,
        temperature: context.temperature || 0.7,
        max_tokens: context.maxTokens || 1024
      };
      
      // Make the API request
      const response = await fetch(perplexityUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Perplexity API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract references if available
      const references = [];
      try {
        // This is a simplified approach - actual reference extraction depends on Perplexity's format
        const content = data.choices[0].message.content;
        const referencesMatch = content.match(/Sources:\s*((?:.|\n)*?)(?:\n\n|$)/i);
        
        if (referencesMatch && referencesMatch[1]) {
          const referencesText = referencesMatch[1];
          const refMatches = referencesText.match(/\[(\d+)\]\s*(.+?)(?=\[\d+\]|$)/g);
          
          if (refMatches) {
            for (const refMatch of refMatches) {
              const parts = refMatch.match(/\[(\d+)\]\s*(.+)/);
              if (parts) {
                references.push({
                  number: parseInt(parts[1]),
                  text: parts[2].trim()
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Error extracting references:', e);
      }
      
      return {
        content: data.choices[0].message.content,
        tokenUsage: {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens
        },
        model: data.model,
        references,
        cacheable: false  // Don't cache search results as they may change
      };
    } catch (error) {
      console.error('Error with Perplexity API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.processPerplexityQuery(query, {
          ...context,
          isFallback: true,
          model: this.providers.PERPLEXITY.models.fallback
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Stream a query using Perplexity
   * @param {string} query - User query
   * @param {function} onChunk - Callback for content chunks
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async streamPerplexityQuery(query, onChunk, context = {}) {
    try {
      const perplexityUrl = 'https://api.perplexity.ai/chat/completions';
      const model = context.model || this.providers.PERPLEXITY.models.default;
      
      // Prepare messages array
      const messages = [];
      
      // Add system message if provided
      if (context.systemPrompt) {
        messages.push({
          role: 'system',
          content: context.systemPrompt || 'You are a helpful assistant that provides accurate and current information with sources when possible.'
        });
      }
      
      // Add conversation history if provided
      if (context.history && Array.isArray(context.history)) {
        messages.push(...context.history);
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Prepare the request body
      const requestBody = {
        model,
        messages,
        temperature: context.temperature || 0.7,
        max_tokens: context.maxTokens || 1024,
        stream: true
      };
      
      // Make the API request
      const response = await fetch(perplexityUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Perplexity API error: ${errorData || response.statusText}`);
      }
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              // End of stream
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.choices && 
                  parsed.choices[0].delta && 
                  parsed.choices[0].delta.content) {
                // Send the text chunk to the callback
                onChunk(parsed.choices[0].delta.content);
              }
            } catch (e) {
              console.error('Error parsing Perplexity stream:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error with Perplexity streaming API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.streamPerplexityQuery(query, onChunk, {
          ...context,
          isFallback: true,
          model: this.providers.PERPLEXITY.models.fallback
        });
      }
      
      throw error;
    }
  }

  /**
   * Process a query using DeepSeek
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - DeepSeek response
   */
  async processDeepSeekQuery(query, context = {}) {
    try {
      const deepseekUrl = 'https://api.deepseek.com/v1/chat/completions';
      const model = context.model || this.providers.DEEPSEEK.models.default;
      
      // Prepare messages array
      const messages = [];
      
      // Add system message if provided
      if (context.systemPrompt) {
        messages.push({
          role: 'system',
          content: context.systemPrompt
        });
      }
      
      // Add conversation history if provided
      if (context.history && Array.isArray(context.history)) {
        messages.push(...context.history);
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Prepare the request body
      const requestBody = {
        model,
        messages,
        temperature: context.temperature || 0.7,
        max_tokens: context.maxTokens || 1024
      };
      
      // Make the API request
      const response = await fetch(deepseekUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DeepSeek API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        tokenUsage: {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens
        },
        model: data.model,
        cacheable: true
      };
    } catch (error) {
      console.error('Error with DeepSeek API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.processDeepSeekQuery(query, {
          ...context,
          isFallback: true,
          model: this.providers.DEEPSEEK.models.fallback
        });
      }
      
      throw error;
    }
  }

  /**
   * Stream a query using DeepSeek
   * @param {string} query - User query
   * @param {function} onChunk - Callback for content chunks
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async streamDeepSeekQuery(query, onChunk, context = {}) {
    try {
      const deepseekUrl = 'https://api.deepseek.com/v1/chat/completions';
      const model = context.model || this.providers.DEEPSEEK.models.default;
      
      // Prepare messages array
      const messages = [];
      
      // Add system message if provided
      if (context.systemPrompt) {
        messages.push({
          role: 'system',
          content: context.systemPrompt
        });
      }
      
      // Add conversation history if provided
      if (context.history && Array.isArray(context.history)) {
        messages.push(...context.history);
      }
      
      // Add the current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Prepare the request body
      const requestBody = {
        model,
        messages,
        temperature: context.temperature || 0.7,
        max_tokens: context.maxTokens || 1024,
        stream: true
      };
      
      // Make the API request
      const response = await fetch(deepseekUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`DeepSeek API error: ${errorData || response.statusText}`);
      }
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              // End of stream
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.choices && 
                  parsed.choices[0].delta && 
                  parsed.choices[0].delta.content) {
                // Send the text chunk to the callback
                onChunk(parsed.choices[0].delta.content);
              }
            } catch (e) {
              console.error('Error parsing DeepSeek stream:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error with DeepSeek streaming API:', error);
      
      // Try fallback model if available
      if (!context.isFallback) {
        return this.streamDeepSeekQuery(query, onChunk, {
          ...context,
          isFallback: true,
          model: this.providers.DEEPSEEK.models.fallback
        });
      }
      
      throw error;
    }
  }

  /**
   * Check if a response is cached
   * @param {string} query - User query
   * @param {string} provider - Provider identifier
   * @returns {Promise<Object|null>} - Cached response or null
   */
  async checkCache(query, provider) {
    try {
      // Normalize the query
      const normalizedQuery = query.toLowerCase();
      
      // Generate a semantic hash for the query
      const queryHash = this.generateQueryHash(normalizedQuery, provider);
      
      // Check Redis cache
      const cachedResponse = await redis.get(`query_response:${queryHash}`);
      
      if (cachedResponse) {
        return JSON.parse(cachedResponse);
      }
      
      return null;
    } catch (error) {
      console.error('Error checking response cache:', error);
      return null;
    }
  }

  /**
   * Cache a query response
   * @param {string} query - User query
   * @param {string} provider - Provider identifier
   * @param {Object} response - Response to cache
   * @returns {Promise<void>}
   */
  async cacheResponse(query, provider, response) {
    try {
      // Normalize the query
      const normalizedQuery = query.toLowerCase();
      
      // Generate a semantic hash for the query
      const queryHash = this.generateQueryHash(normalizedQuery, provider);
      
      // Store in Redis with TTL based on provider
      // Search results get shorter TTL since they may change
      const ttl = provider === 'PERPLEXITY' ? 900 : 3600; // 15 min for search, 1 hour for others
      
      await redis.set(
        `query_response:${queryHash}`, 
        JSON.stringify(response), 
        'EX', 
        ttl
      );
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }

  /**
   * Generate a cache key hash for a query
   * @param {string} query - Normalized query
   * @param {string} provider - Provider identifier
   * @returns {string} - Cache key
   */
  generateQueryHash(query, provider) {
    // Extract key terms (simplified approach)
    const tokens = query.split(/\s+/)
      .filter(token => token.length > 3)  // Remove short tokens
      .map(token => token.toLowerCase())  // Normalize case
      .filter(token => !this.isStopWord(token)); // Remove stop words
    
    // Sort for consistency and join
    const sortedTokens = tokens.sort();
    return `${provider}:${sortedTokens.join('_')}`;
  }

  /**
   * Check if a token is a stop word
   * @param {string} token - Token to check
   * @returns {boolean} - True if stop word
   */
  isStopWord(token) {
    const stopWords = [
      'the', 'and', 'a', 'to', 'of', 'for', 'in', 'on', 'is', 'that', 
      'it', 'with', 'as', 'be', 'this', 'was', 'are', 'what', 'can', 
      'how', 'why', 'when', 'where', 'who', 'which', 'would', 'could',
      'should', 'did', 'have', 'has', 'had', 'not', 'but', 'than'
    ];
    
    return stopWords.includes(token);
  }

  /**
   * Check if a provider is available
   * @param {string} provider - Provider identifier
   * @returns {Promise<boolean>} - True if available
   */
  async checkProviderAvailability(provider) {
    try {
      // Check Redis for cached availability status
      const cacheKey = `provider_status:${provider}`;
      const cachedStatus = await redis.get(cacheKey);
      
      if (cachedStatus !== null) {
        return cachedStatus === 'available';
      }
      
      // If no cached status, assume available
      // In a production system, you might want to implement actual health checks here
      await redis.set(cacheKey, 'available', 'EX', 60); // Cache for 1 minute
      return true;
    } catch (error) {
      console.error(`Error checking provider availability (${provider}):`, error);
      return false;
    }
  }

  /**
   * Get a fallback provider when primary is unavailable
   * @param {string} provider - Original provider
   * @returns {string} - Fallback provider
   */
  getFallbackProvider(provider) {
    // Fallback chain: Claude -> OpenAI -> GPT-3.5
    switch (provider) {
      case 'CLAUDE':
        return 'OPENAI';
      case 'PERPLEXITY':
        return 'OPENAI';
      case 'DEEPSEEK':
        return 'CLAUDE';
      default:
        return 'OPENAI'; // Default fallback
    }
  }

  /**
   * Estimate token usage for a query and response
   * @param {string} query - User query
   * @param {string} response - LLM response
   * @returns {Object} - Token usage estimate
   */
  estimateTokenUsage(query, response) {
    // Very rough estimation based on token-to-word ratio of ~1.33
    const promptTokens = Math.ceil(query.split(/\s+/).length * 1.33);
    const completionTokens = Math.ceil(response.split(/\s+/).length * 1.33);
    
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };
  }

  /**
   * Log query usage for analytics
   * @param {string} queryId - Unique query ID
   * @param {string} provider - Provider used
   * @param {string} query - User query
   * @param {Object} response - Provider response
   * @param {boolean} fromCache - Whether response was from cache
   * @param {number} duration - Processing time in ms
   * @param {Object} tokenUsage - Token usage details
   * @returns {Promise<void>}
   */
  async logQueryUsage(queryId, provider, query, response, fromCache, duration = 0, tokenUsage = null) {
    try {
      // Store query log in Supabase
      await supabase.from('query_logs').insert({
        id: queryId,
        provider,
        query: query.substring(0, 500), // Limit query length
        response_preview: response.content.substring(0, 500), // Limit response length
        from_cache: fromCache,
        duration_ms: duration,
        prompt_tokens: tokenUsage?.prompt_tokens || 0,
        completion_tokens: tokenUsage?.completion_tokens || 0,
        total_tokens: tokenUsage?.total_tokens || 0,
        created_at: new Date().toISOString()
      });
      
      // Update usage counters in Redis
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const counterKey = `usage:${date}:${provider}`;
      
      await redis.hincrby(counterKey, 'queries', 1);
      if (fromCache) {
        await redis.hincrby(counterKey, 'cache_hits', 1);
      }
      if (tokenUsage) {
        await redis.hincrby(counterKey, 'prompt_tokens', tokenUsage.prompt_tokens || 0);
        await redis.hincrby(counterKey, 'completion_tokens', tokenUsage.completion_tokens || 0);
        await redis.hincrby(counterKey, 'total_tokens', tokenUsage.total_tokens || 0);
      }
      
      // Set TTL on counter (30 days)
      await redis.expire(counterKey, 60 * 60 * 24 * 30);
    } catch (error) {
      console.error('Error logging query usage:', error);
    }
  }
}

module.exports = new LLMService();
