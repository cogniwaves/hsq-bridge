import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Starting database seed...');

  try {
    // Clean up existing data (development only)
    if (process.env.NODE_ENV === 'development') {
      logger.info('🧹 Cleaning existing data...');
      
      await prisma.invoicePayment.deleteMany();
      await prisma.syncLog.deleteMany();
      await prisma.webhookEvent.deleteMany();
      await prisma.paymentMapping.deleteMany();
      await prisma.invoiceMapping.deleteMany();
      
      logger.info('✅ Existing data cleaned');
    }

    // Create sample invoice mappings
    logger.info('📄 Creating sample invoices...');
    
    const invoice1 = await prisma.invoiceMapping.create({
      data: {
        hubspotDealId: 'deal_12345',
        totalAmount: 1500.00,
        currency: 'USD',
        status: 'SENT',
        clientEmail: 'john.doe@example.com',
        clientName: 'John Doe',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        issueDate: new Date(),
        description: 'Consulting services Q1 2024'
      }
    });

    const invoice2 = await prisma.invoiceMapping.create({
      data: {
        hubspotDealId: 'deal_67890',
        totalAmount: 2500.50,
        currency: 'USD',
        status: 'PARTIALLY_PAID',
        clientEmail: 'jane.smith@company.com',
        clientName: 'Jane Smith',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        description: 'Web development project'
      }
    });

    const invoice3 = await prisma.invoiceMapping.create({
      data: {
        hubspotDealId: 'deal_54321',
        totalAmount: 750.00,
        currency: 'USD',
        status: 'PAID',
        clientEmail: 'bob.wilson@startup.io',
        clientName: 'Bob Wilson',
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        issueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        description: 'Logo design and branding'
      }
    });

    // Create sample payment mappings
    logger.info('💳 Creating sample payments...');
    
    const payment1 = await prisma.paymentMapping.create({
      data: {
        stripePaymentId: 'pi_test_1234567890',
        amount: 750.00,
        currency: 'USD',
        paymentMethod: 'STRIPE_CARD',
        status: 'COMPLETED',
        transactionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        description: 'Payment for logo design',
        metadata: {
          customer_email: 'bob.wilson@startup.io',
          invoice_id: 'deal_54321'
        }
      }
    });

    const payment2 = await prisma.paymentMapping.create({
      data: {
        stripePaymentId: 'pi_test_0987654321',
        amount: 1000.00,
        currency: 'USD',
        paymentMethod: 'STRIPE_CARD',
        status: 'COMPLETED',
        transactionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        description: 'Partial payment for web development',
        metadata: {
          customer_email: 'jane.smith@company.com'
        }
      }
    });

    const payment3 = await prisma.paymentMapping.create({
      data: {
        amount: 500.00,
        currency: 'USD',
        paymentMethod: 'QUICKBOOKS_CHECK',
        status: 'COMPLETED',
        transactionDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
        description: 'Check payment',
        quickbooksPaymentId: 'qb_payment_abc123'
      }
    });

    // Create invoice-payment allocations
    logger.info('🔗 Creating payment allocations...');
    
    // Full payment for invoice3
    await prisma.invoicePayment.create({
      data: {
        invoiceMappingId: invoice3.id,
        paymentMappingId: payment1.id,
        allocatedAmount: 750.00,
        status: 'ALLOCATED'
      }
    });

    // Partial payment for invoice2
    await prisma.invoicePayment.create({
      data: {
        invoiceMappingId: invoice2.id,
        paymentMappingId: payment2.id,
        allocatedAmount: 1000.00,
        status: 'ALLOCATED'
      }
    });

    // Create sample sync logs
    logger.info('📊 Creating sample sync logs...');
    
    await prisma.syncLog.create({
      data: {
        entityType: 'INVOICE',
        entityId: invoice1.id,
        operation: 'CREATE',
        platform: 'QUICKBOOKS',
        status: 'COMPLETED',
        requestData: { hubspotDealId: 'deal_12345' },
        responseData: { quickbooksInvoiceId: 'qb_inv_001' }
      }
    });

    await prisma.syncLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: payment1.id,
        operation: 'SYNC',
        platform: 'HUBSPOT',
        status: 'COMPLETED',
        requestData: { stripePaymentId: 'pi_test_1234567890' },
        responseData: { dealUpdated: true }
      }
    });

    await prisma.syncLog.create({
      data: {
        entityType: 'INVOICE',
        entityId: invoice2.id,
        operation: 'UPDATE',
        platform: 'HUBSPOT',
        status: 'FAILED',
        errorMessage: 'API rate limit exceeded',
        retryCount: 2,
        requestData: { status: 'PARTIALLY_PAID' }
      }
    });

    // Create sample webhook events
    logger.info('🪝 Creating sample webhook events...');
    
    await prisma.webhookEvent.create({
      data: {
        platform: 'STRIPE',
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test_webhook_001',
        payload: {
          id: 'pi_test_1234567890',
          amount: 75000,
          currency: 'usd',
          status: 'succeeded'
        },
        processed: true,
        processedAt: new Date()
      }
    });

    await prisma.webhookEvent.create({
      data: {
        platform: 'HUBSPOT',
        eventType: 'deal.propertyChange',
        eventId: 'hubspot_evt_001',
        payload: {
          objectId: 12345,
          propertyName: 'dealstage',
          propertyValue: 'closedwon'
        },
        processed: true,
        processedAt: new Date()
      }
    });

    await prisma.webhookEvent.create({
      data: {
        platform: 'QUICKBOOKS',
        eventType: 'Invoice.Update',
        eventId: 'qb_evt_001',
        payload: {
          id: 'qb_inv_001',
          status: 'paid'
        },
        processed: false
      }
    });

    logger.info('✅ Database seeded successfully!');
    logger.info(`   📄 Created ${await prisma.invoiceMapping.count()} invoices`);
    logger.info(`   💳 Created ${await prisma.paymentMapping.count()} payments`);
    logger.info(`   🔗 Created ${await prisma.invoicePayment.count()} allocations`);
    logger.info(`   📊 Created ${await prisma.syncLog.count()} sync logs`);
    logger.info(`   🪝 Created ${await prisma.webhookEvent.count()} webhook events`);

  } catch (error) {
    logger.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });