// backend/services/automation/AutomationDetectionService.js
/**
 * Automation Detection Service
 * 
 * Analyzes user messages to detect automation opportunities
 * and extracts parameters for execution.
 */

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const natural = require('natural');
const OAuthService = require('../oauth/OAuthService');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

class AutomationDetectionService {
  constructor() {
    // Patterns for common automation requests
    this.patterns = [
      // Message scheduling patterns
      {
        type: 'message_schedule',
        service: 'whatsapp',
        regex: /(?:schedule|send)\s+(?:a\s+)?(?:whatsapp|whats app|wa)\s+(?:message|msg|text)\s+(?:to|for)\s+([a-zA-Z\s]+?)(?:\s+(?:at|on|tomorrow|in)\s+(.+?))?(?:\s+saying\s+"?(.*?)"?)?$/i,
        extractParams: (matches) => ({
          recipient: matches[1]?.trim(),
          time: matches[2]?.trim() || 'now',
          content: matches[3]?.trim() || ''
        }),
        requiredServices: ['whatsapp'],
        confirmationTemplate: 'Send {{content}} to {{recipient}} on WhatsApp {{time}}'
      },
      {
        type: 'message_schedule',
        service: 'gmail',
        regex: /(?:schedule|send)\s+(?:a\s+)?(?:email|mail|gmail)\s+(?:to|for)\s+([a-zA-Z\s@.]+?)(?:\s+(?:with subject|subject)\s+"?(.*?)"?)?(?:\s+(?:at|on|tomorrow|in)\s+(.+?))?(?:\s+saying\s+"?(.*?)"?)?$/i,
        extractParams: (matches) => ({
          recipient: matches[1]?.trim(),
          subject: matches[2]?.trim() || '',
          time: matches[3]?.trim() || 'now',
          content: matches[4]?.trim() || ''
        }),
        requiredServices: ['gmail'],
        confirmationTemplate: 'Send email to {{recipient}} with subject "{{subject}}" {{time}}'
      },
      
      // Transportation patterns
      {
        type: 'ride_request',
        service: 'uber',
        regex: /(?:get|book|order|schedule)\s+(?:a\s+)?(?:uber|ride|car|taxi)\s+(?:to|from|between)\s+([a-zA-Z0-9\s,.]+?)(?:\s+(?:to|and)\s+([a-zA-Z0-9\s,.]+?))?(?:\s+(?:at|on|tomorrow|in)\s+(.+?))?$/i,
        extractParams: (matches) => ({
          pickup: matches[1]?.trim(),
          destination: matches[2]?.trim() || '',
          time: matches[3]?.trim() || 'now'
        }),
        requiredServices: ['uber'],
        confirmationTemplate: 'Book an Uber from {{pickup}} to {{destination}} {{time}}'
      },
      
      // Food ordering patterns
      {
        type: 'food_order',
        service: 'doordash',
        regex: /(?:order|get)\s+(?:food|dinner|lunch|breakfast)\s+(?:from)\s+([a-zA-Z0-9\s,.'&]+?)(?:\s+(?:with|containing)\s+(.+?))?(?:\s+(?:at|on|tomorrow|in)\s+(.+?))?$/i,
        extractParams: (matches) => ({
          restaurant: matches[1]?.trim(),
          items: matches[2]?.trim() || 'my usual order',
          time: matches[3]?.trim() || 'now'
        }),
        requiredServices: ['doordash'],
        confirmationTemplate: 'Order {{items}} from {{restaurant}} {{time}}'
      },
      
      // Calendar event patterns
      {
        type: 'calendar_event',
        service: 'google_calendar',
        regex: /(?:schedule|create|add)\s+(?:a\s+)?(?:meeting|event|appointment|call)\s+(?:with|about|for)\s+([a-zA-Z0-9\s,.]+?)(?:\s+(?:at|on|tomorrow|in)\s+(.+?))?(?:\s+(?:for|lasting)\s+(.+?))?$/i,
        extractParams: (matches) => ({
          title: matches[1]?.trim(),
          time: matches[2]?.trim() || '',
          duration: matches[3]?.trim() || '30 minutes'
        }),
        requiredServices: ['google_calendar'],
        confirmationTemplate: 'Schedule "{{title}}" {{time}} for {{duration}}'
      },
      
      // Music control patterns
      {
        type: 'music_control',
        service: 'spotify',
        regex: /(?:play|start|queue)\s+(?:song|track|artist|album|playlist)?\s+"?([a-zA-Z0-9\s,.'\-&]+?)"?(?:\s+(?:by|from)\s+([a-zA-Z0-9\s,.'\-&]+?))?$/i,
        extractParams: (matches) => ({
          track: matches[1]?.trim(),
          artist: matches[2]?.trim() || ''
        }),
        requiredServices: ['spotify'],
        confirmationTemplate: 'Play "{{track}}"{{#artist}} by {{artist}}{{/artist}} on Spotify'
      },
      
      // Payment patterns
      {
        type: 'payment',
        service: 'venmo',
        regex: /(?:send|pay|venmo)\s+(?:a\s+)?(\$?[0-9]+(?:\.[0-9]{2})?)\s+(?:to|for)\s+([a-zA-Z\s]+?)(?:\s+(?:for|because|to pay for|to cover)\s+(.+?))?$/i,
        extractParams: (matches) => ({
          amount: matches[1]?.trim().replace('$', ''),
          recipient: matches[2]?.trim(),
          description: matches[3]?.trim() || ''
        }),
        requiredServices: ['venmo'],
        confirmationTemplate: 'Send ${{amount}} to {{recipient}}{{#description}} for "{{description}}"{{/description}} via Venmo'
      }
    ];
  }

  /**
   * Detect if a message contains an automation request
   * @param {string} message - User message to analyze
   * @param {string} userId - User ID for checking available services
   * @returns {Promise<Object|null>} - Automation details if detected, null otherwise
   */
  async detectAutomation(message, userId) {
    try {
      // Check for pattern matches first (fast)
      const patternMatch = this.detectWithPatterns(message);
      
      if (patternMatch) {
        // Check if user has the required services connected
        const hasRequiredServices = await this.checkRequiredServices(
          userId,
          patternMatch.requiredServices
        );
        
        if (!hasRequiredServices) {
          return {
            ...patternMatch,
            needsConnection: true,
            services: patternMatch.requiredServices
          };
        }
        
        return patternMatch;
      }
      
      // If no pattern match, use NLP-based detection (slower but more flexible)
      if (this.isLikelyAutomation(message)) {
        const nlpResult = await this.detectWithNLP(message, userId);
        return nlpResult;
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting automation:', error);
      return null;
    }
  }

  /**
   * Check if a message matches any automation patterns
   * @param {string} message - User message
   * @returns {Object|null} - Matched automation or null
   */
  detectWithPatterns(message) {
    // Try each pattern until one matches
    for (const pattern of this.patterns) {
      const matches = message.match(pattern.regex);
      
      if (matches) {
        // Extract parameters based on the pattern
        const params = pattern.extractParams(matches);
        
        // Generate confirmation message
        const confirmationMessage = this.generateConfirmation(
          pattern.confirmationTemplate,
          params
        );
        
        return {
          type: pattern.type,
          service: pattern.service,
          params,
          requiredServices: pattern.requiredServices,
          confidence: 0.9, // High confidence for regex matches
          confirmationMessage,
          originalMessage: message
        };
      }
    }
    
    return null;
  }

  /**
   * Generate a confirmation message from a template
   * @param {string} template - Template string with placeholders
   * @param {Object} params - Parameters to substitute
   * @returns {string} - Formatted confirmation message
   */
  generateConfirmation(template, params) {
    let message = template;
    
    // Replace simple placeholders
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const regex = new RegExp(`{{${key}}}`, 'g');
        message = message.replace(regex, value || '');
      }
    }
    
    // Handle conditional blocks
    // Format: {{#key}}content if key exists{{/key}}
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value) {
        const regex = new RegExp(`{{#${key}}}(.+?){{/${key}}}`, 'g');
        message = message.replace(regex, '$1');
      } else {
        const regex = new RegExp(`{{#${key}}}(.+?){{/${key}}}`, 'g');
        message = message.replace(regex, '');
      }
    });
    
    return message;
  }

  /**
   * Check if a message is likely to be an automation request
   * @param {string} message - User message
   * @returns {boolean} - True if likely automation
   */
  isLikelyAutomation(message) {
    // Automation indicator words
    const actionWords = [
      'schedule', 'send', 'book', 'order', 'create', 'add', 'play',
      'get', 'make', 'set', 'pay', 'venmo', 'uber', 'whatsapp'
    ];
    
    // Check if message starts with an action word
    const tokens = tokenizer.tokenize(message.toLowerCase());
    const firstWord = tokens[0];
    
    return actionWords.includes(firstWord);
  }

  /**
   * Use NLP to detect more complex automation requests
   * @param {string} message - User message
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - Detected automation or null
   */
  async detectWithNLP(message, userId) {
    try {
      // Get user's connected services
      const userConnections = await OAuthService.getUserConnections(userId);
      const connectedServices = userConnections.map(conn => conn.id);
      
      // Use OpenAI to classify the message
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an automation detection system. Analyze messages to detect if they contain automation requests.
            Respond with JSON only in this format: 
            {
              "isAutomation": true/false,
              "type": "automation_type",
              "service": "service_name",
              "params": { param1: "value1", param2: "value2", ... },
              "confidence": 0.0-1.0,
              "requiredServices": ["service1", "service2"]
            }
            
            The user has these services connected: ${connectedServices.join(', ')}
            
            Automation types: message_schedule, ride_request, food_order, calendar_event, music_control, payment.
            Services: whatsapp, gmail, uber, doordash, google_calendar, spotify, venmo.
            
            If the message is not an automation request, set isAutomation to false.`
          },
          {
            role: 'user',
            content: `Analyze this message for automation intent: "${message}"`
          }
        ],
        temperature: 0,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });
      
      // Parse the response
      const result = JSON.parse(response.choices[0].message.content);
      
      if (!result.isAutomation) {
        return null;
      }
      
      // Check if user has the required services connected
      const hasRequiredServices = await this.checkRequiredServices(
        userId,
        result.requiredServices
      );
      
      // For NLP-detected automations, generate a confirmation message
      let confirmationMessage = '';
      
      switch (result.type) {
        case 'message_schedule':
          if (result.service === 'whatsapp') {
            confirmationMessage = `Send "${result.params.content}" to ${result.params.recipient} on WhatsApp`;
          } else if (result.service === 'gmail') {
            confirmationMessage = `Send email to ${result.params.recipient} with subject "${result.params.subject}"`;
          }
          break;
        case 'ride_request':
          confirmationMessage = `Book an ${result.service} from ${result.params.pickup} to ${result.params.destination}`;
          break;
        case 'food_order':
          confirmationMessage = `Order food from ${result.params.restaurant}`;
          break;
        case 'calendar_event':
          confirmationMessage = `Schedule "${result.params.title}" on your calendar`;
          break;
        case 'music_control':
          confirmationMessage = `Play "${result.params.track}"${result.params.artist ? ` by ${result.params.artist}` : ''}`;
          break;
        case 'payment':
          confirmationMessage = `Send $${result.params.amount} to ${result.params.recipient}${result.params.description ? ` for "${result.params.description}"` : ''}`;
          break;
      }
      
      return {
        ...result,
        needsConnection: !hasRequiredServices,
        confirmationMessage,
        originalMessage: message
      };
    } catch (error) {
      console.error('Error in NLP automation detection:', error);
      return null;
    }
  }

  /**
   * Check if a user has the required services connected
   * @param {string} userId - User ID
   * @param {Array<string>} services - Required service IDs
   * @returns {Promise<boolean>} - True if all required services are connected
   */
  async checkRequiredServices(userId, services) {
    try {
      if (!services || services.length === 0) {
        return true;
      }
      
      for (const serviceId of services) {
        const isConnected = await OAuthService.isServiceConnected(userId, serviceId);
        if (!isConnected) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking required services:', error);
      return false;
    }
  }

  /**
   * Validate automation parameters
   * @param {Object} automation - Detected automation
   * @returns {Object} - Validation result
   */
  validateAutomation(automation) {
    const { type, service, params } = automation;
    const errors = [];
    
    switch (type) {
      case 'message_schedule':
        if (service === 'whatsapp') {
          if (!params.recipient) {
            errors.push('Recipient is required');
          }
          if (!params.content) {
            errors.push('Message content is required');
          }
        } else if (service === 'gmail') {
          if (!params.recipient) {
            errors.push('Recipient is required');
          }
          if (!params.subject && !params.content) {
            errors.push('Subject or content is required');
          }
        }
        break;
      case 'ride_request':
        if (!params.destination) {
          errors.push('Destination is required');
        }
        break;
      case 'food_order':
        if (!params.restaurant) {
          errors.push('Restaurant is required');
        }
        break;
      case 'calendar_event':
        if (!params.title) {
          errors.push('Event title is required');
        }
        if (!params.time) {
          errors.push('Event time is required');
        }
        break;
      case 'music_control':
        if (!params.track && !params.artist) {
          errors.push('Track or artist is required');
        }
        break;
      case 'payment':
        if (!params.amount) {
          errors.push('Payment amount is required');
        }
        if (!params.recipient) {
          errors.push('Payment recipient is required');
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new AutomationDetectionService();
