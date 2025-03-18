/**
 * Suggestion Engine for Adaptive Learning System
 * 
 * Generates contextual recommendations based on detected patterns
 * in user behavior, adapts to user preferences, and filters
 * suggestions based on context.
 */

import { Pattern, TimePattern, SequencePattern, FrequencyPattern, LocationPattern } from '../analysis/patterns';
import { BehaviorPattern } from '../tracking';

// Suggestion types
export type SuggestionType = 
  | 'automation' // Suggest creating an automation
  | 'action' // Suggest a specific action to take
  | 'reminder' // Remind about something
  | 'connection' // Suggest connecting a service
  | 'feature' // Suggest using a feature;

// Relevance factors for scoring
export type RelevanceFactor = 
  | 'time' // Time-based relevance
  | 'frequency' // Frequency-based relevance
  | 'location' // Location-based relevance
  | 'user_preference' // User's stated preferences
  | 'feedback' // Based on previous feedback
  | 'context' // Current context (activity, etc)
  | 'urgency' // Time-sensitive suggestions
  | 'importance' // Value to the user;

// Categories for filtering
export type SuggestionCategory = 
  | 'productivity' 
  | 'communication' 
  | 'transportation' 
  | 'food' 
  | 'entertainment'
  | 'system';

// Base suggestion interface
export interface Suggestion {
  id?: string;
  title: string;
  description: string;
  type: SuggestionType;
  category: SuggestionCategory;
  source: {
    patternType: Pattern['patternType'];
    patternId?: string;
    confidence: number;
  };
  relevanceScore: number;
  relevanceFactors: {
    factor: RelevanceFactor;
    score: number; // 0-1 score
  }[];
  created: string;
  expires?: string;
  actionParams?: Record<string, any>; // Parameters for implementing the suggestion
  dismissed?: boolean;
  implemented?: boolean;
  feedbackProvided?: boolean;
}

// User preference settings
export interface SuggestionPreferences {
  enabled: boolean;
  categoriesEnabled: Record<SuggestionCategory, boolean>;
  minRelevanceThreshold: number; // 0-1, minimum relevance to show suggestions
  maxSuggestionsPerDay: number;
  maxSuggestionsVisible: number;
  suggestionsDisplayMode: 'banner' | 'inline' | 'both';
  sensitivityLevel: 'low' | 'medium' | 'high';
  disabledUntil?: string; // Timestamp when suggestions should resume
}

// User feedback on suggestions
export interface SuggestionFeedback {
  suggestionId: string;
  relevant: boolean;
  helpful: boolean;
  reasonIfIrrelevant?: 'timing' | 'category' | 'frequency' | 'not_interested' | 'other';
  comment?: string;
  timestamp: string;
}

/**
 * Suggestion Engine class that generates recommendations based on patterns
 */
export class SuggestionEngine {
  private patterns: Pattern[] = [];
  private suggestions: Suggestion[] = [];
  private userPreferences: SuggestionPreferences = {
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
  private feedback: SuggestionFeedback[] = [];
  private implemented: Set<string> = new Set();
  private dismissed: Set<string> = new Set();
  
  /**
   * Initialize the engine with patterns
   * @param patterns - Detected patterns to use
   */
  initialize(patterns: Pattern[]): void {
    this.patterns = patterns;
    console.log(`Suggestion engine initialized with ${this.patterns.length} patterns`);
  }
  
  /**
   * Set user preferences for suggestions
   * @param preferences - User preference settings
   */
  setPreferences(preferences: Partial<SuggestionPreferences>): void {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences
    };
  }
  
  /**
   * Generate suggestions based on all patterns
   * @returns Array of generated suggestions
   */
  generateSuggestions(): Suggestion[] {
    if (!this.userPreferences.enabled) {
      return [];
    }
    
    this.suggestions = [];
    
    // Process each pattern type
    for (const pattern of this.patterns) {
      switch (pattern.patternType) {
        case 'time':
          this.processTimePattern(pattern as TimePattern);
          break;
        case 'sequence':
          this.processSequencePattern(pattern as SequencePattern);
          break;
        case 'frequency':
          this.processFrequencyPattern(pattern as FrequencyPattern);
          break;
        case 'location':
          this.processLocationPattern(pattern as LocationPattern);
          break;
      }
    }
    
    // Calculate relevance scores
    this.calculateRelevanceScores();
    
    // Filter and sort suggestions
    return this.getFilteredSuggestions();
  }
  
