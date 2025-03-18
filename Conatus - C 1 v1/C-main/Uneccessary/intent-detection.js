// src/services/intent/intentDetectionService.js
import { llmService } from '../api/llmService';
import { automationService } from '../api/automationService';
import { integrationService } from '../api/integrationService';
import monitoringService from '../monitoringService';

/**
 * Intent Detection Service
 * 
 * Analyzes user queries to identify automation intents and executes
 * the corresponding actions when detected.
 */
class IntentDetectionService {
  constructor() {
    // Actions that can be detected from natural language
    this.supportedActions = [
      {
        id: 'send_message',
        name: 'Send Message',
        patterns: [
          'send a message',
          'text',
          'whatsapp',
          'email',
          'send an email',
          'message',
          'tell',
          'inform',
          'let know',
          'remind'
        ],
        services: ['whatsapp', 'gmail'],
        requiredParams: ['recipient', 'content'],
        optionalParams: ['time', 'subject'],
        examples: [
          "Send a WhatsApp message to John saying I'll be late",
          "Email marketing@example.com with subject 'Meeting Agenda'",
          "Text Sarah that I'm on my way",
          "Remind Alex tomorrow at 9am about the presentation"
        ]
      },
      {
        id: 'schedule_ride',
        name: 'Schedule Ride',
        patterns: [
          'get',
          'book',
          'schedule',
          'order',
          'call',
          'request',
          'uber',
          'lyft',
          'taxi',
          'ride',
          'car',
          'pickup'
        ],
        services: ['uber'],
        requiredParams: ['destination'],
        optionalParams: ['pickup', 'time'],
        examples: [
          "Get me an Uber to the airport",
          "Book a ride to 123 Main Street tonight at 8pm",
          "Order a car to pick me up tomorrow morning",
          "Schedule a ride from work to home at 5:30pm"
        ]
      },
      {
        id: 'play_music',
        name: 'Play Music',
        patterns: [
          'play',
          'start',
          'listen',
          'music',
          'song',
          'track',
          'album',
          'artist',
          'playlist',
          'spotify'
        ],
        services: ['spotify'],
        requiredParams: ['track'],
        optionalParams: ['artist'],
        examples: [
          "Play Bohemian Rhapsody",
          "Start my workout playlist",
          "Play some jazz music",
          "Put on Taylor Swift's latest album"
        ]
      },
      {
        id: 'calendar_event',
        name: 'Create Calendar Event',
        patterns: [
          'schedule',
          'create',
          'add',
          'set up',
          'new',
          'calendar',
          'event',
          'meeting',
          'appointment',
          'reminder'
        ],
        services: ['google_calendar'],
        requiredParams: ['title', 'time'],
        optionalParams: ['duration', 'description'],
        examples: [
          "Schedule a meeting with the team tomorrow at 3pm",
          "Create a calendar event for my dentist appointment on Friday",
          "Add a reminder for Mom's birthday on May 10th",
          "Set up a weekly team check-in every Monday at 9am"
        ]
      },
      {
        id: 'send_payment',
        name: 'Send Payment',
        patterns: [
          'send',
          'pay',
          'transfer',
          'payment',
          'money',
          'venmo',
          'paypal'
        ],
        services: ['venmo'],
        requiredParams: ['recipient', 'amount'],
        optionalParams: ['description'],
        examples: [
          "Send $25 to John for dinner",
          "Pay Sarah $50 for concert tickets",
          "Venmo $15 to roommate for utilities",
          "Transfer $100 to Alex with message 'Happy Birthday'"
        ]
      }
    ];
  }

  /**
   * Analyze a query for automation intent
   * @param {string} query - User's query
   * @returns {Promise<Object|null>} Detected intent or null if none found
   */
  async detectIntent(query) {
    try {
      const trace = monitoringService.createTrace('IntentDetection.detectIntent');
      
      // First, try regular expression pattern matching (faster)
      trace.startSpan('patternMatching');
      const patternResult = this.matchPatterns(query);
      trace.endSpan();
      
      if (patternResult && patternResult.confidence > 0.7) {
        trace.end();
        return patternResult;
      }
      
      // If pattern matching isn't confident, use LLM for more advanced detection
      trace.startSpan('llmDetection');
      const llmResult = await this.detectWithLLM(query);
      trace.endSpan();
      
      trace.end();
      return llmResult;
    } catch (error) {
      monitoringService.error('Error detecting intent', error, { query });
      return null;
    }
  }

