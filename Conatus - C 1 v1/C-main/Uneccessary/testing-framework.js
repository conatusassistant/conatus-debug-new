// jest.config.js
module.exports = {
  // Base directory for Jest
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // File extensions to test
  moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
  
  // Transform files with babel-jest
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  
  // Handle static assets in tests
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js'],
  
  // Test environments
  testEnvironment: 'jsdom',
  
  // Test patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  
  // Test environment variables
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
};

// tests/setupTests.js
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import fetchMock from 'jest-fetch-mock';

// Set up fetch mock
fetchMock.enableMocks();

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
});

// Mock ResizeObserver for DOM testing
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver for DOM testing
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.IntersectionObserver = IntersectionObserverMock;

// tests/__mocks__/fileMock.js
module.exports = 'test-file-stub';

// tests/__mocks__/styleMock.js
module.exports = {};

// tests/unit/services/llm-service.test.js
import LLMService from '../../../src/services/api-connector';

// Reset mocks before each test
beforeEach(() => {
  fetch.resetMocks();
});

describe('LLMService', () => {
  describe('sendQuery', () => {
    test('should send query to API and return response', async () => {
      // Mock API response
      fetch.mockResponseOnce(JSON.stringify({
        content: 'Test response',
        provider: 'CLAUDE'
      }));
      
      // Call service method
      const response = await LLMService.llm.sendQuery('Test query');
      
      // Verify fetch was called correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/query'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test query')
        })
      );
      
      // Verify response was returned
      expect(response).toEqual({
        content: 'Test response',
        provider: 'CLAUDE'
      });
    });
    
    test('should handle errors properly', async () => {
      // Mock API error
      fetch.mockRejectOnce(new Error('Network error'));
      
      // Call service method and verify error is thrown
      await expect(LLMService.llm.sendQuery('Test query')).rejects.toThrow('Network error');
      
      // Verify fetch was called
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('streamQuery', () => {
    test('should handle streaming responses correctly', async () => {
      // Mock readable stream
      const mockResponse = {
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"provider","provider":"CLAUDE"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Hello"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":" world"}\n\n')
              })
              .mockResolvedValueOnce({
                done: true
              })
          })
        },
        ok: true
      };
      
      fetch.mockResolvedValueOnce(mockResponse);
      
      // Mock callback
      const onChunk = jest.fn();
      
      // Call service method
      await LLMService.llm.streamQuery('Test query', null, {}, onChunk);
      
      // Verify fetch was called correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Verify callback was called for each chunk
      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunk).toHaveBeenNthCalledWith(1, {"type": "provider", "provider": "CLAUDE"});
      expect(onChunk).toHaveBeenNthCalledWith(2, {"type": "content", "content": "Hello"});
      expect(onChunk).toHaveBeenNthCalledWith(3, {"type": "content", "content": " world"});
    });
  });
});

// tests/unit/store/auth.test.js
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { signIn, signOut, refreshToken, authReducer } from '../../../src/store/auth';

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

// Mock API responses
jest.mock('../../../src/services/api-connector', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn()
    }
  }
}));

import ApiConnector from '../../../src/services/api-connector';

