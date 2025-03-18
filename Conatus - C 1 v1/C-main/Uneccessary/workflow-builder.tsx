import React, { useState, useEffect } from 'react';

// Common UI Components
const Card = ({ children, className }) => (
  <div className={`bg-white rounded-lg shadow-md p-6 ${className || ''}`}>
    {children}
  </div>
);

const Button = ({ onClick, variant = 'primary', disabled, children }) => {
  const classes = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${classes[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

const TextField = ({ label, value, onChange, placeholder, type = 'text', required }) => (
  <div className="mb-4">
    <label className="block text-gray-700 text-sm font-bold mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, required }) => (
  <div className="mb-4">
    <label className="block text-gray-700 text-sm font-bold mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      value={value}
      onChange={onChange}
      required={required}
      className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select an option</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

// Service Connection Component
const ServiceConnection = ({ serviceId, connectedServices, onConnect }) => {
  const isConnected = connectedServices.includes(serviceId);
  
  const serviceInfo = {
    whatsapp: {
      name: 'WhatsApp',
      icon: '💬',
      color: 'bg-green-100'
    },
    gmail: {
      name: 'Gmail',
      icon: '✉️',
      color: 'bg-red-100'
    },
    uber: {
      name: 'Uber',
      icon: '🚗',
      color: 'bg-black text-white'
    },
    spotify: {
      name: 'Spotify',
      icon: '🎵',
      color: 'bg-green-100'
    }
  };
  
  const service = serviceInfo[serviceId] || {
    name: serviceId,
    icon: '🔌',
    color: 'bg-gray-100'
  };
  
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg ${service.color}`}>
      <div className="flex items-center">
        <span className="text-2xl mr-3">{service.icon}</span>
        <span className="font-medium">{service.name}</span>
      </div>
      
      {isConnected ? (
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
          <span className="h-2 w-2 mr-1 bg-green-500 rounded-full"></span>
          Connected
        </span>
      ) : (
        <Button variant="secondary" onClick={() => onConnect(serviceId)}>
          Connect
        </Button>
      )}
    </div>
  );
};

// Trigger Configuration Component
const TriggerConfig = ({ type, config, onChange, connectedServices }) => {
  // Handle config changes
  const handleConfigChange = (field, value) => {
    onChange({
      ...config,
      [field]: value
    });
  };
  
  // Render appropriate configuration form based on trigger type
  switch (type) {
    case 'time_schedule':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Time-Based Trigger</h3>
          
          <SelectField
            label="Frequency"
            value={config.frequency || ''}
            onChange={e => handleConfigChange('frequency', e.target.value)}
            required
            options={[
              { value: 'once', label: 'Once' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' }
            ]}
          />
          
          {config.frequency === 'once' && (
            <TextField
              label="Date and Time"
              type="datetime-local"
              value={config.dateTime || ''}
              onChange={e => handleConfigChange('dateTime', e.target.value)}
              required
            />
          )}
          
          {config.frequency === 'daily' && (
            <TextField
              label="Time"
              type="time"
              value={config.time || ''}
              onChange={e => handleConfigChange('time', e.target.value)}
              required
            />
          )}
          
          {config.frequency === 'weekly' && (
            <>
              <SelectField
                label="Day of Week"
                value={config.dayOfWeek || ''}
                onChange={e => handleConfigChange('dayOfWeek', e.target.value)}
                required
                options={[
                  { value: '0', label: 'Sunday' },
                  { value: '1', label: 'Monday' },
                  { value: '2', label: 'Tuesday' },
                  { value: '3', label: 'Wednesday' },
                  { value: '4', label: 'Thursday' },
                  { value: '5', label: 'Friday' },
                  { value: '6', label: 'Saturday' }
                ]}
              />
              
              <TextField
                label="Time"
                type="time"
                value={config.time || ''}
                onChange={e => handleConfigChange('time', e.target.value)}
                required
              />
            </>
          )}
          
          {config.frequency === 'monthly' && (
            <>
              <TextField
                label="Day of Month"
                type="number"
                min="1"
                max="31"
                value={config.dayOfMonth || ''}
                onChange={e => handleConfigChange('dayOfMonth', e.target.value)}
                required
              />
              
              <TextField
                label="Time"
                type="time"
                value={config.time || ''}
                onChange={e => handleConfigChange('time', e.target.value)}
                required
              />
            </>
          )}
        </div>
      );
      
    case 'email_received':
      // Check if Gmail is connected
      const isGmailConnected = connectedServices.includes('gmail');
      
      if (!isGmailConnected) {
        return (
          <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Gmail Connection Required</h3>
            <p className="mb-4">You need to connect your Gmail account to use this trigger.</p>
            <ServiceConnection 
              serviceId="gmail" 
              connectedServices={connectedServices} 
              onConnect={() => {}} 
            />
          </div>
        );
      }
      
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Email Trigger</h3>
          
          <TextField
            label="From Email (optional)"
            type="email"
            value={config.fromEmail || ''}
            onChange={e => handleConfigChange('fromEmail', e.target.value)}
            placeholder="e.g., boss@example.com"
          />
          
          <TextField
            label="Subject Contains (optional)"
            value={config.subjectContains || ''}
            onChange={e => handleConfigChange('subjectContains', e.target.value)}
            placeholder="e.g., urgent, report"
          />
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Check Frequency
            </label>
            <div className="flex items-center">
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={config.checkFrequency || 15}
                onChange={e => handleConfigChange('checkFrequency', e.target.value)}
                className="mr-2"
              />
              <span>{config.checkFrequency || 15} minutes</span>
            </div>
          </div>
        </div>
      );
      
    case 'webhook':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Webhook Trigger</h3>
          
          <div className="mb-4 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm mb-2">Your webhook URL:</p>
            <code className="block p-2 bg-white rounded border border-gray-300 text-sm overflow-x-auto">
              https://api.conatus.app/automations/webhook/{config.webhookId || 'will-be-generated'}
            </code>
          </div>
          
          <TextField
            label="Secret Key (optional)"
            value={config.secretKey || ''}
            onChange={e => handleConfigChange('secretKey', e.target.value)}
            placeholder="For webhook authentication"
          />
        </div>
      );
    
    default:
      return (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">
          <p>Unknown trigger type: {type}</p>
        </div>
      );
  }
};

// Action Configuration Component
const ActionConfig = ({ type, config, onChange, connectedServices }) => {
  // Handle config changes
  const handleConfigChange = (field, value) => {
    onChange({
      ...config,
      [field]: value
    });
  };
  
  // Render appropriate configuration form based on action type
  switch (type) {
    case 'send_whatsapp':
      // Check if WhatsApp is connected
      const isWhatsAppConnected = connectedServices.includes('whatsapp');
      
      if (!isWhatsAppConnected) {
        return (
          <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">WhatsApp Connection Required</h3>
            <p className="mb-4">You need to connect your WhatsApp account to use this action.</p>
            <ServiceConnection 
              serviceId="whatsapp" 
              connectedServices={connectedServices} 
              onConnect={() => {}} 
            />
          </div>
        );
      }
      
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Send WhatsApp Message</h3>
          
          <TextField
            label="Recipient"
            value={config.recipient || ''}
            onChange={e => handleConfigChange('recipient', e.target.value)}
            placeholder="Phone number or contact name"
            required
          />
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Message
            </label>
            <textarea
              value={config.message || ''}
              onChange={e => handleConfigChange('message', e.target.value)}
              placeholder="Enter your message"
              required
              rows={4}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      );
    
    case 'send_email':
      // Check if Gmail is connected
      const isGmailConnected = connectedServices.includes('gmail');
      
      if (!isGmailConnected) {
        return (
          <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Gmail Connection Required</h3>
            <p className="mb-4">You need to connect your Gmail account to use this action.</p>
            <ServiceConnection 
              serviceId="gmail" 
              connectedServices={connectedServices} 
              onConnect={() => {}} 
            />
          </div>
        );
      }
      
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Send Email</h3>
          
          <TextField
            label="Recipient Email"
            type="email"
            value={config.recipient || ''}
            onChange={e => handleConfigChange('recipient', e.target.value)}
            placeholder="recipient@example.com"
            required
          />
          
          <TextField
            label="Subject"
            value={config.subject || ''}
            onChange={e => handleConfigChange('subject', e.target.value)}
            placeholder="Email subject"
            required
          />
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email Body
            </label>
            <textarea
              value={config.body || ''}
              onChange={e => handleConfigChange('body', e.target.value)}
              placeholder="Email content"
              required
              rows={6}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      );
    
    case 'request_uber':
      // Check if Uber is connected
      const isUberConnected = connectedServices.includes('uber');
      
      if (!isUberConnected) {
        return (
          <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Uber Connection Required</h3>
            <p className="mb-4">You need to connect your Uber account to use this action.</p>
            <ServiceConnection 
              serviceId="uber" 
              connectedServices={connectedServices} 
              onConnect={() => {}} 
            />
          </div>
        );
      }
      
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Request Uber Ride</h3>
          
          <TextField
            label="Pickup Location"
            value={config.pickup || ''}
            onChange={e => handleConfigChange('pickup', e.target.value)}
            placeholder="Address or location name"
            required
          />
          
          <TextField
            label="Destination"
            value={config.destination || ''}
            onChange={e => handleConfigChange('destination', e.target.value)}
            placeholder="Address or location name"
            required
          />
          
          <SelectField
            label="Ride Type"
            value={config.rideType || ''}
            onChange={e => handleConfigChange('rideType', e.target.value)}
            options={[
              { value: 'uberx', label: 'UberX' },
              { value: 'uberxl', label: 'UberXL' },
              { value: 'comfort', label: 'Uber Comfort' },
              { value: 'black', label: 'Uber Black' }
            ]}
          />
        </div>
      );
    
    case 'run_script':
      return (
        <div>
          <h3 className="text-lg font-semibold mb-4">Run Custom Script</h3>
          
          <SelectField
            label="Script Type"
            value={config.scriptType || ''}
            onChange={e => handleConfigChange('scriptType', e.target.value)}
            required
            options={[
              { value: 'javascript', label: 'JavaScript' },
              { value: 'python', label: 'Python' },
              { value: 'shell', label: 'Shell Script' }
            ]}
          />
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Script Code
            </label>
            <textarea
              value={config.code || ''}
              onChange={e => handleConfigChange('code', e.target.value)}
              placeholder={`// Enter your ${config.scriptType || 'script'} code here`}
              required
              rows={8}
              className="font-mono shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg mb-4">
            <p className="text-sm">
              <strong>Note:</strong> Scripts run in a sandboxed environment with limited permissions.
            </p>
          </div>
        </div>
      );
    
    default:
      return (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">
          <p>Unknown action type: {type}</p>
        </div>
      );
  }
};

// Main Workflow Builder Component
const WorkflowBuilder = ({ 
  existingAutomation = null,
  connectedServices = ['gmail', 'whatsapp'],
  onSave,
  onCancel
}) => {
  // Local state for workflow configuration
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    triggerType: '',
    triggerConfig: {},
    actionType: '',
    actionConfig: {},
    isEnabled: true
  });
  
  const [loading, setLoading] = useState(false);
  
  // Set initial state if editing existing automation
  useEffect(() => {
    if (existingAutomation) {
      setWorkflow({
        name: existingAutomation.name || '',
        description: existingAutomation.description || '',
        triggerType: existingAutomation.trigger?.type || '',
        triggerConfig: existingAutomation.trigger?.config || {},
        actionType: existingAutomation.action?.type || '',
        actionConfig: existingAutomation.action?.config || {},
        isEnabled: existingAutomation.isEnabled !== false
      });
    }
  }, [existingAutomation]);
  
  // Handle input changes
  const handleInputChange = (field, value) => {
    setWorkflow(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle trigger selection
  const handleTriggerSelect = (triggerType) => {
    setWorkflow(prev => ({
      ...prev,
      triggerType,
      triggerConfig: {}
    }));
  };
  
  // Handle action selection
  const handleActionSelect = (actionType) => {
    setWorkflow(prev => ({
      ...prev,
      actionType,
      actionConfig: {}
    }));
  };
  
  // Handle trigger configuration changes
  const handleTriggerConfigChange = (config) => {
    setWorkflow(prev => ({
      ...prev,
      triggerConfig: config
    }));
  };
  
  // Handle action configuration changes
  const handleActionConfigChange = (config) => {
    setWorkflow(prev => ({
      ...prev,
      actionConfig: config
    }));
  };
  
  // Connect a service
  const handleServiceConnect = (serviceId) => {
    // In a real app, this would open the OAuth flow
    alert(`Opening OAuth flow for ${serviceId}...`);
  };
  
  // Save the workflow
  const handleSave = async () => {
    // Validate workflow
    if (!workflow.name || !workflow.triggerType || !workflow.actionType) {
      alert('Please complete all required fields');
      return;
    }
    
    // Prepare workflow data
    const workflowData = {
      name: workflow.name,
      description: workflow.description,
      trigger: {
        type: workflow.triggerType,
        config: workflow.triggerConfig
      },
      action: {
        type: workflow.actionType,
        config: workflow.actionConfig
      },
      isEnabled: workflow.isEnabled
    };
    
    setLoading(true);
    
    try {
      // Call the provided onSave callback
      if (onSave) {
        await onSave(existingAutomation ? { ...workflowData, id: existingAutomation.id } : workflowData);
      }
    } catch (error) {
      alert(`Error saving workflow: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Available triggers
  const availableTriggers = [
    { value: 'time_schedule', label: 'Time Schedule', icon: '⏰' },
    { value: 'email_received', label: 'Email Received', icon: '✉️' },
    { value: 'webhook', label: 'Webhook', icon: '🔗' }
  ];
  
  // Available actions
  const availableActions = [
    { value: 'send_whatsapp', label: 'Send WhatsApp Message', icon: '💬' },
    { value: 'send_email', label: 'Send Email', icon: '📧' },
    { value: 'request_uber', label: 'Request Uber Ride', icon: '🚗' },
    { value: 'run_script', label: 'Run Custom Script', icon: '📝' }
  ];
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {existingAutomation ? 'Edit Automation' : 'Create New Automation'}
        </h1>
        
        <div className="space-x-4">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {existingAutomation ? 'Update' : 'Save'} Automation
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
        
        <TextField
          label="Automation Name"
          value={workflow.name}
          onChange={e => handleInputChange('name', e.target.value)}
          placeholder="e.g., Daily Weather Report"
          required
        />
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Description (optional)
          </label>
          <textarea
            value={workflow.description}
            onChange={e => handleInputChange('description', e.target.value)}
            placeholder="What does this automation do?"
            rows={2}
            className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isEnabled"
            checked={workflow.isEnabled}
            onChange={e => handleInputChange('isEnabled', e.target.checked)}
            className="mr-2 h-4 w-4"
          />
          <label htmlFor="isEnabled" className="text-gray-700">
            Enable this automation
          </label>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Trigger Selection */}
        <Card>
          <h2 className="text-xl font-semibold mb-4">
            <span className="mr-2">1</span>
            When this happens...
          </h2>
          
          <div className="grid grid-cols-1 gap-3 mb-4">
            {availableTriggers.map(trigger => (
              <div
                key={trigger.value}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  workflow.triggerType === trigger.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => handleTriggerSelect(trigger.value)}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{trigger.icon}</span>
                  <span className="font-medium">{trigger.label}</span>
                </div>
              </div>
            ))}
          </div>
          
          {workflow.triggerType && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <TriggerConfig
                type={workflow.triggerType}
                config={workflow.triggerConfig}
                onChange={handleTriggerConfigChange}
                connectedServices={connectedServices}
              />
            </div>
          )}
        </Card>
        
        {/* Action Selection */}
        <Card>
          <h2 className="text-xl font-semibold mb-4">
            <span className="mr-2">2</span>
            Do this...
          </h2>
          
          <div className="grid grid-cols-1 gap-3 mb-4">
            {availableActions.map(action => (
              <div
                key={action.value}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  workflow.actionType === action.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => handleActionSelect(action.value)}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{action.icon}</span>
                  <span className="font-medium">{action.label}</span>
                </div>
              </div>
            ))}
          </div>
          
          {workflow.actionType && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <ActionConfig
                type={workflow.actionType}
                config={workflow.actionConfig}
                onChange={handleActionConfigChange}
                connectedServices={connectedServices}
              />
            </div>
          )}
        </Card>
      </div>
      
      <div className="flex justify-end space-x-4 mt-6">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {existingAutomation ? 'Update' : 'Save'} Automation
        </Button>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
