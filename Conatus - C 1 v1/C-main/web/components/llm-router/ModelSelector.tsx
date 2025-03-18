import React from 'react';
import { useLLMRouter, ModelType } from '@/context/LLMRouterContext';

export const ModelSelector: React.FC = () => {
  const { 
    currentModel, 
    availableModels, 
    selectModel, 
    manualModelSelection,
    setManualModelSelection,
    isAnalyzing,
    isResponding
  } = useLLMRouter();
  
  // Models are shown in dropdown when manual selection is on, 
  // or not currently analyzing/responding
  const shouldShowDropdown = manualModelSelection || 
    (!isAnalyzing && !isResponding);
  
  // Handle model change
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value as ModelType;
    selectModel(modelId);
  };
  
  // Toggle manual selection mode
  const toggleManualSelection = () => {
    setManualModelSelection(!manualModelSelection);
  };
  
  // Render icon based on model type
  const renderModelIcon = (icon: string) => {
    switch (icon) {
      case 'sparkles':
        return (
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" 
            />
          </svg>
        );
      case 'command':
        return (
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" 
            />
          </svg>
        );
      case 'search':
        return (
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
            />
          </svg>
        );
      case 'code':
        return (
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" 
            />
          </svg>
        );
      default:
        return null;
    }
  };
  
  // Style classes
  const modelColors: Record<ModelType, string> = {
    'claude': 'bg-violet-500 hover:bg-violet-600',
    'openai': 'bg-green-500 hover:bg-green-600',
    'perplexity': 'bg-blue-500 hover:bg-blue-600',
    'deepseek': 'bg-amber-500 hover:bg-amber-600'
  };
  
  return (
    <div className="flex items-center space-x-2">
      {/* Model Selection Button/Dropdown */}
      <div className="relative z-10">
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-white text-xs font-medium ${modelColors[currentModel.id]}`}>
          <span className="mr-1.5">
            {renderModelIcon(currentModel.icon)}
          </span>
          <span className="mr-1">{currentModel.name}</span>
          
          {shouldShowDropdown && (
            <svg 
              className="w-3 h-3 ml-1"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 9l-7 7-7-7" 
              />
            </svg>
          )}
        </div>
        
        {shouldShowDropdown && (
          <select
            value={currentModel.id}
            onChange={handleModelChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        )}
      </div>
      
      {/* Manual Override Toggle */}
      <button
        onClick={toggleManualSelection}
        className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${
          manualModelSelection 
            ? 'bg-primary text-white' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        title={manualModelSelection ? "Auto-selection disabled" : "Auto-selection enabled"}
      >
        {manualModelSelection ? 'M' : 'A'}
      </button>
    </div>
  );
};

export default ModelSelector;
