// backend/services/connectors/WhatsAppConnector.js
/**
 * WhatsApp Connector
 * 
 * Handles interactions with the WhatsApp Business API.
 * Note: Using WhatsApp requires business verification with Meta.
 */

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const dayjs = require('dayjs');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

class WhatsAppConnector {
  constructor() {
    this.apiUrl = 'https://graph.facebook.com/v17.0';
    this.phoneNumberCache = {};
  }

  /**
   * Send a WhatsApp message
   * @param {string} accessToken - Facebook access token
   * @param {string} recipient - Recipient name or phone number
   * @param {string} content - Message content
   * @param {string} scheduledTime - Time to send the message (optional)
   * @returns {Promise<Object>} - Send result
   */
  async sendMessage(accessToken, recipient, content, scheduledTime = 'now') {
    try {
      // Check if we need to schedule the message
      if (scheduledTime && scheduledTime !== 'now') {
        return this.scheduleMessage(accessToken, recipient, content, scheduledTime);
      }
      
      // Get WhatsApp Business Account ID from Redis cache or config
      const wabaid = await this.getWABAID(accessToken);
      
      // Get phone number ID for the business
      const phoneNumberId = await this.getPhoneNumberId(accessToken, wabaid);
      
      // Get recipient phone number
      const recipientPhone = await this.resolveRecipientPhone(recipient, accessToken);
      
      // Prepare message payload
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: {
          body: content
        }
      };
      
      // Send the message
      const response = await fetch(`${this.apiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        messageId: result.messages[0].id,
        recipient: recipientPhone,
        content,
        status: 'sent',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Schedule a WhatsApp message for later
   * @param {string} accessToken - Facebook access token
   * @param {string} recipient - Recipient name or phone number
   * @param {string} content - Message content
   * @param {string} scheduledTime - When to send the message
   * @returns {Promise<Object>} - Schedule result
   */
  async scheduleMessage(accessToken, recipient, content, scheduledTime) {
    try {
      // Note: WhatsApp Business API doesn't natively support scheduling
      // We'll implement our own scheduling using Redis and a worker
      
      // Parse the scheduled time
      const scheduledDate = this.parseScheduledTime(scheduledTime);
      
      if (!scheduledDate || scheduledDate < new Date()) {
        throw new Error('Invalid scheduled time. Please provide a future time.');
      }
      
      // Get recipient phone number
      const recipientPhone = await this.resolveRecipientPhone(recipient, accessToken);
      
      // Generate a unique ID for this scheduled message
      const messageId = `whatsapp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Store the scheduled message in Supabase
      await supabase.from('scheduled_messages').insert({
        id: messageId,
        service: 'whatsapp',
        recipient: recipientPhone,
        content,
        scheduled_at: scheduledDate.toISOString(),
        access_token: accessToken, // Note: In production, encrypt this
        status: 'scheduled'
      });
      
      // Schedule the job in Redis
      // We'll create a sorted set with the timestamp as score
      const timestamp = scheduledDate.getTime();
      await redis.zadd('scheduled_messages', timestamp, messageId);
      
      return {
        messageId,
        recipient: recipientPhone,
        content,
        scheduledAt: scheduledDate.toISOString(),
        status: 'scheduled'
      };
    } catch (error) {
      console.error('Error scheduling WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Resolve a recipient name to a phone number
   * @param {string} recipient - Name or phone number
   * @param {string} accessToken - Access token for API calls
   * @returns {Promise<string>} - Phone number
   */
  async resolveRecipientPhone(recipient, accessToken) {
    try {
      // If recipient is already a phone number, validate and return
      if (/^\+?[0-9]{10,15}$/.test(recipient.replace(/[\s-]/g, ''))) {
        // Format to E.164 format (required by WhatsApp API)
        let phone = recipient.replace(/[\s-]/g, '');
        if (!phone.startsWith('+')) {
          phone = `+${phone}`;
        }
        return phone;
      }
      
      // Otherwise, we need to look up the contact
      // This would typically be integrated with a contacts API or database
      
      // For demonstration, we'll check if we have this recipient in our database
      const { data, error } = await supabase
        .from('contacts')
        .select('phone')
        .ilike('name', `%${recipient}%`)
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        return data[0].phone;
      }
      
      // If we couldn't find the contact, throw an error
      throw new Error(`Could not find phone number for contact: ${recipient}`);
    } catch (error) {
      console.error('Error resolving recipient phone:', error);
      throw error;
    }
  }

  /**
   * Get WhatsApp Business Account ID
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<string>} - WABA ID
   */
  async getWABAID(accessToken) {
    try {
      // Check cache first
      const cachedId = await redis.get('whatsapp:wabaid');
      if (cachedId) {
        return cachedId;
      }
      
      // If not in cache, fetch from API
      const response = await fetch(`${this.apiUrl}/me/whatsapp_business_account`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get WhatsApp Business Account: ${response.statusText}`);
      }
      
      const data = await response.json();
      const wabaid = data.data[0].id;
      
      // Cache for 1 day
      await redis.set('whatsapp:wabaid', wabaid, 'EX', 86400);
      
      return wabaid;
    } catch (error) {
      console.error('Error getting WhatsApp Business Account ID:', error);
      // Fallback to environment variable
      return process.env.WHATSAPP_WABA_ID;
    }
  }

  /**
   * Get phone number ID for the business
   * @param {string} accessToken - Facebook access token
   * @param {string} wabaid - WhatsApp Business Account ID
   * @returns {Promise<string>} - Phone number ID
   */
  async getPhoneNumberId(accessToken, wabaid) {
    try {
      // Check cache first
      const cachedId = await redis.get('whatsapp:phoneid');
      if (cachedId) {
        return cachedId;
      }
      
      // If not in cache, fetch from API
      const response = await fetch(`${this.apiUrl}/${wabaid}/phone_numbers`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get phone numbers: ${response.statusText}`);
      }
      
      const data = await response.json();
      const phoneId = data.data[0].id;
      
      // Cache for 1 day
      await redis.set('whatsapp:phoneid', phoneId, 'EX', 86400);
      
      return phoneId;
    } catch (error) {
      console.error('Error getting phone number ID:', error);
      // Fallback to environment variable
      return process.env.WHATSAPP_PHONE_NUMBER_ID;
    }
  }

  /**
   * Parse a scheduled time string into a Date object
   * @param {string} timeString - Time string (e.g., "tomorrow at 3pm")
   * @returns {Date|null} - Parsed date or null if invalid
   */
  parseScheduledTime(timeString) {
    try {
      if (!timeString) return null;
      
      const now = new Date();
      
      // Handle some common natural language time expressions
      if (timeString.toLowerCase() === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // Default to 9am
        return tomorrow;
      }
      
      if (timeString.toLowerCase().includes('tomorrow')) {
        // Try to extract time from string like "tomorrow at 3pm"
        const timeMatch = timeString.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const isPM = timeMatch[3] && timeMatch[3].toLowerCase() === 'pm';
          
          tomorrow.setHours(
            isPM ? (hours === 12 ? 12 : hours + 12) : (hours === 12 ? 0 : hours),
            minutes,
            0,
            0
          );
        } else {
          // Default to 9am
          tomorrow.setHours(9, 0, 0, 0);
        }
        
        return tomorrow;
      }
      
      // Use dayjs for more complex date parsing
      const parsedDate = dayjs(timeString);
      if (parsedDate.isValid()) {
        return parsedDate.toDate();
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing scheduled time:', error);
      return null;
    }
  }
}

module.exports = new WhatsAppConnector();

// backend/services/connectors/GmailConnector.js
/**
 * Gmail Connector
 * 
 * Handles interactions with the Gmail API.
 */

const fetch = require('node-fetch');
const { google } = require('googleapis');
const dayjs = require('dayjs');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

class GmailConnector {
  /**
   * Send an email via Gmail
   * @param {string} accessToken - Google access token
   * @param {string} recipient - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} content - Email body
   * @param {string} scheduledTime - When to send the email (optional)
   * @returns {Promise<Object>} - Send result
   */
  async sendEmail(accessToken, recipient, subject, content, scheduledTime = 'now') {
    try {
      // Check if we need to schedule the email
      if (scheduledTime && scheduledTime !== 'now') {
        return this.scheduleEmail(accessToken, recipient, subject, content, scheduledTime);
      }
      
      // Initialize Gmail API
      const gmail = google.gmail({
        version: 'v1',
        auth: {
          credentials: {
            access_token: accessToken
          }
        }
      });
      
      // Validate recipient email
      if (!this.validateEmail(recipient)) {
        throw new Error(`Invalid email address: ${recipient}`);
      }
      
      // Create email content in RFC 2822 format
      const emailLines = [
        `To: ${recipient}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        content
      ];
      
      const email = emailLines.join('\r\n').trim();
      
      // Encode the email in base64url format
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      // Send the email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });
      
      return {
        messageId: response.data.id,
        recipient,
        subject,
        status: 'sent',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending Gmail message:', error);
      throw error;
    }
  }

  /**
   * Schedule an email for later
   * @param {string} accessToken - Google access token
   * @param {string} recipient - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} content - Email body
   * @param {string} scheduledTime - When to send the email
   * @returns {Promise<Object>} - Schedule result
   */
  async scheduleEmail(accessToken, recipient, subject, content, scheduledTime) {
    try {
      // Parse the scheduled time
      const scheduledDate = this.parseScheduledTime(scheduledTime);
      
      if (!scheduledDate || scheduledDate < new Date()) {
        throw new Error('Invalid scheduled time. Please provide a future time.');
      }
      
      // Validate recipient email
      if (!this.validateEmail(recipient)) {
        throw new Error(`Invalid email address: ${recipient}`);
      }
      
      // Generate a unique ID for this scheduled email
      const messageId = `gmail_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Store the scheduled email in Supabase
      await supabase.from('scheduled_messages').insert({
        id: messageId,
        service: 'gmail',
        recipient,
        subject,
        content,
        scheduled_at: scheduledDate.toISOString(),
        access_token: accessToken, // Note: In production, encrypt this
        status: 'scheduled'
      });
      
      // Schedule the job in Redis
      // We'll create a sorted set with the timestamp as score
      const timestamp = scheduledDate.getTime();
      await redis.zadd('scheduled_messages', timestamp, messageId);
      
      return {
        messageId,
        recipient,
        subject,
        scheduledAt: scheduledDate.toISOString(),
        status: 'scheduled'
      };
    } catch (error) {
      console.error('Error scheduling Gmail message:', error);
      throw error;
    }
  }

  /**
   * Validate an email address
   * @param {string} email - Email address to validate
   * @returns {boolean} - Is valid email
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Parse a scheduled time string into a Date object
   * @param {string} timeString - Time string (e.g., "tomorrow at 3pm")
   * @returns {Date|null} - Parsed date or null if invalid
   */
  parseScheduledTime(timeString) {
    try {
      if (!timeString) return null;
      
      const now = new Date();
      
      // Handle some common natural language time expressions
      if (timeString.toLowerCase() === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // Default to 9am
        return tomorrow;
      }
      
      if (timeString.toLowerCase().includes('tomorrow')) {
        // Try to extract time from string like "tomorrow at 3pm"
        const timeMatch = timeString.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const isPM = timeMatch[3] && timeMatch[3].toLowerCase() === 'pm';
          
          tomorrow.setHours(
            isPM ? (hours === 12 ? 12 : hours + 12) : (hours === 12 ? 0 : hours),
            minutes,
            0,
            0
          );
        } else {
          // Default to 9am
          tomorrow.setHours(9, 0, 0, 0);
        }
        
        return tomorrow;
      }
      
      // Use dayjs for more complex date parsing
      const parsedDate = dayjs(timeString);
      if (parsedDate.isValid()) {
        return parsedDate.toDate();
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing scheduled time:', error);
      return null;
    }
  }
}

module.exports = new GmailConnector();

// backend/services/connectors/UberConnector.js
/**
 * Uber Connector
 * 
 * Handles interactions with the Uber API.
 */

const fetch = require('node-fetch');
const dayjs = require('dayjs');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

class UberConnector {
  constructor() {
    this.apiUrl = 'https://api.uber.com/v1.2';
  }

