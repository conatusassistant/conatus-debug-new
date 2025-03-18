// tests/integration/llm-service.test.js
/**
 * Integration tests for the LLM Service
 */
const { expect } = require('chai');
const sinon = require('sinon');
const LLMService = require('../../backend/services/llm/LLMService');
const ClassificationService = require('../../backend/services/classification/ClassificationService');
const redis = require('ioredis');
const fetch = require('node-fetch');

describe('LLM Service', () => {
  let redisStub;
  let fetchStub;
  let classifyStub;
  
  beforeEach(() => {
    // Stub Redis
    redisStub = sinon.stub(redis.prototype);
    redisStub.get.resolves(null);
    redisStub.set.resolves('OK');
    redisStub.zadd.resolves(1);
    redisStub.zrem.resolves(1);
    
    // Stub fetch for API calls
    fetchStub = sinon.stub(fetch);
    
    // Stub the classification service
    classifyStub = sinon.stub(ClassificationService, 'classifyQuery');
    classifyStub.resolves('CLAUDE');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('routeQuery', () => {
    it('should route to the correct provider based on classification', async () => {
      // Setup fetch stub to return a successful response
      fetchStub.resolves({
        ok: true,
        json: async () => ({
          content: 'This is a test response',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      });
      
      const result = await LLMService.routeQuery('What is 2+2?');
      
      expect(result).to.be.an('object');
      expect(result.content).to.equal('This is a test response');
      expect(result.provider).to.equal('CLAUDE');
      expect(result.fromCache).to.be.false;
      
      // Verify classification was called
      expect(classifyStub.calledOnce).to.be.true;
    });
    
    it('should use cache when available', async () => {
      // Setup Redis to return a cached response
      const cachedResponse = JSON.stringify({
        content: 'Cached response',
        tokenUsage: {
          prompt_tokens: 5,
          completion_tokens: 10,
          total_tokens: 15
        }
      });
      
      redisStub.get.resolves(cachedResponse);
      
      const result = await LLMService.routeQuery('What is 2+2?', 'CLAUDE');
      
      expect(result).to.be.an('object');
      expect(result.content).to.equal('Cached response');
      expect(result.provider).to.equal('CLAUDE');
      expect(result.fromCache).to.be.true;
      
      // Verify fetch was not called
      expect(fetchStub.called).to.be.false;
    });
    
    it('should fall back to another provider when primary is unavailable', async () => {
      // Force provider check to return false
      const checkProviderStub = sinon.stub(LLMService, 'checkProviderAvailability');
      checkProviderStub.withArgs('CLAUDE').resolves(false);
      checkProviderStub.withArgs('OPENAI').resolves(true);
      
      // Setup fetch for OpenAI response
      fetchStub.resolves({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Fallback response'
            }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      });
      
      const result = await LLMService.routeQuery('What is 2+2?', 'CLAUDE');
      
      expect(result).to.be.an('object');
      expect(result.content).to.equal('Fallback response');
      // Should fall back to OpenAI
      expect(result.provider).to.equal('OPENAI');
      expect(result.fromCache).to.be.false;
    });
    
    it('should handle errors gracefully', async () => {
      // Force fetch to throw an error
      fetchStub.rejects(new Error('API Error'));
      
      // Make sure fallback also fails
      const processOpenAIStub = sinon.stub(LLMService, 'processOpenAIQuery');
      processOpenAIStub.rejects(new Error('Fallback Error'));
      
      // Should return error response
      const result = await LLMService.routeQuery('What is 2+2?', 'CLAUDE');
      
      expect(result).to.be.an('object');
      expect(result.provider).to.equal('ERROR');
      expect(result.error).to.equal('API Error');
    });
  });
  
  describe('streamQuery', () => {
    it('should stream responses from the provider', async () => {
      // Create a mock readable stream
      const mockStream = {
        readable: true,
        getReader: () => ({
          read: sinon.stub()
            .onFirstCall().resolves({
              done: false,
              value: Buffer.from('data: {"type":"content","content":"Hello"}\n\n')
            })
            .onSecondCall().resolves({
              done: false,
              value: Buffer.from('data: {"type":"content","content":" World"}\n\n')
            })
            .onThirdCall().resolves({
              done: true
            })
        })
      };
      
      // Setup fetch to return streaming response
      fetchStub.resolves({
        ok: true,
        body: mockStream
      });
      
      // Create readable stream to capture output
      const outputChunks = [];
      const mockOutputStream = {
        push: (chunk) => outputChunks.push(chunk)
      };
      
      // Stub creation of output stream
      sinon.stub(LLMService, 'createReadableStream').returns(mockOutputStream);
      
      await LLMService.streamQuery('What is 2+2?', 'CLAUDE');
      
      // Verify output content
      expect(outputChunks).to.have.lengthOf(4); // provider + 2 content chunks + end
      expect(outputChunks[0]).to.include('provider');
      expect(outputChunks[1]).to.include('Hello');
      expect(outputChunks[2]).to.include('World');
      expect(outputChunks[3]).to.include('end');
    });
    
    it('should handle streaming errors gracefully', async () => {
      // Force fetch to throw an error
      fetchStub.rejects(new Error('Stream Error'));
      
      // Create readable stream to capture output
      const outputChunks = [];
      const mockOutputStream = {
        push: (chunk) => outputChunks.push(chunk)
      };
      
      // Stub creation of output stream
      sinon.stub(LLMService, 'createReadableStream').returns(mockOutputStream);
      
      await LLMService.streamQuery('What is 2+2?', 'CLAUDE');
      
      // Verify error output
      expect(outputChunks).to.have.lengthOf(2); // provider + error
      expect(outputChunks[0]).to.include('provider');
      expect(outputChunks[1]).to.include('error');
      expect(outputChunks[1]).to.include('Stream Error');
    });
  });
});

// tests/e2e/automation.test.js
/**
 * End-to-end tests for automation workflows
 */
const { test, expect } = require('@playwright/test');
const { v4: uuidv4 } = require('uuid');

test.describe('Automation workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for login completion
    await page.waitForNavigation();
  });
  
  test('should create a scheduled WhatsApp message automation', async ({ page }) => {
    // Navigate to Library tab
    await page.click('a[href="/library"]');
    
    // Click create automation button
    await page.click('button:has-text("Create Automation")');
    
    // Fill automation details
    const automationName = `Test Automation ${uuidv4().substring(0, 8)}`;
    await page.fill('input#automation-name', automationName);
    
    // Select recurring trigger
    await page.click('.trigger-card:has-text("Recurring")');
    
    // Configure recurring trigger
    await page.selectOption('select#trigger-schedule', 'daily');
    await page.fill('input#trigger-time', '09:00');
    
    // Select message action
    await page.click('.action-card:has-text("Send Message")');
    
    // Connect WhatsApp if needed
    if (await page.isVisible('text=Connect WhatsApp')) {
      // This would need to be handled specifically for your OAuth flow
      // Here we just check if the connect dialog appears
      expect(await page.isVisible('text=Connect WhatsApp')).toBeTruthy();
      // In a real test, we'd need to mock the OAuth flow
    }
    
    // Configure message action
    await page.fill('input#action-recipient', 'Test User');
    await page.fill('textarea#action-content', 'Good morning! This is an automated test message.');
    
    // Submit the form
    await page.click('button:has-text("Create Automation")');
    
    // Verify the automation was created
    await page.waitForSelector(`.automation-card:has-text("${automationName}")`);
    
    // Verify automation details
    expect(await page.textContent(`.automation-card:has-text("${automationName}")`))
      .toContain('Daily at 09:00');
    expect(await page.textContent(`.automation-card:has-text("${automationName}")`))
      .toContain('WhatsApp');
  });
  
  test('should execute an instant automation from chat', async ({ page }) => {
    // Navigate to Home tab
    await page.click('a[href="/"]');
    
    // Type an automation command
    await page.fill('textarea.message-input', 'Send a WhatsApp message to Test User saying This is a test message');
    await page.press('textarea.message-input', 'Enter');
    
    // Wait for automation suggestion to appear
    await page.waitForSelector('.automation-suggestion');
    
    // Verify suggestion details
    expect(await page.textContent('.automation-suggestion'))
      .toContain('Send "This is a test message" to Test User on WhatsApp');
    
    // Execute the automation
    await page.click('button:has-text("Execute")');
    
    // Verify success message
    await page.waitForSelector('text=✓ Message sent to Test User on WhatsApp');
  });
});

