import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';

// Model types
export type ModelType = 'claude' | 'openai' | 'perplexity' | 'deepseek';

// Query types
export type QueryType = 'informational' | 'transactional' | 'creative' | 'technical';

// Analysis result
interface QueryAnalysis {
  selectedModel: ModelType;
  queryType: QueryType;
  confidence: number;
}

// Query response
interface QueryResponse {
  content: string;
  error?: string;
}

// Stream response
interface StreamResponse {
  stream: ReadableStream<any>;
  model: ModelType;
}

/**
 * LLM Router Service
 * 
 * This service is responsible for:
 * 1. Analyzing user queries to determine the appropriate query type
 * 2. Selecting the optimal AI model based on query type and user preferences
 * 3. Processing queries with the selected model
 * 4. Supporting streaming responses from models that offer streaming
 */
export class LLMRouter {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private supabase: any;
  
  constructor() {
    // Initialize API clients
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Initialize Supabase client (for user preferences and history)
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
  }
  
  /**
   * Analyze a query and determine the best model to use
   * 
   * @param query The user query to analyze
   * @param requestedModel Optional user-requested model override
   * @returns Analysis result with selected model, query type and confidence
   */
  async analyzeQuery(query: string, requestedModel?: string): Promise<QueryAnalysis> {
    // If user has explicitly requested a model, use that
    if (requestedModel && ['claude', 'openai', 'perplexity', 'deepseek'].includes(requestedModel)) {
      // Still analyze the query type for logging and future improvements
      const queryType = await this.classifyQueryType(query);
      
      return {
        selectedModel: requestedModel as ModelType,
        queryType,
        confidence: 1.0 // Max confidence since this is a user override
      };
    }
    
    // Otherwise, use our analysis to pick the best model
    const queryType = await this.classifyQueryType(query);
    let confidence = 0.85; // Default confidence level
    
    // Select model based on query type
    let selectedModel: ModelType;
    
    switch (queryType) {
      case 'technical':
        // Technical queries go to DeepSeek or Claude
        selectedModel = Math.random() > 0.5 ? 'deepseek' : 'claude';
        confidence = 0.9;
        break;
      case 'creative':
        // Creative queries go to Claude or OpenAI
        selectedModel = Math.random() > 0.6 ? 'claude' : 'openai';
        confidence = 0.88;
        break;
      case 'transactional':
        // Transactional queries go to OpenAI or Claude
        selectedModel = Math.random() > 0.5 ? 'openai' : 'claude';
        confidence = 0.85;
        break;
      case 'informational':
      default:
        // Informational queries go to Perplexity or OpenAI
        selectedModel = Math.random() > 0.5 ? 'perplexity' : 'openai';
        confidence = 0.83;
        break;
    }
    
    // Apply cost optimization if needed (not implemented in this version)
    // selectedModel = this.applyCostOptimization(selectedModel, queryType);
    
    return {
      selectedModel,
      queryType,
      confidence
    };
  }
  
  /**
   * Classify the query type using NLP techniques
   * 
   * In a production system, this would use a more sophisticated ML model,
   * but for this implementation we'll use a simpler rule-based approach.
   * 
   * @param query The user query to classify
   * @returns The detected query type
   */
  private async classifyQueryType(query: string): Promise<QueryType> {
    // Normalize query for analysis
    const normalizedQuery = query.toLowerCase().trim();
    
    // Define detection patterns for each query type
    const technicalPatterns = [
      /code/i, /function/i, /program/i, /algorithm/i, /debug/i, 
      /compile/i, /error/i, /syntax/i, /\bapi\b/i, /database/i,
      /sql/i, /json/i, /xml/i, /html/i, /css/i, /javascript/i,
      /python/i, /java\b/i, /c\+\+/i, /typescript/i, /react/i,
      /optimization/i, /performance/i, /memory/i, /cpu/i, /gpu/i
    ];
    
    const creativePatterns = [
      /write/i, /generate/i, /create/i, /story/i, /poem/i,
      /creative/i, /imagine/i, /fiction/i, /narrative/i, /blog/i,
      /essay/i, /article/i, /content/i, /title/i, /headline/i,
      /design/i, /idea/i, /brainstorm/i, /concept/i, /outline/i,
      /draft/i, /write me a/i, /create a/i, /generate a/i
    ];
    
    const transactionalPatterns = [
      /schedule/i, /book/i, /order/i, /buy/i, /purchase/i,
      /send/i, /email/i, /message/i, /notify/i, /remind/i,
      /reserve/i, /set up/i, /create account/i, /sign up/i, /login/i,
      /cancel/i, /delete/i, /update/i, /change/i, /modify/i,
      /can you/i, /please/i, /help me/i, /do this/i, /execute/i
    ];
    
    // Check patterns (order matters - more specific categories first)
    if (technicalPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return 'technical';
    }
    
    if (creativePatterns.some(pattern => pattern.test(normalizedQuery))) {
      return 'creative';
    }
    
    if (transactionalPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return 'transactional';
    }
    
    // Default to informational if no specific patterns matched
    return 'informational';
  }
  
