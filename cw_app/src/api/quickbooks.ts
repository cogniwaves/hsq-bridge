import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { QuickBooksTransferQueueService } from '../services/quickbooksTransferQueue';
import { MultiEntityChangeDetector } from '../services/multiEntityChangeDetector';
import { QuickBooksTransferService } from '../services/quickbooksTransferService';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
import { validateQuery, validateBody } from '../middleware/validation';
import { EntityType } from '@prisma/client';

export const quickbooksRoutes = Router();

/**
 * GET /api/quickbooks/health
 * Check if QuickBooks integration is configured and available
 */
quickbooksRoutes.get('/health', (req: Request, res: Response) => {
  logger.info('Checking QuickBooks integration health');
  
  try {
    const { queueService } = getQuickBooksServices();
    
    res.json(createSuccessResponse({
      status: 'configured',
      services: {
        queueService: 'available',
        changeDetector: 'available',
        transferService: 'available'
      },
      configuration: {
        clientId: !!process.env.QUICKBOOKS_CLIENT_ID,
        clientSecret: !!process.env.QUICKBOOKS_CLIENT_SECRET,
        sandbox: process.env.QUICKBOOKS_SANDBOX === 'true'
      }
    }, 'QuickBooks integration is configured and ready'));
    
  } catch (error) {
    logger.warn('QuickBooks integration not configured:', error);
    res.status(503).json(createErrorResponse(
      'QuickBooks integration not configured',
      error instanceof Error ? error.message : 'Unknown configuration error'
    ));
  }
});

// Lazy initialization to avoid errors when QuickBooks credentials are not available
let queueService: QuickBooksTransferQueueService | null = null;
let changeDetector: MultiEntityChangeDetector | null = null;
let transferService: QuickBooksTransferService | null = null;

function getQuickBooksServices() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks integration not configured. Please set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables.');
  }
  
  if (!queueService) queueService = new QuickBooksTransferQueueService();
  if (!changeDetector) changeDetector = new MultiEntityChangeDetector();
  if (!transferService) transferService = new QuickBooksTransferService();
  
  return { queueService, changeDetector, transferService };
}

/**
 * GET /api/quickbooks/queue
 * Récupère la liste des entrées en attente de validation
 */