// monitoring/cloudwatch-metrics.js
/**
 * CloudWatch metrics reporting
 */
const AWS = require('aws-sdk');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// Initialize clients
const cloudwatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION || 'us-west-2'
});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

/**
 * Report metrics to CloudWatch
 */
async function reportMetrics() {
  try {
    // Get usage metrics for each provider
    const providerMetrics = await getProviderMetrics();
    
    // Get system metrics
    const systemMetrics = await getSystemMetrics();
    
    // Get user metrics
    const userMetrics = await getUserMetrics();
    
    // Report provider metrics
    await reportProviderMetrics(providerMetrics);
    
    // Report system metrics
    await reportSystemMetrics(systemMetrics);
    
    // Report user metrics
    await reportUserMetrics(userMetrics);
    
    console.log('Successfully reported metrics to CloudWatch');
  } catch (error) {
    console.error('Error reporting CloudWatch metrics:', error);
  }
}

/**
 * Get metrics for each LLM provider
 */
async function getProviderMetrics() {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Get usage for each provider
  const providers = ['CLAUDE', 'PERPLEXITY', 'OPENAI', 'DEEPSEEK'];
  const metrics = {};
  
  for (const provider of providers) {
    const dailyKey = `usage:${today}:${provider}`;
    const result = await redis.hgetall(dailyKey);
    
    if (result && Object.keys(result).length > 0) {
      metrics[provider] = {
        inputTokens: parseInt(result.input_tokens || 0),
        outputTokens: parseInt(result.output_tokens || 0),
        totalTokens: parseInt(result.total_tokens || 0),
        inputCost: parseFloat(result.input_cost || 0),
        outputCost: parseFloat(result.output_cost || 0),
        totalCost: parseFloat(result.total_cost || 0)
      };
    } else {
      metrics[provider] = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputCost: 0,
        outputCost: 0,
        totalCost: 0
      };
    }
  }
  
  return metrics;
}

