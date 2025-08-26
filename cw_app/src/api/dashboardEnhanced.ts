import { Router, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { 
  TenantAwareRequest, 
  getTenantAwareQueryOptions, 
  logTenantOperation,
  TenantQueryFilter
} from '../middleware/tenantAware';

/**
 * Enhanced Dashboard Routes with Multi-Tenant Support
 * This demonstrates how existing routes can be enhanced with tenant awareness
 * while maintaining backward compatibility for API key users
 */
export const dashboardEnhancedRoutes = Router();

// Dashboard overview stats with tenant awareness
dashboardEnhancedRoutes.get('/overview', 
  logTenantOperation('dashboard_overview'),
  asyncHandler(async (req: TenantAwareRequest, res: Response) => {
    try {
      const tenantId = req.tenantContext?.tenantId;
      const enforceIsolation = req.tenantContext?.enforceIsolation || false;

      logger.info('Dashboard overview requested', {
        userId: req.auth?.userId || req.user?.id,
        tenantId,
        enforceIsolation,
        authSource: req.tenantContext?.source,
      });

      // Base filters for tenant isolation
      const baseFilter = enforceIsolation && tenantId ? { tenantId } : {};

      const [
        totalInvoices,
        totalPayments,
        pendingSyncs,
        recentErrors,
        invoiceStats,
        paymentStats,
        recentActivity
      ] = await Promise.all([
        // Total invoices (tenant-aware)
        prisma.invoiceMapping.count({
          where: baseFilter,
        }),
        
        // Total payments (tenant-aware)
        prisma.paymentMapping.count({
          where: baseFilter,
        }),
        
        // Pending syncs (tenant-aware)
        prisma.syncLog.count({ 
          where: {
            ...baseFilter,
            status: { in: ['PENDING', 'RETRYING'] }
          }
        }),
        
        // Recent errors (tenant-aware)
        prisma.syncLog.count({ 
          where: { 
            ...baseFilter,
            status: 'FAILED',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          } 
        }),

        // Invoice stats by status (tenant-aware)
        prisma.invoiceMapping.groupBy({
          by: ['status'],
          where: baseFilter,
          _count: { status: true }
        }),

        // Payment stats by status (tenant-aware)
        prisma.paymentMapping.groupBy({
          by: ['status'],
          where: baseFilter,
          _count: { status: true }
        }),

        // Recent activity (tenant-aware)
        prisma.syncLog.findMany({
          where: baseFilter,
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            entityType: true,
            entityId: true,
            operation: true,
            status: true,
            createdAt: true,
            error: true,
          }
        })
      ]);

      // Calculate revenue stats (tenant-aware)
      const revenueStats = await prisma.invoiceMapping.aggregate({
        where: {
          ...baseFilter,
          status: { in: ['PAID', 'PARTIALLY_PAID'] }
        },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
        _count: { id: true }
      });

      const responseData = {
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
        }, {} as Record<string, number>),
        revenue: {
          total: revenueStats._sum.totalAmount || 0,
          average: revenueStats._avg.totalAmount || 0,
          paidInvoices: revenueStats._count
        },
        recentActivity,
        // Include tenant context for JWT users
        ...(req.tenantContext?.source === 'jwt' && {
          tenantContext: {
            tenantId,
            tenantSlug: req.tenantContext?.tenantSlug,
            enforceIsolation,
          }
        })
      };

      res.json(createSuccessResponse(responseData, 'Dashboard overview retrieved successfully'));

    } catch (error) {
      logger.error('Dashboard overview failed', {
        error: error.message,
        userId: req.auth?.userId || req.user?.id,
        tenantId: req.tenantContext?.tenantId,
      });

      res.status(500).json(createErrorResponse(
        'Dashboard overview failed',
        'Unable to retrieve dashboard data'
      ));
    }
  })
);

