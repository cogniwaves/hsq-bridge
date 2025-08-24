import { Job } from 'bull';
import { logger } from '../utils/logger';
import { prisma } from '../index';
import type { PaymentMapping, InvoiceMapping, InvoicePayment } from '@prisma/client';
import { InvoiceStatus } from '@prisma/client';

// Type definitions for matching processor
type PaymentWithInvoices = PaymentMapping & {
  invoices: (InvoicePayment & { invoice: InvoiceMapping })[];
};

type InvoiceWithPayments = InvoiceMapping & {
  payments: (InvoicePayment & { payment: PaymentMapping })[];
};

export async function processMatchingJob(job: Job) {
  const { type, paymentId, invoiceId, data } = job.data;
  
  logger.info(`Processing matching job: ${type}`, { jobId: job.id, paymentId, invoiceId });

  try {
    let result;

    switch (type) {
      case 'auto-match':
        result = await processAutoMatching(paymentId, data);
        break;
      case 'validate-match':
        result = await processMatchValidation(paymentId, invoiceId, data);
        break;
      default:
        throw new Error(`Unknown matching job type: ${type}`);
    }

    return result;

  } catch (error: any) {
    logger.error(`Matching job failed: ${job.id}`, error);
    throw error;
  }
}

async function processAutoMatching(paymentId: string, _data: any) {
  logger.info(`Auto-matching payment: ${paymentId}`);

  const payment = await prisma.paymentMapping.findUnique({
    where: { id: paymentId },
    include: {
      invoices: true
    }
  });

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }

  // Skip if payment is already fully allocated
  const totalAllocated = payment.invoices.reduce((sum: number, alloc: InvoicePayment) => {
    return sum + Number(alloc.allocatedAmount);
  }, 0);

  if (totalAllocated >= Number(payment.amount)) {
    logger.info(`Payment ${paymentId} is already fully allocated`);
    return { status: 'already_allocated', paymentId };
  }

  const remainingAmount = Number(payment.amount) - totalAllocated;

  // Find potential invoice matches
  const matches = await findInvoiceMatches(payment, remainingAmount);

  if (matches.length === 0) {
    logger.info(`No matches found for payment ${paymentId}`);
    return { status: 'no_matches', paymentId, remainingAmount };
  }

  // Process matches based on confidence score
  const results = [];
  let allocatedInThisRun = 0;

  for (const match of matches) {
    if (allocatedInThisRun >= remainingAmount) {
      break;
    }

    const allocationAmount = Math.min(
      match.amount,
      remainingAmount - allocatedInThisRun
    );

    if (match.confidence >= 0.9) {
      // High confidence - auto allocate
      await createAllocation(paymentId, match.invoiceId, allocationAmount, 'auto');
      allocatedInThisRun += allocationAmount;
      
      results.push({
        invoiceId: match.invoiceId,
        amount: allocationAmount,
        confidence: match.confidence,
        action: 'auto_allocated'
      });

      logger.info(`Auto-allocated ${allocationAmount} to invoice ${match.invoiceId} (confidence: ${match.confidence})`);

    } else if (match.confidence >= 0.7) {
      // Medium confidence - flag for manual review
      results.push({
        invoiceId: match.invoiceId,
        amount: allocationAmount,
        confidence: match.confidence,
        action: 'needs_review'
      });

      logger.info(`Flagged potential match for manual review: ${match.invoiceId} (confidence: ${match.confidence})`);
    }
  }

  return {
    status: 'processed',
    paymentId,
    remainingAmount: remainingAmount - allocatedInThisRun,
    matches: results
  };
}

async function processMatchValidation(paymentId: string, invoiceId: string, _data: any) {
  logger.info(`Validating match between payment ${paymentId} and invoice ${invoiceId}`);

  const [payment, invoice] = await Promise.all([
    prisma.paymentMapping.findUnique({
      where: { id: paymentId },
      include: { invoices: true }
    }),
    prisma.invoiceMapping.findUnique({
      where: { id: invoiceId },
      include: { payments: true }
    })
  ]);

  if (!payment || !invoice) {
    throw new Error('Payment or invoice not found for validation');
  }

  // Calculate available amounts
  const paymentAllocated = payment.invoices.reduce((sum: number, alloc: InvoicePayment) => {
    return sum + Number(alloc.allocatedAmount);
  }, 0);
  const paymentAvailable = Number(payment.amount) - paymentAllocated;

  const invoiceAllocated = invoice.payments.reduce((sum: number, alloc: InvoicePayment) => {
    return sum + Number(alloc.allocatedAmount);
  }, 0);
  const invoiceRemaining = Number(invoice.totalAmount) - invoiceAllocated;

  // Validation rules
  const validationResults = {
    amountValid: paymentAvailable > 0 && invoiceRemaining > 0,
    customerMatch: validateCustomerMatch(payment, invoice),
    dateRange: validateDateRange(payment, invoice),
    duplicateCheck: await checkForDuplicateAllocation(paymentId, invoiceId)
  };

  const isValid = Object.values(validationResults).every(result => result === true);

  return {
    status: isValid ? 'valid' : 'invalid',
    paymentId,
    invoiceId,
    validationResults,
    availableAmounts: {
      payment: paymentAvailable,
      invoice: invoiceRemaining
    }
  };
}

