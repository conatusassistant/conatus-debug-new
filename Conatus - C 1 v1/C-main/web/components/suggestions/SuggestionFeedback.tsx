'use client';

import React, { useState } from 'react';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';
import { Suggestion, SuggestionFeedback as SuggestionFeedbackType } from '@/lib/suggestions';

interface SuggestionFeedbackProps {
  suggestion?: Suggestion;
  onComplete?: () => void;
  className?: string;
}

export default function SuggestionFeedback({
  suggestion,
  onComplete,
  className = ''
}: SuggestionFeedbackProps) {
  const { activeSuggestion, provideFeedback } = useAdaptiveLearning();
  
  // Use provided suggestion or active suggestion from context
  const currentSuggestion = suggestion || activeSuggestion;
  
  // State
  const [relevant, setRelevant] = useState<boolean | null>(null);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentSuggestion) return;
    
    // Create feedback object
    const feedback: SuggestionFeedbackType = {
      suggestionId: currentSuggestion.id || '',
      relevant: relevant === true,
      helpful: helpful === true,
      reasonIfIrrelevant: relevant === false ? reason as any : undefined,
      comment: comment.trim() !== '' ? comment : undefined,
      timestamp: new Date().toISOString()
    };
    
    // Submit feedback
    provideFeedback(feedback);
    
    // Show thank you message
    setSubmitted(true);
    
    // Notify parent after a delay
    if (onComplete) {
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  };
  
  // If no suggestion, show placeholder
  if (!currentSuggestion) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg text-center ${className}`}>
        <p className="text-gray-500">No suggestion selected</p>
      </div>
    );
  }
  
  // If already submitted, show thank you message
  if (submitted) {
    return (
      <div className={`p-6 bg-gray-50 rounded-lg text-center ${className}`}>
        <svg 
          className="w-12 h-12 text-green-500 mx-auto mb-3" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Thank You!</h3>
        <p className="text-gray-600">Your feedback helps us improve our suggestions.</p>
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-lg shadow-sm border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 border-b px-4 py-3">
        <h2 className="text-lg font-medium text-gray-900">
          Provide Feedback
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Help us improve our suggestions by sharing your thoughts
        </p>
      </div>
      
      {/* Feedback Form */}
      <form onSubmit={handleSubmit} className="p-4">
        {/* Suggestion info */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            About this suggestion:
          </h3>
          <p className="text-sm text-gray-600">
            {currentSuggestion.title}
          </p>
        </div>
        
        {/* Relevance question */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Was this suggestion relevant to you?
          </h4>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setRelevant(true)}
              className={`
                flex-1 p-3 rounded-lg border text-sm font-medium
                ${relevant === true 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
              `}
            >
              Yes, it was relevant
            </button>
            
            <button
              type="button"
              onClick={() => setRelevant(false)}
              className={`
                flex-1 p-3 rounded-lg border text-sm font-medium
                ${relevant === false 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
              `}
            >
              No, not relevant
            </button>
          </div>
        </div>
        
        {/* If not relevant, ask why */}
        {relevant === false && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Why wasn't this suggestion relevant?
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReason('timing')}
                className={`
                  p-2 rounded-lg border text-sm
                  ${reason === 'timing' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
                `}
              >
                Bad timing
              </button>
              
              <button
                type="button"
                onClick={() => setReason('category')}
                className={`
                  p-2 rounded-lg border text-sm
                  ${reason === 'category' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
                `}
              >
                Wrong category
              </button>
              
              <button
                type="button"
                onClick={() => setReason('frequency')}
                className={`
                  p-2 rounded-lg border text-sm
                  ${reason === 'frequency' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
                `}
              >
                Too many suggestions
              </button>
              
              <button
                type="button"
                onClick={() => setReason('not_interested')}
                className={`
                  p-2 rounded-lg border text-sm
                  ${reason === 'not_interested' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
                `}
              >
                Not interested
              </button>
            </div>
          </div>
        )}
        
        {/* If relevant, ask if helpful */}
        {relevant === true && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Was this suggestion helpful?
            </h4>
            
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setHelpful(true)}
                className={`
                  flex-1 p-3 rounded-lg border text-sm font-medium
                  ${helpful === true 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
                `}
              >
                Yes, very helpful
              </button>
              
              <button
                type="button"
                onClick={() => setHelpful(false)}
                className={`
                  flex-1 p-3 rounded-lg border text-sm font-medium
                  ${helpful === false 
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'}
                `}
              >
                Could be better
              </button>
            </div>
          </div>
        )}
        
        {/* Additional comments */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Additional comments (optional)
          </h4>
          
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm"
            rows={3}
            placeholder="Share any additional thoughts on this suggestion..."
          />
        </div>
        
        {/* Submit button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={relevant === null}
            className={`
              px-4 py-2 rounded-md text-white font-medium
              ${relevant !== null 
                ? 'bg-primary hover:bg-primary-dark' 
                : 'bg-gray-300 cursor-not-allowed'}
            `}
          >
            Submit Feedback
          </button>
        </div>
      </form>
    </div>
  );
}