describe('Auth Store', () => {
  describe('signIn action', () => {
    test('creates LOGIN_SUCCESS when login succeeds', async () => {
      // Mock successful login
      ApiConnector.supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: '123', email: 'test@example.com' },
          session: { access_token: 'token123', expires_at: Date.now() + 3600000 }
        },
        error: null
      });
      
      // Create mock store
      const store = mockStore({
        auth: {
          user: null,
          token: null,
          loading: false,
          error: null
        }
      });
      
      // Dispatch action
      await store.dispatch(signIn({ email: 'test@example.com', password: 'password123' }));
      
      // Check actions
      const actions = store.getActions();
      expect(actions[0].type).toEqual('auth/loginPending');
      expect(actions[1].type).toEqual('auth/loginSuccess');
      expect(actions[1].payload).toEqual({
        user: { id: '123', email: 'test@example.com' },
        token: 'token123'
      });
    });
    
    test('creates LOGIN_FAILURE when login fails', async () => {
      // Mock failed login
      ApiConnector.supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      });
      
      // Create mock store
      const store = mockStore({
        auth: {
          user: null,
          token: null,
          loading: false,
          error: null
        }
      });
      
      // Dispatch action
      await store.dispatch(signIn({ email: 'test@example.com', password: 'wrong' }));
      
      // Check actions
      const actions = store.getActions();
      expect(actions[0].type).toEqual('auth/loginPending');
      expect(actions[1].type).toEqual('auth/loginFailure');
      expect(actions[1].payload).toEqual('Invalid credentials');
    });
  });
  
  describe('authReducer', () => {
    test('should return the initial state', () => {
      expect(authReducer(undefined, {})).toEqual({
        user: null,
        token: null,
        loading: false,
        error: null
      });
    });
    
    test('should handle login pending', () => {
      expect(
        authReducer(undefined, {
          type: 'auth/loginPending'
        })
      ).toEqual({
        user: null,
        token: null,
        loading: true,
        error: null
      });
    });
    
    test('should handle login success', () => {
      expect(
        authReducer(
          {
            user: null,
            token: null,
            loading: true,
            error: null
          },
          {
            type: 'auth/loginSuccess',
            payload: {
              user: { id: '123', email: 'test@example.com' },
              token: 'token123'
            }
          }
        )
      ).toEqual({
        user: { id: '123', email: 'test@example.com' },
        token: 'token123',
        loading: false,
        error: null
      });
    });
    
    test('should handle login failure', () => {
      expect(
        authReducer(
          {
            user: null,
            token: null,
            loading: true,
            error: null
          },
          {
            type: 'auth/loginFailure',
            payload: 'Invalid credentials'
          }
        )
      ).toEqual({
        user: null,
        token: null,
        loading: false,
        error: 'Invalid credentials'
      });
    });
  });
});

// tests/unit/components/chat/ChatInterface.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import ChatInterface from '../../../../src/components/chat/ChatInterface';

// Mock the API connector
jest.mock('../../../../src/services/api-connector', () => ({
  llm: {
    streamQuery: jest.fn(),
    sendQuery: jest.fn()
  }
}));