/**
 * Get system-wide metrics
 */
async function getSystemMetrics() {
  try {
    // Get active user count
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: activeUsers, error: activeError } = await supabase
      .from('user_activity')
      .select('user_id')
      .gt('last_active', oneDayAgo.toISOString())
      .limit(10000);
    
    // Get total query count for last 24 hours
    const { data: queryLogs, error: queryError } = await supabase
      .from('query_logs')
      .select('count')
      .gt('created_at', oneDayAgo.toISOString())
      .single();
    
    // Get automation count for last 24 hours  
    const { data: automationLogs, error: automationError } = await supabase
      .from('automation_executions')
      .select('count')
      .gt('executed_at', oneDayAgo.toISOString())
      .single();
    
    // Get error count for last 24 hours
    const { data: errorLogs, error: errorError } = await supabase
      .from('error_logs')
      .select('count')
      .gt('timestamp', oneDayAgo.toISOString())
      .single();
    
    // Calculate cache hit rate from Redis
    const cacheStats = await redis.hgetall('cache:stats:daily');
    const cacheHits = parseInt(cacheStats.hits || 0);
    const cacheMisses = parseInt(cacheStats.misses || 0);
    const cacheHitRate = cacheMisses + cacheHits > 0 
      ? cacheHits / (cacheHits + cacheMisses) 
      : 0;
    
    return {
      activeUsers: activeUsers?.length || 0,
      queryCount: queryLogs?.count || 0,
      automationCount: automationLogs?.count || 0,
      errorCount: errorLogs?.count || 0,
      cacheHitRate: cacheHitRate
    };
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      activeUsers: 0,
      queryCount: 0,
      automationCount: 0,
      errorCount: 0,
      cacheHitRate: 0
    };
  }
}

/**
 * Get user-related metrics
 */
