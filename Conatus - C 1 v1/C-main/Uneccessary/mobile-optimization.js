// src/components/mobile/ResponsiveContainer.jsx
import React, { useEffect, useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import './ResponsiveContainer.css';

/**
 * A container component that adapts its layout and behavior based on screen size
 * Uses CSS Grid for efficient layout management across screen sizes
 */
const ResponsiveContainer = ({ children, className = '', layoutType = 'default' }) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  
  // Add appropriate size-based class based on current viewport
  const sizeClass = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  
  // Add class for specific layout types (chat, automation, social)
  const layoutClass = `layout-${layoutType}`;
  
  return (
    <div className={`responsive-container ${sizeClass} ${layoutClass} ${className}`}>
      {children}
    </div>
  );
};

export default ResponsiveContainer;

// src/components/mobile/BottomNavigation.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import './BottomNavigation.css';

/**
 * Mobile-only bottom navigation bar that appears on small screens
 * Provides easy access to main app tabs
 */
const BottomNavigation = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  
  // Don't render on larger screens
  if (!isMobile) {
    return null;
  }
  
  return (
    <nav className="bottom-navigation">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} end>
        <i className="nav-icon icon-home"></i>
        <span className="nav-label">Home</span>
      </NavLink>
      
      <NavLink to="/library" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <i className="nav-icon icon-library"></i>
        <span className="nav-label">Library</span>
      </NavLink>
      
      <NavLink to="/social" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <i className="nav-icon icon-social"></i>
        <span className="nav-label">Social</span>
      </NavLink>
      
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <i className="nav-icon icon-profile"></i>
        <span className="nav-label">Profile</span>
      </NavLink>
    </nav>
  );
};

export default BottomNavigation;

// src/components/mobile/OfflineNotification.jsx
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setOfflineStatus } from '../../store/app';
import './OfflineNotification.css';

/**
 * Component that shows offline status and manages offline operations
 */
