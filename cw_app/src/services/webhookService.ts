import { Platform } from '@prisma/client';
import { createHash, createHmac } from 'crypto';
import { logger } from '../utils/logger';
import { getNormalizedInvoiceExtractor } from './normalizedInvoiceExtractor';
import { getContactService } from './contactService';
import { getCompanyService } from './companyService';
import { getHubSpotClient } from './hubspotClient';
import { prisma } from '../index';

export interface HubSpotWebhookEvent {
  eventId: string;
  subscriptionId: string;
  portalId: string;
  occurredAt: number;
  subscriptionType: string;
  attemptNumber: number;
  objectId: string;
  changeSource: string;
  eventType: string;
  propertyName?: string;
  propertyValue?: string;
}

export interface WebhookProcessingResult {
  eventId: string;
  processed: boolean;
  action: string;
  error?: string;
  processingTime: number;
}

export class WebhookService {
  private webhookSecret: string;
  private extractor = getNormalizedInvoiceExtractor();
  private contactService = getContactService();
  private companyService = getCompanyService();

  constructor() {
    this.webhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET || '';
    if (!this.webhookSecret) {
      logger.warn('HUBSPOT_WEBHOOK_SECRET not set - webhook signature verification disabled');
    }
  }

  // Verify webhook signature from HubSpot
  verifySignature(requestBody: string, signature: string, timestamp: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('Webhook signature verification skipped - no secret configured');
      return true; // Allow in development
    }