async function findInvoiceMatches(payment: PaymentMapping, amount: number) {
  // Base query for unpaid/partially paid invoices
  const baseWhere = {
    status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }
  };

  // Tolerance for amount matching (3% for Stripe fees)
  const tolerance = 0.03;
  const minAmount = amount * (1 - tolerance);
  const maxAmount = amount * (1 + tolerance);

  // Find exact amount matches first
  const exactMatches = await prisma.invoiceMapping.findMany({
    where: {
      ...baseWhere,
      totalAmount: { gte: minAmount, lte: maxAmount }
    },
    include: { payments: true }
  });

  // Calculate confidence scores
  const matches = [];

  for (const invoice of exactMatches) {
    const confidence = calculateMatchConfidence(payment, invoice, amount);
    
    if (confidence > 0.5) {
      matches.push({
        invoiceId: invoice.id,
        amount: Math.min(amount, Number(invoice.totalAmount)),
        confidence,
        invoice
      });
    }
  }

  // Sort by confidence score (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches.slice(0, 10); // Return top 10 matches
}

function calculateMatchConfidence(payment: PaymentMapping, invoice: InvoiceMapping, amount: number): number {
  let confidence = 0;

  // Amount match (40% weight)
  const amountDiff = Math.abs(Number(invoice.totalAmount) - amount) / amount;
  const amountScore = Math.max(0, 1 - amountDiff * 5); // Penalize heavily for amount differences
  confidence += amountScore * 0.4;

  // Customer/email match (30% weight)
  const paymentMetadata = payment.metadata as any;
  if (paymentMetadata?.customer_email && invoice.clientEmail) {
    const customerMatch = paymentMetadata.customer_email.toLowerCase() === 
                         invoice.clientEmail.toLowerCase();
    confidence += customerMatch ? 0.3 : 0;
  }

  // Date proximity (20% weight)
  if (invoice.issueDate) {
    const daysDiff = Math.abs(
      (new Date(payment.transactionDate).getTime() - new Date(invoice.issueDate).getTime()) 
      / (1000 * 60 * 60 * 24)
    );
    const dateScore = Math.max(0, 1 - daysDiff / 30); // 30-day window
    confidence += dateScore * 0.2;
  }

  // Metadata match (10% weight)
  if (paymentMetadata?.invoice_id && invoice.hubspotInvoiceId) {
    const metadataMatch = paymentMetadata.invoice_id === invoice.hubspotInvoiceId;
    confidence += metadataMatch ? 0.1 : 0;
  }

  return Math.min(1, confidence); // Cap at 1.0
}

function validateCustomerMatch(payment: PaymentMapping, invoice: InvoiceMapping): boolean {
  const paymentMetadata = payment.metadata as any;
  if (!paymentMetadata?.customer_email || !invoice.clientEmail) {
    return true; // Cannot validate, assume valid
  }

  return paymentMetadata.customer_email.toLowerCase() === 
         invoice.clientEmail.toLowerCase();
}

function validateDateRange(payment: PaymentMapping, invoice: InvoiceMapping): boolean {
  if (!invoice.issueDate) {
    return true; // Cannot validate, assume valid
  }

  const paymentDate = new Date(payment.transactionDate);
  const invoiceDate = new Date(invoice.issueDate);
  const daysDiff = Math.abs((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

  return daysDiff <= 90; // 90-day window
}

async function checkForDuplicateAllocation(paymentId: string, invoiceId: string): Promise<boolean> {
  const existing = await prisma.invoicePayment.findUnique({
    where: {
      invoiceMappingId_paymentMappingId: {
        invoiceMappingId: invoiceId,
        paymentMappingId: paymentId
      }
    }
  });

  return existing === null; // True if no duplicate found
}

async function createAllocation(paymentId: string, invoiceId: string, amount: number, _source: string) {
  const allocation = await prisma.invoicePayment.create({
    data: {
      paymentMappingId: paymentId,
      invoiceMappingId: invoiceId,
      allocatedAmount: amount,
      status: 'ALLOCATED'
    }
  });

  // Update invoice status if fully paid
  const invoice = await prisma.invoiceMapping.findUnique({
    where: { id: invoiceId },
    include: { payments: true }
  });

  if (invoice) {
    const totalPaid = invoice.payments.reduce((sum: number, payment: InvoicePayment) => {
      return sum + Number(payment.allocatedAmount);
    }, 0);

    let newStatus: InvoiceStatus = invoice.status;
    if (totalPaid >= Number(invoice.totalAmount)) {
      newStatus = InvoiceStatus.PAID;
    } else if (totalPaid > 0) {
      newStatus = InvoiceStatus.PARTIALLY_PAID;
    }

    if (newStatus !== invoice.status) {
      await prisma.invoiceMapping.update({
        where: { id: invoiceId },
        data: { status: newStatus }
      });
    }
  }

  return allocation;
}