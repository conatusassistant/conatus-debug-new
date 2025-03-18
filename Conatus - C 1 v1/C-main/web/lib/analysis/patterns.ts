/**
 * Pattern Analysis Algorithm
 * 
 * Analyzes user behavior to identify patterns in:
 * - Temporal usage (time-based patterns)
 * - Frequency of actions (recurring usage)
 * - Sequential behaviors (action sequences)
 * - Contextual patterns (situation-specific behavior)
 */

import { TrackingEvent, BehaviorPattern } from '../tracking';

// Pattern strength thresholds
const PATTERN_THRESHOLDS = {
  TIME_PATTERN_MIN_OCCURRENCES: 3,
  SEQUENCE_PATTERN_MIN_OCCURRENCES: 3,
  FREQUENCY_PATTERN_MIN_OCCURRENCES: 5,
  LOCATION_PATTERN_MIN_OCCURRENCES: 3,
  MIN_CONFIDENCE_THRESHOLD: 0.6,
  HIGH_CONFIDENCE_THRESHOLD: 0.85,
};

// Time patterns - represents recurring time-based behaviors
export interface TimePattern {
  patternType: 'time';
  timeOfDay?: {
    hour: number;
    minute: number;
    tolerance: number; // tolerance in minutes
  };
  dayOfWeek?: number[]; // 0-6, where 0 is Sunday
  dayOfMonth?: number[];
  monthOfYear?: number[]; // 0-11, where 0 is January
  eventType: string;
  metadata?: Record<string, any>;
  confidence: number;
}

// Sequence patterns - represents sequences of actions that occur together
export interface SequencePattern {
  patternType: 'sequence';
  steps: {
    eventType: string;
    metadata?: Record<string, any>;
    optional?: boolean;
  }[];
  timeWindow: number; // in milliseconds
  confidence: number;
}

// Frequency patterns - represents how often certain actions occur
export interface FrequencyPattern {
  patternType: 'frequency';
  eventType: string;
  metadata?: Record<string, any>;
  frequency: {
    count: number;
    timeUnit: 'hour' | 'day' | 'week' | 'month';
    duration: number; // how many time units
  };
  confidence: number;
}

// Location patterns - represents location-based behaviors
export interface LocationPattern {
  patternType: 'location';
  location: {
    latitude: number;
    longitude: number;
    radius: number; // in meters
    locationName?: string;
  };
  eventType: string;
  metadata?: Record<string, any>;
  confidence: number;
}

// Union type of all pattern types
export type Pattern = TimePattern | SequencePattern | FrequencyPattern | LocationPattern;

/**
 * Pattern analyzer class that applies various algorithms to detect patterns
 */
export class PatternAnalyzer {
  private events: TrackingEvent[] = [];
  
