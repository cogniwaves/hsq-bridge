import { Router } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { prisma } from '../index';

export const syncRoutes = Router();

// Get sync status
syncRoutes.get('/status', asyncHandler(async (req, res) => {
  const recentLogs = await prisma.syncLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  const stats = {
    total: recentLogs.length,
    pending: recentLogs.filter(log => log.status === 'PENDING').length,
    inProgress: recentLogs.filter(log => log.status === 'IN_PROGRESS').length,
    completed: recentLogs.filter(log => log.status === 'COMPLETED').length,
    failed: recentLogs.filter(log => log.status === 'FAILED').length,
    retrying: recentLogs.filter(log => log.status === 'RETRYING').length,
  };

  const platformStats = {
    HUBSPOT: recentLogs.filter(log => log.platform === 'HUBSPOT').length,
    STRIPE: recentLogs.filter(log => log.platform === 'STRIPE').length,
    QUICKBOOKS: recentLogs.filter(log => log.platform === 'QUICKBOOKS').length,
  };

  // Determine sync status for each platform
  const hubspotLogs = recentLogs.filter(log => log.platform === 'HUBSPOT').slice(0, 10);
  const stripeLogs = recentLogs.filter(log => log.platform === 'STRIPE').slice(0, 10);
  const quickbooksLogs = recentLogs.filter(log => log.platform === 'QUICKBOOKS').slice(0, 10);

  const getStatus = (logs: any[]) => {
    if (logs.length === 0) return 'idle';
    const recent = logs[0];
    if (recent.status === 'IN_PROGRESS' || recent.status === 'PENDING') return 'active';
    if (recent.status === 'FAILED' || recent.status === 'RETRYING') return 'error';
    return 'idle';
  };

  res.json({
    hubspot: {
      status: getStatus(hubspotLogs),
      lastSync: hubspotLogs[0]?.createdAt || null,
      count: platformStats.HUBSPOT
    },
    stripe: {
      status: getStatus(stripeLogs),
      lastSync: stripeLogs[0]?.createdAt || null,
      count: platformStats.STRIPE
    },
    quickbooks: {
      status: getStatus(quickbooksLogs),
      lastSync: quickbooksLogs[0]?.createdAt || null,
      count: platformStats.QUICKBOOKS
    },
    stats,
    platformStats,
    lastSync: recentLogs[0]?.createdAt || null
  });
}));

// Get sync logs
syncRoutes.get('/logs', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, platform, status, entityType } = req.query;
  
  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (status) where.status = status;
  if (entityType) where.entityType = entityType;

  const logs = await prisma.syncLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit)
  });

  const total = await prisma.syncLog.count({ where });

  res.json({
    logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Trigger manual sync
syncRoutes.post('/trigger', asyncHandler(async (req, res) => {
  const { platform, entityType, entityId } = req.body;

  if (!platform || !['HUBSPOT', 'STRIPE', 'QUICKBOOKS'].includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform specified' });
  }

  if (!entityType || !['INVOICE', 'PAYMENT'].includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entity type specified' });
  }

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      entityType,
      entityId: entityId || 'manual-trigger',
      operation: 'SYNC',
      platform,
      status: 'PENDING',
      requestData: req.body
    }
  });

  // TODO: Add sync job to queue

  res.json({
    message: 'Manual sync triggered successfully',
    syncLogId: syncLog.id
  });
}));

// Retry failed syncs
syncRoutes.post('/retry-failed', asyncHandler(async (req, res) => {
  const { platform, limit = 10 } = req.body;

  const where: Record<string, unknown> = { status: 'FAILED' };
  if (platform) where.platform = platform;

  const failedLogs = await prisma.syncLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Number(limit)
  });

  // Update status to retrying
  const updatePromises = failedLogs.map(log => 
    prisma.syncLog.update({
      where: { id: log.id },
      data: { 
        status: 'RETRYING',
        retryCount: log.retryCount + 1,
        nextRetryAt: new Date()
      }
    })
  );

  await Promise.all(updatePromises);

  // TODO: Add retry jobs to queue

  res.json({
    message: `${failedLogs.length} failed syncs queued for retry`,
    count: failedLogs.length
  });
}));