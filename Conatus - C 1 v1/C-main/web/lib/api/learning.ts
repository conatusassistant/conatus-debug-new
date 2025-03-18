/**
 * API client for the Adaptive Learning System
 */

import { apiClient } from './index';
import { Suggestion, SuggestionPreferences, SuggestionFeedback } from '@/lib/suggestions';

/**
 * Track a user event for pattern detection
 * @param userId - User ID
 * @param eventType - Type of event
 * @param metadata - Additional event data
 * @param deviceInfo - Device information
 * @param locationInfo - Location information
 */
export const trackEvent = async (
  userId: string,
  eventType: string,
  metadata: Record<string, any> = {},
  deviceInfo?: Record<string, any>,
  locationInfo?: Record<string, any>
): Promise<void> => {
  try {
    await apiClient.post('/learning/events', {
      userId,
      eventType,
      metadata,
      deviceInfo,
      locationInfo,
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    // Don't throw error to prevent disrupting user experience
  }
};

/**
 * Get suggestions for a user
 * @param userId - User ID
 * @returns Array of suggestions
 */
export const getSuggestions = async (userId: string): Promise<Suggestion[]> => {
  try {
    const response = await apiClient.get(`/learning/suggestions/${userId}`);
    return response.data.suggestions || [];
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return [];
  }
};

/**
 * Dismiss a suggestion
 * @param suggestionId - Suggestion ID
 * @param userId - User ID
 */
export const dismissSuggestion = async (
  suggestionId: string,
  userId: string
): Promise<void> => {
  try {
    await apiClient.patch(`/learning/suggestions/${suggestionId}`, {
      action: 'dismiss',
      userId,
    });
  } catch (error) {
    console.error('Error dismissing suggestion:', error);
    throw error;
  }
};

/**
 * Implement a suggestion
 * @param suggestionId - Suggestion ID
 * @param userId - User ID
 */
export const implementSuggestion = async (
  suggestionId: string,
  userId: string
): Promise<void> => {
  try {
    await apiClient.patch(`/learning/suggestions/${suggestionId}`, {
      action: 'implement',
      userId,
    });
  } catch (error) {
    console.error('Error implementing suggestion:', error);
    throw error;
  }
};

/**
 * Submit feedback for a suggestion
 * @param feedback - Feedback data
 */
export const submitFeedback = async (
  feedback: SuggestionFeedback & { userId: string }
): Promise<void> => {
  try {
    await apiClient.post('/learning/feedback', feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
};

/**
 * Get user preferences for suggestions
 * @param userId - User ID
 * @returns User preferences
 */
export const getPreferences = async (
  userId: string
): Promise<SuggestionPreferences> => {
  try {
    const response = await apiClient.get(`/learning/preferences/${userId}`);
    return response.data.preferences;
  } catch (error) {
    console.error('Error getting preferences:', error);
    
    // Return default preferences if API fails
    return {
      enabled: true,
      categoriesEnabled: {
        productivity: true,
        communication: true,
        transportation: true,
        food: true,
        entertainment: true,
        system: true,
      },
      minRelevanceThreshold: 0.6,
      maxSuggestionsPerDay: 10,
      maxSuggestionsVisible: 3,
      suggestionsDisplayMode: 'both',
      sensitivityLevel: 'medium',
    };
  }
};

/**
 * Update user preferences for suggestions
 * @param userId - User ID
 * @param preferences - Updated preferences
 */
export const updatePreferences = async (
  userId: string,
  preferences: SuggestionPreferences
): Promise<void> => {
  try {
    await apiClient.put(`/learning/preferences/${userId}`, preferences);
  } catch (error) {
    console.error('Error updating preferences:', error);
    throw error;
  }
};