async function getUserMetrics() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get new users in last 24 hours
    const { data: newUsers, error: newError } = await supabase
      .from('auth.users')
      .select('count')
      .gt('created_at', yesterday.toISOString())
      .single();
    
    // Get total user count
    const { data: totalUsers, error: totalError } = await supabase
      .from('auth.users')
      .select('count')
      .single();
    
    // Calculate retention rate (users active in last 30 days / total users older than 30 days)
    const { data: activeMonthUsers, error: activeMonthError } = await supabase
      .from('user_activity')
      .select('user_id')
      .gt('last_active', thirtyDaysAgo.toISOString())
      .limit(100000);
    
    const { data: olderUsers, error: olderError } = await supabase
      .from('auth.users')
      .select('count')
      .lt('created_at', thirtyDaysAgo.toISOString())
      .single();
    
    const retentionRate = olderUsers?.count > 0 
      ? activeMonthUsers?.length / olderUsers.count 
      : 0;
    
    return {
      newUsers: newUsers?.count || 0,
      totalUsers: totalUsers?.count || 0,
      retentionRate
    };
  } catch (error) {
    console.error('Error getting user metrics:', error);
    return {
      newUsers: 0,
      totalUsers: 0,
      retentionRate: 0
    };
  }
}

/**
 * Report provider metrics to CloudWatch
 * @param {Object} metrics - Provider metrics
 */
async function reportProviderMetrics(metrics) {
  const timestamp = new Date();
  
  for (const [provider, data] of Object.entries(metrics)) {
    const metricData = [
      {
        MetricName: 'InputTokens',
        Dimensions: [{ Name: 'Provider', Value: provider }],
        Unit: 'Count',
        Value: data.inputTokens,
        Timestamp: timestamp
      },
      {
        MetricName: 'OutputTokens',
        Dimensions: [{ Name: 'Provider', Value: provider }],
        Unit: 'Count',
        Value: data.outputTokens,
        Timestamp: timestamp
      },
      {
        MetricName: 'TotalTokens',
        Dimensions: [{ Name: 'Provider', Value: provider }],
        Unit: 'Count',
        Value: data.totalTokens,
        Timestamp: timestamp
      },
      {
        MetricName: 'TokenCost',
        Dimensions: [{ Name: 'Provider', Value: provider }],
        Unit: 'None',
        Value: data.totalCost,
        Timestamp: timestamp
      }
    ];
    
    await cloudwatch.putMetricData({
      Namespace: 'Conatus/LLM',
      MetricData: metricData
    }).promise();
  }
}

/**
 * Report system metrics to CloudWatch
 * @param {Object} metrics - System metrics
 */
async function reportSystemMetrics(metrics) {
  const timestamp = new Date();
  
  const metricData = [
    {
      MetricName: 'ActiveUsers',
      Unit: 'Count',
      Value: metrics.activeUsers,
      Timestamp: timestamp
    },
    {
      MetricName: 'QueryCount',
      Unit: 'Count',
      Value: metrics.queryCount,
      Timestamp: timestamp
    },
    {
      MetricName: 'AutomationCount',
      Unit: 'Count',
      Value: metrics.automationCount,
      Timestamp: timestamp
    },
    {
      MetricName: 'ErrorCount',
      Unit: 'Count',
      Value: metrics.errorCount,
      Timestamp: timestamp
    },
    {
      MetricName: 'CacheHitRate',
      Unit: 'Percent',
      Value: metrics.cacheHitRate * 100,
      Timestamp: timestamp
    }
  ];
  
  await cloudwatch.putMetricData({
    Namespace: 'Conatus/System',
    MetricData: metricData
  }).promise();
}

/**
 * Report user metrics to CloudWatch
 * @param {Object} metrics - User metrics
 */
async function reportUserMetrics(metrics) {
  const timestamp = new Date();
  
  const metricData = [
    {
      MetricName: 'NewUsers',
      Unit: 'Count',
      Value: metrics.newUsers,
      Timestamp: timestamp
    },
    {
      MetricName: 'TotalUsers',
      Unit: 'Count',
      Value: metrics.totalUsers,
      Timestamp: timestamp
    },
    {
      MetricName: 'RetentionRate',
      Unit: 'Percent',
      Value: metrics.retentionRate * 100,
      Timestamp: timestamp
    }
  ];
  
  await cloudwatch.putMetricData({
    Namespace: 'Conatus/Users',
    MetricData: metricData
  }).promise();
}

// Export the reporting function
module.exports = {
  reportMetrics
};

// monitoring/setup-alarms.js
/**
 * Script to set up CloudWatch alarms for monitoring
 */
const AWS = require('aws-sdk');

// Initialize CloudWatch client
const cloudwatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION || 'us-west-2'
});

/**
 * Set up all CloudWatch alarms
 */
