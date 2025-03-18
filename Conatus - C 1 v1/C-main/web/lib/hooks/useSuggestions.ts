/**
 * React Query hooks for the Adaptive Learning System
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSuggestions, dismissSuggestion, implementSuggestion, submitFeedback, getPreferences, updatePreferences } from '@/lib/api/learning';
import { Suggestion, SuggestionPreferences, SuggestionFeedback } from '@/lib/suggestions';

/**
 * Hook to get suggestions for a user
 * @param userId - User ID
 * @param enabled - Whether to enable the query
 */
export const useSuggestions = (userId?: string, enabled = true) => {
  return useQuery({
    queryKey: ['suggestions', userId],
    queryFn: () => getSuggestions(userId!),
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to dismiss a suggestion
 */
export const useDismissSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, userId }: { suggestionId: string; userId: string }) =>
      dismissSuggestion(suggestionId, userId),
    onSuccess: (_, variables) => {
      // Update suggestions query data
      queryClient.setQueryData<Suggestion[] | undefined>(
        ['suggestions', variables.userId],
        (oldData) => {
          if (!oldData) return [];
          // Remove the dismissed suggestion
          return oldData.filter(
            (suggestion) => suggestion.id !== variables.suggestionId
          );
        }
      );
    },
  });
};

/**
 * Hook to implement a suggestion
 */
export const useImplementSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, userId }: { suggestionId: string; userId: string }) =>
      implementSuggestion(suggestionId, userId),
    onSuccess: (_, variables) => {
      // Update suggestions query data
      queryClient.setQueryData<Suggestion[] | undefined>(
        ['suggestions', variables.userId],
        (oldData) => {
          if (!oldData) return [];
          // Remove the implemented suggestion
          return oldData.filter(
            (suggestion) => suggestion.id !== variables.suggestionId
          );
        }
      );
    },
  });
};

/**
 * Hook to submit feedback for a suggestion
 */
export const useSubmitFeedback = () => {
  return useMutation({
    mutationFn: (feedback: SuggestionFeedback & { userId: string }) =>
      submitFeedback(feedback)
  });
};

/**
 * Hook to get user preferences for suggestions
 * @param userId - User ID
 * @param enabled - Whether to enable the query
 */
export const usePreferences = (userId?: string, enabled = true) => {
  return useQuery({
    queryKey: ['preferences', userId],
    queryFn: () => getPreferences(userId!),
    enabled: !!userId && enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to update user preferences for suggestions
 */
export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      preferences,
    }: {
      userId: string;
      preferences: SuggestionPreferences;
    }) => updatePreferences(userId, preferences),
    onSuccess: (_, variables) => {
      // Update preferences query data
      queryClient.setQueryData(
        ['preferences', variables.userId],
        variables.preferences
      );
      
      // Invalidate suggestions since they depend on preferences
      queryClient.invalidateQueries({
        queryKey: ['suggestions', variables.userId]
      });
    },
  });
};
