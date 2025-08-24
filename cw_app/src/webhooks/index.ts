import { Router } from 'express';
import { stripeWebhooks } from './stripe';
import { hubspotWebhooks } from './hubspot';
import { quickbooksWebhooks } from './quickbooks';

export const webhookRoutes = Router();

// Platform-specific webhook routes
webhookRoutes.use('/stripe', stripeWebhooks);
webhookRoutes.use('/hubspot', hubspotWebhooks);
webhookRoutes.use('/quickbooks', quickbooksWebhooks);

// Webhook health check
webhookRoutes.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: {
      stripe: '/webhooks/stripe',
      hubspot: '/webhooks/hubspot',
      quickbooks: '/webhooks/quickbooks'
    }
  });
});