  /**
   * Match query against known patterns
   * @param {string} query - User's query
   * @returns {Object|null} Matched action or null
   */
  matchPatterns(query) {
    const normalizedQuery = query.toLowerCase();
    let bestMatch = null;
    let highestScore = 0;
    
    for (const action of this.supportedActions) {
      let matchCount = 0;
      let patternMatches = [];
      
      // Check for action pattern matches
      for (const pattern of action.patterns) {
        if (normalizedQuery.includes(pattern.toLowerCase())) {
          matchCount++;
          patternMatches.push(pattern);
        }
      }
      
      if (matchCount > 0) {
        // Calculate a confidence score based on the number of matches
        const score = matchCount / action.patterns.length;
        
        if (score > highestScore) {
          highestScore = score;
          
          // Extract parameters
          const params = this.extractParameters(normalizedQuery, action);
          const missingParams = this.getMissingParameters(params, action.requiredParams);
          
          bestMatch = {
            action: action.id,
            name: action.name,
            confidence: score,
            patternMatches,
            params,
            missingParams,
            services: action.services,
            requiresMoreInfo: missingParams.length > 0
          };
        }
      }
    }
    
    return bestMatch;
  }

  /**
   * Detect intent using LLM
   * @param {string} query - User's query
   * @returns {Promise<Object|null>} Detected intent or null
   */
  async detectWithLLM(query) {
    try {
      // Construct a prompt for intent detection
      const actionsDescription = this.supportedActions.map(action => {
        return `${action.name} (${action.id}): ${action.examples.join(', ')}`;
      }).join('\n');
      
      const prompt = `
        Analyze the following user query for automation intent.
        
        Supported actions:
        ${actionsDescription}
        
        User query: "${query}"
        
        If the query matches any of the supported actions, extract the following information:
        1. Which action the user wants to perform
        2. All relevant parameters (recipient, content, time, destination, etc.)
        
        Return JSON in this format:
        {
          "action": "action_id or null if no clear intent",
          "confidence": 0 to 1 indicating your confidence,
          "params": {
            "paramName": "paramValue",
            ...
          }
        }
      `;
      
      // Use a lightweight model for efficiency
      const response = await llmService.sendQuery(prompt, {
        providerId: 'OPENAI',
        context: {
          model: 'gpt-3.5-turbo' // Use the smaller model for intent detection
        }
      });
      
      // Parse the response as JSON
      let result;
      try {
        // Extract JSON from the response (it might be formatted with markdown)
        const jsonString = response.content.match(/```json\n([\s\S]*)\n```/) || 
                          response.content.match(/```\n([\s\S]*)\n```/) || 
                          [null, response.content];
        
        result = JSON.parse(jsonString[1].trim());
      } catch (e) {
        console.error('Error parsing LLM response:', e);
        return null;
      }
      
      // Only return if we have a valid action and reasonable confidence
      if (result.action && result.confidence > 0.6) {
        // Look up the action details
        const actionConfig = this.supportedActions.find(a => a.id === result.action);
        
        if (!actionConfig) {
          return null;
        }
        
        // Check for missing required parameters
        const missingParams = this.getMissingParameters(result.params, actionConfig.requiredParams);
        
        return {
          action: result.action,
          name: actionConfig.name,
          confidence: result.confidence,
          params: result.params || {},
          missingParams,
          services: actionConfig.services,
          requiresMoreInfo: missingParams.length > 0
        };
      }
      
      return null;
    } catch (error) {
      monitoringService.error('Error detecting intent with LLM', error, { query });
      return null;
    }
  }

