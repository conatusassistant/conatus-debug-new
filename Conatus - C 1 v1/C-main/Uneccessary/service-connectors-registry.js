// backend/services/connectors/ServiceConnectorsRegistry.js
/**
 * Service Connectors Registry
 * 
 * Centralized registry for all service connectors, providing a unified 
 * access point and metadata about available integrations.
 */

const WhatsAppConnector = require('./WhatsAppConnector');
const GmailConnector = require('./GmailConnector');
const UberConnector = require('./UberConnector');
const DoorDashConnector = require('./DoorDashConnector');
const GoogleCalendarConnector = require('./GoogleCalendarConnector');
const SpotifyConnector = require('./SpotifyConnector');
const VenmoConnector = require('./VenmoConnector');
const MonitoringService = require('../MonitoringService');

class ServiceConnectorsRegistry {
  constructor() {
    // Register all service connectors
    this.connectors = {
      // Communication
      'whatsapp': {
        id: 'whatsapp',
        name: 'WhatsApp',
        category: 'Communication',
        connector: WhatsAppConnector,
        description: 'Send and schedule WhatsApp messages',
        capabilities: ['send_message', 'schedule_message', 'use_templates'],
        setupRequired: true,
        icon: 'whatsapp'
      },
      'gmail': {
        id: 'gmail',
        name: 'Gmail',
        category: 'Communication',
        connector: GmailConnector,
        description: 'Send and schedule emails through Gmail',
        capabilities: ['send_email', 'schedule_email', 'use_templates'],
        setupRequired: true,
        icon: 'gmail'
      },
      
      // Transportation
      'uber': {
        id: 'uber',
        name: 'Uber',
        category: 'Transportation',
        connector: UberConnector,
        description: 'Book and schedule Uber rides',
        capabilities: ['book_ride', 'schedule_ride', 'ride_estimate'],
        setupRequired: true,
        icon: 'uber'
      },
      
      // Food
      'doordash': {
        id: 'doordash',
        name: 'DoorDash',
        category: 'Food',
        connector: DoorDashConnector,
        description: 'Order food from your favorite restaurants',
        capabilities: ['place_order', 'reorder', 'track_order'],
        setupRequired: true,
        icon: 'doordash'
      },
      
      // Productivity
      'google_calendar': {
        id: 'google_calendar',
        name: 'Google Calendar',
        category: 'Productivity',
        connector: GoogleCalendarConnector,
        description: 'Create and manage calendar events',
        capabilities: ['create_event', 'schedule_event', 'list_events'],
        setupRequired: true,
        icon: 'calendar'
      },
      
      // Entertainment
      'spotify': {
        id: 'spotify',
        name: 'Spotify',
        category: 'Entertainment',
        connector: SpotifyConnector,
        description: 'Control music playback and manage playlists',
        capabilities: ['play_music', 'create_playlist', 'search_music'],
        setupRequired: true,
        icon: 'spotify'
      },
      
      // Financial
      'venmo': {
        id: 'venmo',
        name: 'Venmo',
        category: 'Financial',
        connector: VenmoConnector,
        description: 'Send money and manage payments',
        capabilities: ['send_payment', 'request_payment', 'payment_history'],
        setupRequired: true,
        icon: 'venmo'
      }
    };
    
    // Initialize health status for all connectors
    this.healthStatus = {};
    this.initializeHealthChecks();
  }

  /**
   * Get all available service connectors
   * @returns {Object} - Map of all connectors
   */
  getAllConnectors() {
    return this.connectors;
  }

  /**
   * Get all service connectors by category
   * @returns {Object} - Connectors grouped by category
   */
  getConnectorsByCategory() {
    const categorized = {};
    
    Object.values(this.connectors).forEach(connector => {
      if (!categorized[connector.category]) {
        categorized[connector.category] = [];
      }
      
      categorized[connector.category].push({
        id: connector.id,
        name: connector.name,
        description: connector.description,
        capabilities: connector.capabilities,
        setupRequired: connector.setupRequired,
        icon: connector.icon
      });
    });
    
    return categorized;
  }

  /**
   * Get a specific connector
   * @param {string} connectorId - Service connector ID
   * @returns {Object|null} - Connector instance or null if not found
   */
  getConnector(connectorId) {
    const connector = this.connectors[connectorId];
    
    if (!connector) {
      return null;
    }
    
    return connector.connector;
  }

  /**
   * Get metadata for a specific connector
   * @param {string} connectorId - Service connector ID
   * @returns {Object|null} - Connector metadata or null if not found
   */
  getConnectorMetadata(connectorId) {
    const connector = this.connectors[connectorId];
    
    if (!connector) {
      return null;
    }
    
    const { connector: instance, ...metadata } = connector;
    return {
      ...metadata,
      health: this.healthStatus[connectorId] || 'unknown'
    };
  }

  /**
   * Execute an action using the appropriate connector
   * @param {string} connectorId - Service connector ID
   * @param {string} action - Action to execute
   * @param {Object} params - Action parameters
   * @param {string} accessToken - Service access token
   * @returns {Promise<Object>} - Action result
   */
  async executeAction(connectorId, action, params, accessToken) {
    try {
      const connector = this.getConnector(connectorId);
      
      if (!connector) {
        throw new Error(`Service connector not found: ${connectorId}`);
      }
      
      // Create trace for monitoring
      const trace = MonitoringService.createTrace(`${connectorId}.${action}`);
      
      // Check if connector supports the requested action
      if (typeof connector[action] !== 'function') {
        throw new Error(`Action not supported by connector ${connectorId}: ${action}`);
      }
      
      // Execute the action
      const result = await connector[action](accessToken, ...Object.values(params));
      
      // End trace
      trace.end();
      
      return result;
    } catch (error) {
      MonitoringService.error(`Error executing action ${action} with connector ${connectorId}`, error, { params });
      throw error;
    }
  }

  /**
   * Initialize health checks for all connectors
   */
  initializeHealthChecks() {
    // Set up periodic health checks for each connector
    Object.keys(this.connectors).forEach(connectorId => {
      this.updateConnectorHealth(connectorId, 'unknown');
      
      // Start health check if connector has the method
      const connector = this.getConnector(connectorId);
      
      if (connector && typeof connector.checkHealth === 'function') {
        // Register with monitoring service
        MonitoringService.registerHealthCheck(
          `connector.${connectorId}`,
          async () => {
            try {
              const isHealthy = await connector.checkHealth();
              this.updateConnectorHealth(connectorId, isHealthy ? 'healthy' : 'unhealthy');
              return isHealthy;
            } catch (error) {
              this.updateConnectorHealth(connectorId, 'unhealthy');
              return false;
            }
          },
          60000 // 1 minute interval
        );
      }
    });
  }

  /**
   * Update health status for a connector
   * @param {string} connectorId - Service connector ID
   * @param {string} status - Health status (healthy, unhealthy, unknown)
   */
  updateConnectorHealth(connectorId, status) {
    this.healthStatus[connectorId] = status;
  }

  /**
   * Get health status for all connectors
   * @returns {Object} - Health status by connector ID
   */
  getHealthStatus() {
    return this.healthStatus;
  }
}

module.exports = new ServiceConnectorsRegistry();
