'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { 
  Suggestion, 
  SuggestionPreferences,
  SuggestionFeedback,
  SuggestionType,
  SuggestionCategory
} from '@/lib/suggestions';
import { 
  useSuggestions, 
  useDismissSuggestion, 
  useImplementSuggestion, 
  useSubmitFeedback, 
  usePreferences, 
  useUpdatePreferences 
} from '@/lib/hooks/useModernSuggestions';
import { trackEvent as apiTrackEvent } from '@/lib/api/learning';
import type { TrackingEventType } from '@/lib/tracking';

// Context state definition
interface AdaptiveLearningContextState {
  // Suggestions
  suggestions: Suggestion[];
  activeSuggestion: Suggestion | null;
  suggestionsEnabled: boolean;
  suggestionsLoading: boolean;
  lastSuggestionUpdate: Date | null;
  
  // Preferences
  preferences: SuggestionPreferences;
  preferencesLoading: boolean;
  
  // Methods for suggestions
  getSuggestions: () => Promise<Suggestion[]>;
  refreshSuggestions: () => Promise<void>;
  dismissSuggestion: (suggestionId: string) => Promise<void>;
  implementSuggestion: (suggestionId: string) => Promise<void>;
  provideFeedback: (feedback: SuggestionFeedback) => Promise<void>;
  setActiveSuggestion: (suggestion: Suggestion | null) => void;
  
  // Methods for preferences
  updatePreferences: (preferences: Partial<SuggestionPreferences>) => Promise<void>;
  toggleSuggestions: () => Promise<void>;
  
  // Tracking methods
  trackEvent: (eventType: TrackingEventType, metadata: Record<string, any>) => Promise<void>;
}

// Create context
const AdaptiveLearningContext = createContext<AdaptiveLearningContextState | undefined>(undefined);