  /**
   * Book an Uber ride
   * @param {string} accessToken - Uber access token
   * @param {string} pickup - Pickup location
   * @param {string} destination - Destination location
   * @param {string} scheduledTime - When to book the ride (optional)
   * @returns {Promise<Object>} - Booking result
   */
  async bookRide(accessToken, pickup, destination, scheduledTime = 'now') {
    try {
      // Geocode the pickup and destination addresses
      const pickupCoords = await this.geocodeAddress(pickup);
      const destinationCoords = await this.geocodeAddress(destination);
      
      if (!pickupCoords || !destinationCoords) {
        throw new Error('Could not geocode addresses. Please provide valid locations.');
      }
      
      // Determine if this is an immediate or scheduled ride
      const isScheduled = scheduledTime && scheduledTime !== 'now';
      const scheduledDate = isScheduled ? this.parseScheduledTime(scheduledTime) : null;
      
      if (isScheduled && (!scheduledDate || scheduledDate < new Date())) {
        throw new Error('Invalid scheduled time. Please provide a future time.');
      }
      
      // Get fare estimate first
      const estimateResponse = await fetch(`${this.apiUrl}/requests/estimate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          start_latitude: pickupCoords.latitude,
          start_longitude: pickupCoords.longitude,
          end_latitude: destinationCoords.latitude,
          end_longitude: destinationCoords.longitude,
          product_id: 'a1111c8c-c720-46c3-8534-2fcdd730040d' // UberX by default
        })
      });
      
      if (!estimateResponse.ok) {
        const errorData = await estimateResponse.json();
        throw new Error(`Uber API error: ${errorData.message || estimateResponse.statusText}`);
      }
      
      const estimate = await estimateResponse.json();
      
      // Book the ride
      const requestBody = {
        start_latitude: pickupCoords.latitude,
        start_longitude: pickupCoords.longitude,
        end_latitude: destinationCoords.latitude,
        end_longitude: destinationCoords.longitude,
        product_id: 'a1111c8c-c720-46c3-8534-2fcdd730040d', // UberX by default
        fare_id: estimate.fare.fare_id
      };
      
      // Add scheduled time if needed
      if (isScheduled) {
        requestBody.scheduled_at = Math.floor(scheduledDate.getTime() / 1000); // Unix timestamp
      }
      
      const bookingResponse = await fetch(`${this.apiUrl}/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json();
        throw new Error(`Uber API error: ${errorData.message || bookingResponse.statusText}`);
      }
      
      const booking = await bookingResponse.json();
      
      return {
        rideId: booking.request_id,
        status: booking.status,
        estimated_price: `${estimate.fare.currency_code} ${(estimate.fare.value / 100).toFixed(2)}`,
        pickup: pickup,
        destination: destination,
        eta_minutes: estimate.pickup.eta_seconds ? Math.ceil(estimate.pickup.eta_seconds / 60) : null,
        scheduled: isScheduled,
        scheduled_at: isScheduled ? scheduledDate.toISOString() : null
      };
    } catch (error) {
      console.error('Error booking Uber ride:', error);
      throw error;
    }
  }

