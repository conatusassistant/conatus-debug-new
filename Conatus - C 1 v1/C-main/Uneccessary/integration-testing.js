// tests/integration/setupTests.js
/**
 * Integration Testing Setup
 * 
 * This file configures the environment for integration tests,
 * including test database setup and cleanup.
 */

// Use dotenv for environment variables in tests
require('dotenv').config({ path: '.env.test' });

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

// Create Supabase client for the test database
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Set up test database before all tests
 */
beforeAll(async () => {
  try {
    console.log('Setting up test database...');
    
    // Option 1: Reset database using migrations
    // This will apply all migrations to set up a clean database
    execSync('npx db-migrate up --config database.json -e test', { stdio: 'inherit' });
    
    // Option 2: Import test data from a SQL file
    // This might be faster if your migrations are complex
    // const testDataSQL = fs.readFileSync('./tests/test-data.sql', 'utf8');
    // await supabase.rpc('pg_execute_sql', { sql: testDataSQL });
    
    console.log('Test database setup complete');
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
});

/**
 * Clean up test database after all tests
 */
afterAll(async () => {
  try {
    console.log('Cleaning up test database...');
    
    // Truncate all tables (keep the schema)
    // This is faster than dropping all tables
    const { data: tables } = await supabase.rpc('get_all_tables');
    
    for (const table of tables) {
      if (table !== 'migrations') { // Don't truncate migration tracking
        await supabase.from(table).delete().gt('id', 0);
      }
    }
    
    console.log('Test database cleanup complete');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
});

// tests/integration/api.test.js
/**
 * API Integration Tests
 * 
 * Tests the backend API endpoints with the expected
 * request/response formats used by the frontend.
 */

const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../../server');
const jwt = require('jsonwebtoken');

// Create Supabase client for the test database
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Test user data
let testUser;
let authToken;

// Helper to create a test user and get auth token
const setupTestUser = async () => {
  // Create a test user
  const email = `test-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  
  const { data: userData, error } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (error) {
    throw error;
  }
  
  testUser = userData.user;
  
  // Generate a token manually for testing
  const payload = {
    sub: testUser.id,
    email: testUser.email,
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
  };
  
  authToken = jwt.sign(payload, process.env.JWT_SECRET);
  
  return testUser;
};

// Set up test user before all tests
beforeAll(async () => {
  await setupTestUser();
});

// Clean up test user after all tests
afterAll(async () => {
  if (testUser) {
    await supabase.auth.admin.deleteUser(testUser.id);
  }
});

describe('Authentication API', () => {
  test('Should validate authentication token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/validate')
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.user.id).toBe(testUser.id);
  });
  
  test('Should reject invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/validate')
      .set('Authorization', 'Bearer invalid-token')
      .send();
    
    expect(response.status).toBe(401);
  });
});

describe('Query API', () => {
  test('Should route a query to the appropriate LLM', async () => {
    const response = await request(app)
      .post('/api/v1/query')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        query: 'What is the capital of France?',
        context: {
          conversation_id: 'test-conversation'
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.content).toBeDefined();
    expect(response.body.provider).toBeDefined();
  });
  
  test('Should create a new conversation if not provided', async () => {
    const response = await request(app)
      .post('/api/v1/query')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        query: 'Hello, how are you?'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.content).toBeDefined();
    expect(response.body.conversation_id).toBeDefined();
  });
});

describe('Conversations API', () => {
  let conversationId;
  
  test('Should create a new conversation', async () => {
    const response = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Conversation'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.title).toBe('Test Conversation');
    
    conversationId = response.body.id;
  });
  
  test('Should get conversation history', async () => {
    // First add a message to the conversation
    await request(app)
      .post('/api/v1/query')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        query: 'Test message',
        conversation_id: conversationId
      });
    
    const response = await request(app)
      .get(`/api/v1/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(conversationId);
    expect(response.body.messages).toBeDefined();
    expect(response.body.messages.length).toBeGreaterThan(0);
  });
  
  test('Should list all conversations', async () => {
    const response = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.some(conv => conv.id === conversationId)).toBe(true);
  });
  
  test('Should rename a conversation', async () => {
    const response = await request(app)
      .put(`/api/v1/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Updated Conversation Title'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated Conversation Title');
  });
  
  test('Should delete a conversation', async () => {
    const response = await request(app)
      .delete(`/api/v1/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(204);
    
    // Verify it was deleted
    const getResponse = await request(app)
      .get(`/api/v1/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(getResponse.status).toBe(404);
  });
});

describe('Automations API', () => {
  let automationId;
  
  test('Should create a new automation', async () => {
    const response = await request(app)
      .post('/api/v1/automations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Automation',
        description: 'A test automation',
        workflow: {
          trigger: {
            type: 'time_based',
            config: {
              time: '09:00',
              days: ['monday', 'wednesday', 'friday']
            }
          },
          action: {
            type: 'send_message',
            service: 'gmail',
            config: {
              recipient: 'test@example.com',
              subject: 'Daily Reminder',
              content: 'This is your daily reminder'
            }
          }
        },
        enabled: true
      });
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Test Automation');
    
    automationId = response.body.id;
  });
  
  test('Should get automation details', async () => {
    const response = await request(app)
      .get(`/api/v1/automations/${automationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(automationId);
    expect(response.body.workflow).toBeDefined();
    expect(response.body.workflow.trigger.type).toBe('time_based');
  });
  
  test('Should list all automations', async () => {
    const response = await request(app)
      .get('/api/v1/automations')
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.some(auto => auto.id === automationId)).toBe(true);
  });
  
  test('Should toggle automation enabled status', async () => {
    const response = await request(app)
      .put(`/api/v1/automations/${automationId}/toggle`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        enabled: false
      });
    
    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(false);
  });
  
  test('Should update an automation', async () => {
    const response = await request(app)
      .put(`/api/v1/automations/${automationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Updated Automation Name',
        workflow: {
          trigger: {
            type: 'time_based',
            config: {
              time: '10:00',
              days: ['monday', 'friday']
            }
          },
          action: {
            type: 'send_message',
            service: 'gmail',
            config: {
              recipient: 'updated@example.com',
              subject: 'Updated Reminder',
              content: 'This is your updated reminder'
            }
          }
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Automation Name');
    expect(response.body.workflow.trigger.config.time).toBe('10:00');
  });
  
  test('Should delete an automation', async () => {
    const response = await request(app)
      .delete(`/api/v1/automations/${automationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(204);
    
    // Verify it was deleted
    const getResponse = await request(app)
      .get(`/api/v1/automations/${automationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(getResponse.status).toBe(404);
  });
});

describe('Integrations API', () => {
  test('Should list all supported services', async () => {
    const response = await request(app)
      .get('/api/v1/integrations/supported')
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    // Check if it includes expected services
    const serviceIds = response.body.map(service => service.id);
    expect(serviceIds).toContain('gmail');
    expect(serviceIds).toContain('whatsapp');
    expect(serviceIds).toContain('uber');
    expect(serviceIds).toContain('spotify');
  });
  
  test('Should return OAuth URL for service connection', async () => {
    const response = await request(app)
      .post('/api/v1/integrations/gmail/connect')
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(response.body.authUrl).toBeDefined();
    expect(response.body.state).toBeDefined();
  });
  
  test('Should check connection status for a service', async () => {
    const response = await request(app)
      .get('/api/v1/integrations/gmail/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send();
    
    expect(response.status).toBe(200);
    expect(response.body.connected).toBeDefined();
    // Most likely not connected in tests
    expect(response.body.connected).toBe(false);
  });
});

// jest.config.js
module.exports = {
  // Set the test environment
  testEnvironment: 'node',
  
  // Setup files
  setupFilesAfterEnv: ['./tests/integration/setupTests.js'],
  
  // Test match pattern
  testMatch: ['**/tests/**/*.test.js'],
  
  // Coverage settings
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/*.js'
  ],
  
  // Timeout settings for slow API tests
  testTimeout: 30000,
  
  // Use fake timers for any time-based testing
  timers: 'fake',
  
  // Environment variables for testing
  testEnvironmentOptions: {
    env: {
      NODE_ENV: 'test'
    }
  }
};

// .env.test
# Test environment configuration
NODE_ENV=test
PORT=4001

# Test database configuration
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_SERVICE_KEY=your-test-service-key
SUPABASE_ANON_KEY=your-test-anon-key

# JWT secret for token generation in tests
JWT_SECRET=test-jwt-secret

# API configurations for testing
# These would be mock keys or test-specific keys
OPENAI_API_KEY=sk-test-openai-key
CLAUDE_API_KEY=sk-test-claude-key
PERPLEXITY_API_KEY=pplx-test-perplexity-key
DEEPSEEK_API_KEY=sk-test-deepseek-key

# Mock API URLs for testing (optional)
MOCK_SERVER_URL=http://localhost:9090

# Sample script to run integration tests
// package.json (script section addition)
{
  "scripts": {
    // ... other scripts
    "test:integration": "cross-env NODE_ENV=test jest --config jest.config.js --testPathPattern=tests/integration",
    "test:integration:watch": "cross-env NODE_ENV=test jest --config jest.config.js --testPathPattern=tests/integration --watch"
  }
}
