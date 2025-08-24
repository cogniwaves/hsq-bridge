import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock external services for testing
jest.mock('../src/utils/connectivity', () => ({
  testAllConnections: jest.fn().mockResolvedValue([
    { platform: 'HubSpot', status: 'success', message: 'Connected (test)' },
    { platform: 'Stripe', status: 'success', message: 'Connected (test)' },
    { platform: 'QuickBooks', status: 'success', message: 'Connected (test)' },
    { platform: 'Database', status: 'success', message: 'Connected (test)' },
    { platform: 'Redis', status: 'success', message: 'Connected (test)' }
  ]),
  logConnectivityReport: jest.fn().mockResolvedValue(undefined)
}));

// Mock external API clients
jest.mock('@hubspot/api-client');
jest.mock('stripe');
jest.mock('node-quickbooks');

// Mock Redis for queue testing
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    process: jest.fn(),
    on: jest.fn(),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([])
  }));
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    info: jest.fn().mockResolvedValue('redis_version:6.0.0')
  }));
});

// Test database setup
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://test_user:test_pass@localhost:5432/test_db'
    }
  }
});

beforeAll(async () => {
  // Silence logs during tests
  logger.transports.forEach(transport => {
    transport.silent = true;
  });

  try {
    // Ensure test database is clean
    await setupTestDatabase();
  } catch (error) {
    console.error('Failed to setup test database:', error);
    process.exit(1);
  }
});

afterAll(async () => {
  try {
    await cleanupTestDatabase();
    await testPrisma.$disconnect();
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
  }
});

beforeEach(async () => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset database state for each test
  await resetTestData();
});

async function setupTestDatabase() {
  try {
    // Push database schema (equivalent to migrations for testing)
    execSync('npx prisma db push --force-reset', { 
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'inherit' 
    });
    
    console.log('✅ Test database schema initialized');
  } catch (error) {
    throw new Error(`Failed to setup test database schema: ${error}`);
  }
}

async function cleanupTestDatabase() {
  try {
    // Clean up all test data
    await testPrisma.invoicePayment.deleteMany();
    await testPrisma.syncLog.deleteMany();
    await testPrisma.webhookEvent.deleteMany();
    await testPrisma.paymentMapping.deleteMany();
    await testPrisma.invoiceMapping.deleteMany();
    
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.warn('Warning: Failed to cleanup test database:', error);
  }
}

async function resetTestData() {
  try {
    // Clear all test data between tests
    await testPrisma.invoicePayment.deleteMany();
    await testPrisma.syncLog.deleteMany();
    await testPrisma.webhookEvent.deleteMany();
    await testPrisma.paymentMapping.deleteMany();
    await testPrisma.invoiceMapping.deleteMany();
  } catch (error) {
    console.warn('Warning: Failed to reset test data:', error);
  }
}

// Test utilities
export const createTestInvoice = async (overrides = {}) => {
  return testPrisma.invoiceMapping.create({
    data: {
      hubspotDealId: 'test-deal-123',
      totalAmount: 1000,
      currency: 'USD',
      status: 'SENT',
      clientEmail: 'test@example.com',
      clientName: 'Test Client',
      description: 'Test invoice',
      ...overrides
    }
  });
};

export const createTestPayment = async (overrides = {}) => {
  return testPrisma.paymentMapping.create({
    data: {
      stripePaymentId: 'pi_test_123',
      amount: 1000,
      currency: 'USD',
      paymentMethod: 'STRIPE_CARD',
      status: 'COMPLETED',
      transactionDate: new Date(),
      description: 'Test payment',
      ...overrides
    }
  });
};

export const createTestAllocation = async (invoiceId: string, paymentId: string, amount = 1000) => {
  return testPrisma.invoicePayment.create({
    data: {
      invoiceMappingId: invoiceId,
      paymentMappingId: paymentId,
      allocatedAmount: amount,
      status: 'ALLOCATED'
    }
  });
};

export const createTestSyncLog = async (overrides = {}) => {
  return testPrisma.syncLog.create({
    data: {
      entityType: 'INVOICE',
      entityId: 'test-entity-123',
      operation: 'CREATE',
      platform: 'HUBSPOT',
      status: 'COMPLETED',
      ...overrides
    }
  });
};

export const createTestWebhookEvent = async (overrides = {}) => {
  return testPrisma.webhookEvent.create({
    data: {
      platform: 'STRIPE',
      eventType: 'payment_intent.succeeded',
      eventId: 'evt_test_123',
      payload: { test: 'data' },
      processed: false,
      ...overrides
    }
  });
};

// Mock request helpers
export const mockRequest = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  user: null,
  ...overrides
});

export const mockResponse = () => {
  const res = {} as any;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

export const mockNext = jest.fn();

// Test database instance for direct access in tests
export { testPrisma };