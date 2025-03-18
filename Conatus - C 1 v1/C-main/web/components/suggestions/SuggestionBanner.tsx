'use client';

import React, { useState, useEffect } from 'react';
import { Suggestion } from '@/lib/suggestions';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';

interface SuggestionBannerProps {
  position?: 'top' | 'bottom';
  autoDismissAfter?: number; // in milliseconds, 0 for no auto-dismiss
  showOnlyHighRelevance?: boolean;
  onSuggestionSelect?: (suggestion: Suggestion) => void;
}

export default function SuggestionBanner({
  position = 'top',
  autoDismissAfter = 0,
  showOnlyHighRelevance = true,
  onSuggestionSelect
}: SuggestionBannerProps) {
  const { 
    suggestions, 
    suggestionsEnabled,
    dismissSuggestion, 
    implementSuggestion,
    setActiveSuggestion
  } = useAdaptiveLearning();
  
  const [visible, setVisible] = useState<boolean>(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<Suggestion | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  
  // Find the highest relevance suggestion
  useEffect(() => {
    if (!suggestionsEnabled || suggestions.length === 0) {
      setVisible(false);
      setCurrentSuggestion(null);
      return;
    }
    
    // Filter for high relevance if needed
    let availableSuggestions = [...suggestions];
    if (showOnlyHighRelevance) {
      availableSuggestions = availableSuggestions.filter(s => s.relevanceScore >= 0.8);
    }
    
    // If we have suggestions, show the highest relevance one
    if (availableSuggestions.length > 0) {
      const highestRelevance = availableSuggestions.reduce((prev, current) => 
        prev.relevanceScore > current.relevanceScore ? prev : current
      );
      
      setCurrentSuggestion(highestRelevance);
      setVisible(true);
    } else {
      setVisible(false);
      setCurrentSuggestion(null);
    }
  }, [suggestions, suggestionsEnabled, showOnlyHighRelevance]);
  
  // Handle auto-dismiss
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (visible && autoDismissAfter > 0 && !expanded) {
      timer = setTimeout(() => {
        setVisible(false);
      }, autoDismissAfter);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, autoDismissAfter, expanded]);
  
  // Handle dismissal
  const handleDismiss = () => {
    setVisible(false);
    
    if (currentSuggestion) {
      dismissSuggestion(currentSuggestion.id || '');
    }
  };
  
  // Handle suggestion implementation
  const handleImplement = () => {
    if (currentSuggestion) {
      implementSuggestion(currentSuggestion.id || '');
      setVisible(false);
    }
  };
  
  // Handle click on the suggestion
  const handleSuggestionClick = () => {
    if (expanded) {
      // If expanded, clicking sets it as active and notifies parent
      if (currentSuggestion) {
        setActiveSuggestion(currentSuggestion);
        
        if (onSuggestionSelect) {
          onSuggestionSelect(currentSuggestion);
        }
      }
    } else {
      // If not expanded, expand it
      setExpanded(true);
    }
  };
  
  // If not visible or no suggestion, don't render
  if (!visible || !currentSuggestion) {
    return null;
  }
  
  return (
    <div 
      className={`
        fixed left-0 right-0 transition-transform duration-300 ease-in-out z-50
        ${position === 'top' ? 'top-0' : 'bottom-0'}
        ${visible ? 'translate-y-0' : position === 'top' ? '-translate-y-full' : 'translate-y-full'}
      `}
    >
      <div 
        className={`
          mx-auto max-w-xl bg-white shadow-lg border-l border-r border-b rounded-b-lg
          ${expanded ? 'p-4' : 'p-3'}
          ${position === 'top' ? '' : 'rounded-t-lg rounded-b-none border-t border-b-0'}
        `}
      >
        {/* Simple view (collapsed) */}
        <div 
          className={`flex items-center justify-between ${expanded ? 'hidden' : 'block'}`}
          onClick={handleSuggestionClick}
        >
          <div className="flex items-center space-x-3 flex-grow cursor-pointer">
            {/* Icon based on suggestion type */}
            {renderSuggestionIcon(currentSuggestion.type)}
            
            <div className="flex-grow">
              <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                {currentSuggestion.title}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
              className="text-xs text-primary"
            >
              More
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Expanded view */}
        <div className={expanded ? 'block' : 'hidden'}>
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              {/* Icon based on suggestion type */}
              {renderSuggestionIcon(currentSuggestion.type)}
              
              <div>
                <h3 className="text-base font-medium text-gray-900">
                  {currentSuggestion.title}
                </h3>
                <span className={`
                  text-xs px-2 py-0.5 rounded-full mt-1 inline-block
                  ${getCategoryColor(currentSuggestion.category)}
                `}>
                  {formatCategory(currentSuggestion.category)}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <p className="mt-2 text-sm text-gray-600">
            {currentSuggestion.description}
          </p>
          
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={handleDismiss}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              Dismiss
            </button>
            
            <button
              onClick={handleSuggestionClick}
              className="text-sm px-3 py-1 border border-primary text-primary rounded hover:bg-primary-light"
            >
              Details
            </button>
            
            <button
              onClick={handleImplement}
              className="text-sm px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark"
            >
              {getActionText(currentSuggestion.type)}
            </button>
          </div>
        </div>
      </div>
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
