// backend/services/analytics/AnalyticsService.js
/**
 * Analytics Service
 * 
 * Provides unified analytics tracking and reporting for the Conatus platform.
 * Handles both internal analytics (stored in Supabase) and external tracking
 * via third-party services when applicable.
 */

const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.REDIS_URL);

class AnalyticsService {
  /**
   * Track a user session
   * @param {string} userId - User ID
   * @param {Object} sessionData - Session data
   * @returns {Promise<Object>} - Session record
   */
  async trackSession(userId, sessionData = {}) {
    try {
      const { ip, userAgent } = sessionData;
      
      // Generate session ID if not provided
      const sessionId = sessionData.sessionId || uuidv4();
      
      // Parse user agent
      const deviceInfo = {};
      if (userAgent) {
        const parser = new UAParser(userAgent);
        const result = parser.getResult();
        
        deviceInfo.browser = {
          name: result.browser.name,
          version: result.browser.version
        };
        
        deviceInfo.os = {
          name: result.os.name,
          version: result.os.version
        };
        
        deviceInfo.device = {
          type: result.device.type || 'desktop',
          vendor: result.device.vendor,
          model: result.device.model
        };
      }
      
      // Check for existing session
      const { data: existingSession, error: sessionError } = await supabase
        .from('user_activity')
        .select('id, page_views, query_count, automation_count, social_interactions')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .single();
      
      if (sessionError && sessionError.code !== 'PGRST116') { // Not found error
        throw sessionError;
      }
      
      if (existingSession) {
        // Update existing session
        const { data: updatedSession, error: updateError } = await supabase
          .from('user_activity')
          .update({
            last_active: new Date().toISOString(),
            page_views: existingSession.page_views + 1,
            ip_address: ip || existingSession.ip_address
          })
          .eq('id', existingSession.id)
          .select();
        
        if (updateError) {
          throw updateError;
        }
        
        return updatedSession[0];
      } else {
        // Create new session
        const { data: newSession, error: createError } = await supabase
          .from('user_activity')
          .insert({
            user_id: userId,
            session_id: sessionId,
            ip_address: ip,
            device_info: deviceInfo,
            first_active: new Date().toISOString(),
            last_active: new Date().toISOString(),
            page_views: 1
          })
          .select();
        
        if (createError) {
          throw createError;
        }
        
        return newSession[0];
      }
    } catch (error) {
      console.error('Error tracking session:', error);
      // Return a minimal object so UI doesn't break
      return {
        user_id: userId,
        session_id: sessionData.sessionId || uuidv4(),
        page_views: 1
      };
    }
  }

