/**
 * API Test Helpers
 * Utilities for testing Express API endpoints
 */

import request from 'supertest';
import { Express } from 'express';
import { sign } from 'jsonwebtoken';
import app from '../../src/index'; // Your main Express app

/**
 * Generate test JWT token
 */
export const generateTestToken = (payload: any = {}, options: any = {}) => {
  const defaultPayload = {
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    email: 'test@example.com',
    role: 'ADMIN',
    ...payload,
  };

  const secret = process.env.JWT_SECRET || 'test-secret';
  const defaultOptions = {
    expiresIn: '1h',
    ...options,
  };

  return sign(defaultPayload, secret, defaultOptions);
};

/**
 * Create authenticated request with JWT token
 */
export const authenticatedRequest = (app: Express, token?: string) => {
  const authToken = token || generateTestToken();
  return request(app).set('Authorization', `Bearer ${authToken}`);
};

/**
 * Create admin authenticated request
 */
export const adminRequest = (app: Express) => {
  const adminToken = generateTestToken({ role: 'ADMIN' });
  return authenticatedRequest(app, adminToken);
};

/**
 * Create user authenticated request
 */
export const userRequest = (app: Express) => {
  const userToken = generateTestToken({ role: 'MEMBER' });
  return authenticatedRequest(app, userToken);
};

/**
 * Create request with API key authentication
 */
export const apiKeyRequest = (app: Express, apiKey?: string) => {
  const key = apiKey || process.env.API_KEY_ADMIN || 'test-admin-key';
  return request(app).set('X-API-Key', key);
};

/**
 * Test API response structure
 */
export const expectSuccessResponse = (response: any, expectedData?: any) => {
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('data');
  expect(response.body).toHaveProperty('message');
  
  if (expectedData) {
    expect(response.body.data).toMatchObject(expectedData);
  }
};

export const expectErrorResponse = (response: any, expectedMessage?: string) => {
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  expect(response.body).toHaveProperty('message');
  
  if (expectedMessage) {
    expect(response.body.message).toContain(expectedMessage);
  }
};

export const expectPaginatedResponse = (response: any) => {
  expectSuccessResponse(response);
  expect(response.body.data).toHaveProperty('items');
  expect(response.body.data).toHaveProperty('pagination');
  expect(response.body.data.pagination).toHaveProperty('page');
  expect(response.body.data.pagination).toHaveProperty('limit');
  expect(response.body.data.pagination).toHaveProperty('total');
  expect(response.body.data.pagination).toHaveProperty('totalPages');
};

/**
 * Common test scenarios for CRUD endpoints
 */
export class CRUDTestHelper {
  constructor(
    private app: Express,
    private basePath: string,
    private authRequired: boolean = true
  ) {}

  private getRequest() {
    return this.authRequired ? authenticatedRequest(this.app) : request(this.app);
  }

  async testCreate(data: any, expectedStatus: number = 201) {
    const response = await this.getRequest()
      .post(this.basePath)
      .send(data)
      .expect(expectedStatus);

    if (expectedStatus >= 200 && expectedStatus < 300) {
      expectSuccessResponse(response);
    }

    return response;
  }

  async testList(queryParams: any = {}, expectedStatus: number = 200) {
    const response = await this.getRequest()
      .get(this.basePath)
      .query(queryParams)
      .expect(expectedStatus);

    if (expectedStatus >= 200 && expectedStatus < 300) {
      expectPaginatedResponse(response);
    }

    return response;
  }

  async testGetById(id: string, expectedStatus: number = 200) {
    const response = await this.getRequest()
      .get(`${this.basePath}/${id}`)
      .expect(expectedStatus);

    if (expectedStatus >= 200 && expectedStatus < 300) {
      expectSuccessResponse(response);
    }

    return response;
  }

  async testUpdate(id: string, data: any, expectedStatus: number = 200) {
    const response = await this.getRequest()
      .put(`${this.basePath}/${id}`)
      .send(data)
      .expect(expectedStatus);

    if (expectedStatus >= 200 && expectedStatus < 300) {
      expectSuccessResponse(response);
    }

    return response;
  }

  async testDelete(id: string, expectedStatus: number = 200) {
    const response = await this.getRequest()
      .delete(`${this.basePath}/${id}`)
      .expect(expectedStatus);

    if (expectedStatus >= 200 && expectedStatus < 300) {
      expectSuccessResponse(response);
    }

    return response;
  }
}

/**
 * WebHook test helpers
 */
export class WebhookTestHelper {
  constructor(private app: Express, private webhookPath: string) {}

  async testWebhook(payload: any, headers: any = {}, expectedStatus: number = 200) {
    const response = await request(this.app)
      .post(this.webhookPath)
      .send(payload)
      .set(headers)
      .expect(expectedStatus);

    return response;
  }

  async testSignedWebhook(payload: any, secret: string, expectedStatus: number = 200) {
    // Implement webhook signature verification testing
    const signature = this.generateWebhookSignature(payload, secret);
    
    const response = await request(this.app)
      .post(this.webhookPath)
      .send(payload)
      .set('X-Hub-Signature-256', signature)
      .expect(expectedStatus);

    return response;
  }

  private generateWebhookSignature(payload: any, secret: string): string {
    const crypto = require('crypto');
    const body = JSON.stringify(payload);
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  }
}

/**
 * Rate limiting test helper
 */
export const testRateLimit = async (
  makeRequest: () => Promise<any>,
  limit: number,
  windowMs: number
) => {
  const responses = [];
  
  // Make requests up to the limit
  for (let i = 0; i < limit; i++) {
    responses.push(await makeRequest());
  }

  // Next request should be rate limited
  const rateLimitedResponse = await makeRequest();
  expect(rateLimitedResponse.status).toBe(429);

  // Wait for window to reset
  await new Promise(resolve => setTimeout(resolve, windowMs + 100));

  // Request should work again
  const afterWindowResponse = await makeRequest();
  expect(afterWindowResponse.status).not.toBe(429);

  return { responses, rateLimitedResponse, afterWindowResponse };
};

export default {
  generateTestToken,
  authenticatedRequest,
  adminRequest,
  userRequest,
  apiKeyRequest,
  expectSuccessResponse,
  expectErrorResponse,
  expectPaginatedResponse,
  CRUDTestHelper,
  WebhookTestHelper,
  testRateLimit,
};