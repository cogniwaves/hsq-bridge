import Queue from 'bull';
import { logger } from '../utils/logger';

// Queue definitions
export const syncQueue = new Queue('sync operations', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const matchingQueue = new Queue('payment matching', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

export const reconciliationQueue = new Queue('reconciliation', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 2,
    delay: 60000 // 1 minute delay
  }
});

export const invoiceExtractionQueue = new Queue('invoice extraction', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Job processors
export async function initializeWorkers() {
  logger.info('Initializing worker queues...');

  // Import processors
  const { processSyncJob } = await import('./syncProcessor');
  const { processMatchingJob } = await import('./matchingProcessor');
  const { processReconciliationJob } = await import('./reconciliationProcessor');
  const { getInvoiceExtractor } = await import('../services/invoiceExtractor');

  // Set up queue processors
  syncQueue.process('invoice-sync', 5, processSyncJob);
  syncQueue.process('payment-sync', 5, processSyncJob);
  
  matchingQueue.process('auto-match', 3, processMatchingJob);
  matchingQueue.process('validate-match', 3, processMatchingJob);
  
  reconciliationQueue.process('daily-reconciliation', 1, processReconciliationJob);
  reconciliationQueue.process('manual-reconciliation', 2, processReconciliationJob);

  // HubSpot Invoice Extraction processors
  invoiceExtractionQueue.process('initial-sync', 1, async (job) => {
    const { force } = job.data;
    logger.info(`Starting initial HubSpot invoice sync (force: ${force})`);
    
    const extractor = getInvoiceExtractor();
    const result = await extractor.performInitialSync();
    
    logger.info(`Initial sync completed: ${JSON.stringify(result)}`);
    return result;
  });

  invoiceExtractionQueue.process('webhook-update', 5, async (job) => {
    const { hubspotObjectId, objectType } = job.data;
    logger.info(`Processing webhook update for ${objectType} ${hubspotObjectId}`);
    
    const extractor = getInvoiceExtractor();
    const result = await extractor.processWebhookUpdate(hubspotObjectId, objectType);
    
    logger.info(`Webhook processing completed: ${JSON.stringify(result)}`);
    return result;
  });

  invoiceExtractionQueue.process('periodic-check', 1, async (job) => {
    logger.info('Starting periodic check for missed invoices');
    
    const extractor = getInvoiceExtractor();
    const result = await extractor.performPeriodicCheck();
    
    logger.info(`Periodic check completed: ${JSON.stringify(result)}`);
    return result;
  });

  // Queue event listeners
  syncQueue.on('completed', (job) => {
    logger.info(`Sync job ${job.id} completed:`, job.returnvalue);
  });

  syncQueue.on('failed', (job, err) => {
    logger.error(`Sync job ${job.id} failed:`, err.message);
  });

  matchingQueue.on('completed', (job) => {
    logger.info(`Matching job ${job.id} completed:`, job.returnvalue);
  });

  matchingQueue.on('failed', (job, err) => {
    logger.error(`Matching job ${job.id} failed:`, err.message);
  });

  reconciliationQueue.on('completed', (job) => {
    logger.info(`Reconciliation job ${job.id} completed:`, job.returnvalue);
  });

  reconciliationQueue.on('failed', (job, err) => {
    logger.error(`Reconciliation job ${job.id} failed:`, err.message);
  });

  // Invoice extraction queue listeners
  invoiceExtractionQueue.on('completed', (job) => {
    logger.info(`Invoice extraction job ${job.id} (${job.name}) completed:`, job.returnvalue);
  });

  invoiceExtractionQueue.on('failed', (job, err) => {
    logger.error(`Invoice extraction job ${job.id} (${job.name}) failed:`, err.message);
  });

  invoiceExtractionQueue.on('stalled', (job) => {
    logger.warn(`Invoice extraction job ${job.id} (${job.name}) stalled`);
  });

  // Schedule periodic jobs
  await schedulePeriodicJobs();

  logger.info('Worker queues initialized successfully');
}

async function schedulePeriodicJobs() {
  // Daily reconciliation at 2 AM
  await reconciliationQueue.add('daily-reconciliation', 
    { type: 'daily' }, 
    { 
      repeat: { cron: '0 2 * * *' },
      jobId: 'daily-reconciliation'
    }
  );

  // Weekly comprehensive reconciliation on Sundays at 3 AM
  await reconciliationQueue.add('weekly-reconciliation', 
    { type: 'weekly' }, 
    { 
      repeat: { cron: '0 3 * * 0' },
      jobId: 'weekly-reconciliation'
    }
  );

  // Periodic HubSpot invoice check every X hours
  const periodicCheckInterval = parseInt(process.env.PERIODIC_CHECK_INTERVAL_HOURS || '4');
  await invoiceExtractionQueue.add('periodic-check', 
    {}, 
    { 
      repeat: { every: periodicCheckInterval * 60 * 60 * 1000 },
      jobId: 'hubspot-periodic-check'
    }
  );

  logger.info(`Periodic jobs scheduled - reconciliation: daily/weekly, HubSpot check: every ${periodicCheckInterval}h`);
}

// Helper functions for adding jobs
export async function addSyncJob(type: 'invoice' | 'payment', data: any, priority?: number) {
  return syncQueue.add(`${type}-sync`, data, {
    priority: priority || 0,
    delay: 1000 // 1 second delay to allow for DB commits
  });
}

export async function addMatchingJob(type: 'auto-match' | 'validate-match', data: any) {
  return matchingQueue.add(type, data);
}

export async function addReconciliationJob(data: any) {
  return reconciliationQueue.add('manual-reconciliation', data);
}

// HubSpot Invoice Extraction job helpers
export async function scheduleInitialSync(force: boolean = false) {
  return invoiceExtractionQueue.add('initial-sync', { force }, {
    priority: 10, // High priority
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    }
  });
}

export async function scheduleWebhookUpdate(hubspotObjectId: string, objectType: string = 'deal') {
  return invoiceExtractionQueue.add('webhook-update', { hubspotObjectId, objectType }, {
    priority: 5, // Medium priority
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    }
  });
}

export async function schedulePeriodicCheck() {
  return invoiceExtractionQueue.add('periodic-check', {}, {
    priority: 1, // Low priority
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    }
  });
}

// Queue monitoring
export function getQueueStats() {
  return Promise.all([
    syncQueue.getWaiting(),
    syncQueue.getActive(),
    syncQueue.getCompleted(),
    syncQueue.getFailed(),
    matchingQueue.getWaiting(),
    matchingQueue.getActive(),
    reconciliationQueue.getWaiting(),
    reconciliationQueue.getActive(),
    invoiceExtractionQueue.getWaiting(),
    invoiceExtractionQueue.getActive(),
    invoiceExtractionQueue.getCompleted(),
    invoiceExtractionQueue.getFailed()
  ]).then(([
    syncWaiting, syncActive, syncCompleted, syncFailed,
    matchingWaiting, matchingActive,
    reconWaiting, reconActive,
    invoiceWaiting, invoiceActive, invoiceCompleted, invoiceFailed
  ]) => ({
    sync: {
      waiting: syncWaiting.length,
      active: syncActive.length,
      completed: syncCompleted.length,
      failed: syncFailed.length
    },
    matching: {
      waiting: matchingWaiting.length,
      active: matchingActive.length
    },
    reconciliation: {
      waiting: reconWaiting.length,
      active: reconActive.length
    },
    invoiceExtraction: {
      waiting: invoiceWaiting.length,
      active: invoiceActive.length,
      completed: invoiceCompleted.length,
      failed: invoiceFailed.length
    }
  }));
}