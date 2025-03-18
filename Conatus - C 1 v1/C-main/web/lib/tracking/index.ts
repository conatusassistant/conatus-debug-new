/**
 * Tracking service for the Adaptive Learning System
 * Records user interactions, service usage, and behavior patterns
 * to enable proactive suggestions and adaptive assistance.
 */

import { supabase } from '../supabase/client';

// Event types for tracking
export type TrackingEventType = 
  // User interaction events
  | 'query_sent'
  | 'model_selected'
  | 'suggestion_accepted'
  | 'suggestion_dismissed'
  | 'service_connected'
  | 'service_disconnected'
  | 'automation_created'
  | 'automation_edited'
  | 'automation_executed'
  | 'automation_deleted'
  | 'template_shared'
  | 'template_imported'
  | 'settings_changed'
  // Service usage events
  | 'transportation_booked'
  | 'food_ordered'
  | 'calendar_event_created'
  | 'message_sent'
  | 'notification_sent'
  | 'location_changed'
  // System events
  | 'app_opened'
  | 'app_closed'
  | 'session_started'
  | 'session_ended';

// Define event metadata types
export type EventMetadata = Record<string, any>;

// Complete event structure
export interface TrackingEvent {
  id?: string;
  userId: string;
  eventType: TrackingEventType;
  timestamp: string;
  metadata: EventMetadata;
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop';
    platform?: string;
    browser?: string;
  };
  locationInfo?: {
    latitude?: number;
    longitude?: number;
    locationName?: string;
  };
}

// User behavior pattern structure
export interface BehaviorPattern {
  id?: string;
  userId: string;
  patternType: 'time' | 'location' | 'sequence' | 'frequency';
  patternData: any;
  confidence: number;
  lastUpdated: string;
  occurrences: number;
  firstDetected: string;
}

// Maximum events to store in local cache
const MAX_CACHED_EVENTS = 100;

/**
 * Tracking Service class that handles recording and analyzing user behaviors
 */
class TrackingService {
  private userId: string | null = null;
  private eventCache: TrackingEvent[] = [];
  private isInitialized: boolean = false;
  private deviceInfo: TrackingEvent['deviceInfo'];
  private flushInterval: NodeJS.Timeout | null = null;
  private patterns: BehaviorPattern[] = [];
  
  /**
   * Initialize the tracking service
   * @param userId - The current user ID
   */
  initialize(userId: string): void {
    if (this.isInitialized) {
      return;
    }
    
    this.userId = userId;
    this.isInitialized = true;
    
    // Detect device type
    this.deviceInfo = this.detectDeviceInfo();
    
    // Set up periodic flush to database
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 60000); // Flush every minute
    
    // Load existing patterns
    this.loadPatterns();
    
    // Track session start
    this.trackEvent('session_started', {});
    
    // Set up event handlers for page visibility
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    // Set up handler for when the window is closed/refreshed
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
    
    console.log('Tracking service initialized for user:', userId);
  }
  
  /**
   * Clean up when component unmounts
   */
  cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush any remaining events
    this.flushEvents();
    
    // Remove event listeners
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    
    this.isInitialized = false;
  }
  
  /**
   * Track a user event
   * @param eventType - Type of event
   * @param metadata - Additional data about the event
   * @param locationInfo - Optional location data
   */
  trackEvent(
    eventType: TrackingEventType,
    metadata: EventMetadata,
    locationInfo?: TrackingEvent['locationInfo']
  ): void {
    if (!this.isInitialized || !this.userId) {
      console.warn('Tracking service not initialized, event not recorded');
      return;
    }
    
    const event: TrackingEvent = {
      userId: this.userId,
      eventType,
      timestamp: new Date().toISOString(),
      metadata,
      deviceInfo: this.deviceInfo,
      locationInfo
    };
    
    // Add to local cache
    this.eventCache.push(event);
    
    // Trim cache if it gets too large
    if (this.eventCache.length > MAX_CACHED_EVENTS) {
      this.flushEvents();
    }
    
    // For debugging
    console.log('Event tracked:', eventType, metadata);
  }
  
  /**
   * Flush events to the database
   */
  private async flushEvents(): Promise<void> {
    if (this.eventCache.length === 0) {
      return;
    }
    
    const eventsToFlush = [...this.eventCache];
    this.eventCache = [];
    
    try {
      // In production, this would use a batch insert
      const { data, error } = await supabase
        .from('user_events')
        .insert(eventsToFlush);
      
      if (error) {
        console.error('Error flushing events:', error);
        // Put events back in cache to try again later
        this.eventCache = [...eventsToFlush, ...this.eventCache];
      }
    } catch (error) {
      console.error('Exception during event flush:', error);
      // Put events back in cache to try again later
      this.eventCache = [...eventsToFlush, ...this.eventCache];
    }
  }
  
  /**
   * Load existing behavior patterns for the user
   */
  private async loadPatterns(): Promise<void> {
    if (!this.userId) {
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('behavior_patterns')
        .select('*')
        .eq('userId', this.userId);
      
      if (error) {
        console.error('Error loading patterns:', error);
        return;
      }
      
      this.patterns = data || [];
      console.log(`Loaded ${this.patterns.length} behavior patterns`);
    } catch (error) {
      console.error('Exception loading patterns:', error);
    }
  }
  
  /**
   * Handle visibility change (tab focus/blur)
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.trackEvent('app_closed', { reason: 'visibility_change' });
      this.flushEvents();
    } else if (document.visibilityState === 'visible') {
      this.trackEvent('app_opened', { reason: 'visibility_change' });
    }
  };
  
  /**
   * Handle window unload (page close or refresh)
   */
  private handleBeforeUnload = (): void => {
    this.trackEvent('session_ended', {});
    this.flushEvents();
  };
  
  /**
   * Detect device information
   */
  private detectDeviceInfo(): TrackingEvent['deviceInfo'] {
    if (typeof window === 'undefined') {
      return { type: 'desktop' };
    }
    
    const ua = window.navigator.userAgent;
    const platform = window.navigator.platform;
    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    
    // Simple mobile detection
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      // Check if tablet
      if (/iPad|Android(?!.*Mobile)/i.test(ua)) {
        deviceType = 'tablet';
      } else {
        deviceType = 'mobile';
      }
    }
    
    // Get browser info
    let browser = 'unknown';
    if (ua.indexOf('Firefox') > -1) {
      browser = 'Firefox';
    } else if (ua.indexOf('SamsungBrowser') > -1) {
      browser = 'Samsung';
    } else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
      browser = 'Opera';
    } else if (ua.indexOf('Trident') > -1) {
      browser = 'Internet Explorer';
    } else if (ua.indexOf('Edge') > -1) {
      browser = 'Edge';
    } else if (ua.indexOf('Chrome') > -1) {
      browser = 'Chrome';
    } else if (ua.indexOf('Safari') > -1) {
      browser = 'Safari';
    }
    
    return {
      type: deviceType,
      platform: platform,
      browser: browser
    };
  }
  
  /**
   * Gets the user's current location if available
   * @returns Promise with location info
   */
  async getCurrentLocation(): Promise<TrackingEvent['locationInfo'] | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
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
  }
  
  /**
   * Get tracked behavior patterns
   * @returns Array of behavior patterns
   */
  getBehaviorPatterns(): BehaviorPattern[] {
    return this.patterns;
  }
}

// Create singleton instance
export const trackingService = new TrackingService();

// Export default for easier importing
export default trackingService;
