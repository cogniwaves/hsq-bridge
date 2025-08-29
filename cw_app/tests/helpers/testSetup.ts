/**
 * Test Setup Helper
 * Comprehensive setup utilities for backend testing
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../../src/utils/logger';

// Initialize test database instance with proper configuration
const databaseUrl = process.env.DATABASE_URL || 'postgresql://hs_bridge_test_user:test_password@localhost:15433/hs_bridge_test';

// Global test database instance - initialized immediately
export const testPrisma: PrismaClient = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: process.env.DEBUG_TESTS === 'true' ? ['query', 'error', 'warn'] : ['error'],
});

// Global test Redis instance
export let testRedis: Redis | undefined;

/**
 * Initialize test database connection
 */
export const initTestDatabase = async (): Promise<void> => {
  // testPrisma is already initialized, just connect
  await testPrisma.$connect();
  logger.info('Test database connected');
};

/**
 * Initialize test Redis connection
 */
export const initTestRedis = async (): Promise<void> => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:16380';
  
  testRedis = new Redis(redisUrl);

  // Test connection
  await testRedis.ping();
  logger.info('Test Redis connected');
};

/**
 * Clean up test database - removes all data but keeps schema
 */
export const cleanTestDatabase = async (): Promise<void> => {

  const tablenames = await testPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter(name => name !== '_prisma_migrations')
    .map(name => `"public"."${name}"`)
    .join(', ');

  if (tables.length > 0) {
    await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  }
};

/**
 * Clean up test Redis - removes all keys
 */
export const cleanTestRedis = async (): Promise<void> => {
  if (!testRedis) return;
  await testRedis.flushall();
};

/**
 * Seed test database with minimal required data
 */
export const seedTestDatabase = async (): Promise<void> => {

  // Create a test tenant
  await testPrisma.tenant.create({
    data: {
      id: 'test-tenant-id',
      name: 'Test Tenant',
      slug: 'test-tenant',
      isActive: true,
      maxUsers: 100,
      createdById: 'system',
    },
  });

  // Create a test user
  await testPrisma.user.create({
    data: {
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: '$2a$10$test.hash.for.testing',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Create test membership
  await testPrisma.tenantMembership.create({
    data: {
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
      role: 'ADMIN',
      isPrimary: true,
    },
  });

  logger.info('Test database seeded');
};

/**
 * Close all test connections
 */
export const closeTestConnections = async (): Promise<void> => {
  await testPrisma.$disconnect();
  if (testRedis) {
    await testRedis.disconnect();
  }
  logger.info('Test connections closed');
};

/**
 * Complete test environment setup
 */
export const setupTestEnvironment = async (): Promise<void> => {
  await initTestDatabase();
  await initTestRedis();
  await cleanTestDatabase();
  await cleanTestRedis();
  await seedTestDatabase();
};

/**
 * Complete test environment teardown
 */
export const teardownTestEnvironment = async (): Promise<void> => {
  await cleanTestDatabase();
  await cleanTestRedis();
  await closeTestConnections();
};

/**
 * Create test tenant data
 */
export const createTestTenant = async (overrides: any = {}) => {
  return await testPrisma.tenant.create({
    data: {
      name: 'Test Tenant',
      slug: 'test-tenant',
      isActive: true,
      maxUsers: 100,
      createdById: 'system',
      ...overrides,
    },
  });
};

/**
 * Create test user data
 */
export const createTestUser = async (overrides: any = {}) => {
  return await testPrisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      passwordHash: '$2a$10$test.hash.for.testing',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      ...overrides,
    },
  });
};

/**
 * Create test invitation data
 */
export const createTestInvitation = async (tenantId: string, overrides: any = {}) => {
  return await testPrisma.tenantInvitation.create({
    data: {
      tenantId,
      email: `invite-${Date.now()}@example.com`,
      role: 'MEMBER',
      invitationToken: `test-token-${Date.now()}`,
      invitedById: 'test-user-id',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ...overrides,
    },
  });
};

/**
 * Mock external API responses
 */
export const mockExternalAPIs = () => {
  // Mock HubSpot API
  jest.doMock('@hubspot/api-client', () => ({
    Client: jest.fn().mockImplementation(() => ({
      crm: {
        deals: {
          basicApi: {
            getPage: jest.fn().mockResolvedValue({ results: [] }),
            getById: jest.fn().mockResolvedValue({ id: 'test-deal' }),
          },
        },
        contacts: {
          basicApi: {
            getPage: jest.fn().mockResolvedValue({ results: [] }),
          },
        },
      },
    })),
  }));

  // Mock Stripe API
  jest.doMock('stripe', () => 
    jest.fn().mockImplementation(() => ({
      invoices: {
        list: jest.fn().mockResolvedValue({ data: [] }),
        retrieve: jest.fn().mockResolvedValue({ id: 'test-invoice' }),
      },
      charges: {
        list: jest.fn().mockResolvedValue({ data: [] }),
      },
    }))
  );

  // Mock QuickBooks API
  jest.doMock('node-quickbooks', () => ({
    QuickBooks: jest.fn().mockImplementation(() => ({
      findItems: jest.fn((_, callback) => callback(null, [])),
      getCompanyInfo: jest.fn((_, callback) => callback(null, { Name: 'Test Company' })),
    })),
  }));
};

export default {
  setupTestEnvironment,
  teardownTestEnvironment,
  cleanTestDatabase,
  cleanTestRedis,
  createTestTenant,
  createTestUser,
  createTestInvitation,
  mockExternalAPIs,
  testPrisma,
  get testRedis() { return testRedis; },
};