async function setupAlarms() {
  try {
    // Set up cost alarms
    await setupCostAlarms();
    
    // Set up error alarms
    await setupErrorAlarms();
    
    // Set up performance alarms
    await setupPerformanceAlarms();
    
    console.log('Successfully set up CloudWatch alarms');
  } catch (error) {
    console.error('Error setting up CloudWatch alarms:', error);
  }
}

/**
 * Set up cost-related alarms
 */
async function setupCostAlarms() {
  // Daily cost alarm for each provider
  const providers = ['CLAUDE', 'PERPLEXITY', 'OPENAI', 'DEEPSEEK'];
  
  for (const provider of providers) {
    await cloudwatch.putMetricAlarm({
      AlarmName: `${provider}-DailyCost-High`,
      AlarmDescription: `Alert when ${provider} daily cost exceeds threshold`,
      MetricName: 'TokenCost',
      Namespace: 'Conatus/LLM',
      Dimensions: [{ Name: 'Provider', Value: provider }],
      Statistic: 'Sum',
      Period: 86400, // 24 hours
      EvaluationPeriods: 1,
      Threshold: provider === 'CLAUDE' ? 100 : 50, // Different thresholds for different providers
      ComparisonOperator: 'GreaterThanThreshold',
      TreatMissingData: 'notBreaching',
      ActionsEnabled: true,
      AlarmActions: [process.env.SNS_ALERT_TOPIC]
    }).promise();
  }
  
  // Total daily cost alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'TotalDailyCost-Critical',
    AlarmDescription: 'Alert when total daily cost across all providers exceeds critical threshold',
    MetricName: 'TokenCost',
    Namespace: 'Conatus/LLM',
    Statistic: 'Sum',
    Period: 86400, // 24 hours
    EvaluationPeriods: 1,
    Threshold: 300, // $300 per day is critical
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_CRITICAL_TOPIC]
  }).promise();
}

/**
 * Set up error-related alarms
 */
async function setupErrorAlarms() {
  // API error rate alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'APIErrorRate-High',
    AlarmDescription: 'Alert when API error rate exceeds threshold',
    MetricName: 'ErrorCount',
    Namespace: 'Conatus/System',
    Statistic: 'Sum',
    Period: 300, // 5 minutes
    EvaluationPeriods: 3,
    Threshold: 50, // 50 errors in 5 minutes for 3 consecutive periods
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_ALERT_TOPIC]
  }).promise();
  
  // Lambda function error alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'LambdaErrors-Critical',
    AlarmDescription: 'Alert when Lambda functions have too many errors',
    MetricName: 'Errors',
    Namespace: 'AWS/Lambda',
    Statistic: 'Sum',
    Period: 60, // 1 minute
    EvaluationPeriods: 5,
    Threshold: 10, // 10 errors per minute for 5 minutes
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_CRITICAL_TOPIC]
  }).promise();
  
  // Failed automation executions alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'FailedAutomations-High',
    AlarmDescription: 'Alert when too many automation executions fail',
    MetricName: 'FailedAutomations',
    Namespace: 'Conatus/Automations',
    Statistic: 'Sum',
    Period: 300, // 5 minutes
    EvaluationPeriods: 3,
    Threshold: 20, // 20 failed automations in 5 minutes for 3 periods
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_ALERT_TOPIC]
  }).promise();
}

/**
 * Set up performance-related alarms
 */
async function setupPerformanceAlarms() {
  // API latency alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'APILatency-High',
    AlarmDescription: 'Alert when API latency exceeds threshold',
    MetricName: 'Latency',
    Namespace: 'AWS/ApiGateway',
    Dimensions: [
      { Name: 'ApiName', Value: 'conatus-api' }
    ],
    Statistic: 'p95',
    Period: 300, // 5 minutes
    EvaluationPeriods: 3,
    Threshold: 1000, // 1000ms (1s) p95 latency
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_ALERT_TOPIC]
  }).promise();
  
  // Cache hit rate alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'CacheHitRate-Low',
    AlarmDescription: 'Alert when cache hit rate falls below threshold',
    MetricName: 'CacheHitRate',
    Namespace: 'Conatus/System',
    Statistic: 'Average',
    Period: 3600, // 1 hour
    EvaluationPeriods: 2,
    Threshold: 50, // 50% hit rate
    ComparisonOperator: 'LessThanThreshold',
    TreatMissingData: 'notBreaching',
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_ALERT_TOPIC]
  }).promise();
  
  // Redis CPU utilization alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'RedisCPU-High',
    AlarmDescription: 'Alert when Redis CPU utilization is high',
    MetricName: 'CPUUtilization',
    Namespace: 'AWS/ElastiCache',
    Dimensions: [
      { Name: 'CacheClusterId', Value: 'conatus-redis' }
    ],
    Statistic: 'Average',
    Period: 300, // 5 minutes
    EvaluationPeriods: 3,
    Threshold: 80, // 80% CPU utilization
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_ALERT_TOPIC]
  }).promise();
}