// Configure mock store
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('ChatInterface', () => {
  let store;
  
  beforeEach(() => {
    store = mockStore({
      conversations: {
        currentConversation: '123',
        conversations: [{ id: '123', title: 'Test Conversation' }],
        messages: {
          '123': [
            { id: '1', role: 'user', content: 'Hello' },
            { id: '2', role: 'assistant', content: 'Hi there!', provider: 'CLAUDE' }
          ]
        },
        loading: false
      },
      auth: {
        user: { id: 'user123' }
      }
    });
    
    // Mock dispatch
    store.dispatch = jest.fn();
  });
  
  test('renders conversation messages', () => {
    render(
      <Provider store={store}>
        <ChatInterface />
      </Provider>
    );
    
    // Check that messages are rendered
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
    expect(screen.getByText('Powered by CLAUDE')).toBeInTheDocument();
  });
  
  test('sends message when form is submitted', async () => {
    render(
      <Provider store={store}>
        <ChatInterface />
      </Provider>
    );
    
    // Fill in the input and submit the form
    const input = screen.getByPlaceholderText('Ask me anything...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const form = screen.getByRole('form');
    fireEvent.submit(form);
    
    // Check that the action was dispatched
    await waitFor(() => {
      expect(store.dispatch).toHaveBeenCalled();
    });
    
    // Check that the input was cleared
    expect(input.value).toBe('');
  });
});

// tests/integration/api.test.js
import request from 'supertest';
import app from '../../src/api';

describe('API Integration Tests', () => {
  describe('Auth API', () => {
    test('POST /api/v1/auth/login returns 200 with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
    });
    
    test('POST /api/v1/auth/login returns 401 with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
      
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
  
  describe('Query API', () => {
    let authToken;
    
    // Login to get token before tests
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      authToken = res.body.token;
    });
    
    test('POST /api/v1/query requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/query')
        .send({
          query: 'Test query'
        });
      
      expect(res.status).toBe(401);
    });
    
    test('POST /api/v1/query returns 200 with valid query', async () => {
      const res = await request(app)
        .post('/api/v1/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: 'Test query'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('content');
    });
  });
  
  describe('Automations API', () => {
    let authToken;
    
    // Login to get token before tests
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      authToken = res.body.token;
    });
    
    test('GET /api/v1/automations returns user automations', async () => {
      const res = await request(app)
        .get('/api/v1/automations')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
    
    test('POST /api/v1/automations creates new automation', async () => {
      const automation = {
        name: 'Test Automation',
        trigger: {
          type: 'time_schedule',
          config: {
            frequency: 'daily',
            time: '09:00'
          }
        },
        action: {
          type: 'send_email',
          config: {
            recipient: 'test@example.com',
            subject: 'Test Email',
            body: 'This is a test email'
          }
        }
      };
      
      const res = await request(app)
        .post('/api/v1/automations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(automation);
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Automation');
    });
  });
});

// tests/end-to-end/workflows.test.js
import puppeteer from 'puppeteer';

describe('End-to-End Tests', () => {
  let browser;
  let page;
  
  // Set up browser before tests
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });
  
  // Close browser after tests
  afterAll(async () => {
    await browser.close();
  });
  
  test('Login workflow', async () => {
    // Go to login page
    await page.goto('http://localhost:3000/login');
    
    // Fill in login form
    await page.type('input[name="email"]', 'test@example.com');
    await page.type('input[name="password"]', 'password123');
    
    // Submit form
    await Promise.all([
      page.waitForNavigation(),
      page.click('button[type="submit"]')
    ]);
    
    // Check that we're on the home page
    const url = page.url();
    expect(url).toContain('http://localhost:3000/');
    
    // Check that chat interface is visible
    const chatInput = await page.$('input[placeholder="Ask me anything..."]');
    expect(chatInput).not.toBeNull();
  });
  
  test('Chat interaction workflow', async () => {
    // Assume already logged in from previous test
    
    // Go to home page
    await page.goto('http://localhost:3000/');
    
    // Type a message
    await page.type('input[placeholder="Ask me anything..."]', 'Hello, Claude!');
    
    // Submit message
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForSelector('.message.assistant', { timeout: 5000 });
    
    // Check that response is visible
    const responseText = await page.$eval('.message.assistant', el => el.textContent);
    expect(responseText.length).toBeGreaterThan(0);
  });
  
  test('Create automation workflow', async () => {
    // Assume already logged in from previous test
    
    // Go to library page
    await page.goto('http://localhost:3000/library');
    
    // Click create button
    await Promise.all([
      page.waitForNavigation(),
      page.click('a[href="/library/create"]')
    ]);
    
    // Fill in automation form
    await page.type('input[name="name"]', 'Daily Reminder');
    
    // Select trigger
    await page.click('div[data-trigger="time_schedule"]');
    
    // Configure trigger
    await page.select('select[name="frequency"]', 'daily');
    await page.type('input[name="time"]', '09:00');
    
    // Select action
    await page.click('div[data-action="send_email"]');
    
    // Configure action
    await page.type('input[name="recipient"]', 'myself@example.com');
    await page.type('input[name="subject"]', 'Daily Reminder');
    await page.type('textarea[name="body"]', 'Remember to check your tasks for today!');
    
    // Save automation
    await Promise.all([
      page.waitForNavigation(),
      page.click('button[type="submit"]')
    ]);
    
    // Check that we're back on library page
    const url = page.url();
    expect(url).toBe('http://localhost:3000/library');
    
    // Check that new automation is in the list
    const automationTitle = await page.$eval('.automation-item:first-child .automation-title', el => el.textContent);
    expect(automationTitle).toBe('Daily Reminder');
  });
});

// backend/tests/unit/services/llm-service.test.js
const LLMService = require('../../../services/llm/LLMService');
const ClassificationService = require('../../../services/classification/ClassificationService');
const Redis = require('ioredis');

// Mock dependencies
jest.mock('../../../services/classification/ClassificationService');
jest.mock('ioredis');
jest.mock('node-fetch');

describe('LLMService', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock implementations
    ClassificationService.classifyQuery.mockResolvedValue('CLAUDE');
    
    // Mock Redis
    Redis.prototype.get.mockImplementation((key) => {
      if (key.includes('provider_status')) {
        return 'available';
      }
      return null;
    });
    
    Redis.prototype.set.mockResolvedValue('OK');
  });
  
  describe('routeQuery', () => {
    test('should route query to appropriate provider', async () => {
      // Mock fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: 'Test response',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      });
      
      // Call service method
      const response = await LLMService.routeQuery('Test query');
      
      // Verify classification was called
      expect(ClassificationService.classifyQuery).toHaveBeenCalledWith('Test query', {});
      
      // Verify fetch was called with appropriate URL
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.anthropic.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': expect.any(String)
          })
        })
      );
      
      // Verify response was returned
      expect(response).toMatchObject({
        content: 'Test response',
        provider: 'CLAUDE',
        fromCache: false
      });
    });
    
    test('should use cache when available', async () => {
      // Mock cache hit
      Redis.prototype.get.mockImplementation((key) => {
        if (key.includes('query_response')) {
          return JSON.stringify({
            content: 'Cached response',
            tokenUsage: {
              prompt_tokens: 5,
              completion_tokens: 10,
              total_tokens: 15
            }
          });
        }
        return null;
      });
      
      // Call service method
      const response = await LLMService.routeQuery('Test query');
      
      // Verify classification was called
      expect(ClassificationService.classifyQuery).toHaveBeenCalledWith('Test query', {});
      
      // Verify fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Verify cached response was returned
      expect(response).toMatchObject({
        content: 'Cached response',
        provider: 'CLAUDE',
        fromCache: true
      });
    });
    
    test('should use fallback provider when primary is unavailable', async () => {
      // Mock provider unavailability
      Redis.prototype.get.mockImplementation((key) => {
        if (key.includes('provider_status:CLAUDE')) {
          return 'unavailable';
        }
        return 'available';
      });
      
      // Mock fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: 'Fallback response',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      });
      
      // Call service method
      const response = await LLMService.routeQuery('Test query');
      
      // Verify fallback provider was used
      expect(response).toMatchObject({
        content: 'Fallback response',
        provider: 'OPENAI',
        fromCache: false
      });
    });
  });
});

