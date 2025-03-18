'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// Define interfaces for template data
interface Template {
  id: string;
  name: string;
  description: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  upvotes: number;
  downvotes: number;
  commentCount: number;
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  configuration: {
    trigger: {
      type: string;
      config: Record<string, any>;
    };
    actions: Array<{
      type: string;
      service: string;
      config: Record<string, any>;
    }>;
  };
  userHasUpvoted?: boolean;
  userHasDownvoted?: boolean;
  userHasSaved?: boolean;
}

interface Comment {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  content: string;
  createdAt: Date;
  upvotes: number;
  userHasUpvoted?: boolean;
}

export default function TemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [template, setTemplate] = useState<Template | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'config'>('details');
  
  // Fetch template and comments
  useEffect(() => {
    const fetchTemplateData = async () => {
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock template data
        const mockTemplate: Template = {
          id: params.id,
          name: 'Daily Weather & Calendar Brief',
          description: 'Get a morning email with your daily weather forecast and upcoming calendar events for the day. This automation runs every weekday at 7 AM and collects relevant data from your calendar and local weather service.',
          user: {
            id: 'u1',
            name: 'Alex Johnson',
            avatar: 'A'
          },
          upvotes: 243,
          downvotes: 12,
          commentCount: 32,
          isPublic: true,
          tags: ['productivity', 'weather', 'calendar'],
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
          configuration: {
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
          },
          userHasUpvoted: Math.random() > 0.5,
          userHasSaved: Math.random() > 0.7
        };
        
        // Mock comments
        const mockComments: Comment[] = [
          {
            id: 'c1',
            user: {
              id: 'u2',
              name: 'Sarah Lee',
              avatar: 'S'
            },
            content: 'I've been using this template for a few weeks now, and it's been incredibly helpful for starting my day prepared. I modified it to include traffic information as well.',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            upvotes: 18,
            userHasUpvoted: false
          },
          {
            id: 'c2',
            user: {
              id: 'u3',
              name: 'Michael Chang',
              avatar: 'M'
            },
            content: 'Great template! Question: how do I adapt this to use my work calendar instead of my personal one?',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            upvotes: 7
          },
          {
            id: 'c3',
            user: {
              id: 'u1',
              name: 'Alex Johnson',
              avatar: 'A'
            },
            content: '@Michael - You can modify the action configuration to specify your work calendar ID instead of "primary". You can find your calendar ID in Google Calendar settings.',
            createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            upvotes: 12,
            userHasUpvoted: true
          },
          {
            id: 'c4',
            user: {
              id: 'u4',
              name: 'Priya Patel',
              avatar: 'P'
            },
            content: 'I added a Slack notification option alongside the email. Works perfectly for my workflow!',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            upvotes: 9
          }
        ];
        
        setTemplate(mockTemplate);
        setComments(mockComments);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching template data:', error);
        // Handle error state
      }
    };
    
    fetchTemplateData();
  }, [params.id]);
  
  // Post a new comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || !user) return;
    
    setIsPostingComment(true);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create new comment
      const newCommentObj: Comment = {
        id: `c${Date.now()}`,
        user: {
          id: user.id,
          name: user.email?.split('@')[0] || 'User',
          avatar: (user.email?.charAt(0) || 'U').toUpperCase()
        },
        content: newComment,
        createdAt: new Date(),
        upvotes: 0
      };
      
      // Update comments and template comment count
      setComments(prev => [newCommentObj, ...prev]);
      setTemplate(prev => prev ? {
        ...prev,
        commentCount: prev.commentCount + 1
      } : null);
      
      // Clear the input
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
      // Handle error state
    } finally {
      setIsPostingComment(false);
    }
  };
  
  // Handle comment upvote
  const handleCommentUpvote = (commentId: string) => {
    setComments(prev => 
      prev.map(comment => {
        if (comment.id === commentId) {
          if (comment.userHasUpvoted) {
            // Remove upvote
            return {
              ...comment,
              upvotes: comment.upvotes - 1,
              userHasUpvoted: false
            };
          } else {
            // Add upvote
            return {
              ...comment,
              upvotes: comment.upvotes + 1,
              userHasUpvoted: true
            };
          }
        }
        return comment;
      })
    );
  };
  
  // Handle template actions
  const handleTemplateUpvote = () => {
    if (!template) return;
    
    setTemplate(prev => {
      if (!prev) return prev;
      
      if (prev.userHasUpvoted) {
        // Remove upvote
        return {
          ...prev,
          upvotes: prev.upvotes - 1,
          userHasUpvoted: false
        };
      } else {
        // Add upvote and remove downvote if exists
        return {
          ...prev,
          upvotes: prev.upvotes + 1,
          downvotes: prev.userHasDownvoted ? prev.downvotes - 1 : prev.downvotes,
          userHasUpvoted: true,
          userHasDownvoted: false
        };
      }
    });
  };
  
  const handleTemplateDownvote = () => {
    if (!template) return;
    
    setTemplate(prev => {
      if (!prev) return prev;
      
      if (prev.userHasDownvoted) {
        // Remove downvote
        return {
          ...prev,
          downvotes: prev.downvotes - 1,
          userHasDownvoted: false
        };
      } else {
        // Add downvote and remove upvote if exists
        return {
          ...prev,
          downvotes: prev.downvotes + 1,
          upvotes: prev.userHasUpvoted ? prev.upvotes - 1 : prev.upvotes,
          userHasDownvoted: true,
          userHasUpvoted: false
        };
      }
    });
  };
  
  const handleSaveTemplate = () => {
    if (!template) return;
    
    setTemplate(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        userHasSaved: !prev.userHasSaved
      };
    });
  };
  
  // Format the date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };
  
  // Handle template import (use the automation)
  const handleImportTemplate = () => {
    if (!template) return;
    
    // In a real app, this would add the template to the user's automations
    // For demo purposes, we'll just navigate to the Library tab
    router.push('/library');
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
          <div className="flex gap-2 mb-4">
            <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
            <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
          </div>
          <div className="flex items-center gap-2 mb-8">
            <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
            <div className="h-5 w-32 bg-gray-200 rounded"></div>
          </div>
          <div className="h-40 bg-gray-200 rounded mb-8"></div>
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-100 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // If template not found
  if (!template) {
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <h3 className="text-xl font-medium mb-2">Template Not Found</h3>
          <p className="text-gray-500 mb-4">The template you're looking for doesn't exist or has been removed.</p>
          <Link 
            href="/social"
            className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Back to Community Templates
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
      
      {/* Template header */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">{template.name}</h1>
        <p className="text-gray-600 mb-4">{template.description}</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {template.tags.map(tag => (
            <Link
              key={tag}
              href={`/social?tag=${tag}`}
              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full hover:bg-gray-200"
            >
              #{tag}
            </Link>
          ))}
        </div>
        
        {/* Author and date */}
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full text-lg mr-3">
            {template.user.avatar}
          </div>
          <div>
            <div className="font-medium">{template.user.name}</div>
            <div className="text-sm text-gray-500">Posted on {formatDate(template.createdAt)}</div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleImportTemplate}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
              />
            </svg>
            Use This Template
          </button>
          
          <button
            onClick={handleSaveTemplate}
            className={`inline-flex items-center px-4 py-2 rounded-md ${
              template.userHasSaved
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill={template.userHasSaved ? "currentColor" : "none"} 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" 
              />
            </svg>
            {template.userHasSaved ? 'Saved' : 'Save'}
          </button>
          
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={handleTemplateUpvote}
              className={`inline-flex items-center px-3 py-2 rounded-l-md border-r ${
                template.userHasUpvoted
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
              }`}
            >
              <svg 
                className="w-5 h-5 mr-1" 
                fill={template.userHasUpvoted ? "currentColor" : "none"} 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 15l7-7 7 7" 
                />
              </svg>
              {template.upvotes}
            </button>
            
            <button
              onClick={handleTemplateDownvote}
              className={`inline-flex items-center px-3 py-2 rounded-r-md ${
                template.userHasDownvoted
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              <svg 
                className="w-5 h-5 mr-1" 
                fill={template.userHasDownvoted ? "currentColor" : "none"} 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 9l-7 7-7-7" 
                />
              </svg>
              {template.downvotes}
            </button>
          </div>
          
          <a 
            href="#comments"
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
              />
            </svg>
            {template.commentCount} Comments
          </a>
        </div>
      </div>
      
      {/* Tabs for template details */}
      <div className="bg-white rounded-lg border mb-6 overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 font-medium text-center ${
              activeTab === 'details'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-3 font-medium text-center ${
              activeTab === 'config'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Configuration
          </button>
        </div>
        
        <div className="p-6">
          {activeTab === 'details' ? (
            <div>
              <h2 className="text-lg font-medium mb-3">About this template</h2>
              <p className="text-gray-600 mb-4">{template.description}</p>
              
              <h3 className="font-medium mb-2">What it does:</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Runs automatically every weekday at 7 AM</li>
                <li>Fetches weather data for your configured location</li>
                <li>Retrieves your calendar events for the day</li>
                <li>Compiles and formats all information in a clean email</li>
                <li>Delivers the brief to your inbox before you start your day</li>
              </ul>
              
              <h3 className="font-medium mb-2">Customization options:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Change the schedule to any time that works for you</li>
                <li>Modify the location for weather reports</li>
                <li>Add or remove data sources</li>
                <li>Customize the email format and styling</li>
                <li>Change the delivery method (email, Slack, etc.)</li>
              </ul>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-medium mb-3">Template Configuration</h2>
              
              <div className="mb-6">
                <h3 className="font-medium mb-2">Trigger:</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="mb-2"><span className="font-medium">Type:</span> {template.configuration.trigger.type}</div>
                  
                  <div><span className="font-medium">Configuration:</span></div>
                  <pre className="bg-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
                    {JSON.stringify(template.configuration.trigger.config, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Actions ({template.configuration.actions.length}):</h3>
                <div className="space-y-4">
                  {template.configuration.actions.map((action, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="mb-2">
                        <span className="font-medium">Action {index + 1}:</span> {action.type} ({action.service})
                      </div>
                      
                      <div><span className="font-medium">Configuration:</span></div>
                      <pre className="bg-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
                        {JSON.stringify(action.config, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Comments section */}
      <div id="comments" className="scroll-mt-4">
        <h2 className="text-xl font-medium mb-4">Comments ({comments.length})</h2>
        
        {/* Comment form */}
        {user && (
          <form onSubmit={handlePostComment} className="mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full text-lg">
                {(user.email?.charAt(0) || 'U').toUpperCase()}
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts or ask a question..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                  disabled={isPostingComment}
                ></textarea>
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isPostingComment}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPostingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
        
        {/* Comments list */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full text-lg">
                    {comment.user.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{comment.user.name}</div>
                        <div className="text-xs text-gray-500">{formatDate(comment.createdAt)}</div>
                      </div>
                      <button
                        onClick={() => handleCommentUpvote(comment.id)}
                        className={`flex items-center space-x-1 text-sm ${
                          comment.userHasUpvoted 
                            ? 'text-green-600' 
                            : 'text-gray-500 hover:text-green-600'
                        }`}
                      >
                        <svg 
                          className="w-4 h-4" 
                          fill={comment.userHasUpvoted ? "currentColor" : "none"} 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M5 15l7-7 7 7" 
                          />
                        </svg>
                        <span>{comment.upvotes}</span>
                      </button>
                    </div>
                    <div className="mt-2 text-gray-700 whitespace-pre-wrap">{comment.content}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
