// backend/services/MonitoringService.js
/**
 * Monitoring Service
 * 
 * Provides comprehensive monitoring, metrics collection, and analytics
 * to track system health, performance, and usage patterns.
 */

const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const winston = require('winston');
const AWS = require('aws-sdk');
const os = require('os');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

// Configure CloudWatch if in production
let cloudwatch;
if (process.env.NODE_ENV === 'production') {
  cloudwatch = new AWS.CloudWatch({
    region: process.env.AWS_REGION || 'us-east-1'
  });
}

class MonitoringService {
  constructor() {
    // Initialize Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'conatus-api' },
      transports: [
        // Console transport for all environments
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }));
      this.logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }));
    }
    
    // CloudWatch namespace
    this.namespace = 'Conatus';
    
    // Default dimensions for metrics
    this.defaultDimensions = [
      {
        Name: 'Environment',
        Value: process.env.NODE_ENV || 'development'
      }
    ];
    
    // Set up service health check intervals
    this.healthCheckIntervals = {};
    
    // Initialize metric aggregation
    this.metricAggregation = {
      // LLM usage metrics
      llm_tokens: {},
      llm_requests: {},
      llm_errors: {},
      
      // API metrics
      api_requests: {},
      api_latency: {},
      api_errors: {},
      
      // Automation metrics
      automation_executions: {},
      automation_errors: {},
      
      // System metrics
      system_memory: [],
      system_cpu: []
    };
    
    // Start system metrics collection in production
    if (process.env.NODE_ENV === 'production') {
      this.startSystemMetricsCollection();
    }
  }

  /**
   * Log message with context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    this.logger.log(level, message, meta);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or details
   * @param {Object} meta - Additional metadata
   */
  error(message, error = {}, meta = {}) {
    const errorMeta = {
      ...meta,
      error: error instanceof Error 
        ? { message: error.message, stack: error.stack }
        : error
    };
    
    this.log('error', message, errorMeta);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Record metric in CloudWatch
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {string} unit - Metric unit (Count, Milliseconds, etc.)
   * @param {Array} dimensions - Additional dimensions
   * @returns {Promise<boolean>} - Success status
   */
  async recordMetric(name, value, unit = 'Count', dimensions = []) {
    try {
      // Aggregate metrics locally
      this.aggregateMetric(name, value, unit, dimensions);
      
      // Only send to CloudWatch in production
      if (process.env.NODE_ENV !== 'production' || !cloudwatch) {
        return true;
      }
      
      await cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: name,
            Dimensions: [...this.defaultDimensions, ...dimensions],
            Value: value,
            Unit: unit,
            Timestamp: new Date()
          }
        ]
      }).promise();
      
      return true;
    } catch (error) {
      this.error('Error recording metric', error, { metricName: name });
      return false;
    }
  }

  /**
   * Aggregate metric for local storage and periodic flushing
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {string} unit - Metric unit
   * @param {Array} dimensions - Additional dimensions
   */
  aggregateMetric(name, value, unit, dimensions) {
    try {
      // Create dimension key for aggregation
      const dimensionKey = dimensions.map(d => `${d.Name}=${d.Value}`).join(',');
      
      // Get aggregation group based on metric name
      let groupKey = 'api_requests'; // default
      
      if (name.startsWith('LLM')) {
        if (name.includes('Tokens')) {
          groupKey = 'llm_tokens';
        } else if (name.includes('Requests')) {
          groupKey = 'llm_requests';
        } else if (name.includes('Errors')) {
          groupKey = 'llm_errors';
        }
      } else if (name.startsWith('API')) {
        if (name.includes('Latency')) {
          groupKey = 'api_latency';
        } else if (name.includes('Errors')) {
          groupKey = 'api_errors';
        }
      } else if (name.startsWith('Automation')) {
        if (name.includes('Errors')) {
          groupKey = 'automation_errors';
        } else {
          groupKey = 'automation_executions';
        }
      } else if (name.startsWith('System')) {
        if (name.includes('Memory')) {
          groupKey = 'system_memory';
        } else if (name.includes('CPU')) {
          groupKey = 'system_cpu';
        }
      }
      
      // Initialize metric group if needed
      if (!this.metricAggregation[groupKey]) {
        this.metricAggregation[groupKey] = {};
      }
      
      // Initialize metric for this dimension if needed
      const metricKey = `${name}:${dimensionKey}`;
      if (!this.metricAggregation[groupKey][metricKey]) {
        this.metricAggregation[groupKey][metricKey] = {
          count: 0,
          sum: 0,
          min: Number.MAX_VALUE,
          max: Number.MIN_VALUE,
          unit
        };
      }
      
      // Update metric
      const metric = this.metricAggregation[groupKey][metricKey];
      metric.count++;
      metric.sum += value;
      metric.min = Math.min(metric.min, value);
      metric.max = Math.max(metric.max, value);
    } catch (error) {
      this.error('Error aggregating metric', error);
    }
  }

  /**
   * Flush aggregated metrics to persistent storage
   * @returns {Promise<boolean>} - Success status
   */
  async flushMetrics() {
    try {
      const timestamp = new Date().toISOString();
      const metrics = {};
      
      // Process each metric group
      for (const [groupKey, group] of Object.entries(this.metricAggregation)) {
        if (typeof group === 'object' && !Array.isArray(group)) {
          // For counter-type metrics
          metrics[groupKey] = {};
          
          for (const [metricKey, data] of Object.entries(group)) {
            // Only store metrics that have data
            if (data.count > 0) {
              metrics[groupKey][metricKey] = {
                ...data,
                timestamp
              };
            }
          }
          
          // Reset counters
          this.metricAggregation[groupKey] = {};
        } else if (Array.isArray(group) && group.length > 0) {
          // For time-series metrics (like system metrics)
          metrics[groupKey] = [...group];
          
          // Reset array
          this.metricAggregation[groupKey] = [];
        }
      }
      
      // Store in database
      await supabase.from('metrics').insert({
        timestamp,
        data: metrics
      });
      
      // Also cache latest metrics
      await redis.set('metrics:latest', JSON.stringify(metrics), 'EX', 3600);
      
      return true;
    } catch (error) {
      this.error('Error flushing metrics', error);
      return false;
    }
  }

  /**
   * Start system metrics collection
   * @param {number} interval - Collection interval in milliseconds
   */
  startSystemMetricsCollection(interval = 60000) {
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, interval);
    
    // Ensure the interval doesn't keep the process alive
    this.systemMetricsInterval.unref();
  }

  /**
   * Collect system metrics (CPU, memory)
   */
  collectSystemMetrics() {
    try {
      // Get memory usage
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      
      // Get CPU load
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      }
      
      const cpuUsagePercent = 100 - ((totalIdle / totalTick) * 100);
      
      // Record in CloudWatch
      this.recordMetric('SystemMemoryUsage', memoryUsagePercent, 'Percent');
      this.recordMetric('SystemCPUUsage', cpuUsagePercent, 'Percent');
      
      // Store in time-series format
      this.metricAggregation.system_memory.push({
        timestamp: new Date().toISOString(),
        value: memoryUsagePercent
      });
      
      this.metricAggregation.system_cpu.push({
        timestamp: new Date().toISOString(),
        value: cpuUsagePercent
      });
      
      // Keep only the last 60 data points (1 hour at 1-minute intervals)
      if (this.metricAggregation.system_memory.length > 60) {
        this.metricAggregation.system_memory.shift();
      }
      
      if (this.metricAggregation.system_cpu.length > 60) {
        this.metricAggregation.system_cpu.shift();
      }
    } catch (error) {
      this.error('Error collecting system metrics', error);
    }
  }

  /**
   * Track LLM usage metrics
   * @param {string} provider - LLM provider (CLAUDE, OPENAI, etc.)
   * @param {number} tokensUsed - Number of tokens used
   * @param {boolean} success - Whether the request was successful
   * @returns {Promise<void>}
   */
  async trackLLMUsage(provider, tokensUsed, success = true) {
    try {
      // Record metrics
      await this.recordMetric('LLMTokensUsed', tokensUsed, 'Count', [
        { Name: 'Provider', Value: provider }
      ]);
      
      await this.recordMetric('LLMRequests', 1, 'Count', [
        { Name: 'Provider', Value: provider }
      ]);
      
      if (!success) {
        await this.recordMetric('LLMErrors', 1, 'Count', [
          { Name: 'Provider', Value: provider }
        ]);
      }
      
      // Update daily counters in Redis
      const date = new Date().toISOString().split('T')[0];
      const key = `stats:llm:${date}:${provider}`;
      
      await redis.hincrby(key, 'tokens', tokensUsed);
      await redis.hincrby(key, 'requests', 1);
      
      if (!success) {
        await redis.hincrby(key, 'errors', 1);
      }
      
      // Set expiration (keep for 30 days)
      await redis.expire(key, 60 * 60 * 24 * 30);
    } catch (error) {
      this.error('Error tracking LLM usage', error);
    }
  }

  /**
   * Track API usage metrics
   * @param {string} endpoint - API endpoint
   * @param {number} latency - Request latency in milliseconds
   * @param {number} statusCode - HTTP status code
   * @returns {Promise<void>}
   */
  async trackAPIUsage(endpoint, latency, statusCode) {
    try {
      // Extract endpoint pattern (remove IDs)
      const pattern = endpoint.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:id');
      
      // Record metrics
      await this.recordMetric('APILatency', latency, 'Milliseconds', [
        { Name: 'Endpoint', Value: pattern }
      ]);
      
      await this.recordMetric('APIRequests', 1, 'Count', [
        { Name: 'Endpoint', Value: pattern },
        { Name: 'StatusCode', Value: statusCode.toString() }
      ]);
      
      if (statusCode >= 400) {
        await this.recordMetric('APIErrors', 1, 'Count', [
          { Name: 'Endpoint', Value: pattern },
          { Name: 'StatusCode', Value: statusCode.toString() }
        ]);
      }
      
      // Update API counters in Redis
      const date = new Date().toISOString().split('T')[0];
      const key = `stats:api:${date}:${pattern}`;
      
      await redis.hincrby(key, 'requests', 1);
      await redis.hincrby(key, `status_${statusCode}`, 1);
      await redis.hincrbyfloat(key, 'total_latency', latency);
      
      // Set expiration (keep for 30 days)
      await redis.expire(key, 60 * 60 * 24 * 30);
    } catch (error) {
      this.error('Error tracking API usage', error);
    }
  }

  /**
   * Track automation execution metrics
   * @param {string} automationType - Type of automation
   * @param {boolean} success - Whether execution was successful
   * @param {number} duration - Execution duration in milliseconds
   * @returns {Promise<void>}
   */
  async trackAutomationExecution(automationType, success, duration) {
    try {
      // Record metrics
      await this.recordMetric('AutomationExecutions', 1, 'Count', [
        { Name: 'Type', Value: automationType },
        { Name: 'Success', Value: success ? 'True' : 'False' }
      ]);
      
      if (duration) {
        await this.recordMetric('AutomationDuration', duration, 'Milliseconds', [
          { Name: 'Type', Value: automationType }
        ]);
      }
      
      if (!success) {
        await this.recordMetric('AutomationErrors', 1, 'Count', [
          { Name: 'Type', Value: automationType }
        ]);
      }
      
      // Update automation counters in Redis
      const date = new Date().toISOString().split('T')[0];
      const key = `stats:automation:${date}:${automationType}`;
      
      await redis.hincrby(key, 'executions', 1);
      await redis.hincrby(key, success ? 'successes' : 'failures', 1);
      
      if (duration) {
        await redis.hincrbyfloat(key, 'total_duration', duration);
      }
      
      // Set expiration (keep for 30 days)
      await redis.expire(key, 60 * 60 * 24 * 30);
    } catch (error) {
      this.error('Error tracking automation execution', error);
    }
  }

  /**
   * Track user activity
   * @param {string} userId - User ID
   * @param {string} activityType - Type of activity
   * @param {Object} metadata - Additional activity data
   * @returns {Promise<void>}
   */
  async trackUserActivity(userId, activityType, metadata = {}) {
    try {
      // Record in database
      await supabase.from('user_activities').insert({
        user_id: userId,
        activity_type: activityType,
        metadata,
        created_at: new Date().toISOString()
      });
      
      // Also record as metric
      await this.recordMetric('UserActivity', 1, 'Count', [
        { Name: 'ActivityType', Value: activityType }
      ]);
    } catch (error) {
      this.error('Error tracking user activity', error);
    }
  }

  /**
   * Register a health check for a service
   * @param {string} serviceName - Service name
   * @param {Function} checkFn - Health check function returning Promise<boolean>
   * @param {number} interval - Check interval in milliseconds
   */
  registerHealthCheck(serviceName, checkFn, interval = 60000) {
    // Clear existing interval if any
    if (this.healthCheckIntervals[serviceName]) {
      clearInterval(this.healthCheckIntervals[serviceName]);
    }
    
    // Set up new interval
    this.healthCheckIntervals[serviceName] = setInterval(async () => {
      try {
        const isHealthy = await checkFn();
        
        // Record metric
        await this.recordMetric('ServiceHealth', isHealthy ? 1 : 0, 'None', [
          { Name: 'Service', Value: serviceName }
        ]);
        
        // Log unhealthy services
        if (!isHealthy) {
          this.warn(`Health check failed for ${serviceName}`);
        }
        
        // Update health status in Redis
        await redis.hset('service:health', serviceName, isHealthy ? 'healthy' : 'unhealthy');
        await redis.hset('service:health:timestamp', serviceName, Date.now().toString());
      } catch (error) {
        this.error(`Health check error for ${serviceName}`, error);
        
        // Record as unhealthy
        await this.recordMetric('ServiceHealth', 0, 'None', [
          { Name: 'Service', Value: serviceName }
        ]);
        
        // Update health status in Redis
        await redis.hset('service:health', serviceName, 'unhealthy');
        await redis.hset('service:health:timestamp', serviceName, Date.now().toString());
      }
    }, interval);
    
    // Ensure interval doesn't keep process alive
    this.healthCheckIntervals[serviceName].unref();
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} - Health status for all services
   */
  async getServiceHealth() {
    try {
      // Get all health statuses from Redis
      const services = await redis.hgetall('service:health');
      const timestamps = await redis.hgetall('service:health:timestamp');
      
      // Format response
      const result = {};
      
      for (const [service, status] of Object.entries(services)) {
        result[service] = {
          status,
          timestamp: timestamps[service] ? new Date(parseInt(timestamps[service])) : null
        };
      }
      
      return result;
    } catch (error) {
      this.error('Error getting service health', error);
      return {};
    }
  }

  /**
   * Get usage metrics
   * @param {string} metricType - Type of metric (llm, api, automation)
   * @param {string} period - Time period (day, week, month)
   * @returns {Promise<Object>} - Aggregated metrics
   */
  async getUsageMetrics(metricType, period = 'day') {
    try {
      const now = new Date();
      const metrics = {};
      
      // Determine date range
      let days = 1;
      if (period === 'week') days = 7;
      if (period === 'month') days = 30;
      
      // Get metrics for each day
      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Get keys matching the pattern
        const keys = await redis.keys(`stats:${metricType}:${dateStr}:*`);
        
        // Process each key
        for (const key of keys) {
          const data = await redis.hgetall(key);
          
          // Extract service/endpoint from key
          const parts = key.split(':');
          const service = parts[3]; // stats:type:date:service
          
          if (!metrics[service]) {
            metrics[service] = {};
          }
          
          if (!metrics[service][dateStr]) {
            metrics[service][dateStr] = {};
          }
          
          // Add data to metrics
          Object.entries(data).forEach(([k, v]) => {
            // Convert to number if possible
            metrics[service][dateStr][k] = isNaN(v) ? v : parseFloat(v);
          });
        }
      }
      
      return metrics;
    } catch (error) {
      this.error('Error getting usage metrics', error);
      return {};
    }
  }

  /**
   * Get system metrics
   * @param {string} metricType - Type of metric (memory, cpu)
   * @param {number} hours - Number of hours of data to return
   * @returns {Promise<Array>} - Time series data
   */
  async getSystemMetrics(metricType, hours = 1) {
    try {
      // For recent metrics, use in-memory data
      if (hours <= 1) {
        return this.metricAggregation[`system_${metricType}`] || [];
      }
      
      // For longer periods, query database
      const { data, error } = await supabase
        .from('metrics')
        .select('timestamp, data')
        .order('timestamp', { ascending: false })
        .limit(hours); // Assuming one entry per hour
      
      if (error) {
        throw error;
      }
      
      // Extract and format the data
      const result = [];
      
      for (const entry of data) {
        const metrics = entry.data[`system_${metricType}`];
        
        if (metrics && Array.isArray(metrics)) {
          result.push(...metrics);
        }
      }
      
      // Sort by timestamp
      result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      return result;
    } catch (error) {
      this.error('Error getting system metrics', error);
      return [];
    }
  }

  /**
   * Create performance trace for request
   * @param {string} name - Trace name
   * @returns {Object} - Trace object with methods
   */
  createTrace(name) {
    const startTime = process.hrtime();
    const spans = [];
    let current = null;
    
    return {
      // Start a new span
      startSpan: (spanName) => {
        if (current) {
          // Close current span
          current.end = process.hrtime(startTime);
          spans.push(current);
        }
        
        current = {
          name: spanName,
          start: process.hrtime(startTime),
          end: null
        };
        
        return current;
      },
      
      // End current span
      endSpan: () => {
        if (current) {
          current.end = process.hrtime(startTime);
          spans.push(current);
          current = null;
        }
      },
      
      // End the entire trace and get results
      end: async () => {
        // End current span if any
        if (current) {
          current.end = process.hrtime(startTime);
          spans.push(current);
        }
        
        const endTime = process.hrtime(startTime);
        const totalMs = (endTime[0] * 1000) + (endTime[1] / 1000000);
        
        // Format spans with durations
        const formattedSpans = spans.map(span => ({
          name: span.name,
          startMs: (span.start[0] * 1000) + (span.start[1] / 1000000),
          endMs: (span.end[0] * 1000) + (span.end[1] / 1000000),
          durationMs: ((span.end[0] - span.start[0]) * 1000) + ((span.end[1] - span.start[1]) / 1000000)
        }));
        
        // Log trace
        this.debug(`Trace ${name} completed`, {
          name,
          durationMs: totalMs,
          spans: formattedSpans
        });
        
        // Store trace data if needed
        // This could go to a tracing service in production
        
        return {
          name,
          durationMs: totalMs,
          spans: formattedSpans
        };
      }
    };
  }
}

