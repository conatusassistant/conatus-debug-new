// backend/services/connectors/WhatsAppConnector.js
/**
 * WhatsApp Connector
 * 
 * Handles interaction with WhatsApp Business API for sending messages
 * and managing WhatsApp-related automations.
 */

const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const MonitoringService = require('../MonitoringService');

class WhatsAppConnector {
  constructor() {
    // Base URL for WhatsApp Business API
    this.baseUrl = 'https://graph.facebook.com/v17.0';
    
    // Cache for phone number validation
    this.phoneNumberCache = new Map();
  }

  /**
   * Send a WhatsApp message
   * @param {string} accessToken - Access token for WhatsApp Business API
   * @param {string} recipient - Recipient phone number or contact name
   * @param {string} content - Message content
   * @param {string|Date} scheduledTime - Optional scheduled time (null for immediate)
   * @returns {Promise<Object>} - Send result
   */
  async sendMessage(accessToken, recipient, content, scheduledTime = null) {
    try {
      const trace = MonitoringService.createTrace('WhatsApp.sendMessage');
      trace.startSpan('prepare');
      
      // Validate inputs
      if (!accessToken) {
        throw new Error('Access token is required');
      }
      
      if (!recipient) {
        throw new Error('Recipient is required');
      }
      
      if (!content || content.trim() === '') {
        throw new Error('Message content is required');
      }
      
      // Get recipient phone number (if name was provided, resolve it)
      const phoneNumber = await this.resolvePhoneNumber(accessToken, recipient);
      
      // Format phone number according to WhatsApp requirements
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Check if message should be scheduled
      if (scheduledTime && scheduledTime !== 'now') {
        trace.startSpan('schedule');
        // Handle scheduling logic through our scheduling system
        const scheduled = await this.scheduleMessage(
          accessToken,
          formattedPhone,
          content,
          scheduledTime
        );
        trace.endSpan();
        trace.end();
        return scheduled;
      }
      
      trace.startSpan('send');
      
      // Get business account ID (cached)
      const businessAccountId = await this.getBusinessAccountId(accessToken);
      
      // Prepare the message request
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: {
          body: content
        }
      };
      
      // Send the message
      const response = await fetch(`${this.baseUrl}/${businessAccountId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      
      // Track success metric
      MonitoringService.trackAutomationExecution(
        'whatsapp_message',
        true,
        Date.now() - trace.startTime
      );
      
      trace.endSpan();
      trace.end();
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        recipient: formattedPhone,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Track failure metric
      MonitoringService.trackAutomationExecution('whatsapp_message', false);
      
      // Log error
      MonitoringService.error('Error sending WhatsApp message', error, {
        recipient,
        contentPreview: content?.substring(0, 50)
      });
      
      throw error;
    }
  }

  /**
   * Schedule a WhatsApp message for future delivery
   * @param {string} accessToken - Access token for WhatsApp API
   * @param {string} recipient - Formatted recipient phone number
   * @param {string} content - Message content
   * @param {string|Date} scheduledTime - When to send the message
   * @returns {Promise<Object>} - Scheduling result
   */
  async scheduleMessage(accessToken, recipient, content, scheduledTime) {
    try {
      // Determine when to send the message
      const sendTime = this.parseScheduledTime(scheduledTime);
      
      // Store in our scheduling system
      const messageId = uuidv4();
      
      // Store in database for the scheduler worker to pick up
      // This uses our internal scheduling system, not WhatsApp's
      const scheduledMessage = {
        id: messageId,
        service: 'whatsapp',
        recipient: recipient,
        content: content,
        scheduled_at: sendTime.toISOString(),
        access_token: accessToken, // This should be encrypted in production
        status: 'scheduled',
        created_at: new Date().toISOString()
      };
      
      // Store in database (simulated)
      console.log('Scheduling WhatsApp message:', {
        ...scheduledMessage,
        access_token: '[REDACTED]' // Don't log the token
      });
      
      // In a real implementation, we would store this in a database:
      // await database.from('scheduled_messages').insert(scheduledMessage);
      
      // And add to Redis sorted set for the worker to pick up:
      // await redis.zadd('scheduled_messages', sendTime.getTime(), messageId);
      
      return {
        success: true,
        scheduled: true,
        messageId: messageId,
        scheduledFor: sendTime.toISOString(),
        recipient: recipient
      };
    } catch (error) {
      MonitoringService.error('Error scheduling WhatsApp message', error);
      throw error;
    }
  }

  /**
   * Format a phone number for WhatsApp API
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Strip all non-digit characters
    let digits = phoneNumber.replace(/\D/g, '');
    
    // Ensure phone number has country code
    if (digits.length === 10) {
      // Assume US number if 10 digits
      digits = '1' + digits;
    }
    
    return digits;
  }

  /**
   * Resolve a recipient name to a phone number
   * @param {string} accessToken - Access token
   * @param {string} recipient - Recipient name or phone number
   * @returns {Promise<string>} - Phone number
   */
  async resolvePhoneNumber(accessToken, recipient) {
    // If recipient is already a phone number, return it
    if (/^[+\d\s\-()]+$/.test(recipient)) {
      return recipient;
    }
    
    // In a real implementation, we would look up the contact in the user's
    // address book or contacts database. This is a simplified version.
    
    // For now, just throw an error
    throw new Error(`Contact resolution not implemented. Please provide a phone number instead of "${recipient}"`);
  }

  /**
   * Get Business Account ID for the access token
   * @param {string} accessToken - Access token
   * @returns {Promise<string>} - Business Account ID
   */
  async getBusinessAccountId(accessToken) {
    // In a real implementation, we would call the WhatsApp Business Management API
    // to get the Business Account ID associated with the token.
    
    // For now, return a placeholder
    return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '123456789';
  }

  /**
   * Parse a scheduled time string into a Date object
   * @param {string|Date} scheduledTime - Time specification
   * @returns {Date} - Parsed date
   */
  parseScheduledTime(scheduledTime) {
    if (scheduledTime instanceof Date) {
      return scheduledTime;
    }
    
    const now = new Date();
    
    // Handle relative time specifications
    if (typeof scheduledTime === 'string') {
      scheduledTime = scheduledTime.toLowerCase();
      
      // Handle "now"
      if (scheduledTime === 'now') {
        return now;
      }
      
      // Handle "tomorrow at X"
      const tomorrowMatch = scheduledTime.match(/tomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (tomorrowMatch) {
        const hours = parseInt(tomorrowMatch[1]);
        const minutes = tomorrowMatch[2] ? parseInt(tomorrowMatch[2]) : 0;
        const isPm = tomorrowMatch[3]?.toLowerCase() === 'pm';
        
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(isPm && hours < 12 ? hours + 12 : hours);
        tomorrow.setMinutes(minutes);
        tomorrow.setSeconds(0);
        tomorrow.setMilliseconds(0);
        
        return tomorrow;
      }
      
      // Handle "in X minutes/hours"
      const inTimeMatch = scheduledTime.match(/in\s+(\d+)\s+(minute|hour|day)s?/i);
      if (inTimeMatch) {
        const amount = parseInt(inTimeMatch[1]);
        const unit = inTimeMatch[2].toLowerCase();
        
        const futureTime = new Date(now);
        if (unit === 'minute') {
          futureTime.setMinutes(futureTime.getMinutes() + amount);
        } else if (unit === 'hour') {
          futureTime.setHours(futureTime.getHours() + amount);
        } else if (unit === 'day') {
          futureTime.setDate(futureTime.getDate() + amount);
        }
        
        return futureTime;
      }
      
      // Handle "at HH:MM" today
      const atTimeMatch = scheduledTime.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (atTimeMatch) {
        const hours = parseInt(atTimeMatch[1]);
        const minutes = atTimeMatch[2] ? parseInt(atTimeMatch[2]) : 0;
        const isPm = atTimeMatch[3]?.toLowerCase() === 'pm';
        
        const todayAt = new Date(now);
        todayAt.setHours(isPm && hours < 12 ? hours + 12 : hours);
        todayAt.setMinutes(minutes);
        todayAt.setSeconds(0);
        todayAt.setMilliseconds(0);
        
        // If the time has already passed today, schedule for tomorrow
        if (todayAt < now) {
          todayAt.setDate(todayAt.getDate() + 1);
        }
        
        return todayAt;
      }
      
      // Try to parse as ISO date string
      const isoDate = new Date(scheduledTime);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
    }
    
    // Default: schedule for now
    return now;
  }

  /**
   * Get WhatsApp templates available for the business
   * @param {string} accessToken - Access token
   * @returns {Promise<Array>} - Available templates
   */
  async getTemplates(accessToken) {
    try {
      // Get business account ID
      const businessAccountId = await this.getBusinessAccountId(accessToken);
      
      // Fetch templates
      const response = await fetch(`${this.baseUrl}/${businessAccountId}/message_templates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      MonitoringService.error('Error fetching WhatsApp templates', error);
      throw error;
    }
  }

