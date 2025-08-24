import { Job } from 'bull';
import { logger } from '../utils/logger';
import { prisma } from '../index';
import type { InvoiceMapping, PaymentMapping, InvoicePayment } from '@prisma/client';
import { InvoiceStatus } from '@prisma/client';

// Type definitions for reconciliation results
type DiscrepancyItem = {
  type: 'status_inconsistency' | 'invoice_overallocation' | 'payment_overallocation';
  invoiceId?: string;
  paymentId?: string;
  currentStatus?: InvoiceStatus;
  expectedStatus?: InvoiceStatus;
  totalAmount?: number;
  totalAllocated?: number;
  amount?: number;
  allocated?: number;
  excess?: number;
};

type OverdueInvoiceItem = {
  invoiceId: string;
  dueDate: Date | null;
  status: InvoiceStatus;
  amount: number;
};

type OrphanedPaymentItem = {
  paymentId: string;
  amount: number;
  transactionDate: Date;
  platform: string;
};

type FixItem = {
  type: 'status_fix';
  invoiceId: string;
  oldStatus: InvoiceStatus;
  newStatus: InvoiceStatus;
};

type InvoiceWithPayments = InvoiceMapping & {
  payments: (InvoicePayment & { payment: PaymentMapping })[];
};

type PaymentWithInvoices = PaymentMapping & {
  invoices: (InvoicePayment & { invoice: InvoiceMapping })[];
};

type StatusInconsistencyRow = {
  id: string;
  current_status: InvoiceStatus;
  total_amount: number;
  total_allocated: number;
};

export async function processReconciliationJob(job: Job) {
  const { type, data } = job.data;
  
  logger.info(`Processing reconciliation job: ${type}`, { jobId: job.id });

  try {
    let result;

    switch (type) {
      case 'daily':
        result = await processDailyReconciliation();
        break;
      case 'weekly':
        result = await processWeeklyReconciliation();
        break;
      case 'manual':
        result = await processManualReconciliation(data);
        break;
      default:
        throw new Error(`Unknown reconciliation job type: ${type}`);
    }

    return result;

  } catch (error: any) {
    logger.error(`Reconciliation job failed: ${job.id}`, error);
    throw error;
  }
}

async function processDailyReconciliation() {
  logger.info('Starting daily reconciliation');

  const startTime = Date.now();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all entities that were modified yesterday
  const [modifiedInvoices, modifiedPayments] = await Promise.all([
    prisma.invoiceMapping.findMany({
      where: {
        updatedAt: {
          gte: yesterday,
          lt: today
        }
      },
      include: {
        payments: {
          include: {
            payment: true
          }
        }
      }
    }),
    prisma.paymentMapping.findMany({
      where: {
        updatedAt: {
          gte: yesterday,
          lt: today
        }
      },
      include: {
        invoices: {
          include: {
            invoice: true
          }
        }
      }
    })
  ]);

  // Reconciliation checks
  const results = {
    invoicesChecked: modifiedInvoices.length,
    paymentsChecked: modifiedPayments.length,
    discrepancies: [] as DiscrepancyItem[],
    orphanedPayments: [] as OrphanedPaymentItem[],
    overdueInvoices: [] as OverdueInvoiceItem[],
    inconsistentStatuses: [] as StatusInconsistencyRow[]
  };

  // Check invoice payment consistency
  for (const invoice of modifiedInvoices) {
    const discrepancy = await checkInvoiceConsistency(invoice);
    if (discrepancy) {
      results.discrepancies.push(discrepancy);
    }

    // Check for overdue invoices
    if (invoice.dueDate && new Date(invoice.dueDate) < new Date() && 
        !['PAID', 'CANCELLED'].includes(invoice.status)) {
      results.overdueInvoices.push({
        invoiceId: invoice.id,
        dueDate: invoice.dueDate,
        status: invoice.status,
        amount: Number(invoice.totalAmount)
      });
    }
  }

  // Check for orphaned payments
  for (const payment of modifiedPayments) {
    if (payment.invoices.length === 0 && payment.status === 'COMPLETED') {
      results.orphanedPayments.push({
        paymentId: payment.id,
        amount: Number(payment.amount),
        transactionDate: payment.transactionDate,
        platform: payment.stripePaymentId ? 'STRIPE' : 'QUICKBOOKS'
      });
    }
  }

  // Check for status inconsistencies
  const statusInconsistencies = await findStatusInconsistencies();
  results.inconsistentStatuses = statusInconsistencies;

  const duration = Date.now() - startTime;
  logger.info(`Daily reconciliation completed in ${duration}ms`, results);

  return {
    type: 'daily',
    duration,
    summary: results
  };
}

