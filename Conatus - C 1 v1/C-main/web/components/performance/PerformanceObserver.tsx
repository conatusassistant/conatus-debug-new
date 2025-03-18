'use client';

import { useEffect } from 'react';
import { initPerformanceMonitoring, getPerformanceStats, checkPerformanceBudgets } from '@/lib/performance';

/**
 * Performance Observer Component
 * 
 * This component initializes performance monitoring and reports metrics.
 * It doesn't render anything visible in the UI.
 */
export function PerformanceObserver() {
  useEffect(() => {
    // Initialize performance monitoring
    initPerformanceMonitoring();
    
    // Set up periodic reporting of performance stats
    const reportingInterval = setInterval(() => {
      if (process.env.NODE_ENV !== 'production') {
        const stats = getPerformanceStats();
        const budgetReport = checkPerformanceBudgets(stats);
        
        if (!budgetReport.passes) {
          console.warn('⚠️ Performance budget violations detected:');
          budgetReport.violations.forEach(violation => {
            console.warn(`  - ${violation.operation}: ${violation.actual.toFixed(2)}ms (budget: ${violation.budget}ms)`);
          });
        }
        
        console.info('📊 Performance metrics:', stats);
      }
    }, 30000); // Report every 30 seconds in development
    
    // Listen for navigation events to track page transitions
    const handleRouteChangeStart = () => {
      performance.mark('route_change_start');
    };
    
    const handleRouteChangeComplete = () => {
      performance.mark('route_change_end');
      try {
        performance.measure('navigation-transition', 'route_change_start', 'route_change_end');
        const navMeasures = performance.getEntriesByName('navigation-transition');
        
        if (navMeasures.length > 0) {
          const navigationTime = navMeasures[0].duration;
          console.info(`📊 Navigation completed in ${navigationTime.toFixed(2)}ms`);
          
          // Clear the marks to avoid memory leaks
          performance.clearMarks('route_change_start');
          performance.clearMarks('route_change_end');
          performance.clearMeasures('navigation-transition');
        }
      } catch (error) {
        console.error('Error measuring navigation performance:', error);
      }
    };
    
    // Monitor initial page load
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        // Get navigation timing
        if (performance.getEntriesByType('navigation').length > 0) {
          const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const loadTime = navigationEntry.loadEventEnd - navigationEntry.startTime;
          
          console.info(`📊 Initial page load completed in ${loadTime.toFixed(2)}ms`);
          
          // Record in our performance monitoring
          const perfData = { 'initial-load': { avg: loadTime } };
          checkPerformanceBudgets(perfData);
        }
      });
    }
    
    // Clean up
    return () => {
      clearInterval(reportingInterval);
    };
  }, []);
  
  // Return null as this component doesn't render anything
  return null;
}