  /**
   * Process a query with the selected model
   * 
   * @param query The user query to process
   * @param model The model to use for processing
   * @param conversationId Optional conversation ID for context
   * @returns Response content or error
   */
  async processQuery(query: string, model: ModelType, conversationId?: string): Promise<QueryResponse> {
    try {
      // Get conversation history if conversationId is provided
      let conversationContext = '';
      
      if (conversationId) {
        const { data: messages, error } = await this.supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(10); // Limit to last 10 messages for context window management
        
        if (!error && messages && messages.length > 0) {
          // Format conversation history based on the model's expected format
          conversationContext = this.formatConversationHistory(messages, model);
        }
      }
      
      // Process query with selected model
      switch (model) {
        case 'claude':
          return await this.processWithClaude(query, conversationContext);
        case 'openai':
          return await this.processWithOpenAI(query, conversationContext);
        case 'perplexity':
          return await this.processWithPerplexity(query, conversationContext);
        case 'deepseek':
          return await this.processWithDeepSeek(query, conversationContext);
        default:
          // Fallback to OpenAI if model not supported
          return await this.processWithOpenAI(query, conversationContext);
      }
    } catch (error) {
      console.error(`Error processing query with ${model}:`, error);
      return {
        content: '',
        error: `Failed to process query with ${model}: ${error}`
      };
    }
  }
  
  /**
   * Stream a query response with the selected model
   * 
   * @param query The user query to process
   * @param model The model to use for processing
   * @param conversationId Optional conversation ID for context
   * @returns Streaming response
   */
  async streamQuery(query: string, model: ModelType, conversationId?: string): Promise<StreamResponse> {
    try {
      // Get conversation history if conversationId is provided
      let conversationContext = '';
      
      if (conversationId) {
        const { data: messages, error } = await this.supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(10);
        
        if (!error && messages && messages.length > 0) {
          conversationContext = this.formatConversationHistory(messages, model);
        }
      }
      
      // Create streaming response based on selected model
      switch (model) {
        case 'claude':
          return { 
            stream: await this.streamWithClaude(query, conversationContext),
            model: 'claude'
          };
        case 'openai':
          return { 
            stream: await this.streamWithOpenAI(query, conversationContext),
            model: 'openai'
          };
        case 'perplexity':
          // Perplexity doesn't support streaming in their API, so we simulate it
          return {
            stream: this.simulateStreaming(await this.processWithPerplexity(query, conversationContext)),
            model: 'perplexity'
          };
        case 'deepseek':
          // DeepSeek may not have streaming API, so we simulate it
          return {
            stream: this.simulateStreaming(await this.processWithDeepSeek(query, conversationContext)),
            model: 'deepseek'
          };
        default:
          // Fallback to OpenAI streaming
          return { 
            stream: await this.streamWithOpenAI(query, conversationContext),
            model: 'openai'
          };
      }
    } catch (error) {
      console.error(`Error streaming query with ${model}:`, error);
      // Return a stream with an error message
      return {
        stream: this.simulateStreaming({ 
          content: `Sorry, there was an error processing your request with ${model}. Please try again.`,
          error: `${error}`
        }),
        model
      };
    }
  }
  
