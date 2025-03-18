'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define model types
export type ModelType = 'claude' | 'openai' | 'perplexity' | 'deepseek';

// Define query types
export type QueryType = 'informational' | 'transactional' | 'creative' | 'technical';

// Model information
export interface ModelInfo {
  id: ModelType;
  name: string;
  strengths: string[];
  description: string;
  responseTime: number; // in milliseconds
  costFactor: number; // relative cost (1-10)
  specialties: string[];
  icon: string;
}

// LLM Router context state
interface LLMRouterContextState {
  currentModel: ModelInfo;
  queryType: QueryType | null;
  availableModels: ModelInfo[];
  modelHistory: ModelType[];
  isAnalyzing: boolean;
  isResponding: boolean;
  confidence: number;
  explanationVisible: boolean;
  manualModelSelection: boolean;
  // Methods
  setQueryType: (type: QueryType | null) => void;
  selectModel: (modelId: ModelType) => void;
  analyzeQuery: (query: string) => Promise<QueryType>;
  toggleExplanation: () => void;
  setManualModelSelection: (value: boolean) => void;
  resetRouter: () => void;
}

// Create context
const LLMRouterContext = createContext<LLMRouterContextState | undefined>(undefined);

// Model definitions
const models: ModelInfo[] = [
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    strengths: ['Complex reasoning', 'Creative tasks', 'Code generation', 'Nuanced responses'],
    description: 'Best for complex reasoning, creative tasks, and code generation with nuanced understanding.',
    responseTime: 2500, // slightly slower but more thoughtful
    costFactor: 8,
    specialties: ['reasoning', 'creativity', 'coding', 'ethics', 'detailed explanations'],
    icon: 'sparkles'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    strengths: ['General queries', 'Creative content', 'Broad knowledge', 'Versatility'],
    description: 'Best for general-purpose queries and creative tasks with broad knowledge coverage.',
    responseTime: 1800,
    costFactor: 7,
    specialties: ['general knowledge', 'creative writing', 'summarization', 'versatility'],
    icon: 'command'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    strengths: ['Research questions', 'Current information', 'Reference lookup', 'Citations'],
    description: 'Specialized in research questions and providing up-to-date information with citations.',
    responseTime: 2200,
    costFactor: 6,
    specialties: ['research', 'current events', 'citations', 'fact checking'],
    icon: 'search'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    strengths: ['Technical content', 'Specialized knowledge', 'Detailed explanations', 'Code optimization'],
    description: 'Excels in technical domains with specialized knowledge and detailed explanations.',
    responseTime: 2800, // slowest but most technical
    costFactor: 5,
    specialties: ['technical documentation', 'code optimization', 'mathematics', 'specialized domains'],
    icon: 'code'
  }
];

