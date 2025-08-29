/**
 * Configuration Management Seed Data
 * Test data for configuration management system
 */

import { PrismaClient, Platform } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Simple encryption for demo purposes (use proper encryption in production)
function encryptField(value: string): { encrypted: string; iv: string } {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'demo-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex')
  };
}

export async function seedConfigurations() {
  console.log('🌱 Seeding configuration management data...');
  
  const defaultTenantId = 'demo-tenant-001';
  
  try {
    // 1. Create HubSpot API Key Configuration
    const hubspotApiConfig = await prisma.integrationConfig.create({
      data: {
        tenantId: defaultTenantId,
        platform: Platform.HUBSPOT,
        configType: 'API_KEY',
        isActive: true,
        isPrimary: true,
        apiKey: encryptField(process.env.HUBSPOT_API_KEY || 'demo-hubspot-key').encrypted,
        apiVersion: 'v3',
        hubspotPortalId: '12345678',
        environment: 'production',
        rateLimitPerMinute: 100,
        timeoutMs: 30000,
        maxRetries: 3,
        syncEnabled: true,
        syncInterval: 15, // 15 minutes
        syncDirection: 'BIDIRECTIONAL',
        features: {
          invoiceSync: true,
          contactSync: true,
          companySync: true,
          dealSync: false,
          customObjectSync: false
        },
        mappingRules: {
          invoice: {
            'hubspot.amount': 'stripe.amount_paid',
            'hubspot.status': 'stripe.status',
            'hubspot.due_date': 'stripe.due_date'
          }
        },
        healthStatus: 'HEALTHY',
        healthMessage: 'All systems operational',
        encryptionMethod: 'AES-256-GCM',
        encryptionKeyVersion: 1,
        metadata: {
          setupVersion: '1.0',
          lastMigration: 'v1.6.0'
        },
        createdBy: 'system-seed'
      }
    });
    
    // 2. Create Stripe Configuration
    const stripeConfig = await prisma.integrationConfig.create({
      data: {
        tenantId: defaultTenantId,
        platform: Platform.STRIPE,
        configType: 'API_KEY',
        isActive: true,
        isPrimary: true,
        apiKey: encryptField(process.env.STRIPE_SECRET_KEY || 'sk_test_demo').encrypted,
        apiVersion: '2023-10-16',
        stripeAccountId: 'acct_1234567890',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
        rateLimitPerMinute: 100,
        timeoutMs: 30000,
        maxRetries: 3,
        syncEnabled: true,
        syncInterval: 5, // 5 minutes for payments
        syncDirection: 'BIDIRECTIONAL',
        features: {
          paymentSync: true,
          invoiceSync: true,
          customerSync: true,
          subscriptionSync: false,
          refundSync: true,
          payoutSync: false
        },
        filterRules: {
          payments: {
            status: ['succeeded', 'processing'],
            amount: { min: 100 } // cents
          }
        },
        healthStatus: 'HEALTHY',
        encryptionMethod: 'AES-256-GCM',
        encryptionKeyVersion: 1,
        metadata: {
          webhookVersion: 'v2',
          supportedEvents: ['payment_intent.succeeded', 'invoice.paid', 'charge.refunded']
        },
        createdBy: 'system-seed'
      }
    });
    
    // 3. Create QuickBooks OAuth Configuration
    const quickbooksConfig = await prisma.integrationConfig.create({
      data: {
        tenantId: defaultTenantId,
        platform: Platform.QUICKBOOKS,
        configType: 'OAUTH',
        isActive: true,
        isPrimary: true,
        quickbooksCompanyId: process.env.QUICKBOOKS_COMPANY_ID || 'demo-company-id',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
        rateLimitPerMinute: 500,
        timeoutMs: 60000, // QuickBooks can be slower
        maxRetries: 5,
        syncEnabled: true,
        syncInterval: 30, // 30 minutes
        syncDirection: 'OUTBOUND', // Only push to QuickBooks
        features: {
          invoiceCreate: true,
          invoiceUpdate: true,
          paymentCreate: true,
          customerCreate: true,
          itemCreate: false,
          taxCalculation: true
        },
        transformRules: {
          invoice: {
            taxCalculation: 'automatic',
            currencyConversion: true,
            lineItemGrouping: 'by-tax-rate'
          }
        },
        healthStatus: 'UNKNOWN',
        encryptionMethod: 'AES-256-GCM',
        encryptionKeyVersion: 1,
        metadata: {
          minorVersion: '65',
          supportedEntities: ['Invoice', 'Payment', 'Customer', 'Item']
        },
        createdBy: 'system-seed'
      }
    });
    
    // 4. Create HubSpot Webhook Configuration
    const hubspotWebhook = await prisma.webhookConfiguration.create({
      data: {
        tenantId: defaultTenantId,
        integrationConfigId: hubspotApiConfig.id,
        platform: Platform.HUBSPOT,
        webhookType: 'INBOUND',
        endpointUrl: `${process.env.API_BASE_URL || 'http://localhost:3000'}/webhooks/hubspot`,
        httpMethod: 'POST',
        isActive: true,
        signingSecret: encryptField(process.env.HUBSPOT_WEBHOOK_SECRET || 'demo-secret').encrypted,
        authType: 'SIGNATURE',
        subscribedEvents: [
          'deal.creation',
          'deal.propertyChange',
          'deal.deletion',
          'contact.creation',
          'contact.propertyChange',
          'company.creation',
          'company.propertyChange'
        ],
        eventFilters: {
          propertyChanges: ['amount', 'closedate', 'dealstage', 'pipeline']
        },
        maxRetries: 3,
        retryDelayMs: 1000,
        retryBackoffMultiplier: 2.0,
        timeoutMs: 30000,
        circuitBreakerEnabled: true,
        circuitBreakerThreshold: 5,
        circuitBreakerResetAfterMs: 300000,
        circuitBreakerStatus: 'CLOSED',
        hubspotAppId: '1234567',
        totalTriggerCount: 0,
        totalSuccessCount: 0,
        totalFailureCount: 0,
        consecutiveFailures: 0,
        encryptionMethod: 'AES-256-GCM',
        encryptionKeyVersion: 1,
        metadata: {
          version: 'v3',
          subscriptionActive: true
        },
        createdBy: 'system-seed'
      }
    });
    
    // 5. Create Stripe Webhook Configuration
    const stripeWebhook = await prisma.webhookConfiguration.create({
      data: {
        tenantId: defaultTenantId,
        integrationConfigId: stripeConfig.id,
        platform: Platform.STRIPE,
        webhookType: 'INBOUND',
        endpointUrl: `${process.env.API_BASE_URL || 'http://localhost:3000'}/webhooks/stripe`,
        httpMethod: 'POST',
        isActive: true,
        signingSecret: encryptField(process.env.STRIPE_WEBHOOK_SECRET || 'whsec_demo').encrypted,
        authType: 'SIGNATURE',
        subscribedEvents: [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'charge.succeeded',
          'charge.failed',
          'invoice.paid',
          'invoice.payment_failed',
          'customer.created',
          'customer.updated'
        ],
        maxRetries: 3,
        retryDelayMs: 1000,
        retryBackoffMultiplier: 2.0,
        timeoutMs: 30000,
        circuitBreakerEnabled: true,
        circuitBreakerThreshold: 10,
        circuitBreakerResetAfterMs: 600000,
        circuitBreakerStatus: 'CLOSED',
        stripeWebhookEndpointId: 'we_1234567890',
        totalTriggerCount: 0,
        totalSuccessCount: 0,
        totalFailureCount: 0,
        consecutiveFailures: 0,
        encryptionMethod: 'AES-256-GCM',
        encryptionKeyVersion: 1,
        metadata: {
          apiVersion: '2023-10-16',
          endpointVersion: 2
        },
        createdBy: 'system-seed'
      }
    });
    
    // 6. Create sample audit logs
    await prisma.configurationAuditLog.createMany({
      data: [
        {
          tenantId: defaultTenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: hubspotApiConfig.id,
          action: 'CREATE',
          performedBy: 'system-seed',
          performedByEmail: 'system@example.com',
          performedByName: 'System Seed',
          riskLevel: 'LOW',
          requiresReview: false,
          platform: Platform.HUBSPOT,
          environment: 'production',
          metadata: {
            reason: 'Initial setup',
            automated: true
          }
        },
        {
          tenantId: defaultTenantId,
          entityType: 'WEBHOOK_CONFIG',
          entityId: stripeWebhook.id,
          action: 'CREATE',
          performedBy: 'system-seed',
          performedByEmail: 'system@example.com',
          performedByName: 'System Seed',
          riskLevel: 'MEDIUM',
          requiresReview: false,
          platform: Platform.STRIPE,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
          metadata: {
            reason: 'Webhook setup for payment processing',
            automated: true
          }
        },
        {
          tenantId: defaultTenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: quickbooksConfig.id,
          action: 'VALIDATE',
          performedBy: 'system-seed',
          performedByEmail: 'system@example.com',
          performedByName: 'System Seed',
          riskLevel: 'LOW',
          requiresReview: false,
          platform: Platform.QUICKBOOKS,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
          metadata: {
            validationResult: 'pending',
            message: 'OAuth token required for validation'
          }
        }
      ]
    });
    
    console.log('✅ Configuration management data seeded successfully');
    console.log(`  - Created ${3} integration configurations`);
    console.log(`  - Created ${2} webhook configurations`);
    console.log(`  - Created ${3} audit log entries`);
    
    return {
      hubspotConfig: hubspotApiConfig,
      stripeConfig,
      quickbooksConfig,
      hubspotWebhook,
      stripeWebhook
    };
    
  } catch (error) {
    console.error('❌ Error seeding configuration data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedConfigurations()
    .then(() => {
      console.log('🎉 Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}