import { Router } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../index';
import { HubSpotWebhookEvent } from '../types/hubspot';
import { endpointValidators } from '../middleware/validation';
import { webhookAuth } from '../middleware/auth';

export const hubspotWebhooks = Router();

hubspotWebhooks.post('/', webhookAuth, endpointValidators.webhookReceiver, asyncHandler(async (req, res) => {
  const events = req.body;
  
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid webhook payload format' });
  }

  logger.info(`HubSpot webhook received with ${events.length} event(s)`);

  for (const event of events) {
    try {
      // Log webhook event
      await prisma.webhookEvent.create({
        data: {
          platform: 'HUBSPOT',
          eventType: event.subscriptionType,
          eventId: `${event.objectId}-${event.occurredAt}`,
          payload: event
        }
      });

      // Process based on event type
      switch (event.subscriptionType) {
        case 'deal.creation':
        case 'deal.propertyChange':
          await handleDealEvent(event);
          break;
        
        case 'contact.creation':
        case 'contact.propertyChange':
          await handleContactEvent(event);
          break;
        
        default:
          logger.info(`Unhandled HubSpot event type: ${event.subscriptionType}`);
      }

      // Mark as processed
      await prisma.webhookEvent.updateMany({
        where: {
          platform: 'HUBSPOT',
          eventId: `${event.objectId}-${event.occurredAt}`
        },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

    } catch (error: unknown) {
      logger.error('Error processing HubSpot webhook event:', error);
      
      await prisma.webhookEvent.updateMany({
        where: {
          platform: 'HUBSPOT',
          eventId: `${event.objectId}-${event.occurredAt}`
        },
        data: {
          processed: false,
          errorMessage: error.message
        }
      });
    }
  }

  res.json({ received: true, processed: events.length });
}));

async function handleDealEvent(event: HubSpotWebhookEvent) {
  logger.info(`Processing HubSpot deal event: ${event.subscriptionType} for deal ${event.objectId}`);

  const dealId = event.objectId.toString();

  // Check if this is a property change that indicates invoice creation
  if (event.subscriptionType === 'deal.propertyChange') {
    const changedProperties = event.propertyName ? [event.propertyName] : [];
    
    // Check if invoice-related properties changed
    const invoiceProperties = ['invoice_status', 'invoice_amount', 'invoice_date'];
    const hasInvoiceChanges = changedProperties.some(prop => invoiceProperties.includes(prop));

    if (!hasInvoiceChanges) {
      logger.info(`Deal property change doesn't affect invoicing: ${changedProperties.join(', ')}`);
      return;
    }
  }

  // TODO: Fetch deal details from HubSpot API
  // For now, create a placeholder invoice mapping
  try {
    const existingMapping = await prisma.invoiceMapping.findFirst({
      where: { hubspotDealId: dealId }
    });

    if (!existingMapping) {
      // Create new invoice mapping
      const invoiceMapping = await prisma.invoiceMapping.create({
        data: {
          hubspotDealId: dealId,
          totalAmount: 0, // Will be updated when we fetch deal details
          status: 'DRAFT',
          description: `Invoice for HubSpot Deal ${dealId}`,
          issueDate: new Date()
        }
      });

      logger.info(`Created invoice mapping for HubSpot deal: ${invoiceMapping.id}`);

      // Create sync log
      await prisma.syncLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoiceMapping.id,
          operation: 'CREATE',
          platform: 'HUBSPOT',
          status: 'PENDING',
          requestData: { dealId, eventType: event.subscriptionType }
        }
      });

      // TODO: Add job to queue for syncing to QuickBooks
    } else {
      logger.info(`Invoice mapping already exists for deal ${dealId}: ${existingMapping.id}`);
      
      // Update last sync time
      await prisma.invoiceMapping.update({
        where: { id: existingMapping.id },
        data: { lastSyncAt: new Date() }
      });
    }

  } catch (error: unknown) {
    logger.error(`Failed to process HubSpot deal event for ${dealId}:`, error);
    throw error;
  }
}

async function handleContactEvent(event: HubSpotWebhookEvent) {
  logger.info(`Processing HubSpot contact event: ${event.subscriptionType} for contact ${event.objectId}`);
  
  // TODO: Implement contact sync logic if needed
  // This might be useful for customer information synchronization
}

// Webhook verification endpoint for HubSpot setup
hubspotWebhooks.get('/', (req, res) => {
  const challenge = req.query['hub.challenge'];
  if (challenge) {
    res.send(challenge);
  } else {
    res.json({ 
      status: 'HubSpot webhook endpoint',
      timestamp: new Date().toISOString()
    });
  }
});