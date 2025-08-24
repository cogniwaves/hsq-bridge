import { Router, Request, Response } from 'express';
import { getWebhookService, HubSpotWebhookEvent } from '../services/webhookService';
import { logger } from '../utils/logger';

export const webhookRoutes = Router();

// HubSpot webhook endpoint
webhookRoutes.post('/hubspot', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hubspot-signature'] as string;
    const timestamp = req.headers['x-hubspot-request-timestamp'] as string;
    
    // Parse raw body (Express raw middleware gives us Buffer)
    const requestBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
    let events: HubSpotWebhookEvent[];
    
    try {
      events = typeof req.body === 'string' ? JSON.parse(req.body) : 
               req.body instanceof Buffer ? JSON.parse(req.body.toString()) : req.body;
    } catch (parseError) {
      logger.error('Failed to parse webhook body:', parseError);
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON in webhook body'
      });
    }

    logger.info('Received HubSpot webhook', {
      signature: signature ? '***' : 'missing',
      timestamp,
      bodySize: requestBody.length,
      events: events?.length || 0
    });

    const webhookService = getWebhookService();

    // Verify webhook signature if provided
    if (signature && timestamp) {
      const isValid = webhookService.verifySignature(requestBody, signature, timestamp);
      if (!isValid) {
        logger.warn('Invalid webhook signature received');
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }
    } else {
      logger.warn('Webhook received without signature - allowing in development mode');
    }

    // Validate events array
    if (!Array.isArray(events) || events.length === 0) {
      logger.warn('No events found in webhook payload');
      return res.status(400).json({
        success: false,
        error: 'No events found in payload'
      });
    }

    logger.info(`Processing ${events.length} webhook events`);

    // Process all events
    const results = await webhookService.processWebhookEvents(events);

    // Calculate summary
    const processed = results.filter(r => r.processed).length;
    const failed = results.filter(r => !r.processed).length;
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

    logger.info(`Webhook processing completed: ${processed} processed, ${failed} failed, avg ${Math.round(avgProcessingTime)}ms`);

    res.status(200).json({
      success: true,
      message: `Processed ${events.length} webhook events`,
      summary: {
        totalEvents: events.length,
        processed,
        failed,
        averageProcessingTime: Math.round(avgProcessingTime)
      },
      results: results.map(r => ({
        eventId: r.eventId,
        processed: r.processed,
        action: r.action,
        error: r.error
      }))
    });

  } catch (error) {
    logger.error('Webhook processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal webhook processing error',
      message: error.message
    });
  }
});

// Webhook statistics endpoint
webhookRoutes.get('/stats', async (req: Request, res: Response) => {
  try {
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    
    const webhookService = getWebhookService();
    const stats = await webhookService.getWebhookStats(since);

    res.json({
      success: true,
      message: 'Webhook statistics retrieved',
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get webhook stats:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve webhook statistics',
      message: error.message
    });
  }
});

// Webhook test endpoint (for development)
webhookRoutes.post('/test', async (req: Request, res: Response) => {
  try {
    const testEvent: HubSpotWebhookEvent = {
      eventId: `test-${Date.now()}`,
      subscriptionId: 'test-subscription',
      portalId: 'test-portal',
      occurredAt: Date.now(),
      subscriptionType: req.body.subscriptionType || 'invoice.propertyChange',
      attemptNumber: 1,
      objectId: req.body.objectId || 'test-object-id',
      changeSource: 'API',
      eventType: req.body.eventType || 'propertyChange',
      propertyName: req.body.propertyName,
      propertyValue: req.body.propertyValue
    };

    logger.info('Processing test webhook event', testEvent);

    const webhookService = getWebhookService();
    const results = await webhookService.processWebhookEvents([testEvent]);

    res.json({
      success: true,
      message: 'Test webhook processed',
      testEvent,
      result: results[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Test webhook failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Test webhook processing failed',
      message: error.message
    });
  }
});

// Webhook health check
webhookRoutes.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Webhook service is healthy',
    endpoints: {
      hubspot: '/webhooks/hubspot',
      stats: '/webhooks/stats',
      test: '/webhooks/test',
      health: '/webhooks/health'
    },
    timestamp: new Date().toISOString()
  });
});