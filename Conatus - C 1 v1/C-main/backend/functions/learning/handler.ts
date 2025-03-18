import { APIGatewayProxyHandler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Track user events for pattern detection
 */
export const trackEvent: APIGatewayProxyHandler = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { userId, eventType, metadata, deviceInfo, locationInfo } = requestBody;
    
    // Validate required fields
    if (!userId || !eventType) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Missing required fields: userId, eventType' }),
      };
    }
    
    // Store event in database
    const { data, error } = await supabase
      .from('user_events')
      .insert([
        {
          user_id: userId,
          event_type: eventType,
          metadata,
          device_info: deviceInfo,
          location_info: locationInfo,
          timestamp: new Date().toISOString(),
        },
      ]);
    
    if (error) {
      console.error('Error storing event:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Failed to store event' }),
      };
    }
    
    // Trigger pattern analysis in background
    // This would typically be done asynchronously via a queue
    // For now, we'll just acknowledge the event was stored
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ success: true, message: 'Event tracked successfully' }),
    };
  } catch (error) {
    console.error('Error in trackEvent:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Get suggestions for a specific user
 */
export const getSuggestions: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = event.pathParameters?.userId;
    
    // Validate user ID
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Missing required parameter: userId' }),
      };
    }
    
    // Get user preferences to apply filters
    const { data: userPreferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (preferencesError && preferencesError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching user preferences:', preferencesError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Failed to fetch user preferences' }),
      };
    }
    
    // Set default preferences if none found
    const preferences = userPreferences || {
      enabled: true,
      min_relevance_threshold: 0.6,
      max_suggestions_visible: 3,
      categories_enabled: {
        productivity: true,
        communication: true,
        transportation: true,
        food: true,
        entertainment: true,
        system: true,
      },
    };
    
    // Skip if suggestions are disabled
    if (!preferences.enabled) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ suggestions: [] }),
      };
    }
    
    // Get active suggestions for the user
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('suggestions')
      .select('*')
      .eq('user_id', userId)
      .eq('dismissed', false)
      .eq('implemented', false)
      .gte('relevance_score', preferences.min_relevance_threshold)
      .order('relevance_score', { ascending: false });
    
    if (suggestionsError) {
      console.error('Error fetching suggestions:', suggestionsError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Failed to fetch suggestions' }),
      };
    }
    
    // Filter suggestions based on user preferences
    const filteredSuggestions = suggestions.filter(suggestion => {
      // Skip if category is disabled
      if (!preferences.categories_enabled[suggestion.category]) {
        return false;
      }
      
      // Skip if expired
      if (suggestion.expires && new Date(suggestion.expires) < new Date()) {
        return false;
      }
      
      return true;
    });
    
    // Limit to max visible suggestions
    const limitedSuggestions = filteredSuggestions.slice(0, preferences.max_suggestions_visible);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ suggestions: limitedSuggestions }),
    };
  } catch (error) {
    console.error('Error in getSuggestions:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Update suggestion status (dismiss or implement)
 */
export const updateSuggestion: APIGatewayProxyHandler = async (event) => {
  try {
    const suggestionId = event.pathParameters?.suggestionId;
    const requestBody = JSON.parse(event.body || '{}');
    const { action, userId } = requestBody;
    
    // Validate required fields
    if (!suggestionId || !action || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Missing required fields: suggestionId, action, userId' }),
      };
    }
    
    // Check if action is valid
    if (action !== 'dismiss' && action !== 'implement') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Invalid action: must be "dismiss" or "implement"' }),
      };
    }
    
    // Update suggestion status
    const updateData = action === 'dismiss' 
      ? { dismissed: true } 
      : { implemented: true };
    
    const { data, error } = await supabase
      .from('suggestions')
      .update(updateData)
      .eq('id', suggestionId)
      .eq('user_id', userId);
    
    if (error) {
      console.error(`Error ${action}ing suggestion:`, error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: `Failed to ${action} suggestion` }),
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ success: true, message: `Suggestion ${action}ed successfully` }),
    };
  } catch (error) {
    console.error('Error in updateSuggestion:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Submit feedback for a suggestion
 */
export const submitFeedback: APIGatewayProxyHandler = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { 
      suggestionId, 
      userId, 
      relevant, 
      helpful, 
      reasonIfIrrelevant, 
      comment 
    } = requestBody;
    
    // Validate required fields
    if (!suggestionId || !userId || relevant === undefined) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Missing required fields: suggestionId, userId, relevant' }),
      };
    }
    
    // Store feedback
    const { data, error } = await supabase
      .from('suggestion_feedback')
      .insert([
        {
          suggestion_id: suggestionId,
          user_id: userId,
          relevant,
          helpful,
          reason_if_irrelevant: reasonIfIrrelevant,
          comment,
          timestamp: new Date().toISOString(),
        },
      ]);
    
    if (error) {
      console.error('Error storing feedback:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Failed to store feedback' }),
      };
    }
    
    // Mark suggestion as having received feedback
    const { error: updateError } = await supabase
      .from('suggestions')
      .update({ feedback_provided: true })
      .eq('id', suggestionId)
      .eq('user_id', userId);
    
    if (updateError) {
      console.error('Error updating suggestion feedback status:', updateError);
      // Not critical, so we'll continue
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ success: true, message: 'Feedback submitted successfully' }),
    };
  } catch (error) {
    console.error('Error in submitFeedback:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Update user preferences for suggestions
 */
export const updatePreferences: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = event.pathParameters?.userId;
    const requestBody = JSON.parse(event.body || '{}');
    
    // Validate user ID
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Missing required parameter: userId' }),
      };
    }
    
    // Check if preferences already exist
    const { data: existingPreferences, error: checkError } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking existing preferences:', checkError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Failed to check existing preferences' }),
      };
    }
    
    // Format data for database
    const preferencesData = {
      user_id: userId,
      enabled: requestBody.enabled,
      min_relevance_threshold: requestBody.minRelevanceThreshold,
      max_suggestions_per_day: requestBody.maxSuggestionsPerDay,
      max_suggestions_visible: requestBody.maxSuggestionsVisible,
      suggestions_display_mode: requestBody.suggestionsDisplayMode,
      sensitivity_level: requestBody.sensitivityLevel,
      categories_enabled: requestBody.categoriesEnabled,
      disabled_until: requestBody.disabledUntil,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    
    // Update or insert preferences
    if (existingPreferences) {
      // Update existing preferences
      result = await supabase
        .from('user_preferences')
        .update(preferencesData)
        .eq('user_id', userId);
    } else {
      // Insert new preferences
      result = await supabase
        .from('user_preferences')
        .insert([{
          ...preferencesData,
          created_at: new Date().toISOString(),
        }]);
    }
    
    if (result.error) {
      console.error('Error updating preferences:', result.error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Failed to update preferences' }),
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ success: true, message: 'Preferences updated successfully' }),
    };
  } catch (error) {
    console.error('Error in updatePreferences:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Get user preferences for suggestions
 */
export const getPreferences: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = event.pathParameters?.userId;
    
    // Validate user ID
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Missing required parameter: userId' }),
      };
    }
    
    // Get user preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching user preferences:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Failed to fetch user preferences' }),
      };
    }
    
    // If no preferences found, return default values
    if (!data) {
      const defaultPreferences = {
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
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ preferences: defaultPreferences }),
      };
    }
    
    // Format response to match frontend structure
    const formattedPreferences = {
      enabled: data.enabled,
      categoriesEnabled: data.categories_enabled,
      minRelevanceThreshold: data.min_relevance_threshold,
      maxSuggestionsPerDay: data.max_suggestions_per_day,
      maxSuggestionsVisible: data.max_suggestions_visible,
      suggestionsDisplayMode: data.suggestions_display_mode,
      sensitivityLevel: data.sensitivity_level,
      disabledUntil: data.disabled_until,
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ preferences: formattedPreferences }),
    };
  } catch (error) {
    console.error('Error in getPreferences:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