// Provider component
export function AdaptiveLearningProvider({ children }: { children: ReactNode }) {
  // Authentication
  const { user } = useAuth();
  
  // State
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [lastSuggestionUpdate, setLastSuggestionUpdate] = useState<Date | null>(null);
  
  // Get suggestions and preferences from React Query
  const { 
    data: suggestions = [], 
    isLoading: suggestionsLoading, 
    refetch: refetchSuggestions 
  } = useSuggestions(user?.id);
  
  const { 
    data: preferences = {
      enabled: true,
      categoriesEnabled: {
        productivity: true,
        communication: true,
        transportation: true,
        food: true,
        entertainment: true,
        system: true
      },
      minRelevanceThreshold: 0.6,
      maxSuggestionsPerDay: 10,
      maxSuggestionsVisible: 3,
      suggestionsDisplayMode: 'both',
      sensitivityLevel: 'medium'
    }, 
    isLoading: preferencesLoading 
  } = usePreferences(user?.id);
  
  // Get mutation hooks
  const dismissMutation = useDismissSuggestion();
  const implementMutation = useImplementSuggestion();
  const feedbackMutation = useSubmitFeedback();
  const updatePreferencesMutation = useUpdatePreferences();
  
  // Memoize whether suggestions are enabled
  const suggestionsEnabled = useMemo(() => {
    return preferences.enabled;
  }, [preferences]);
  
  /**
   * Track a user event
   * @param eventType - Type of event to track
   * @param metadata - Additional event data
   */
  const trackEvent = async (eventType: TrackingEventType, metadata: Record<string, any>) => {
    if (!user) return;
    
    try {
      // Get device information
      const deviceInfo = {
        type: getDeviceType(),
        platform: navigator.platform,
        browser: getBrowserName()
      };
      
      // Get location for relevant events
      let locationInfo = undefined;
      if (
        eventType === 'transportation_booked' || 
        eventType === 'food_ordered' || 
        eventType === 'location_changed'
      ) {
        locationInfo = await getCurrentLocation();
      }
      
      // Send to API
      await apiTrackEvent(user.id, eventType, metadata, deviceInfo, locationInfo);
      
      // For events that should trigger a suggestions refresh
      const refreshEvents: TrackingEventType[] = [
        'location_changed',
        'transportation_booked',
        'food_ordered',
        'calendar_event_created',
        'message_sent',
        'notification_sent',
        'app_opened'
      ];
      
      if (refreshEvents.includes(eventType)) {
        refreshSuggestions();
      }
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };
  
  /**
   * Get device type
   */
  const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
    const ua = window.navigator.userAgent;
    
    if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return 'mobile';
    }
    
    if (/iPad|Android(?!.*Mobile)/i.test(ua)) {
      return 'tablet';
    }
    
    return 'desktop';
  };
  
  /**
   * Get browser name
   */
  const getBrowserName = (): string => {
    const ua = window.navigator.userAgent;
    
    if (ua.indexOf('Firefox') > -1) {
      return 'Firefox';
    } else if (ua.indexOf('SamsungBrowser') > -1) {
      return 'Samsung';
    } else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
      return 'Opera';
    } else if (ua.indexOf('Trident') > -1) {
      return 'Internet Explorer';
    } else if (ua.indexOf('Edge') > -1) {
      return 'Edge';
    } else if (ua.indexOf('Chrome') > -1) {
      return 'Chrome';
    } else if (ua.indexOf('Safari') > -1) {
      return 'Safari';
    }
    
    return 'Unknown';
  };
  
  /**
   * Get current location
   */
  const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (!navigator.geolocation) {
      return null;
    }
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          resolve(null);
        },
        { timeout: 5000, maximumAge: 600000 }
      );
    });
  };
  
  /**
   * Get available suggestions
   * @returns Array of relevant suggestions
   */
  const getSuggestions = async (): Promise<Suggestion[]> => {
    if (!user || !suggestionsEnabled) {
      return [];
    }
    
    try {
      const result = await refetchSuggestions();
      setLastSuggestionUpdate(new Date());
      return result.data || [];
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }
  };
  
  /**
   * Refresh suggestions
   */
  const refreshSuggestions = async (): Promise<void> => {
    if (!user || !suggestionsEnabled) {
      return;
    }
    
    await getSuggestions();
  };
  
  /**
   * Dismiss a suggestion
   * @param suggestionId - ID of suggestion to dismiss
   */
  const dismissSuggestion = async (suggestionId: string): Promise<void> => {
    if (!user) return;
    
    try {
      await dismissMutation.mutateAsync({ suggestionId, userId: user.id });
      
      // If this was the active suggestion, clear it
      if (activeSuggestion?.id === suggestionId) {
        setActiveSuggestion(null);
      }
      
      // Track the event
      trackEvent('suggestion_dismissed', {
        suggestionId
      });
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
      throw error;
    }
  };
  
  /**
   * Implement a suggestion
   * @param suggestionId - ID of suggestion to implement
   */
  const implementSuggestion = async (suggestionId: string): Promise<void> => {
    if (!user) return;
    
    try {
      // Find the suggestion
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (!suggestion) return;
      
      await implementMutation.mutateAsync({ suggestionId, userId: user.id });
      
      // If this was the active suggestion, clear it
      if (activeSuggestion?.id === suggestionId) {
        setActiveSuggestion(null);
      }
      
      // Track the event
      trackEvent('suggestion_accepted', {
        suggestionId,
        suggestionType: suggestion.type,
        suggestionCategory: suggestion.category
      });
    } catch (error) {
      console.error('Error implementing suggestion:', error);
      throw error;
    }
  };
  
  /**
   * Provide feedback for a suggestion
   * @param feedback - Feedback data
   */
  const provideFeedback = async (feedback: SuggestionFeedback): Promise<void> => {
    if (!user) return;
    
    try {
      await feedbackMutation.mutateAsync({
        ...feedback,
        userId: user.id
      });
      
      // Track the event
      trackEvent('suggestion_dismissed', {
        suggestionId: feedback.suggestionId,
        feedback: {
          relevant: feedback.relevant,
          helpful: feedback.helpful,
          reason: feedback.reasonIfIrrelevant
        }
      });
    } catch (error) {
      console.error('Error providing feedback:', error);
      throw error;
    }
  };
  
  /**
   * Update user preferences
   * @param newPreferences - Partial preferences to update
   */
  const updatePreferences = async (newPreferences: Partial<SuggestionPreferences>): Promise<void> => {
    if (!user) return;
    
    try {
      const updatedPreferences = {
        ...preferences,
        ...newPreferences
      };
      
      await updatePreferencesMutation.mutateAsync({
        userId: user.id,
        preferences: updatedPreferences
      });
      
      // Track the event
      trackEvent('settings_changed', {
        settingType: 'suggestion_preferences',
        newValues: newPreferences
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  };
  
  /**
   * Toggle suggestions on/off
   */
  const toggleSuggestions = async (): Promise<void> => {
    if (!user) return;
    
    try {
      await updatePreferences({
        enabled: !preferences.enabled
      });
    } catch (error) {
      console.error('Error toggling suggestions:', error);
      throw error;
    }
  };
  
  // Context value
  const value: AdaptiveLearningContextState = {
    // State
    suggestions,
    activeSuggestion,
    suggestionsEnabled,
    suggestionsLoading,
    lastSuggestionUpdate,
    preferences,
    preferencesLoading,
    
    // Methods
    getSuggestions,
    refreshSuggestions,
    dismissSuggestion,
    implementSuggestion,
    provideFeedback,
    setActiveSuggestion,
    updatePreferences,
    toggleSuggestions,
    trackEvent
  };
  
  return (
    <AdaptiveLearningContext.Provider value={value}>
      {children}
    </AdaptiveLearningContext.Provider>
  );
}

// Hook for using the context
export function useAdaptiveLearning() {
  const context = useContext(AdaptiveLearningContext);
  if (context === undefined) {
    throw new Error('useAdaptiveLearning must be used within an AdaptiveLearningProvider');
  }
  return context;
}