  /**
   * Format conversation history for different model APIs
   */
  private formatConversationHistory(messages: any[], model: ModelType): string {
    // Implementation varies based on the model's expected format
    // This is a simplified version
    let formattedHistory = '';
    
    switch (model) {
      case 'claude':
        // Anthropic Claude uses a specific conversation format
        messages.forEach(msg => {
          const role = msg.role === 'user' ? 'Human' : 'Assistant';
          formattedHistory += `${role}: ${msg.content}\n\n`;
        });
        break;
      
      case 'openai':
        // OpenAI uses a JSON format which would be constructed elsewhere
        // This is a simplified representation just for the history
        formattedHistory = messages.map(msg => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        break;
      
      case 'perplexity':
      case 'deepseek':
      default:
        // Generic conversation format for other models
        formattedHistory = messages.map(msg => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        break;
    }
    
    return formattedHistory;
  }
  
  /**
   * Process with Claude (Anthropic)
   */
  private async processWithClaude(query: string, conversationContext: string): Promise<QueryResponse> {
    try {
      const systemPrompt = "You are Conatus, an AI assistant that actively performs tasks for users by connecting to various services. You respond thoughtfully with nuanced perspectives.";
      
      const messages = [];
      
      // Add conversation history if available
      if (conversationContext) {
        // Parse history into message format
        const historyLines = conversationContext.split('\n\n');
        for (const line of historyLines) {
          if (line.startsWith('Human:')) {
            messages.push({
              role: 'user',
              content: line.substring('Human:'.length).trim()
            });
          } else if (line.startsWith('Assistant:')) {
            messages.push({
              role: 'assistant',
              content: line.substring('Assistant:'.length).trim()
            });
          }
        }
      }
      
      // Add current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229', // Using latest Claude model
        system: systemPrompt,
        messages: messages,
        max_tokens: 4000
      });
      
      return {
        content: response.content[0].text
      };
    } catch (error) {
      console.error('Error with Claude API:', error);
      return {
        content: '',
        error: `Claude API error: ${error}`
      };
    }
  }
  
  /**
   * Process with OpenAI
   */
  private async processWithOpenAI(query: string, conversationContext: string): Promise<QueryResponse> {
    try {
      const systemPrompt = "You are Conatus, an AI assistant that actively performs tasks for users by connecting to various services. Provide clear, concise responses.";
      
      const messages = [{
        role: 'system',
        content: systemPrompt
      }];
      
      // Add conversation history if available
      if (conversationContext) {
        // Parse history into message format
        const historyLines = conversationContext.split('\n\n');
        for (const line of historyLines) {
          if (line.startsWith('User:')) {
            messages.push({
              role: 'user',
              content: line.substring('User:'.length).trim()
            });
          } else if (line.startsWith('Assistant:')) {
            messages.push({
              role: 'assistant',
              content: line.substring('Assistant:'.length).trim()
            });
          }
        }
      }
      
      // Add current query
      messages.push({
        role: 'user',
        content: query
      });
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview', // Using latest GPT-4 model
        messages: messages,
        max_tokens: 4000
      });
      
