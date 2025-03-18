'use client';

import React from 'react';
import { Suggestion } from '@/lib/suggestions';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';

interface SuggestionDetailsProps {
  suggestion?: Suggestion;
  showActions?: boolean;
  onClose?: () => void;
}

export default function SuggestionDetails({
  suggestion,
  showActions = true,
  onClose
}: SuggestionDetailsProps) {
  const { 
    activeSuggestion, 
    dismissSuggestion, 
    implementSuggestion,
    setActiveSuggestion
  } = useAdaptiveLearning();
  
  // Use provided suggestion or active suggestion from context
  const currentSuggestion = suggestion || activeSuggestion;
  
  // Handle close
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    
    // Clear active suggestion if using the one from context
    if (!suggestion && activeSuggestion) {
      setActiveSuggestion(null);
    }
  };
  
  // Handle dismiss
  const handleDismiss = () => {
    if (currentSuggestion) {
      dismissSuggestion(currentSuggestion.id || '');
      handleClose();
    }
  };
  
  // Handle implement
  const handleImplement = () => {
    if (currentSuggestion) {
      implementSuggestion(currentSuggestion.id || '');
      handleClose();
    }
  };
  
  // Render empty state if no suggestion
  if (!currentSuggestion) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-500">No suggestion selected</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {/* Icon based on suggestion type */}
          {renderSuggestionIcon(currentSuggestion.type)}
          
          <h2 className="text-lg font-medium text-gray-900">
            Suggestion Details
          </h2>
        </div>
        
        {onClose && (
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Title and metadata */}
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {currentSuggestion.title}
          </h3>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Category badge */}
            <span className={`
              text-xs px-2 py-1 rounded-full 
              ${getCategoryColor(currentSuggestion.category)}
            `}>
              {formatCategory(currentSuggestion.category)}
            </span>
            
            {/* Type badge */}
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
              {formatType(currentSuggestion.type)}
            </span>
            
            {/* Relevance badge */}
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
              Relevance: {Math.round(currentSuggestion.relevanceScore * 100)}%
            </span>
          </div>
          
          <p className="text-gray-600 mb-4">
            {currentSuggestion.description}
          </p>
        </div>
        
        {/* Origin */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Why am I seeing this?
          </h4>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              {getPatternExplanation(currentSuggestion)}
            </p>
            <div className="mt-1 flex items-center">
              <div className="h-2 bg-gray-200 rounded-full w-full max-w-xs">
                <div
                  className="h-2 bg-primary rounded-full"
                  style={{ width: `${currentSuggestion.source.confidence * 100}%` }}
                ></div>
              </div>
              <span className="ml-2 text-xs text-gray-500">
                {Math.round(currentSuggestion.source.confidence * 100)}% confidence
              </span>
            </div>
          </div>
        </div>
        
        {/* Relevance factors */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Relevance Factors
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {currentSuggestion.relevanceFactors.map((factor, index) => (
              <div key={index} className="bg-gray-50 p-2 rounded">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700">{formatFactor(factor.factor)}</span>
                  <span className="text-gray-500">{Math.round(factor.score * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full">
                  <div
                    className="h-1.5 bg-primary rounded-full"
                    style={{ width: `${factor.score * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Implementation details */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Implementation Details
          </h4>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              {getImplementationDetails(currentSuggestion)}
            </p>
          </div>
        </div>
        
        {/* Timing */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Created: {formatDate(currentSuggestion.created)}</span>
            {currentSuggestion.expires && (
              <span>Expires: {formatDate(currentSuggestion.expires)}</span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        {showActions && (
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Dismiss
            </button>
            
            <button
              onClick={handleImplement}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {getActionText(currentSuggestion.type)}
            </button>
          </div>
        )}
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

// Format type name
function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// Format relevance factor
function formatFactor(factor: string): string {
  switch (factor) {
    case 'time':
      return 'Time Relevance';
    case 'location':
      return 'Location Relevance';
    case 'frequency':
      return 'Frequency Pattern';
    case 'user_preference':
      return 'Your Preference';
    case 'feedback':
      return 'Based on Feedback';
    case 'context':
      return 'Current Context';
    case 'urgency':
      return 'Time Sensitivity';
    case 'importance':
      return 'Importance';
    default:
      return factor.charAt(0).toUpperCase() + factor.slice(1).replace('_', ' ');
  }
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

// Get pattern explanation based on suggestion source
function getPatternExplanation(suggestion: Suggestion): string {
  const { patternType } = suggestion.source;
  
  switch (patternType) {
    case 'time':
      return 'This suggestion is based on a time pattern we detected in your behavior. You often perform similar actions around this time.';
    case 'sequence':
      return 'This suggestion is based on a sequence of actions we detected. You often perform these actions together.';
    case 'frequency':
      return 'This suggestion is based on how frequently you perform certain actions. We noticed a regular pattern in your behavior.';
    case 'location':
      return 'This suggestion is based on your location patterns. You often perform similar actions in this area.';
    default:
      return 'This suggestion is based on patterns we detected in your behavior.';
  }
}

// Get implementation details based on suggestion
function getImplementationDetails(suggestion: Suggestion): string {
  const { type, actionParams } = suggestion;
  
  switch (type) {
    case 'automation':
      if (actionParams?.timePattern) {
        return `This will create an automation that runs ${formatTimePattern(actionParams.timePattern)} and performs the specified actions automatically.`;
      } else if (actionParams?.location) {
        return `This will create a location-based automation that triggers when you're near ${formatLocation(actionParams.location)}.`;
      } else if (actionParams?.steps) {
        return `This will create an automation that performs ${actionParams.steps.length} actions in sequence.`;
      }
      return 'This will create an automation based on your usage patterns.';
    
    case 'action':
      return 'This will perform the suggested action immediately.';
    
    case 'reminder':
      return 'This will set up a reminder based on the detected pattern.';
    
    case 'connection':
      return 'This will help you connect a service to enhance your experience.';
    
    case 'feature':
      return 'This will introduce you to a feature that might be helpful based on your usage patterns.';
    
    default:
      return 'Implementing this suggestion will enhance your experience based on your usage patterns.';
  }
}

// Format time pattern
function formatTimePattern(timePattern: any): string {
  const parts = [];
  
  if (timePattern.timeOfDay) {
    const { hour, minute } = timePattern.timeOfDay;
    const hour12 = hour % 12 || 12;
    const amPm = hour < 12 ? 'AM' : 'PM';
    parts.push(`at ${hour12}:${minute.toString().padStart(2, '0')} ${amPm}`);
  }
  
  if (timePattern.dayOfWeek && timePattern.dayOfWeek.length) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNames = timePattern.dayOfWeek.map((day: number) => daysOfWeek[day]);
    
    if (dayNames.length === 7) {
      parts.push('every day');
    } else if (dayNames.length === 5 && 
              !timePattern.dayOfWeek.includes(0) && 
              !timePattern.dayOfWeek.includes(6)) {
      parts.push('on weekdays');
    } else if (dayNames.length === 2 && 
              timePattern.dayOfWeek.includes(0) && 
              timePattern.dayOfWeek.includes(6)) {
      parts.push('on weekends');
    } else {
      parts.push(`on ${dayNames.join(', ')}`);
    }
  }
  
  return parts.join(' ') || 'on a schedule';
}

// Format location
function formatLocation(location: any): string {
  if (location.locationName) {
    return location.locationName;
  }
  return `the specified location`;
}

// Get action button text based on suggestion type
function getActionText(type: string): string {
  switch (type) {
    case 'automation':
      return 'Create Automation';
    case 'action':
      return 'Perform Action';
    case 'reminder':
      return 'Set Reminder';
    case 'connection':
      return 'Connect Service';
    case 'feature':
      return 'Try Feature';
    default:
      return 'Implement';
  }
}
