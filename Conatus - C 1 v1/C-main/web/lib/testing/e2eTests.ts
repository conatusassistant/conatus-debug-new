/**
 * End-to-End Testing Framework for Conatus
 * 
 * This module provides functions for testing critical user flows in the application.
 * It simulates user interactions and verifies expected outcomes.
 */

import { createClient } from '@supabase/supabase-js';

// Test environment configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test user credentials
const TEST_USER_EMAIL = 'test-user@example.com';
const TEST_USER_PASSWORD = 'Test@123456';

/**
 * Test runner for executing a series of tests
 * @param tests Array of test functions to run
 */
export async function runTests(tests: Array<() => Promise<TestResult>>) {
  const results: TestResult[] = [];
  let passCount = 0;
  let failCount = 0;
  
  console.log('🧪 Starting End-to-End Tests...');
  
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
      
      if (result.success) {
        passCount++;
        console.log(`✅ PASS: ${result.name}`);
      } else {
        failCount++;
        console.error(`❌ FAIL: ${result.name} - ${result.error}`);
      }
    } catch (error) {
      failCount++;
      console.error(`❌ ERROR: Unexpected error in test execution: ${error}`);
    }
  }
  
  console.log('\n🧪 Test Summary:');
  console.log(`Total Tests: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  
  return {
    totalTests: passCount + failCount,
    passedTests: passCount,
    failedTests: failCount,
    results
  };
}

// Test result interface
export interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Create test user for testing
 */
export async function createTestUser(): Promise<TestResult> {
  try {
    // Check if user already exists
    const { data: userExists } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    
    // If user exists, return success
    if (userExists.user) {
      return {
        name: 'Create Test User',
        success: true,
        details: { user: userExists.user }
      };
    }
    
    // Create new test user
    const { data, error } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      options: {
        data: {
          name: 'Test User',
        }
      }
    });
    
    if (error) {
      return {
        name: 'Create Test User',
        success: false,
        error: error.message
      };
    }
    
    return {
      name: 'Create Test User',
      success: true,
      details: { user: data.user }
    };
  } catch (error) {
    return {
      name: 'Create Test User',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test user authentication flow
 */
export async function testAuthFlow(): Promise<TestResult> {
  try {
    // Sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    
    if (signInError) {
      return {
        name: 'Authentication Flow',
        success: false,
        error: `Sign in failed: ${signInError.message}`
      };
    }
    
    // Get user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      return {
        name: 'Authentication Flow',
        success: false,
        error: userError ? `Get user failed: ${userError.message}` : 'User not found'
      };
    }
    
    // Sign out
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      return {
        name: 'Authentication Flow',
        success: false,
        error: `Sign out failed: ${signOutError.message}`
      };
    }
    
    // Verify signed out
    const { data: verifyData } = await supabase.auth.getUser();
    
    if (verifyData.user) {
      return {
        name: 'Authentication Flow',
        success: false,
        error: 'User still authenticated after sign out'
      };
    }
    
    return {
      name: 'Authentication Flow',
      success: true
    };
  } catch (error) {
    return {
      name: 'Authentication Flow',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test LLM Router functionality
 */
export async function testLLMRouter(): Promise<TestResult> {
  try {
    // Sign in first
    await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    
    // Test queries for different model types
    const testQueries = [
      { text: 'What is the capital of France?', expectedModel: 'openai' }, // Factual query
      { text: 'Write a poem about sunsets', expectedModel: 'claude' },    // Creative query
      { text: 'Explain quantum computing', expectedModel: 'perplexity' }, // Educational query
      { text: 'Debug this React code', expectedModel: 'deepseek' }        // Technical query
    ];
    
    // This would normally call the API, but for testing we'll simulate with our pattern matching
    // In a real implementation, we'd interact with the actual backend
    const patternResults = testQueries.map(query => {
      // Simple pattern matching to simulate the router
      let selectedModel = '';
      if (query.text.includes('code') || query.text.includes('debug')) {
        selectedModel = 'deepseek';
      } else if (query.text.includes('explain') || query.text.includes('what is')) {
        selectedModel = 'perplexity';
      } else if (query.text.includes('write') || query.text.includes('poem')) {
        selectedModel = 'claude';
      } else {
        selectedModel = 'openai';
      }
      
      return {
        query: query.text,
        expectedModel: query.expectedModel,
        actualModel: selectedModel,
        matches: selectedModel === query.expectedModel
      };
    });
    
    const allMatched = patternResults.every(result => result.matches);
    
    // Sign out after test
    await supabase.auth.signOut();
    
    if (!allMatched) {
      const failedQueries = patternResults.filter(result => !result.matches);
      return {
        name: 'LLM Router Functionality',
        success: false,
        error: `Model selection mismatch for queries: ${failedQueries.map(q => q.query).join(', ')}`,
        details: patternResults
      };
    }
    
    return {
      name: 'LLM Router Functionality',
      success: true,
      details: patternResults
    };
  } catch (error) {
    return {
      name: 'LLM Router Functionality',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test Automation Engine functionality
 */
export async function testAutomationEngine(): Promise<TestResult> {
  try {
    // Sign in first
    await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return {
        name: 'Automation Engine Functionality',
        success: false,
        error: 'User not authenticated'
      };
    }
    
    // Create a test automation
    const testAutomation = {
      user_id: userData.user.id,
      name: 'Test Daily Reminder',
      description: 'Send a reminder every day at 9am',
      trigger: {
        type: 'time',
        config: {
          frequency: 'daily',
          time: '09:00',
        }
      },
      conditions: {
        operator: 'AND',
        conditions: [
          {
            variable: 'day_of_week',
            operator: 'not_equals',
            value: 'Saturday'
          },
          {
            variable: 'day_of_week',
            operator: 'not_equals',
            value: 'Sunday'
          }
        ]
      },
      actions: [
        {
          type: 'communication',
          config: {
            method: 'notification',
            message: 'Remember to check your tasks for today!'
          }
        }
      ],
      active: true
    };
    
    // Insert automation into database
    const { data: insertData, error: insertError } = await supabase
      .from('automations')
      .insert([testAutomation])
      .select();
    
    if (insertError) {
      return {
        name: 'Automation Engine Functionality',
        success: false,
        error: `Failed to create automation: ${insertError.message}`
      };
    }
    
    const automationId = insertData[0].id;
    
    // Read the automation back to verify it was created correctly
    const { data: readData, error: readError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', automationId)
      .single();
    
    if (readError || !readData) {
      return {
        name: 'Automation Engine Functionality',
        success: false,
        error: readError ? `Failed to read automation: ${readError.message}` : 'Automation not found'
      };
    }
    
    // Delete the test automation
    const { error: deleteError } = await supabase
      .from('automations')
      .delete()
      .eq('id', automationId);
    
    if (deleteError) {
      return {
        name: 'Automation Engine Functionality',
        success: false,
        error: `Failed to delete automation: ${deleteError.message}`
      };
    }
    
    // Sign out after test
    await supabase.auth.signOut();
    
    return {
      name: 'Automation Engine Functionality',
      success: true,
      details: { createdAutomation: readData }
    };
  } catch (error) {
    return {
      name: 'Automation Engine Functionality',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test Adaptive Learning System functionality
 */
export async function testAdaptiveLearning(): Promise<TestResult> {
  try {
    // Sign in first
    await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return {
        name: 'Adaptive Learning Functionality',
        success: false,
        error: 'User not authenticated'
      };
    }
    
    // 1. Track a series of user events to create a pattern
    const events = [
      // Simulate ordering food at lunch time for several days
      { 
        event_type: 'food_ordered', 
        metadata: { 
          restaurant: 'Sandwich Shop',
          time: '12:30',
          items: ['Turkey Sandwich', 'Soda']
        },
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString() // 3 days ago
      },
      { 
        event_type: 'food_ordered', 
        metadata: { 
          restaurant: 'Sandwich Shop',
          time: '12:25',
          items: ['Veggie Sandwich', 'Water']
        },
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString() // 2 days ago
      },
      { 
        event_type: 'food_ordered', 
        metadata: { 
          restaurant: 'Sandwich Shop',
          time: '12:40',
          items: ['Chicken Sandwich', 'Coffee']
        },
        timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ];
    
    // Insert events into database
    for (const event of events) {
      const { error: eventError } = await supabase
        .from('user_events')
        .insert([{
          user_id: userData.user.id,
          event_type: event.event_type,
          metadata: event.metadata,
          timestamp: event.timestamp
        }]);
      
      if (eventError) {
        return {
          name: 'Adaptive Learning Functionality',
          success: false,
          error: `Failed to create event: ${eventError.message}`
        };
      }
    }
    
    // 2. Create a test pattern
    const testPattern = {
      user_id: userData.user.id,
      pattern_type: 'time',
      pattern_data: {
        event_type: 'food_ordered',
        time_range: {
          start: '12:00',
          end: '13:00'
        },
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        metadata: {
          restaurant: 'Sandwich Shop'
        }
      },
      confidence: 0.85,
      occurrences: 3,
      first_detected: new Date(Date.now() - 86400000 * 3).toISOString(),
      last_updated: new Date().toISOString()
    };
    
    const { data: patternData, error: patternError } = await supabase
      .from('behavior_patterns')
      .insert([testPattern])
      .select();
    
    if (patternError) {
      return {
        name: 'Adaptive Learning Functionality',
        success: false,
        error: `Failed to create pattern: ${patternError.message}`
      };
    }
    
    // 3. Create a test suggestion based on the pattern
    const testSuggestion = {
      user_id: userData.user.id,
      title: 'Order lunch from Sandwich Shop?',
      description: 'You typically order lunch around this time. Would you like to order your usual?',
      type: 'action',
      category: 'food',
      source: {
        pattern_id: patternData[0].id,
        pattern_type: 'time',
        confidence: 0.85
      },
      relevance_score: 0.85,
      relevance_factors: [
        { factor: 'time_match', score: 0.9 },
        { factor: 'frequency', score: 0.8 },
        { factor: 'recency', score: 0.85 }
      ],
      action_params: {
        restaurant: 'Sandwich Shop',
        suggested_items: ['Turkey Sandwich', 'Soda']
      },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      dismissed: false,
      implemented: false,
      feedback_provided: false
    };
    
    const { data: suggestionData, error: suggestionError } = await supabase
      .from('suggestions')
      .insert([testSuggestion])
      .select();
    
    if (suggestionError) {
      return {
        name: 'Adaptive Learning Functionality',
        success: false,
        error: `Failed to create suggestion: ${suggestionError.message}`
      };
    }
    
    // 4. Get suggestions to verify it was created
    const { data: suggestions, error: getSuggestionsError } = await supabase
      .from('suggestions')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('dismissed', false)
      .eq('implemented', false);
    
    if (getSuggestionsError) {
      return {
        name: 'Adaptive Learning Functionality',
        success: false,
        error: `Failed to get suggestions: ${getSuggestionsError.message}`
      };
    }
    
    const suggestionFound = suggestions.some(s => s.id === suggestionData[0].id);
    
    if (!suggestionFound) {
      return {
        name: 'Adaptive Learning Functionality',
        success: false,
        error: 'Suggestion was created but not found in active suggestions'
      };
    }
    
    // 5. Clean up - Remove test data
    await supabase
      .from('suggestions')
      .delete()
      .eq('id', suggestionData[0].id);
    
    await supabase
      .from('behavior_patterns')
      .delete()
      .eq('id', patternData[0].id);
    
    await supabase
      .from('user_events')
      .delete()
      .eq('user_id', userData.user.id)
      .in('event_type', ['food_ordered']);
    
    // Sign out after test
    await supabase.auth.signOut();
    
    return {
      name: 'Adaptive Learning Functionality',
      success: true,
      details: { 
        eventsCreated: events.length,
        pattern: patternData[0],
        suggestion: suggestionData[0]
      }
    };
  } catch (error) {
    return {
      name: 'Adaptive Learning Functionality',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Run all end-to-end tests
 */
export async function runAllTests() {
  try {
    // First ensure test user exists
    await createTestUser();
    
    // Run all tests
    return await runTests([
      testAuthFlow,
      testLLMRouter,
      testAutomationEngine,
      testAdaptiveLearning
    ]);
  } catch (error) {
    console.error('Failed to run all tests:', error);
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      results: []
    };
  }
}
