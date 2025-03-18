// src/services/cache-service.js

class CacheService {
  constructor() {
    // Initialize different cache stores with different TTLs
    this.caches = {
      llm: new Map(),  // For expensive LLM responses
      data: new Map(),  // For API data responses
      ui: new Map()     // For UI state that should persist
    };
    
    // Default TTLs in milliseconds
    this.ttl = {
      llm: 3600000,  // 1 hour for LLM responses
      data: 300000,  // 5 minutes for API data
      ui: 86400000   // 24 hours for UI state
    };
    
    // Set limits to prevent memory bloat
    this.limits = {
      llm: 100,  // Store up to 100 LLM responses
      data: 200, // Store up to 200 data responses
      ui: 50     // Store up to 50 UI states
    };
    
    // Setup periodic cleanup
    this.setupCleanup();
    
    // Load persisted cache on startup
    this.loadCache();
  }
  
  // Set an item in cache
  set(cacheType, key, value, customTtl = null) {
    if (!this.caches[cacheType]) {
      console.warn(`Cache type ${cacheType} does not exist`);
      return value;
    }
    
    const ttl = customTtl || this.ttl[cacheType];
    const expiresAt = Date.now() + ttl;
    
    // Check if we need to evict items due to limit
    if (this.caches[cacheType].size >= this.limits[cacheType]) {
      this.evictOldest(cacheType);
    }
    
    // Store with metadata
    this.caches[cacheType].set(key, {
      value,
      expiresAt,
      insertedAt: Date.now(),
      accessCount: 0
    });
    
    // Persist UI cache immediately for critical data
    if (cacheType === 'ui') {
      this.persistCache();
    }
    
    return value;
  }
  
  // Get an item from cache
  get(cacheType, key) {
    if (!this.caches[cacheType]) {
      console.warn(`Cache type ${cacheType} does not exist`);
      return null;
    }
    
    const cached = this.caches[cacheType].get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check expiration
    if (cached.expiresAt < Date.now()) {
      this.caches[cacheType].delete(key);
      return null;
    }
    
    // Update access metadata
    cached.accessCount++;
    cached.lastAccessed = Date.now();
    
    return cached.value;
  }
  
  // Implementation of stale-while-revalidate pattern
  async getWithRevalidate(cacheType, key, fetchFn) {
    // Check cache first
    const cached = this.get(cacheType, key);
    
    // If we have a valid cached value
    if (cached) {
      // If it's getting stale (75% through its lifetime), trigger revalidation
      const entry = this.caches[cacheType].get(key);
      const totalLifetime = entry.expiresAt - entry.insertedAt;
      const elapsed = Date.now() - entry.insertedAt;
      
      if (elapsed > totalLifetime * 0.75) {
        // Revalidate asynchronously without blocking current request
        this.revalidate(cacheType, key, fetchFn).catch(err => {
          console.warn('Background revalidation failed:', err);
        });
      }
      
      return cached;
    }
    
    // No cache hit, need to fetch
    try {
      const fresh = await fetchFn();
      this.set(cacheType, key, fresh);
      return fresh;
    } catch (error) {
      throw error;
    }
  }
  
  // Background revalidation function
  async revalidate(cacheType, key, fetchFn) {
    try {
      const fresh = await fetchFn();
      this.set(cacheType, key, fresh);
      return fresh;
    } catch (error) {
      // On revalidation errors, keep using the cache
      console.warn('Revalidation error:', error);
      return this.get(cacheType, key);
    }
  }
  
  // Invalidate a specific key or entire cache type
  invalidate(cacheType, key = null) {
    if (!this.caches[cacheType]) {
      console.warn(`Cache type ${cacheType} does not exist`);
      return;
    }
    
    if (key) {
      this.caches[cacheType].delete(key);
    } else {
      this.caches[cacheType].clear();
    }
    
    // Update persisted cache if UI cache is modified
    if (cacheType === 'ui') {
      this.persistCache();
    }
  }
  
  // Evict the oldest or least accessed item when cache is full
  evictOldest(cacheType) {
    if (this.caches[cacheType].size === 0) return;
    
    let oldestKey = null;
    let oldestScore = Infinity;
    
    // Calculate a score based on age and access count
    for (const [key, data] of this.caches[cacheType].entries()) {
      // Higher access count gives lower eviction priority
      // Older items get higher eviction priority
      const ageScore = (Date.now() - data.insertedAt) / 3600000; // Age in hours
      const accessScore = -Math.log(data.accessCount + 1); // Log scale for access count
      const score = ageScore + accessScore;
      
      if (score < oldestScore) {
        oldestScore = score;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.caches[cacheType].delete(oldestKey);
    }
  }
  
  // Clean up expired items periodically
  setupCleanup() {
    // Run cleanup every minute
    setInterval(() => {
      const now = Date.now();
      
      for (const [cacheType, cache] of Object.entries(this.caches)) {
        for (const [key, data] of cache.entries()) {
          if (data.expiresAt < now) {
            cache.delete(key);
          }
        }
      }
      
      // Persist cache after cleanup
      this.persistCache();
    }, 60000); // Every minute
  }
  
  // Persist UI cache to localStorage
  persistCache() {
    try {
      // Only persist UI cache as it's meant to survive refreshes
      const uiCache = {};
      
      for (const [key, data] of this.caches.ui.entries()) {
        // Don't persist already expired items
        if (data.expiresAt > Date.now()) {
          uiCache[key] = data;
        }
      }
      
      localStorage.setItem('ui_cache', JSON.stringify(uiCache));
    } catch (error) {
      console.warn('Failed to persist cache:', error);
    }
  }
  
  // Load cache from localStorage
  loadCache() {
    try {
      const uiCache = localStorage.getItem('ui_cache');
      
      if (uiCache) {
        const parsed = JSON.parse(uiCache);
        
        for (const [key, data] of Object.entries(parsed)) {
          // Don't load expired items
          if (data.expiresAt > Date.now()) {
            this.caches.ui.set(key, data);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache:', error);
    }
  }
  
  // Generate a hash key for LLM queries to enable caching similar questions
  generateQueryHash(query) {
    // Normalize query text
    const normalized = query.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract key terms (simple approach)
    const terms = normalized
      .split(' ')
      .filter(term => term.length > 3) // Skip short words
      .filter(term => !this.isStopWord(term)) // Skip common stop words
      .sort() // Sort for consistency
      .join('_');
    
    return terms || normalized; // Fallback to full query if no terms extracted
  }
  
  // Check if a term is a common stop word
  isStopWord(term) {
    const stopWords = [
      'the', 'and', 'a', 'an', 'to', 'of', 'for', 'in', 'on', 'by', 'at',
      'with', 'about', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'but', 'not', 'what',
      'when', 'where', 'why', 'how', 'who', 'which', 'this', 'that'
    ];
    
    return stopWords.includes(term);
  }
}

export default new CacheService();