  /**
   * Track a page view
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} path - Page path
   * @param {Object} additionalData - Additional tracking data
   * @returns {Promise<void>}
   */
  async trackPageView(userId, sessionId, path, additionalData = {}) {
    try {
      // Update user activity last_active time and increment page views
      const { error: updateError } = await supabase
        .from('user_activity')
        .update({
          last_active: new Date().toISOString(),
          page_views: supabase.rpc('increment_counter', { row_id: sessionId, counter_name: 'page_views' })
        })
        .eq('user_id', userId)
        .eq('session_id', sessionId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Log page view in analytics_events
      await supabase.from('analytics_events').insert({
        user_id: userId,
        session_id: sessionId,
        event_type: 'page_view',
        path,
        properties: additionalData,
        timestamp: new Date().toISOString()
      });
      
      // Increment page view count in Redis for real-time stats
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await redis.hincrby(`analytics:pageviews:${today}`, path || 'unknown', 1);
      await redis.expire(`analytics:pageviews:${today}`, 604800); // 7 days TTL
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }

  /**
   * Track a query/conversation event
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} conversationId - Conversation ID
   * @param {Object} queryData - Query data including tokens, provider, etc.
   * @returns {Promise<void>}
   */
  async trackQuery(userId, sessionId, conversationId, queryData = {}) {
    try {
      // Update user activity
      const { error: updateError } = await supabase
        .from('user_activity')
        .update({
          last_active: new Date().toISOString(),
          query_count: supabase.rpc('increment_counter', { row_id: sessionId, counter_name: 'query_count' })
        })
        .eq('user_id', userId)
        .eq('session_id', sessionId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Log query in analytics_events
      await supabase.from('analytics_events').insert({
        user_id: userId,
        session_id: sessionId,
        event_type: 'query',
        reference_id: conversationId,
        properties: {
          provider: queryData.provider,
          model: queryData.model,
          token_count: queryData.tokenCount,
          response_time_ms: queryData.responseTime,
          query_type: queryData.queryType || 'chat',
          from_cache: queryData.fromCache || false
        },
        timestamp: new Date().toISOString()
      });
      
      // Update real-time stats in Redis
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await redis.hincrby(`analytics:queries:${today}`, queryData.provider || 'unknown', 1);
      await redis.hincrby(`analytics:queries:${today}:tokens`, queryData.provider || 'unknown', queryData.tokenCount || 0);
      await redis.expire(`analytics:queries:${today}`, 604800); // 7 days TTL
      await redis.expire(`analytics:queries:${today}:tokens`, 604800); // 7 days TTL
    } catch (error) {
      console.error('Error tracking query:', error);
    }
  }

  /**
   * Track an automation event
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} automationId - Automation ID
   * @param {Object} automationData - Automation data
   * @returns {Promise<void>}
   */
  async trackAutomation(userId, sessionId, automationId, automationData = {}) {
    try {
      // Update user activity
      const { error: updateError } = await supabase
        .from('user_activity')
        .update({
          last_active: new Date().toISOString(),
          automation_count: supabase.rpc('increment_counter', { row_id: sessionId, counter_name: 'automation_count' })
        })
        .eq('user_id', userId)
        .eq('session_id', sessionId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Log automation in analytics_events
      await supabase.from('analytics_events').insert({
        user_id: userId,
        session_id: sessionId,
        event_type: 'automation',
        reference_id: automationId,
        properties: {
          automation_type: automationData.type,
          service: automationData.service,
          status: automationData.status,
          execution_time_ms: automationData.executionTime,
          trigger_type: automationData.triggerType || 'manual',
          is_scheduled: automationData.isScheduled || false
        },
        timestamp: new Date().toISOString()
      });
      
      // Update real-time stats in Redis
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await redis.hincrby(`analytics:automations:${today}`, automationData.type || 'unknown', 1);
      await redis.hincrby(`analytics:automations:${today}:services`, automationData.service || 'unknown', 1);
      await redis.expire(`analytics:automations:${today}`, 604800); // 7 days TTL
      await redis.expire(`analytics:automations:${today}:services`, 604800); // 7 days TTL
    } catch (error) {
      console.error('Error tracking automation:', error);
    }
  }

  /**
   * Track a social interaction event
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} interactionType - Type of interaction (view, vote, comment, share)
   * @param {Object} interactionData - Interaction data
   * @returns {Promise<void>}
   */
  async trackSocialInteraction(userId, sessionId, interactionType, interactionData = {}) {
    try {
      // Update user activity
      const { error: updateError } = await supabase
        .from('user_activity')
        .update({
          last_active: new Date().toISOString(),
          social_interactions: supabase.rpc('increment_counter', { row_id: sessionId, counter_name: 'social_interactions' })
        })
        .eq('user_id', userId)
        .eq('session_id', sessionId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Log social interaction in analytics_events
      await supabase.from('analytics_events').insert({
        user_id: userId,
        session_id: sessionId,
        event_type: `social_${interactionType}`,
        reference_id: interactionData.postId || interactionData.commentId,
        properties: interactionData,
        timestamp: new Date().toISOString()
      });
      
      // Update real-time stats in Redis
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await redis.hincrby(`analytics:social:${today}`, interactionType || 'unknown', 1);
      await redis.expire(`analytics:social:${today}`, 604800); // 7 days TTL
    } catch (error) {
      console.error('Error tracking social interaction:', error);
    }
  }

  /**
   * Track an error event
   * @param {string} userId - User ID (optional)
   * @param {string} sessionId - Session ID (optional)
   * @param {string} errorType - Type of error
   * @param {Object} errorData - Error data
   * @returns {Promise<void>}
   */
  async trackError(userId, sessionId, errorType, errorData = {}) {
    try {
      // Log error in analytics_events
      await supabase.from('analytics_events').insert({
        user_id: userId || null,
        session_id: sessionId || null,
        event_type: 'error',
        properties: {
          error_type: errorType,
          error_message: errorData.message,
          error_stack: errorData.stack,
          path: errorData.path,
          component: errorData.component,
          browser: errorData.browser,
          os: errorData.os
        },
        timestamp: new Date().toISOString()
      });
      
      // Also insert into error_logs for easier querying
      await supabase.from('error_logs').insert({
        user_id: userId || null,
        error_type: errorType,
        error_message: errorData.message || 'Unknown error',
        error_stack: errorData.stack,
        context: {
          path: errorData.path,
          component: errorData.component,
          browser: errorData.browser,
          os: errorData.os
        },
        request_id: errorData.requestId,
        path: errorData.path,
        method: errorData.method,
        status_code: errorData.statusCode
      });
      
      // Update error count in Redis for real-time monitoring
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await redis.hincrby(`analytics:errors:${today}`, errorType || 'unknown', 1);
      await redis.expire(`analytics:errors:${today}`, 604800); // 7 days TTL
    } catch (error) {
      console.error('Error tracking error event:', error);
    }
  }

  /**
   * Get real-time statistics for dashboard
   * @returns {Promise<Object>} - Dashboard statistics
   */
  async getDashboardStats() {
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      
      // Fetch data from Redis
      const [
        todayPageViews,
        todayQueries,
        todayTokens,
        todayAutomations,
        todaySocial,
        todayErrors,
        yesterdayPageViews,
        yesterdayQueries,
        activeUsers
      ] = await Promise.all([
        redis.hgetall(`analytics:pageviews:${today}`),
        redis.hgetall(`analytics:queries:${today}`),
        redis.hgetall(`analytics:queries:${today}:tokens`),
        redis.hgetall(`analytics:automations:${today}`),
        redis.hgetall(`analytics:social:${today}`),
        redis.hgetall(`analytics:errors:${today}`),
        redis.hgetall(`analytics:pageviews:${yesterdayStr}`),
        redis.hgetall(`analytics:queries:${yesterdayStr}`),
        this.getActiveUsers()
      ]);
      
      // Calculate totals
      const totalPageViews = Object.values(todayPageViews || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      const totalQueries = Object.values(todayQueries || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      const totalTokens = Object.values(todayTokens || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      const totalAutomations = Object.values(todayAutomations || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      const totalSocial = Object.values(todaySocial || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      const totalErrors = Object.values(todayErrors || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      
      // Compare with yesterday
      const yesterdayPageViewsTotal = Object.values(yesterdayPageViews || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      const yesterdayQueriesTotal = Object.values(yesterdayQueries || {}).reduce((sum, val) => sum + parseInt(val, 10), 0);
      
      const pageViewsChange = yesterdayPageViewsTotal ? ((totalPageViews - yesterdayPageViewsTotal) / yesterdayPageViewsTotal) * 100 : 0;
      const queriesChange = yesterdayQueriesTotal ? ((totalQueries - yesterdayQueriesTotal) / yesterdayQueriesTotal) * 100 : 0;
      
      return {
        overview: {
          pageViews: {
            total: totalPageViews,
            change: pageViewsChange
          },
          queries: {
            total: totalQueries,
            change: queriesChange
          },
          automations: {
            total: totalAutomations
          },
          activeUsers: activeUsers
        },
        breakdowns: {
          queries: todayQueries || {},
          tokens: todayTokens || {},
          automations: todayAutomations || {},
          social: todaySocial || {},
          errors: todayErrors || {}
        }
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return {
        overview: {
          pageViews: { total: 0, change: 0 },
          queries: { total: 0, change: 0 },
          automations: { total: 0 },
          activeUsers: { today: 0, week: 0, month: 0 }
        },
        breakdowns: {
          queries: {},
          tokens: {},
          automations: {},
          social: {},
          errors: {}
        }
      };
    }
  }

  /**
   * Get active users count for different time periods
   * @returns {Promise<Object>} - Active users counts
   */
  async getActiveUsers() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now);
      oneDayAgo.setDate(now.getDate() - 1);
      
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(now.getDate() - 7);
      
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      
      // Get counts from database
      const [dailyActive, weeklyActive, monthlyActive] = await Promise.all([
        supabase
          .from('user_activity')
          .select('user_id')
          .gt('last_active', oneDayAgo.toISOString())
          .then(res => res.data ? new Set(res.data.map(u => u.user_id)).size : 0),
          
        supabase
          .from('user_activity')
          .select('user_id')
          .gt('last_active', oneWeekAgo.toISOString())
          .then(res => res.data ? new Set(res.data.map(u => u.user_id)).size : 0),
          
        supabase
          .from('user_activity')
          .select('user_id')
          .gt('last_active', oneMonthAgo.toISOString())
          .then(res => res.data ? new Set(res.data.map(u => u.user_id)).size : 0)
      ]);
      
      return {
        today: dailyActive,
        week: weeklyActive,
        month: monthlyActive
      };
    } catch (error) {
      console.error('Error getting active users:', error);
      return { today: 0, week: 0, month: 0 };
    }
  }

  /**
   * Get user activity report
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User activity report
   */
  async getUserActivity(userId) {
    try {
      // Get user's session history
      const { data: sessions, error: sessionError } = await supabase
        .from('user_activity')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })
        .limit(10);
      
      if (sessionError) {
        throw sessionError;
      }
      
      // Get event history
      const { data: events, error: eventError } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (eventError) {
        throw eventError;
      }
      
      // Get token usage
      const { data: tokenUsage, error: tokenError } = await supabase.rpc(
        'get_user_token_usage_summary',
        { user_id_input: userId, days_back: 30 }
      );
      
      if (tokenError) {
        throw tokenError;
      }
      
      // Calculate metrics
      const totalQueries = events.filter(e => e.event_type === 'query').length;
      const totalAutomations = events.filter(e => e.event_type === 'automation').length;
      const totalSocial = events.filter(e => e.event_type.startsWith('social_')).length;
      
      // Calculate total token usage
      const tokenUsageByDay = {};
      const tokenUsageByProvider = {};
      
      for (const usage of tokenUsage) {
        // Aggregate by day
        if (!tokenUsageByDay[usage.day]) {
          tokenUsageByDay[usage.day] = {
            tokens: 0,
            cost: 0,
            queries: 0
          };
        }
        
        tokenUsageByDay[usage.day].tokens += usage.total_tokens;
        tokenUsageByDay[usage.day].cost += parseFloat(usage.total_cost);
        tokenUsageByDay[usage.day].queries += usage.query_count;
        
        // Aggregate by provider
        if (!tokenUsageByProvider[usage.provider]) {
          tokenUsageByProvider[usage.provider] = {
            tokens: 0,
            cost: 0,
            queries: 0
          };
        }
        
        tokenUsageByProvider[usage.provider].tokens += usage.total_tokens;
        tokenUsageByProvider[usage.provider].cost += parseFloat(usage.total_cost);
        tokenUsageByProvider[usage.provider].queries += usage.query_count;
      }
      
      return {
        sessions,
        activity: {
          totalQueries,
          totalAutomations,
          totalSocial,
          recentEvents: events.slice(0, 10) // Most recent 10 events
        },
        tokenUsage: {
          byDay: tokenUsageByDay,
          byProvider: tokenUsageByProvider,
          total: {
            tokens: tokenUsage.reduce((sum, item) => sum + item.total_tokens, 0),
            cost: tokenUsage.reduce((sum, item) => sum + parseFloat(item.total_cost), 0),
            queries: tokenUsage.reduce((sum, item) => sum + item.query_count, 0)
          }
        }
      };
    } catch (error) {
      console.error('Error getting user activity:', error);
      return {
        sessions: [],
        activity: {
          totalQueries: 0,
          totalAutomations: 0,
          totalSocial: 0,
          recentEvents: []
        },
        tokenUsage: {
          byDay: {},
          byProvider: {},
          total: { tokens: 0, cost: 0, queries: 0 }
        }
      };
    }
  }

  /**
   * Generate user insights based on activity
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User insights
   */
  async generateUserInsights(userId) {
    try {
      // Get user activity data
      const activityData = await this.getUserActivity(userId);
      
      // Get user's automations
      const { data: automations, error: automationError } = await supabase
        .from('automations')
        .select('*')
        .eq('user_id', userId);
      
      if (automationError) {
        throw automationError;
      }
      
      // Get user's most used services
      const { data: serviceConnections, error: serviceError } = await supabase
        .from('service_connections')
        .select('*')
        .eq('user_id', userId);
      
      if (serviceError) {
        throw serviceError;
      }
      
      // Generate insights
      const insights = [];
      
      // Usage pattern insights
      if (activityData.activity.totalQueries > 0) {
        // Most active time of day
        const eventsByHour = {};
        activityData.sessions.forEach(session => {
          const hour = new Date(session.last_active).getHours();
          eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;
        });
        
        const mostActiveHour = Object.entries(eventsByHour)
          .sort((a, b) => b[1] - a[1])
          .map(([hour]) => parseInt(hour))[0];
        
        if (mostActiveHour !== undefined) {
          insights.push({
            type: 'usage_pattern',
            title: 'Most Active Time',
            description: `You're most active around ${mostActiveHour}:00${mostActiveHour >= 12 ? 'PM' : 'AM'}.`,
            data: { hour: mostActiveHour }
          });
        }
        
        // Provider preference
        const providers = Object.keys(activityData.tokenUsage.byProvider);
        if (providers.length > 0) {
          const favoriteProvider = providers.sort((a, b) => 
            activityData.tokenUsage.byProvider[b].queries - 
            activityData.tokenUsage.byProvider[a].queries
          )[0];
          
          insights.push({
            type: 'preference',
            title: 'Preferred AI Model',
            description: `You use ${favoriteProvider} more than other AI models.`,
            data: { provider: favoriteProvider }
          });
        }
      }
      
      // Automation opportunities
      if (activityData.activity.totalQueries > 20 && automations.length < 3) {
        insights.push({
          type: 'opportunity',
          title: 'Automation Opportunity',
          description: 'You're using the app frequently but have few automations. Setting up automations could save you time.',
          data: { query_count: activityData.activity.totalQueries, automation_count: automations.length }
        });
      }
      
      // Service connection opportunities
      const connectedServices = serviceConnections.map(c => c.service_id);
      const commonServices = ['gmail', 'whatsapp', 'google_calendar'];
      const missingServices = commonServices.filter(s => !connectedServices.includes(s));
      
      if (missingServices.length > 0) {
        insights.push({
          type: 'opportunity',
          title: 'Connect More Services',
          description: `Connect popular services like ${missingServices.join(', ')} to unlock more automation possibilities.`,
          data: { missing_services: missingServices }
        });
      }
      
      // Cost optimization insights
      if (activityData.tokenUsage.total.cost > 5) {
        const mostExpensiveProvider = Object.entries(activityData.tokenUsage.byProvider)
          .sort((a, b) => b[1].cost - a[1].cost)
          .map(([provider]) => provider)[0];
        
        insights.push({
          type: 'cost',
          title: 'Cost Optimization',
          description: `Your usage of ${mostExpensiveProvider} accounts for a significant portion of your costs. Consider using cheaper options for simpler queries.`,
          data: { 
            provider: mostExpensiveProvider,
            cost: activityData.tokenUsage.byProvider[mostExpensiveProvider].cost
          }
        });
      }
      
      return {
        insights,
        usage_summary: {
          queries: activityData.activity.totalQueries,
          automations: automations.length,
          connected_services: connectedServices.length,
          total_cost: activityData.tokenUsage.total.cost.toFixed(2)
        }
      };
    } catch (error) {
      console.error('Error generating user insights:', error);
      return {
        insights: [],
        usage_summary: {
          queries: 0,
          automations: 0,
          connected_services: 0,
          total_cost: 0
        }
      };
    }
  }
}

module.exports = new AnalyticsService();

// frontend/src/components/dashboard/AnalyticsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchDashboardStats } from '../../store/analytics';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import InfoCard from '../common/InfoCard';
import Spinner from '../common/Spinner';
import ErrorAlert from '../common/ErrorAlert';
import './AnalyticsDashboard.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AnalyticsDashboard = () => {
  const dispatch = useDispatch();
  const { stats, loading, error } = useSelector(state => state.analytics);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [timeRange, setTimeRange] = useState('day');
  
  // Fetch dashboard stats on mount and set up refresh interval
  useEffect(() => {
    dispatch(fetchDashboardStats());
    
    // Refresh data every 5 minutes
    const interval = setInterval(() => {
      dispatch(fetchDashboardStats());
    }, 300000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [dispatch]);
  
  // Format numbers for display
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };
  
  // Generate chart data for queries by provider
  const generateQueryChart = () => {
    if (!stats || !stats.breakdowns || !stats.breakdowns.queries) {
      return null;
    }
    
    const providers = Object.keys(stats.breakdowns.queries);
    const counts = providers.map(provider => parseInt(stats.breakdowns.queries[provider], 10));
    
    const data = {
      labels: providers,
      datasets: [
        {
          label: 'Queries',
          data: counts,
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
    
    return data;
  };
  
  // Generate chart data for token usage by provider
  const generateTokenChart = () => {
    if (!stats || !stats.breakdowns || !stats.breakdowns.tokens) {
      return null;
    }
    
    const providers = Object.keys(stats.breakdowns.tokens);
    const counts = providers.map(provider => parseInt(stats.breakdowns.tokens[provider], 10));
    
    const data = {
      labels: providers,
      datasets: [
        {
          label: 'Tokens',
          data: counts,
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
    
    return data;
  };
  
  // Calculate change percentage for display
  const getChangeDisplay = (change) => {
    if (change === 0) return "0%";
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  };
  
  // Get trend color class based on change direction
  const getTrendClass = (change) => {
    if (change > 0) return 'trend-up';
    if (change < 0) return 'trend-down';
    return '';
  };
  
  // If loading, show spinner
  if (loading && !stats) {
    return (
      <div className="analytics-dashboard loading">
        <Spinner size="large" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }
  
  // If error, show error message
  if (error) {
    return <ErrorAlert message={error} />;
  }
  
  // If no stats yet, show loading
  if (!stats || !stats.overview) {
    return (
      <div className="analytics-dashboard loading">
        <Spinner size="large" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }
  
  // Chart data
  const queryChartData = generateQueryChart();
  const tokenChartData = generateTokenChart();
  
  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <div className="dashboard-actions">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button 
            className="refresh-button"
            onClick={() => dispatch(fetchDashboardStats())}
            disabled={loading}
          >
            {loading ? <Spinner size="small" /> : 'Refresh'}
          </button>
        </div>
      </div>
      
      <div className="metrics-overview">
        <InfoCard 
          title="Total Page Views"
          value={formatNumber(stats.overview.pageViews.total)}
          change={getChangeDisplay(stats.overview.pageViews.change)}
          trendClass={getTrendClass(stats.overview.pageViews.change)}
          icon="eye"
        />
        <InfoCard 
          title="Total Queries"
          value={formatNumber(stats.overview.queries.total)}
          change={getChangeDisplay(stats.overview.queries.change)}
          trendClass={getTrendClass(stats.overview.queries.change)}
          icon="message-square"
        />
        <InfoCard 
          title="Automations"
          value={formatNumber(stats.overview.automations.total)}
          icon="zap"
        />
        <InfoCard 
          title="Active Users"
          value={formatNumber(stats.overview.activeUsers.today)}
          subtitle={`${formatNumber(stats.overview.activeUsers.week)} weekly`}
          icon="users"
        />
      </div>
      
      <div className="charts-container">
        <div className="chart-card">
          <h2>Queries by Provider</h2>
          {queryChartData ? (
            <div className="chart-container">
              <Pie data={queryChartData} />
            </div>
          ) : (
            <p className="no-data">No data available</p>
          )}
        </div>
        
        <div className="chart-card">
          <h2>Token Usage by Provider</h2>
          {tokenChartData ? (
            <div className="chart-container">
              <Bar 
                data={tokenChartData}
                options={{
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }}
              />
            </div>
          ) : (
            <p className="no-data">No data available</p>
          )}
        </div>
      </div>
      
      <div className="additional-metrics">
        <div className="metrics-card">
          <h2>Automations</h2>
          <div className="metrics-list">
            {stats.breakdowns.automations && Object.entries(stats.breakdowns.automations).length > 0 ? (
              Object.entries(stats.breakdowns.automations).map(([type, count]) => (
                <div className="metric-item" key={type}>
                  <span className="metric-name">{type}</span>
                  <span className="metric-value">{count}</span>
                </div>
              ))
            ) : (
              <p className="no-data">No automation data available</p>
            )}
          </div>
        </div>
        
        <div className="metrics-card">
          <h2>Social</h2>
          <div className="metrics-list">
            {stats.breakdowns.social && Object.entries(stats.breakdowns.social).length > 0 ? (
              Object.entries(stats.breakdowns.social).map(([type, count]) => (
                <div className="metric-item" key={type}>
                  <span className="metric-name">{type}</span>
                  <span className="metric-value">{count}</span>
                </div>
              ))
            ) : (
              <p className="no-data">No social data available</p>
            )}
          </div>
        </div>
        
        <div className="metrics-card error-card">
          <h2>Errors</h2>
          <div className="metrics-list">
            {stats.breakdowns.errors && Object.entries(stats.breakdowns.errors).length > 0 ? (
              Object.entries(stats.breakdowns.errors).map(([type, count]) => (
                <div className="metric-item" key={type}>
                  <span className="metric-name">{type}</span>
                  <span className="metric-value">{count}</span>
                </div>
              ))
            ) : (
              <p className="no-data">No errors (that's good!)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

// frontend/src/components/profile/UserInsights.jsx
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUserInsights } from '../../store/analytics';
import InfoCard from '../common/InfoCard';
import Spinner from '../common/Spinner';
import ErrorAlert from '../common/ErrorAlert';
import './UserInsights.css';

const UserInsights = () => {
  const dispatch = useDispatch();
  const { userInsights, loading, error } = useSelector(state => state.analytics);
  const { id: userId } = useSelector(state => state.auth.user || {});
  
  useEffect(() => {
    if (userId) {
      dispatch(fetchUserInsights(userId));
    }
  }, [dispatch, userId]);
  
  // Format currency for display
  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };
  
  // Get icon for insight type
  const getInsightIcon = (type) => {
    switch (type) {
      case 'usage_pattern':
        return 'clock';
      case 'preference':
        return 'heart';
      case 'opportunity':
        return 'lightbulb';
      case 'cost':
        return 'dollar-sign';
      default:
        return 'info';
    }
  };
  
  // If loading, show spinner
  if (loading && !userInsights) {
    return (
      <div className="user-insights loading">
        <Spinner size="large" />
        <p>Analyzing your usage patterns...</p>
      </div>
    );
  }
  
  // If error, show error message
  if (error) {
    return <ErrorAlert message={error} />;
  }
  
  // If no insights yet, show loading
  if (!userInsights || !userInsights.insights) {
    return (
      <div className="user-insights loading">
        <Spinner size="large" />
        <p>Analyzing your usage patterns...</p>
      </div>
    );
  }
  
  const { insights, usage_summary } = userInsights;
  
  return (
    <div className="user-insights">
      <div className="insights-header">
        <h1>Your Insights</h1>
        <button 
          className="refresh-button"
          onClick={() => dispatch(fetchUserInsights(userId))}
          disabled={loading}
        >
          {loading ? <Spinner size="small" /> : 'Refresh'}
        </button>
      </div>
      
      <div className="usage-summary">
        <InfoCard 
          title="Total Queries"
          value={usage_summary.queries}
          icon="message-square"
        />
        <InfoCard 
          title="Automations"
          value={usage_summary.automations}
          icon="zap"
        />
        <InfoCard 
          title="Connected Services"
          value={usage_summary.connected_services}
          icon="link"
        />
        <InfoCard 
          title="Token Costs"
          value={formatCurrency(usage_summary.total_cost)}
          icon="dollar-sign"
        />
      </div>
      
      <div className="insights-list">
        <h2>Personalized Insights</h2>
        {insights.length > 0 ? (
          insights.map((insight, index) => (
            <div className={`insight-card ${insight.type}`} key={index}>
              <div className="insight-icon">
                <i className={`icon-${getInsightIcon(insight.type)}`}></i>
              </div>
              <div className="insight-content">
                <h3>{insight.title}</h3>
                <p>{insight.description}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="no-insights">
            <p>We're still collecting data to generate personalized insights. Check back after using the app more.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserInsights;