  /**
   * Get suggestions filtered by user preferences
   * @returns Filtered and sorted suggestions
   */
  getFilteredSuggestions(): Suggestion[] {
    // Filter by user preferences
    let filtered = this.suggestions.filter(suggestion => {
      // Skip if category is disabled
      if (!this.userPreferences.categoriesEnabled[suggestion.category]) {
        return false;
      }
      
      // Skip if below relevance threshold
      if (suggestion.relevanceScore < this.userPreferences.minRelevanceThreshold) {
        return false;
      }
      
      // Skip if dismissed or implemented
      if (
        this.dismissed.has(suggestion.id || '') || 
        this.implemented.has(suggestion.id || '')
      ) {
        return false;
      }
      
      // Skip if expired
      if (suggestion.expires && new Date(suggestion.expires) < new Date()) {
        return false;
      }
      
      return true;
    });
    
    // Sort by relevance
    filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Limit by max visible
    return filtered.slice(0, this.userPreferences.maxSuggestionsVisible);
  }
  
  /**
   * Process time-based patterns into suggestions
   * @param pattern - Time pattern to process
   */
  private processTimePattern(pattern: TimePattern): void {
    // Skip low confidence patterns
    if (pattern.confidence < 0.65) {
      return;
    }
    
    const now = new Date();
    
    // Create a title based on time pattern type
    let title = '';
    let description = '';
    let category: SuggestionCategory = 'productivity';
    let type: SuggestionType = 'automation';
    
    // Different suggestions based on event type
    switch (pattern.eventType) {
      case 'transportation_booked':
        title = 'Schedule your regular ride';
        description = 'You often book transportation around this time. Would you like to schedule it?';
        category = 'transportation';
        type = 'action';
        break;
        
      case 'food_ordered':
        title = 'Order your usual meal';
        description = 'You typically order food at this time. Would you like to place an order now?';
        category = 'food';
        type = 'action';
        break;
        
      case 'calendar_event_created':
        title = 'Create a recurring event';
        description = 'You often create calendar events at this time. Would you like to set up a recurring event?';
        category = 'productivity';
        type = 'automation';
        break;
        
      case 'message_sent':
        title = 'Schedule your regular check-in';
        description = 'You regularly send messages around this time. Would you like to automate a check-in?';
        category = 'communication';
        type = 'automation';
        break;
        
      default:
        title = `Automate your regular ${pattern.eventType.replace('_', ' ')}`;
        description = `You often perform this action at a similar time. Would you like to create an automation?`;
        category = 'productivity';
        type = 'automation';
    }
    
    // Create the suggestion
    const suggestion: Suggestion = {
      id: `time-${pattern.eventType}-${Date.now()}`,
      title,
      description,
      type,
      category,
      source: {
        patternType: 'time',
        confidence: pattern.confidence
      },
      relevanceScore: 0, // Will be calculated later
      relevanceFactors: [
        { factor: 'time', score: pattern.confidence },
        { factor: 'frequency', score: 0.7 }
      ],
      created: now.toISOString(),
      actionParams: {
        eventType: pattern.eventType,
        metadata: pattern.metadata,
        timePattern: {
          timeOfDay: pattern.timeOfDay,
          dayOfWeek: pattern.dayOfWeek,
          dayOfMonth: pattern.dayOfMonth,
          monthOfYear: pattern.monthOfYear
        }
      }
    };
    
    // Add expiration if it's a time-sensitive suggestion
    if (pattern.timeOfDay) {
      // Expire in 1 hour if it's about a specific time of day
      const expiresDate = new Date(now);
      expiresDate.setHours(expiresDate.getHours() + 1);
      suggestion.expires = expiresDate.toISOString();
    }
    
    this.suggestions.push(suggestion);
  }
  
