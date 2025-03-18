// src/pages/settings/SettingsPage.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchConnectedServices, 
  fetchSupportedServices,
  disconnectService
} from '../../store/integrations';
import { signOut } from '../../store/auth';
import ServiceConnectionCard from '../../components/settings/ServiceConnectionCard';
import ServiceConnectionModal from '../../components/settings/ServiceConnectionModal';
import './SettingsPage.css';

const SettingsPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { 
    connectedServices, 
    supportedServices, 
    loading 
  } = useSelector(state => state.integrations);
  
  const [selectedService, setSelectedService] = useState(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Fetch services on mount
  useEffect(() => {
    dispatch(fetchConnectedServices());
    dispatch(fetchSupportedServices());
  }, [dispatch]);
  
  // Group services by category
  const groupServicesByCategory = (services) => {
    return services.reduce((groups, service) => {
      if (!groups[service.category]) {
        groups[service.category] = [];
      }
      
      groups[service.category].push(service);
      return groups;
    }, {});
  };
  
  const connectedServicesByCategory = groupServicesByCategory(connectedServices);
  const supportedServicesByCategory = groupServicesByCategory(supportedServices);
  
  // Handle connecting a service
  const handleConnectService = (service) => {
    setSelectedService(service);
    setShowConnectionModal(true);
  };
  
  // Handle disconnecting a service
  const handleDisconnectService = async (serviceId) => {
    if (window.confirm('Are you sure you want to disconnect this service?')) {
      await dispatch(disconnectService(serviceId));
    }
  };
  
  // Handle signing out
  const handleSignOut = async () => {
    await dispatch(signOut());
  };
  
  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>
      
      <div className="settings-content">
        <section className="settings-section">
          <h2>Account</h2>
          
          <div className="account-info">
            <div className="account-field">
              <span className="field-label">Email:</span>
              <span>{user?.email}</span>
            </div>
            
            <div className="account-actions">
              <button 
                className="sign-out-button"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>
        
        <section className="settings-section">
          <h2>Connected Services</h2>
          
          {loading ? (
            <div className="loading-services">Loading services...</div>
          ) : (
            <>
              {Object.keys(connectedServicesByCategory).length > 0 ? (
                Object.entries(connectedServicesByCategory).map(([category, services]) => (
                  <div key={category} className="service-category">
                    <h3>{category}</h3>
                    <div className="service-cards">
                      {services.map(service => (
                        <ServiceConnectionCard
                          key={service.id}
                          service={service}
                          connected={true}
                          onConnect={() => {}}
                          onDisconnect={() => handleDisconnectService(service.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-services">
                  <p>You haven't connected any services yet.</p>
                </div>
              )}
              
              <div className="available-services">
                <h3>Available Services</h3>
                
                {Object.entries(supportedServicesByCategory).map(([category, services]) => (
                  <div key={category} className="service-category">
                    <h4>{category}</h4>
                    <div className="service-cards">
                      {services
                        .filter(service => !connectedServices.some(cs => cs.id === service.id))
                        .map(service => (
                          <ServiceConnectionCard
                            key={service.id}
                            service={service}
                            connected={false}
                            onConnect={() => handleConnectService(service)}
                            onDisconnect={() => {}}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      
      {showConnectionModal && selectedService && (
        <ServiceConnectionModal
          service={selectedService}
          onClose={() => setShowConnectionModal(false)}
        />
      )}
    </div>
  );
};

export default SettingsPage;

// src/components/settings/ServiceConnectionCard.jsx
import React from 'react';
import './ServiceConnectionCard.css';

// Service icons (simplified)
const serviceIcons = {
  gmail: '📧',
  whatsapp: '💬',
  uber: '🚗',
  google_calendar: '📅',
  spotify: '🎵',
  venmo: '💸',
  doordash: '🍔'
};

// Service display names
const serviceNames = {
  gmail: 'Gmail',
  whatsapp: 'WhatsApp',
  uber: 'Uber',
  google_calendar: 'Google Calendar',
  spotify: 'Spotify',
  venmo: 'Venmo',
  doordash: 'DoorDash'
};

const ServiceConnectionCard = ({ 
  service, 
  connected, 
  onConnect, 
  onDisconnect 
}) => {
  // Format display name
  const displayName = serviceNames[service.id] || service.name;
  
  // Get icon
  const icon = serviceIcons[service.id] || '🔌';
  
  return (
    <div className={`service-card ${connected ? 'connected' : ''}`}>
      <div className="service-icon">{icon}</div>
      
      <div className="service-info">
        <h4>{displayName}</h4>
        <p>{connected ? 'Connected' : 'Not connected'}</p>
      </div>
      
      <div className="service-actions">
        {connected ? (
          <button 
            className="disconnect-button"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        ) : (
          <button 
            className="connect-button"
            onClick={onConnect}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
};

export default ServiceConnectionCard;

// src/components/settings/ServiceConnectionModal.jsx
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { connectService } from '../../store/integrations';
import './ServiceConnectionModal.css';

// Service display names
const serviceNames = {
  gmail: 'Gmail',
  whatsapp: 'WhatsApp',
  uber: 'Uber',
  google_calendar: 'Google Calendar',
  spotify: 'Spotify',
  venmo: 'Venmo',
  doordash: 'DoorDash'
};

const ServiceConnectionModal = ({ service, onClose }) => {
  const dispatch = useDispatch();
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Service display name
  const displayName = serviceNames[service.id] || service.name;
  
  // Handle connection
  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    
    try {
      const result = await dispatch(connectService(service.id)).unwrap();
      
      // Open the OAuth popup
      const popup = window.open(
        result.authUrl, 
        `Connect ${displayName}`,
        'width=600,height=700,left=400,top=100'
      );
      
      // Check if popup was blocked
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        throw new Error('Popup blocked by browser. Please allow popups for this site.');
      }
      
      // Create a listener for message from popup
      const messageListener = (event) => {
        // Verify origin
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'OAUTH_SUCCESS' && event.data.service === service.id) {
          window.removeEventListener('message', messageListener);
          setSuccess(true);
          setConnecting(false);
          
          // Close modal after a delay
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (event.data.type === 'OAUTH_ERROR' && event.data.service === service.id) {
          window.removeEventListener('message', messageListener);
          setError(event.data.error || 'Failed to connect service');
          setConnecting(false);
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Set timeout for OAuth process
      setTimeout(() => {
        window.removeEventListener('message', messageListener);
        if (!success && connecting) {
          setError('Connection timed out. Please try again.');
          setConnecting(false);
        }
      }, 120000); // 2 minute timeout
    } catch (error) {
      setError(error.message || 'Failed to initiate connection');
      setConnecting(false);
    }
  };
  
  return (
    <div className="service-connection-modal-backdrop">
      <div className="service-connection-modal">
        <div className="modal-header">
          <h2>Connect {displayName}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <p>
            Connecting {displayName} will allow Conatus to perform actions on your behalf.
            You can disconnect this service at any time.
          </p>
          
          {error && (
            <div className="connection-error">
              {error}
            </div>
          )}
          
          {success && (
            <div className="connection-success">
              {displayName} connected successfully!
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="cancel-button"
            onClick={onClose}
            disabled={connecting}
          >
            Cancel
          </button>
          
          <button 
            className="connect-button"
            onClick={handleConnect}
            disabled={connecting || success}
          >
            {connecting ? 'Connecting...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceConnectionModal;

// src/components/settings/ServiceConnectionCard.css
.service-card {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  background-color: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--border-radius-md);
  transition: all var(--transition-normal);
}

.service-card:hover {
  box-shadow: var(--shadow-sm);
}

.service-card.connected {
  border-left: 4px solid var(--success);
}

.service-icon {
  font-size: 2rem;
  margin-right: var(--spacing-md);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.service-info {
  flex: 1;
}

.service-info h4 {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-md);
  color: var(--gray-800);
}

.service-info p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--gray-500);
}

.service-actions {
  margin-left: var(--spacing-md);
}

.connect-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-normal);
}

.connect-button:hover {
  background-color: var(--primary-dark);
}

.disconnect-button {
  background-color: var(--gray-200);
  color: var(--gray-700);
  border: none;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.disconnect-button:hover {
  background-color: var(--danger);
  color: white;
}

// src/components/settings/ServiceConnectionModal.css
.service-connection-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.service-connection-modal {
  background-color: white;
  border-radius: var(--border-radius-md);
  width: 90%;
  max-width: 500px;
  box-shadow: var(--shadow-lg);
  animation: modalAppear 0.3s ease-out;
}

@keyframes modalAppear {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--gray-800);
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  color: var(--gray-500);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  transition: all var(--transition-normal);
}

.close-button:hover {
  background-color: var(--gray-100);
  color: var(--gray-800);
}

.modal-content {
  padding: var(--spacing-lg);
}

.connection-error {
  background-color: #fee2e2;
  border-left: 4px solid var(--danger);
  color: #b91c1c;
  padding: var(--spacing-md);
  margin-top: var(--spacing-md);
  border-radius: var(--border-radius-sm);
}

.connection-success {
  background-color: #dcfce7;
  border-left: 4px solid var(--success);
  color: #166534;
  padding: var(--spacing-md);
  margin-top: var(--spacing-md);
  border-radius: var(--border-radius-sm);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--gray-200);
  gap: var(--spacing-md);
}

.modal-footer .cancel-button {
  background-color: white;
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
  padding: var(--spacing-xs) var(--spacing-lg);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.modal-footer .cancel-button:hover {
  background-color: var(--gray-100);
  border-color: var(--gray-400);
}

.modal-footer .connect-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: var(--spacing-xs) var(--spacing-lg);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-normal);
}

.modal-footer .connect-button:hover {
  background-color: var(--primary-dark);
}

.modal-footer button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

// src/pages/settings/SettingsPage.css
.settings-page {
  padding: var(--spacing-md);
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: var(--spacing-lg);
}

.settings-header h1 {
  margin: 0;
  color: var(--gray-800);
}

.settings-section {
  background-color: white;
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.settings-section h2 {
  margin-top: 0;
  margin-bottom: var(--spacing-md);
  color: var(--gray-800);
  font-size: var(--font-size-lg);
  border-bottom: 1px solid var(--gray-200);
  padding-bottom: var(--spacing-sm);
}

.account-info {
  display: flex;
  flex-direction: column;
}

.account-field {
  display: flex;
  margin-bottom: var(--spacing-md);
}

.field-label {
  font-weight: 500;
  width: 100px;
  color: var(--gray-700);
}

.account-actions {
  margin-top: var(--spacing-md);
}

.sign-out-button {
  background-color: white;
  color: var(--danger);
  border: 1px solid var(--danger);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.sign-out-button:hover {
  background-color: var(--danger);
  color: white;
}

.service-category {
  margin-bottom: var(--spacing-lg);
}

.service-category h3 {
  margin-top: 0;
  margin-bottom: var(--spacing-md);
  color: var(--gray-700);
  font-size: var(--font-size-md);
}

.service-category h4 {
  margin-top: 0;
  margin-bottom: var(--spacing-sm);
  color: var(--gray-600);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.service-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-md);
}

.loading-services {
  padding: var(--spacing-md);
  color: var(--gray-500);
  text-align: center;
}

.no-services {
  background-color: var(--gray-50);
  border-radius: var(--border-radius-sm);
  padding: var(--spacing-md);
  text-align: center;
  color: var(--gray-600);
}

.available-services {
  margin-top: var(--spacing-xl);
}

@media screen and (min-width: 768px) {
  .settings-page {
    padding: var(--spacing-lg);
  }
  
  .account-info {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  
  .account-field {
    margin-bottom: 0;
  }
  
  .account-actions {
    margin-top: 0;
  }
  
  .service-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media screen and (min-width: 1024px) {
  .service-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

// src/components/settings/ServiceConnectionOAuthCallback.jsx
import React, { useEffect } from 'react';

/**
 * This component is rendered in the OAuth callback page
 * to handle the results of OAuth authentication.
 */
const ServiceConnectionOAuthCallback = () => {
  useEffect(() => {
    // Extract data from URL
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    
    // Get service ID and state from query params
    const service = params.get('service');
    const state = params.get('state');
    
    // Check for error
    const error = params.get('error') || hashParams.get('error');
    
    if (error) {
      // Send error message to parent window
      window.opener.postMessage({
        type: 'OAUTH_ERROR',
        service,
        error: error
      }, window.location.origin);
      
      // Close this window
      window.close();
      return;
    }
    
    // Get auth code or token
    const code = params.get('code');
    const accessToken = params.get('access_token') || hashParams.get('access_token');
    
    if (code || accessToken) {
      // Send success message to parent window
      window.opener.postMessage({
        type: 'OAUTH_SUCCESS',
        service,
        state,
        code,
        accessToken
      }, window.location.origin);
      
      // Close this window
      window.close();
    } else {
      // No code or token found
      window.opener.postMessage({
        type: 'OAUTH_ERROR',
        service,
        error: 'No authorization code or token received'
      }, window.location.origin);
      
      // Close this window
      window.close();
    }
  }, []);
  
  return (
    <div className="oauth-callback">
      <h2>Connecting Service...</h2>
      <p>Please wait while we complete the connection. This window will close automatically.</p>
    </div>
  );
};

export default ServiceConnectionOAuthCallback;
