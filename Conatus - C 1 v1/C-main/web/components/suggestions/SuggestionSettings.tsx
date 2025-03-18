'use client';

import React, { useState, useEffect } from 'react';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';
import { SuggestionPreferences, SuggestionCategory } from '@/lib/suggestions';

interface SuggestionSettingsProps {
  onClose?: () => void;
  className?: string;
}

export default function SuggestionSettings({
  onClose,
  className = ''
}: SuggestionSettingsProps) {
  const { preferences, updatePreferences, toggleSuggestions } = useAdaptiveLearning();
  
  // Local state for form
  const [localPreferences, setLocalPreferences] = useState<SuggestionPreferences>({...preferences});
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  
  // Update local preferences when context preferences change
  useEffect(() => {
    setLocalPreferences({...preferences});
  }, [preferences]);
  
  // Check for changes
  useEffect(() => {
    setHasChanges(JSON.stringify(preferences) !== JSON.stringify(localPreferences));
  }, [preferences, localPreferences]);
  
  // Handle toggle for each category
  const handleCategoryToggle = (category: SuggestionCategory) => {
    setLocalPreferences(prev => ({
      ...prev,
      categoriesEnabled: {
        ...prev.categoriesEnabled,
        [category]: !prev.categoriesEnabled[category]
      }
    }));
  };
  
  // Handle sensitivity change
  const handleSensitivityChange = (value: 'low' | 'medium' | 'high') => {
    setLocalPreferences(prev => ({
      ...prev,
      sensitivityLevel: value
    }));
  };
  
  // Handle display mode change
  const handleDisplayModeChange = (value: 'banner' | 'inline' | 'both') => {
    setLocalPreferences(prev => ({
      ...prev,
      suggestionsDisplayMode: value
    }));
  };
  
  // Handle max suggestions change
  const handleMaxSuggestionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setLocalPreferences(prev => ({
        ...prev,
        maxSuggestionsPerDay: value
      }));
    }
  };
  
  // Handle relevance threshold change
  const handleRelevanceThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setLocalPreferences(prev => ({
      ...prev,
      minRelevanceThreshold: value
    }));
  };
  
  // Handle save
  const handleSave = () => {
    updatePreferences(localPreferences);
    if (onClose) {
      onClose();
    }
  };
  
  // Handle reset
  const handleReset = () => {
    setLocalPreferences({...preferences});
  };
  
  // Handle master toggle
  const handleToggleSuggestions = () => {
    const newEnabled = !localPreferences.enabled;
    
    // Update local state first for immediate UI feedback
    setLocalPreferences(prev => ({
      ...prev,
      enabled: newEnabled
    }));
    
    // Then call the context method which will update the context state
    toggleSuggestions();
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-sm border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 border-b px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">
          Suggestion Settings
        </h2>
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Settings Form */}
      <div className="p-4">
        {/* Master toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-900">
              Enable Suggestions
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Turn suggestions on or off completely
            </p>
          </div>
          
          <div>
            <button
              onClick={handleToggleSuggestions}
              className={`
                relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer 
                transition-colors ease-in-out duration-200 focus:outline-none
                ${localPreferences.enabled ? 'bg-primary' : 'bg-gray-200'}
              `}
              aria-pressed="false"
            >
              <span className="sr-only">Enable suggestions</span>
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow 
                  transform ring-0 transition ease-in-out duration-200
                  ${localPreferences.enabled ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>
        </div>
        
        {/* Divider */}
        <div className="border-t my-6"></div>
        
        {/* Category toggles */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-gray-900 mb-3">
            Suggestion Categories
          </h3>
          
          <div className="space-y-3">
            {Object.entries(localPreferences.categoriesEnabled).map(([category, enabled]) => (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`
                    w-3 h-3 rounded-full mr-2
                    ${getCategoryColor(category)}
                  `}></span>
                  <span className="text-gray-700">
                    {formatCategory(category as SuggestionCategory)}
                  </span>
                </div>
                
                <button
                  onClick={() => handleCategoryToggle(category as SuggestionCategory)}
                  className={`
                    relative inline-flex flex-shrink-0 h-5 w-10 border-2 border-transparent rounded-full cursor-pointer 
                    transition-colors ease-in-out duration-200 focus:outline-none
                    ${enabled ? 'bg-primary' : 'bg-gray-200'}
                  `}
                  disabled={!localPreferences.enabled}
                >
                  <span className="sr-only">Enable {category}</span>
                  <span
                    className={`
                      pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow 
                      transform ring-0 transition ease-in-out duration-200
                      ${enabled ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Sensitivity */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-gray-900 mb-2">
            Suggestion Sensitivity
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Adjust how many suggestions you receive
          </p>
          
          <div className="flex space-x-2">
            <button
              onClick={() => handleSensitivityChange('low')}
              className={`
                flex-1 py-2 px-4 rounded-md text-sm font-medium
                ${localPreferences.sensitivityLevel === 'low' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
              `}
              disabled={!localPreferences.enabled}
            >
              Low
            </button>
            
            <button
              onClick={() => handleSensitivityChange('medium')}
              className={`
                flex-1 py-2 px-4 rounded-md text-sm font-medium
                ${localPreferences.sensitivityLevel === 'medium' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
              `}
              disabled={!localPreferences.enabled}
            >
              Medium
            </button>
            
            <button
              onClick={() => handleSensitivityChange('high')}
              className={`
                flex-1 py-2 px-4 rounded-md text-sm font-medium
                ${localPreferences.sensitivityLevel === 'high' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
              `}
              disabled={!localPreferences.enabled}
            >
              High
            </button>
          </div>
        </div>
        
        {/* Display Mode */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-gray-900 mb-2">
            Display Mode
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Choose how suggestions are displayed
          </p>
          
          <div className="flex space-x-2">
            <button
              onClick={() => handleDisplayModeChange('banner')}
              className={`
                flex-1 py-2 px-3 rounded-md text-sm
                ${localPreferences.suggestionsDisplayMode === 'banner' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
              `}
              disabled={!localPreferences.enabled}
            >
              Banner Only
            </button>
            
            <button
              onClick={() => handleDisplayModeChange('inline')}
              className={`
                flex-1 py-2 px-3 rounded-md text-sm
                ${localPreferences.suggestionsDisplayMode === 'inline' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
              `}
              disabled={!localPreferences.enabled}
            >
              Inline Only
            </button>
            
            <button
              onClick={() => handleDisplayModeChange('both')}
              className={`
                flex-1 py-2 px-3 rounded-md text-sm
                ${localPreferences.suggestionsDisplayMode === 'both' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
              `}
              disabled={!localPreferences.enabled}
            >
              Both
            </button>
          </div>
        </div>
        
        {/* Advanced Settings */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-gray-900 mb-3">
            Advanced Settings
          </h3>
          
          <div className="space-y-4">
            {/* Max suggestions per day */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum suggestions per day: {localPreferences.maxSuggestionsPerDay}
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={localPreferences.maxSuggestionsPerDay}
                onChange={handleMaxSuggestionsChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={!localPreferences.enabled}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
              </div>
            </div>
            
            {/* Relevance threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum relevance threshold: {Math.round(localPreferences.minRelevanceThreshold * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localPreferences.minRelevanceThreshold}
                onChange={handleRelevanceThresholdChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={!localPreferences.enabled}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            disabled={!hasChanges}
          >
            Reset
          </button>
          
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            disabled={!hasChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to get category color
function getCategoryColor(category: string): string {
  switch (category) {
    case 'productivity':
      return 'bg-blue-500';
    case 'communication':
      return 'bg-green-500';
    case 'transportation':
      return 'bg-yellow-500';
    case 'food':
      return 'bg-orange-500';
    case 'entertainment':
      return 'bg-purple-500';
    case 'system':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

// Format category name
function formatCategory(category: SuggestionCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