  /**
   * Set the events to analyze
   * @param events - Array of tracking events
   */
  setEvents(events: TrackingEvent[]): void {
    this.events = [...events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
  
  /**
   * Run all pattern detection algorithms
   * @returns Array of detected patterns
   */
  analyzeAllPatterns(): Pattern[] {
    const timePatterns = this.detectTimePatterns();
    const sequencePatterns = this.detectSequencePatterns();
    const frequencyPatterns = this.detectFrequencyPatterns();
    const locationPatterns = this.detectLocationPatterns();
    
    // Combine all patterns
    return [
      ...timePatterns,
      ...sequencePatterns,
      ...frequencyPatterns,
      ...locationPatterns
    ];
  }
  
  /**
   * Detect time-based patterns in user behavior
   * @returns Array of time patterns
   */
  detectTimePatterns(): TimePattern[] {
    const patterns: TimePattern[] = [];
    
    if (this.events.length < PATTERN_THRESHOLDS.TIME_PATTERN_MIN_OCCURRENCES) {
      return patterns;
    }
    
    // Group events by type
    const eventsByType = this.groupEventsByType();
    
    // For each event type, analyze time patterns
    for (const [eventType, events] of Object.entries(eventsByType)) {
      if (events.length < PATTERN_THRESHOLDS.TIME_PATTERN_MIN_OCCURRENCES) {
        continue;
      }
      
      // Analyze daily patterns (same time each day)
      const dailyPatterns = this.analyzeDailyTimePatterns(eventType, events);
      patterns.push(...dailyPatterns);
      
      // Analyze weekly patterns (same day of week)
      const weeklyPatterns = this.analyzeWeeklyPatterns(eventType, events);
      patterns.push(...weeklyPatterns);
      
      // Analyze monthly patterns (same day of month)
      const monthlyPatterns = this.analyzeMonthlyPatterns(eventType, events);
      patterns.push(...monthlyPatterns);
    }
    
    return patterns;
  }
  
  /**
   * Analyze daily time patterns (events occurring at similar times each day)
   * @param eventType - Type of event
   * @param events - Array of events of this type
   * @returns Array of time patterns
   */
  private analyzeDailyTimePatterns(eventType: string, events: TrackingEvent[]): TimePattern[] {
    const patterns: TimePattern[] = [];
    const timeGroupings: Record<string, TrackingEvent[]> = {};
    const HOUR_MINUTE_TOLERANCE = 30; // 30 minutes tolerance
    
    // Group events by hour
    for (const event of events) {
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      
      // Create time slots with HOUR_MINUTE_TOLERANCE
      const slotSize = HOUR_MINUTE_TOLERANCE;
      const minuteSlot = Math.floor(date.getMinutes() / slotSize) * slotSize;
      const timeKey = `${hour}:${minuteSlot}`;
      
      if (!timeGroupings[timeKey]) {
        timeGroupings[timeKey] = [];
      }
      
      timeGroupings[timeKey].push(event);
    }
    
    // Analyze each time group
    for (const [timeKey, timeEvents] of Object.entries(timeGroupings)) {
      if (timeEvents.length < PATTERN_THRESHOLDS.TIME_PATTERN_MIN_OCCURRENCES) {
        continue;
      }
      
      // Calculate confidence based on consistency
      const dates = timeEvents.map(e => new Date(e.timestamp));
      const consistencyScore = this.calculateTimeConsistency(dates);
      
      // Skip low confidence patterns
      if (consistencyScore < PATTERN_THRESHOLDS.MIN_CONFIDENCE_THRESHOLD) {
        continue;
      }
      
      // Extract hour and minute
      const [hourStr, minuteStr] = timeKey.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      
      // Get common metadata properties
      const metadataCommonalities = this.extractCommonMetadata(timeEvents);
      
      // Create the pattern
      patterns.push({
        patternType: 'time',
        timeOfDay: {
          hour,
          minute,
          tolerance: HOUR_MINUTE_TOLERANCE,
        },
        eventType,
        metadata: metadataCommonalities,
        confidence: consistencyScore,
      });
    }
    
    return patterns;
  }
  
  /**
   * Analyze weekly patterns (events occurring on the same day of week)
   * @param eventType - Type of event
   * @param events - Array of events of this type
   * @returns Array of time patterns
   */
  private analyzeWeeklyPatterns(eventType: string, events: TrackingEvent[]): TimePattern[] {
    const patterns: TimePattern[] = [];
    const dayGroupings: Record<number, TrackingEvent[]> = {};
    
    // Group events by day of week
    for (const event of events) {
      const date = new Date(event.timestamp);
      const dayOfWeek = date.getDay(); // 0-6
      
      if (!dayGroupings[dayOfWeek]) {
        dayGroupings[dayOfWeek] = [];
      }
      
      dayGroupings[dayOfWeek].push(event);
    }
    
    // Analyze each day group
    for (const [dayStr, dayEvents] of Object.entries(dayGroupings)) {
      if (dayEvents.length < PATTERN_THRESHOLDS.TIME_PATTERN_MIN_OCCURRENCES) {
        continue;
      }
      
      const dayOfWeek = parseInt(dayStr, 10);
      
      // Calculate confidence based on consistency
      // For day of week, we're looking at what percentage of all possible weeks contain this event
      const totalWeeks = this.getTotalWeeksInData();
      const coverage = Math.min(1, dayEvents.length / totalWeeks);
      const confidence = coverage * 0.9 + 0.1; // Ensure confidence is at least 0.1
      
      // Skip low confidence patterns
      if (confidence < PATTERN_THRESHOLDS.MIN_CONFIDENCE_THRESHOLD) {
        continue;
      }
      
      // Get common metadata properties
      const metadataCommonalities = this.extractCommonMetadata(dayEvents);
      
      // Create the pattern
      patterns.push({
        patternType: 'time',
        dayOfWeek: [dayOfWeek],
        eventType,
        metadata: metadataCommonalities,
        confidence,
      });
    }
    
    return patterns;
  }
  
  /**
   * Analyze monthly patterns (events occurring on the same day of month)
   * @param eventType - Type of event
   * @param events - Array of events of this type
   * @returns Array of time patterns
   */
  private analyzeMonthlyPatterns(eventType: string, events: TrackingEvent[]): TimePattern[] {
    const patterns: TimePattern[] = [];
    const dayOfMonthGroupings: Record<number, TrackingEvent[]> = {};
    
    // Group events by day of month
    for (const event of events) {
      const date = new Date(event.timestamp);
      const dayOfMonth = date.getDate(); // 1-31
      
      if (!dayOfMonthGroupings[dayOfMonth]) {
        dayOfMonthGroupings[dayOfMonth] = [];
      }
      
      dayOfMonthGroupings[dayOfMonth].push(event);
    }
    
    // Analyze each day of month group
    for (const [dayStr, dayEvents] of Object.entries(dayOfMonthGroupings)) {
      if (dayEvents.length < PATTERN_THRESHOLDS.TIME_PATTERN_MIN_OCCURRENCES) {
        continue;
      }
      
      const dayOfMonth = parseInt(dayStr, 10);
      
      // Calculate confidence based on consistency
      // For day of month, we're looking at what percentage of all possible months contain this event
      const totalMonths = this.getTotalMonthsInData();
      const coverage = Math.min(1, dayEvents.length / totalMonths);
      const confidence = coverage * 0.9 + 0.1; // Ensure confidence is at least 0.1
      
      // Skip low confidence patterns
      if (confidence < PATTERN_THRESHOLDS.MIN_CONFIDENCE_THRESHOLD) {
        continue;
      }
      
      // Get common metadata properties
      const metadataCommonalities = this.extractCommonMetadata(dayEvents);
      
      // Create the pattern
      patterns.push({
        patternType: 'time',
        dayOfMonth: [dayOfMonth],
        eventType,
        metadata: metadataCommonalities,
        confidence,
      });
    }
    
    return patterns;
  }
  
  /**
   * Detect sequence patterns in user behavior
   * @returns Array of sequence patterns
   */
  detectSequencePatterns(): SequencePattern[] {
    const patterns: SequencePattern[] = [];
    
    if (this.events.length < PATTERN_THRESHOLDS.SEQUENCE_PATTERN_MIN_OCCURRENCES * 2) {
      return patterns;
    }
    
    // Define time windows to analyze (from 5 minutes to 1 hour)
    const timeWindows = [
      5 * 60 * 1000,     // 5 minutes
      15 * 60 * 1000,    // 15 minutes
      30 * 60 * 1000,    // 30 minutes
      60 * 60 * 1000     // 1 hour
    ];
    
    // Analyze each time window
    for (const window of timeWindows) {
      const windowPatterns = this.analyzeSequencesInTimeWindow(window);
      patterns.push(...windowPatterns);
    }
    
    return patterns;
  }
  
  /**
   * Analyze sequences within a specific time window
   * @param windowSize - Time window size in milliseconds
   * @returns Array of sequence patterns
   */
  private analyzeSequencesInTimeWindow(windowSize: number): SequencePattern[] {
    const patterns: SequencePattern[] = [];
    
    // Collect all sequences within the window
    const sequences: string[][] = [];
    let currentSequence: string[] = [];
    let lastEventTime: number | null = null;
    
    for (const event of this.events) {
      const eventTime = new Date(event.timestamp).getTime();
      
      // If this is a new sequence or continuing an existing one
      if (lastEventTime === null || eventTime - lastEventTime <= windowSize) {
        currentSequence.push(event.eventType);
      } else {
        // Save the previous sequence and start a new one
        if (currentSequence.length >= 2) {
          sequences.push([...currentSequence]);
        }
        currentSequence = [event.eventType];
      }
      
      lastEventTime = eventTime;
    }
    
    // Add the last sequence if it exists
    if (currentSequence.length >= 2) {
      sequences.push([...currentSequence]);
    }
    
    // Find frequent sequences (simple approach)
    const sequenceCounts: Record<string, number> = {};
    
    for (const sequence of sequences) {
      const sequenceKey = sequence.join(',');
      sequenceCounts[sequenceKey] = (sequenceCounts[sequenceKey] || 0) + 1;
    }
    
    // Convert frequent sequences to patterns
    for (const [sequenceKey, count] of Object.entries(sequenceCounts)) {
      if (count < PATTERN_THRESHOLDS.SEQUENCE_PATTERN_MIN_OCCURRENCES) {
        continue;
      }
      
      const eventTypes = sequenceKey.split(',');
      
      // Calculate confidence based on frequency
      const maxPossibleOccurrences = this.events.length / eventTypes.length;
      const confidence = Math.min(0.95, count / maxPossibleOccurrences * 0.8 + 0.2);
      
      // Skip low confidence patterns
      if (confidence < PATTERN_THRESHOLDS.MIN_CONFIDENCE_THRESHOLD) {
        continue;
      }
      
      // Create the pattern
      patterns.push({
        patternType: 'sequence',
        steps: eventTypes.map(eventType => ({ eventType })),
        timeWindow: windowSize,
        confidence
      });
    }
    
    return patterns;
  }
  
  /**
   * Detect frequency patterns in user behavior
   * @returns Array of frequency patterns
   */
  detectFrequencyPatterns(): FrequencyPattern[] {
    const patterns: FrequencyPattern[] = [];
    
    if (this.events.length < PATTERN_THRESHOLDS.FREQUENCY_PATTERN_MIN_OCCURRENCES) {
      return patterns;
    }
    
    // Group events by type
    const eventsByType = this.groupEventsByType();
    
    // Define time units to analyze
    const timeUnits: Array<{unit: 'hour' | 'day' | 'week' | 'month', milliseconds: number}> = [
      { unit: 'hour', milliseconds: 60 * 60 * 1000 },
      { unit: 'day', milliseconds: 24 * 60 * 60 * 1000 },
      { unit: 'week', milliseconds: 7 * 24 * 60 * 60 * 1000 },
      { unit: 'month', milliseconds: 30 * 24 * 60 * 60 * 1000 } // Approximate
    ];
    
    // For each event type, analyze frequency patterns
    for (const [eventType, events] of Object.entries(eventsByType)) {
      if (events.length < PATTERN_THRESHOLDS.FREQUENCY_PATTERN_MIN_OCCURRENCES) {
        continue;
      }
      
      // Get first and last event time to calculate total duration
      const firstEventTime = new Date(events[0].timestamp).getTime();
      const lastEventTime = new Date(events[events.length - 1].timestamp).getTime();
      const totalDuration = lastEventTime - firstEventTime;
      
      // Skip if the total duration is too short
      if (totalDuration < 24 * 60 * 60 * 1000) { // Require at least 1 day of data
        continue;
      }
      
      // For each time unit, check if there's a consistent frequency
      for (const { unit, milliseconds } of timeUnits) {
        // Skip time units that are too long compared to total duration
        if (totalDuration < milliseconds * 3) {
          continue;
        }
        
        // Calculate how many events per time unit on average
        const timeUnitCount = Math.ceil(totalDuration / milliseconds);
        const eventsPerTimeUnit = events.length / timeUnitCount;
        
        // Only consider meaningful frequencies (at least 1 per time unit)
        if (eventsPerTimeUnit < 1) {
          continue;
        }
        
        // Calculate consistency of the frequency
        const consistency = this.calculateFrequencyConsistency(events, milliseconds);
        
        // Skip inconsistent patterns
        if (consistency < PATTERN_THRESHOLDS.MIN_CONFIDENCE_THRESHOLD) {
          continue;
        }
        
        // Get common metadata properties
        const metadataCommonalities = this.extractCommonMetadata(events);
        
        // Create the pattern
        patterns.push({
          patternType: 'frequency',
          eventType,
          metadata: metadataCommonalities,
          frequency: {
            count: Math.round(eventsPerTimeUnit),
            timeUnit: unit,
            duration: 1 // 1 unit of the specified time
          },
          confidence: consistency
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * Group events by their event type
   * @returns Record of event types to arrays of events
   */
  private groupEventsByType(): Record<string, TrackingEvent[]> {
    const eventsByType: Record<string, TrackingEvent[]> = {};
    
    for (const event of this.events) {
      if (!eventsByType[event.eventType]) {
        eventsByType[event.eventType] = [];
      }
      eventsByType[event.eventType].push(event);
    }
    
    return eventsByType;
  }
  
  /**
   * Calculate how consistently events occur at the same time
   * @param dates - Array of dates to analyze
   * @returns Consistency score between 0 and 1
   */
  private calculateTimeConsistency(dates: Date[]): number {
    // Calculate standard deviation of minutes into the day
    const minutesIntoDay = dates.map(date => 
      date.getHours() * 60 + date.getMinutes()
    );
    
    // Calculate mean
    const mean = minutesIntoDay.reduce((sum, val) => sum + val, 0) / minutesIntoDay.length;
    
    // Calculate standard deviation
    const squaredDiffs = minutesIntoDay.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to a consistency score (lower std dev = higher consistency)
    // Max std dev considered is 180 minutes (3 hours)
    const normalizedStdDev = Math.min(stdDev, 180) / 180;
    const consistency = 1 - normalizedStdDev;
    
    return consistency;
  }
  
  /**
   * Calculate how consistent the frequency of events is
   * @param events - Array of events
   * @param timeUnitMs - Time unit in milliseconds
   * @returns Consistency score between 0 and 1
   */
  private calculateFrequencyConsistency(events: TrackingEvent[], timeUnitMs: number): number {
    // Group events into time units
    const timeUnits: Record<number, number> = {};
    
    for (const event of events) {
      const timestamp = new Date(event.timestamp).getTime();
      const timeUnitIndex = Math.floor(timestamp / timeUnitMs);
      
      timeUnits[timeUnitIndex] = (timeUnits[timeUnitIndex] || 0) + 1;
    }
    
    // Count how many time units have events
    const timeUnitIndices = Object.keys(timeUnits).map(key => parseInt(key));
    const minIndex = Math.min(...timeUnitIndices);
    const maxIndex = Math.max(...timeUnitIndices);
    const totalUnitSpan = maxIndex - minIndex + 1;
    
    // Calculate mean events per time unit (considering only units that have events)
    const nonZeroValues = Object.values(timeUnits);
    const mean = nonZeroValues.reduce((sum, val) => sum + val, 0) / nonZeroValues.length;
    
    // Calculate standard deviation
    const squaredDiffs = nonZeroValues.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate coefficient of variation (normalized std dev)
    const cv = mean === 0 ? 1 : stdDev / mean;
    
    // Coverage - what percentage of time units have events
    const coverage = nonZeroValues.length / totalUnitSpan;
    
    // Combine consistency and coverage
    // Lower cv = more consistent frequency
    const consistencyScore = Math.max(0, 1 - cv);
    const score = consistencyScore * 0.7 + coverage * 0.3;
    
    return score;
  }
  
  /**
   * Calculate the number of weeks represented in the data
   * @returns Number of weeks
   */
  private getTotalWeeksInData(): number {
    if (this.events.length === 0) return 0;
    
    const firstDate = new Date(this.events[0].timestamp);
    const lastDate = new Date(this.events[this.events.length - 1].timestamp);
    
    const millisecondsDiff = lastDate.getTime() - firstDate.getTime();
    const daysDiff = millisecondsDiff / (1000 * 60 * 60 * 24);
    const weeksDiff = Math.ceil(daysDiff / 7);
    
    return Math.max(1, weeksDiff);
  }
  
  /**
   * Calculate the number of months represented in the data
   * @returns Number of months
   */
  private getTotalMonthsInData(): number {
    if (this.events.length === 0) return 0;
    
    const firstDate = new Date(this.events[0].timestamp);
    const lastDate = new Date(this.events[this.events.length - 1].timestamp);
    
    const yearDiff = lastDate.getFullYear() - firstDate.getFullYear();
    const monthDiff = lastDate.getMonth() - firstDate.getMonth();
    
    return Math.max(1, yearDiff * 12 + monthDiff + 1);
  }
  
  /**
   * Extract common metadata properties from events
   * @param events - Array of events
   * @returns Common metadata
   */
  private extractCommonMetadata(events: TrackingEvent[]): Record<string, any> {
    if (events.length === 0) {
      return {};
    }
    
    // Get all metadata keys from the first event
    const firstEvent = events[0];
    const keys = Object.keys(firstEvent.metadata);
    
    // Find keys that have the same value across all events
    const commonMetadata: Record<string, any> = {};
    
    for (const key of keys) {
      const firstValue = firstEvent.metadata[key];
      const allSame = events.every(event => 
        JSON.stringify(event.metadata[key]) === JSON.stringify(firstValue)
      );
      
      if (allSame) {
        commonMetadata[key] = firstValue;
      }
    }
    
    return commonMetadata;
  }
}

// Create singleton instance
export const patternAnalyzer = new PatternAnalyzer();

// Export default for easier importing
export default patternAnalyzer;