// Recent invoices with tenant awareness
dashboardEnhancedRoutes.get('/invoices/recent',
  logTenantOperation('recent_invoices'),
  asyncHandler(async (req: TenantAwareRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const tenantId = req.tenantContext?.tenantId;
      const enforceIsolation = req.tenantContext?.enforceIsolation || false;

      // Build tenant-aware query
      const queryOptions = getTenantAwareQueryOptions(req, {
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          lineItems: {
            take: 3, // Preview of line items
          }
        }
      });

      // If enforcing tenant isolation, add specific tenant filter
      if (enforceIsolation && tenantId) {
        queryOptions.where = TenantQueryFilter.addTenantFilterToInvoices(queryOptions.where || {}, tenantId);
      }

      const recentInvoices = await prisma.invoiceMapping.findMany(queryOptions);

      // Transform data for response
      const transformedInvoices = recentInvoices.map(invoice => ({
        id: invoice.id,
        hubspotInvoiceId: invoice.hubspotInvoiceId,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        status: invoice.status,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        dueDate: invoice.dueDate,
        issueDate: invoice.issueDate,
        createdAt: invoice.createdAt,
        lineItemsCount: invoice.lineItems?.length || 0,
        // Only include tenant info for JWT users
        ...(req.tenantContext?.source === 'jwt' && { tenantId: invoice.tenantId })
      }));

      res.json(createSuccessResponse({
        invoices: transformedInvoices,
        total: recentInvoices.length,
        limit,
        // Include filtering context for JWT users
        ...(req.tenantContext?.source === 'jwt' && {
          filtering: {
            tenantId,
            enforceIsolation,
          }
        })
      }, 'Recent invoices retrieved successfully'));

    } catch (error) {
      logger.error('Recent invoices retrieval failed', {
        error: error.message,
        userId: req.auth?.userId || req.user?.id,
        tenantId: req.tenantContext?.tenantId,
      });

      res.status(500).json(createErrorResponse(
        'Recent invoices retrieval failed',
        'Unable to retrieve recent invoices'
      ));
    }
  })
);

// Sync status with tenant awareness
dashboardEnhancedRoutes.get('/sync-status',
  logTenantOperation('sync_status'),
  asyncHandler(async (req: TenantAwareRequest, res: Response) => {
    try {
      const tenantId = req.tenantContext?.tenantId;
      const enforceIsolation = req.tenantContext?.enforceIsolation || false;
      
      const baseFilter = enforceIsolation && tenantId ? { tenantId } : {};

      // Get sync status across different entities
      const [
        invoiceSyncs,
        paymentSyncs,
        contactSyncs,
        companySyncs
      ] = await Promise.all([
        prisma.syncLog.groupBy({
          by: ['status'],
          where: {
            ...baseFilter,
            entityType: 'INVOICE'
          },
          _count: { status: true }
        }),
        prisma.syncLog.groupBy({
          by: ['status'],
          where: {
            ...baseFilter,
            entityType: 'PAYMENT'
          },
          _count: { status: true }
        }),
        prisma.syncLog.groupBy({
          by: ['status'],
          where: {
            ...baseFilter,
            entityType: 'CONTACT'
          },
          _count: { status: true }
        }),
        prisma.syncLog.groupBy({
          by: ['status'],
          where: {
            ...baseFilter,
            entityType: 'COMPANY'
          },
          _count: { status: true }
        })
      ]);

      // Recent sync failures for troubleshooting
      const recentFailures = await prisma.syncLog.findMany({
        where: {
          ...baseFilter,
          status: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          operation: true,
          error: true,
          createdAt: true
        }
      });

      const syncStatusData = {
        byEntity: {
          invoices: invoiceSyncs.reduce((acc, sync) => {
            acc[sync.status] = sync._count.status;
            return acc;
          }, {} as Record<string, number>),
          payments: paymentSyncs.reduce((acc, sync) => {
            acc[sync.status] = sync._count.status;
            return acc;
          }, {} as Record<string, number>),
          contacts: contactSyncs.reduce((acc, sync) => {
            acc[sync.status] = sync._count.status;
            return acc;
          }, {} as Record<string, number>),
          companies: companySyncs.reduce((acc, sync) => {
            acc[sync.status] = sync._count.status;
            return acc;
          }, {} as Record<string, number>)
        },
        recentFailures,
        // Include tenant context for JWT users
        ...(req.tenantContext?.source === 'jwt' && {
          tenantContext: {
            tenantId,
            enforceIsolation,
          }
        })
      };

      res.json(createSuccessResponse(syncStatusData, 'Sync status retrieved successfully'));

    } catch (error) {
      logger.error('Sync status retrieval failed', {
        error: error.message,
        userId: req.auth?.userId || req.user?.id,
        tenantId: req.tenantContext?.tenantId,
      });

      res.status(500).json(createErrorResponse(
        'Sync status retrieval failed',
        'Unable to retrieve sync status'
      ));
    }
  })
);

