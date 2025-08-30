/**
 * Jest Setup File
 * Global test configuration and setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error
};

// Setup global test utilities
global.testUtils = {
  // Generate test JWT token
  generateToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        tenantId: 'test-tenant',
        userId: 'test-user',
        roles: ['admin'],
        ...payload
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },

  // Create test configuration
  createTestConfig: (platform, overrides = {}) => {
    const baseConfig = {
      HUBSPOT: {
        apiKey: 'pat-na1-test-key',
        webhookSecret: 'hubspot-secret',
        webhookUrl: 'https://api.example.com/webhooks/hubspot'
      },
      STRIPE: {
        apiKey: 'sk_test_stripe_key',
        publishableKey: 'pk_test_stripe_key',
        webhookSecret: 'whsec_stripe_secret'
      },
      QUICKBOOKS: {
        clientId: 'qb-client-id',
        clientSecret: 'qb-client-secret',
        companyId: 'qb-company-id'
      }
    };

    return {
      platform,
      ...baseConfig[platform],
      isActive: true,
      tenantId: 'test-tenant',
      ...overrides
    };
  },

  // Wait for condition
  waitFor: async (condition, timeout = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timeout waiting for condition');
  },

  // Clean test database
  cleanDatabase: async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Delete in correct order to respect foreign keys
      await prisma.$transaction([
        prisma.configurationAuditLog.deleteMany(),
        prisma.webhookConfiguration.deleteMany(),
        prisma.integrationConfiguration.deleteMany(),
        prisma.oauthTokens.deleteMany(),
        prisma.tokenRefreshLogs.deleteMany()
      ]);
    } finally {
      await prisma.$disconnect();
    }
  }
};

// Setup fetch mock
global.fetch = jest.fn();

// Setup crypto mock for PKCE
global.crypto = {
  getRandomValues: (array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    digest: async (algorithm, data) => {
      // Simple mock digest
      return new ArrayBuffer(32);
    }
  }
};

// Setup window mock for frontend tests
if (typeof window !== 'undefined') {
  window.matchMedia = window.matchMedia || function() {
    return {
      matches: false,
      addListener: function() {},
      removeListener: function() {}
    };
  };

  // Mock IntersectionObserver
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));

  // Mock ResizeObserver
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));
}

// Add custom matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      pass,
      message: () => 
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`
    };
  },

  toBeEncrypted(received) {
    // Check if string appears to be encrypted (contains colon separator and hex characters)
    const encryptedPattern = /^[0-9a-f]+:[0-9a-f]+$/i;
    const pass = encryptedPattern.test(received);
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be encrypted`
          : `expected ${received} to be encrypted`
    };
  },

  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  }
});

// Setup MSW for API mocking
const { setupServer } = require('msw/node');
const { rest } = require('msw');

global.mockServer = setupServer(
  // Default handlers
  rest.get('/api/config/:platform', (req, res, ctx) => {
    return res(ctx.json({ 
      success: true, 
      data: global.testUtils.createTestConfig(req.params.platform.toUpperCase()) 
    }));
  }),
  
  rest.post('/api/config/:platform', (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ 
      success: true, 
      data: { id: 'test-config-id', ...req.body }
    }));
  }),

  rest.post('/api/config/:platform/test', (req, res, ctx) => {
    return res(ctx.json({ 
      success: true, 
      data: { status: 'HEALTHY', responseTime: 150 }
    }));
  })
);

// Start mock server
beforeAll(() => {
  global.mockServer.listen({ onUnhandledRequest: 'bypass' });
});

// Reset handlers between tests
afterEach(() => {
  global.mockServer.resetHandlers();
  jest.clearAllMocks();
});

// Stop mock server
afterAll(() => {
  global.mockServer.close();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

// Export for TypeScript
module.exports = {};