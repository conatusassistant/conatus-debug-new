// src/utils/mobile-optimization.js

/**
 * Detect device type and capabilities
 * @returns {Object} Device information
 */
export const detectDevice = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Check if mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // Check if iOS
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  // Check if Android
  const isAndroid = /Android/i.test(userAgent);
  
  // Check for PWA
  const isInStandaloneMode = () => 
    (window.matchMedia('(display-mode: standalone)').matches) || 
    (window.navigator.standalone) || 
    document.referrer.includes('android-app://');
  
  // Get network info
  const connection = navigator.connection || 
    navigator.mozConnection || 
    navigator.webkitConnection;
  
  const networkInfo = connection ? {
    type: connection.type,
    effectiveType: connection.effectiveType,
    saveData: connection.saveData
  } : {
    type: 'unknown',
    effectiveType: 'unknown',
    saveData: false
  };
  
  // Detect battery status if available
  let battery = null;
  
  if (navigator.getBattery) {
    navigator.getBattery().then(batteryManager => {
      battery = {
        level: batteryManager.level * 100,
        charging: batteryManager.charging
      };
    });
  }
  
  return {
    isMobile,
    isDesktop: !isMobile,
    isIOS,
    isAndroid,
    isPWA: isInStandaloneMode(),
    network: networkInfo,
    battery,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    lowMemoryDevice: networkInfo.saveData || 
      (networkInfo.effectiveType === 'slow-2g') || 
      (networkInfo.effectiveType === '2g')
  };
};

/**
 * Optimize images based on device capabilities
 * @param {string} src - Original image source
 * @param {Object} options - Optimization options
 * @returns {string} Optimized image source
 */
export const optimizeImage = (src, options = {}) => {
  const device = detectDevice();
  
  // Default options
  const defaults = {
    width: null,
    height: null,
    quality: device.lowMemoryDevice ? 60 : 80,
    format: 'auto'
  };
  
  // Merge defaults with options
  const config = { ...defaults, ...options };
  
  // If using a CDN like Cloudinary or Imgix, adjust URL parameters
  if (src.includes('cloudinary.com')) {
    const transformations = [];
    
    // Add width if specified
    if (config.width) {
      transformations.push(`w_${config.width}`);
    }
    
    // Add height if specified
    if (config.height) {
      transformations.push(`h_${config.height}`);
    }
    
    // Add quality
    transformations.push(`q_${config.quality}`);
    
    // Add format if not auto
    if (config.format !== 'auto') {
      transformations.push(`f_${config.format}`);
    }
    
    // Create transformation URL
    const transformationString = transformations.join(',');
    
    // Insert transformations into URL
    return src.replace('/upload/', `/upload/${transformationString}/`);
  }
  
  // For your own API, use query parameters
  if (src.includes('/api/images/')) {
    const url = new URL(src);
    
    // Add width if specified
    if (config.width) {
      url.searchParams.set('width', config.width);
    }
    
    // Add height if specified
    if (config.height) {
      url.searchParams.set('height', config.height);
    }
    
    // Add quality
    url.searchParams.set('quality', config.quality);
    
    // Add format if not auto
    if (config.format !== 'auto') {
      url.searchParams.set('format', config.format);
    }
    
    return url.toString();
  }
  
  // If no optimization available, return original
  return src;
};

/**
 * Load appropriate resources based on network conditions
 * @param {Object} options - Resource options
 * @returns {Object} Selected resources
 */
export const adaptiveLoading = (options = {}) => {
  const device = detectDevice();
  
  // Default options
  const defaults = {
    lowQualityImages: device.lowMemoryDevice,
    disableAnimations: device.lowMemoryDevice,
    preloadCriticalAssets: !device.lowMemoryDevice,
    useLightweightComponents: device.lowMemoryDevice,
    cacheStrategy: device.lowMemoryDevice ? 'aggressive' : 'balanced'
  };
  
  // Merge defaults with options
  return { ...defaults, ...options };
};

// src/components/common/ResponsiveContainer.js
import React, { useState, useEffect } from 'react';
import { detectDevice } from '../../utils/mobile-optimization';

/**
 * Responsive container that adapts to device capabilities
 */
