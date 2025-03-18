// backend/services/CachingService.js
/**
 * Advanced Caching Service
 * 
 * Provides tiered caching strategy for optimizing performance and reducing costs.
 * Implements hot, warm, and cold caches with appropriate TTLs.
 */

const Redis = require('ioredis');
const { createHash } = require('crypto');

class CachingService {
  constructor() {
    // Initialize Redis client
    this.redis = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });
    
    // Set up event listeners for Redis connection
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });
    
    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });
    
    // Cache TTLs (in seconds)
    this.ttls = {
      hot: 60,            // 1 minute - for frequently changing data
      warm: 600,          // 10 minutes - for semi-static data
      cold: 3600,         // 1 hour - for rarely changing data
      persistent: 86400   // 1 day - for static reference data
    };
  }

  /**
   * Generate a cache key with namespace and hash
   * @param {string} namespace - Cache namespace (e.g., 'user', 'query')
   * @param {string|Object} key - The key or object to hash
   * @returns {string} - Formatted cache key
   */
  generateCacheKey(namespace, key) {
    // If key is an object, stringify it
    const keyString = typeof key === 'object' ? JSON.stringify(key) : key.toString();
    
    // Create a hash of the key to keep it short and consistent
    const hash = createHash('sha256').update(keyString).digest('hex').substring(0, 16);
    
    // Format with namespace
    return `${namespace}:${hash}`;
  }

  /**
   * Store value in hot cache (short TTL)
   * @param {string} namespace - Cache namespace
   * @param {string|Object} key - Cache key or object
   * @param {any} value - Value to store
   * @returns {Promise<boolean>} - Success status
   */
  async setHot(namespace, key, value) {
    return this.set(namespace, key, value, this.ttls.hot);
  }

  /**
   * Store value in warm cache (medium TTL)
   * @param {string} namespace - Cache namespace
   * @param {string|Object} key - Cache key or object
   * @param {any} value - Value to store
   * @returns {Promise<boolean>} - Success status
   */
  async setWarm(namespace, key, value) {
    return this.set(namespace, key, value, this.ttls.warm);
  }

  /**
   * Store value in cold cache (long TTL)
   * @param {string} namespace - Cache namespace
   * @param {string|Object} key - Cache key or object
   * @param {any} value - Value to store
   * @returns {Promise<boolean>} - Success status
   */
  async setCold(namespace, key, value) {
    return this.set(namespace, key, value, this.ttls.cold);
  }

  /**
   * Store value in persistent cache (very long TTL)
   * @param {string} namespace - Cache namespace
   * @param {string|Object} key - Cache key or object
   * @param {any} value - Value to store
   * @returns {Promise<boolean>} - Success status
   */
  async setPersistent(namespace, key, value) {
    return this.set(namespace, key, value, this.ttls.persistent);
  }

  /**
   * Store value in cache with specified TTL
   * @param {string} namespace - Cache namespace
   * @param {string|Object} key - Cache key or object
   * @param {any} value - Value to store
   * @param {number} ttl - Time-to-live in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async set(namespace, key, value, ttl) {
    try {
      const cacheKey = this.generateCacheKey(namespace, key);
      const serializedValue = JSON.stringify(value);
      
      await this.redis.set(cacheKey, serializedValue, 'EX', ttl);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      // Continue execution without cache rather than failing
      return false;
    }
  }

  /**
   * Retrieve value from cache
   * @param {string} namespace - Cache namespace
   * @param {string|Object} key - Cache key or object
   * @returns {Promise<any|null>} - Cached value or null if not found
   */
  async get(namespace, key) {
    try {
      const cacheKey = this.generateCacheKey(namespace, key);
      const cachedValue = await this.redis.get(cacheKey);
      
      if (!cachedValue) {
        return null;
      }
      
      return JSON.parse(cachedValue);
    } catch (error) {
      console.error('Cache get error:', error);
      // Continue execution without cache rather than failing
      return null;
    }
  }

  /**
   * Remove value from cache
   * @param {string} namespace - Cache namespace
   * @param {string|Object} key - Cache key or object
   * @returns {Promise<boolean>} - Success status
   */
  async delete(namespace, key) {
    try {
      const cacheKey = this.generateCacheKey(namespace, key);
      await this.redis.del(cacheKey);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all keys in a namespace
   * @param {string} namespace - Cache namespace
   * @returns {Promise<boolean>} - Success status
   */
  async clearNamespace(namespace) {
    try {
      // Use scan to find all keys in the namespace
      const pattern = `${namespace}:*`;
      let cursor = '0';
      let keys = [];
      
      do {
        const [nextCursor, scanKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        
        cursor = nextCursor;
        keys = keys.concat(scanKeys);
      } while (cursor !== '0');
      
      // Delete all found keys
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      return true;
    } catch (error) {
      console.error('Cache clear namespace error:', error);
      return false;
    }
  }

  /**
   * Store response in appropriate cache based on resource type
   * @param {string} resourceType - Type of resource (e.g., 'query', 'user')
   * @param {string|Object} resourceId - Resource identifier
   * @param {any} data - Data to cache
   * @returns {Promise<boolean>} - Success status
   */
  async cacheResource(resourceType, resourceId, data) {
    // Determine cache tier based on resource type
    switch (resourceType) {
      case 'query_result':
        // Short-lived cache for query results
        return this.setHot('query', resourceId, data);
        
      case 'user_profile':
        // Medium-lived cache for user profiles
        return this.setWarm('user', resourceId, data);
        
      case 'service_status':
        // Medium-lived cache for service status
        return this.setWarm('service', resourceId, data);
        
      case 'automation_template':
        // Long-lived cache for templates
        return this.setCold('template', resourceId, data);
        
      case 'reference_data':
        // Very long-lived cache for reference data
        return this.setPersistent('reference', resourceId, data);
        
      default:
        // Default to warm cache
        return this.setWarm(resourceType, resourceId, data);
    }
  }

  /**
   * Get cached resource
   * @param {string} resourceType - Type of resource
   * @param {string|Object} resourceId - Resource identifier
   * @returns {Promise<any|null>} - Cached data or null
   */
  async getCachedResource(resourceType, resourceId) {
    // Use appropriate namespace based on resource type
    const namespace = this.getNamespaceForResourceType(resourceType);
    return this.get(namespace, resourceId);
  }

  /**
   * Get namespace for resource type
   * @param {string} resourceType - Type of resource
   * @returns {string} - Namespace
   */
  getNamespaceForResourceType(resourceType) {
    const namespaceMap = {
      'query_result': 'query',
      'user_profile': 'user',
      'service_status': 'service',
      'automation_template': 'template',
      'reference_data': 'reference'
    };
    
    return namespaceMap[resourceType] || resourceType;
  }

  /**
   * Cache API response
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @param {any} response - Response data
   * @param {number} ttl - Cache TTL in seconds (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async cacheApiResponse(endpoint, params, response, ttl = null) {
    try {
      const key = { endpoint, params };
      
      if (ttl) {
        return this.set('api', key, response, ttl);
      }
      
      // Choose TTL based on endpoint pattern
      if (endpoint.includes('/user/') || endpoint.includes('/profile/')) {
        return this.setWarm('api', key, response);
      } else if (endpoint.includes('/reference/') || endpoint.includes('/static/')) {
        return this.setPersistent('api', key, response);
      } else {
        return this.setHot('api', key, response);
      }
    } catch (error) {
      console.error('API cache error:', error);
      return false;
    }
  }

  /**
   * Get cached API response
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @returns {Promise<any|null>} - Cached response or null
   */
  async getCachedApiResponse(endpoint, params) {
    const key = { endpoint, params };
    return this.get('api', key);
  }

  /**
   * Cache aggregated metrics
   * @param {string} metricName - Metric name
   * @param {string} period - Time period (day, week, month)
   * @param {any} data - Metric data
   * @returns {Promise<boolean>} - Success status
   */
  async cacheMetrics(metricName, period, data) {
    const key = `${metricName}:${period}`;
    
    // Metrics cache for 1 hour by default
    return this.setCold('metrics', key, data);
  }

  /**
   * Get cached metrics
   * @param {string} metricName - Metric name
   * @param {string} period - Time period
   * @returns {Promise<any|null>} - Cached metrics or null
   */
  async getCachedMetrics(metricName, period) {
    const key = `${metricName}:${period}`;
    return this.get('metrics', key);
  }

  /**
   * Implement cache warming for frequently accessed data
   * @param {string} namespace - Cache namespace
   * @param {Function} dataFetcher - Function that returns fresh data
   * @param {Array<string|Object>} keys - Keys to warm
   * @returns {Promise<void>}
   */
  async warmCache(namespace, dataFetcher, keys) {
    try {
      for (const key of keys) {
        const data = await dataFetcher(key);
        if (data) {
          await this.setWarm(namespace, key, data);
        }
      }
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  /**
   * Implement pattern-based cache invalidation
   * @param {string} pattern - Key pattern to invalidate
   * @returns {Promise<number>} - Number of invalidated keys
   */
  async invalidatePattern(pattern) {
    try {
      let cursor = '0';
      let keys = [];
      
      do {
        const [nextCursor, scanKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        
        cursor = nextCursor;
        keys = keys.concat(scanKeys);
      } while (cursor !== '0');
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      return keys.length;
    } catch (error) {
      console.error('Pattern invalidation error:', error);
      return 0;
    }
  }

  /**
   * Health check for cache service
   * @returns {Promise<boolean>} - Redis connection status
   */
  async healthCheck() {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

module.exports = new CachingService();


// backend/middleware/cacheMiddleware.js
/**
 * API Response Caching Middleware
 */

const CachingService = require('../services/CachingService');

/**
 * Middleware to cache API responses
 * @param {number} ttl - Cache TTL in seconds
 * @returns {Function} Express middleware
 */
exports.cacheMiddleware = (ttl = 60) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Skip caching for authenticated routes if needed
    if (req.path.startsWith('/api/v1/user') && req.path !== '/api/v1/user/public') {
      return next();
    }
    
    try {
      // Generate cache key from request path and query params
      const endpoint = req.path;
      const params = req.query;
      
      // Try to get from cache
      const cachedResponse = await CachingService.getCachedApiResponse(endpoint, params);
      
      if (cachedResponse) {
        // Return cached response
        return res.json(cachedResponse);
      }
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Cache the response
        CachingService.cacheApiResponse(endpoint, params, data, ttl).catch(err => {
          console.error('Error caching response:', err);
        });
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without caching
    }
  };
};

/**
 * Cache control middleware to set appropriate headers
 */
exports.cacheControlMiddleware = (maxAge = 0) => {
  return (req, res, next) => {
    // Set cache control headers
    res.set('Cache-Control', `public, max-age=${maxAge}`);
    next();
  };
};

/**
 * Clear cache for specific patterns
 * @param {string} pattern - Cache key pattern
 * @returns {Promise<number>} - Number of cleared keys
 */
exports.clearCachePattern = async (pattern) => {
  return CachingService.invalidatePattern(pattern);
};