  /**
   * Process sequence patterns into suggestions
   * @param pattern - Sequence pattern to process
   */
  private processSequencePattern(pattern: SequencePattern): void {
    // Skip low confidence patterns
    if (pattern.confidence < 0.7) {
      return;
    }
    
    const now = new Date();
    
    // Get the sequence steps
    const steps = pattern.steps.map(step => step.eventType);
    
    // Create suggestion
    const suggestion: Suggestion = {
      id: `sequence-${steps.join('-')}-${Date.now()}`,
      title: 'Automate this sequence of actions',
      description: `You often perform these actions in sequence: ${steps.join(' → ')}. Create an automation?`,
      type: 'automation',
      category: 'productivity',
      source: {
        patternType: 'sequence',
        confidence: pattern.confidence
      },
      relevanceScore: 0, // Will be calculated later
      relevanceFactors: [
        { factor: 'frequency', score: pattern.confidence },
        { factor: 'context', score: 0.8 }
      ],
      created: now.toISOString(),
      actionParams: {
        steps: pattern.steps,
        timeWindow: pattern.timeWindow
      }
    };
    
    this.suggestions.push(suggestion);
  }
  
  /**
   * Process frequency patterns into suggestions
   * @param pattern - Frequency pattern to process
   */
  private processFrequencyPattern(pattern: FrequencyPattern): void {
    // Skip low confidence patterns
    if (pattern.confidence < 0.65) {
      return;
    }
    
    const now = new Date();
    
    // Create a title based on frequency pattern
    let title = '';
    let description = '';
    let category: SuggestionCategory = 'productivity';
    let type: SuggestionType = 'automation';
    
    // Format for describing frequency
    const frequencyText = 
      `${pattern.frequency.count} time${pattern.frequency.count > 1 ? 's' : ''} per ${pattern.frequency.timeUnit}`;
    
    // Different suggestions based on event type
    switch (pattern.eventType) {
      case 'transportation_booked':
        title = 'Set up regular transportation';
        description = `You book transportation about ${frequencyText}. Would you like to create a schedule?`;
        category = 'transportation';
        type = 'automation';
        break;
        
      case 'food_ordered':
        title = 'Create a meal schedule';
        description = `You order food about ${frequencyText}. Would you like to create a meal plan?`;
        category = 'food';
        type = 'automation';
        break;
        
      case 'calendar_event_created':
        title = 'Streamline your calendar management';
        description = `You create calendar events about ${frequencyText}. Would you like scheduling assistance?`;
        category = 'productivity';
        type = 'feature';
        break;
        
      default:
        title = `Optimize your ${pattern.eventType.replace('_', ' ')} frequency`;
        description = `You perform this action about ${frequencyText}. Would you like to create a schedule?`;
        type = 'automation';
    }
    
    // Create the suggestion
    const suggestion: Suggestion = {
      id: `frequency-${pattern.eventType}-${Date.now()}`,
      title,
      description,
      type,
      category,
      source: {
        patternType: 'frequency',
        confidence: pattern.confidence
      },
      relevanceScore: 0, // Will be calculated later
      relevanceFactors: [
        { factor: 'frequency', score: pattern.confidence },
        { factor: 'importance', score: 0.6 }
      ],
      created: now.toISOString(),
      actionParams: {
        eventType: pattern.eventType,
        metadata: pattern.metadata,
        frequency: pattern.frequency
      }
    };
    
    this.suggestions.push(suggestion);
  }
  
