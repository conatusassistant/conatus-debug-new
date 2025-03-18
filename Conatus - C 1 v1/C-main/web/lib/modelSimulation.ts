import { ModelType } from '@/context/LLMRouterContext';

// Simulate different AI model response styles and characteristics
export const generateModelResponse = (
  query: string,
  modelType: ModelType
): { content: string; responseTime: number } => {
  
  // Base response for all models - will be modified based on model type
  let baseResponse = "I've processed your query and here's what I found.";
  
  const processTime = getModelProcessTime(modelType);
  
  switch (modelType) {
    case 'claude':
      return {
        content: generateClaudeResponse(query),
        responseTime: processTime
      };
    case 'openai':
      return {
        content: generateOpenAIResponse(query),
        responseTime: processTime
      };
    case 'perplexity':
      return {
        content: generatePerplexityResponse(query),
        responseTime: processTime
      };
    case 'deepseek':
      return {
        content: generateDeepSeekResponse(query),
        responseTime: processTime
      };
    default:
      return {
        content: baseResponse,
        responseTime: 2000
      };
  }
};

// CLAUDE response style simulation - thoughtful, nuanced, detailed reasoning
const generateClaudeResponse = (query: string): string => {
  // Common Claude phrases and response patterns
  const claudePhrases = [
    "I'd like to explore this thoughtfully.",
    "Let's think through this carefully.",
    "This is an interesting question that deserves some nuance.",
    "There are several aspects to consider here.",
    "Let me share a thoughtful perspective on this."
  ];
  
  // Claude tends to structure responses with reasoning
  const intro = claudePhrases[Math.floor(Math.random() * claudePhrases.length)];
  
  // Core response with Claude's explanatory, nuanced style
  let response = `${intro}\n\n`;
  
  // Add some structured reasoning or exploration
  if (query.length > 30) {
    response += "I think we should approach this from multiple angles:\n\n";
    response += "First, let's consider the core aspects of your query. ";
    response += `Your question about "${query.substring(0, 30)}..." involves several important considerations.\n\n`;
    response += "On one hand, we might think about [thoughtful perspective A]. ";
    response += "However, it's also worth considering [nuanced perspective B].\n\n";
  } else {
    response += `Regarding your question about "${query}", I'd like to offer a thoughtful analysis.\n\n`;
    response += "The key insight here is [detailed explanation with nuance].\n\n";
  }
  
  // Add some values-oriented content (characteristic of Claude)
  if (Math.random() > 0.6) {
    response += "It's worth noting that there are ethical dimensions to consider as well, ";
    response += "particularly regarding [ethical consideration relevant to query].\n\n";
  }
  
  response += "To summarize my thoughts: [concise summary with balanced perspective].\n\n";
  
  // Sometimes add Claude's characteristic offering of alternatives
  if (Math.random() > 0.5) {
    response += "Would you like me to explore any particular aspect of this in more depth?";
  }
  
  return response;
};

// OPENAI response style simulation - concise, direct, informative
const generateOpenAIResponse = (query: string): string => {
  // Common OpenAI phrases and response patterns
  const openAIPhrases = [
    "Here's what you need to know:",
    "I can help with that.",
    "Based on my training data:",
    "Here's the information you requested:",
    "The answer to your question is:"
  ];
  
  // OpenAI tends to be direct and concise
  const intro = openAIPhrases[Math.floor(Math.random() * openAIPhrases.length)];
  
  // Core response with OpenAI's concise style
  let response = `${intro}\n\n`;
  
  // Add the main content - typically straightforward and clear
  response += `Regarding "${query.substring(0, 25)}${query.length > 25 ? '...' : ''}", `;
  response += "the key points are:\n\n";
  
  // Add some bullet points - characteristic of OpenAI's organized responses
  for (let i = 1; i <= 3; i++) {
    response += `${i}. [Clear and concise point ${i}]\n`;
  }
  
  response += "\nAdditional information: [relevant details presented efficiently].\n\n";
  
  // Sometimes add a helpful suggestion
  if (Math.random() > 0.6) {
    response += "Pro tip: [practical suggestion related to query].\n\n";
  }
  
  response += "I hope this helps! Let me know if you need any clarification.";
  
  return response;
};

