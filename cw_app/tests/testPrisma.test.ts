/**
 * Test to verify testPrisma is properly initialized and accessible
 */

import { testPrisma, createTestInvoice, createTestPayment } from './setup';

describe('Test Database Access Patterns', () => {
  describe('testPrisma initialization', () => {
    it('should have testPrisma defined and accessible', () => {
      expect(testPrisma).toBeDefined();
      expect(testPrisma).not.toBeNull();
      expect(testPrisma).toHaveProperty('invoiceMapping');
      expect(testPrisma).toHaveProperty('paymentMapping');
    });

    it('should be able to query the tenant table', async () => {
      const tenant = await testPrisma.tenant.findUnique({
        where: { id: 'test-tenant-id' }
      });
      expect(tenant).toBeDefined();
      expect(tenant?.name).toBe('Test Tenant');
    });
  });

  describe('Test helper functions', () => {
    it('should create test invoice with tenant_id', async () => {
      const invoice = await createTestInvoice();
      expect(invoice).toBeDefined();
      expect(invoice.tenant_id).toBe('test-tenant-id');
      expect(invoice.hubspotDealId).toBe('test-deal-123');
    });

    it('should create test payment with tenant_id', async () => {
      const payment = await createTestPayment();
      expect(payment).toBeDefined();
      expect(payment.tenant_id).toBe('test-tenant-id');
      expect(payment.stripePaymentId).toBe('pi_test_123');
    });

    it('should handle overrides properly', async () => {
      const customInvoice = await createTestInvoice({
        hubspotDealId: 'custom-deal-456',
        totalAmount: 2000
      });
      expect(customInvoice.hubspotDealId).toBe('custom-deal-456');
      expect(Number(customInvoice.totalAmount)).toBe(2000);
      expect(customInvoice.tenant_id).toBe('test-tenant-id');
    });
  });

  describe('Database operations', () => {
    it('should be able to perform CRUD operations', async () => {
      // Create
      const invoice = await testPrisma.invoiceMapping.create({
        data: {
          tenant_id: 'test-tenant-id',
          hubspotDealId: 'crud-test-123',
          totalAmount: 1500,
          currency: 'USD',
          status: 'DRAFT'
        }
      });
      expect(invoice.id).toBeDefined();

      // Read
      const foundInvoice = await testPrisma.invoiceMapping.findUnique({
        where: { id: invoice.id }
      });
      expect(foundInvoice?.hubspotDealId).toBe('crud-test-123');

      // Update
      const updatedInvoice = await testPrisma.invoiceMapping.update({
        where: { id: invoice.id },
        data: { status: 'SENT' }
      });
      expect(updatedInvoice.status).toBe('SENT');

      // Delete
      await testPrisma.invoiceMapping.delete({
        where: { id: invoice.id }
      });
      
      const deletedInvoice = await testPrisma.invoiceMapping.findUnique({
        where: { id: invoice.id }
      });
      expect(deletedInvoice).toBeNull();
    });
  });
});