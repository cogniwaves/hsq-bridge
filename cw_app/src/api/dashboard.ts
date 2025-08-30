import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { prisma } from '../index';

export const dashboardRoutes = Router();

// Dashboard overview stats
dashboardRoutes.get('/overview', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const [
    totalInvoices,
    totalPayments,
    pendingSyncs,
    recentErrors
  ] = await Promise.all([
    prisma.invoiceMapping.count(),
    prisma.paymentMapping.count(),
    prisma.syncLog.count({ where: { status: { in: ['PENDING', 'RETRYING'] } } }),
    prisma.syncLog.count({ 
      where: { 
        status: 'FAILED',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      } 
    })
  ]);

  const invoiceStats = await prisma.invoiceMapping.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  const paymentStats = await prisma.paymentMapping.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  res.json({
    totals: {
      invoices: totalInvoices,
      payments: totalPayments,
      pendingSyncs,
      recentErrors
    },
    invoicesByStatus: invoiceStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>),
    paymentsByStatus: paymentStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>)
  });
}));

// Recent activity
dashboardRoutes.get('/activity', asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const recentInvoices = await prisma.invoiceMapping.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.floor(Number(limit) / 2),
    select: {
      id: true,
      totalAmount: true,
      status: true,
      clientName: true,
      createdAt: true
    }
  });

  const recentPayments = await prisma.paymentMapping.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.floor(Number(limit) / 2),
    select: {
      id: true,
      amount: true,
      status: true,
      paymentMethod: true,
      createdAt: true
    }
  });

  // Combine and sort by creation date
  const activity = [
    ...recentInvoices.map(inv => ({ ...inv, type: 'invoice' })),
    ...recentPayments.map(pay => ({ ...pay, type: 'payment' }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
   .slice(0, Number(limit));

  res.json({ activity });
}));

// Reconciliation dashboard
dashboardRoutes.get('/reconciliation', asyncHandler(async (req, res) => {
  // Unmatched payments (no invoice allocations)
  const unmatchedPayments = await prisma.paymentMapping.findMany({
    where: {
      invoices: { none: {} }
    },
    include: {
      syncLogs: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  // Unpaid invoices
  const unpaidInvoices = await prisma.invoiceMapping.findMany({
    where: {
      status: { in: ['SENT', 'OVERDUE'] }
    },
    include: {
      payments: true
    }
  });

  // Partially paid invoices
  const partiallyPaidInvoices = await prisma.invoiceMapping.findMany({
    where: {
      status: 'PARTIALLY_PAID'
    },
    include: {
      payments: {
        include: {
          payment: true
        }
      }
    }
  });

  res.json({
    unmatchedPayments: unmatchedPayments.map(payment => ({
      ...payment,
      suggestedMatches: [] // TODO: Implement matching algorithm
    })),
    unpaidInvoices,
    partiallyPaidInvoices: partiallyPaidInvoices.map(invoice => {
      const totalPaid = invoice.payments.reduce((sum, payment) => {
        return sum + Number(payment.allocatedAmount);
      }, 0);
      return {
        ...invoice,
        totalPaid,
        remainingBalance: Number(invoice.totalAmount) - totalPaid
      };
    })
  });
}));

// Dashboard statistics for navigation badges and overview
dashboardRoutes.get('/stats', asyncHandler(async (req, res) => {
  const [
    pendingInvoices,
    recentPayments,
    failedWebhooks,
    pendingTransfers
  ] = await Promise.all([
    prisma.invoiceMapping.count({
      where: { status: { in: ['SENT', 'OVERDUE'] } }
    }),
    prisma.paymentMapping.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    }),
    prisma.webhookEvent.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    }),
    prisma.quickbooksTransferQueue.count({
      where: { status: 'PENDING' }
    })
  ]);

  res.json({
    pendingInvoices,
    recentPayments,
    failedWebhooks,
    pendingTransfers
  });
}));

// System health metrics for dashboard
dashboardRoutes.get('/health', asyncHandler(async (req, res) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    recentSyncs,
    recentErrors,
    webhookEvents,
    dbStats
  ] = await Promise.all([
    prisma.syncLog.count({
      where: { createdAt: { gte: oneHourAgo } }
    }),
    prisma.syncLog.count({
      where: { 
        status: 'FAILED',
        createdAt: { gte: oneDayAgo }
      }
    }),
    prisma.webhookEvent.count({
      where: { createdAt: { gte: oneHourAgo } }
    }),
    // Get database statistics
    (async () => {
      const { getDatabaseStats } = await import('../database/migrations');
      return getDatabaseStats();
    })()
  ]);

  // Get queue statistics
  const { getQueueStats } = await import('../workers');
  const queueStats = await getQueueStats();

  res.json({
    database: { 
      status: 'healthy', 
      lastCheck: now,
      stats: dbStats
    },
    syncActivity: {
      lastHour: recentSyncs,
      errorsLast24h: recentErrors,
      queues: queueStats
    },
    webhooks: {
      receivedLastHour: webhookEvents
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    },
    version: process.env.npm_package_version || '1.0.0'
  });
}));