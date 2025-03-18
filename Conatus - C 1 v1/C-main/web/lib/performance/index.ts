/**
 * Performance Monitoring and Optimization
 * 
 * This module provides utilities for tracking and optimizing app performance.
 */

// Duration tracking for operations
const perfTimings: Record<string, number[]> = {};

/**
 * Measure the execution time of a function
 * @param name Identifier for the operation
 * @param fn Function to measure
 * @returns Result of the function
 */
export async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startTime = performance.now();
  
  try {
    return await fn();
  } finally {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (!perfTimings[name]) {
      perfTimings[name] = [];
    }
    
    perfTimings[name].push(duration);
    
    // Keep only the last 100 measurements
    if (perfTimings[name].length > 100) {
      perfTimings[name].shift();
    }
    
    // Log if performance is particularly slow (> 500ms)
    if (duration > 500) {
      console.warn(`⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Synchronous version of measurePerformance
 * @param name Identifier for the operation
 * @param fn Function to measure
 * @returns Result of the function
 */
export function measurePerformanceSync<T>(name: string, fn: () => T): T {
  const startTime = performance.now();
  
  try {
    return fn();
  } finally {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (!perfTimings[name]) {
      perfTimings[name] = [];
    }
    
    perfTimings[name].push(duration);
    
    // Keep only the last 100 measurements
    if (perfTimings[name].length > 100) {
      perfTimings[name].shift();
    }
    
    // Log if performance is particularly slow (> 100ms for sync operations)
    if (duration > 100) {
      console.warn(`⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Reset performance measurements
 */
export function resetPerformanceMeasurements(): void {
  Object.keys(perfTimings).forEach(key => {
    delete perfTimings[key];
  });
}

/**
 * Get performance statistics for all measured operations
 */
export function getPerformanceStats(): Record<string, { 
  avg: number;
  min: number;
  max: number;
  count: number;
  p95: number; // 95th percentile
}> {
  const stats: Record<string, any> = {};
  
  Object.keys(perfTimings).forEach(key => {
    const timings = perfTimings[key];
    
    if (timings.length === 0) {
      return;
    }
    
    // Sort timings for percentile calculation
    const sortedTimings = [...timings].sort((a, b) => a - b);
    
    stats[key] = {
      avg: timings.reduce((sum, time) => sum + time, 0) / timings.length,
      min: Math.min(...timings),
      max: Math.max(...timings),
      count: timings.length,
      p95: sortedTimings[Math.floor(sortedTimings.length * 0.95)]
    };
  });
  
  return stats;
}

/**
 * Request Animation Frame with performance tracking
 * @param name Identifier for the operation
 * @param callback Function to call on next animation frame
 * @returns Request animation frame ID
 */
export function trackedRAF(name: string, callback: FrameRequestCallback): number {
  const wrappedCallback: FrameRequestCallback = (timestamp) => {
    const start = performance.now();
    callback(timestamp);
    const duration = performance.now() - start;
    
    if (!perfTimings[name]) {
      perfTimings[name] = [];
    }
    
    perfTimings[name].push(duration);
    
    // Keep only the last 100 measurements
    if (perfTimings[name].length > 100) {
      perfTimings[name].shift();
    }
    
    // Log frame drops (> 16.67ms for 60fps)
    if (duration > 16.67) {
      console.warn(`⚠️ Frame drop: ${name} took ${duration.toFixed(2)}ms`);
    }
  };
  
  return requestAnimationFrame(wrappedCallback);
}

/**
 * Debounce a function
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle a function
 * @param fn Function to throttle
 * @param limit Minimum time between invocations in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  let lastResult: ReturnType<T> | undefined;
  
  return function(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();
    
    if (now - lastCall >= limit) {
      lastCall = now;
      lastResult = fn.apply(this, args);
    }
    
    return lastResult;
  };
}

/**
 * Batch function calls that happen within a time window
 * @param fn Function to batch
 * @param delay Time window in milliseconds
 * @returns Batched function
 */
export function batch<T extends (...args: any[]) => any>(
  fn: (items: Parameters<T>[]) => any,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let items: Parameters<T>[] = [];
  
  return function(this: any, ...args: Parameters<T>) {
    items.push(args);
    
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        fn.call(this, items);
        items = [];
        timeoutId = null;
      }, delay);
    }
  };
}

