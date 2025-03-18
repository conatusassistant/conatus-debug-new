// backend/api/routes/integrations.js
/**
 * Integration API Endpoints
 * 
 * Handles connecting and managing third-party service integrations
 * through OAuth flows and other authentication mechanisms.
 */

const express = require('express');
const router = express.Router();
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');

// Import services
const OAuthService = require('../../services/oauth/OAuthService');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * @route GET /api/v1/integrations
 * @description Get all available and connected services
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all supported services
    const supportedServices = OAuthService.getSupportedServices();
    
    // Get user's connected services
    const userConnections = await OAuthService.getUserConnections(userId);
    
    // Map of connected services for quick lookup
    const connectedServicesMap = userConnections.reduce((map, connection) => {
      map[connection.id] = connection;
      return map;
    }, {});
    
    // Combine the data
    const services = supportedServices.map(service => ({
      ...service,
      connected: !!connectedServicesMap[service.id],
      connection: connectedServicesMap[service.id] || null
    }));
    
    // Group services by category
    const categorizedServices = services.reduce((result, service) => {
      const category = service.category || 'Other';
      
      if (!result[category]) {
        result[category] = [];
      }
      
      result[category].push(service);
      return result;
    }, {});
    
    res.json({
      categories: Object.keys(categorizedServices),
      services: categorizedServices
    });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations', message: error.message });
  }
});

/**
 * @route POST /api/v1/integrations/:service/auth
 * @description Initiate OAuth flow for a service
 * @access Private
 */
router.post('/:service/auth', async (req, res) => {
  try {
    const userId = req.user.id;
    const serviceId = req.params.service;
    
    // Validate service ID
    try {
      OAuthService.getServiceConfig(serviceId);
    } catch (error) {
      return res.status(400).json({ error: `Service ${serviceId} not supported` });
    }
    
    // Base redirect URI from environment
    const baseRedirectUri = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseRedirectUri}/api/v1/integrations/${serviceId}/callback`;
    
    // Generate authorization URL
    const { authUrl, state } = await OAuthService.generateAuthUrl(serviceId, userId, redirectUri);
    
    res.json({ authUrl, state });
  } catch (error) {
    console.error(`Error initiating OAuth for ${req.params.service}:`, error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow', message: error.message });
  }
});

/**
 * @route GET /api/v1/integrations/:service/callback
 * @description Handle OAuth callback from service provider
 * @access Public (but validates state parameter)
 */
router.get('/:service/callback', async (req, res) => {
  try {
    const serviceId = req.params.service;
    const { code, state, error: oauthError } = req.query;
    
    // Check for OAuth errors
    if (oauthError) {
      return res.status(400).json({ error: 'OAuth error', message: oauthError });
    }
    
    // Validate required parameters
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Base redirect URI
    const baseRedirectUri = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseRedirectUri}/api/v1/integrations/${serviceId}/callback`;
    
    // Handle the callback
    const result = await OAuthService.handleCallback(serviceId, code, state, redirectUri);
    
    // Redirect to a success page with post-message script
    // This will communicate the success back to the opener window
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Successful</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
            .success { color: #4caf50; }
            .container { max-width: 600px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">Connection Successful!</h1>
            <p>You have successfully connected ${result.serviceName}.</p>
            <p>You can close this window and return to Conatus.</p>
          </div>
          <script>
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              service: '${serviceId}',
              state: '${state}',
              result: ${JSON.stringify(result)}
            }, '*');
            
            // Close the window after a short delay
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error(`Error handling OAuth callback for ${req.params.service}:`, error);
    
    // Return an error page with post-message script
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
            .error { color: #f44336; }
            .container { max-width: 600px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Connection Failed</h1>
            <p>There was an error connecting to the service: ${error.message}</p>
            <p>You can close this window and try again.</p>
          </div>
          <script>
            window.opener.postMessage({
              type: 'OAUTH_ERROR',
              service: '${req.params.service}',
              error: '${error.message.replace(/'/g, "\\'")}'
            }, '*');
            
            // Close the window after a short delay
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * @route POST /api/v1/integrations/:service/callback
 * @description Handle OAuth callback from frontend
 * @access Private
 */
router.post('/:service/callback', async (req, res) => {
  try {
    const userId = req.user.id;
    const serviceId = req.params.service;
    const { code, state } = req.body;
    
    // Validate required parameters
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Base redirect URI
    const baseRedirectUri = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseRedirectUri}/api/v1/integrations/${serviceId}/callback`;
    
    // Handle the callback
    const result = await OAuthService.handleCallback(serviceId, code, state, redirectUri);
    
    // Verify the user ID matches
    if (result.userId !== userId) {
      return res.status(403).json({ error: 'User ID mismatch' });
    }
    
    res.json(result);
  } catch (error) {
    console.error(`Error handling OAuth callback for ${req.params.service}:`, error);
    res.status(500).json({ error: 'Failed to complete OAuth flow', message: error.message });
  }
});

/**
 * @route DELETE /api/v1/integrations/:service
 * @description Disconnect a service
 * @access Private
 */
router.delete('/:service', async (req, res) => {
  try {
    const userId = req.user.id;
    const serviceId = req.params.service;
    
    // Disconnect the service
    await OAuthService.disconnectService(userId, serviceId);
    
    res.json({ success: true, message: `Successfully disconnected ${serviceId}` });
  } catch (error) {
    console.error(`Error disconnecting ${req.params.service}:`, error);
    res.status(500).json({ error: 'Failed to disconnect service', message: error.message });
  }
});

/**
 * @route GET /api/v1/integrations/:service/status
 * @description Check connection status for a service
 * @access Private
 */
router.get('/:service/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const serviceId = req.params.service;
    
    // Check if service is connected
    const isConnected = await OAuthService.isServiceConnected(userId, serviceId);
    
    res.json({ connected: isConnected });
  } catch (error) {
    console.error(`Error checking status for ${req.params.service}:`, error);
    res.status(500).json({ error: 'Failed to check service status', message: error.message });
  }
});

/**
 * @route GET /api/v1/integrations/:service/test
 * @description Test a service connection
 * @access Private
 */
router.get('/:service/test', async (req, res) => {
  try {
    const userId = req.user.id;
    const serviceId = req.params.service;
    
    // Check if service is connected
    const isConnected = await OAuthService.isServiceConnected(userId, serviceId);
    
    if (!isConnected) {
      return res.status(400).json({ error: 'Service not connected' });
    }
    
    // Get access token (will refresh if needed)
    const accessToken = await OAuthService.getAccessToken(userId, serviceId);
    
    // Test the connection by fetching user profile
    const profile = await OAuthService.getUserProfile(serviceId, accessToken);
    
    res.json({
      working: !!profile,
      profile,
      service: serviceId
    });
  } catch (error) {
    console.error(`Error testing connection for ${req.params.service}:`, error);
    res.status(500).json({ error: 'Connection test failed', message: error.message });
  }
});

module.exports = router;
