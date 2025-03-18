'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLLMRouter } from '@/context/LLMRouterContext';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';
import { SuggestionBanner, SuggestionDisplay, SuggestionDetails } from '@/components/suggestions';
import { ChatContainer, ModelSelector, ModelExplanation } from '@/components/llm-router';
import { measurePerformance } from '@/lib/performance';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { 
    sendMessage, 
    messages, 
    isLoading: messageLoading,
    selectedModel,
    autoSelectModel,
    setAutoSelectModel,
    setSelectedModel
  } = useLLMRouter();
  
  const { 
    suggestions, 
    activeSuggestion, 
    setActiveSuggestion,
    refreshSuggestions,
    trackEvent,
    dismissSuggestion,
    implementSuggestion
  } = useAdaptiveLearning();
  
  const [showModelExplanation, setShowModelExplanation] = useState(false);
  const [showSuggestionDetails, setShowSuggestionDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Refresh suggestions when page loads
  useEffect(() => {
    if (user) {
      // Track app opened event
      trackEvent('app_opened', { 
        page: 'home',
        timestamp: new Date().toISOString() 
      });
      
      // Refresh suggestions for the user
      refreshSuggestions();
    }
  }, [user, trackEvent, refreshSuggestions]);
  
  // Handle sending a message
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
    
    await measurePerformance('chat-response', async () => {
      await sendMessage(message);
      
      // Track message sent event for adaptive learning
      trackEvent('message_sent', {
        length: message.length,
        model: selectedModel,
        timestamp: new Date().toISOString()
      });
      
      // Refresh suggestions after sending message
      await refreshSuggestions();
    });
  };
  
  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: any) => {
    setActiveSuggestion(suggestion);
    setShowSuggestionDetails(true);
  };
  
  // Handle suggestion implementation
  const handleImplementSuggestion = async (suggestionId: string) => {
    await implementSuggestion(suggestionId);
    setShowSuggestionDetails(false);
    setActiveSuggestion(null);
    
    // If the suggestion is of type 'action', we'll simulate executing the action
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (suggestion && suggestion.type === 'action') {
      // Show a confirmation message in the chat
      const confirmationMessage = {
        role: 'assistant',
        content: `I've implemented your suggestion to ${suggestion.title.toLowerCase()}. Is there anything else you need?`,
        timestamp: new Date().toISOString(),
        model: 'system'
      };
      
      // This would normally be handled by the LLM router context
      // For simulation, we're adding a message directly
      // In a real implementation, this would go through the LLM router
      sendMessage('', confirmationMessage);
    }
  };
  
  // Handle suggestion dismissal
  const handleDismissSuggestion = async (suggestionId: string) => {
    await dismissSuggestion(suggestionId);
    setShowSuggestionDetails(false);
    setActiveSuggestion(null);
  };
  
  // Authentication state check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (!user) {
    router.push('/login');
    return null;
  }
  
  return (
    <div className="flex flex-col h-screen">
      {/* Top suggestion banner */}
      <SuggestionBanner 
        position="top"
        onSelect={handleSuggestionSelect}
        className="border-b border-gray-200"
      />
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Conatus AI</h1>
            <div className="flex items-center space-x-2">
              <ModelSelector 
                selectedModel={selectedModel}
                autoSelect={autoSelectModel}
                onSelectModel={setSelectedModel}
                onToggleAutoSelect={setAutoSelectModel}
                onShowExplanation={() => setShowModelExplanation(true)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4 bg-gray-50">
            <ChatContainer
              messages={messages}
              isLoading={messageLoading}
              onSendMessage={handleSendMessage}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* Right sidebar with suggestions */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-medium text-gray-800">Suggestions</h2>
            <p className="text-sm text-gray-500">Based on your activity</p>
          </div>
          
          <div className="p-4">
            <SuggestionDisplay 
              variant="compact"
              maxSuggestions={5}
              onSuggestionSelect={handleSuggestionSelect}
            />
          </div>
        </div>
      </div>
      
      {/* Model explanation modal */}
      {showModelExplanation && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">AI Model Selection</h2>
              <button 
                onClick={() => setShowModelExplanation(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <ModelExplanation />
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModelExplanation(false)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Suggestion details modal */}
      {showSuggestionDetails && activeSuggestion && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Suggestion Details</h2>
              <button 
                onClick={() => {
                  setShowSuggestionDetails(false);
                  setActiveSuggestion(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <SuggestionDetails 
              suggestion={activeSuggestion}
              onDismiss={() => handleDismissSuggestion(activeSuggestion.id)}
              onImplement={() => handleImplementSuggestion(activeSuggestion.id)}
            />
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  handleDismissSuggestion(activeSuggestion.id);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  handleImplementSuggestion(activeSuggestion.id);
                }}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
              >
                Implement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