  /**
   * Send a template message
   * @param {string} accessToken - Access token
   * @param {string} recipient - Recipient phone number
   * @param {string} templateName - Template name
   * @param {Object} templateParams - Template parameters
   * @returns {Promise<Object>} - Send result
   */
  async sendTemplateMessage(accessToken, recipient, templateName, templateParams = {}) {
    try {
      // Validate inputs
      if (!accessToken) {
        throw new Error('Access token is required');
      }
      
      if (!recipient) {
        throw new Error('Recipient is required');
      }
      
      if (!templateName) {
        throw new Error('Template name is required');
      }
      
      // Format phone number
      const formattedPhone = this.formatPhoneNumber(recipient);
      
      // Get business account ID
      const businessAccountId = await this.getBusinessAccountId(accessToken);
      
      // Format template components based on parameters
      const components = [];
      
      // Add body parameters if any
      if (Object.keys(templateParams).length > 0) {
        const parameters = Object.entries(templateParams).map(([_key, value]) => ({
          type: 'text',
          text: value
        }));
        
        components.push({
          type: 'body',
          parameters
        });
      }
      
      // Prepare the message request
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en_US' // Default language
          },
          components
        }
      };
      
      // Send the message
      const response = await fetch(`${this.baseUrl}/${businessAccountId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      
      // Track success metric
      MonitoringService.trackAutomationExecution('whatsapp_template', true);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        recipient: formattedPhone,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Track failure metric
      MonitoringService.trackAutomationExecution('whatsapp_template', false);
      
      // Log error
      MonitoringService.error('Error sending WhatsApp template message', error, {
        recipient,
        templateName
      });
      
      throw error;
    }
  }
}

module.exports = new WhatsAppConnector();
