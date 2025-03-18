'use client';

import React, { useEffect, useState } from 'react';
import { Suggestion } from '@/lib/suggestions';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';

interface SuggestionDisplayProps {
  variant?: 'default' | 'compact' | 'card';
  maxSuggestions?: number;
  categoryFilter?: string[];
  onSuggestionSelect?: (suggestion: Suggestion) => void;
}

export default function SuggestionDisplay({
  variant = 'default',
  maxSuggestions = 3,
  categoryFilter,
  onSuggestionSelect
}: SuggestionDisplayProps) {
  const { 
    suggestions, 
    suggestionsLoading, 
    suggestionsEnabled,
    dismissSuggestion, 
    implementSuggestion,
    setActiveSuggestion,
    refreshSuggestions
  } = useAdaptiveLearning();
  
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>([]);
  
  // Apply filtering when suggestions or filters change
  useEffect(() => {
    let filtered = [...suggestions];
    
    // Apply category filter if provided
    if (categoryFilter && categoryFilter.length > 0) {
      filtered = filtered.filter(suggestion => 
        categoryFilter.includes(suggestion.category)
      );
    }
    
    // Limit to max suggestions
    filtered = filtered.slice(0, maxSuggestions);
    
    setFilteredSuggestions(filtered);
  }, [suggestions, categoryFilter, maxSuggestions]);
  
  // Handle suggestion click
  const handleSuggestionClick = (suggestion: Suggestion) => {
    setActiveSuggestion(suggestion);
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
  };
  
  // Handle dismiss
  const handleDismiss = (e: React.MouseEvent, suggestionId: string) => {
    e.stopPropagation();
    dismissSuggestion(suggestionId);
  };
  
  // Handle implement
  const handleImplement = (e: React.MouseEvent, suggestionId: string) => {
    e.stopPropagation();
    implementSuggestion(suggestionId);
  };
  
  // Render empty state
  if (!suggestionsEnabled) {
    return (
      <div className="text-center p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Suggestions are currently disabled</p>
        <button 
          onClick={() => refreshSuggestions()}
          className="mt-2 text-sm text-primary underline"
        >
          Enable suggestions
        </button>
      </div>
    );
  }
  
  // Render loading state
  if (suggestionsLoading && filteredSuggestions.length === 0) {
    return (
      <div className="flex justify-center items-center p-4">
        <svg
          className="animate-spin h-5 w-5 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span className="ml-2 text-gray-600">Finding suggestions...</span>
      </div>
    );
  }
  
  // Render empty suggestions
  if (filteredSuggestions.length === 0) {
    return (
      <div className="text-center p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No suggestions available</p>
        <button 
          onClick={() => refreshSuggestions()}
          className="mt-2 text-sm text-primary underline"
        >
          Refresh suggestions
        </button>
      </div>
    );
  }
  
  // Render suggestions based on variant
  return (
    <div className="space-y-3">
      {filteredSuggestions.map(suggestion => (
        <div 
          key={suggestion.id}
          onClick={() => handleSuggestionClick(suggestion)}
          className={`
            cursor-pointer transition-shadow duration-200
            ${variant === 'compact' ? 'px-3 py-2' : 'p-4'}
            ${variant === 'card' ? 'border rounded-lg shadow-sm hover:shadow' : 'border-b'}
            bg-white hover:bg-gray-50
          `}
        >
          {/* Relevance indicator */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              {/* Icon based on suggestion type */}
              {renderSuggestionIcon(suggestion.type)}
              
              {/* Relevance indicator */}
              <div className="ml-auto flex items-center">
                <div className="flex space-x-0.5">
                  {[1, 2, 3].map(i => (
                    <div 
                      key={i}
                      className={`
                        h-1.5 w-1.5 rounded-full
                        ${suggestion.relevanceScore >= (i * 0.33) 
                          ? 'bg-primary' 
                          : 'bg-gray-200'}
                      `}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Category badge */}
            <span className={`
              text-xs px-2 py-1 rounded-full 
              ${getCategoryColor(suggestion.category)}
            `}>
              {formatCategory(suggestion.category)}
            </span>
          </div>
          
          {/* Title and description */}
          <div>
            <h3 className={`
              font-medium text-gray-900 
              ${variant === 'compact' ? 'text-sm' : 'text-base'}
            `}>
              {suggestion.title}
            </h3>
            
            {variant !== 'compact' && (
              <p className="text-sm text-gray-600 mt-1">
                {suggestion.description}
              </p>
            )}
          </div>
          
          {/* Action buttons */}
          <div className={`
            flex justify-end mt-2 space-x-2
            ${variant === 'compact' ? 'mt-1' : 'mt-3'}
          `}>
            <button
              onClick={(e) => handleDismiss(e, suggestion.id || '')}
              className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900"
            >
              Dismiss
            </button>
            
            <button
              onClick={(e) => handleImplement(e, suggestion.id || '')}
              className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary-dark"
            >
              {getActionText(suggestion.type)}
            </button>
          </div>
        </div>
      ))}
      
      {/* Refresh button */}
      {filteredSuggestions.length > 0 && (
        <div className="text-center mt-4">
          <button
            onClick={() => refreshSuggestions()}
            className="text-sm text-primary hover:text-primary-dark"
          >
            Refresh suggestions
          </button>
        </div>
      )}
    </div>
  );
}

// Helper function to render icon based on suggestion type
function renderSuggestionIcon(type: string) {
  let icon;
  
  switch (type) {
    case 'automation':
      icon = (
        <svg 
          className="w-5 h-5 text-blue-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
      break;
    case 'action':
      icon = (
        <svg 
          className="w-5 h-5 text-green-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
      break;
    case 'reminder':
      icon = (
        <svg 
          className="w-5 h-5 text-yellow-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
      break;
    case 'connection':
      icon = (
        <svg 
          className="w-5 h-5 text-purple-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101"
          />
        </svg>
      );
      break;
    case 'feature':
      icon = (
        <svg 
          className="w-5 h-5 text-indigo-500" 
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
      break;
    default:
      icon = (
        <svg 
          className="w-5 h-5 text-gray-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
  }
  
  return icon;
}

// Helper function to get category color
function getCategoryColor(category: string): string {
  switch (category) {
    case 'productivity':
      return 'bg-blue-100 text-blue-800';
    case 'communication':
      return 'bg-green-100 text-green-800';
    case 'transportation':
      return 'bg-yellow-100 text-yellow-800';
    case 'food':
      return 'bg-orange-100 text-orange-800';
    case 'entertainment':
      return 'bg-purple-100 text-purple-800';
    case 'system':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Format category name
function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// Get action button text based on suggestion type
function getActionText(type: string): string {
  switch (type) {
    case 'automation':
      return 'Create';
    case 'action':
      return 'Do it';
    case 'reminder':
      return 'Set';
    case 'connection':
      return 'Connect';
    case 'feature':
      return 'Try';
    default:
      return 'Apply';
  }
}
