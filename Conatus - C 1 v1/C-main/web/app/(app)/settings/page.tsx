'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';
import { SuggestionSettings } from '@/components/suggestions';

export default function SettingsPage() {
  const { user } = useAuth();
  const { trackEvent } = useAdaptiveLearning();
  const [activeTab, setActiveTab] = useState<string>('suggestions');
  
  // Track page view
  useEffect(() => {
    if (user) {
      trackEvent('app_opened', {
        page: 'settings',
        source: 'direct_navigation'
      });
    }
  }, [user, trackEvent]);
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`pb-2 font-medium text-sm transition-colors ${
              activeTab === 'suggestions' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Suggestions
          </button>
          
          <button
            onClick={() => setActiveTab('account')}
            className={`pb-2 font-medium text-sm transition-colors ${
              activeTab === 'account' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Account
          </button>
          
          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-2 font-medium text-sm transition-colors ${
              activeTab === 'privacy' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Privacy
          </button>
          
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-2 font-medium text-sm transition-colors ${
              activeTab === 'notifications' 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Notifications
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div>
        {activeTab === 'suggestions' && (
          <div>
            <p className="text-sm text-gray-600 mb-6">
              Manage how Conatus makes suggestions based on your usage patterns.
            </p>
            
            <SuggestionSettings />
          </div>
        )}
        
        {activeTab === 'account' && (
          <div>
            <p className="text-gray-600 mb-4">
              Manage your account settings and profile information.
            </p>
            
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-medium mb-4">Account Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Created
                  </label>
                  <input
                    type="text"
                    value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    readOnly
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                
                <div className="pt-4">
                  <button className="text-sm text-red-600 hover:text-red-800">
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'privacy' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-medium mb-4">Privacy Settings</h2>
            <p className="text-sm text-gray-600 mb-6">
              Control how your data is used and stored.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Usage Data Collection
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Allow Conatus to collect usage data to improve your experience
                  </p>
                </div>
                
                <div>
                  <button
                    className="relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none bg-primary"
                    aria-pressed="true"
                  >
                    <span className="sr-only">Enable data collection</span>
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 translate-x-5"
                    />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Allow Location Tracking
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Enable location-based features and suggestions
                  </p>
                </div>
                
                <div>
                  <button
                    className="relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none bg-primary"
                    aria-pressed="true"
                  >
                    <span className="sr-only">Enable location tracking</span>
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 translate-x-5"
                    />
                  </button>
                </div>
              </div>
              
              <div className="border-t pt-6">
                <button className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200">
                  Delete All My Data
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-medium mb-4">Notification Settings</h2>
            <p className="text-sm text-gray-600 mb-6">
              Control how and when Conatus sends you notifications.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Email Notifications
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Receive notifications and updates via email
                  </p>
                </div>
                
                <div>
                  <button
                    className="relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none bg-gray-200"
                    aria-pressed="false"
                  >
                    <span className="sr-only">Enable email notifications</span>
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 translate-x-0"
                    />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Push Notifications
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Receive push notifications on your device
                  </p>
                </div>
                
                <div>
                  <button
                    className="relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none bg-primary"
                    aria-pressed="true"
                  >
                    <span className="sr-only">Enable push notifications</span>
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 translate-x-5"
                    />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Automation Notifications
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Notify when automations are triggered or completed
                  </p>
                </div>
                
                <div>
                  <button
                    className="relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none bg-primary"
                    aria-pressed="true"
                  >
                    <span className="sr-only">Enable automation notifications</span>
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 translate-x-5"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
