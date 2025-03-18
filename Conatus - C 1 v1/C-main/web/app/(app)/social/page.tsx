'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

// Define interface for template data
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
  userHasUpvoted?: boolean;
  userHasDownvoted?: boolean;
}

// Sort options
type SortOption = 'popular' | 'recent' | 'trending';

export default function SocialPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      const mockTemplates: Template[] = [
        {
          id: '1',
          name: 'Daily Weather & Calendar Brief',
          description: 'Get a morning email with your daily weather forecast and upcoming calendar events for the day.',
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
          userHasUpvoted: Math.random() > 0.5
        },
        {
          id: '2',
          name: 'GitHub PR Notifications to Slack',
          description: 'Sends Slack notifications when PRs are created, reviewed, or merged. Keeps your team in sync with development activity.',
          user: {
            id: 'u2',
            name: 'Sarah Lee',
            avatar: 'S'
          },
          upvotes: 187,
          downvotes: 5,
          commentCount: 24,
          isPublic: true,
          tags: ['development', 'github', 'slack', 'notifications'],
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
          id: '3',
          name: 'Automatic Expense Categorization',
          description: 'Automatically categorizes expenses from your bank account and sends a weekly financial summary.',
          user: {
            id: 'u3',
            name: 'Michael Chang',
            avatar: 'M'
          },
          upvotes: 324,
          downvotes: 16,
          commentCount: 47,
          isPublic: true,
          tags: ['finance', 'banking', 'reports'],
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        },
        {
          id: '4',
          name: 'Social Media Content Calendar',
          description: 'Creates a content calendar from a Google Doc and schedules posts across Instagram, Twitter, and LinkedIn.',
          user: {
            id: 'u4',
            name: 'Priya Patel',
            avatar: 'P'
          },
          upvotes: 156,
          downvotes: 9,
          commentCount: 18,
          isPublic: true,
          tags: ['social media', 'marketing', 'scheduler'],
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        },
        {
          id: '5',
          name: 'Meeting Notes Summarizer',
          description: 'Transcribes meeting recordings, generates a summary, and sends it to all participants.',
          user: {
            id: 'u5',
            name: 'Carlos Rodriguez',
            avatar: 'C'
          },
          upvotes: 422,
          downvotes: 21,
          commentCount: 65,
          isPublic: true,
          tags: ['meetings', 'productivity', 'transcription'],
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        },
        {
          id: '6',
          name: 'Smart Home Routines',
          description: 'Controls smart home devices based on location, time, and weather conditions. Full smart home automation.',
          user: {
            id: 'u6',
            name: 'Emma Wilson',
            avatar: 'E'
          },
          upvotes: 312,
          downvotes: 18,
          commentCount: 43,
          isPublic: true,
          tags: ['smart home', 'iot', 'automation'],
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) // 12 days ago
        },
        {
          id: '7',
          name: 'Auto Reply for Vacation',
          description: 'Analyzes incoming emails during vacation and sends personalized auto-replies with relevant information.',
          user: {
            id: 'u7',
            name: 'David Kim',
            avatar: 'D'
          },
          upvotes: 198,
          downvotes: 7,
          commentCount: 29,
          isPublic: true,
          tags: ['email', 'vacation', 'communication'],
          createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000) // 9 days ago
        },
        {
          id: '8',
          name: 'Crypto Price Alerts',
          description: 'Monitors cryptocurrency prices and sends alerts when your specified conditions are met.',
          user: {
            id: 'u8',
            name: 'Zoe Martinez',
            avatar: 'Z'
          },
          upvotes: 276,
          downvotes: 13,
          commentCount: 37,
          isPublic: true,
          tags: ['crypto', 'finance', 'alerts'],
          createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
        }
      ];
      
      setTemplates(mockTemplates);
      setFilteredTemplates(mockTemplates);
      setIsLoading(false);
    };
    
    fetchTemplates();
  }, []);
  
  // Filter and sort templates when sort option, search query, or selected tag changes
  useEffect(() => {
    if (templates.length === 0) return;
    
    // Apply search query filter
    let filtered = templates;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(query) || 
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply tag filter
    if (selectedTag) {
      filtered = filtered.filter(template => 
        template.tags.includes(selectedTag)
      );
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'popular':
        filtered = [...filtered].sort((a, b) => b.upvotes - a.upvotes);
        break;
      case 'recent':
        filtered = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'trending':
        // Simulate trending algorithm (recency + popularity)
        filtered = [...filtered].sort((a, b) => {
          const scoreA = a.upvotes * 1 + (Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const scoreB = b.upvotes * 1 + (Date.now() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return scoreB - scoreA;
        });
        break;
    }
    
    setFilteredTemplates(filtered);
  }, [templates, sortBy, searchQuery, selectedTag]);
  
  // Handle upvote
  const handleUpvote = (templateId: string) => {
    setTemplates(prev => 
      prev.map(template => {
        if (template.id === templateId) {
          if (template.userHasUpvoted) {
            // Remove upvote
            return {
              ...template,
              upvotes: template.upvotes - 1,
              userHasUpvoted: false
            };
          } else {
            // Add upvote and remove downvote if exists
            return {
              ...template,
              upvotes: template.upvotes + 1,
              downvotes: template.userHasDownvoted ? template.downvotes - 1 : template.downvotes,
              userHasUpvoted: true,
              userHasDownvoted: false
            };
          }
        }
        return template;
      })
    );
  };
  
  // Handle downvote
  const handleDownvote = (templateId: string) => {
    setTemplates(prev => 
      prev.map(template => {
        if (template.id === templateId) {
          if (template.userHasDownvoted) {
            // Remove downvote
            return {
              ...template,
              downvotes: template.downvotes - 1,
              userHasDownvoted: false
            };
          } else {
            // Add downvote and remove upvote if exists
            return {
              ...template,
              downvotes: template.downvotes + 1,
              upvotes: template.userHasUpvoted ? template.upvotes - 1 : template.upvotes,
              userHasDownvoted: true,
              userHasUpvoted: false
            };
          }
        }
        return template;
      })
    );
  };
  
  // Get all unique tags from templates
  const allTags = Array.from(new Set(templates.flatMap(template => template.tags)));
  
  // Format the date
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays}d ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}mo ago`;
    }
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears}y ago`;
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Community Templates</h1>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg 
                className="h-5 w-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="popular">Most Popular</option>
            <option value="recent">Most Recent</option>
            <option value="trending">Trending</option>
          </select>
          
          <Link 
            href="/social/share"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
              />
            </svg>
            Share Template
          </Link>
        </div>
      </div>
      
      {/* Tags filter */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
              selectedTag === null
                ? 'bg-primary text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            All
          </button>
          
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                tag === selectedTag
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
      
      {/* Templates list */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
              <div className="flex gap-2 mb-4">
                <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 w-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg 
                className="w-12 h-12 mx-auto text-gray-400 mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <h3 className="text-lg font-medium mb-2">No templates found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery 
                  ? `No results found for "${searchQuery}"`
                  : selectedTag
                  ? `No templates found with tag #${selectedTag}`
                  : 'Try adjusting your filters or create your own template'
                }
              </p>
              <Link 
                href="/social/share"
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              >
                Share Template
              </Link>
            </div>
          ) : (
            filteredTemplates.map(template => (
              <div key={template.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="mb-2">
                  <Link 
                    href={`/social/template/${template.id}`}
                    className="text-lg font-semibold hover:text-primary transition-colors"
                  >
                    {template.name}
                  </Link>
                </div>
                
                <p className="text-gray-600 mb-3">{template.description}</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {template.tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full hover:bg-gray-200"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-6">
                    {/* Upvote/Downvote controls */}
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleUpvote(template.id)}
                        className={`flex items-center space-x-1 ${
                          template.userHasUpvoted 
                            ? 'text-green-600' 
                            : 'text-gray-600 hover:text-green-600'
                        }`}
                      >
                        <svg 
                          className="w-5 h-5" 
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
                        <span>{template.upvotes}</span>
                      </button>
                      
                      <button 
                        onClick={() => handleDownvote(template.id)}
                        className={`flex items-center space-x-1 ${
                          template.userHasDownvoted 
                            ? 'text-red-600' 
                            : 'text-gray-600 hover:text-red-600'
                        }`}
                      >
                        <svg 
                          className="w-5 h-5" 
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
                        <span>{template.downvotes}</span>
                      </button>
                    </div>
                    
                    {/* Comments */}
                    <Link 
                      href={`/social/template/${template.id}#comments`}
                      className="flex items-center space-x-1 text-gray-600 hover:text-primary"
                    >
                      <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                        />
                      </svg>
                      <span>{template.commentCount}</span>
                    </Link>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="flex items-center mr-2">
                      <div className="w-6 h-6 flex items-center justify-center bg-primary text-white rounded-full text-xs mr-1">
                        {template.user.avatar}
                      </div>
                      <span>{template.user.name}</span>
                    </div>
                    <span>{formatDate(template.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
