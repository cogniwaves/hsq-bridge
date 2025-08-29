import request from 'supertest';
import express from 'express';
import { apiRoutes } from '../../src/api';
import { createTestInvoice, createTestPayment } from '../setup';

// Create test app
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('API Integration Tests', () => {
  describe('API Info Endpoint', () => {
    it('GET /api should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toEqual({
        name: 'HubSpot-Stripe-QuickBooks Bridge API',
        version: '1.0.0',
        endpoints: {
          invoices: '/api/invoices',
          payments: '/api/payments',
          sync: '/api/sync',
          dashboard: '/api/dashboard',
          metrics: '/api/metrics',
          webhooks: '/webhooks'
        }
      });
    });
  });

  describe('Invoices API', () => {
    let testInvoice: any;

    beforeEach(async () => {
      testInvoice = await createTestInvoice({
        hubspotDealId: 'deal_test_123',
        totalAmount: 1500,
        clientEmail: 'integration@test.com',
        clientName: 'Integration Test Client'
      });
    });

    it('GET /api/invoices should return paginated invoices', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .expect(200);

      expect(response.body).toHaveProperty('invoices');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.invoices[0].id).toBe(testInvoice.id);
    });

    it('GET /api/invoices/:id should return specific invoice', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoice.id}`)
        .expect(200);

      expect(response.body.id).toBe(testInvoice.id);
      expect(response.body.clientEmail).toBe('integration@test.com');
      expect(response.body).toHaveProperty('payments');
      expect(response.body).toHaveProperty('syncLogs');
    });

    it('GET /api/invoices/:id should return 404 for non-existent invoice', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      
      const response = await request(app)
        .get(`/api/invoices/${nonExistentId}`)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Invoice not found'
      });
    });

    it('GET /api/invoices/:id/balance should return invoice balance', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoice.id}/balance`)
        .expect(200);

      expect(response.body).toEqual({
        totalAmount: 1500,
        totalPaid: 0,
        balance: 1500,
        isPaid: false,
        isPartiallyPaid: false
      });
    });

    it('POST /api/invoices/:id/sync should trigger manual sync', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice.id}/sync`)
        .send({ platform: 'QUICKBOOKS' })
        .expect(200);

      expect(response.body).toEqual({
        message: `Sync initiated for invoice ${testInvoice.id} to QUICKBOOKS`,
        invoiceId: testInvoice.id,
        platform: 'QUICKBOOKS'
      });
    });
  });

  describe('Payments API', () => {
    let testPayment: any;
    let testInvoice: any;

    beforeEach(async () => {
      testInvoice = await createTestInvoice();
      testPayment = await createTestPayment({
        stripePaymentId: 'pi_integration_test_123',
        amount: 1000,
        description: 'Integration test payment'
      });
    });

    it('GET /api/payments should return paginated payments', async () => {
      const response = await request(app)
        .get('/api/payments')
        .expect(200);

      expect(response.body).toHaveProperty('payments');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.payments).toHaveLength(1);
      expect(response.body.payments[0].id).toBe(testPayment.id);
    });

    it('GET /api/payments/:id should return specific payment', async () => {
      const response = await request(app)
        .get(`/api/payments/${testPayment.id}`)
        .expect(200);

      expect(response.body.id).toBe(testPayment.id);
      expect(response.body.stripePaymentId).toBe('pi_integration_test_123');
      expect(response.body).toHaveProperty('invoices');
      expect(response.body).toHaveProperty('syncLogs');
    });

    it('POST /api/payments/:paymentId/allocate should create allocation', async () => {
      const response = await request(app)
        .post(`/api/payments/${testPayment.id}/allocate`)
        .send({
          invoiceId: testInvoice.id,
          amount: 500
        })
        .expect(200);

      expect(response.body.message).toBe('Payment allocated successfully');
      expect(response.body).toHaveProperty('allocation');
      expect(response.body.allocation.allocatedAmount).toBe(500);
    });

    it('POST /api/payments/:paymentId/allocate should prevent duplicate allocation', async () => {
      // First allocation
      await request(app)
        .post(`/api/payments/${testPayment.id}/allocate`)
        .send({
          invoiceId: testInvoice.id,
          amount: 500
        })
        .expect(200);

      // Second allocation (should fail)
      const response = await request(app)
        .post(`/api/payments/${testPayment.id}/allocate`)
        .send({
          invoiceId: testInvoice.id,
          amount: 300
        })
        .expect(400);

      expect(response.body.error).toBe('Payment already allocated to this invoice');
    });

    it('DELETE /api/payments/:paymentId/allocate/:invoiceId should remove allocation', async () => {
      // First create allocation
      await request(app)
        .post(`/api/payments/${testPayment.id}/allocate`)
        .send({
          invoiceId: testInvoice.id,
          amount: 500
        })
        .expect(200);

      // Then remove it
      const response = await request(app)
        .delete(`/api/payments/${testPayment.id}/allocate/${testInvoice.id}`)
        .expect(200);

      expect(response.body.message).toBe('Allocation removed successfully');
    });
  });

  describe('Sync API', () => {
    it('GET /api/sync/status should return sync status', async () => {
      const response = await request(app)
        .get('/api/sync/status')
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('platformStats');
      expect(response.body.stats).toHaveProperty('total');
      expect(response.body.stats).toHaveProperty('pending');
      expect(response.body.stats).toHaveProperty('completed');
    });

    it('GET /api/sync/logs should return paginated sync logs', async () => {
      const response = await request(app)
        .get('/api/sync/logs')
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('POST /api/sync/trigger should trigger manual sync', async () => {
      const response = await request(app)
        .post('/api/sync/trigger')
        .send({
          platform: 'HUBSPOT',
          entityType: 'INVOICE',
          entityId: 'test-entity-123'
        })
        .expect(200);

      expect(response.body.message).toBe('Manual sync triggered successfully');
      expect(response.body).toHaveProperty('syncLogId');
    });

    it('POST /api/sync/retry-failed should retry failed syncs', async () => {
      const response = await request(app)
        .post('/api/sync/retry-failed')
        .send({ platform: 'STRIPE', limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });
  });

  describe('Dashboard API', () => {
    beforeEach(async () => {
      // Create test data for dashboard
      await createTestInvoice();
      await createTestPayment();
    });

    it('GET /api/dashboard/overview should return dashboard overview', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .expect(200);

      expect(response.body).toHaveProperty('totals');
      expect(response.body).toHaveProperty('invoicesByStatus');
      expect(response.body).toHaveProperty('paymentsByStatus');
      expect(response.body.totals).toHaveProperty('invoices');
      expect(response.body.totals).toHaveProperty('payments');
    });

    it('GET /api/dashboard/activity should return recent activity', async () => {
      const response = await request(app)
        .get('/api/dashboard/activity')
        .expect(200);

      expect(response.body).toHaveProperty('activity');
      expect(Array.isArray(response.body.activity)).toBe(true);
    });

    it('GET /api/dashboard/reconciliation should return reconciliation data', async () => {
      const response = await request(app)
        .get('/api/dashboard/reconciliation')
        .expect(200);

      expect(response.body).toHaveProperty('unmatchedPayments');
      expect(response.body).toHaveProperty('unpaidInvoices');
      expect(response.body).toHaveProperty('partiallyPaidInvoices');
    });

    it('GET /api/dashboard/health should return system health', async () => {
      const response = await request(app)
        .get('/api/dashboard/health')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('syncActivity');
      expect(response.body).toHaveProperty('system');
      expect(response.body.system).toHaveProperty('uptime');
      expect(response.body.system).toHaveProperty('memory');
    });
  });

  describe('Metrics API', () => {
    it('GET /api/metrics should return application metrics', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('application');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('GET /api/metrics/requests should return request metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/requests')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('byMethod');
      expect(response.body).toHaveProperty('byEndpoint');
      expect(response.body).toHaveProperty('byStatus');
    });

    it('GET /api/metrics/performance should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/performance')
        .expect(200);

      expect(response.body).toHaveProperty('http');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('operations');
      expect(response.body.system).toHaveProperty('memory');
    });

    it('GET /api/metrics/prometheus should return Prometheus format', async () => {
      const response = await request(app)
        .get('/api/metrics/prometheus')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('POST /api/metrics/reset should reset metrics', async () => {
      const response = await request(app)
        .post('/api/metrics/reset')
        .expect(200);

      expect(response.body.message).toBe('Metrics reset successfully');
      expect(response.body).toHaveProperty('resetAt');
    });
  });
});