import { Router } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { metricsCollector } from '../utils/monitoring';
import { prisma } from '../index';

export const metricsRoutes = Router();

// Get application metrics
metricsRoutes.get('/', asyncHandler(async (req, res) => {
  const metrics = metricsCollector.getMetrics();
  
  res.json({
    application: metrics,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}));

// Get request metrics
metricsRoutes.get('/requests', asyncHandler(async (req, res) => {
  const metrics = metricsCollector.getMetrics();
  
  res.json({
    total: metrics.totalRequests,
    byMethod: metrics.requestsByMethod,
    byEndpoint: metrics.requestsByEndpoint,
    byStatus: metrics.requestsByStatus,
    averageResponseTime: Math.round(metrics.averageResponseTime),
    errorRate: Math.round(metrics.errorRate * 100) / 100,
    topEndpoints: metricsCollector.getTopEndpoints(10),
    lastReset: metrics.lastReset
  });
}));

// Get business metrics
metricsRoutes.get('/business', asyncHandler(async (req, res) => {
  const { timeframe = '24h' } = req.query;
  
  // Calculate date range
  const now = new Date();
  let since: Date;
  
  switch (timeframe) {
    case '1h':
      since = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const [
    invoiceStats,
    paymentStats,
    syncStats,
    webhookStats,
    allocationStats
  ] = await Promise.all([
    // Invoice statistics
    prisma.invoiceMapping.groupBy({
      by: ['status'],
      _count: { status: true },
      _sum: { totalAmount: true },
      where: { createdAt: { gte: since } }
    }),
    
    // Payment statistics
    prisma.paymentMapping.groupBy({
      by: ['status', 'paymentMethod'],
      _count: { status: true },
      _sum: { amount: true },
      where: { createdAt: { gte: since } }
    }),
    
    // Sync operation statistics
    prisma.syncLog.groupBy({
      by: ['platform', 'status'],
      _count: { status: true },
      where: { createdAt: { gte: since } }
    }),
    
    // Webhook statistics
    prisma.webhookEvent.groupBy({
      by: ['platform', 'processed'],
      _count: { processed: true },
      where: { createdAt: { gte: since } }
    }),
    
    // Payment allocation statistics
    prisma.invoicePayment.count({
      where: { createdAt: { gte: since } }
    })
  ]);

  // Process invoice stats
  const invoiceSummary = {
    total: invoiceStats.reduce((sum, stat) => sum + stat._count.status, 0),
    totalAmount: invoiceStats.reduce((sum, stat) => sum + Number(stat._sum.totalAmount || 0), 0),
    byStatus: invoiceStats.reduce((acc, stat) => {
      acc[stat.status] = {
        count: stat._count.status,
        amount: Number(stat._sum.totalAmount || 0)
      };
      return acc;
    }, {} as Record<string, { count: number; amount: number }>)
  };

  // Process payment stats
  const paymentSummary = {
    total: paymentStats.reduce((sum, stat) => sum + stat._count.status, 0),
    totalAmount: paymentStats.reduce((sum, stat) => sum + Number(stat._sum.amount || 0), 0),
    byStatus: paymentStats.reduce((acc, stat) => {
      if (!acc[stat.status]) acc[stat.status] = { count: 0, amount: 0 };
      acc[stat.status].count += stat._count.status;
      acc[stat.status].amount += Number(stat._sum.amount || 0);
      return acc;
    }, {} as Record<string, { count: number; amount: number }>),
    byMethod: paymentStats.reduce((acc, stat) => {
      if (!acc[stat.paymentMethod]) acc[stat.paymentMethod] = { count: 0, amount: 0 };
      acc[stat.paymentMethod].count += stat._count.status;
      acc[stat.paymentMethod].amount += Number(stat._sum.amount || 0);
      return acc;
    }, {} as Record<string, { count: number; amount: number }>)
  };

  // Process sync stats
  const syncSummary = {
    total: syncStats.reduce((sum, stat) => sum + stat._count.status, 0),
    byPlatform: syncStats.reduce((acc, stat) => {
      if (!acc[stat.platform]) acc[stat.platform] = {};
      acc[stat.platform][stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, Record<string, number>>)
  };

  // Process webhook stats
  const webhookSummary = {
    total: webhookStats.reduce((sum, stat) => sum + stat._count.processed, 0),
    processed: webhookStats.filter(stat => stat.processed).reduce((sum, stat) => sum + stat._count.processed, 0),
    pending: webhookStats.filter(stat => !stat.processed).reduce((sum, stat) => sum + stat._count.processed, 0),
    byPlatform: webhookStats.reduce((acc, stat) => {
      if (!acc[stat.platform]) acc[stat.platform] = { total: 0, processed: 0, pending: 0 };
      acc[stat.platform].total += stat._count.processed;
      if (stat.processed) {
        acc[stat.platform].processed += stat._count.processed;
      } else {
        acc[stat.platform].pending += stat._count.processed;
      }
      return acc;
    }, {} as Record<string, { total: number; processed: number; pending: number }>)
  };

  res.json({
    timeframe,
    since: since.toISOString(),
    invoices: invoiceSummary,
    payments: paymentSummary,
    sync: syncSummary,
    webhooks: webhookSummary,
    allocations: allocationStats,
    generatedAt: new Date().toISOString()
  });
}));

// Get performance metrics
metricsRoutes.get('/performance', asyncHandler(async (req, res) => {
  const metrics = metricsCollector.getMetrics();
  const memoryUsage = process.memoryUsage();
  
  // Get slow queries from recent sync logs
  const slowOperations = await prisma.syncLog.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      status: 'COMPLETED'
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      platform: true,
      operation: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Calculate operation durations
  const operationMetrics = slowOperations.map(op => ({
    platform: op.platform,
    operation: op.operation,
    duration: op.updatedAt.getTime() - op.createdAt.getTime()
  })).filter(op => op.duration > 0);

  const avgDurations = operationMetrics.reduce((acc, op) => {
    const key = `${op.platform}:${op.operation}`;
    if (!acc[key]) acc[key] = { total: 0, count: 0, platform: op.platform, operation: op.operation };
    acc[key].total += op.duration;
    acc[key].count++;
    return acc;
  }, {} as Record<string, { total: number; count: number; platform: string; operation: string }>);

  const performanceSummary = Object.entries(avgDurations).map(([key, data]) => ({
    key,
    platform: data.platform,
    operation: data.operation,
    averageDuration: Math.round(data.total / data.count),
    count: data.count
  })).sort((a, b) => b.averageDuration - a.averageDuration);

  res.json({
    http: {
      averageResponseTime: Math.round(metrics.averageResponseTime),
      requestsPerSecond: metrics.totalRequests / ((Date.now() - metrics.lastReset.getTime()) / 1000),
      errorRate: Math.round(metrics.errorRate * 100) / 100,
      p95ResponseTime: metrics.responseTimeP95[0] || 0
    },
    system: {
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        usagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform
    },
    operations: {
      summary: performanceSummary.slice(0, 10),
      slowestOperations: performanceSummary.filter(op => op.averageDuration > 5000).slice(0, 5)
    }
  });
}));

// Reset metrics
metricsRoutes.post('/reset', asyncHandler(async (req, res) => {
  metricsCollector.reset();
  
  res.json({
    message: 'Metrics reset successfully',
    resetAt: new Date().toISOString()
  });
}));

// Export metrics in Prometheus format
metricsRoutes.get('/prometheus', asyncHandler(async (req, res) => {
  const metrics = metricsCollector.getMetrics();
  const memoryUsage = process.memoryUsage();
  
  const prometheusMetrics = [
    `# HELP http_requests_total Total number of HTTP requests`,
    `# TYPE http_requests_total counter`,
    `http_requests_total ${metrics.totalRequests}`,
    ``,
    `# HELP http_request_duration_seconds HTTP request duration in seconds`,
    `# TYPE http_request_duration_seconds gauge`,
    `http_request_duration_seconds ${metrics.averageResponseTime / 1000}`,
    ``,
    `# HELP http_error_rate HTTP error rate percentage`,
    `# TYPE http_error_rate gauge`,
    `http_error_rate ${metrics.errorRate}`,
    ``,
    `# HELP nodejs_heap_used_bytes Node.js heap memory used`,
    `# TYPE nodejs_heap_used_bytes gauge`,
    `nodejs_heap_used_bytes ${memoryUsage.heapUsed}`,
    ``,
    `# HELP nodejs_heap_total_bytes Node.js heap memory total`,
    `# TYPE nodejs_heap_total_bytes gauge`,
    `nodejs_heap_total_bytes ${memoryUsage.heapTotal}`,
    ``,
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${Math.round(process.uptime())}`,
    ``
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
}));