  /**
   * Process location patterns into suggestions
   * @param pattern - Location pattern to process
   */
  private processLocationPattern(pattern: LocationPattern): void {
    // Skip low confidence patterns
    if (pattern.confidence < 0.7) {
      return;
    }
    
    const now = new Date();
    
    // Create a title based on location pattern
    let title = '';
    let description = '';
    let category: SuggestionCategory = 'productivity';
    let type: SuggestionType = 'automation';
    
    // Location name or coordinates
    const locationName = pattern.location.locationName || 
      `location (${pattern.location.latitude.toFixed(5)}, ${pattern.location.longitude.toFixed(5)})`;
    
    // Different suggestions based on event type
    switch (pattern.eventType) {
      case 'transportation_booked':
        title = 'Set up location-based ride booking';
        description = `You often book transportation at ${locationName}. Create a location trigger?`;
        category = 'transportation';
        type = 'automation';
        break;
        
      case 'food_ordered':
        title = 'Order food when at this location';
        description = `You frequently order food when at ${locationName}. Create a location-based order?`;
        category = 'food';
        type = 'automation';
        break;
        
      case 'app_opened':
        title = 'Location-based preferences';
        description = `You often use this app at ${locationName}. Set up location-specific settings?`;
        category = 'system';
        type = 'feature';
        break;
        
      default:
        title = `Location-based automation for ${locationName}`;
        description = `You regularly perform actions at this location. Create a location-triggered workflow?`;
        category = 'productivity';
        type = 'automation';
    }
    
    // Create the suggestion
    const suggestion: Suggestion = {
      id: `location-${pattern.eventType}-${Date.now()}`,
      title,
      description,
      type,
      category,
      source: {
        patternType: 'location',
        confidence: pattern.confidence
      },
      relevanceScore: 0, // Will be calculated later
      relevanceFactors: [
        { factor: 'location', score: pattern.confidence },
        { factor: 'context', score: 0.75 }
      ],
      created: now.toISOString(),
      actionParams: {
        eventType: pattern.eventType,
        metadata: pattern.metadata,
        location: pattern.location
      }
    };
    
    this.suggestions.push(suggestion);
  }
  
  /**
   * Calculate relevance scores for all suggestions
   */
  private calculateRelevanceScores(): void {
    const now = new Date();
    
    for (const suggestion of this.suggestions) {
      // Start with base confidence from the pattern
      let relevanceScore = suggestion.source.confidence;
      
      // Adjust based on suggestion age (newer = more relevant)
      const ageInHours = (now.getTime() - new Date(suggestion.created).getTime()) / (1000 * 60 * 60);
      const ageFactor = Math.max(0, 1 - (ageInHours / 24)); // Decay over 24 hours
      
      // Factor in user preferences based on category
      const categoryPreference = this.userPreferences.categoriesEnabled[suggestion.category] ? 1 : 0;
      
      // Consider time-sensitivity for expiring suggestions
      let urgencyFactor = 0;
      if (suggestion.expires) {
        const timeUntilExpiry = (new Date(suggestion.expires).getTime() - now.getTime()) / (1000 * 60 * 60);
        urgencyFactor = timeUntilExpiry < 1 ? 0.9 : (timeUntilExpiry < 3 ? 0.7 : 0.3);
        
        // Add urgency factor
        suggestion.relevanceFactors.push({
          factor: 'urgency',
          score: urgencyFactor
        });
      }
      
      // Calculate weighted average of all factors
      let totalWeight = 0;
      let weightedSum = 0;
      
      for (const factor of suggestion.relevanceFactors) {
        let weight = 1; // Default weight
        
        // Adjust weights based on factor type
        switch (factor.factor) {
          case 'time':
            weight = 1.5;
            break;
          case 'location':
            weight = 1.3;
            break;
          case 'user_preference':
            weight = 2.0;
            break;
          case 'feedback':
            weight = 1.8;
            break;
          case 'urgency':
            weight = 1.7;
            break;
          case 'importance':
            weight = 1.6;
            break;
          default:
            weight = 1.0;
        }
        
        weightedSum += factor.score * weight;
        totalWeight += weight;
      }
      
      // Add age and category preference factors
      weightedSum += ageFactor * 1.2;
      weightedSum += categoryPreference * 2.0;
      totalWeight += 1.2 + 2.0;
      
      // Calculate final score
      relevanceScore = weightedSum / totalWeight;
      
      // Apply sensitivity adjustment
      switch (this.userPreferences.sensitivityLevel) {
        case 'low':
          relevanceScore *= 0.8; // Lower all scores by 20%
          break;
        case 'high':
          relevanceScore = Math.min(1, relevanceScore * 1.2); // Increase all scores by 20%
          break;
        // 'medium' is default, no adjustment
      }
      
      // Store the score
      suggestion.relevanceScore = Math.min(1, Math.max(0, relevanceScore));
    }
  }
  