// Export the setup function
module.exports = {
  setupAlarms
};

// Backend monitoring middleware
// backend/middleware/monitoringMiddleware.js
/**
 * Middleware for monitoring API requests
 */
const { performance } = require('perf_hooks');
const Redis = require('ioredis');

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL);

/**
 * Middleware to monitor API requests
 */
function monitoringMiddleware(req, res, next) {
  // Skip monitoring for OPTIONS or healthcheck requests
  if (req.method === 'OPTIONS' || req.path === '/health') {
    return next();
  }
  
  // Start timing
  const startTime = performance.now();
  
  // Generate request ID if not already present
  req.requestId = req.headers['x-request-id'] || 
                  req.requestId || 
                  generateRequestId();
  
  // Add the request ID to the response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  // Capture original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics
  res.end = function(...args) {
    // Calculate elapsed time
    const elapsedMs = performance.now() - startTime;
    
    // Get status code group (2XX, 4XX, 5XX)
    const statusGroup = Math.floor(res.statusCode / 100) + 'XX';
    
    // Record metrics
    recordMetrics({
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      statusGroup,
      elapsedMs,
      requestId: req.requestId,
      userId: req.user?.id || 'anonymous'
    });
    
    // Call original end method
    return originalEnd.apply(res, args);
  };
  
  next();
}

/**
 * Generate a unique request ID
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomStr}`;
}

/**
 * Record metrics for the request
 * @param {Object} data Request metrics data
 */
async function recordMetrics(data) {
  try {
    // Get current minute timestamp for bucketing
    const minuteTimestamp = Math.floor(Date.now() / 60000) * 60000;
    
    // Create metric keys
    const pathKey = `metrics:path:${data.path}:${minuteTimestamp}`;
    const statusKey = `metrics:status:${data.statusGroup}:${minuteTimestamp}`;
    const userKey = `metrics:user:${data.userId}:${minuteTimestamp}`;
    
    // Increment request counts
    await redis.hincrby(pathKey, 'count', 1);
    await redis.hincrby(statusKey, 'count', 1);
    await redis.hincrby(userKey, 'count', 1);
    
    // Track response time
    await redis.hincrbyfloat(pathKey, 'totalTime', data.elapsedMs);
    
    // Track status-specific counts
    await redis.hincrby(statusKey, data.statusCode.toString(), 1);
    
    // Set expiry on metrics (24 hours)
    await redis.expire(pathKey, 86400);
    await redis.expire(statusKey, 86400);
    await redis.expire(userKey, 86400);
    
    // For high latency requests, record detailed info for analysis
    if (data.elapsedMs > 1000) { // 1 second
      const slowKey = `metrics:slow:${data.requestId}`;
      
      await redis.hmset(slowKey, {
        path: data.path,
        method: data.method,
        status: data.statusCode,
        time: data.elapsedMs,
        timestamp: Date.now(),
        userId: data.userId
      });
      
      // Keep slow request data for 7 days
      await redis.expire(slowKey, 604800);
    }
    
    // If error (4XX/5XX), record more details
    if (data.statusCode >= 400) {
      const errorKey = `metrics:error:${data.requestId}`;
      
      await redis.hmset(errorKey, {
        path: data.path,
        method: data.method,
        status: data.statusCode,
        time: data.elapsedMs,
        timestamp: Date.now(),
        userId: data.userId
      });
      
      // Keep error data for 7 days
      await redis.expire(errorKey, 604800);
    }
  } catch (error) {
    console.error('Error recording metrics:', error);
  }
}

module.exports = monitoringMiddleware;
