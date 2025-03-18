// backend/services/automation/AutomationExecutionService.js
/**
 * Automation Execution Service
 * 
 * Executes automation requests by interacting with the appropriate
 * service connectors and handling the results.
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const OAuthService = require('../oauth/OAuthService');
const AutomationDetectionService = require('./AutomationDetectionService');

// Import service connectors
const WhatsAppConnector = require('../connectors/WhatsAppConnector');
const GmailConnector = require('../connectors/GmailConnector');
const UberConnector = require('../connectors/UberConnector');
const DoorDashConnector = require('../connectors/DoorDashConnector');
const GoogleCalendarConnector = require('../connectors/GoogleCalendarConnector');
const SpotifyConnector = require('../connectors/SpotifyConnector');
const VenmoConnector = require('../connectors/VenmoConnector');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

class AutomationExecutionService {
  constructor() {
    // Map of service connectors
    this.connectors = {
      'whatsapp': WhatsAppConnector,
      'gmail': GmailConnector,
      'uber': UberConnector,
      'doordash': DoorDashConnector,
      'google_calendar': GoogleCalendarConnector,
      'spotify': SpotifyConnector,
      'venmo': VenmoConnector
    };
  }

  /**
   * Execute an automation
   * @param {Object} automation - Automation details
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Execution result
   */
  async executeAutomation(automation, userId) {
    try {
      const { type, service, params } = automation;
      
      // Generate unique execution ID
      const executionId = uuidv4();
      
      // Log the start of execution
      console.log(`Starting automation execution:`, {
        executionId,
        type,
        service,
        userId
      });
      
      // Record execution start in database
      await this.recordExecution(executionId, userId, automation, 'pending');
      
      // Validate automation parameters
      const validation = AutomationDetectionService.validateAutomation(automation);
      if (!validation.valid) {
        throw new Error(`Invalid automation parameters: ${validation.errors.join(', ')}`);
      }
      
      // Check required services
      const hasServices = await AutomationDetectionService.checkRequiredServices(
        userId,
        automation.requiredServices || [service]
      );
      
      if (!hasServices) {
        throw new Error(`Required service ${service} not connected`);
      }
      
      // Get access token for the service
      const accessToken = await OAuthService.getAccessToken(userId, service);
      
      // Get the connector for this service
      const connector = this.connectors[service];
      if (!connector) {
        throw new Error(`No connector available for service: ${service}`);
      }
      
      // Execute the appropriate action based on type
      let result;
      
      switch (type) {
        case 'message_schedule':
          if (service === 'whatsapp') {
            result = await connector.sendMessage(accessToken, params.recipient, params.content, params.time);
          } else if (service === 'gmail') {
            result = await connector.sendEmail(accessToken, params.recipient, params.subject, params.content, params.time);
          }
          break;
        case 'ride_request':
          result = await connector.bookRide(accessToken, params.pickup, params.destination, params.time);
          break;
        case 'food_order':
          result = await connector.orderFood(accessToken, params.restaurant, params.items, params.time);
          break;
        case 'calendar_event':
          result = await connector.createEvent(accessToken, params.title, params.time, params.duration);
          break;
        case 'music_control':
          result = await connector.playMusic(accessToken, params.track, params.artist);
          break;
        case 'payment':
          result = await connector.sendPayment(accessToken, params.recipient, params.amount, params.description);
          break;
        default:
          throw new Error(`Unsupported automation type: ${type}`);
      }
      
      // Record successful execution
      await this.recordExecution(executionId, userId, automation, 'success', result);
      
      // Return the execution result
      return {
        executionId,
        ...result,
        success: true,
        confirmationMessage: automation.confirmationMessage || `Successfully executed ${type} automation`
      };
    } catch (error) {
      console.error('Error executing automation:', error);
      
      // Record failed execution
      if (automation) {
        await this.recordExecution(
          uuidv4(), 
          userId, 
          automation, 
          'failed', 
          null, 
          error.message
        );
      }
      
      throw error;
    }
  }

  /**
   * Execute a configured automation from the Library
   * @param {string} automationId - Saved automation ID
   * @param {Object} triggerData - Data that triggered the automation
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Execution result
   */
  async executeConfiguredAutomation(automationId, triggerData, userId) {
    try {
      // Fetch the automation configuration
      const { data: automation, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .eq('user_id', userId)
        .single();
      
      if (error || !automation) {
        throw new Error(`Automation not found: ${automationId}`);
      }
      
      // Check if automation is enabled
      if (!automation.enabled) {
        throw new Error(`Automation is disabled: ${automationId}`);
      }
      
      // Parse workflow JSON
      const workflow = automation.workflow;
      
      // Prepare execution parameters
      const executionParams = {
        type: workflow.action.type,
        service: workflow.action.service,
        params: this.mergeParams(workflow.action.params, triggerData),
        requiredServices: [workflow.action.service],
        confirmationMessage: `Executed automation: ${automation.name}`
      };
      
      // Execute the automation
      const result = await this.executeAutomation(executionParams, userId);
      
      // Update execution count
      await supabase
        .from('automations')
        .update({
          execution_count: automation.execution_count + 1,
          last_executed_at: new Date().toISOString()
        })
        .eq('id', automationId);
      
      return {
        ...result,
        automationId,
        automationName: automation.name
      };
    } catch (error) {
      console.error('Error executing configured automation:', error);
      throw error;
    }
  }

  /**
   * Merge static parameters with trigger data
   * @param {Object} staticParams - Static parameters from workflow
   * @param {Object} triggerData - Data from the trigger
   * @returns {Object} - Merged parameters
   */
  mergeParams(staticParams, triggerData) {
    const params = { ...staticParams };
    
    // Replace variables in parameter values
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // Extract variable name
        const varName = value.slice(2, -2).trim();
        
        // Replace with trigger data if available
        if (triggerData && triggerData[varName] !== undefined) {
          params[key] = triggerData[varName];
        }
      }
    }
    
    return params;
  }

  /**
   * Record automation execution in the database
   * @param {string} executionId - Unique execution ID
   * @param {string} userId - User ID
   * @param {Object} automation - Automation details
   * @param {string} status - Execution status
   * @param {Object} result - Execution result
   * @param {string} errorMessage - Error message if any
   * @returns {Promise<void>}
   */
  async recordExecution(executionId, userId, automation, status, result = null, errorMessage = null) {
    try {
      await supabase
        .from('automation_executions')
        .insert({
          id: executionId,
          user_id: userId,
          automation_id: automation.id, // May be null for instant automations
          automation_type: automation.type,
          service: automation.service,
          parameters: automation.params,
          status,
          result: result || null,
          error_message: errorMessage,
          executed_at: new Date().toISOString()
        });
    } catch (dbError) {
      // Log but don't fail if recording fails
      console.error('Error recording automation execution:', dbError);
    }
  }

  /**
   * Get automation execution history
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Execution history
   */
  async getExecutionHistory(userId, filters = {}) {
    try {
      let query = supabase
        .from('automation_executions')
        .select('*')
        .eq('user_id', userId)
        .order('executed_at', { ascending: false });
      
      // Apply filters if provided
      if (filters.automationId) {
        query = query.eq('automation_id', filters.automationId);
      }
      
      if (filters.type) {
        query = query.eq('automation_type', filters.type);
      }
      
      if (filters.service) {
        query = query.eq('service', filters.service);
      }
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching execution history:', error);
      throw error;
    }
  }
}

module.exports = new AutomationExecutionService();
