// backend/workers/scheduledTasksWorker.js
/**
 * Scheduled Tasks Worker
 * 
 * Background worker that processes scheduled messages and automations.
 * This worker is designed to run as a separate process from the main API server.
 */

const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import service connectors
const WhatsAppConnector = require('../services/connectors/WhatsAppConnector');
const GmailConnector = require('../services/connectors/GmailConnector');
const UberConnector = require('../services/connectors/UberConnector');
const SpotifyConnector = require('../services/connectors/SpotifyConnector');
const GoogleCalendarConnector = require('../services/connectors/GoogleCalendarConnector');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

// Service connector mapping
const serviceConnectors = {
  'whatsapp': WhatsAppConnector,
  'gmail': GmailConnector,
  'uber': UberConnector,
  'spotify': SpotifyConnector,
  'google_calendar': GoogleCalendarConnector
};

// Configuration
const config = {
  processInterval: 10000, // 10 seconds
  batchSize: 10, // Process 10 tasks at a time
  maxRetries: 3, // Max retries for failed tasks
  retryDelay: 60000, // 1 minute delay between retries
  logLevel: process.env.LOG_LEVEL || 'info' // Log level
};

// Logging utility
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const log = (level, message, data = {}) => {
  if (logLevels[level] <= logLevels[config.logLevel]) {
    console[level](`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, data);
  }
};

/**
 * Main worker process
 */
class ScheduledTasksWorker {
  constructor() {
    this.running = false;
    this.lastRunTime = null;
    this.processInterval = null;
  }

  /**
   * Start the worker
   */
  async start() {
    try {
      log('info', 'Starting Scheduled Tasks Worker...');
      
      if (this.running) {
        log('warn', 'Worker already running');
        return;
      }
      
      this.running = true;
      
      // Test database connection
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        throw new Error(`Supabase connection error: ${error.message}`);
      }
      
      // Test Redis connection
      const redisStatus = await redis.ping();
      
      if (redisStatus !== 'PONG') {
        throw new Error('Redis connection error');
      }
      
      log('info', 'Database and Redis connections verified');
      
      // Start processing interval
      this.processInterval = setInterval(() => {
        this.processScheduledTasks()
          .catch(err => log('error', 'Error processing scheduled tasks', err));
      }, config.processInterval);
      
      // Initial process
      await this.processScheduledTasks();
      
      log('info', 'Worker started successfully');
    } catch (error) {
      log('error', 'Failed to start worker', error);
      this.running = false;
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  stop() {
    log('info', 'Stopping worker...');
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    
    this.running = false;
    log('info', 'Worker stopped');
  }

  /**
   * Process scheduled tasks
   */
  async processScheduledTasks() {
    try {
      this.lastRunTime = new Date();
      log('debug', 'Processing scheduled tasks...');
      
      // Process scheduled messages from Redis
      await this.processScheduledMessages();
      
      // Process scheduled automations from database
      await this.processScheduledAutomations();
      
      log('debug', 'Finished processing scheduled tasks');
    } catch (error) {
      log('error', 'Error in processScheduledTasks', error);
    }
  }

  /**
   * Process scheduled messages from Redis
   */
  async processScheduledMessages() {
    try {
      // Get current timestamp
      const now = Date.now();
      
      // Get messages due for execution
      const messageIds = await redis.zrangebyscore('scheduled_messages', 0, now);
      
      log('debug', `Found ${messageIds.length} scheduled messages due for execution`);
      
      if (messageIds.length === 0) {
        return;
      }
      
      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < messageIds.length; i += config.batchSize) {
        const batch = messageIds.slice(i, i + config.batchSize);
        
        // Process each message in the batch
        await Promise.all(batch.map(id => this.executeScheduledMessage(id)));
      }
    } catch (error) {
      log('error', 'Error processing scheduled messages', error);
    }
  }

  /**
   * Execute a scheduled message
   * @param {string} messageId - ID of scheduled message
   */
  async executeScheduledMessage(messageId) {
    try {
      log('debug', `Executing scheduled message: ${messageId}`);
      
      // Get message details from database
      const { data: message, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (error || !message) {
        log('error', `Message not found: ${messageId}`, error);
        // Remove from Redis set regardless
        await redis.zrem('scheduled_messages', messageId);
        return;
      }
      
      // Update status to processing
      await supabase
        .from('scheduled_messages')
        .update({ status: 'processing' })
        .eq('id', messageId);
      
      // Execute based on service type
      let result;
      
      try {
        const connector = serviceConnectors[message.service];
        
        if (!connector) {
          throw new Error(`Unknown service: ${message.service}`);
        }
        
        // Execute message
        switch (message.service) {
          case 'whatsapp':
            result = await connector.sendMessage(
              message.access_token,
              message.recipient,
              message.content
            );
            break;
          case 'gmail':
            result = await connector.sendEmail(
              message.access_token,
              message.recipient,
              message.subject || 'Scheduled Email',
              message.content
            );
            break;
          default:
            throw new Error(`Unsupported service for messaging: ${message.service}`);
        }
        
        // Update status to sent
        await supabase
          .from('scheduled_messages')
          .update({
            status: 'sent',
            executed_at: new Date().toISOString(),
            result: result
          })
          .eq('id', messageId);
        
        // Remove from Redis
        await redis.zrem('scheduled_messages', messageId);
        
        log('info', `Successfully executed scheduled message: ${messageId}`, result);
      } catch (error) {
        log('error', `Error executing scheduled message: ${messageId}`, error);
        
        // Increment retry count
        const retryCount = (message.retry_count || 0) + 1;
        
        if (retryCount <= config.maxRetries) {
          // Retry later
          const retryTime = Date.now() + config.retryDelay;
          
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'retry',
              retry_count: retryCount,
              error: error.message
            })
            .eq('id', messageId);
          
          // Update Redis scheduled time
          await redis.zadd('scheduled_messages', retryTime, messageId);
          
          log('warn', `Scheduled retry ${retryCount} for message: ${messageId}`);
        } else {
          // Max retries reached - mark as failed
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error: error.message
            })
            .eq('id', messageId);
          
          // Remove from Redis
          await redis.zrem('scheduled_messages', messageId);
          
          log('error', `Max retries reached for message: ${messageId}`);
        }
      }
    } catch (error) {
      log('error', `Error processing message: ${messageId}`, error);
      
      // Ensure we remove from Redis to prevent endless retries
      await redis.zrem('scheduled_messages', messageId);
    }
  }

  /**
   * Process scheduled automations from database
   */
  async processScheduledAutomations() {
    try {
      // Get current date/time
      const now = new Date();
      
      // Get automations due for execution
      const { data: automations, error } = await supabase
        .from('automation_schedules')
        .select('id, automation_id, scheduled_at, trigger_data')
        .eq('status', 'scheduled')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(config.batchSize);
      
      if (error) {
        throw error;
      }
      
      log('debug', `Found ${automations.length} scheduled automations due for execution`);
      
      if (automations.length === 0) {
        return;
      }
      
      // Process each automation
      for (const schedule of automations) {
        await this.executeScheduledAutomation(schedule);
      }
    } catch (error) {
      log('error', 'Error processing scheduled automations', error);
    }
  }

  /**
   * Execute a scheduled automation
   * @param {Object} schedule - Schedule object
   */
  async executeScheduledAutomation(schedule) {
    try {
      log('debug', `Executing scheduled automation: ${schedule.id}`);
      
      // Update status to processing
      await supabase
        .from('automation_schedules')
        .update({ status: 'processing' })
        .eq('id', schedule.id);
      
      // Get automation details
      const { data: automation, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', schedule.automation_id)
        .single();
      
      if (error || !automation) {
        throw new Error(`Automation not found: ${schedule.automation_id}`);
      }
      
      // Check if automation is enabled
      if (!automation.enabled) {
        log('warn', `Skipping disabled automation: ${automation.id}`);
        
        // Update schedule status to skipped
        await supabase
          .from('automation_schedules')
          .update({
            status: 'skipped',
            executed_at: new Date().toISOString(),
            error: 'Automation is disabled'
          })
          .eq('id', schedule.id);
        
        return;
      }
      
      // Prepare execution parameters
      const executionId = uuidv4();
      const workflow = automation.workflow;
      
      // Merge trigger data with action parameters
      const actionParams = {
        ...workflow.action.params,
        ...schedule.trigger_data
      };
      
      // Get service connector
      const connector = serviceConnectors[workflow.action.service];
      
      if (!connector) {
        throw new Error(`Unknown service: ${workflow.action.service}`);
      }
      
      // Execute action based on type
      let result;
      
      switch (workflow.action.type) {
        case 'message_schedule':
          if (workflow.action.service === 'whatsapp') {
            result = await connector.sendMessage(
              actionParams.access_token,
              actionParams.recipient,
              actionParams.content
            );
          } else if (workflow.action.service === 'gmail') {
            result = await connector.sendEmail(
              actionParams.access_token,
              actionParams.recipient,
              actionParams.subject || automation.name,
              actionParams.content
            );
          }
          break;
        case 'ride_request':
          result = await connector.bookRide(
            actionParams.access_token,
            actionParams.pickup,
            actionParams.destination
          );
          break;
        case 'calendar_event':
          result = await connector.createEvent(
            actionParams.access_token,
            actionParams.title,
            actionParams.startTime,
            actionParams.duration
          );
          break;
        case 'music_control':
          result = await connector.playMusic(
            actionParams.access_token,
            actionParams.track,
            actionParams.artist
          );
          break;
        default:
          throw new Error(`Unsupported action type: ${workflow.action.type}`);
      }
      
      // Update execution status
      await supabase
        .from('automation_executions')
        .insert({
          id: executionId,
          automation_id: automation.id,
          user_id: automation.user_id,
          automation_type: workflow.action.type,
          service: workflow.action.service,
          parameters: actionParams,
          status: 'success',
          result: result,
          executed_at: new Date().toISOString()
        });
      
      // Update automation last executed timestamp
      await supabase
        .from('automations')
        .update({
          execution_count: automation.execution_count + 1,
          last_executed_at: new Date().toISOString()
        })
        .eq('id', automation.id);
      
      // Update schedule status
      await supabase
        .from('automation_schedules')
        .update({
          status: 'completed',
          executed_at: new Date().toISOString(),
          execution_id: executionId
        })
        .eq('id', schedule.id);
      
      log('info', `Successfully executed scheduled automation: ${schedule.id}`);
    } catch (error) {
      log('error', `Error executing scheduled automation: ${schedule.id}`, error);
      
      // Update schedule status to failed
      await supabase
        .from('automation_schedules')
        .update({
          status: 'failed',
          error: error.message,
          executed_at: new Date().toISOString()
        })
        .eq('id', schedule.id);
      
      // Record failure in executions table
      await supabase
        .from('automation_executions')
        .insert({
          id: uuidv4(),
          automation_id: schedule.automation_id,
          automation_type: 'scheduled',
          status: 'failed',
          error_message: error.message,
          executed_at: new Date().toISOString()
        });
    }
  }

  /**
   * Check for recurring automations and schedule them
   */
  async scheduleRecurringAutomations() {
    try {
      log('debug', 'Checking for recurring automations...');
      
      // Get all enabled recurring automations
      const { data: automations, error } = await supabase
        .from('automations')
        .select('*')
        .eq('enabled', true)
        .filter('workflow->trigger->type', 'eq', 'recurring');
      
      if (error) {
        throw error;
      }
      
      log('debug', `Found ${automations.length} recurring automations`);
      
      // Check each automation
      for (const automation of automations) {
        await this.checkAndScheduleRecurring(automation);
      }
    } catch (error) {
      log('error', 'Error scheduling recurring automations', error);
    }
  }

  /**
   * Check if a recurring automation needs to be scheduled
   * @param {Object} automation - Automation object
   */
  async checkAndScheduleRecurring(automation) {
    try {
      const workflow = automation.workflow;
      const triggerConfig = workflow.trigger.config;
      
      // Check if we need to schedule this automation
      if (!triggerConfig.schedule || !triggerConfig.time) {
        return;
      }
      
      // Calculate next execution time
      const nextExecutionTime = this.calculateNextExecutionTime(triggerConfig);
      
      if (!nextExecutionTime) {
        return;
      }
      
      // Check if already scheduled
      const { data: existing, error } = await supabase
        .from('automation_schedules')
        .select('id')
        .eq('automation_id', automation.id)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      // If already scheduled, skip
      if (existing && existing.length > 0) {
        return;
      }
      
      // Schedule next execution
      await supabase
        .from('automation_schedules')
        .insert({
          id: uuidv4(),
          automation_id: automation.id,
          scheduled_at: nextExecutionTime.toISOString(),
          trigger_data: {},
          status: 'scheduled',
          created_at: new Date().toISOString()
        });
      
      log('info', `Scheduled recurring automation: ${automation.id} for ${nextExecutionTime.toISOString()}`);
    } catch (error) {
      log('error', `Error checking recurring automation: ${automation.id}`, error);
    }
  }

  /**
   * Calculate the next execution time for a recurring automation
   * @param {Object} triggerConfig - Trigger configuration
   * @returns {Date|null} Next execution time or null
   */
  calculateNextExecutionTime(triggerConfig) {
    try {
      const now = new Date();
      const [hours, minutes] = triggerConfig.time.split(':').map(Number);
      
      let nextExecution = new Date(now);
      nextExecution.setHours(hours, minutes, 0, 0);
      
      // If time today is already past, move to next occurrence
      if (nextExecution <= now) {
        nextExecution.setDate(nextExecution.getDate() + 1);
      }
      
      // Adjust based on schedule type
      switch (triggerConfig.schedule) {
        case 'daily':
          // Already set for tomorrow if needed
          break;
          
        case 'weekdays':
          // Skip to Monday if it's Friday and time has passed
          if (nextExecution.getDay() === 5 && nextExecution <= now) {
            nextExecution.setDate(nextExecution.getDate() + 3);
          }
          // Skip weekend days
          else if (nextExecution.getDay() === 0) { // Sunday
            nextExecution.setDate(nextExecution.getDate() + 1);
          }
          else if (nextExecution.getDay() === 6) { // Saturday
            nextExecution.setDate(nextExecution.getDate() + 2);
          }
          break;
          
        case 'weekends':
          // If not a weekend, move to Saturday
          if (nextExecution.getDay() < 6) {
            const daysToAdd = 6 - nextExecution.getDay();
            nextExecution.setDate(nextExecution.getDate() + daysToAdd);
          }
          break;
          
        case 'weekly':
          // Move to specified day of week
          const targetDay = triggerConfig.day;
          const dayMapping = {
            'monday': 1, 'tuesday': 2, 'wednesday': 3, 
            'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0
          };
          
          if (targetDay && dayMapping[targetDay] !== undefined) {
            const currentDay = nextExecution.getDay();
            const targetDayNum = dayMapping[targetDay];
            
            let daysToAdd = targetDayNum - currentDay;
            if (daysToAdd <= 0) {
              daysToAdd += 7;
            }
            
            nextExecution.setDate(nextExecution.getDate() + daysToAdd);
          }
          break;
          
        case 'monthly':
          // Move to specified day of month
          const targetDate = parseInt(triggerConfig.date);
          
          if (!isNaN(targetDate) && targetDate >= 1 && targetDate <= 31) {
            nextExecution.setDate(targetDate);
            
            // If date this month is already past, move to next month
            if (nextExecution <= now) {
              nextExecution.setMonth(nextExecution.getMonth() + 1);
            }
            
            // Check if date exists in the target month (e.g., Feb 30)
            const originalMonth = nextExecution.getMonth();
            nextExecution.setDate(targetDate);
            
            // If month changed, it means the date doesn't exist in this month
            if (nextExecution.getMonth() !== originalMonth) {
              // Set to last day of intended month
              nextExecution = new Date(nextExecution.getFullYear(), originalMonth + 1, 0);
              nextExecution.setHours(hours, minutes, 0, 0);
            }
          }
          break;
          
        default:
          log('warn', `Unknown schedule type: ${triggerConfig.schedule}`);
          return null;
      }
      
      return nextExecution;
    } catch (error) {
      log('error', 'Error calculating next execution time', error);
      return null;
    }
  }
}

// Create and start worker
const worker = new ScheduledTasksWorker();

// Handle process events
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM signal');
  worker.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT signal');
  worker.stop();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', err);
  worker.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection', { reason, promise });
});

// Start the worker
worker.start()
  .then(() => {
    // Initially schedule recurring automations
    worker.scheduleRecurringAutomations()
      .catch(err => log('error', 'Error scheduling recurring automations', err));
    
    // Schedule recurring automations every hour
    setInterval(() => {
      worker.scheduleRecurringAutomations()
        .catch(err => log('error', 'Error scheduling recurring automations', err));
    }, 3600000); // 1 hour
  })
  .catch(err => {
    log('error', 'Failed to start worker', err);
    process.exit(1);
  });

module.exports = worker; // Export for testing
