'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAdaptiveLearning } from '@/context/AdaptiveLearningContext';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { measurePerformance } from '@/lib/performance';
import { SuggestionBanner } from '@/components/suggestions';

// Mock automation data - in a real implementation, this would come from the API
interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'time' | 'event' | 'location';
    config: any;
  };
  active: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'failure' | 'pending';
  created: string;
  updated: string;
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { trackEvent } = useAdaptiveLearning();
  
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load automations
  useEffect(() => {
    if (!user) return;
    
    const loadAutomations = async () => {
      await measurePerformance('load-automations', async () => {
        try {
          setLoading(true);
          
          // In a real implementation, this would call the API
          // const response = await fetch(`/api/automations?userId=${user.id}`);
          // const data = await response.json();
          
          // For now, using mock data
          const mockAutomations: Automation[] = [
            {
              id: '1',
              name: 'Daily Work Summary',
              description: 'Sends a summary of your day every weekday at 5pm',
              trigger: {
                type: 'time',
                config: { time: '17:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
              },
              active: true,
              lastRun: '2025-03-17T17:00:00Z',
              lastStatus: 'success',
              created: '2025-02-15T12:34:56Z',
              updated: '2025-03-10T09:12:34Z'
            },
            {
              id: '2',
              name: 'Morning News Briefing',
              description: 'Delivers news headlines every morning at 8am',
              trigger: {
                type: 'time',
                config: { time: '08:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
              },
              active: true,
              lastRun: '2025-03-18T08:00:00Z',
              lastStatus: 'success',
              created: '2025-01-20T15:22:33Z',
              updated: '2025-03-15T10:45:12Z'
            },
            {
              id: '3',
              name: 'Auto-Order Lunch',
              description: 'Orders lunch from your favorite restaurant at noon',
              trigger: {
                type: 'time',
                config: { time: '12:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
              },
              active: false,
              lastRun: '2025-03-15T12:00:00Z',
              lastStatus: 'failure',
              created: '2025-03-01T09:10:11Z',
              updated: '2025-03-16T14:22:33Z'
            },
            {
              id: '4',
              name: 'Office Arrival Notice',
              description: 'Notifies your team when you arrive at the office',
              trigger: {
                type: 'location',
                config: { location: 'Office', radius: 100, enter: true, exit: false }
              },
              active: true,
              lastRun: '2025-03-18T09:05:22Z',
              lastStatus: 'success',
              created: '2025-02-10T11:12:13Z',
              updated: '2025-03-05T16:17:18Z'
            },
            {
              id: '5',
              name: 'Email Meeting Notes',
              description: 'Automatically emails meeting notes after calendar events',
              trigger: {
                type: 'event',
                config: { eventType: 'calendar.event.ended', filter: { hasAttendees: true } }
              },
              active: true,
              lastRun: '2025-03-17T15:30:00Z',
              lastStatus: 'success',
              created: '2025-01-05T13:14:15Z',
              updated: '2025-02-20T10:11:12Z'
            }
          ];
          
          setAutomations(mockAutomations);
          setLoading(false);
          
          // Track page view
          trackEvent('page_viewed', {
            page: 'library',
            automationCount: mockAutomations.length,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          console.error('Error loading automations:', error);
          setLoading(false);
          
          // Handle error state - in a real app, you'd show an error message
        }
      });
    };
    
    loadAutomations();
  }, [user, trackEvent]);
  
  // Handle user authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);
  
  // Filter and sort automations
  const filteredAutomations = React.useMemo(() => {
    return measurePerformance('filter-automations', () => {
      let result = [...automations];
      
      // Apply filter
      if (filter !== 'all') {
        result = result.filter(automation => {
          if (filter === 'active') return automation.active;
          if (filter === 'inactive') return !automation.active;
          if (filter === 'time') return automation.trigger.type === 'time';
          if (filter === 'event') return automation.trigger.type === 'event';
          if (filter === 'location') return automation.trigger.type === 'location';
          return true;
        });
      }
      
      // Apply search
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        result = result.filter(automation => 
          automation.name.toLowerCase().includes(query) || 
          automation.description.toLowerCase().includes(query)
        );
      }
      
      // Apply sort
      result.sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else if (sortBy === 'created') {
          return new Date(b.created).getTime() - new Date(a.created).getTime();
        } else if (sortBy === 'updated') {
          return new Date(b.updated).getTime() - new Date(a.updated).getTime();
        } else if (sortBy === 'status') {
          if (!a.lastStatus) return 1;
          if (!b.lastStatus) return -1;
          return a.lastStatus.localeCompare(b.lastStatus);
        }
        return 0;
      });
      
      return result;
    });
  }, [automations, filter, sortBy, searchQuery]);
  
  // Handle toggle automation
  const handleToggleAutomation = async (id: string, currentActive: boolean) => {
    await measurePerformance('toggle-automation', async () => {
      try {
        // In a real implementation, this would call the API
        // await fetch(`/api/automations/${id}`, {
        //   method: 'PATCH',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ active: !currentActive })
        // });
        
        // Update local state
        setAutomations(prev => 
          prev.map(automation => 
            automation.id === id 
              ? { ...automation, active: !currentActive, updated: new Date().toISOString() } 
              : automation
          )
        );
        
        // Track event
        trackEvent('automation_toggled', {
          automationId: id,
          newState: !currentActive ? 'active' : 'inactive',
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error toggling automation:', error);
        // Handle error - in a real app, you'd show an error message
      }
    });
  };
  
  // Handle delete automation
  const handleDeleteAutomation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this automation?')) {
      return;
    }
    
    await measurePerformance('delete-automation', async () => {
      try {
        // In a real implementation, this would call the API
        // await fetch(`/api/automations/${id}`, {
        //   method: 'DELETE'
        // });
        
        // Update local state
        setAutomations(prev => prev.filter(automation => automation.id !== id));
        
        // Track event
        trackEvent('automation_deleted', {
          automationId: id,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error deleting automation:', error);
        // Handle error - in a real app, you'd show an error message
      }
    });
  };
  
  // Render trigger label
  const getTriggerLabel = (trigger: { type: string; config: any }) => {
    switch (trigger.type) {
      case 'time':
        return `${trigger.config.time} on ${trigger.config.days.join(', ')}`;
      case 'location':
        return `When ${trigger.config.enter ? 'entering' : ''}${trigger.config.enter && trigger.config.exit ? ' or ' : ''}${trigger.config.exit ? 'exiting' : ''} ${trigger.config.location}`;
      case 'event':
        return `On ${trigger.config.eventType}`;
      default:
        return 'Custom trigger';
    }
  };
  
  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen">
        <SuggestionBanner position="top" />
        
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Your Automations</h1>
            <Link
              href="/library/create"
              className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Automation
            </Link>
          </div>
          
          {/* Filters and search */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-4">
              <div className="flex-1">
                <label htmlFor="search" className="sr-only">Search automations</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="search"
                    name="search"
                    id="search"
                    className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Search automations"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <label htmlFor="filter" className="block text-sm font-medium text-gray-700 whitespace-nowrap">
                  Filter:
                </label>
                <select
                  id="filter"
                  name="filter"
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="time">Time-based</option>
                  <option value="event">Event-based</option>
                  <option value="location">Location-based</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 whitespace-nowrap">
                  Sort by:
                </label>
                <select
                  id="sortBy"
                  name="sortBy"
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="updated">Last updated</option>
                  <option value="created">Created date</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : filteredAutomations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No automations found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new automation or try a different filter.
              </p>
              <div className="mt-6">
                <Link
                  href="/library/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Automation
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredAutomations.map((automation) => (
                <div key={automation.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{automation.name}</h3>
                        <p className="mt-1 text-sm text-gray-500">{automation.description}</p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleAutomation(automation.id, automation.active)}
                          className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                            automation.active ? 'bg-primary' : 'bg-gray-200'
                          }`}
                          aria-pressed={automation.active}
                        >
                          <span className="sr-only">
                            {automation.active ? 'Deactivate' : 'Activate'}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                              automation.active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          ></span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{getTriggerLabel(automation.trigger)}</span>
                      </div>
                      
                      {automation.lastRun && (
                        <div className="flex items-center text-sm text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>
                            Last run: {new Date(automation.lastRun).toLocaleString()}
                            {automation.lastStatus && (
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                automation.lastStatus === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : automation.lastStatus === 'failure'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {automation.lastStatus}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex justify-between">
                    <Link
                      href={`/library/edit/${automation.id}`}
                      className="text-sm font-medium text-primary hover:text-primary-dark"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteAutomation(automation.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
