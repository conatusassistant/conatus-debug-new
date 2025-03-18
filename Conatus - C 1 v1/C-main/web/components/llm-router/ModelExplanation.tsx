import React from 'react';
import { useLLMRouter } from '@/context/LLMRouterContext';

export const ModelExplanation: React.FC = () => {
  const { 
    currentModel, 
    queryType, 
    confidence, 
    explanationVisible,
    toggleExplanation
  } = useLLMRouter();

  // Only render if we have a query type
  if (!queryType) {
    return null;
  }
  
  // Human readable query type labels
  const queryTypeLabels = {
    'informational': 'Information Request',
    'transactional': 'Action Request',
    'creative': 'Creative Request',
    'technical': 'Technical Request'
  };
  
  // Explanation for why a specific model was chosen
  const getModelExplanation = () => {
    switch (currentModel.id) {
      case 'claude':
        if (queryType === 'creative') {
          return 'Claude is selected for creative tasks because it excels at nuanced content generation, creative writing, and maintaining consistent tone.';
        } else if (queryType === 'technical') {
          return 'Claude is selected for technical queries because it provides detailed explanations, well-structured code, and thorough technical reasoning.';
        } else {
          return 'Claude is selected because it provides thoughtful, nuanced responses and can handle complex reasoning tasks.';
        }
      case 'openai':
        if (queryType === 'transactional') {
          return 'OpenAI is selected for action requests because it efficiently processes instructions and provides clear, actionable responses.';
        } else if (queryType === 'creative') {
          return 'OpenAI is selected for creative content because it generates diverse and engaging creative outputs.';
        } else {
          return 'OpenAI is selected because it offers well-balanced responses for general purpose queries.';
        }
      case 'perplexity':
        if (queryType === 'informational') {
          return 'Perplexity is selected for information queries because it specializes in research questions and provides up-to-date information with citations.';
        } else {
          return 'Perplexity is selected because it focuses on retrieving and citing accurate information from diverse sources.';
        }
      case 'deepseek':
        if (queryType === 'technical') {
          return 'DeepSeek is selected for technical content because it excels at specialized technical knowledge, code optimization, and detailed technical explanations.';
        } else {
          return 'DeepSeek is selected because it provides specialized technical knowledge and detailed explanations.';
        }
      default:
        return 'This model was selected based on your query type and content.';
    }
  };

  return (
    <div className="mb-3">
      <button
        onClick={toggleExplanation}
        className="mb-2 text-xs flex items-center text-gray-500 hover:text-gray-700"
      >
        <svg 
          className={`w-4 h-4 mr-1 transition-transform duration-200 ${explanationVisible ? 'rotate-90' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 5l7 7-7 7" 
          />
        </svg>
        Model selection details
      </button>
      
      {explanationVisible && (
        <div className="text-xs bg-gray-50 p-3 rounded-md border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Query Analysis</div>
            <div className="bg-gray-200 px-2 py-0.5 rounded text-gray-700">
              {queryTypeLabels[queryType]} ({Math.round(confidence * 100)}% confidence)
            </div>
          </div>
          
          <div className="mb-2 text-gray-600">
            {getModelExplanation()}
          </div>
          
          <div className="font-medium mb-1">Model Capabilities</div>
          <ul className="list-disc list-inside text-gray-600">
            {currentModel.strengths.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
          
          <div className="mt-2 text-gray-500 italic">
            Automatic model selection uses ML-based analysis to route your query to the most appropriate AI model.
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelExplanation;