  /**
   * Geocode an address to coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<Object|null>} - Coordinates or null if not found
   */
  async geocodeAddress(address) {
    try {
      // First check if we have cached this address
      const { data, error } = await supabase
        .from('geocode_cache')
        .select('latitude, longitude')
        .eq('address', address.toLowerCase())
        .single();
      
      if (!error && data) {
        return {
          latitude: data.latitude,
          longitude: data.longitude
        };
      }
      
      // If not in cache, use a geocoding service
      // Here we're using Mapbox Geocoding API as an example
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
        `?access_token=${process.env.MAPBOX_API_KEY}&limit=1`
      );
      
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return null;
      }
      
      const [longitude, latitude] = data.features[0].center;
      
      // Cache this result for future use
      await supabase.from('geocode_cache').insert({
        address: address.toLowerCase(),
        latitude,
        longitude,
        cached_at: new Date().toISOString()
      });
      
      return { latitude, longitude };
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }

  /**
   * Parse a scheduled time string into a Date object
   * @param {string} timeString - Time string (e.g., "tomorrow at 3pm")
   * @returns {Date|null} - Parsed date or null if invalid
   */
  parseScheduledTime(timeString) {
    try {
      if (!timeString) return null;
      
      const now = new Date();
      
      // Handle some common natural language time expressions
      if (timeString.toLowerCase() === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // Default to 9am
        return tomorrow;
      }
      
      if (timeString.toLowerCase().includes('tomorrow')) {
        // Try to extract time from string like "tomorrow at 3pm"
        const timeMatch = timeString.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const isPM = timeMatch[3] && timeMatch[3].toLowerCase() === 'pm';
          
          tomorrow.setHours(
            isPM ? (hours === 12 ? 12 : hours + 12) : (hours === 12 ? 0 : hours),
            minutes,
            0,
            0
          );
        } else {
          // Default to 9am
          tomorrow.setHours(9, 0, 0, 0);
        }
        
        return tomorrow;
      }
      
      // Use dayjs for more complex date parsing
      const parsedDate = dayjs(timeString);
      if (parsedDate.isValid()) {
        return parsedDate.toDate();
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing scheduled time:', error);
      return null;
    }
  }