  /**
   * Record feedback for a suggestion
   * @param feedback - User feedback
   */
  recordFeedback(feedback: SuggestionFeedback): void {
    this.feedback.push(feedback);
    
    // Mark as having feedback
    const suggestion = this.suggestions.find(s => s.id === feedback.suggestionId);
    if (suggestion) {
      suggestion.feedbackProvided = true;
    }
    
    // Adjust future suggestions based on feedback
    // This is a simplified approach - in a real system, this would be more sophisticated
    if (!feedback.relevant) {
      // If the user marked it as irrelevant, temporarily decrease the category's relevance
      const suggestion = this.suggestions.find(s => s.id === feedback.suggestionId);
      if (suggestion) {
        // Learn from negative feedback
        this.learnFromNegativeFeedback(suggestion, feedback);
      }
    }
  }
  
  /**
   * Mark a suggestion as implemented
   * @param suggestionId - ID of implemented suggestion
   */
  markImplemented(suggestionId: string): void {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (suggestion) {
      suggestion.implemented = true;
      this.implemented.add(suggestionId);
    }
  }
  
  /**
   * Mark a suggestion as dismissed
   * @param suggestionId - ID of dismissed suggestion
   */
  markDismissed(suggestionId: string): void {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (suggestion) {
      suggestion.dismissed = true;
      this.dismissed.add(suggestionId);
    }
  }
  
  /**
   * Learn from negative feedback to improve future suggestions
   * @param suggestion - The suggestion that received negative feedback
   * @param feedback - The feedback provided
   */
  private learnFromNegativeFeedback(suggestion: Suggestion, feedback: SuggestionFeedback): void {
    // This is a simplified implementation - in a real system, this would be more sophisticated
    
    // If user said the timing was wrong, adjust time-based suggestions
    if (feedback.reasonIfIrrelevant === 'timing') {
      // In a real implementation, we would adjust time pattern weights
      console.log('Learning: User prefers different timing for', suggestion.category);
    }
    
    // If user said they're not interested in the category
    if (feedback.reasonIfIrrelevant === 'category' || feedback.reasonIfIrrelevant === 'not_interested') {
      // Temporarily reduce the relevance of this category
      console.log('Learning: User less interested in category', suggestion.category);
    }
    
    // If user said there are too many suggestions (frequency)
    if (feedback.reasonIfIrrelevant === 'frequency') {
      // Reduce overall number of suggestions
      this.userPreferences.maxSuggestionsPerDay = Math.max(
        2, 
        this.userPreferences.maxSuggestionsPerDay - 2
      );
      console.log('Learning: Reducing suggestion frequency to', this.userPreferences.maxSuggestionsPerDay);
    }
  }
  
  /**
   * Get current user preferences
   * @returns Current preference settings
   */
  getPreferences(): SuggestionPreferences {
    return { ...this.userPreferences };
  }
  
  /**
   * Check if a time-based suggestion should be triggered now
   * @param pattern - Time pattern to check
   * @returns Whether the suggestion should trigger
   */
  shouldTriggerTimePattern(pattern: TimePattern): boolean {
    const now = new Date();
    let shouldTrigger = true;
    
    // Check time of day
    if (pattern.timeOfDay) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const patternHour = pattern.timeOfDay.hour;
      const patternMinute = pattern.timeOfDay.minute;
      const tolerance = pattern.timeOfDay.tolerance;
      
      // Calculate minutes difference
      const currentMinutesIntoDay = currentHour * 60 + currentMinute;
      const patternMinutesIntoDay = patternHour * 60 + patternMinute;
      const minutesDiff = Math.abs(currentMinutesIntoDay - patternMinutesIntoDay);
      
      // If outside tolerance range, don't trigger
      if (minutesDiff > tolerance) {
        shouldTrigger = false;
      }
    }
    
