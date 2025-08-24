import { Router } from 'express';
import Stripe from 'stripe';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { prisma } from '../index';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export const stripeWebhooks = Router();

stripeWebhooks.post('/', asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  // Log webhook event
  await prisma.webhookEvent.create({
    data: {
      platform: 'STRIPE',
      eventType: event.type,
      eventId: event.id,
      payload: event as any
    }
  });

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Handle subscription events if needed
        logger.info(`Subscription event ${event.type} - implementing soon`);
        break;
      
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    // Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: { 
        platform: 'STRIPE',
        eventId: event.id 
      },
      data: { 
        processed: true,
        processedAt: new Date()
      }
    });

    res.json({ received: true });
  } catch (error: any) {
    logger.error('Error processing Stripe webhook:', error);
    
    // Mark webhook as failed
    await prisma.webhookEvent.updateMany({
      where: { 
        platform: 'STRIPE',
        eventId: event.id 
      },
      data: { 
        processed: false,
        errorMessage: error.message
      }
    });

    res.status(500).json({ error: 'Webhook processing failed' });
  }
}));

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  logger.info(`Processing successful payment intent: ${paymentIntent.id}`);

  // Create or update payment mapping
  const payment = await prisma.paymentMapping.upsert({
    where: { stripePaymentId: paymentIntent.id },
    update: {
      amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency.toUpperCase(),
      status: 'COMPLETED',
      transactionDate: new Date(paymentIntent.created * 1000),
      metadata: paymentIntent.metadata as any,
      lastSyncAt: new Date()
    },
    create: {
      stripePaymentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      paymentMethod: getPaymentMethod(paymentIntent),
      status: 'COMPLETED',
      transactionDate: new Date(paymentIntent.created * 1000),
      description: paymentIntent.description || undefined,
      metadata: paymentIntent.metadata as any
    }
  });

  // TODO: Implement automatic matching logic
  logger.info(`Payment mapping created/updated: ${payment.id}`);

  // Create sync log
  await prisma.syncLog.create({
    data: {
      entityType: 'PAYMENT',
      entityId: payment.id,
      operation: 'CREATE',
      platform: 'STRIPE',
      status: 'COMPLETED',
      requestData: { paymentIntentId: paymentIntent.id },
      responseData: { paymentMappingId: payment.id }
    }
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  logger.info(`Processing successful invoice payment: ${invoice.id}`);

  // Find corresponding invoice mapping
  const invoiceMapping = await prisma.invoiceMapping.findUnique({
    where: { stripeInvoiceId: invoice.id }
  });

  if (invoiceMapping) {
    // Update invoice status
    await prisma.invoiceMapping.update({
      where: { id: invoiceMapping.id },
      data: { 
        status: 'PAID',
        lastSyncAt: new Date()
      }
    });

    logger.info(`Invoice mapping updated to PAID: ${invoiceMapping.id}`);
  } else {
    logger.warn(`No invoice mapping found for Stripe invoice: ${invoice.id}`);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  logger.info(`Processing failed payment intent: ${paymentIntent.id}`);

  // Update payment mapping status if it exists
  await prisma.paymentMapping.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { 
      status: 'FAILED',
      lastSyncAt: new Date()
    }
  });
}

function getPaymentMethod(paymentIntent: Stripe.PaymentIntent): string {
  // Determine payment method based on payment intent
  if (paymentIntent.payment_method_types.includes('card')) {
    return 'STRIPE_CARD';
  } else if (paymentIntent.payment_method_types.includes('us_bank_account')) {
    return 'STRIPE_BANK_TRANSFER';
  }
  return 'OTHER';
}