  /**
   * Extract parameters from query
   * @param {string} query - User's query
   * @param {Object} action - Action configuration
   * @returns {Object} Extracted parameters
   */
  extractParameters(query, action) {
    const params = {};
    
    // This is a simplified parameter extraction
    // In a real implementation, this would be much more sophisticated
    
    // Example: Extract recipient
    if (action.requiredParams.includes('recipient') || action.optionalParams.includes('recipient')) {
      const recipientMatch = query.match(/to\s+([^,\.]+)/) || 
                            query.match(/(?:text|message|email|tell|inform|remind)\s+([^,\.]+)/);
      
      if (recipientMatch) {
        params.recipient = recipientMatch[1].trim();
      }
    }
    
    // Example: Extract content
    if (action.requiredParams.includes('content') || action.optionalParams.includes('content')) {
      const contentMatch = query.match(/(?:saying|that|about)\s+["']?([^"']+)["']?$/) ||
                          query.match(/(?:message|content):\s*["']?([^"']+)["']?/);
      
      if (contentMatch) {
        params.content = contentMatch[1].trim();
      }
    }
    
    // Example: Extract time
    if (action.requiredParams.includes('time') || action.optionalParams.includes('time')) {
      const timeMatch = query.match(/(?:at|on)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s+on\s+\w+)?)/i) ||
                       query.match(/(tomorrow|tonight|today|next week|next month)/i) ||
                       query.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      
      if (timeMatch) {
        params.time = timeMatch[1].trim();
      }
    }
    
    // Example: Extract destination for ride
    if (action.requiredParams.includes('destination') || action.optionalParams.includes('destination')) {
      const destMatch = query.match(/to\s+(?:the\s+)?([^,\.]+)(?:,|\.|$)/);
      
      if (destMatch) {
        params.destination = destMatch[1].trim();
      }
    }
    
    // Example: Extract amount for payment
    if (action.requiredParams.includes('amount') || action.optionalParams.includes('amount')) {
      const amountMatch = query.match(/\$?(\d+(?:\.\d{2})?)/);
      
      if (amountMatch) {
        params.amount = amountMatch[1].trim();
      }
    }
    
    // Example: Extract track for music
    if (action.requiredParams.includes('track') || action.optionalParams.includes('track')) {
      const trackMatch = query.match(/play\s+(?:some\s+)?((?:[^,\.]+)(?:\s+by\s+([^,\.]+))?)/i);
      
      if (trackMatch) {
        params.track = trackMatch[1].trim();
        
        // Also extract artist if present
        if (trackMatch[2]) {
          params.artist = trackMatch[2].trim();
        }
      }
    }
    
    return params;
  }

  /**
   * Get list of missing required parameters
   * @param {Object} params - Extracted parameters
   * @param {Array<string>} requiredParams - List of required parameters
   * @returns {Array<string>} List of missing parameters
   */
  getMissingParameters(params, requiredParams) {
    return requiredParams.filter(param => !params[param]);
  }

  /**
   * Request additional information for missing parameters
   * @param {Object} intent - Detected intent
   * @returns {string} Question to ask user
   */
  getFollowUpQuestion(intent) {
    if (!intent.requiresMoreInfo) {
      return null;
    }
    
    const missingParam = intent.missingParams[0];
    
    // Customize questions based on the parameter and action
    switch (missingParam) {
      case 'recipient':
        return `Who would you like to ${intent.action === 'send_message' ? 'send the message to' : 'send the payment to'}?`;
        
      case 'content':
        return 'What would you like the message to say?';
        
      case 'amount':
        return 'How much would you like to send?';
        
      case 'destination':
        return 'Where would you like to go?';
        
      case 'track':
        return 'What song or playlist would you like to play?';
        
      case 'time':
        return 'When would you like to schedule this for?';
        
      case 'title':
        return 'What would you like to title this event?';
        
      default:
        return `Please provide the ${missingParam.replace('_', ' ')}.`;
    }
  }

  /**
   * Check if required services are connected
   * @param {Array<string>} services - Required services
   * @returns {Promise<Object>} Service connection status
   */
  async checkRequiredServices(services) {
    try {
      const connectedServices = await integrationService.getConnectedServices();
      const serviceStatuses = {};
      
      for (const service of services) {
        serviceStatuses[service] = connectedServices.some(s => s.id === service);
      }
      
      return {
        allConnected: Object.values(serviceStatuses).every(status => status),
        serviceStatuses
      };
    } catch (error) {
      monitoringService.error('Error checking required services', error);
      return {
        allConnected: false,
        serviceStatuses: services.reduce((acc, service) => {
          acc[service] = false;
          return acc;
        }, {})
      };
    }
  }

  /**
   * Execute an intent action
   * @param {Object} intent - Detected intent
   * @returns {Promise<Object>} Execution result
   */
  async executeIntent(intent) {
    try {
      const trace = monitoringService.createTrace('IntentDetection.executeIntent');
      trace.startSpan('prepare');
      
      // Check required services
      const serviceCheck = await this.checkRequiredServices(intent.services);
      
      if (!serviceCheck.allConnected) {
        const missingServices = Object.entries(serviceCheck.serviceStatuses)
          .filter(([_, connected]) => !connected)
          .map(([service]) => service);
        
        trace.end();
        return {
          success: false,
          error: 'MISSING_SERVICES',
          missingServices
        };
      }
      
      // Map to automation format
      const automation = {
        action: {
          type: intent.action,
          service: intent.services[0], // Use first service (this is simplified)
          config: intent.params
        }
      };
      
      trace.endSpan();
      trace.startSpan('execute');
      
      // Execute the automation
      const result = await automationService.executeAutomation(automation);
      
      trace.endSpan();
      trace.end();
      
      // Track execution
      monitoringService.trackAutomationExecution(intent.action, true, trace.getDuration());
      
      return {
        success: true,
        result
      };
    } catch (error) {
      monitoringService.trackAutomationExecution(intent.action, false);
      monitoringService.error('Error executing intent', error, { intent });
      
      return {
        success: false,
        error: 'EXECUTION_FAILED',
        message: error.message
      };
    }
  }
}