quickbooksRoutes.get('/queue', 
  validateQuery({
    limit: (value) => !value || (!isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) <= 100),
    entityType: (value) => !value || ['CONTACT', 'COMPANY', 'INVOICE', 'LINE_ITEM'].includes(value)
  }),
  asyncHandler(async (req, res) => {
    logger.info('Fetching QuickBooks transfer queue entries');
    
    try {
      const { queueService } = getQuickBooksServices();
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const entityType = req.query.entityType as EntityType | undefined;
      
      const entries = await queueService.getPendingEntries(limit, entityType);
      
      res.json(createSuccessResponse({
        entries,
        pagination: {
          count: entries.length,
          limit: limit || null,
          entityTypeFilter: entityType || null
        }
      }, 'Queue entries retrieved successfully'));
      
    } catch (error) {
      logger.error('Failed to retrieve queue entries:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve queue entries',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/quickbooks/queue/summary
 * Récupère un résumé de l'état de la queue
 */
quickbooksRoutes.get('/queue/summary', asyncHandler(async (req, res) => {
  logger.info('Fetching QuickBooks transfer queue summary');
  
  try {
    const { queueService } = getQuickBooksServices();
    const summary = await queueService.getQueueSummary();
    
    res.json(createSuccessResponse({
      summary,
      recommendations: {
        urgentReview: summary.totalPendingReview > 50,
        shouldBulkProcess: summary.totalPendingReview > 20,
        estimatedReviewWorkload: summary.estimatedReviewTime > 60 ? 'high' : summary.estimatedReviewTime > 20 ? 'medium' : 'low',
        message: summary.totalPendingReview === 0 
          ? 'No entries pending validation' 
          : `${summary.totalPendingReview} entries awaiting validation (est. ${summary.estimatedReviewTime} minutes)`
      }
    }, 'Queue summary retrieved successfully'));
    
  } catch (error) {
    logger.error('Failed to retrieve queue summary:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve queue summary',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/quickbooks/queue/process-changes
 * Analyse les changements récents et les ajoute à la queue de validation
 */
quickbooksRoutes.post('/queue/process-changes', asyncHandler(async (req, res) => {
  logger.info('Processing recent changes into QuickBooks transfer queue');
  
  try {
    const { queueService } = getQuickBooksServices();
    const result = await queueService.processChangesIntoQueue();
    
    const statusCode = result.highPriorityEntries > 0 ? 200 : 200;
    
    res.status(statusCode).json(createSuccessResponse({
      processing: {
        newQueueEntries: result.newQueueEntries,
        cascadeEntriesAdded: result.cascadeEntriesAdded,
        highPriorityEntries: result.highPriorityEntries,
        processingDuration: result.processingDuration,
        totalEntriesAdded: result.newQueueEntries + result.cascadeEntriesAdded
      },
      recommendations: {
        immediateReviewNeeded: result.highPriorityEntries > 0,
        bulkProcessingRecommended: result.newQueueEntries > 10,
        message: result.highPriorityEntries > 0 
          ? `${result.highPriorityEntries} high priority entries require immediate review`
          : `${result.newQueueEntries + result.cascadeEntriesAdded} new entries added to validation queue`
      }
    }, 'Changes processed into queue successfully'));
    
  } catch (error) {
    logger.error('Failed to process changes into queue:', error);
    res.status(500).json(createErrorResponse(
      'Failed to process changes into queue',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/quickbooks/queue/initialize-watermarks
 * Initialize sync watermarks to prevent existing entities from being treated as "changed"
 */
quickbooksRoutes.post('/queue/initialize-watermarks', asyncHandler(async (req, res) => {
  logger.info('Initializing sync watermarks');
  
  try {
    const now = new Date();
    const entityTypes = ['INVOICE', 'LINE_ITEM', 'CONTACT', 'COMPANY'];
    const results = [];
    
    for (const entityType of entityTypes) {
      // Check if watermark already exists
      const existingWatermark = await prisma.sync_watermarks.findUnique({
        where: { entity_type: entityType }
      });
      
      if (existingWatermark) {
        results.push({
          entity_type: entityType,
          status: 'exists',
          timestamp: existingWatermark.last_sync_at
        });
        continue;
      }
      
      // Get the latest timestamp for this entity type
      let latestTimestamp = now;
      let entityCount = 0;
      
      switch (entityType) {
        case 'INVOICE':
          const invoiceStats = await prisma.invoice_mapping.aggregate({
            _count: { id: true },
            _max: { updated_at: true }
          });
          entityCount = invoiceStats._count.id || 0;
          if (invoiceStats._max.updated_at) {
            latestTimestamp = invoiceStats._max.updated_at;
          }
          break;
          
        case 'LINE_ITEM':
          const lineItemStats = await prisma.line_items.aggregate({
            _count: { id: true },
            _max: { updated_at: true }
          });
          entityCount = lineItemStats._count.id || 0;
          if (lineItemStats._max.updated_at) {
            latestTimestamp = lineItemStats._max.updated_at;
          }
          break;
          
        case 'CONTACT':
          const contactStats = await prisma.contacts.aggregate({
            _count: { id: true },
            _max: { updated_at: true }
          });
          entityCount = contactStats._count.id || 0;
          if (contactStats._max.updated_at) {
            latestTimestamp = contactStats._max.updated_at;
          }
          break;
          
        case 'COMPANY':
          const companyStats = await prisma.companies.aggregate({
            _count: { id: true },
            _max: { updated_at: true }
          });
          entityCount = companyStats._count.id || 0;
          if (companyStats._max.updated_at) {
            latestTimestamp = companyStats._max.updated_at;
          }
          break;
      }
      
      // Create the watermark
      const watermark = await prisma.sync_watermarks.create({
        data: {
          entity_type: entityType,
          last_sync_at: latestTimestamp,
          entity_count: entityCount,
          sync_duration: 0,
          error_count: 0,
          created_at: now,
          updated_at: now
        }
      });
      
      results.push({
        entity_type: entityType,
        status: 'created',
        timestamp: watermark.last_sync_at,
        entity_count: entityCount
      });
      
      logger.info(`Created sync watermark for ${entityType}: ${latestTimestamp.toISOString()} (${entityCount} entities)`);
    }
    
    res.json(createSuccessResponse({
      results,
      summary: {
        total_types: entityTypes.length,
        created: results.filter(r => r.status === 'created').length,
        existing: results.filter(r => r.status === 'exists').length
      }
    }, 'Sync watermarks initialized successfully'));
    
  } catch (error) {
    logger.error('Error initializing sync watermarks:', error);
    next(error);
  }
}));

/**
 * POST /api/quickbooks/queue/:id/approve
 * Approuve une entrée spécifique de la queue
 */
quickbooksRoutes.post('/queue/:id/approve',
  validateBody({
    approvedBy: (value) => typeof value === 'string' && value.length > 0,
    validationNotes: (value) => !value || typeof value === 'string'
  }),
  asyncHandler(async (req, res) => {
    const entryId = req.params.id;
    const { approvedBy, validationNotes } = req.body;
    
    logger.info(`Approving queue entry ${entryId} by ${approvedBy}`);
    
    try {
      const { queueService } = getQuickBooksServices();
      const approvedEntry = await queueService.approveEntry(entryId, approvedBy, validationNotes);
      
      res.json(createSuccessResponse({
        approvedEntry,
        nextSteps: {
          readyForTransfer: true,
          estimatedTransferTime: '2-5 seconds',
          message: 'Entry approved and ready for QuickBooks transfer'
        }
      }, 'Queue entry approved successfully'));
      
    } catch (error) {
      logger.error(`Failed to approve queue entry ${entryId}:`, error);
      res.status(500).json(createErrorResponse(
        'Failed to approve queue entry',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/quickbooks/queue/:id/reject
 * Rejette une entrée spécifique de la queue
 */
quickbooksRoutes.post('/queue/:id/reject',
  validateBody({
    rejectedBy: (value) => typeof value === 'string' && value.length > 0,
    rejectionReason: (value) => typeof value === 'string' && value.length > 0,
    validationNotes: (value) => !value || typeof value === 'string'
  }),
  asyncHandler(async (req, res) => {
    const entryId = req.params.id;
    const { rejectedBy, rejectionReason, validationNotes } = req.body;
    
    logger.info(`Rejecting queue entry ${entryId} by ${rejectedBy}: ${rejectionReason}`);
    
    try {
      const { queueService } = getQuickBooksServices();
      const rejectedEntry = await queueService.rejectEntry(entryId, rejectedBy, rejectionReason, validationNotes);
      
      res.json(createSuccessResponse({
        rejectedEntry,
        impact: {
          willNotBeTransferred: true,
          canBeReprocessed: true,
          message: 'Entry rejected and will not be transferred to QuickBooks'
        }
      }, 'Queue entry rejected successfully'));
      
    } catch (error) {
      logger.error(`Failed to reject queue entry ${entryId}:`, error);
      res.status(500).json(createErrorResponse(
        'Failed to reject queue entry',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/quickbooks/queue/bulk-approve
 * Approuve plusieurs entrées en lot
 */
quickbooksRoutes.post('/queue/bulk-approve',
  validateBody({
    entryIds: (value) => Array.isArray(value) && value.length > 0 && value.every(id => typeof id === 'string'),
    approvedBy: (value) => typeof value === 'string' && value.length > 0,
    validationNotes: (value) => !value || typeof value === 'string'
  }),
  asyncHandler(async (req, res) => {
    const { entryIds, approvedBy, validationNotes } = req.body;
    
    logger.info(`Bulk approving ${entryIds.length} queue entries by ${approvedBy}`);
    
    try {
      const { queueService } = getQuickBooksServices();
      const result = await queueService.bulkApprove(entryIds, approvedBy, validationNotes);
      
      const statusCode = result.failed.length > 0 ? 207 : 200; // 207 Multi-Status if some failed
      
      res.status(statusCode).json(createSuccessResponse({
        bulkApproval: {
          totalProcessed: result.totalProcessed,
          successfullyApproved: result.successfullyApproved,
          failed: result.failed,
          successRate: Math.round((result.successfullyApproved / result.totalProcessed) * 100),
          estimatedTransferTime: result.estimatedTransferTime
        },
        nextSteps: {
          readyForTransfer: result.successfullyApproved,
          estimatedDuration: `${Math.round(result.estimatedTransferTime / 1000)} seconds`,
          message: result.successfullyApproved > 0 
            ? `${result.successfullyApproved} entries ready for QuickBooks transfer`
            : 'No entries were successfully approved'
        }
      }, result.failed.length > 0 
        ? `Bulk approval completed with ${result.failed.length} failures` 
        : 'Bulk approval completed successfully'
      ));
      
    } catch (error) {
      logger.error('Failed to bulk approve queue entries:', error);
      res.status(500).json(createErrorResponse(
        'Failed to bulk approve queue entries',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/quickbooks/queue/approved
 * Récupère les entrées approuvées prêtes pour le transfert
 */
quickbooksRoutes.get('/queue/approved', 
  validateQuery({
    limit: (value) => !value || (!isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) <= 100)
  }),
  asyncHandler(async (req, res) => {
    logger.info('Fetching approved entries ready for transfer');
    
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const { queueService } = getQuickBooksServices();
      const entries = await queueService.getApprovedEntries(limit);
      
      res.json(createSuccessResponse({
        approvedEntries: entries,
        transferInfo: {
          count: entries.length,
          estimatedDuration: entries.length * 2000, // 2s per entry
          readyForTransfer: entries.length > 0
        }
      }, 'Approved entries retrieved successfully'));
      
    } catch (error) {
      logger.error('Failed to retrieve approved entries:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve approved entries',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/quickbooks/changes/summary
 * Récupère un résumé des changements détectés par type d'entité
 */
quickbooksRoutes.get('/changes/summary', asyncHandler(async (req, res) => {
  logger.info('Fetching changes summary across all entities');
  
  try {
    const { changeDetector } = getQuickBooksServices();
    const changesSummary = await changeDetector.getChangesSummary();
    
    // Calculer des métriques globales
    const entityTypes = Object.keys(changesSummary) as EntityType[];
    const totalChanges = entityTypes.reduce((sum, type) => sum + (changesSummary[type]?.changeCount || 0), 0);
    const totalCriticalChanges = entityTypes.reduce((sum, type) => sum + (changesSummary[type]?.criticalChanges || 0), 0);
    const totalEstimatedSyncTime = entityTypes.reduce((sum, type) => sum + (changesSummary[type]?.estimatedSyncTime || 0), 0);
    
    // Entités avec le plus de changements
    const entitiesByChanges = entityTypes
      .map(type => ({ entityType: type, changeCount: changesSummary[type]?.changeCount || 0 }))
      .sort((a, b) => b.changeCount - a.changeCount)
      .slice(0, 3);

    res.json(createSuccessResponse({
      changesSummary,
      globalMetrics: {
        totalChanges,
        totalCriticalChanges,
        totalEstimatedSyncTime,
        entitiesWithMostChanges: entitiesByChanges
      },
      recommendations: {
        immediateAction: totalCriticalChanges > 0,
        processChanges: totalChanges > 0,
        bulkProcessing: totalChanges > 20,
        message: totalChanges === 0 
          ? 'No recent changes detected across all entities'
          : `${totalChanges} changes detected (${totalCriticalChanges} critical)`
      }
    }, 'Changes summary retrieved successfully'));
    
  } catch (error) {
    logger.error('Failed to retrieve changes summary:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve changes summary',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/quickbooks/queue/:id/mark-transferred
 * Marque une entrée comme transférée avec succès (pour simulation/test)
 */
quickbooksRoutes.post('/queue/:id/mark-transferred',
  validateBody({
    quickbooksId: (value) => typeof value === 'string' && value.length > 0
  }),
  asyncHandler(async (req, res) => {
    const entryId = req.params.id;
    const { quickbooksId } = req.body;
    
    logger.info(`Marking queue entry ${entryId} as transferred (QuickBooks ID: ${quickbooksId})`);
    
    try {
      const { queueService } = getQuickBooksServices();
      const transferredEntry = await queueService.markAsTransferred(entryId, quickbooksId);
      
      res.json(createSuccessResponse({
        transferredEntry,
        transferInfo: {
          quickbooksId,
          transferredAt: transferredEntry.transferredAt,
          success: true,
          message: 'Entry successfully transferred to QuickBooks'
        }
      }, 'Entry marked as transferred successfully'));
      
    } catch (error) {
      logger.error(`Failed to mark entry ${entryId} as transferred:`, error);
      res.status(500).json(createErrorResponse(
        'Failed to mark entry as transferred',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/quickbooks/queue/:id/mark-failed
 * Marque une entrée comme échouée au transfert (pour simulation/test)
 */
quickbooksRoutes.post('/queue/:id/mark-failed',
  validateBody({
    transferError: (value) => typeof value === 'string' && value.length > 0,
    incrementRetry: (value) => value === undefined || typeof value === 'boolean'
  }),
  asyncHandler(async (req, res) => {
    const entryId = req.params.id;
    const { transferError, incrementRetry = true } = req.body;
    
    logger.info(`Marking queue entry ${entryId} as failed: ${transferError}`);
    
    try {
      const { queueService } = getQuickBooksServices();
      const failedEntry = await queueService.markAsFailed(entryId, transferError, incrementRetry);
      
      res.json(createSuccessResponse({
        failedEntry,
        retryInfo: {
          retryCount: failedEntry.retryCount,
          nextRetryAt: failedEntry.nextRetryAt,
          willRetry: failedEntry.status === 'APPROVED' && failedEntry.retryCount < 3,
          message: failedEntry.retryCount < 3 
            ? `Transfer failed, will retry automatically (attempt ${failedEntry.retryCount + 1}/3)`
            : 'Transfer failed, maximum retries reached'
        }
      }, 'Entry marked as failed'));
      
    } catch (error) {
      logger.error(`Failed to mark entry ${entryId} as failed:`, error);
      res.status(500).json(createErrorResponse(
        'Failed to mark entry as failed',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * DELETE /api/quickbooks/queue/cleanup
 * Nettoie les anciennes entrées de la queue
 */
quickbooksRoutes.delete('/queue/cleanup',
  validateQuery({
    olderThanDays: (value) => !value || (!isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) <= 365)
  }),
  asyncHandler(async (req, res) => {
    const olderThanDays = req.query.olderThanDays ? parseInt(req.query.olderThanDays as string) : 30;
    
    logger.info(`Cleaning up queue entries older than ${olderThanDays} days`);
    
    try {
      const { queueService } = getQuickBooksServices();
      const cleanedCount = await queueService.cleanupOldEntries(olderThanDays);
      
      res.json(createSuccessResponse({
        cleanup: {
          entriesDeleted: cleanedCount,
          olderThanDays,
          cleanupDate: new Date()
        }
      }, `Cleanup completed: ${cleanedCount} entries deleted`));
      
    } catch (error) {
      logger.error('Failed to cleanup old queue entries:', error);
      res.status(500).json(createErrorResponse(
        'Failed to cleanup queue entries',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/quickbooks/transfer/process-approved
 * Traite et transfert les entrées approuvées vers QuickBooks
 */
quickbooksRoutes.post('/transfer/process-approved',
  validateQuery({
    maxEntries: (value) => !value || (!isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) <= 100)
  }),
  asyncHandler(async (req, res) => {
    const maxEntries = req.query.maxEntries ? parseInt(req.query.maxEntries as string) : 50;
    
    logger.info(`Processing approved entries for QuickBooks transfer (max: ${maxEntries})`);
    
    try {
      const { transferService } = getQuickBooksServices();
      const result = await transferService.processApprovedEntries(maxEntries);
      
      const statusCode = result.failed > 0 ? 207 : 200; // 207 Multi-Status si des échecs
      
      res.status(statusCode).json(createSuccessResponse({
        transfer: {
          totalProcessed: result.totalProcessed,
          successful: result.successful,
          failed: result.failed,
          duration: result.duration,
          successRate: result.totalProcessed > 0 
            ? Math.round((result.successful / result.totalProcessed) * 100) 
            : 100,
          averageTransferTime: result.totalProcessed > 0 
            ? Math.round(result.duration / result.totalProcessed)
            : 0
        },
        results: result.results,
        summary: {
          message: result.totalProcessed === 0 
            ? 'No approved entries found for transfer'
            : result.failed === 0 
              ? `All ${result.successful} entries transferred successfully`
              : `${result.successful} successful, ${result.failed} failed transfers`
        }
      }, result.failed > 0 
        ? `Transfer completed with ${result.failed} failures` 
        : 'All transfers completed successfully'
      ));
      
    } catch (error) {
      logger.error('Failed to process approved transfers:', error);
      res.status(500).json(createErrorResponse(
        'Failed to process approved transfers',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/quickbooks/transfer/test/:id
 * Test le transfert d'une entrée spécifique de la queue
 */
quickbooksRoutes.post('/transfer/test/:id', asyncHandler(async (req, res) => {
  const entryId = req.params.id;
  
  logger.info(`Testing transfer for queue entry: ${entryId}`);
  
  try {
    const { transferService } = getQuickBooksServices();
    const result = await transferService.testSingleTransfer(entryId);
    
    const statusCode = result.success ? 200 : 400;
    
    res.status(statusCode).json(createSuccessResponse({
      testResult: {
        success: result.success,
        quickbooksId: result.quickbooksId,
        error: result.error,
        details: result.details
      },
      entryId,
      message: result.success 
        ? `Test transfer successful - QuickBooks ID: ${result.quickbooksId}`
        : `Test transfer failed: ${result.error}`
    }, result.success ? 'Test transfer completed successfully' : 'Test transfer failed'));
    
  } catch (error) {
    logger.error(`Failed to test transfer for entry ${entryId}:`, error);
    res.status(500).json(createErrorResponse(
      'Failed to test transfer',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/quickbooks/transfer/statistics
 * Récupère les statistiques de transfert vers QuickBooks
 */
quickbooksRoutes.get('/transfer/statistics', asyncHandler(async (req, res) => {
  logger.info('Fetching QuickBooks transfer statistics');
  
  try {
    const { transferService } = getQuickBooksServices();
    const stats = await transferService.getTransferStatistics();
    
    // Calculer des métriques supplémentaires
    const totalProcessed = stats.totalTransferred + stats.totalFailed;
    const successRate = totalProcessed > 0 
      ? Math.round((stats.totalTransferred / totalProcessed) * 100) 
      : 0;
    
    res.json(createSuccessResponse({
      statistics: {
        ...stats,
        totalProcessed,
        successRate,
        failureRate: 100 - successRate
      },
      insights: {
        performanceStatus: successRate >= 95 ? 'excellent' : successRate >= 80 ? 'good' : 'needs_attention',
        recommendedActions: [
          ...(stats.oldestPendingTransfer ? [`Process ${Math.ceil((Date.now() - stats.oldestPendingTransfer.getTime()) / (1000 * 60 * 60))} hour(s) old pending transfers`] : []),
          ...(successRate < 80 ? ['Review failed transfers for common issues'] : []),
          ...(stats.recentTransfers === 0 ? ['No recent transfer activity - consider processing approved entries'] : [])
        ]
      },
      recommendations: {
        processApproved: stats.oldestPendingTransfer !== null,
        reviewFailures: stats.totalFailed > 0,
        cleanupOld: stats.totalTransferred > 100,
        message: stats.totalTransferred === 0 
          ? 'No transfers completed yet - start by processing approved queue entries'
          : `${stats.totalTransferred} successful transfers completed`
      }
    }, 'Transfer statistics retrieved successfully'));
    
  } catch (error) {
    logger.error('Failed to retrieve transfer statistics:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve transfer statistics',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * DELETE /api/quickbooks/transfer/cleanup
 * Nettoie les anciens transferts réussis
 */
quickbooksRoutes.delete('/transfer/cleanup',
  validateQuery({
    olderThanDays: (value) => !value || (!isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) <= 365)
  }),
  asyncHandler(async (req, res) => {
    const olderThanDays = req.query.olderThanDays ? parseInt(req.query.olderThanDays as string) : 7;
    
    logger.info(`Cleaning up successful transfers older than ${olderThanDays} days`);
    
    try {
      const { transferService } = getQuickBooksServices();
      const cleanedCount = await transferService.cleanupSuccessfulTransfers(olderThanDays);
      
      res.json(createSuccessResponse({
        cleanup: {
          entriesDeleted: cleanedCount,
          olderThanDays,
          cleanupDate: new Date()
        }
      }, `Transfer cleanup completed: ${cleanedCount} entries deleted`));
      
    } catch (error) {
      logger.error('Failed to cleanup successful transfers:', error);
      res.status(500).json(createErrorResponse(
        'Failed to cleanup transfers',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);