async function processWeeklyReconciliation() {
  logger.info('Starting weekly reconciliation');

  const startTime = Date.now();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Comprehensive checks
  const [
    totalInvoices,
    totalPayments,
    unmatchedPayments,
    unpaidInvoices,
    failedSyncs
  ] = await Promise.all([
    prisma.invoiceMapping.count(),
    prisma.paymentMapping.count(),
    prisma.paymentMapping.count({
      where: {
        invoices: { none: {} },
        status: 'COMPLETED'
      }
    }),
    prisma.invoiceMapping.count({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
        createdAt: { lt: oneWeekAgo }
      }
    }),
    prisma.syncLog.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: oneWeekAgo }
      }
    })
  ]);

  // Platform synchronization check
  const platformSync = await checkPlatformSynchronization();

  // Amount reconciliation
  const amountReconciliation = await reconcileAmounts();

  const results = {
    summary: {
      totalInvoices,
      totalPayments,
      unmatchedPayments,
      unpaidInvoices,
      failedSyncs
    },
    platformSync,
    amountReconciliation
  };

  const duration = Date.now() - startTime;
  logger.info(`Weekly reconciliation completed in ${duration}ms`, results);

  return {
    type: 'weekly',
    duration,
    summary: results
  };
}

async function processManualReconciliation(data: any) {
  logger.info('Starting manual reconciliation', data);

  const { invoiceIds, paymentIds } = data;
  const results = {
    invoicesProcessed: 0,
    paymentsProcessed: 0,
    discrepancies: [] as DiscrepancyItem[],
    fixes: [] as FixItem[]
  };

  // Process specific invoices if provided
  if (invoiceIds && invoiceIds.length > 0) {
    for (const invoiceId of invoiceIds) {
      const invoice = await prisma.invoiceMapping.findUnique({
        where: { id: invoiceId },
        include: {
          payments: {
            include: { payment: true }
          }
        }
      });

      if (invoice) {
        const discrepancy = await checkInvoiceConsistency(invoice);
        if (discrepancy) {
          results.discrepancies.push(discrepancy);
          
          // Attempt automatic fix
          const fix = await attemptInvoiceFix(invoice);
          if (fix) {
            results.fixes.push(fix);
          }
        }
        results.invoicesProcessed++;
      }
    }
  }

  // Process specific payments if provided
  if (paymentIds && paymentIds.length > 0) {
    for (const paymentId of paymentIds) {
      const payment = await prisma.paymentMapping.findUnique({
        where: { id: paymentId },
        include: {
          invoices: {
            include: { invoice: true }
          }
        }
      });

      if (payment) {
        // Check for allocation issues
        const totalAllocated = payment.invoices.reduce((sum: number, alloc: InvoicePayment) => {
          return sum + Number(alloc.allocatedAmount);
        }, 0);

        if (totalAllocated > Number(payment.amount)) {
          results.discrepancies.push({
            type: 'payment_overallocation',
            paymentId: payment.id,
            amount: Number(payment.amount),
            allocated: totalAllocated,
            excess: totalAllocated - Number(payment.amount)
          });
        }

        results.paymentsProcessed++;
      }
    }
  }

  return {
    type: 'manual',
    summary: results
  };
}