    try {
      // HubSpot signature format: sha256=hash
      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(requestBody + timestamp)
        .digest('hex');
      
      const receivedSignature = signature.replace('sha256=', '');
      
      return createHash('sha256')
        .update(expectedSignature)
        .digest('hex') === createHash('sha256')
        .update(receivedSignature)
        .digest('hex');
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // Process incoming webhook events
  async processWebhookEvents(events: HubSpotWebhookEvent[]): Promise<WebhookProcessingResult[]> {
    const results: WebhookProcessingResult[] = [];

    for (const event of events) {
      const startTime = Date.now();
      
      try {
        // Store webhook event in database
        await this.storeWebhookEvent(event);
        
        // Process based on subscription type
        const action = await this.processWebhookEvent(event);
        
        // Mark as processed
        await this.markEventProcessed(event.eventId);
        
        results.push({
          eventId: event.eventId,
          processed: true,
          action,
          processingTime: Date.now() - startTime
        });
        
        logger.info(`Processed webhook event ${event.eventId}: ${action}`);
        
      } catch (error) {
        const errorMsg = `Failed to process webhook event ${event.eventId}: ${error}`;
        logger.error(errorMsg);
        
        // Mark as failed
        await this.markEventFailed(event.eventId, errorMsg);
        
        results.push({
          eventId: event.eventId,
          processed: false,
          action: 'error',
          error: errorMsg,
          processingTime: Date.now() - startTime
        });
      }
    }

    return results;
  }

  // Process individual webhook event based on type
  private async processWebhookEvent(event: HubSpotWebhookEvent): Promise<string> {
    const { subscriptionType, objectId, eventType } = event;

    switch (subscriptionType) {
      case 'invoice.propertyChange':
      case 'invoice.creation':
      case 'invoice.deletion':
        return await this.processInvoiceEvent(objectId, eventType);
        
      case 'contact.propertyChange':
      case 'contact.creation':
      case 'contact.deletion':
        return await this.processContactEvent(objectId, eventType);
        
      case 'company.propertyChange':
      case 'company.creation':
      case 'company.deletion':
        return await this.processCompanyEvent(objectId, eventType);
        
      default:
        logger.warn(`Unknown subscription type: ${subscriptionType}`);
        return 'ignored-unknown-type';
    }
  }

  // Process invoice webhook events
  private async processInvoiceEvent(objectId: string, eventType: string): Promise<string> {
    try {
      if (eventType === 'deletion') {
        // Handle invoice deletion
        await this.handleInvoiceDeletion(objectId);
        return 'invoice-deleted';
      }

      // For creation and updates, fetch and sync the invoice
      const hubspotClient = getHubSpotClient();
      const allInvoices = await hubspotClient.getAllInvoices();
      const invoice = allInvoices.find(inv => inv.id === objectId);

      if (!invoice) {
        logger.warn(`Invoice ${objectId} not found in HubSpot (may have been deleted)`);
        await this.handleInvoiceDeletion(objectId);
        return 'invoice-not-found-deleted';
      }

      // Process with normalized extractor
      const stats = {
        totalProcessed: 0,
        newInvoices: 0,
        updatedInvoices: 0,
        skippedInvoices: 0,
        newContacts: 0,
        updatedContacts: 0,
        newCompanies: 0,
        updatedCompanies: 0,
        errors: [],
        processingTime: 0,
        lastSyncTimestamp: new Date()
      };

      const result = await this.extractor['processNormalizedInvoice'](invoice, stats);
      
      return eventType === 'creation' ? 'invoice-created' : 'invoice-updated';
      
    } catch (error) {
      logger.error(`Error processing invoice webhook for ${objectId}:`, error);
      throw error;
    }
  }

  // Process contact webhook events
  private async processContactEvent(objectId: string, eventType: string): Promise<string> {
    try {
      if (eventType === 'deletion') {
        // Handle contact deletion (set to null in associations)
        await this.handleContactDeletion(objectId);
        return 'contact-deleted';
      }

      // For creation and updates, fetch and sync the contact
      const contactId = await this.contactService.fetchAndUpsertContact(objectId);
      
      if (!contactId) {
        logger.warn(`Contact ${objectId} not found in HubSpot (may have been deleted)`);
        await this.handleContactDeletion(objectId);
        return 'contact-not-found-deleted';
      }

      return eventType === 'creation' ? 'contact-created' : 'contact-updated';
      
    } catch (error) {
      logger.error(`Error processing contact webhook for ${objectId}:`, error);
      throw error;
    }
  }

  // Process company webhook events
  private async processCompanyEvent(objectId: string, eventType: string): Promise<string> {
    try {
      if (eventType === 'deletion') {
        // Handle company deletion (set to null in associations)
        await this.handleCompanyDeletion(objectId);
        return 'company-deleted';
      }

      // For creation and updates, fetch and sync the company
      const companyId = await this.companyService.fetchAndUpsertCompany(objectId);
      
      if (!companyId) {
        logger.warn(`Company ${objectId} not found in HubSpot (may have been deleted)`);
        await this.handleCompanyDeletion(objectId);
        return 'company-not-found-deleted';
      }

      return eventType === 'creation' ? 'company-created' : 'company-updated';
      
    } catch (error) {
      logger.error(`Error processing company webhook for ${objectId}:`, error);
      throw error;
    }
  }

  // Handle invoice deletion
  private async handleInvoiceDeletion(hubspotInvoiceId: string): Promise<void> {
    // Find and delete invoice and its associations
    const invoice = await prisma.invoiceMapping.findFirst({
      where: {
        OR: [
          { hubspotInvoiceId },
          { hubspotObjectId: hubspotInvoiceId }
        ]
      }
    });

    if (invoice) {
      // Delete associations first (due to foreign key constraints)
      await prisma.invoiceAssociation.deleteMany({
        where: { invoiceId: invoice.id }
      });
      
      // Delete invoice
      await prisma.invoiceMapping.delete({
        where: { id: invoice.id }
      });
      
      logger.info(`Deleted invoice ${invoice.id} (HubSpot: ${hubspotInvoiceId})`);
    }
  }

  // Handle contact deletion
  private async handleContactDeletion(hubspotContactId: string): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { hubspotContactId }
    });

    if (contact) {
      // Set contact associations to null instead of deleting them
      await prisma.invoiceAssociation.updateMany({
        where: { contactId: contact.id },
        data: { contactId: null, isPrimaryContact: false }
      });
      
      // Delete the contact
      await prisma.contact.delete({
        where: { id: contact.id }
      });
      
      logger.info(`Deleted contact ${contact.id} (HubSpot: ${hubspotContactId})`);
    }
  }

  // Handle company deletion
  private async handleCompanyDeletion(hubspotCompanyId: string): Promise<void> {
    const company = await prisma.company.findUnique({
      where: { hubspotCompanyId }
    });

    if (company) {
      // Set company associations to null instead of deleting them
      await prisma.invoiceAssociation.updateMany({
        where: { companyId: company.id },
        data: { companyId: null, isPrimaryCompany: false }
      });
      
      // Delete the company
      await prisma.company.delete({
        where: { id: company.id }
      });
      
      logger.info(`Deleted company ${company.id} (HubSpot: ${hubspotCompanyId})`);
    }
  }

  // Store webhook event in database
  private async storeWebhookEvent(event: HubSpotWebhookEvent): Promise<void> {
    await prisma.webhookEvent.create({
      data: {
        platform: Platform.HUBSPOT,
        eventType: event.subscriptionType,
        eventId: event.eventId,
        payload: event,
        processed: false
      }
    });
  }

  // Mark event as processed
  private async markEventProcessed(eventId: string): Promise<void> {
    await prisma.webhookEvent.updateMany({
      where: { eventId },
      data: {
        processed: true,
        processedAt: new Date()
      }
    });
  }

  // Mark event as failed
  private async markEventFailed(eventId: string, error: string): Promise<void> {
    await prisma.webhookEvent.updateMany({
      where: { eventId },
      data: {
        processed: false,
        errorMessage: error,
        retryCount: { increment: 1 }
      }
    });
  }

  // Get webhook statistics
  async getWebhookStats(since?: Date): Promise<any> {
    const whereClause = since ? { createdAt: { gte: since } } : {};

    const [total, processed, failed, byType] = await Promise.all([
      prisma.webhookEvent.count({ where: whereClause }),
      prisma.webhookEvent.count({ 
        where: { ...whereClause, processed: true } 
      }),
      prisma.webhookEvent.count({ 
        where: { ...whereClause, processed: false, errorMessage: { not: null } } 
      }),
      prisma.webhookEvent.groupBy({
        by: ['eventType'],
        where: whereClause,
        _count: true
      })
    ]);

    return {
      total,
      processed,
      failed,
      pending: total - processed - failed,
      byType: byType.reduce((acc, item) => {
        acc[item.eventType] = item._count;
        return acc;
      }, {} as Record<string, number>),
      successRate: total > 0 ? Math.round((processed / total) * 100) : 0
    };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.extractor.cleanup();
    await this.contactService.cleanup();
    await this.companyService.cleanup();
    await prisma.$disconnect();
  }
}

// Singleton instance
let webhookService: WebhookService | null = null;

export function getWebhookService(): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService();
  }
  return webhookService;
}