  /**
   * Get ride status
   * @param {string} accessToken - Uber access token
   * @param {string} rideId - Ride request ID
   * @returns {Promise<Object>} - Ride status
   */
  async getRideStatus(accessToken, rideId) {
    try {
      const response = await fetch(`${this.apiUrl}/requests/${rideId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get ride status: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        rideId: data.request_id,
        status: data.status,
        driver: data.driver ? {
          name: `${data.driver.first_name}`,
          phone: data.driver.phone_number,
          rating: data.driver.rating
        } : null,
        vehicle: data.vehicle ? {
          make: data.vehicle.make,
          model: data.vehicle.model,
          license_plate: data.vehicle.license_plate
        } : null,
        eta_minutes: data.eta ? Math.ceil(data.eta / 60) : null,
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting ride status:', error);
      throw error;
    }
  }

  /**
   * Cancel a ride
   * @param {string} accessToken - Uber access token
   * @param {string} rideId - Ride request ID
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelRide(accessToken, rideId) {
    try {
      const response = await fetch(`${this.apiUrl}/requests/${rideId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel ride: ${response.statusText}`);
      }
      
      return {
        rideId,
        status: 'cancelled',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error cancelling ride:', error);
      throw error;
    }
  }
}

module.exports = new UberConnector();

// backend/services/connectors/SpotifyConnector.js
/**
 * Spotify Connector
 * 
 * Handles interactions with the Spotify API.
 */

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

class SpotifyConnector {
  constructor() {
    this.apiUrl = 'https://api.spotify.com/v1';
  }

  /**
   * Play music on Spotify
   * @param {string} accessToken - Spotify access token
   * @param {string} track - Track name or URI
   * @param {string} artist - Artist name (optional)
   * @returns {Promise<Object>} - Play result
   */
  async playMusic(accessToken, track, artist = '') {
    try {
      // First check if we need to search for the track
      let trackUri = track;
      
      if (!track.startsWith('spotify:track:')) {
        // Need to search for the track
        const query = artist ? `track:${track} artist:${artist}` : track;
        const searchResult = await this.searchTrack(accessToken, query);
        
        if (!searchResult) {
          throw new Error(`Could not find track: ${track}${artist ? ` by ${artist}` : ''}`);
        }
        
        trackUri = searchResult.uri;
      }
      
      // Get available devices
      const devicesResponse = await fetch(`${this.apiUrl}/me/player/devices`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!devicesResponse.ok) {
        throw new Error(`Failed to get devices: ${devicesResponse.statusText}`);
      }
      
      const devicesData = await devicesResponse.json();
      
      // Find an active device
      const activeDevice = devicesData.devices.find(device => device.is_active);
      const targetDeviceId = activeDevice 
        ? activeDevice.id 
        : (devicesData.devices.length > 0 ? devicesData.devices[0].id : null);
      
      if (!targetDeviceId) {
        throw new Error('No available Spotify devices found. Please open Spotify on a device first.');
      }
      
      // Start playback
      const playResponse = await fetch(`${this.apiUrl}/me/player/play?device_id=${targetDeviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [trackUri]
        })
      });
      
      // Check for 204 No Content (success) or error
      if (playResponse.status !== 204 && !playResponse.ok) {
        throw new Error(`Failed to start playback: ${playResponse.statusText}`);
      }
      
      // Get details about the now playing track
      const nowPlayingResponse = await fetch(`${this.apiUrl}/me/player/currently-playing`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      let trackDetails = null;
      
      if (nowPlayingResponse.status === 200) {
        const nowPlayingData = await nowPlayingResponse.json();
        trackDetails = {
          name: nowPlayingData.item.name,
          artist: nowPlayingData.item.artists.map(a => a.name).join(', '),
          album: nowPlayingData.item.album.name,
          duration_ms: nowPlayingData.item.duration_ms,
          cover_art: nowPlayingData.item.album.images[0]?.url
        };
      }
      
      return {
        status: 'playing',
        track: trackDetails || { name: track, artist },
        device: { 
          id: targetDeviceId,
          name: devicesData.devices.find(d => d.id === targetDeviceId)?.name || 'Spotify device'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error playing Spotify music:', error);
      throw error;
    }
  }

  /**
   * Search for a track on Spotify
   * @param {string} accessToken - Spotify access token
   * @param {string} query - Search query
   * @returns {Promise<Object|null>} - Search result or null if not found
   */
  async searchTrack(accessToken, query) {
    try {
      // Check cache first
      const cacheKey = `spotify:search:${query.toLowerCase()}`;
      const cachedResult = await redis.get(cacheKey);
      
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }
      
      // If not in cache, search via API
      const response = await fetch(
        `${this.apiUrl}/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
      
      if (!response.ok) {
        throw new Error(`Failed to search track: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.tracks || data.tracks.items.length === 0) {
        return null;
      }
      
      const track = data.tracks.items[0];
      const result = {
        uri: track.uri,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration_ms: track.duration_ms,
        cover_art: track.album.images[0]?.url
      };
      
      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
      
      return result;
    } catch (error) {
      console.error('Error searching for track:', error);
      return null;
    }
  }

  /**
   * Create a playlist
   * @param {string} accessToken - Spotify access token
   * @param {string} name - Playlist name
   * @param {string} description - Playlist description
   * @returns {Promise<Object>} - Playlist creation result
   */
  async createPlaylist(accessToken, name, description = '') {
    try {
      // Get user ID
      const userResponse = await fetch(`${this.apiUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error(`Failed to get user profile: ${userResponse.statusText}`);
      }
      
      const userData = await userResponse.json();
      const userId = userData.id;
      
      // Create playlist
      const createResponse = await fetch(`${this.apiUrl}/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          public: false
        })
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create playlist: ${createResponse.statusText}`);
      }
      
      const playlistData = await createResponse.json();
      
      return {
        id: playlistData.id,
        name: playlistData.name,
        description: playlistData.description,
        uri: playlistData.uri,
        url: playlistData.external_urls.spotify,
        tracks_count: 0,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw error;
    }
  }

  /**
   * Add tracks to a playlist
   * @param {string} accessToken - Spotify access token
   * @param {string} playlistId - Playlist ID
   * @param {Array<string>} trackUris - Track URIs to add
   * @returns {Promise<Object>} - Add result
   */
  async addToPlaylist(accessToken, playlistId, trackUris) {
    try {
      const response = await fetch(`${this.apiUrl}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: trackUris
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add tracks to playlist: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        playlist_id: playlistId,
        tracks_added: data.snapshot_id ? trackUris.length : 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error adding tracks to playlist:', error);
      throw error;
    }
  }
}

module.exports = new SpotifyConnector();