module.exports = new MonitoringService();


// backend/middleware/monitoringMiddleware.js
/**
 * Monitoring Middleware
 */

const { v4: uuidv4 } = require('uuid');
const MonitoringService = require('../services/MonitoringService');

/**
 * Middleware to add request tracking and metrics
 */
exports.requestTracking = (req, res, next) => {
  // Add request ID
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  
  // Record start time
  req.startTime = Date.now();
  
  // Create trace for the request
  req.trace = MonitoringService.createTrace(`${req.method} ${req.path}`);
  
  // Capture original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics when request completes
  res.end = function() {
    // Calculate request duration
    const duration = Date.now() - req.startTime;
    
    // End trace
    req.trace.end().catch(err => {
      MonitoringService.error('Error ending trace', err);
    });
    
    // Track API usage
    MonitoringService.trackAPIUsage(
      req.originalUrl || req.url,
      duration,
      res.statusCode
    ).catch(err => {
      MonitoringService.error('Error tracking API usage', err);
    });
    
    // Log request completion
    const logLevel = res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warn' : 'info';
    
    MonitoringService.log(logLevel, `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`, {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      requestId: req.id,
      userAgent: req.headers['user-agent']
    });
    
    // Call original end method
    return originalEnd.apply(this, arguments);
  };
  
  // Continue to next middleware
  next();
};

/**
 * Middleware to track LLM usage
 */
exports.trackLLMUsage = (provider, tokensUsed, success = true) => {
  return MonitoringService.trackLLMUsage(provider, tokensUsed, success);
};

/**
 * Middleware to track user activity
 */
exports.trackUserActivity = (userId, activityType, metadata = {}) => {
  return MonitoringService.trackUserActivity(userId, activityType, metadata);
};

/**
 * Middleware to track automation execution
 */
exports.trackAutomationExecution = (automationType, success, duration) => {
  return MonitoringService.trackAutomationExecution(automationType, success, duration);
};