async function checkInvoiceConsistency(invoice: InvoiceWithPayments): Promise<DiscrepancyItem | null> {
  const totalAllocated = invoice.payments.reduce((sum: number, payment: InvoicePayment) => {
    return sum + Number(payment.allocatedAmount);
  }, 0);

  const invoiceAmount = Number(invoice.totalAmount);
  const tolerance = 0.01; // 1 cent tolerance

  // Check for status consistency
  let expectedStatus: InvoiceStatus = InvoiceStatus.SENT;
  if (totalAllocated >= invoiceAmount - tolerance) {
    expectedStatus = InvoiceStatus.PAID;
  } else if (totalAllocated > tolerance) {
    expectedStatus = InvoiceStatus.PARTIALLY_PAID;
  }

  if (invoice.status !== expectedStatus) {
    return {
      type: 'status_inconsistency',
      invoiceId: invoice.id,
      currentStatus: invoice.status,
      expectedStatus,
      totalAmount: invoiceAmount,
      totalAllocated
    };
  }

  // Check for overallocation
  if (totalAllocated > invoiceAmount + tolerance) {
    return {
      type: 'invoice_overallocation',
      invoiceId: invoice.id,
      totalAmount: invoiceAmount,
      totalAllocated,
      excess: totalAllocated - invoiceAmount
    };
  }

  return null;
}

async function findStatusInconsistencies(): Promise<StatusInconsistencyRow[]> {
  // Find invoices with payments but wrong status
  const inconsistentInvoices = await prisma.$queryRaw<StatusInconsistencyRow[]>`
    SELECT 
      im.id,
      im.status as current_status,
      im.total_amount,
      COALESCE(SUM(ip.allocated_amount), 0) as total_allocated
    FROM invoice_mapping im
    LEFT JOIN invoice_payments ip ON im.id = ip.invoice_mapping_id
    GROUP BY im.id, im.status, im.total_amount
    HAVING 
      (im.status = 'SENT' AND COALESCE(SUM(ip.allocated_amount), 0) > 0) OR
      (im.status = 'PARTIALLY_PAID' AND COALESCE(SUM(ip.allocated_amount), 0) = 0) OR
      (im.status = 'PAID' AND COALESCE(SUM(ip.allocated_amount), 0) < im.total_amount)
  `;

  return inconsistentInvoices;
}

async function checkPlatformSynchronization() {
  // Check for invoices missing external IDs
  const [missingQuickBooks, missingStripe] = await Promise.all([
    prisma.invoiceMapping.count({
      where: {
        quickbooksInvoiceId: null,
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24 hours
      }
    }),
    prisma.paymentMapping.count({
      where: {
        stripePaymentId: null,
        quickbooksPaymentId: null
      }
    })
  ]);

  return {
    missingQuickBooksIds: missingQuickBooks,
    orphanedPayments: missingStripe
  };
}

async function reconcileAmounts() {
  // Get total amounts by status
  const invoiceTotals = await prisma.invoiceMapping.groupBy({
    by: ['status'],
    _sum: { totalAmount: true },
    _count: true
  });

  const paymentTotals = await prisma.paymentMapping.groupBy({
    by: ['status'],
    _sum: { amount: true },
    _count: true
  });

  return {
    invoiceTotals,
    paymentTotals
  };
}

async function attemptInvoiceFix(invoice: InvoiceWithPayments): Promise<FixItem | null> {
  const totalAllocated = invoice.payments.reduce((sum: number, payment: InvoicePayment) => {
    return sum + Number(payment.allocatedAmount);
  }, 0);

  const invoiceAmount = Number(invoice.totalAmount);
  let expectedStatus: InvoiceStatus = InvoiceStatus.SENT;

  if (totalAllocated >= invoiceAmount - 0.01) {
    expectedStatus = InvoiceStatus.PAID;
  } else if (totalAllocated > 0.01) {
    expectedStatus = InvoiceStatus.PARTIALLY_PAID;
  }

  if (invoice.status !== expectedStatus) {
    await prisma.invoiceMapping.update({
      where: { id: invoice.id },
      data: { status: expectedStatus }
    });

    logger.info(`Fixed invoice status: ${invoice.id} ${invoice.status} -> ${expectedStatus}`);

    return {
      type: 'status_fix',
      invoiceId: invoice.id,
      oldStatus: invoice.status,
      newStatus: expectedStatus
    };
  }

  return null;
}