/**
 * Record a performance mark and measure
 * @param name Name of the performance mark/measure
 * @param fn Function to measure
 * @returns Result of the function
 */
export async function trackedOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startMark = `${name}_start`;
  const endMark = `${name}_end`;
  
  performance.mark(startMark);
  
  try {
    return await fn();
  } finally {
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);
    
    // Clean up marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
  }
}

/**
 * Monitor renders in a React component
 * @param componentName Name of the component
 * @param props Props that trigger re-renders
 */
export function monitorRenders(componentName: string, props: Record<string, any>): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📊 Rendering ${componentName} with props:`, props);
  }
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(): void {
  // Monitor First Contentful Paint
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          console.log(`📊 First Contentful Paint: ${entry.startTime.toFixed(2)}ms`);
        }
      });
    });
    
    observer.observe({ type: 'paint', buffered: true });
  }
  
  // Monitor Largest Contentful Paint
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log(`📊 Largest Contentful Paint: ${lastEntry.startTime.toFixed(2)}ms`);
    });
    
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  }
  
  // Monitor Cumulative Layout Shift
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    let cumulativeLayoutShift = 0;
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only add the entry if it doesn't have a recent scroll
        if (!(entry as any).hadRecentInput) {
          cumulativeLayoutShift += (entry as any).value;
        }
      }
      console.log(`📊 Cumulative Layout Shift: ${cumulativeLayoutShift.toFixed(5)}`);
    });
    
    observer.observe({ type: 'layout-shift', buffered: true });
  }
}

// Performance budgets for critical user journeys
export const PERFORMANCE_BUDGETS = {
  initialLoad: 3000, // ms
  chatResponse: 1000, // ms for initial response
  automationCreation: 500, // ms to save an automation
  suggestionDisplay: 200, // ms to display suggestions
  navigationTransition: 300 // ms for page transitions
};

/**
 * Check if performance meets budgets
 * @param stats Performance statistics
 * @returns Report of any budget violations
 */
export function checkPerformanceBudgets(stats: Record<string, { avg: number }>): { 
  passes: boolean; 
  violations: Array<{ operation: string; budget: number; actual: number }> 
} {
  const violations: Array<{ operation: string; budget: number; actual: number }> = [];
  
  // Check each known operation against its budget
  if (stats['initial-load'] && stats['initial-load'].avg > PERFORMANCE_BUDGETS.initialLoad) {
    violations.push({
      operation: 'initial-load',
      budget: PERFORMANCE_BUDGETS.initialLoad,
      actual: stats['initial-load'].avg
    });
  }
  
  if (stats['chat-response'] && stats['chat-response'].avg > PERFORMANCE_BUDGETS.chatResponse) {
    violations.push({
      operation: 'chat-response',
      budget: PERFORMANCE_BUDGETS.chatResponse,
      actual: stats['chat-response'].avg
    });
  }
  
  if (stats['automation-creation'] && stats['automation-creation'].avg > PERFORMANCE_BUDGETS.automationCreation) {
    violations.push({
      operation: 'automation-creation',
      budget: PERFORMANCE_BUDGETS.automationCreation,
      actual: stats['automation-creation'].avg
    });
  }
  
  if (stats['suggestion-display'] && stats['suggestion-display'].avg > PERFORMANCE_BUDGETS.suggestionDisplay) {
    violations.push({
      operation: 'suggestion-display',
      budget: PERFORMANCE_BUDGETS.suggestionDisplay,
      actual: stats['suggestion-display'].avg
    });
  }
  
  if (stats['navigation-transition'] && stats['navigation-transition'].avg > PERFORMANCE_BUDGETS.navigationTransition) {
    violations.push({
      operation: 'navigation-transition',
      budget: PERFORMANCE_BUDGETS.navigationTransition,
      actual: stats['navigation-transition'].avg
    });
  }
  
  return {
    passes: violations.length === 0,
    violations
  };
}
