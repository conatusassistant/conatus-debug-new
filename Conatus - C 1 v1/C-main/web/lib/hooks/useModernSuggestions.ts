/**
 * Modern React Query hooks for the Adaptive Learning System
 * Compatible with React Query v5
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSuggestions, dismissSuggestion, implementSuggestion, submitFeedback, getPreferences, updatePreferences } from '@/lib/api/learning';
import { Suggestion, SuggestionPreferences, SuggestionFeedback } from '@/lib/suggestions';

// Default preferences
const defaultPreferences = {
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
};

/**
 * Hook to get suggestions for a user
 */
export function useSuggestions(userId?: string, enabled = true) {
  const query = useQuery({
    queryKey: ['suggestions', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        return await getSuggestions(userId);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        return [];
      }
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return query;
}

/**
 * Hook to dismiss a suggestion
 */
export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ suggestionId, userId }: { suggestionId: string; userId: string }) => {
      return await dismissSuggestion(suggestionId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ['suggestions', variables.userId],
        (oldData: Suggestion[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter(
            (suggestion) => suggestion.id !== variables.suggestionId
          );
        }
      );
    },
  });
}

/**
 * Hook to implement a suggestion
 */
export function useImplementSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ suggestionId, userId }: { suggestionId: string; userId: string }) => {
      return await implementSuggestion(suggestionId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ['suggestions', variables.userId],
        (oldData: Suggestion[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter(
            (suggestion) => suggestion.id !== variables.suggestionId
          );
        }
      );
    },
  });
}

/**
 * Hook to submit feedback for a suggestion
 */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async (feedback: SuggestionFeedback & { userId: string }) => {
      return await submitFeedback(feedback);
    }
  });
}

/**
 * Hook to get user preferences for suggestions
 */
export function usePreferences(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ['preferences', userId],
    queryFn: async () => {
      if (!userId) return defaultPreferences;
      try {
        return await getPreferences(userId);
      } catch (error) {
        console.error('Error fetching preferences:', error);
        return defaultPreferences;
      }
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to update user preferences for suggestions
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      userId,
      preferences,
    }: {
      userId: string;
      preferences: SuggestionPreferences;
    }) => {
      return await updatePreferences(userId, preferences);
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ['preferences', variables.userId],
        variables.preferences
      );
      
      queryClient.invalidateQueries({
        queryKey: ['suggestions', variables.userId]
      });
    },
  });
}