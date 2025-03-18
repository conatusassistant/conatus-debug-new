// backend/services/automation/ConditionalExecutionService.js
/**
 * Conditional Execution Service
 * 
 * Enables advanced automation capabilities with conditional logic, data transformation,
 * and chained executions for more sophisticated workflows.
 */

const { createClient } = require('@supabase/supabase-js');

// Import other services
const AutomationService = require('./AutomationService');
const LLMService = require('../llm/LLMService');
const ServiceConnectorRegistry = require('../connectors/ServiceConnectorRegistry');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

class ConditionalExecutionService {
  /**
   * Execute a workflow with conditional logic
   * @param {Object} workflow - Workflow definition with conditionals
   * @param {Object} triggerData - Data from the trigger
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Execution result
   */
  async executeConditionalWorkflow(workflow, triggerData, userId) {
    try {
      // Store execution context with variables that can be referenced throughout execution
      const context = {
        userId,
        triggerData,
        variables: {},
        results: {}
      };
      
      // Execute any initialization steps
      if (workflow.initialization) {
        await this.executeInitialization(workflow.initialization, context);
      }
      
      // Execute the main workflow logic with conditions
      const result = await this.executeLogicBlocks(workflow.logic, context);
      
      // Return final result
      return {
        success: true,
        results: context.results,
        variables: context.variables,
        finalResult: result
      };
    } catch (error) {
      console.error('Error executing conditional workflow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute initialization steps to set up variables
   * @param {Array} initialization - Initialization steps
   * @param {Object} context - Execution context
   */
  async executeInitialization(initialization, context) {
    for (const step of initialization) {
      try {
        switch (step.type) {
          case 'set_variable':
            // Set a variable directly
            context.variables[step.name] = this.resolveValue(step.value, context);
            break;
            
          case 'extract_from_trigger':
            // Extract data from trigger payload
            if (step.source && context.triggerData[step.source]) {
              context.variables[step.name] = context.triggerData[step.source];
            } else if (step.jsonPath && context.triggerData) {
              context.variables[step.name] = this.extractByJsonPath(context.triggerData, step.jsonPath);
            }
            break;
            
          case 'data_transformation':
            // Apply a transformation to data
            const input = this.resolveValue(step.input, context);
            context.variables[step.name] = await this.applyTransformation(input, step.transformation);
            break;
            
          case 'llm_generation':
            // Generate content using LLM
            const prompt = this.resolveValue(step.prompt, context);
            const llmResult = await LLMService.routeQuery(prompt, step.provider);
            context.variables[step.name] = llmResult.content;
            break;
        }
      } catch (error) {
        console.error(`Error in initialization step ${step.type}:`, error);
        // Continue with other steps even if one fails
      }
    }
  }

  /**
   * Execute logic blocks with conditionals
   * @param {Array} logicBlocks - Logic blocks with conditions and actions
   * @param {Object} context - Execution context
   * @returns {Promise<any>} - Result of execution
   */
  async executeLogicBlocks(logicBlocks, context) {
    let result = null;
    
    for (const block of logicBlocks) {
      try {
        // Check if this block should be executed based on condition
        if (block.condition && !this.evaluateCondition(block.condition, context)) {
          continue; // Skip this block if condition is not met
        }
        
        // Execute the block based on its type
        switch (block.type) {
          case 'action':
            result = await this.executeAction(block.action, context);
            break;
            
          case 'conditional':
            // If/else branching
            if (this.evaluateCondition(block.if, context)) {
              result = await this.executeLogicBlocks(block.then, context);
            } else if (block.else) {
              result = await this.executeLogicBlocks(block.else, context);
            }
            break;
            
          case 'loop':
            // Loop over items
            const items = this.resolveValue(block.items, context);
            const loopResults = [];
            
            if (Array.isArray(items)) {
              for (let i = 0; i < items.length; i++) {
                // Create a new context for each iteration with the loop item
                const iterationContext = {
                  ...context,
                  variables: {
                    ...context.variables,
                    [block.itemVariable || 'item']: items[i],
                    [block.indexVariable || 'index']: i
                  }
                };
                
                const iterationResult = await this.executeLogicBlocks(block.body, iterationContext);
                loopResults.push(iterationResult);
                
                // Update the parent context with any new variables from the iteration
                Object.assign(context.variables, iterationContext.variables);
              }
            }
            
            result = loopResults;
            break;
            
          case 'parallel':
            // Execute actions in parallel
            const parallelResults = await Promise.all(
              block.actions.map(action => this.executeAction(action, context))
            );
            result = parallelResults;
            break;
            
          case 'set_variable':
            // Set a variable
            context.variables[block.name] = this.resolveValue(block.value, context);
            break;
            
          case 'return':
            // Explicit return from workflow
            return this.resolveValue(block.value, context);
        }
        
        // Store result with name if provided
        if (block.resultName) {
          context.results[block.resultName] = result;
          context.variables[block.resultName] = result;
        }
        
        // Handle early termination
        if (block.terminal === true) {
          break;
        }
      } catch (error) {
        console.error(`Error executing logic block ${block.type}:`, error);
        
        // Store error information
        context.lastError = {
          message: error.message,
          block: block.type,
          timestamp: new Date().toISOString()
        };
        
        // Handle error based on block configuration
        if (block.errorHandling === 'continue') {
          continue; // Skip to next block
        } else if (block.errorHandling === 'return') {
          return { error: error.message };
        } else {
          throw error; // Re-throw by default
        }
      }
    }
    
    return result;
  }

  /**
   * Execute a single action
   * @param {Object} action - Action definition
   * @param {Object} context - Execution context
   * @returns {Promise<any>} - Action result
   */
  async executeAction(action, context) {
    // Get the appropriate connector for this service
    const connector = ServiceConnectorRegistry.getConnector(action.service);
    
    if (!connector) {
      throw new Error(`Unknown service connector: ${action.service}`);
    }
    
    // Get access token for this service
    const accessToken = await this.getServiceAccessToken(action.service, context.userId);
    
    // Process action parameters with variable substitution
    const processedParams = {};
    for (const [key, value] of Object.entries(action.params || {})) {
      processedParams[key] = this.resolveValue(value, context);
    }
    
    // Execute the appropriate action method
    switch (action.type) {
      case 'message_schedule':
        if (action.service === 'whatsapp') {
          return connector.sendMessage(
            accessToken,
            processedParams.recipient,
            processedParams.content,
            processedParams.time
          );
        } else if (action.service === 'gmail') {
          return connector.sendEmail(
            accessToken,
            processedParams.recipient,
            processedParams.subject || 'Automated Email',
            processedParams.content,
            processedParams.time
          );
        }
        break;
        
      case 'ride_request':
        return connector.bookRide(
          accessToken,
          processedParams.pickup,
          processedParams.destination,
          processedParams.time
        );
        
      case 'calendar_event':
        return connector.createEvent(
          accessToken,
          processedParams.title,
          processedParams.startTime,
          processedParams.duration,
          processedParams.description
        );
        
      case 'music_control':
        return connector.playMusic(
          accessToken,
          processedParams.track,
          processedParams.artist
        );
        
      case 'payment':
        return connector.sendPayment(
          accessToken,
          processedParams.recipient,
          processedParams.amount,
          processedParams.description
        );
        
      case 'api_request':
        // Custom API request
        return this.makeApiRequest(
          processedParams.url,
          processedParams.method || 'GET',
          processedParams.headers,
          processedParams.body,
          processedParams.auth
        );
        
      case 'llm_query':
        // Make a query to an LLM
        return LLMService.routeQuery(
          processedParams.query,
          processedParams.provider,
          processedParams.context
        );
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Evaluate a condition
   * @param {Object} condition - Condition definition
   * @param {Object} context - Execution context
   * @returns {boolean} - Whether condition is met
   */
  evaluateCondition(condition, context) {
    if (!condition) {
      return true; // No condition means always execute
    }
    
    // Handle different condition types
    switch (condition.type) {
      case 'equals':
        return this.resolveValue(condition.left, context) === this.resolveValue(condition.right, context);
        
      case 'not_equals':
        return this.resolveValue(condition.left, context) !== this.resolveValue(condition.right, context);
        
      case 'greater_than':
        return this.resolveValue(condition.left, context) > this.resolveValue(condition.right, context);
        
      case 'less_than':
        return this.resolveValue(condition.left, context) < this.resolveValue(condition.right, context);
        
      case 'contains':
        const container = this.resolveValue(condition.container, context);
        const item = this.resolveValue(condition.item, context);
        
        if (typeof container === 'string') {
          return container.includes(item);
        } else if (Array.isArray(container)) {
          return container.includes(item);
        } else if (typeof container === 'object' && container !== null) {
          return item in container;
        }
        return false;
        
      case 'regex_match':
        const text = this.resolveValue(condition.text, context);
        const pattern = this.resolveValue(condition.pattern, context);
        return new RegExp(pattern).test(text);
        
      case 'and':
        return condition.conditions.every(cond => this.evaluateCondition(cond, context));
        
      case 'or':
        return condition.conditions.some(cond => this.evaluateCondition(cond, context));
        
      case 'not':
        return !this.evaluateCondition(condition.condition, context);
        
      case 'exists':
        const value = this.resolveValue(condition.value, context);
        return value !== undefined && value !== null;
        
      case 'is_empty':
        const testValue = this.resolveValue(condition.value, context);
        if (testValue === null || testValue === undefined) return true;
        if (Array.isArray(testValue)) return testValue.length === 0;
        if (typeof testValue === 'object') return Object.keys(testValue).length === 0;
        if (typeof testValue === 'string') return testValue === '';
        return false;
        
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Resolve a value, which could be a reference to a variable
   * @param {any} value - Value or reference
   * @param {Object} context - Execution context
   * @returns {any} - Resolved value
   */
  resolveValue(value, context) {
    // If it's a primitive value (not an object), return directly
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    // If it's a variable reference
    if (value.type === 'variable' && value.name) {
      return context.variables[value.name];
    }
    
    // If it's a result reference
    if (value.type === 'result' && value.name) {
      return context.results[value.name];
    }
    
    // If it's a trigger data reference
    if (value.type === 'trigger' && value.field) {
      return context.triggerData[value.field];
    }
    
    // If it's a template string
    if (value.type === 'template' && value.template) {
      return this.processTemplate(value.template, context);
    }
    
    // If it's a function evaluation
    if (value.type === 'function' && value.function) {
      return this.evaluateFunction(value.function, value.args || [], context);
    }
    
    // If it's an array, resolve each element
    if (Array.isArray(value)) {
      return value.map(item => this.resolveValue(item, context));
    }
    
    // If it's an object (but not a special reference type), resolve each property
    if (typeof value === 'object') {
      const resolvedObj = {};
      for (const [key, propValue] of Object.entries(value)) {
        resolvedObj[key] = this.resolveValue(propValue, context);
      }
      return resolvedObj;
    }
    
    // Default fallback
    return value;
  }

  /**
   * Process a template string with variable substitution
   * @param {string} template - Template string
   * @param {Object} context - Execution context
   * @returns {string} - Processed string
   */
  processTemplate(template, context) {
    // Replace {{variable}} patterns with variable values
    return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const varPath = varName.trim().split('.');
      let value = context.variables;
      
      // Handle nested properties
      for (const prop of varPath) {
        if (value === undefined || value === null) return match;
        value = value[prop];
      }
      
      // Return empty string for undefined/null
      if (value === undefined || value === null) return '';
      
      return String(value);
    });
  }

  /**
   * Evaluate a function with arguments
   * @param {string} functionName - Function name
   * @param {Array} args - Function arguments
   * @param {Object} context - Execution context
   * @returns {any} - Function result
   */
  evaluateFunction(functionName, args, context) {
    // Resolve all argument values first
    const resolvedArgs = args.map(arg => this.resolveValue(arg, context));
    
    // Implement built-in functions
    switch (functionName) {
      case 'concat':
        return resolvedArgs.join('');
        
      case 'join':
        if (resolvedArgs.length < 2) return '';
        const [array, separator] = resolvedArgs;
        if (!Array.isArray(array)) return '';
        return array.join(separator || '');
        
      case 'length':
        const value = resolvedArgs[0];
        if (Array.isArray(value)) return value.length;
        if (typeof value === 'string') return value.length;
        if (typeof value === 'object' && value !== null) return Object.keys(value).length;
        return 0;
        
      case 'lowercase':
        if (typeof resolvedArgs[0] === 'string') return resolvedArgs[0].toLowerCase();
        return '';
        
      case 'uppercase':
        if (typeof resolvedArgs[0] === 'string') return resolvedArgs[0].toUpperCase();
        return '';
        
      case 'substring':
        if (resolvedArgs.length < 2 || typeof resolvedArgs[0] !== 'string') return '';
        const [str, start, end] = resolvedArgs;
        return str.substring(start, end);
        
      case 'replace':
        if (resolvedArgs.length < 3 || typeof resolvedArgs[0] !== 'string') return '';
        const [targetStr, search, replacement] = resolvedArgs;
        return targetStr.replace(new RegExp(search, 'g'), replacement);
        
      case 'split':
        if (resolvedArgs.length < 2 || typeof resolvedArgs[0] !== 'string') return [];
        const [splitStr, delimiter] = resolvedArgs;
        return splitStr.split(delimiter);
        
      case 'now':
        return new Date().toISOString();
        
      case 'formatDate':
        if (resolvedArgs.length < 1) return '';
        const date = new Date(resolvedArgs[0]);
        const format = resolvedArgs[1] || 'ISO';
        
        if (format === 'ISO') return date.toISOString();
        if (format === 'date') return date.toISOString().split('T')[0];
        if (format === 'time') return date.toISOString().split('T')[1].split('.')[0];
        if (format === 'localeDate') return date.toLocaleDateString();
        if (format === 'localeTime') return date.toLocaleTimeString();
        return date.toString();
        
      case 'sum':
        return resolvedArgs.reduce((acc, val) => acc + (Number(val) || 0), 0);
        
      case 'avg':
        if (resolvedArgs.length === 0) return 0;
        return this.evaluateFunction('sum', args, context) / resolvedArgs.length;
        
      case 'min':
        if (resolvedArgs.length === 0) return null;
        return Math.min(...resolvedArgs.map(v => Number(v) || 0));
        
      case 'max':
        if (resolvedArgs.length === 0) return null;
        return Math.max(...resolvedArgs.map(v => Number(v) || 0));
        
      case 'random':
        if (resolvedArgs.length < 1) return Math.random();
        if (resolvedArgs.length === 1) return Math.floor(Math.random() * resolvedArgs[0]);
        return Math.floor(Math.random() * (resolvedArgs[1] - resolvedArgs[0])) + resolvedArgs[0];
        
      case 'if':
        if (resolvedArgs.length < 3) return null;
        return resolvedArgs[0] ? resolvedArgs[1] : resolvedArgs[2];
        
      default:
        console.warn(`Unknown function: ${functionName}`);
        return null;
    }
  }

  /**
   * Apply a data transformation to input
   * @param {any} input - Input data
   * @param {Object} transformation - Transformation definition
   * @returns {Promise<any>} - Transformed data
   */
  async applyTransformation(input, transformation) {
    switch (transformation.type) {
      case 'json_parse':
        if (typeof input === 'string') {
          try {
            return JSON.parse(input);
          } catch (error) {
            console.error('JSON parse error:', error);
            return null;
          }
        }
        return input;
        
      case 'json_stringify':
        try {
          return JSON.stringify(input);
        } catch (error) {
          console.error('JSON stringify error:', error);
          return '';
        }
        
      case 'array_map':
        if (!Array.isArray(input)) return [];
        return input.map(item => this.applyTransformation(item, transformation.itemTransformation));
        
      case 'array_filter':
        if (!Array.isArray(input)) return [];
        return input.filter(item => {
          // Create a context with the item as a variable
          const itemContext = {
            variables: { item },
            results: {},
            triggerData: {}
          };
          return this.evaluateCondition(transformation.condition, itemContext);
        });
        
      case 'array_reduce':
        if (!Array.isArray(input)) return transformation.initialValue;
        return input.reduce((acc, item) => {
          // Create a context with the accumulator and item as variables
          const reduceContext = {
            variables: { 
              accumulator: acc,
              item
            },
            results: {},
            triggerData: {}
          };
          // Resolve the reducer expression
          return this.resolveValue(transformation.reducer, reduceContext);
        }, transformation.initialValue);
        
      case 'regex_extract':
        if (typeof input !== 'string') return null;
        const regex = new RegExp(transformation.pattern, transformation.flags || '');
        const matches = input.match(regex);
        if (!matches) return null;
        return transformation.group ? matches[transformation.group] : matches[0];
        
      case 'object_pick':
        if (typeof input !== 'object' || input === null) return {};
        if (!Array.isArray(transformation.keys)) return {};
        const result = {};
        for (const key of transformation.keys) {
          if (key in input) {
            result[key] = input[key];
          }
        }
        return result;
        
      case 'object_omit':
        if (typeof input !== 'object' || input === null) return {};
        if (!Array.isArray(transformation.keys)) return input;
        const omitResult = { ...input };
        for (const key of transformation.keys) {
          delete omitResult[key];
        }
        return omitResult;
        
      case 'llm_transform':
        // Special transformation using LLM
        if (!transformation.prompt) return input;
        
        // Create a prompt that includes the input data
        const prompt = transformation.prompt.replace('{{input}}', JSON.stringify(input));
        
        // Call the LLM
        const llmResult = await LLMService.routeQuery(prompt, transformation.provider || 'OPENAI');
        
        // Parse the result if needed
        if (transformation.parseJson) {
          try {
            return JSON.parse(llmResult.content);
          } catch (error) {
            console.error('Failed to parse LLM result as JSON:', error);
            return llmResult.content;
          }
        }
        
        return llmResult.content;
        
      default:
        console.warn(`Unknown transformation type: ${transformation.type}`);
        return input;
    }
  }

  /**
   * Extract data using a JSON path expression
   * @param {Object} data - Object to extract from
   * @param {string} path - JSON path expression
   * @returns {any} - Extracted value
   */
  extractByJsonPath(data, path) {
    if (!data || !path) return null;
    
    // Simple implementation of JSON path extraction
    const parts = path.split('.');
    let current = data;
    
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      
      // Handle array indexing with bracket notation
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [_, prop, index] = arrayMatch;
        current = current[prop]?.[parseInt(index, 10)];
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  /**
   * Make an API request to an external service
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {Object} headers - HTTP headers
   * @param {any} body - Request body
   * @param {Object} auth - Authentication details
   * @returns {Promise<Object>} - API response
   */
  async makeApiRequest(url, method = 'GET', headers = {}, body = null, auth = null) {
    try {
      const requestOptions = {
        method,
        headers: { ...headers },
        timeout: 10000 // 10 second timeout
      };
      
      // Add authentication if provided
      if (auth) {
        if (auth.type === 'bearer') {
          requestOptions.headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'basic') {
          const basicAuth = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          requestOptions.headers['Authorization'] = `Basic ${basicAuth}`;
        } else if (auth.type === 'api_key') {
          if (auth.in === 'header') {
            requestOptions.headers[auth.name] = auth.value;
          } else if (auth.in === 'query') {
            url += (url.includes('?') ? '&' : '?') + `${auth.name}=${encodeURIComponent(auth.value)}`;
          }
        }
      }
      
      // Add body if provided and method is not GET
      if (body && method !== 'GET') {
        if (typeof body === 'object') {
          requestOptions.headers['Content-Type'] = 'application/json';
          requestOptions.body = JSON.stringify(body);
        } else {
          requestOptions.body = body;
        }
      }
      
      // Make the request
      const response = await fetch(url, requestOptions);
      
      // Parse response based on content type
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const jsonData = await response.json();
        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: jsonData,
          ok: response.ok
        };
      } else {
        const textData = await response.text();
        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: textData,
          ok: response.ok
        };
      }
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * Get a service access token for a user
   * @param {string} serviceId - Service identifier
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Access token
   */
  async getServiceAccessToken(serviceId, userId) {
    // This would normally use the OAuthService to get a token
    // For now, just a simple implementation
    const { data, error } = await supabase
      .from('service_connections')
      .select('credentials')
      .eq('user_id', userId)
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      throw new Error(`No active connection found for service: ${serviceId}`);
    }
    
    return data.credentials.access_token;
  }
}

module.exports = new ConditionalExecutionService();

// backend/services/automation/ContextAwarenessService.js
/**
 * Context Awareness Service
 * 
 * Enhances automations with contextual awareness including:
 * - Location-based triggers
 * - Time-based patterns
 * - Device context
 * - User behavior patterns
 */

const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

class ContextAwarenessService {
  /**
   * Check if a location-based trigger condition is met
   * @param {Object} trigger - Trigger definition
   * @param {Object} context - Current context with location
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Is trigger condition met
   */
  async checkLocationTrigger(trigger, context, userId) {
    try {
      // Must have location data to proceed
      if (!context.location) return false;
      
      const { latitude, longitude, accuracy } = context.location;
      
      // Check trigger type
      switch (trigger.subtype) {
        case 'enter_location':
          return this.checkLocationEntry(trigger.location, latitude, longitude, accuracy, userId);
          
        case 'exit_location':
          return this.checkLocationExit(trigger.location, latitude, longitude, accuracy, userId);
          
        case 'near_location':
          return this.checkNearLocation(trigger.location, latitude, longitude, accuracy, trigger.radius);
          
        default:
          console.warn(`Unknown location trigger subtype: ${trigger.subtype}`);
          return false;
      }
    } catch (error) {
      console.error('Error checking location trigger:', error);
      return false;
    }
  }

  /**
   * Check if user has entered a location
   * @param {string} locationName - Location name
   * @param {number} latitude - Current latitude
   * @param {number} longitude - Current longitude
   * @param {number} accuracy - Location accuracy in meters
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Has user entered location
   */
  async checkLocationEntry(locationName, latitude, longitude, accuracy, userId) {
    try {
      // Get location coordinates
      const location = await this.resolveLocationCoordinates(locationName, userId);
      if (!location) return false;
      
      // Check if close enough to be considered "at" the location
      const distance = this.calculateDistance(
        latitude, 
        longitude,
        location.latitude,
        location.longitude
      );
      
      // Consider someone "at" a location if within (accuracy + 50) meters
      const atLocation = distance <= (accuracy + 50);
      
      // Get previous location state from Redis
      const locationKey = `location:${userId}:${locationName}`;
      const wasAtLocation = await redis.get(locationKey) === 'true';
      
      // Store current state
      await redis.set(locationKey, atLocation ? 'true' : 'false', 'EX', 86400); // 24 hour expiry
      
      // Entry is triggered when previously not at location but now at location
      return atLocation && !wasAtLocation;
    } catch (error) {
      console.error('Error checking location entry:', error);
      return false;
    }
  }

  /**
   * Check if user has exited a location
   * @param {string} locationName - Location name
   * @param {number} latitude - Current latitude
   * @param {number} longitude - Current longitude
   * @param {number} accuracy - Location accuracy in meters
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Has user exited location
   */
  async checkLocationExit(locationName, latitude, longitude, accuracy, userId) {
    try {
      // Get location coordinates
      const location = await this.resolveLocationCoordinates(locationName, userId);
      if (!location) return false;
      
      // Check if close enough to be considered "at" the location
      const distance = this.calculateDistance(
        latitude, 
        longitude,
        location.latitude,
        location.longitude
      );
      
      // Consider someone "at" a location if within (accuracy + 50) meters
      const atLocation = distance <= (accuracy + 50);
      
      // Get previous location state from Redis
      const locationKey = `location:${userId}:${locationName}`;
      const wasAtLocation = await redis.get(locationKey) === 'true';
      
      // Store current state
      await redis.set(locationKey, atLocation ? 'true' : 'false', 'EX', 86400); // 24 hour expiry
      
      // Exit is triggered when previously at location but now not at location
      return !atLocation && wasAtLocation;
    } catch (error) {
      console.error('Error checking location exit:', error);
      return false;
    }
  }

  /**
   * Check if user is near a location
   * @param {string} locationName - Location name
   * @param {number} latitude - Current latitude
   * @param {number} longitude - Current longitude
   * @param {number} accuracy - Location accuracy in meters
   * @param {number} radius - Radius in meters
   * @returns {Promise<boolean>} - Is user near location
   */
  async checkNearLocation(locationName, latitude, longitude, accuracy, radius = 500) {
    try {
      // Get location coordinates
      const location = await this.resolveLocationCoordinates(locationName);
      if (!location) return false;
      
      // Check if within the specified radius
      const distance = this.calculateDistance(
        latitude, 
        longitude,
        location.latitude,
        location.longitude
      );
      
      return distance <= (radius + accuracy);
    } catch (error) {
      console.error('Error checking near location:', error);
      return false;
    }
  }

  /**
   * Resolve a location name to coordinates
   * @param {string} locationName - Location name (e.g., "home", "work")
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - Location coordinates or null
   */
  async resolveLocationCoordinates(locationName, userId) {
    try {
      // First check if this is a saved user location
      const { data: userLocation, error } = await supabase
        .from('user_locations')
        .select('latitude, longitude')
        .eq('user_id', userId)
        .ilike('name', locationName)
        .single();
      
      if (!error && userLocation) {
        return {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        };
      }
      
      // If not a saved location, check geocode cache
      const { data: geocodeData, error: geocodeError } = await supabase
        .from('geocode_cache')
        .select('latitude, longitude')
        .ilike('address', locationName)
        .single();
      
      if (!geocodeError && geocodeData) {
        return {
          latitude: geocodeData.latitude,
          longitude: geocodeData.longitude
        };
      }
      
      // If not found, return null
      return null;
    } catch (error) {
      console.error('Error resolving location coordinates:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points in meters
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} - Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance between two points
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Angle in degrees
   * @returns {number} - Angle in radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if a time-based trigger condition is met
   * @param {Object} trigger - Trigger definition
   * @param {Object} context - Current context
   * @returns {Promise<boolean>} - Is trigger condition met
   */
  async checkTimeTrigger(trigger, context) {
    try {
      const now = new Date();
      
      // Check trigger subtype
      switch (trigger.subtype) {
        case 'specific_time':
          return this.checkSpecificTime(trigger.time, now);
          
        case 'time_range':
          return this.checkTimeRange(trigger.startTime, trigger.endTime, now);
          
        case 'recurring':
          return this.checkRecurringTime(trigger.schedule, trigger.time, now);
          
        case 'relative_time':
          return this.checkRelativeTime(trigger.reference, trigger.offset, now, context);
          
        default:
          console.warn(`Unknown time trigger subtype: ${trigger.subtype}`);
          return false;
      }
    } catch (error) {
      console.error('Error checking time trigger:', error);
      return false;
    }
  }

  /**
   * Check if the current time matches a specific time
   * @param {string} targetTime - Target time in HH:MM format
   * @param {Date} now - Current date/time
   * @returns {boolean} - Does current time match target
   */
  checkSpecificTime(targetTime, now) {
    try {
      // Parse target time
      const [targetHour, targetMinute] = targetTime.split(':').map(Number);
      
      // Get current time components
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Consider a match if within 1 minute of target time
      return currentHour === targetHour && 
             Math.abs(currentMinute - targetMinute) <= 1;
    } catch (error) {
      console.error('Error checking specific time:', error);
      return false;
    }
  }

  /**
   * Check if the current time is within a time range
   * @param {string} startTime - Start time in HH:MM format
   * @param {string} endTime - End time in HH:MM format
   * @param {Date} now - Current date/time
   * @returns {boolean} - Is current time within range
   */
  checkTimeRange(startTime, endTime, now) {
    try {
      // Parse start and end times
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      // Convert current time to minutes since midnight
      const currentMinutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      
      // Convert start and end times to minutes since midnight
      const startMinutesSinceMidnight = startHour * 60 + startMinute;
      const endMinutesSinceMidnight = endHour * 60 + endMinute;
      
      // Check if current time is within range
      if (startMinutesSinceMidnight <= endMinutesSinceMidnight) {
        // Simple case: start time is before end time
        return currentMinutesSinceMidnight >= startMinutesSinceMidnight && 
               currentMinutesSinceMidnight <= endMinutesSinceMidnight;
      } else {
        // Wrap-around case: start time is after end time (e.g., 22:00 to 03:00)
        return currentMinutesSinceMidnight >= startMinutesSinceMidnight || 
               currentMinutesSinceMidnight <= endMinutesSinceMidnight;
      }
    } catch (error) {
      console.error('Error checking time range:', error);
      return false;
    }
  }

  /**
   * Check if the current time matches a recurring schedule
   * @param {string} schedule - Schedule type (daily, weekdays, weekends, weekly)
   * @param {string} time - Time in HH:MM format
   * @param {Date} now - Current date/time
   * @returns {boolean} - Does current time match schedule
   */
  checkRecurringTime(schedule, time, now) {
    try {
      // First check if the time matches
      const timeMatches = this.checkSpecificTime(time, now);
      if (!timeMatches) return false;
      
      // Check schedule type
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      switch (schedule) {
        case 'daily':
          return true; // Already checked time above
          
        case 'weekdays':
          return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
          
        case 'weekends':
          return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
          
        case 'weekly':
          // If day parameter is provided, check if current day matches
          if (schedule.day) {
            const dayMap = {
              'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
              'thursday': 4, 'friday': 5, 'saturday': 6
            };
            return dayOfWeek === dayMap[schedule.day.toLowerCase()];
          }
          return false;
          
        case 'monthly':
          // If date parameter is provided, check if current date matches
          if (schedule.date) {
            return now.getDate() === parseInt(schedule.date, 10);
          }
          return false;
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking recurring time:', error);
      return false;
    }
  }

  /**
   * Check if the current time is a specified offset from a reference time
   * @param {string} reference - Reference time type (e.g., 'calendar_event')
   * @param {Object} offset - Time offset
   * @param {Date} now - Current date/time
   * @param {Object} context - Context with reference data
   * @returns {boolean} - Does current time match the relative time
   */
  checkRelativeTime(reference, offset, now, context) {
    try {
      let referenceTime;
      
      // Get reference time based on type
      switch (reference.type) {
        case 'calendar_event':
          // Get start time of referenced calendar event
          if (!context.calendar || !context.calendar.events) return false;
          
          const event = context.calendar.events.find(e => 
            e.id === reference.eventId || e.title === reference.eventTitle
          );
          
          if (!event) return false;
          referenceTime = new Date(event.startTime);
          break;
          
        case 'fixed_datetime':
          // Use a specified fixed datetime as reference
          referenceTime = new Date(reference.datetime);
          break;
          
        default:
          console.warn(`Unknown reference time type: ${reference.type}`);
          return false;
      }
      
      // Apply offset
      const offsetTime = new Date(referenceTime);
      
      if (offset.minutes) {
        offsetTime.setMinutes(offsetTime.getMinutes() + offset.minutes);
      }
      
      if (offset.hours) {
        offsetTime.setHours(offsetTime.getHours() + offset.hours);
      }
      
      if (offset.days) {
        offsetTime.setDate(offsetTime.getDate() + offset.days);
      }
      
      // Check if current time is within 1 minute of the offset time
      const timeDiff = Math.abs(now.getTime() - offsetTime.getTime());
      return timeDiff <= 60000; // 1 minute in milliseconds
    } catch (error) {
      console.error('Error checking relative time:', error);
      return false;
    }
  }

  /**
   * Check if a device context trigger condition is met
   * @param {Object} trigger - Trigger definition
   * @param {Object} context - Current context with device info
   * @returns {boolean} - Is trigger condition met
   */
  checkDeviceTrigger(trigger, context) {
    try {
      // Must have device info to proceed
      if (!context.device) return false;
      
      // Check trigger subtype
      switch (trigger.subtype) {
        case 'device_type':
          return context.device.type === trigger.deviceType;
          
        case 'platform':
          return context.device.platform === trigger.platform;
          
        case 'network_type':
          return context.device.networkType === trigger.networkType;
          
        case 'battery_status':
          if (!context.device.battery) return false;
          
          if (trigger.batteryLevel) {
            if (trigger.batteryLevel.type === 'below') {
              return context.device.battery.level < trigger.batteryLevel.value;
            } else if (trigger.batteryLevel.type === 'above') {
              return context.device.battery.level > trigger.batteryLevel.value;
            }
          }
          
          if (trigger.chargingState) {
            return context.device.battery.charging === (trigger.chargingState === 'charging');
          }
          
          return false;
          
        default:
          console.warn(`Unknown device trigger subtype: ${trigger.subtype}`);
          return false;
      }
    } catch (error) {
      console.error('Error checking device trigger:', error);
      return false;
    }
  }

  /**
   * Check if a behavioral pattern trigger condition is met
   * @param {Object} trigger - Trigger definition
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Is trigger condition met
   */
  async checkBehavioralTrigger(trigger, userId) {
    try {
      // Check trigger subtype
      switch (trigger.subtype) {
        case 'usage_pattern':
          return this.checkUsagePattern(trigger.pattern, userId);
          
        case 'frequency_threshold':
          return this.checkFrequencyThreshold(
            trigger.actionType, 
            trigger.threshold, 
            trigger.timeWindow,
            userId
          );
          
        case 'sequence_detection':
          return this.checkActionSequence(
            trigger.sequence,
            trigger.timeWindow,
            userId
          );
          
        default:
          console.warn(`Unknown behavioral trigger subtype: ${trigger.subtype}`);
          return false;
      }
    } catch (error) {
      console.error('Error checking behavioral trigger:', error);
      return false;
    }
  }

  /**
   * Check if current usage matches a detected pattern
   * @param {string} pattern - Pattern type
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Does usage match pattern
   */
  async checkUsagePattern(pattern, userId) {
    try {
      // Get user behavior patterns
      const { data: patterns, error } = await supabase
        .from('user_behavior_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('pattern_type', pattern)
        .single();
      
      if (error || !patterns) {
        return false;
      }
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentDayOfWeek = now.getDay();
      
      // Check if current time is within pattern
      switch (pattern) {
        case 'daily_active_hours':
          return patterns.pattern_data.active_hours.includes(currentHour);
          
        case 'weekly_active_days':
          return patterns.pattern_data.active_days.includes(currentDayOfWeek);
          
        case 'common_action_time':
          if (!patterns.pattern_data.actions) return false;
          
          // Check if there's typically activity at this hour
          const hourActivity = patterns.pattern_data.actions
            .filter(a => a.hour === currentHour)
            .reduce((sum, a) => sum + a.count, 0);
            
          // Consider it a match if there are typically at least 3 actions at this hour
          return hourActivity >= 3;
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking usage pattern:', error);
      return false;
    }
  }

  /**
   * Check if an action frequency exceeds a threshold
   * @param {string} actionType - Type of action to check
   * @param {number} threshold - Threshold count
   * @param {string} timeWindow - Time window (e.g., '1h', '24h', '7d')
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Does frequency exceed threshold
   */
  async checkFrequencyThreshold(actionType, threshold, timeWindow, userId) {
    try {
      // Parse time window
      const windowMatch = timeWindow.match(/^(\d+)([hd])$/);
      if (!windowMatch) return false;
      
      const [_, value, unit] = windowMatch;
      const windowHours = unit === 'h' ? parseInt(value, 10) : parseInt(value, 10) * 24;
      
      // Calculate time boundary
      const now = new Date();
      const timeAgo = new Date(now);
      timeAgo.setHours(timeAgo.getHours() - windowHours);
      
      // Count actions within time window
      const { data, error } = await supabase
        .from('analytics_events')
        .select('count')
        .eq('user_id', userId)
        .eq('event_type', actionType)
        .gte('timestamp', timeAgo.toISOString())
        .execute();
      
      if (error) {
        console.error('Error counting events:', error);
        return false;
      }
      
      const count = data[0]?.count || 0;
      return count >= threshold;
    } catch (error) {
      console.error('Error checking frequency threshold:', error);
      return false;
    }
  }

  /**
   * Check if a sequence of actions has occurred
   * @param {Array} sequence - Sequence of action types
   * @param {string} timeWindow - Time window (e.g., '1h', '24h')
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Has sequence occurred
   */
  async checkActionSequence(sequence, timeWindow, userId) {
    try {
      // Parse time window
      const windowMatch = timeWindow.match(/^(\d+)([hd])$/);
      if (!windowMatch) return false;
      
      const [_, value, unit] = windowMatch;
      const windowHours = unit === 'h' ? parseInt(value, 10) : parseInt(value, 10) * 24;
      
      // Calculate time boundary
      const now = new Date();
      const timeAgo = new Date(now);
      timeAgo.setHours(timeAgo.getHours() - windowHours);
      
      // Get recent events
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_type, timestamp')
        .eq('user_id', userId)
        .gte('timestamp', timeAgo.toISOString())
        .order('timestamp', { ascending: true });
      
      if (error) {
        console.error('Error getting events:', error);
        return false;
      }
      
      // Check for the sequence
      if (!data || data.length < sequence.length) return false;
      
      // Create array of just event types
      const eventTypes = data.map(e => e.event_type);
      
      // Check if sequence exists within the events
      for (let i = 0; i <= eventTypes.length - sequence.length; i++) {
        let matchesSequence = true;
        
        for (let j = 0; j < sequence.length; j++) {
          if (eventTypes[i + j] !== sequence[j]) {
            matchesSequence = false;
            break;
          }
        }
        
        if (matchesSequence) return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking action sequence:', error);
      return false;
    }
  }

  /**
   * Create a new user location
   * @param {string} userId - User ID
   * @param {string} name - Location name
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {string} address - Address (optional)
   * @returns {Promise<Object>} - Created location
   */
  async createUserLocation(userId, name, latitude, longitude, address = null) {
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .insert({
          user_id: userId,
          name,
          latitude,
          longitude,
          address,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error creating user location:', error);
      throw error;
    }
  }

  /**
   * Update user behavior patterns based on new activity
   * @param {string} userId - User ID
   * @param {string} activityType - Type of activity
   * @param {Date} timestamp - Activity timestamp
   * @returns {Promise<void>}
   */
  async updateUserBehaviorPatterns(userId, activityType, timestamp = new Date()) {
    try {
      // Get existing patterns or create new records
      const { data: existingPatterns, error } = await supabase
        .from('user_behavior_patterns')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        throw error;
      }
      
      // Extract hour and day of week
      const hour = timestamp.getHours();
      const dayOfWeek = timestamp.getDay();
      
      // Update daily active hours pattern
      const dailyActivePattern = existingPatterns?.find(p => p.pattern_type === 'daily_active_hours');
      
      if (dailyActivePattern) {
        // Update existing pattern
        const activeHours = new Set(dailyActivePattern.pattern_data.active_hours || []);
        activeHours.add(hour);
        
        await supabase
          .from('user_behavior_patterns')
          .update({
            pattern_data: {
              ...dailyActivePattern.pattern_data,
              active_hours: [...activeHours]
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', dailyActivePattern.id);
      } else {
        // Create new pattern
        await supabase
          .from('user_behavior_patterns')
          .insert({
            user_id: userId,
            pattern_type: 'daily_active_hours',
            pattern_data: {
              active_hours: [hour]
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
      
      // Update weekly active days pattern
      const weeklyActivePattern = existingPatterns?.find(p => p.pattern_type === 'weekly_active_days');
      
      if (weeklyActivePattern) {
        // Update existing pattern
        const activeDays = new Set(weeklyActivePattern.pattern_data.active_days || []);
        activeDays.add(dayOfWeek);
        
        await supabase
          .from('user_behavior_patterns')
          .update({
            pattern_data: {
              ...weeklyActivePattern.pattern_data,
              active_days: [...activeDays]
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', weeklyActivePattern.id);
      } else {
        // Create new pattern
        await supabase
          .from('user_behavior_patterns')
          .insert({
            user_id: userId,
            pattern_type: 'weekly_active_days',
            pattern_data: {
              active_days: [dayOfWeek]
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
      
      // Update common action time pattern
      const actionTimePattern = existingPatterns?.find(p => p.pattern_type === 'common_action_time');
      
      if (actionTimePattern) {
        // Update existing pattern
        const actions = actionTimePattern.pattern_data.actions || [];
        const existingActionForHour = actions.find(a => 
          a.action_type === activityType && a.hour === hour
        );
        
        if (existingActionForHour) {
          existingActionForHour.count += 1;
          existingActionForHour.last_seen = timestamp.toISOString();
        } else {
          actions.push({
            action_type: activityType,
            hour,
            count: 1,
            last_seen: timestamp.toISOString()
          });
        }
        
        await supabase
          .from('user_behavior_patterns')
          .update({
            pattern_data: {
              ...actionTimePattern.pattern_data,
              actions
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', actionTimePattern.id);
      } else {
        // Create new pattern
        await supabase
          .from('user_behavior_patterns')
          .insert({
            user_id: userId,
            pattern_type: 'common_action_time',
            pattern_data: {
              actions: [{
                action_type: activityType,
                hour,
                count: 1,
                last_seen: timestamp.toISOString()
              }]
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error updating user behavior patterns:', error);
    }
  }
}

module.exports = new ContextAwarenessService();
