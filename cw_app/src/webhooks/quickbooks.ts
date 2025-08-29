import { Router } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../index';

export const quickbooksWebhooks = Router();

quickbooksWebhooks.post('/', asyncHandler(async (req, res) => {
  const payload = req.body;
  
  logger.info('QuickBooks webhook received:', payload);

  // QuickBooks webhook payload structure
  const eventNotifications = payload.eventNotifications || [];

  for (const notification of eventNotifications) {
    const entities = notification.dataChangeEvent?.entities || [];
    
    for (const entity of entities) {
      try {
        // Log webhook event
        await prisma.webhookEvent.create({
          data: {
            platform: 'QUICKBOOKS',
            eventType: `${entity.name}.${entity.operation}`,
            eventId: `${entity.name}-${entity.id}-${entity.lastUpdated}`,
            payload: entity
          }
        });

        // Process based on entity type and operation
        switch (entity.name) {
          case 'Invoice':
            await handleInvoiceEvent(entity);
            break;
          
          case 'Payment':
            await handlePaymentEvent(entity);
            break;
          
          case 'Customer':
            await handleCustomerEvent(entity);
            break;
          
          default:
            logger.info(`Unhandled QuickBooks entity type: ${entity.name}`);
        }

        // Mark as processed
        await prisma.webhookEvent.updateMany({
          where: {
            platform: 'QUICKBOOKS',
            eventId: `${entity.name}-${entity.id}-${entity.lastUpdated}`
          },
          data: {
            processed: true,
            processedAt: new Date()
          }
        });

      } catch (error: any) {
        logger.error('Error processing QuickBooks webhook entity:', error);
        
        await prisma.webhookEvent.updateMany({
          where: {
            platform: 'QUICKBOOKS',
            eventId: `${entity.name}-${entity.id}-${entity.lastUpdated}`
          },
          data: {
            processed: false,
            errorMessage: error.message
          }
        });
      }
    }
  }

  res.json({ received: true });
}));

async function handleInvoiceEvent(entity: any) {
  logger.info(`Processing QuickBooks invoice event: ${entity.operation} for invoice ${entity.id}`);

  const qbInvoiceId = entity.id.toString();

  try {
    const existingMapping = await prisma.invoiceMapping.findFirst({
      where: { quickbooksInvoiceId: qbInvoiceId }
    });

    if (entity.operation === 'Create' && !existingMapping) {
      logger.info(`New QuickBooks invoice created: ${qbInvoiceId}`);
      // This might be a manually created invoice in QB
      // We'll need to fetch details from QB API and potentially sync back to HubSpot
      
      // TODO: Fetch invoice details from QuickBooks API
      // TODO: Create invoice mapping and sync to HubSpot if needed

    } else if (entity.operation === 'Update' && existingMapping) {
      logger.info(`QuickBooks invoice updated: ${qbInvoiceId}`);
      
      // Update last sync time
      await prisma.invoiceMapping.update({
        where: { id: existingMapping.id },
        data: { lastSyncAt: new Date() }
      });

      // TODO: Fetch updated details and sync status changes to HubSpot

    } else if (entity.operation === 'Delete' && existingMapping) {
      logger.info(`QuickBooks invoice deleted: ${qbInvoiceId}`);
      
      // Handle invoice deletion - might need to update status instead of deleting
      await prisma.invoiceMapping.update({
        where: { id: existingMapping.id },
        data: { 
          status: 'CANCELLED',
          lastSyncAt: new Date() 
        }
      });
    }

  } catch (error: any) {
    logger.error(`Failed to process QuickBooks invoice event for ${qbInvoiceId}:`, error);
    throw error;
  }
}

async function handlePaymentEvent(entity: any) {
  logger.info(`Processing QuickBooks payment event: ${entity.operation} for payment ${entity.id}`);

  const qbPaymentId = entity.id.toString();

  try {
    const existingMapping = await prisma.paymentMapping.findFirst({
      where: { quickbooksPaymentId: qbPaymentId }
    });

    if (entity.operation === 'Create' && !existingMapping) {
      logger.info(`New QuickBooks payment created: ${qbPaymentId}`);
      
      // TODO: Fetch payment details from QuickBooks API
      // TODO: Create payment mapping and attempt automatic matching
      
      // Create sync log for processing
      await prisma.syncLog.create({
        data: {
          entityType: 'PAYMENT',
          entityId: qbPaymentId,
          operation: 'CREATE',
          platform: 'QUICKBOOKS',
          status: 'PENDING',
          requestData: { quickbooksPaymentId: qbPaymentId }
        }
      });

    } else if (entity.operation === 'Update' && existingMapping) {
      logger.info(`QuickBooks payment updated: ${qbPaymentId}`);
      
      // Update last sync time
      await prisma.paymentMapping.update({
        where: { id: existingMapping.id },
        data: { lastSyncAt: new Date() }
      });

      // TODO: Sync updated payment details to HubSpot

    } else if (entity.operation === 'Delete' && existingMapping) {
      logger.info(`QuickBooks payment deleted: ${qbPaymentId}`);
      
      // Handle payment deletion
      await prisma.paymentMapping.update({
        where: { id: existingMapping.id },
        data: { 
          status: 'CANCELLED',
          lastSyncAt: new Date() 
        }
      });
    }

  } catch (error: any) {
    logger.error(`Failed to process QuickBooks payment event for ${qbPaymentId}:`, error);
    throw error;
  }
}

async function handleCustomerEvent(entity: any) {
  logger.info(`Processing QuickBooks customer event: ${entity.operation} for customer ${entity.id}`);
  
  // TODO: Implement customer sync logic if needed
  // This might be useful for maintaining customer information consistency
}

// Webhook verification endpoint for QuickBooks setup
quickbooksWebhooks.get('/', (req, res) => {
  res.json({
    status: 'QuickBooks webhook endpoint',
    timestamp: new Date().toISOString(),
    ready: true
  });
});