      return {
        content: response.choices[0].message.content || ''
      };
    } catch (error) {
      console.error('Error with OpenAI API:', error);
      return {
        content: '',
        error: `OpenAI API error: ${error}`
      };
    }
  }
  
  /**
   * Process with Perplexity
   */
  private async processWithPerplexity(query: string, conversationContext: string): Promise<QueryResponse> {
    try {
      // This would be a real Perplexity API call in production
      // For now, we'll simulate it
      
      // In production, include the API Key in headers
      // const apiKey = process.env.PERPLEXITY_API_KEY;
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate simulated response with citations format
      const response = `Based on my search results:

The answer to your question about "${query}" involves several key points:

1. According to [Source A] (2023), ${generateRandomSentence()}.

2. [Source B] states, "${generateRandomQuote()}" which suggests ${generateRandomSentence()}.

3. A recent study by [Research University] found that ${generateRandomSentence()}.

In conclusion: ${generateRandomSentence()}.

Sources:
1. Author, A. (2023). Article Title. Journal Name, 45(2), 123-145.
2. Organization B (2024). Report Title. Website URL.`;
      
      return {
        content: response
      };
    } catch (error) {
      console.error('Error with Perplexity API:', error);
      return {
        content: '',
        error: `Perplexity API error: ${error}`
      };
    }
  }
  
  /**
   * Process with DeepSeek
   */
  private async processWithDeepSeek(query: string, conversationContext: string): Promise<QueryResponse> {
    try {
      // This would be a real DeepSeek API call in production
      // For now, we'll simulate it
      
      // In production, include the API Key in headers
      // const apiKey = process.env.DEEPSEEK_API_KEY;
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1800));
      
      // Generate simulated response with technical format
      const response = `From a technical perspective:

Regarding your question about "${query}":

### Technical Analysis

The core technical concepts involved are:
1. ${generateRandomTechnicalTerm()} - ${generateRandomSentence()}
2. ${generateRandomTechnicalTerm()} - ${generateRandomSentence()}

### Implementation Example

\`\`\`python
# Here's how you might implement this
def technical_function(parameters):
    # Initialize variables
    result = {}
    
    # Core implementation logic
    for param in parameters:
        result[param] = calculate_something(param)
    
    return result
\`\`\`

### Optimization Considerations

For optimal performance, consider:
- Time complexity: O(n log n)
- Space complexity: O(n)
- Edge cases: Handle null inputs and boundary conditions

### Conclusion

From a technical standpoint, ${generateRandomSentence()}.`;
      
      return {
        content: response
      };
    } catch (error) {
      console.error('Error with DeepSeek API:', error);
      return {
        content: '',
        error: `DeepSeek API error: ${error}`
      };
    }
  }
  
  /**
   * Stream with Claude (Anthropic)
   */
  private async streamWithClaude(query: string, conversationContext: string): Promise<ReadableStream<any>> {
    // This is a simplified implementation of streaming
    // In production, you would use the actual streaming APIs
    
    const response = await this.processWithClaude(query, conversationContext);
    return this.simulateStreaming(response);
  }
  
  /**
   * Stream with OpenAI
   */
  private async streamWithOpenAI(query: string, conversationContext: string): Promise<ReadableStream<any>> {
    // This is a simplified implementation of streaming
    // In production, you would use the actual streaming APIs
    
    const response = await this.processWithOpenAI(query, conversationContext);
    return this.simulateStreaming(response);
  }
  
  /**
   * Simulate streaming for APIs that don't support it
   */
  private simulateStreaming(response: QueryResponse): ReadableStream<any> {
    // This is a simplified simulation of streaming
    // In production, you would implement proper stream handling
    
    const content = response.content;
    const chunkSize = 5; // Characters per chunk
    
    // Create a readable stream that emits chunks of the response
    return new ReadableStream({
      start(controller) {
        let index = 0;
        
        function push() {
          if (index >= content.length) {
            controller.close();
            return;
          }
          
          const chunk = content.slice(index, index + chunkSize);
          controller.enqueue(chunk);
          index += chunkSize;
          
          setTimeout(push, 100); // Simulate delay between chunks
        }
        
        push();
      }
    });
  }
}

// Helper functions for generating simulated responses
function generateRandomSentence(): string {
  const sentences = [
    "The results show a significant correlation between the variables.",
    "This approach can be adapted to various domains with minimal modifications.",
    "The research indicates several potential applications in real-world scenarios.",
    "Current evidence suggests this is an optimal solution for such problems.",
    "Further research is needed to validate these preliminary findings.",
    "The implementation demonstrates considerable efficiency improvements.",
    "Experts generally agree this represents a step forward in the field.",
    "This methodology has been proven effective in similar contexts.",
    "The analysis reveals interesting patterns worth investigating further.",
    "These findings challenge some previously accepted assumptions."
  ];
  
  return sentences[Math.floor(Math.random() * sentences.length)];
}

function generateRandomQuote(): string {
  const quotes = [
    "The data clearly supports our hypothesis with 95% confidence",
    "We've observed a 42% improvement over baseline methods",
    "The key insight was recognizing the recursive pattern in the problem space",
    "Our approach consistently outperforms existing methods on all benchmarks",
    "The most surprising finding was the non-linear relationship between variables",
    "We recommend a hybrid approach combining multiple techniques for optimal results",
    "The limitations primarily stem from computational constraints rather than theoretical ones",
    "Future work should focus on generalizing these principles to broader domains"
  ];
  
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function generateRandomTechnicalTerm(): string {
  const terms = [
    "Recursive Optimization",
    "Parallel Processing",
    "Distributed Systems",
    "Memory Management",
    "Algorithmic Complexity",
    "Data Structures",
    "Thread Synchronization",
    "Dependency Injection",
    "Functional Paradigms",
    "Tokenization",
    "Vector Embedding",
    "Classification Algorithms",
    "Neural Network Architecture"
  ];
  
  return terms[Math.floor(Math.random() * terms.length)];
}