// Analytics endpoint with tenant awareness
dashboardEnhancedRoutes.get('/analytics/:period',
  logTenantOperation('dashboard_analytics'),
  asyncHandler(async (req: TenantAwareRequest, res: Response) => {
    try {
      const period = req.params.period as 'week' | 'month' | 'quarter' | 'year';
      const validPeriods = ['week', 'month', 'quarter', 'year'];
      
      if (!validPeriods.includes(period)) {
        res.status(400).json(createErrorResponse(
          'Invalid period',
          'Period must be one of: week, month, quarter, year'
        ));
        return;
      }

      const tenantId = req.tenantContext?.tenantId;
      const enforceIsolation = req.tenantContext?.enforceIsolation || false;

      // Calculate period start date
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      const baseFilter = {
        createdAt: { gte: startDate },
        ...(enforceIsolation && tenantId && { tenantId })
      };

      // Analytics queries
      const [
        invoiceMetrics,
        revenueByDay,
        statusDistribution
      ] = await Promise.all([
        // Invoice metrics
        prisma.invoiceMapping.aggregate({
          where: baseFilter,
          _count: { id: true },
          _sum: { totalAmount: true },
          _avg: { totalAmount: true }
        }),

        // Revenue by day (simplified)
        prisma.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            SUM(total_amount) as revenue,
            COUNT(*) as invoices
          FROM invoice_mapping
          WHERE created_at >= ${startDate}
            ${enforceIsolation && tenantId ? prisma.$queryRaw`AND tenant_id = ${tenantId}` : prisma.$queryRaw``}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `,

        // Status distribution
        prisma.invoiceMapping.groupBy({
          by: ['status'],
          where: baseFilter,
          _count: { status: true },
          _sum: { totalAmount: true }
        })
      ]);

      const analyticsData = {
        period,
        startDate,
        endDate: now,
        metrics: {
          totalInvoices: invoiceMetrics._count.id,
          totalRevenue: invoiceMetrics._sum.totalAmount || 0,
          averageInvoiceValue: invoiceMetrics._avg.totalAmount || 0
        },
        revenueByDay: revenueByDay as any[],
        statusDistribution: statusDistribution.map(item => ({
          status: item.status,
          count: item._count.status,
          totalAmount: item._sum.totalAmount || 0
        })),
        // Include tenant context for JWT users
        ...(req.tenantContext?.source === 'jwt' && {
          tenantContext: {
            tenantId,
            enforceIsolation,
          }
        })
      };

      res.json(createSuccessResponse(analyticsData, `${period} analytics retrieved successfully`));

    } catch (error) {
      logger.error('Analytics retrieval failed', {
        error: error.message,
        period: req.params.period,
        userId: req.auth?.userId || req.user?.id,
        tenantId: req.tenantContext?.tenantId,
      });

      res.status(500).json(createErrorResponse(
        'Analytics retrieval failed',
        'Unable to retrieve analytics data'
      ));
    }
  })
);