// PERPLEXITY response style simulation - research-focused, citation-heavy
const generatePerplexityResponse = (query: string): string => {
  // Common Perplexity phrases and response patterns
  const perplexityPhrases = [
    "Based on my search results:",
    "According to recent sources:",
    "Here's what I found from reliable sources:",
    "The latest information suggests:",
    "Research indicates the following:"
  ];
  
  // Perplexity tends to focus on research and citations
  const intro = perplexityPhrases[Math.floor(Math.random() * perplexityPhrases.length)];
  
  // Current date for "recency" effect
  const currentDate = new Date();
  const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Core response with Perplexity's research-oriented style
  let response = `${intro}\n\n`;
  
  // Add the main content - research-focused with citations
  response += `On the topic of "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}":\n\n`;
  
  // Add some points with citations - characteristic of Perplexity
  response += "• According to [Source A] (2023), [research finding 1].\n\n";
  response += "• [Source B] states, \"[direct quote related to query]\" which suggests [interpretation].\n\n";
  response += `• A recent study by [University/Organization] (as of ${dateStr}) found that [research finding 2].\n\n`;
  
  // Add some analysis of sources - Perplexity often evaluates information quality
  response += "It's worth noting that [Source A] is [credibility assessment], while [Source B] has [limitation or strength].\n\n";
  
  // Sometimes add a section on conflicting information
  if (Math.random() > 0.7) {
    response += "Different sources offer contrasting perspectives:\n";
    response += "- [Source C] suggests [alternative viewpoint].\n";
    response += "- However, [Source D] argues [opposing viewpoint].\n\n";
  }
  
  response += "In conclusion: [summary of findings with emphasis on research].\n\n";
  
  // Add citation formatting
  response += "Sources:\n";
  response += "1. [Author A] (2023). [Title]. [Publication]. Retrieved on [date].\n";
  response += "2. [Organization B] (2024). [Report title]. [Website].\n";
  
  return response;
};

// DEEPSEEK response style simulation - technical, detailed, code-heavy
const generateDeepSeekResponse = (query: string): string => {
  // Common DeepSeek phrases and response patterns
  const deepSeekPhrases = [
    "From a technical perspective:",
    "Here's a detailed technical analysis:",
    "Let me break this down technically:",
    "The technical details are as follows:",
    "Looking at this from an engineering standpoint:"
  ];
  
  // DeepSeek tends to be technical and detailed
  const intro = deepSeekPhrases[Math.floor(Math.random() * deepSeekPhrases.length)];
  
  // Core response with DeepSeek's technical style
  let response = `${intro}\n\n`;
  
  // Add the main content - technical and detailed
  response += `Regarding your question about "${query.substring(0, 25)}${query.length > 25 ? '...' : ''}":\n\n`;
  
  // Add technical explanation - characteristic of DeepSeek
  response += "### Technical Analysis\n\n";
  response += "The core technical concepts involved are:\n";
  response += "1. [Technical concept A] - [detailed explanation with technical terminology]\n";
  response += "2. [Technical concept B] - [detailed explanation with technical terminology]\n\n";
  
  // Add some code - DeepSeek often includes code examples
  response += "### Implementation Example\n\n";
  response += "```python\n";
  response += "# Here's how you might implement this\n";
  response += "def technical_function(parameters):\n";
  response += "    # Initialize variables\n";
  response += "    result = {}\n";
  response += "    \n";
  response += "    # Core implementation logic\n";
  response += "    for param in parameters:\n";
  response += "        result[param] = calculate_something(param)\n";
  response += "    \n";
  response += "    return result\n";
  response += "```\n\n";
  
  // Add optimization notes - DeepSeek focuses on efficiency
  response += "### Optimization Considerations\n\n";
  response += "For optimal performance, consider:\n";
  response += "- Time complexity: [Big O notation analysis]\n";
  response += "- Space complexity: [Memory usage analysis]\n";
  response += "- Edge cases: [Technical handling of edge cases]\n\n";
  
  response += "### Conclusion\n\n";
  response += "From a technical standpoint, [summary of technical approach].\n\n";
  
  // Sometimes add further reading
  if (Math.random() > 0.6) {
    response += "For deeper understanding, I recommend exploring:\n";
    response += "- [Technical documentation/resource 1]\n";
    response += "- [Technical paper/resource 2]\n";
  }
  
  return response;
};

// Get realistic processing time for different models
const getModelProcessTime = (modelType: ModelType): number => {
  // Base processing times (ms) - would vary in real implementation
  const baseProcessingTimes: Record<ModelType, number> = {
    'claude': 2500,    // Claude tends to be thoughtful but a bit slower
    'openai': 1800,    // OpenAI tends to be quick and efficient
    'perplexity': 2200, // Perplexity does research, so moderate speed
    'deepseek': 2800   // DeepSeek is technical and more thorough
  };
  
  // Add some randomness to make it realistic
  const baseTime = baseProcessingTimes[modelType];
  const randomVariation = (Math.random() * 0.3) - 0.15; // ±15% variation
  
  return Math.floor(baseTime * (1 + randomVariation));
};

// Get realistic token counts based on content
export const getTokenCount = (text: string): number => {
  // Very rough approximation - in reality would use a tokenizer
  // Average English word is ~1.3 tokens
  const words = text.split(/\s+/).length;
  return Math.floor(words * 1.3);
};