// Create provider component
export const LLMRouterProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  // State
  const [currentModel, setCurrentModel] = useState<ModelInfo>(models[0]); // Default to Claude
  const [queryType, setQueryType] = useState<QueryType | null>(null);
  const [modelHistory, setModelHistory] = useState<ModelType[]>(['claude']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [confidence, setConfidence] = useState(0.85); // 0-1 confidence in model selection
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [manualModelSelection, setManualModelSelection] = useState(false);

  // Select model (manual or automated)
  const selectModel = (modelId: ModelType) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      setCurrentModel(model);
      setModelHistory(prev => [...prev, modelId]);
    }
  };

  // Toggle explanation panel
  const toggleExplanation = () => {
    setExplanationVisible(prev => !prev);
  };

  // Reset router state
  const resetRouter = () => {
    setQueryType(null);
    setManualModelSelection(false);
    setConfidence(0.85);
  };

  // Query analysis logic
  const analyzeQuery = async (query: string): Promise<QueryType> => {
    setIsAnalyzing(true);
    
    // This would be a real API call to a backend service
    // For now, we'll use a simple rule-based simulation
    
    // Normalize query for analysis
    const normalizedQuery = query.toLowerCase().trim();
    
    // Simple rule-based classification
    // In a real implementation, this would use NLP/ML models
    let type: QueryType = 'informational'; // default
    let modelConfidence = 0.85;
    
    // Technical patterns (code, programming, technical questions)
    const technicalPatterns = [
      /code/i, /function/i, /program/i, /algorithm/i, /debug/i, 
      /compile/i, /error/i, /syntax/i, /\bapi\b/i, /database/i,
      /sql/i, /json/i, /xml/i, /html/i, /css/i, /javascript/i,
      /python/i, /java\b/i, /c\+\+/i, /typescript/i, /react/i,
      /optimization/i, /performance/i, /memory/i, /cpu/i, /gpu/i
    ];
    
    // Creative patterns (writing, creation, generation)
    const creativePatterns = [
      /write/i, /generate/i, /create/i, /story/i, /poem/i,
      /creative/i, /imagine/i, /fiction/i, /narrative/i, /blog/i,
      /essay/i, /article/i, /content/i, /title/i, /headline/i,
      /design/i, /idea/i, /brainstorm/i, /concept/i, /outline/i,
      /draft/i, /write me a/i, /create a/i, /generate a/i
    ];
    
    // Transactional patterns (action-oriented, doing things)
    const transactionalPatterns = [
      /schedule/i, /book/i, /order/i, /buy/i, /purchase/i,
      /send/i, /email/i, /message/i, /notify/i, /remind/i,
      /reserve/i, /set up/i, /create account/i, /sign up/i, /login/i,
      /cancel/i, /delete/i, /update/i, /change/i, /modify/i,
      /can you/i, /please/i, /help me/i, /do this/i, /execute/i
    ];
    
    // Check for technical patterns
    const technicalMatch = technicalPatterns.some(pattern => pattern.test(normalizedQuery));
    if (technicalMatch) {
      type = 'technical';
      modelConfidence = 0.9;
    }
    
    // Check for creative patterns
    const creativeMatch = creativePatterns.some(pattern => pattern.test(normalizedQuery));
    if (creativeMatch) {
      type = 'creative';
      modelConfidence = 0.85;
    }
    
    // Check for transactional patterns
    const transactionalMatch = transactionalPatterns.some(pattern => pattern.test(normalizedQuery));
    if (transactionalMatch) {
      type = 'transactional';
      modelConfidence = 0.8;
    }
    
    // Add small random variation to confidence
    modelConfidence += (Math.random() * 0.1) - 0.05;
    modelConfidence = Math.min(Math.max(modelConfidence, 0.6), 0.98);
    
    // Simulate analysis time - would be actual API call in production
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));
    
    setQueryType(type);
    setConfidence(modelConfidence);
    setIsAnalyzing(false);
    
    // If not in manual selection mode, automatically select the best model
    if (!manualModelSelection) {
      // Model selection logic based on query type
      let selectedModel: ModelType;
      
      switch (type) {
        case 'technical':
          // Technical queries go to DeepSeek or Claude
          selectedModel = Math.random() > 0.4 ? 'deepseek' : 'claude';
          break;
        case 'creative':
          // Creative queries go to Claude or OpenAI
          selectedModel = Math.random() > 0.4 ? 'claude' : 'openai';
          break;
        case 'transactional':
          // Transactional queries go to OpenAI or Claude
          selectedModel = Math.random() > 0.5 ? 'openai' : 'claude';
          break;
        case 'informational':
        default:
          // Informational queries go to Perplexity or OpenAI
          selectedModel = Math.random() > 0.5 ? 'perplexity' : 'openai';
          break;
      }
      
      selectModel(selectedModel);
    }
    
    return type;
  };
  
  // Context value
  const contextValue: LLMRouterContextState = {
    currentModel,
    queryType,
    availableModels: models,
    modelHistory,
    isAnalyzing,
    isResponding,
    confidence,
    explanationVisible,
    manualModelSelection,
    setQueryType,
    selectModel,
    analyzeQuery,
    toggleExplanation,
    setManualModelSelection,
    resetRouter
  };
  
  return (
    <LLMRouterContext.Provider value={contextValue}>
      {children}
    </LLMRouterContext.Provider>
  );
};

// Hook for using the context
export const useLLMRouter = () => {
  const context = useContext(LLMRouterContext);
  if (!context) {
    throw new Error('useLLMRouter must be used within an LLMRouterProvider');
  }
  return context;
};