const OfflineNotification = () => {
  const dispatch = useDispatch();
  const { isOffline, pendingOperations } = useSelector(state => state.app);
  const [visible, setVisible] = useState(false);
  
  // Set up network status detection
  useEffect(() => {
    const handleOnline = () => {
      dispatch(setOfflineStatus(false));
      
      // Show reconnected message briefly
      setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    };
    
    const handleOffline = () => {
      dispatch(setOfflineStatus(true));
      setVisible(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial state
    dispatch(setOfflineStatus(!navigator.onLine));
    setVisible(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);
  
  if (!visible) {
    return null;
  }
  
  return (
    <div className={`offline-notification ${isOffline ? 'offline' : 'reconnected'}`}>
      {isOffline ? (
        <>
          <i className="offline-icon"></i>
          <span>You're offline. {pendingOperations > 0 ? `${pendingOperations} operations pending sync.` : 'Some features may be limited.'}</span>
        </>
      ) : (
        <>
          <i className="online-icon"></i>
          <span>You're back online! Syncing your data...</span>
        </>
      )}
    </div>
  );
};

export default OfflineNotification;

// src/services/offline-manager.js
/**
 * Manages offline operations and synchronization
 * Uses IndexedDB for local storage of pending operations
 */
class OfflineManager {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.pendingSync = false;
    
    // Initialize the database connection
    this.initDatabase();
    
    // Set up online/offline event listeners
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }
  
  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ConatusOfflineDB', 1);
      
      request.onerror = (event) => {
        console.error('Failed to open offline database:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.initialized = true;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create the stores we need for offline functionality
        if (!db.objectStoreNames.contains('pendingOperations')) {
          const store = db.createObjectStore('pendingOperations', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('cachedResponses')) {
          const store = db.createObjectStore('cachedResponses', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('expiry', 'expiry', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initDatabase();
    }
  }
  
  // Handle going offline
  handleOffline() {
    console.log('Device is offline. Operations will be queued.');
  }
  
  // Handle coming back online - sync pending operations
  async handleOnline() {
    console.log('Device is online. Starting sync...');
    await this.syncPendingOperations();
  }
  
  // Queue an operation to be performed when online
  async queueOperation(type, endpoint, data) {
    await this.ensureInitialized();
    
    const operation = {
      type,
      endpoint,
      data,
      timestamp: Date.now(),
      attempts: 0
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOperations'], 'readwrite');
      const store = transaction.objectStore('pendingOperations');
      
      const request = store.add(operation);
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error('Failed to queue operation:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Get count of pending operations
  async getPendingOperationCount() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOperations'], 'readonly');
      const store = transaction.objectStore('pendingOperations');
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };
      
      countRequest.onerror = (event) => {
        console.error('Failed to count pending operations:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Sync all pending operations
  async syncPendingOperations() {
    await this.ensureInitialized();
    
    // Prevent multiple syncs at once
    if (this.pendingSync) {
      return;
    }
    
    this.pendingSync = true;
    
    try {
      const operations = await this.getPendingOperations();
      
      for (const operation of operations) {
        try {
          // Attempt to execute the operation
          await this.executeOperation(operation);
          
          // If successful, remove from queue
          await this.removeOperation(operation.id);
        } catch (error) {
          // Increment attempt count
          operation.attempts += 1;
          
          if (operation.attempts >= 3) {
            // After 3 failures, mark as failed but keep in the database
            operation.status = 'failed';
            await this.updateOperation(operation);
          } else {
            // Otherwise update the record with the new attempt count
            await this.updateOperation(operation);
          }
        }
      }
    } finally {
      this.pendingSync = false;
    }
  }
  
  // Get all pending operations
  async getPendingOperations() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOperations'], 'readonly');
      const store = transaction.objectStore('pendingOperations');
      const request = store.openCursor();
      const operations = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          operations.push(cursor.value);
          cursor.continue();
        } else {
          resolve(operations);
        }
      };
      
      request.onerror = (event) => {
        console.error('Failed to get pending operations:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Execute a single operation
  async executeOperation(operation) {
    // Here we'd use the API connector to execute the operation
    // This is a placeholder implementation
    const { type, endpoint, data } = operation;
    
    // For example:
    // return apiConnector.request(endpoint, { method: type, body: data });
    
    // Simulated implementation for now
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate some random failures to test retry logic
        if (Math.random() < 0.2) {
          reject(new Error('Random operation failure'));
        } else {
          resolve({ success: true });
        }
      }, 500);
    });
  }
  
  // Remove a completed operation
  async removeOperation(id) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOperations'], 'readwrite');
      const store = transaction.objectStore('pendingOperations');
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Failed to remove operation:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Update an operation's status
  async updateOperation(operation) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOperations'], 'readwrite');
      const store = transaction.objectStore('pendingOperations');
      const request = store.put(operation);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Failed to update operation:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Cache a response for offline use
  async cacheResponse(key, response, ttl = 3600000) { // Default 1 hour TTL
    await this.ensureInitialized();
    
    const cachedResponse = {
      key,
      response,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedResponses'], 'readwrite');
      const store = transaction.objectStore('cachedResponses');
      const request = store.put(cachedResponse);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Failed to cache response:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Get a cached response
  async getCachedResponse(key) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedResponses'], 'readonly');
      const store = transaction.objectStore('cachedResponses');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const cachedResponse = request.result;
        
        if (!cachedResponse) {
          resolve(null);
          return;
        }
        
        // Check if the cache is expired
        if (cachedResponse.expiry < Date.now()) {
          // If expired, remove it and return null
          this.deleteCachedResponse(key).catch(console.error);
          resolve(null);
        } else {
          resolve(cachedResponse.response);
        }
      };
      
      request.onerror = (event) => {
        console.error('Failed to get cached response:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Delete a cached response
  async deleteCachedResponse(key) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedResponses'], 'readwrite');
      const store = transaction.objectStore('cachedResponses');
      const request = store.delete(key);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Failed to delete cached response:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Clean up expired cache entries
  async cleanupExpiredCache() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cachedResponses'], 'readwrite');
      const store = transaction.objectStore('cachedResponses');
      const index = store.index('expiry');
      const now = Date.now();
      
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = (event) => {
        console.error('Failed to cleanup expired cache:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Store a conversation locally for offline access
  async storeConversation(conversation) {
    await this.ensureInitialized();
    
    // Add timestamp for ordering
    const conversationWithTimestamp = {
      ...conversation,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put(conversationWithTimestamp);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Failed to store conversation:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Get a stored conversation
  async getConversation(id) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Failed to get conversation:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  // Get all stored conversations
  async getAllConversations() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Failed to get conversations:', event.target.error);
        reject(event.target.error);
      };
    });
  }
}

export default new OfflineManager();

// src/components/mobile/ResponsiveContainer.css
.responsive-container {
  display: grid;
  width: 100%;
  height: 100%;
  transition: all 0.3s ease;
  overflow: hidden;
}

/* Mobile styles */
.responsive-container.mobile {
  grid-template-columns: 1fr;
  padding: 0.5rem;
}

/* Tablet styles */
.responsive-container.tablet {
  grid-template-columns: 1fr;
  padding: 1rem;
  max-width: 768px;
  margin: 0 auto;
}

/* Desktop styles */
.responsive-container.desktop {
  grid-template-columns: 1fr;
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* Chat layout specific styles */
.responsive-container.layout-chat.mobile {
  grid-template-rows: auto 1fr auto;
  height: calc(100vh - 60px); /* Account for bottom navigation */
}

.responsive-container.layout-chat.tablet,
.responsive-container.layout-chat.desktop {
  grid-template-rows: auto 1fr auto;
  height: 100vh;
}

/* Automation layout specific styles */
.responsive-container.layout-automation.mobile {
  height: calc(100vh - 60px); /* Account for bottom navigation */
  padding-bottom: 1rem;
}

/* Social layout specific styles */
.responsive-container.layout-social.mobile {
  grid-template-rows: auto 1fr;
  row-gap: 0.5rem;
  height: calc(100vh - 60px); /* Account for bottom navigation */
}

/* Bottom Navigation styles */
.bottom-navigation {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background-color: #ffffff;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 1000;
}

.bottom-navigation .nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  text-decoration: none;
  flex: 1;
  height: 100%;
  transition: all 0.2s ease;
}

.bottom-navigation .nav-item.active {
  color: #3b82f6;
}

.bottom-navigation .nav-icon {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.bottom-navigation .nav-label {
  font-size: 0.75rem;
  font-weight: 500;
}

/* Offline notification styles */
.offline-notification {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 0.5rem 1rem;
  background-color: #f59e0b;
  color: white;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.offline-notification.reconnected {
  background-color: #10b981;
}

.offline-notification .offline-icon,
.offline-notification .online-icon {
  margin-right: 0.5rem;
}

/* Service worker registration */
// src/serviceWorker.js
// This service worker can be customized for your specific needs
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
        navigator.serviceWorker.ready.then(() => {
          console.log('This web app is being served cache-first by a service worker.');
        });
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('New content is available; please refresh.');
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              console.log('Content is cached for offline use.');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch(error => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then(response => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}

// The service worker file
// public/service-worker.js
// Use workbox for easy service worker setup
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.1.5/workbox-sw.js');

const { routing, strategies, expiration, cacheableResponse, backgroundSync } = workbox;

// Cache the Google Fonts stylesheets with a stale-while-revalidate strategy
routing.registerRoute(
  /^https:\/\/fonts\.googleapis\.com/,
  new strategies.StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Cache the Google Fonts webfont files with a cache-first strategy for 1 year
routing.registerRoute(
  /^https:\/\/fonts\.gstatic\.com/,
  new strategies.CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new expiration.ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        maxEntries: 30,
      }),
    ],
  })
);

// Cache CSS and JavaScript files with a stale-while-revalidate strategy
routing.registerRoute(
  /\.(?:js|css)$/,
  new strategies.StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Cache images with a cache-first strategy
routing.registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|ico)$/,
  new strategies.CacheFirst({
    cacheName: 'images',
    plugins: [
      new expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache the API responses with a network-first strategy
routing.registerRoute(
  /\/api\/v1\/(?!query)/,  // All API routes except streaming queries
  new strategies.NetworkFirst({
    cacheName: 'api-responses',
    plugins: [
      new expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 12 * 60 * 60, // 12 hours
      }),
      new cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Background sync for offline operations
const bgSyncPlugin = new backgroundSync.BackgroundSyncPlugin('conatus-operations-queue', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
});

// Register routes for operations that should be synced when the user is offline
routing.registerRoute(
  /\/api\/v1\/(?:automations|conversations|social)/,
  new strategies.NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

// For navigation requests, use a network-first strategy
routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new strategies.NetworkFirst({
    cacheName: 'navigation',
    plugins: [
      new expiration.ExpirationPlugin({
        maxEntries: 30,
      }),
    ],
  })
);

// Handle the message event to communicate with the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
