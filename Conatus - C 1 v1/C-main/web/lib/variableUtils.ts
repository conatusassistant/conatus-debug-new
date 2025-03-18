import { Variable } from '../components/automation/logic';

// Types for supported trigger types
type TriggerType = 'time' | 'event' | 'location';

// Trigger configuration interface (simplified for example)
interface TriggerConfig {
  type: TriggerType;
  // Other properties based on trigger type
  [key: string]: any;
}

/**
 * Gets available variables based on the configured trigger
 * @param triggerConfig - The trigger configuration
 * @returns Array of variables available for this trigger
 */
export const getAvailableVariables = (triggerConfig?: TriggerConfig): Variable[] => {
  const variables: Variable[] = [];
  
  // Add system variables (always available)
  variables.push(
    {
      id: 'current_time',
      name: 'Current Time',
      path: 'system.currentTime',
      valueType: 'dateTime',
      source: 'system',
      description: 'The current time when the condition is evaluated',
      category: 'System'
    },
    {
      id: 'current_date',
      name: 'Current Date',
      path: 'system.currentDate',
      valueType: 'date',
      source: 'system',
      description: 'The current date when the condition is evaluated',
      category: 'System'
    },
    {
      id: 'current_day_of_week',
      name: 'Day of Week',
      path: 'system.dayOfWeek',
      valueType: 'number',
      source: 'system',
      description: 'Current day of week (0 = Sunday, 6 = Saturday)',
      category: 'System'
    },
    {
      id: 'current_hour',
      name: 'Current Hour',
      path: 'system.hour',
      valueType: 'number',
      source: 'system',
      description: 'Current hour (0-23)',
      category: 'System'
    },
    {
      id: 'user_id',
      name: 'User ID',
      path: 'system.user.id',
      valueType: 'string',
      source: 'system',
      description: 'The ID of the current user',
      category: 'User'
    },
    {
      id: 'user_email',
      name: 'User Email',
      path: 'system.user.email',
      valueType: 'string',
      source: 'system',
      description: 'The email address of the current user',
      category: 'User'
    }
  );
  
  // If no trigger config, just return system variables
  if (!triggerConfig) {
    return variables;
  }
  
  // Add trigger-specific variables
  switch (triggerConfig.type) {
    case 'time':
      variables.push(
        {
          id: 'scheduled_time',
          name: 'Scheduled Time',
          path: 'trigger.scheduledTime',
          valueType: 'dateTime',
          source: 'trigger',
          description: 'The scheduled time that triggered this automation',
          category: 'Time Trigger'
        },
        {
          id: 'scheduled_date',
          name: 'Scheduled Date',
          path: 'trigger.scheduledDate',
          valueType: 'date',
          source: 'trigger',
          description: 'The scheduled date that triggered this automation',
          category: 'Time Trigger'
        },
        {
          id: 'trigger_type',
          name: 'Trigger Type',
          path: 'trigger.scheduleType',
          valueType: 'string',
          source: 'trigger',
          description: 'Type of schedule (once, recurring)',
          category: 'Time Trigger'
        }
      );
      break;
      
    case 'event':
      variables.push(
        {
          id: 'event_name',
          name: 'Event Name',
          path: 'trigger.event.name',
          valueType: 'string',
          source: 'trigger',
          description: 'The name of the event that triggered this automation',
          category: 'Event Trigger'
        },
        {
          id: 'event_source',
          name: 'Event Source',
          path: 'trigger.event.source',
          valueType: 'string',
          source: 'trigger',
          description: 'The source of the event (service name)',
          category: 'Event Trigger'
        },
        {
          id: 'event_time',
          name: 'Event Time',
          path: 'trigger.event.time',
          valueType: 'dateTime',
          source: 'trigger',
          description: 'When the event occurred',
          category: 'Event Trigger'
        }
      );
      
      // Add service-specific event data if available
      if (triggerConfig.service) {
        switch (triggerConfig.service) {
          case 'email':
            variables.push(
              {
                id: 'email_subject',
                name: 'Email Subject',
                path: 'trigger.event.data.subject',
                valueType: 'string',
                source: 'trigger',
                description: 'Subject of the received email',
                category: 'Email Event'
              },
              {
                id: 'email_sender',
                name: 'Email Sender',
                path: 'trigger.event.data.from',
                valueType: 'string',
                source: 'trigger',
                description: 'Sender of the email',
                category: 'Email Event'
              },
              {
                id: 'email_body',
                name: 'Email Body',
                path: 'trigger.event.data.body',
                valueType: 'string',
                source: 'trigger',
                description: 'Body content of the email',
                category: 'Email Event'
              }
            );
            break;
            
          case 'calendar':
            variables.push(
              {
                id: 'calendar_event_title',
                name: 'Calendar Event Title',
                path: 'trigger.event.data.title',
                valueType: 'string',
                source: 'trigger',
                description: 'Title of the calendar event',
                category: 'Calendar Event'
              },
              {
                id: 'calendar_event_start',
                name: 'Event Start Time',
                path: 'trigger.event.data.startTime',
                valueType: 'dateTime',
                source: 'trigger',
                description: 'Start time of the calendar event',
                category: 'Calendar Event'
              },
              {
                id: 'calendar_event_end',
                name: 'Event End Time',
                path: 'trigger.event.data.endTime',
                valueType: 'dateTime',
                source: 'trigger',
                description: 'End time of the calendar event',
                category: 'Calendar Event'
              },
              {
                id: 'calendar_event_location',
                name: 'Event Location',
                path: 'trigger.event.data.location',
                valueType: 'string',
                source: 'trigger',
                description: 'Location of the calendar event',
                category: 'Calendar Event'
              }
            );
            break;
        }
      }
      break;
      
    case 'location':
      variables.push(
        {
          id: 'current_latitude',
          name: 'Current Latitude',
          path: 'trigger.location.latitude',
          valueType: 'number',
          source: 'trigger',
          description: 'Current latitude coordinate',
          category: 'Location Trigger'
        },
        {
          id: 'current_longitude',
          name: 'Current Longitude',
          path: 'trigger.location.longitude',
          valueType: 'number',
          source: 'trigger',
          description: 'Current longitude coordinate',
          category: 'Location Trigger'
        },
        {
          id: 'location_name',
          name: 'Location Name',
          path: 'trigger.location.name',
          valueType: 'string',
          source: 'trigger',
          description: 'Name of the current location (if available)',
          category: 'Location Trigger'
        },
        {
          id: 'location_radius',
          name: 'Geofence Radius',
          path: 'trigger.location.radius',
          valueType: 'number',
          source: 'trigger',
          description: 'Radius of the geofence in meters',
          category: 'Location Trigger'
        },
        {
          id: 'location_event',
          name: 'Location Event',
          path: 'trigger.location.event',
          valueType: 'string',
          source: 'trigger',
          description: 'Type of location event (enter, exit, dwell)',
          category: 'Location Trigger'
        }
      );
      break;
  }
  
  return variables;
};