    // Check day of week
    if (pattern.dayOfWeek && pattern.dayOfWeek.length > 0) {
      const currentDayOfWeek = now.getDay();
      if (!pattern.dayOfWeek.includes(currentDayOfWeek)) {
        shouldTrigger = false;
      }
    }
    
    // Check day of month
    if (pattern.dayOfMonth && pattern.dayOfMonth.length > 0) {
      const currentDayOfMonth = now.getDate();
      if (!pattern.dayOfMonth.includes(currentDayOfMonth)) {
        shouldTrigger = false;
      }
    }
    
    // Check month of year
    if (pattern.monthOfYear && pattern.monthOfYear.length > 0) {
      const currentMonthOfYear = now.getMonth();
      if (!pattern.monthOfYear.includes(currentMonthOfYear)) {
        shouldTrigger = false;
      }
    }
    
    return shouldTrigger;
  }
  
  /**
   * Helper to format a time string from a TimePattern
   * @param pattern - Time pattern to format
   * @returns Formatted time string
   */
  formatTimePattern(pattern: TimePattern): string {
    const parts = [];
    
    if (pattern.timeOfDay) {
      const hour = pattern.timeOfDay.hour;
      const minute = pattern.timeOfDay.minute;
      const hour12 = hour % 12 || 12;
      const amPm = hour < 12 ? 'AM' : 'PM';
      parts.push(`${hour12}:${minute.toString().padStart(2, '0')} ${amPm}`);
    }
    
    if (pattern.dayOfWeek && pattern.dayOfWeek.length > 0) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNames = pattern.dayOfWeek.map(day => daysOfWeek[day]);
      
      if (dayNames.length === 7) {
        parts.push('every day');
      } else if (dayNames.length === 5 && 
                !pattern.dayOfWeek.includes(0) && 
                !pattern.dayOfWeek.includes(6)) {
        parts.push('weekdays');
      } else if (dayNames.length === 2 && 
                pattern.dayOfWeek.includes(0) && 
                pattern.dayOfWeek.includes(6)) {
        parts.push('weekends');
      } else {
        parts.push(`on ${dayNames.join(', ')}`);
      }
    }
    
    if (pattern.dayOfMonth && pattern.dayOfMonth.length > 0) {
      // Handle special cases like 1st, 2nd, 3rd, etc.
      const formatOrdinal = (n: number): string => {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
      };
      
      const dayNames = pattern.dayOfMonth.map(formatOrdinal);
      parts.push(`on the ${dayNames.join(', ')} of the month`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Helper to format a location string from a LocationPattern
   * @param pattern - Location pattern to format
   * @returns Formatted location string
   */
  formatLocationPattern(pattern: LocationPattern): string {
    if (pattern.location.locationName) {
      return pattern.location.locationName;
    }
    
    // Format coordinates with 5 decimal places (approx 1m precision)
    return `${pattern.location.latitude.toFixed(5)}, ${pattern.location.longitude.toFixed(5)}`;
  }
  
  /**
   * Helper to format a frequency string from a FrequencyPattern
   * @param pattern - Frequency pattern to format
   * @returns Formatted frequency string
   */
  formatFrequencyPattern(pattern: FrequencyPattern): string {
    const { count, timeUnit, duration } = pattern.frequency;
    
    let unitText = timeUnit;
    if (count !== 1) {
      unitText = `${timeUnit}s`;
    }
    
    if (duration === 1) {
      return `${count} time${count !== 1 ? 's' : ''} per ${unitText}`;
    } else {
      return `${count} time${count !== 1 ? 's' : ''} per ${duration} ${unitText}`;
    }
  }
}

// Create singleton instance
export const suggestionEngine = new SuggestionEngine();

// Export default for easier importing
export default suggestionEngine;