export const ResponsiveContainer = ({ children, className, style }) => {
  const [device, setDevice] = useState(detectDevice());
  
  // Update device info on resize
  useEffect(() => {
    const handleResize = () => {
      setDevice(detectDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Apply responsive styling
  const containerStyle = {
    maxWidth: '100%',
    margin: '0 auto',
    ...style,
    // Apply different styles based on device
    ...(device.isMobile && {
      padding: '0.5rem',
      fontSize: device.isIOS ? '16px' : '14px' // Prevent zoom on input focus in iOS
    })
  };
  
  // Build class name
  const containerClass = `
    responsive-container
    ${device.isMobile ? 'mobile' : 'desktop'}
    ${device.isIOS ? 'ios' : ''}
    ${device.isAndroid ? 'android' : ''}
    ${device.isPWA ? 'pwa' : ''}
    ${device.lowMemoryDevice ? 'low-memory' : ''}
    ${className || ''}
  `.trim();
  
  return (
    <div className={containerClass} style={containerStyle}>
      {children}
    </div>
  );
};

// src/components/common/OptimizedImage.js
import React from 'react';
import { optimizeImage, detectDevice } from '../../utils/mobile-optimization';

/**
 * Image component with automatic optimization
 */
export const OptimizedImage = ({ src, alt, width, height, quality, className, style }) => {
  const device = detectDevice();
  
  // Skip optimization for SVGs
  const skipOptimization = src.endsWith('.svg');
  
  // Get optimized source
  const optimizedSrc = skipOptimization ? src : optimizeImage(src, {
    width: width || null,
    height: height || null,
    quality: quality || (device.lowMemoryDevice ? 60 : 80)
  });
  
  // Determine if lazy loading is appropriate
  const loading = (device.lowMemoryDevice || height > 300) ? 'lazy' : 'eager';
  
  return (
    <img
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      className={className}
      style={style}
    />
  );
};

// src/hooks/useOfflineDetection.js
import { useState, useEffect } from 'react';

/**
 * Hook to detect and handle offline status
 * @returns {Object} Offline status and utilities
 */
export const useOfflineDetection = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineSince, setOfflineSince] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  
  // Update offline status
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setOfflineSince(new Date());
    };
    
    const handleOnline = () => {
      setIsOffline(false);
      setOfflineSince(null);
      
      // Process pending actions
      if (pendingActions.length > 0) {
        processPendingActions();
      }
    };
    
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [pendingActions]);
  
  // Process pending actions when online
  const processPendingActions = async () => {
    const actionsToProcess = [...pendingActions];
    setPendingActions([]);
    
    for (const action of actionsToProcess) {
      try {
        await action.execute();
      } catch (error) {
        console.error('Failed to execute pending action:', error);
        // Re-queue if still failing
        if (action.retries < 3) {
          setPendingActions(prev => [...prev, {
            ...action,
            retries: (action.retries || 0) + 1
          }]);
        }
      }
    }
  };
  
  // Queue action for when online
  const queueAction = (actionFn, metadata = {}) => {
    if (!isOffline) {
      // Execute immediately if online
      return actionFn();
    }
    
    // Add to pending queue
    setPendingActions(prev => [...prev, {
      execute: actionFn,
      timestamp: new Date(),
      metadata,
      retries: 0
    }]);
    
    return true; // Action queued successfully
  };
  
  return {
    isOffline,
    offlineSince,
    pendingActions,
    queueAction
  };
};

// src/components/common/OfflineIndicator.js
import React from 'react';
import { useOfflineDetection } from '../../hooks/useOfflineDetection';

/**
 * Component to show offline status and pending actions
 */
export const OfflineIndicator = () => {
  const { isOffline, offlineSince, pendingActions } = useOfflineDetection();
  
  if (!isOffline) {
    return null;
  }
  
  return (
    <div className="offline-indicator">
      <div className="offline-status">
        <span className="offline-icon">⚠️</span>
        <span className="offline-text">You are currently offline</span>
        {offlineSince && (
          <span className="offline-time">
            Since {offlineSince.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      {pendingActions.length > 0 && (
        <div className="pending-actions">
          <span className="pending-count">
            {pendingActions.length} action{pendingActions.length !== 1 ? 's' : ''} pending
          </span>
          <span className="pending-note">
            Will be processed when you're back online
          </span>
        </div>
      )}
    </div>
  );
};

// CSS styles for responsive design
export const responsiveStyles = `
/* Base mobile-first styles */
body {
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%; /* Prevent font scaling in landscape */
}

/* Container for app content */
.app-container {
  width: 100%;
  padding: 0 1rem;
  margin: 0 auto;
  box-sizing: border-box;
}

/* Create a responsive grid system */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 1rem;
}

/* Navigation styles */
.app-nav {
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
}

.app-nav a {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

/* Form elements */
input, textarea, select {
  width: 100%;
  padding: 0.75rem;
  font-size: 16px; /* Prevent zoom on iOS */
  border-radius: 0.25rem;
  border: 1px solid #ccc;
}

button {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border-radius: 0.25rem;
  border: none;
  background-color: #0070f3;
  color: white;
  cursor: pointer;
}

/* Card component */
.card {
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

/* Offline indicator */
.offline-indicator {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #ff5722;
  color: white;
  padding: 0.5rem 1rem;
  z-index: 1000;
}

/* Tablet styles */
@media (min-width: 768px) {
  .app-container {
    max-width: 768px;
  }
  
  .grid {
    grid-template-columns: repeat(8, 1fr);
  }
  
  .app-nav {
    flex-direction: row;
  }
  
  .app-nav a {
    margin-right: 1rem;
    margin-bottom: 0;
  }
  
  button {
    width: auto;
  }
}

/* Desktop styles */
@media (min-width: 1024px) {
  .app-container {
    max-width: 1024px;
  }
  
  .grid {
    grid-template-columns: repeat(12, 1fr);
  }
}

/* Large desktop styles */
@media (min-width: 1440px) {
  .app-container {
    max-width: 1440px;
  }
}

/* High-contrast mode */
@media (prefers-contrast: high) {
  body {
    color: #000;
    background-color: #fff;
  }
  
  a {
    color: #0000EE;
    text-decoration: underline;
  }
  
  button {
    background-color: #000;
    color: #fff;
    border: 2px solid #000;
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #121212;
    color: #e0e0e0;
  }
  
  .card {
    background-color: #1e1e1e;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  }
  
  input, textarea, select {
    background-color: #2d2d2d;
    color: #e0e0e0;
    border-color: #444;
  }
}

/* Touch device optimizations */
@media (hover: none) {
  button, a {
    padding: 0.75rem 1rem; /* Larger touch targets */
  }
  
  input[type="checkbox"], input[type="radio"] {
    min-width: 1.25rem;
    min-height: 1.25rem;
  }
}

/* PWA enhancements */
@media all and (display-mode: standalone) {
  /* Adjust for no browser chrome */
  body {
    padding-top: env(safe-area-inset-top, 0);
    padding-bottom: env(safe-area-inset-bottom, 0);
    padding-left: env(safe-area-inset-left, 0);
    padding-right: env(safe-area-inset-right, 0);
  }
}
`;

// Mobile-specific service worker registration
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};