// backend/tests/unit/services/automation-detection.test.js
const AutomationDetectionService = require('../../../services/automation/AutomationDetectionService');
const OAuthService = require('../../../services/oauth/OAuthService');

// Mock dependencies
jest.mock('../../../services/oauth/OAuthService');

describe('AutomationDetectionService', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock implementations
    OAuthService.getUserConnections.mockResolvedValue([
      { id: 'gmail', name: 'Gmail' },
      { id: 'whatsapp', name: 'WhatsApp' }
    ]);
    
    OAuthService.isServiceConnected.mockImplementation((userId, serviceId) => {
      return Promise.resolve(['gmail', 'whatsapp'].includes(serviceId));
    });
  });
  
  describe('detectAutomation', () => {
    test('should detect WhatsApp message automation', async () => {
      const message = 'send a whatsapp message to John saying Hello there';
      const userId = 'user123';
      
      const result = await AutomationDetectionService.detectAutomation(message, userId);
      
      expect(result).toMatchObject({
        type: 'message_schedule',
        service: 'whatsapp',
        params: {
          recipient: 'John',
          content: 'Hello there'
        },
        confidence: expect.any(Number)
      });
      
      expect(result.needsConnection).toBeFalsy();
    });
    
    test('should detect Gmail automation', async () => {
      const message = 'send an email to boss@example.com with subject Meeting Notes saying Here are the notes from our meeting';
      const userId = 'user123';
      
      const result = await AutomationDetectionService.detectAutomation(message, userId);
      
      expect(result).toMatchObject({
        type: 'message_schedule',
        service: 'gmail',
        params: {
          recipient: 'boss@example.com',
          subject: 'Meeting Notes',
          content: 'Here are the notes from our meeting'
        },
        confidence: expect.any(Number)
      });
      
      expect(result.needsConnection).toBeFalsy();
    });
    
    test('should indicate when service connection is needed', async () => {
      // Mock Uber not connected
      OAuthService.isServiceConnected.mockImplementation((userId, serviceId) => {
        return Promise.resolve(serviceId !== 'uber');
      });
      
      const message = 'get me an uber from Home to Office at 9am tomorrow';
      const userId = 'user123';
      
      const result = await AutomationDetectionService.detectAutomation(message, userId);
      
      expect(result).toMatchObject({
        type: 'ride_request',
        service: 'uber',
        needsConnection: true
      });
    });
    
    test('should return null for non-automation messages', async () => {
      const message = 'What is the capital of France?';
      const userId = 'user123';
      
      const result = await AutomationDetectionService.detectAutomation(message, userId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('validateAutomation', () => {
    test('should validate WhatsApp automation correctly', () => {
      const automation = {
        type: 'message_schedule',
        service: 'whatsapp',
        params: {
          recipient: 'John',
          content: 'Hello there'
        }
      };
      
      const result = AutomationDetectionService.validateAutomation(automation);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should return validation errors for incomplete automation', () => {
      const automation = {
        type: 'message_schedule',
        service: 'whatsapp',
        params: {
          // Missing recipient
          content: 'Hello there'
        }
      };
      
      const result = AutomationDetectionService.validateAutomation(automation);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Recipient is required');
    });
  });
});

// package.json scripts section
/*
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:e2e": "jest --config=jest.e2e.config.js",
  "test:integration": "jest --config=jest.integration.config.js"
}
*/