// Create a singleton instance
const intentDetectionService = new IntentDetectionService();

export default intentDetectionService;

// src/services/intent/conversationManager.js
/**
 * Conversation Manager
 * 
 * Keeps track of conversation context to enable follow-up queries
 * and multi-step intent completion.
 */
class ConversationManager {
  constructor() {
    this.conversations = {};
  }

  /**
   * Get or create conversation context
   * @param {string} conversationId - Conversation identifier
   * @returns {Object} Conversation context
   */
  getContext(conversationId) {
    if (!this.conversations[conversationId]) {
      this.conversations[conversationId] = {
        pendingIntent: null,
        recentIntents: [],
        lastActivityTime: Date.now()
      };
    }
    
    return this.conversations[conversationId];
  }

  /**
   * Set pending intent for follow-up
   * @param {string} conversationId - Conversation identifier
   * @param {Object} intent - Intent object
   */
  setPendingIntent(conversationId, intent) {
    const context = this.getContext(conversationId);
    context.pendingIntent = intent;
    context.lastActivityTime = Date.now();
  }

  /**
   * Get pending intent if any
   * @param {string} conversationId - Conversation identifier
   * @returns {Object|null} Pending intent or null
   */
  getPendingIntent(conversationId) {
    const context = this.getContext(conversationId);
    return context.pendingIntent;
  }

  /**
   * Clear pending intent
   * @param {string} conversationId - Conversation identifier
   */
  clearPendingIntent(conversationId) {
    const context = this.getContext(conversationId);
    context.pendingIntent = null;
    context.lastActivityTime = Date.now();
  }

  /**
   * Add completed intent to history
   * @param {string} conversationId - Conversation identifier
   * @param {Object} intent - Completed intent
   */
  addCompletedIntent(conversationId, intent) {
    const context = this.getContext(conversationId);
    context.recentIntents.unshift({
      ...intent,
      completedAt: Date.now()
    });
    
    // Keep only last 5 intents
    if (context.recentIntents.length > 5) {
      context.recentIntents.pop();
    }
    
    context.lastActivityTime = Date.now();
  }

  /**
   * Update pending intent with additional parameters
   * @param {string} conversationId - Conversation identifier
   * @param {Object} params - Additional parameters
   * @returns {Object|null} Updated intent or null
   */
  updatePendingIntent(conversationId, params) {
    const context = this.getContext(conversationId);
    
    if (!context.pendingIntent) {
      return null;
    }
    
    // Update parameters
    context.pendingIntent.params = {
      ...context.pendingIntent.params,
      ...params
    };
    
    // Update missing parameters
    context.pendingIntent.missingParams = context.pendingIntent.missingParams
      .filter(param => !params[param]);
    
    context.pendingIntent.requiresMoreInfo = context.pendingIntent.missingParams.length > 0;
    context.lastActivityTime = Date.now();
    
    return context.pendingIntent;
  }

