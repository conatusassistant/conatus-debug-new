import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../../types/supabase';

// Trigger types
type TriggerType = 'time' | 'event' | 'location' | 'condition';

// Action types
type ActionType = 'send' | 'fetch' | 'create' | 'update' | 'delete' | 'notify' | 'order';

// Interfaces for automation request
interface TriggerConfig {
  [key: string]: any;
}

interface ActionConfig {
  [key: string]: any;
}

interface Trigger {
  type: TriggerType;
  config: TriggerConfig;
}

interface Action {
  type: ActionType;
  service: string;
  config: ActionConfig;
}

interface CreateWorkflowRequest {
  userId: string;
  name: string;
  description?: string;
  trigger: Trigger;
  actions: Action[];
  isActive?: boolean;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Create a new automation workflow
 * 
 * This Lambda function:
 * 1. Receives a workflow configuration from the user
 * 2. Validates the trigger and actions
 * 3. Stores the workflow in the database
 * 4. Returns the created workflow ID
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const requestBody: CreateWorkflowRequest = JSON.parse(event.body);
    const { userId, name, description, trigger, actions, isActive = true } = requestBody;

    // Validate required fields
    if (!userId || !name || !trigger || !actions || actions.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          error: 'Missing required fields',
          details: 'userId, name, trigger, and at least one action are required' 
        })
      };
    }

    // Validate trigger type
    if (!['time', 'event', 'location', 'condition'].includes(trigger.type)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          error: 'Invalid trigger type',
          details: 'Trigger type must be one of: time, event, location, condition'
        })
      };
    }

    // Validate trigger configuration based on type
    const validationError = validateTriggerConfig(trigger);
    if (validationError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          error: 'Invalid trigger configuration',
          details: validationError
        })
      };
    }

    // Validate actions
    for (const action of actions) {
      if (!action.type || !action.service) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
            'Access-Control-Allow-Credentials': true
          },
          body: JSON.stringify({ 
            error: 'Invalid action',
            details: 'Each action must have a type and service'
          })
        };
      }
    }

    // Initialize Supabase client
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Create a new automation
    const automationId = uuidv4();
    
    const { data, error } = await supabase
      .from('automations')
      .insert({
        id: automationId,
        user_id: userId,
        name,
        description: description || null,
        trigger,
        actions,
        is_active: isActive
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating automation:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ 
          error: 'Failed to create automation',
          details: error.message
        })
      };
    }

    // Return the created automation ID
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        id: data.id,
        message: 'Automation created successfully'
      })
    };
    
  } catch (error: any) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

/**
 * Validate trigger configuration based on type
 */
function validateTriggerConfig(trigger: Trigger): string | null {
  const { type, config } = trigger;
  
  switch (type) {
    case 'time':
      // Validate time-based trigger
      if (!config.schedule) {
        return 'Time-based trigger requires a schedule';
      }
      // Basic cron validation (very simplified)
      const cronParts = config.schedule.split(' ');
      if (cronParts.length !== 5) {
        return 'Invalid cron schedule format';
      }
      break;
      
    case 'event':
      // Validate event-based trigger
      if (!config.service) {
        return 'Event-based trigger requires a service name';
      }
      if (!config.event) {
        return 'Event-based trigger requires an event type';
      }
      break;
      
    case 'location':
      // Validate location-based trigger
      if (!config.area) {
        return 'Location-based trigger requires an area name';
      }
      if (!config.event || !['enter', 'exit', 'both'].includes(config.event)) {
        return 'Location-based trigger requires a valid event (enter, exit, or both)';
      }
      break;
      
    case 'condition':
      // Validate condition-based trigger
      if (!config.condition) {
        return 'Condition-based trigger requires a condition type';
      }
      if (!config.operator) {
        return 'Condition-based trigger requires an operator';
      }
      if (config.value === undefined) {
        return 'Condition-based trigger requires a value';
      }
      break;
      
    default:
      return 'Unknown trigger type';
  }
  
  return null;
}
