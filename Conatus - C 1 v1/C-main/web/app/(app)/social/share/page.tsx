'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// Define interfaces for form data
interface TriggerConfig {
  [key: string]: any;
}

interface ActionConfig {
  [key: string]: any;
}

interface Trigger {
  type: 'time' | 'event' | 'location' | 'condition';
  config: TriggerConfig;
}

interface Action {
  type: string;
  service: string;
  config: ActionConfig;
}

interface ShareTemplateForm {
  name: string;
  description: string;
  isPublic: boolean;
  tags: string[];
  trigger: Trigger;
  actions: Action[];
}

// Available automation templates to choose from
const automationTemplates = [
  { id: 'none', name: 'Start from scratch' },
  { id: 'daily-brief', name: 'Daily Weather & Calendar Brief' },
  { id: 'social-posting', name: 'Social Media Content Calendar' },
  { id: 'expense-tracker', name: 'Automatic Expense Categorization' },
  { id: 'meeting-notes', name: 'Meeting Notes Summarizer' },
  { id: 'github-slack', name: 'GitHub PR Notifications to Slack' }
];

export default function ShareTemplatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('none');
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    tags?: string;
    general?: string;
  }>({});
  
  // Form state
  const [formData, setFormData] = useState<ShareTemplateForm>({
    name: '',
    description: '',
    isPublic: true,
    tags: [],
    trigger: {
      type: 'time',
      config: {
        schedule: '0 9 * * 1-5', // 9 AM weekdays
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    },
    actions: [
      {
        type: 'send',
        service: 'email',
        config: {
          to: '',
          subject: '',
          body: ''
        }
      }
    ]
  });
  
  // Load template data when template selection changes
  useEffect(() => {
    if (selectedTemplate === 'none') {
      // Reset to default form
      setFormData({
        name: '',
        description: '',
        isPublic: true,
        tags: [],
        trigger: {
          type: 'time',
          config: {
            schedule: '0 9 * * 1-5',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        },
        actions: [
          {
            type: 'send',
            service: 'email',
            config: {
              to: '',
              subject: '',
              body: ''
            }
          }
        ]
      });
      return;
    }
    
    // Load template data based on selection
    if (selectedTemplate === 'daily-brief') {
      setFormData({
        name: 'Daily Weather & Calendar Brief',
        description: 'Get a morning email with your daily weather forecast and upcoming calendar events for the day.',
        isPublic: true,
        tags: ['productivity', 'weather', 'calendar'],
        trigger: {
          type: 'time',
          config: {
            schedule: '0 7 * * 1-5', // 7 AM on weekdays
            timezone: 'America/New_York'
          }
        },
        actions: [
          {
            type: 'fetch',
            service: 'weather',
            config: {
              location: 'New York',
              units: 'imperial'
            }
          },
          {
            type: 'fetch',
            service: 'calendar',
            config: {
              range: 'today',
              calendar: 'primary'
            }
          },
          {
            type: 'send',
            service: 'email',
            config: {
              to: '{{user.email}}',
              subject: 'Your Daily Brief for {{date.today}}',
              body: '# Good Morning!\n\n## Weather Today\n{{weather.description}}\nHigh: {{weather.high}}° | Low: {{weather.low}}°\n\n## Your Schedule Today\n{{calendar.events}}'
            }
          }
        ]
      });
    } else if (selectedTemplate === 'social-posting') {
      setFormData({
        name: 'Social Media Content Calendar',
        description: 'Creates a content calendar from a Google Doc and schedules posts across Instagram, Twitter, and LinkedIn.',
        isPublic: true,
        tags: ['social media', 'marketing', 'scheduler'],
        trigger: {
          type: 'time',
          config: {
            schedule: '0 8 * * 1', // 8 AM on Mondays
            timezone: 'America/New_York'
          }
        },
        actions: [
          {
            type: 'fetch',
            service: 'googleDocs',
            config: {
              docId: 'your-doc-id',
              format: 'text'
            }
          },
          {
            type: 'create',
            service: 'contentCalendar',
            config: {
              platforms: ['instagram', 'twitter', 'linkedin'],
              frequency: 'daily'
            }
          }
        ]
      });
    } else if (selectedTemplate === 'github-slack') {
      setFormData({
        name: 'GitHub PR Notifications to Slack',
        description: 'Sends Slack notifications when PRs are created, reviewed, or merged. Keeps your team in sync with development activity.',
        isPublic: true,
        tags: ['development', 'github', 'slack', 'notifications'],
        trigger: {
          type: 'event',
          config: {
            service: 'github',
            event: 'pull_request',
            repo: 'owner/repo'
          }
        },
        actions: [
          {
            type: 'send',
            service: 'slack',
            config: {
              channel: '#development',
              message: 'PR {{event.action}}: {{event.title}} by {{event.user}}\n{{event.url}}'
            }
          }
        ]
      });
    }
  }, [selectedTemplate]);
  
  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  // Handle checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  // Handle tag input
  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
    
    // Clear tag error
    if (errors.tags) {
      setErrors(prev => ({ ...prev, tags: undefined }));
    }
  };
  
  // Add tag
  const handleAddTag = () => {
    // Normalize tag (lowercase, remove special chars)
    const normalizedTag = tagInput.toLowerCase().trim().replace(/[^\w-]/g, '');
    
    if (!normalizedTag) return;
    
    // Check if tag already exists
    if (formData.tags.includes(normalizedTag)) {
      setErrors(prev => ({ ...prev, tags: 'This tag already exists' }));
      return;
    }
    
    // Add tag
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, normalizedTag]
    }));
    
    // Clear input
    setTagInput('');
  };
  
  // Remove tag
  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: typeof errors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (formData.tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    }
    
    setErrors(newErrors);
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // This would be an API call in a real implementation
      console.log('Sharing template:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to social page on success
      router.push('/social');
    } catch (error) {
      console.error('Error sharing template:', error);
      setErrors({ general: 'Failed to share template. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // If not logged in, show a message
  if (!user) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <svg 
            className="w-16 h-16 mx-auto text-gray-400 mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
            />
          </svg>
          <h3 className="text-xl font-medium mb-2">Authentication Required</h3>
          <p className="text-gray-500 mb-4">You need to log in to share automation templates.</p>
          <Link 
            href="/login"
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Link 
          href="/social" 
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg 
            className="w-5 h-5 mr-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
          Back to community templates
        </Link>
      </div>
      
      <h1 className="text-2xl font-bold mb-6">Share Automation Template</h1>
      
      {/* Template selection */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Choose a starting point</h2>
        
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {automationTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`p-4 rounded-lg border text-left transition-colors hover:bg-gray-50 ${
                selectedTemplate === template.id 
                  ? 'border-primary bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center mb-2">
                <input
                  type="radio"
                  checked={selectedTemplate === template.id}
                  onChange={() => {}}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span className="ml-2 font-medium">{template.name}</span>
              </div>
              <p className="text-xs text-gray-500">
                {template.id === 'none' 
                  ? 'Create a new template from scratch'
                  : 'Start with a pre-configured template'
                }
              </p>
            </button>
          ))}
        </div>
      </div>
      
      {/* Template form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Template Details</h2>
          
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {errors.general}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Template Name*
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="E.g., Morning News Briefing"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description*
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Describe what your template does and how it helps users..."
              ></textarea>
              {errors.description && (
                <p className="mt-1 text-sm text-red-500">{errors.description}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags*
              </label>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {formData.tags.map(tag => (
                  <div 
                    key={tag} 
                    className="inline-flex items-center bg-gray-100 text-gray-800 rounded-full px-3 py-1"
                  >
                    <span className="text-sm">#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="flex">
                <input
                  type="text"
                  value={tagInput}
                  onChange={handleTagInputChange}
                  placeholder="Add a tag (e.g., productivity)"
                  className={`flex-1 px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.tags ? 'border-red-500' : 'border-gray-300'
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-r-md"
                >
                  Add
                </button>
              </div>
              {errors.tags && (
                <p className="mt-1 text-sm text-red-500">{errors.tags}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Add tags to help users find your template (e.g., productivity, email, weather)
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                id="isPublic"
                name="isPublic"
                type="checkbox"
                checked={formData.isPublic}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                Make this template public
              </label>
            </div>
          </div>
        </div>
        
        {/* Configuration preview */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Configuration Preview</h2>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h3 className="font-medium mb-2">Trigger:</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(formData.trigger, null, 2)}
            </pre>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Actions ({formData.actions.length}):</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(formData.actions, null, 2)}
            </pre>
          </div>
          
          <p className="mt-4 text-sm text-gray-500">
            Note: When sharing a template, your personal information (emails, API keys, etc.) will be removed.
          </p>
        </div>
        
        {/* Submit button */}
        <div className="flex justify-end">
          <Link
            href="/social"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 mr-3"
          >
            Cancel
          </Link>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sharing...
              </span>
            ) : (
              'Share Template'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