  /**
   * Clean up old conversations to prevent memory leaks
   */
  cleanupOldConversations() {
    const now = Date.now();
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
    
    Object.keys(this.conversations).forEach(conversationId => {
      const context = this.conversations[conversationId];
      if (now - context.lastActivityTime > expirationTime) {
        delete this.conversations[conversationId];
      }
    });
  }
}

// Create a singleton instance
const conversationManager = new ConversationManager();

// Set up automatic cleanup
setInterval(() => {
  conversationManager.cleanupOldConversations();
}, 60 * 60 * 1000); // Run every hour

export default conversationManager;

// src/components/home/AutomationConfirmation.jsx
import React, { useState } from 'react';
import './AutomationConfirmation.css';

/**
 * Displays a confirmation dialog for automations
 */
const AutomationConfirmation = ({
  intent,
  onConfirm,
  onCancel,
  onConnect,
  servicesToConnect = []
}) => {
  const [confirming, setConfirming] = useState(false);
  
  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  };
  
  // Format parameters for display
  const formatParams = () => {
    return Object.entries(intent.params).map(([key, value]) => {
      // Format each parameter nicely
      let formattedKey = key.replace(/_/g, ' ');
      formattedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
      
      return (
        <div key={key} className="param-item">
          <span className="param-label">{formattedKey}:</span>
          <span className="param-value">{value}</span>
        </div>
      );
    });
  };
  
  return (
    <div className="automation-confirmation">
      <div className="confirmation-header">
        <h3>{intent.name}</h3>
        <p>I can help you with that. Please confirm the details:</p>
      </div>
      
      <div className="confirmation-params">
        {formatParams()}
      </div>
      
      {servicesToConnect.length > 0 && (
        <div className="service-connection-required">
          <p>To complete this action, you need to connect:</p>
          <ul>
            {servicesToConnect.map(service => (
              <li key={service}>
                <button 
                  className="connect-service-button"
                  onClick={() => onConnect(service)}
                >
                  Connect {service}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="confirmation-actions">
        <button
          className="cancel-button"
          onClick={onCancel}
          disabled={confirming}
        >
          Cancel
        </button>
        
        <button
          className="confirm-button"
          onClick={handleConfirm}
          disabled={confirming || servicesToConnect.length > 0}
        >
          {confirming ? 'Executing...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
};

export default AutomationConfirmation;

// src/components/home/AutomationConfirmation.css
.automation-confirmation {
  background-color: #eef2ff;
  border-left: 4px solid #6366f1;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.confirmation-header h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #4f46e5;
}

.confirmation-header p {
  margin-bottom: 1rem;
  color: #4b5563;
}

.confirmation-params {
  background-color: white;
  border-radius: 0.25rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.param-item {
  display: flex;
  margin-bottom: 0.5rem;
}

.param-item:last-child {
  margin-bottom: 0;
}

.param-label {
  font-weight: 500;
  width: 120px;
  color: #4b5563;
}

.param-value {
  flex: 1;
  word-break: break-word;
}

.service-connection-required {
  background-color: #fffbeb;
  border-left: 4px solid #f59e0b;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-radius: 0.25rem;
}

.service-connection-required p {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #92400e;
}

.service-connection-required ul {
  margin: 0;
  padding-left: 1.25rem;
}

.service-connection-required li {
  margin-bottom: 0.5rem;
}

.service-connection-required li:last-child {
  margin-bottom: 0;
}

.connect-service-button {
  background-color: #f59e0b;
  color: white;
  border: none;
  border-radius: 0.25rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.connect-service-button:hover {
  background-color: #d97706;
}

.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cancel-button {
  background-color: white;
  color: #4b5563;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.5rem 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.confirm-button {
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.25rem;
  padding: 0.5rem 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.confirm-button:hover {
  background-color: #4338ca;
}

.confirm-button:disabled,
.cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
