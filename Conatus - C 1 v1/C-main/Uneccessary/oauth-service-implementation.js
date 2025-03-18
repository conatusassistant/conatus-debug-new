// backend/services/oauth/OAuthService.js
/**
 * OAuth Service
 * 
 * Manages authentication flows for third-party service integrations.
 * Implements a unified approach to OAuth across different providers.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const Redis = require('ioredis');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

class OAuthService {
  constructor() {
    // Service configurations for OAuth
    this.serviceConfigs = {
      'gmail': {
        name: 'Gmail',
        category: 'Communication',
        authUrl: 'https://accounts.google.com/o/oauth2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
        additionalParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      },
      'whatsapp': {
        name: 'WhatsApp',
        category: 'Communication',
        // WhatsApp Business API details - may require business verification
        authUrl: 'https://www.facebook.com/v15.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v15.0/oauth/access_token',
        clientId: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        scopes: ['whatsapp_business_messaging']
      },
      'doordash': {
        name: 'DoorDash',
        category: 'Food',
        authUrl: 'https://identity.doordash.com/auth/user/authorize',
        tokenUrl: 'https://identity.doordash.com/auth/token',
        clientId: process.env.DOORDASH_CLIENT_ID,
        clientSecret: process.env.DOORDASH_CLIENT_SECRET,
        scopes: ['order_fulfillment', 'order_management']
      },
      'uber': {
        name: 'Uber',
        category: 'Transportation',
        authUrl: 'https://auth.uber.com/oauth/v2/authorize',
        tokenUrl: 'https://auth.uber.com/oauth/v2/token',
        clientId: process.env.UBER_CLIENT_ID,
        clientSecret: process.env.UBER_CLIENT_SECRET,
        scopes: ['request', 'profile', 'history']
      },
      'spotify': {
        name: 'Spotify',
        category: 'Entertainment',
        authUrl: 'https://accounts.spotify.com/authorize',
        tokenUrl: 'https://accounts.spotify.com/api/token',
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        scopes: ['user-read-playback-state', 'user-modify-playback-state', 'playlist-read-private', 'playlist-modify-private']
      },
      'venmo': {
        name: 'Venmo',
        category: 'Financial',
        authUrl: 'https://api.venmo.com/v1/oauth/authorize',
        tokenUrl: 'https://api.venmo.com/v1/oauth/access_token',
        clientId: process.env.VENMO_CLIENT_ID,
        clientSecret: process.env.VENMO_CLIENT_SECRET,
        scopes: ['access_profile', 'access_balance', 'make_payments']
      },
      'google_calendar': {
        name: 'Google Calendar',
        category: 'Productivity',
        authUrl: 'https://accounts.google.com/o/oauth2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
        additionalParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
      // Additional services can be added here
    };
  }

  /**
   * Get a list of all supported services
   * @returns {Array} List of supported services with metadata
   */
  getSupportedServices() {
    return Object.entries(this.serviceConfigs).map(([id, config]) => ({
      id,
      name: config.name,
      category: config.category
    }));
  }

  /**
   * Get service configuration
   * @param {string} serviceId - Service identifier
   * @returns {Object} Service configuration
   */
  getServiceConfig(serviceId) {
    const config = this.serviceConfigs[serviceId];
    if (!config) {
      throw new Error(`Service ${serviceId} not supported`);
    }
    return config;
  }

  /**
   * Generate an authorization URL for a service
   * @param {string} serviceId - Service identifier
   * @param {string} userId - User ID
   * @param {string} redirectUri - Redirect URI after OAuth
   * @returns {Promise<Object>} Authorization URL and state
   */
  async generateAuthUrl(serviceId, userId, redirectUri) {
    try {
      const serviceConfig = this.getServiceConfig(serviceId);
      
      // Generate random state parameter for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');
      
      // Store state in database with expiration
      await supabase
        .from('oauth_states')
        .insert({
          state,
          user_id: userId,
          service: serviceId,
          redirect_uri: redirectUri,
          expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });
      
      // Construct the authorization URL
      const authUrl = new URL(serviceConfig.authUrl);
      
      // Add standard OAuth parameters
      authUrl.searchParams.append('client_id', serviceConfig.clientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', serviceConfig.scopes.join(' '));
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('state', state);
      
      // Add service-specific parameters
      if (serviceConfig.additionalParams) {
        for (const [key, value] of Object.entries(serviceConfig.additionalParams)) {
          authUrl.searchParams.append(key, value);
        }
      }
      
      return {
        authUrl: authUrl.toString(),
        state
      };
    } catch (error) {
      console.error(`Error generating auth URL for ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   * @param {string} serviceId - Service identifier
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} redirectUri - Redirect URI used for auth
   * @returns {Promise<Object>} User ID and service details
   */
  async handleCallback(serviceId, code, state, redirectUri) {
    try {
      // Verify state parameter to prevent CSRF
      const { data: stateData, error: stateError } = await supabase
        .from('oauth_states')
        .select('user_id, redirect_uri')
        .eq('state', state)
        .gt('expires_at', new Date())
        .single();
      
      if (stateError || !stateData) {
        throw new Error('Invalid or expired state parameter');
      }
      
      // Verify redirect URI matches the one used for auth
      if (stateData.redirect_uri !== redirectUri) {
        throw new Error('Redirect URI mismatch');
      }
      
      const userId = stateData.user_id;
      const serviceConfig = this.getServiceConfig(serviceId);
      
      // Exchange code for tokens
      const tokenResponse = await fetch(serviceConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          code,
          client_id: serviceConfig.clientId,
          client_secret: serviceConfig.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        throw new Error(`Token exchange error: ${errorData}`);
      }
      
      const tokens = await tokenResponse.json();
      
      // Store tokens securely in database
      // Note: In production, refresh tokens should be encrypted
      await supabase
        .from('integrations')
        .upsert({
          user_id: userId,
          service_name: serviceId,
          service_category: serviceConfig.category,
          credentials: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in * 1000),
            token_type: tokens.token_type,
            scope: tokens.scope
          },
          connected_at: new Date(),
          updated_at: new Date(),
          status: 'active'
        }, {
          onConflict: 'user_id,service_name'
        });
      
      // Clean up used state
      await supabase
        .from('oauth_states')
        .delete()
        .eq('state', state);
      
      // Attempt to get user profile for verification
      const profileData = await this.getUserProfile(serviceId, tokens.access_token);
      
      return {
        userId,
        serviceId,
        serviceName: serviceConfig.name,
        profile: profileData,
        connected: true
      };
    } catch (error) {
      console.error(`Error handling OAuth callback for ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh access token when expired
   * @param {string} userId - User ID
   * @param {string} serviceId - Service identifier
   * @returns {Promise<Object>} Updated credentials
   */
  async refreshToken(userId, serviceId) {
    try {
      // Get current integration data
      const { data: integration, error } = await supabase
        .from('integrations')
        .select('credentials')
        .eq('user_id', userId)
        .eq('service_name', serviceId)
        .single();
      
      if (error || !integration) {
        throw new Error(`Integration not found for ${serviceId}`);
      }
      
      const { credentials } = integration;
      
      // Check if token is already valid
      if (credentials.expires_at && credentials.expires_at > Date.now() + 60000) {
        return credentials;
      }
      
      const serviceConfig = this.getServiceConfig(serviceId);
      
      // Exchange refresh token for new access token
      const tokenResponse = await fetch(serviceConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          refresh_token: credentials.refresh_token,
          client_id: serviceConfig.clientId,
          client_secret: serviceConfig.clientSecret,
          grant_type: 'refresh_token'
        })
      });
      
      if (!tokenResponse.ok) {
        // If refresh fails, mark the integration as needing reconnection
        await supabase
          .from('integrations')
          .update({
            status: 'expired',
            updated_at: new Date()
          })
          .eq('user_id', userId)
          .eq('service_name', serviceId);
        
        throw new Error(`Token refresh error: ${tokenResponse.status}`);
      }
      
      const tokens = await tokenResponse.json();
      
      // Create new credentials object
      const newCredentials = {
        access_token: tokens.access_token,
        // Some providers don't return a new refresh token, keep the old one in that case
        refresh_token: tokens.refresh_token || credentials.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        token_type: tokens.token_type || credentials.token_type,
        scope: tokens.scope || credentials.scope
      };
      
      // Update tokens in database
      await supabase
        .from('integrations')
        .update({
          credentials: newCredentials,
          updated_at: new Date(),
          status: 'active'
        })
        .eq('user_id', userId)
        .eq('service_name', serviceId);
      
      return newCredentials;
    } catch (error) {
      console.error(`Error refreshing token for ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get a valid access token for a service
   * @param {string} userId - User ID
   * @param {string} serviceId - Service identifier
   * @returns {Promise<string>} Valid access token
   */
  async getAccessToken(userId, serviceId) {
    try {
      // Check token cache first
      const cacheKey = `token:${userId}:${serviceId}`;
      const cachedToken = await redis.get(cacheKey);
      
      if (cachedToken) {
        return cachedToken;
      }
      
      // Get current credentials
      const { data: integration, error } = await supabase
        .from('integrations')
        .select('credentials, status')
        .eq('user_id', userId)
        .eq('service_name', serviceId)
        .single();
      
      if (error || !integration) {
        throw new Error(`Integration not found for ${serviceId}`);
      }
      
      // If integration is marked as expired, force a refresh
      if (integration.status === 'expired') {
        const newCredentials = await this.refreshToken(userId, serviceId);
        
        // Cache the new token
        await redis.set(
          cacheKey, 
          newCredentials.access_token, 
          'EX', 
          Math.floor((newCredentials.expires_at - Date.now()) / 1000) - 300 // 5 minutes before expiry
        );
        
        return newCredentials.access_token;
      }
      
      const { credentials } = integration;
      
      // Check if token is about to expire and refresh if needed
      if (!credentials.expires_at || credentials.expires_at < Date.now() + 300000) { // 5 minutes
        const newCredentials = await this.refreshToken(userId, serviceId);
        
        // Cache the new token
        await redis.set(
          cacheKey, 
          newCredentials.access_token, 
          'EX', 
          Math.floor((newCredentials.expires_at - Date.now()) / 1000) - 300 // 5 minutes before expiry
        );
        
        return newCredentials.access_token;
      }
      
      // Token is valid, cache and return it
      await redis.set(
        cacheKey, 
        credentials.access_token, 
        'EX', 
        Math.floor((credentials.expires_at - Date.now()) / 1000) - 300 // 5 minutes before expiry
      );
      
      return credentials.access_token;
    } catch (error) {
      console.error(`Error getting access token for ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get a user's profile from a service
   * @param {string} serviceId - Service identifier
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(serviceId, accessToken) {
    try {
      // Service-specific profile endpoints
      const profileEndpoints = {
        'gmail': {
          url: 'https://www.googleapis.com/oauth2/v2/userinfo',
          transform: (data) => ({
            id: data.id,
            email: data.email,
            name: data.name,
            picture: data.picture
          })
        },
        'spotify': {
          url: 'https://api.spotify.com/v1/me',
          transform: (data) => ({
            id: data.id,
            email: data.email,
            name: data.display_name,
            picture: data.images?.[0]?.url
          })
        },
        'uber': {
          url: 'https://api.uber.com/v1.2/me',
          transform: (data) => ({
            id: data.uuid,
            email: data.email,
            name: `${data.first_name} ${data.last_name}`,
            picture: null
          })
        }
        // Add profile endpoints for other services
      };
      
      const endpoint = profileEndpoints[serviceId];
      
      // Skip if no profile endpoint defined for this service
      if (!endpoint) {
        return null;
      }
      
      // Call the profile endpoint
      const response = await fetch(endpoint.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`Could not fetch profile for ${serviceId}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      // Transform the response according to service-specific mapping
      return endpoint.transform(data);
    } catch (error) {
      console.error(`Error fetching user profile for ${serviceId}:`, error);
      return null; // Return null rather than failing
    }
  }

  /**
   * Disconnect a service integration
   * @param {string} userId - User ID
   * @param {string} serviceId - Service identifier
   * @returns {Promise<boolean>} Success status
   */
  async disconnectService(userId, serviceId) {
    try {
      // Get current integration data
      const { data: integration, error } = await supabase
        .from('integrations')
        .select('credentials')
        .eq('user_id', userId)
        .eq('service_name', serviceId)
        .single();
      
      if (error || !integration) {
        // Already disconnected
        return true;
      }
      
      // Some services have a revoke endpoint - call it if possible
      const serviceConfig = this.getServiceConfig(serviceId);
      if (serviceConfig.revokeUrl) {
        try {
          await fetch(serviceConfig.revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              token: integration.credentials.access_token,
              client_id: serviceConfig.clientId,
              client_secret: serviceConfig.clientSecret
            })
          });
        } catch (revokeError) {
          console.warn(`Error revoking token for ${serviceId}:`, revokeError);
          // Continue with deletion anyway
        }
      }
      
      // Delete the integration from database
      await supabase
        .from('integrations')
        .delete()
        .eq('user_id', userId)
        .eq('service_name', serviceId);
      
      // Clear token cache
      await redis.del(`token:${userId}:${serviceId}`);
      
      return true;
    } catch (error) {
      console.error(`Error disconnecting service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a service is connected
   * @param {string} userId - User ID
   * @param {string} serviceId - Service identifier
   * @returns {Promise<boolean>} Connection status
   */
  async isServiceConnected(userId, serviceId) {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('status')
        .eq('user_id', userId)
        .eq('service_name', serviceId)
        .single();
      
      if (error || !data) {
        return false;
      }
      
      return data.status === 'active';
    } catch (error) {
      console.error(`Error checking service connection for ${serviceId}:`, error);
      return false;
    }
  }

  /**
   * Get all connected services for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of connected services
   */
  async getUserConnections(userId) {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('service_name, service_category, connected_at, updated_at, status')
        .eq('user_id', userId);
      
      if (error) {
        throw error;
      }
      
      // Enrich with service details
      return data.map(integration => {
        const serviceConfig = this.serviceConfigs[integration.service_name] || {
          name: integration.service_name
        };
        
        return {
          id: integration.service_name,
          name: serviceConfig.name,
          category: integration.service_category,
          connectedAt: integration.connected_at,
          updatedAt: integration.updated_at,
          status: integration.status
        };
      });
    } catch (error) {
      console.error(`Error getting user connections:`, error);
      throw error;
    }
  }
}

module.exports = new OAuthService();
