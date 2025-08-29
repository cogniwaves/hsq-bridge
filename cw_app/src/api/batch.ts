import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { IncrementalExtractionService } from '../services/incrementalExtraction';
import { ComprehensiveIncrementalSync } from '../services/comprehensiveIncrementalSync';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
// import { rateLimits } from '../middleware/rateLimiting';
import { validateQuery } from '../middleware/validation';
import { isValidDateString } from '../utils/typeGuards';

export const batchRoutes = Router();

const incrementalExtractor = new IncrementalExtractionService();
const comprehensiveSync = new ComprehensiveIncrementalSync();

/**
 * GET /api/batch/sync/status
 * Récupère l'état actuel de la synchronisation incrémentielle
 */
batchRoutes.get('/sync/status', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  logger.info('Fetching batch sync status');
  
  try {
    const statistics = await incrementalExtractor.getSyncStatistics();
    
    res.json(createSuccessResponse({
      lastWatermark: statistics.lastWatermark,
      totalInvoices: statistics.totalInvoices,
      invoicesNeedingSync: statistics.invoicesNeedingSync,
      oldestUnsyncedInvoice: statistics.oldestUnsyncedInvoice,
      syncHealthy: statistics.invoicesNeedingSync < 50, // Considéré sain si moins de 50 factures en attente
      recommendations: {
        shouldSync: statistics.invoicesNeedingSync > 0,
        urgentSync: statistics.invoicesNeedingSync > 100,
        message: statistics.invoicesNeedingSync === 0 
          ? 'Toutes les factures sont synchronisées' 
          : `${statistics.invoicesNeedingSync} factures nécessitent une synchronisation`
      }
    }, 'Batch sync status retrieved successfully'));
    
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve sync status',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/batch/sync/incremental
 * Lance une synchronisation incrémentielle avec watermarks
 */
batchRoutes.post('/sync/incremental', asyncHandler(async (req, res) => {
  logger.info('Starting incremental batch synchronization');
  
  try {
    const result = await incrementalExtractor.performIncrementalSync();
    
    // Déterminer le statut de la réponse basé sur les erreurs
    const hasErrors = result.errors.length > 0;
    const statusCode = hasErrors ? 207 : 200; // 207 Multi-Status si des erreurs partielles
    
    res.status(statusCode).json(createSuccessResponse({
      synchronization: {
        type: 'incremental',
        totalChecked: result.totalChecked,
        newInvoices: result.newInvoices,
        updatedInvoices: result.updatedInvoices,
        errors: result.errors,
        syncDuration: result.syncDuration,
        performance: {
          invoicesPerSecond: Math.round((result.totalChecked / result.syncDuration) * 1000),
          averageProcessingTime: result.totalChecked > 0 ? Math.round(result.syncDuration / result.totalChecked) : 0
        }
      },
      watermark: {
        previous: result.previousWatermark,
        current: result.watermarkTimestamp,
        timeSinceLastSync: result.previousWatermark 
          ? Date.now() - result.previousWatermark.getTime()
          : null
      },
      summary: {
        successful: result.newInvoices + result.updatedInvoices,
        failed: result.errors.length,
        successRate: result.totalChecked > 0 
          ? Math.round(((result.totalChecked - result.errors.length) / result.totalChecked) * 100) 
          : 100
      }
    }, hasErrors 
      ? `Incremental sync completed with ${result.errors.length} errors` 
      : 'Incremental sync completed successfully'
    ));
    
  } catch (error) {
    logger.error('Incremental sync failed:', error);
    res.status(500).json(createErrorResponse(
      'Incremental synchronization failed',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/batch/sync/since
 * Lance une synchronisation incrémentielle depuis une date spécifique
 * Query params: sinceDate (ISO string)
 */
batchRoutes.post('/sync/since',
  validateQuery({
    sinceDate: (value) => {
      if (!value) return false;
      return isValidDateString(value);
    }
  }),
  asyncHandler(async (req, res) => {
    const sinceDateStr = req.query.sinceDate as string;
    const sinceDate = new Date(sinceDateStr);
    
    logger.info(`Starting forced incremental sync since ${sinceDate.toISOString()}`);
    
    try {
      const result = await incrementalExtractor.performIncrementalSyncSince(sinceDate);
      
      const hasErrors = result.errors.length > 0;
      const statusCode = hasErrors ? 207 : 200;
      
      res.status(statusCode).json(createSuccessResponse({
        synchronization: {
          type: 'forced_incremental',
          sinceDate: sinceDate.toISOString(),
          totalChecked: result.totalChecked,
          newInvoices: result.newInvoices,
          updatedInvoices: result.updatedInvoices,
          errors: result.errors,
          syncDuration: result.syncDuration,
          performance: {
            invoicesPerSecond: Math.round((result.totalChecked / result.syncDuration) * 1000),
            averageProcessingTime: result.totalChecked > 0 ? Math.round(result.syncDuration / result.totalChecked) : 0
          }
        },
        watermark: {
          forced: sinceDate,
          current: result.watermarkTimestamp
        },
        summary: {
          successful: result.newInvoices + result.updatedInvoices,
          failed: result.errors.length,
          successRate: result.totalChecked > 0 
            ? Math.round(((result.totalChecked - result.errors.length) / result.totalChecked) * 100) 
            : 100
        }
      }, hasErrors 
        ? `Forced incremental sync completed with ${result.errors.length} errors` 
        : 'Forced incremental sync completed successfully'
      ));
      
    } catch (error) {
      logger.error('Forced incremental sync failed:', error);
      res.status(500).json(createErrorResponse(
        'Forced incremental synchronization failed',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/batch/sync/recommendations
 * Fournit des recommandations de synchronisation basées sur l'état actuel
 */
batchRoutes.get('/sync/recommendations', asyncHandler(async (req, res) => {
  logger.info('Getting sync recommendations');
  
  try {
    const stats = await incrementalExtractor.getSyncStatistics();
    
    // Analyser l'état et générer des recommandations
    const recommendations = [];
    
    if (stats.invoicesNeedingSync === 0) {
      recommendations.push({
        type: 'success',
        priority: 'low',
        action: 'none',
        message: 'Toutes les factures sont synchronisées',
        details: 'Aucune action requise actuellement'
      });
    } else if (stats.invoicesNeedingSync < 10) {
      recommendations.push({
        type: 'info',
        priority: 'low',
        action: 'incremental_sync',
        message: `${stats.invoicesNeedingSync} factures à synchroniser`,
        details: 'Synchronisation incrémentielle recommandée dans les prochaines heures'
      });
    } else if (stats.invoicesNeedingSync < 50) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        action: 'incremental_sync',
        message: `${stats.invoicesNeedingSync} factures en attente`,
        details: 'Synchronisation incrémentielle recommandée maintenant'
      });
    } else {
      recommendations.push({
        type: 'error',
        priority: 'high',
        action: 'urgent_sync',
        message: `${stats.invoicesNeedingSync} factures nécessitent une synchronisation urgente`,
        details: 'Risque de perte de données ou de désynchronisation'
      });
    }
    
    // Recommandations basées sur le temps écoulé
    if (stats.lastWatermark) {
      const hoursSinceLastSync = (Date.now() - stats.lastWatermark.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastSync > 24) {
        recommendations.push({
          type: 'warning',
          priority: 'medium',
          action: 'scheduled_sync',
          message: `Dernière synchronisation il y a ${Math.round(hoursSinceLastSync)} heures`,
          details: 'Synchronisation quotidienne recommandée pour maintenir la fraîcheur des données'
        });
      }
    } else {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        action: 'initial_sync',
        message: 'Aucun watermark trouvé',
        details: 'Première synchronisation incrémentielle recommandée pour établir un point de référence'
      });
    }
    
    res.json(createSuccessResponse({
      syncStatus: {
        healthy: stats.invoicesNeedingSync < 50,
        lastWatermark: stats.lastWatermark,
        invoicesNeedingSync: stats.invoicesNeedingSync,
        totalInvoices: stats.totalInvoices
      },
      recommendations,
      nextActions: {
        immediate: recommendations.filter(r => r.priority === 'high').map(r => r.action),
        scheduled: recommendations.filter(r => r.priority === 'medium').map(r => r.action),
        optional: recommendations.filter(r => r.priority === 'low').map(r => r.action)
      }
    }, 'Sync recommendations generated successfully'));
    
  } catch (error) {
    logger.error('Failed to get sync recommendations:', error);
    res.status(500).json(createErrorResponse(
      'Failed to generate sync recommendations',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/batch/sync/full-incremental  
 * Lance une synchronisation incrémentielle complète de toutes les entités
 */
batchRoutes.post('/sync/full-incremental', asyncHandler(async (req, res) => {
  logger.info('Starting comprehensive incremental synchronization (all entities)');
  
  try {
    const result = await comprehensiveSync.performFullIncrementalSync();
    
    // Calculer des métriques agrégées
    const totalEntities = result.entityResults.reduce((sum, r) => sum + r.totalChecked, 0);
    const totalNew = result.entityResults.reduce((sum, r) => sum + r.newEntities, 0);
    const totalUpdated = result.entityResults.reduce((sum, r) => sum + r.updatedEntities, 0);
    const totalErrors = result.entityResults.reduce((sum, r) => sum + r.errors.length, 0) + result.globalErrors.length;
    
    const statusCode = totalErrors > 0 ? 207 : 200; // 207 Multi-Status si erreurs partielles
    
    res.status(statusCode).json(createSuccessResponse({
      synchronization: {
        type: 'comprehensive_incremental',
        entitiesProcessed: result.entityResults.map(r => r.entityType),
        totalEntitiesChecked: totalEntities,
        totalNewEntities: totalNew,
        totalUpdatedEntities: totalUpdated,
        totalErrors,
        totalDuration: result.totalDuration,
        overallSuccess: result.overallSuccess,
        performance: {
          entitiesPerSecond: Math.round((totalEntities / result.totalDuration) * 1000),
          averageEntityProcessingTime: totalEntities > 0 ? Math.round(result.totalDuration / totalEntities) : 0
        }
      },
      entityResults: result.entityResults.map(r => ({
        entityType: r.entityType,
        totalChecked: r.totalChecked,
        newEntities: r.newEntities,
        updatedEntities: r.updatedEntities,
        errors: r.errors,
        syncDuration: r.syncDuration,
        watermark: {
          previous: r.previousWatermark,
          current: r.watermarkTimestamp
        },
        performance: {
          entitiesPerSecond: Math.round((r.totalChecked / r.syncDuration) * 1000),
          successRate: r.totalChecked > 0 ? Math.round(((r.totalChecked - r.errors.length) / r.totalChecked) * 100) : 100
        }
      })),
      globalErrors: result.globalErrors,
      summary: {
        successful: totalNew + totalUpdated,
        failed: totalErrors,
        overallSuccessRate: totalEntities > 0 ? Math.round(((totalEntities - totalErrors) / totalEntities) * 100) : 100
      }
    }, result.overallSuccess 
      ? 'Comprehensive incremental sync completed successfully' 
      : `Comprehensive sync completed with ${totalErrors} errors`
    ));
    
  } catch (error) {
    logger.error('Comprehensive incremental sync failed:', error);
    res.status(500).json(createErrorResponse(
      'Comprehensive incremental synchronization failed',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/batch/sync/contacts-incremental
 * Lance une synchronisation incrémentielle des contacts seulement
 */
batchRoutes.post('/sync/contacts-incremental', asyncHandler(async (req, res) => {
  logger.info('Starting incremental sync for contacts only');
  
  try {
    const result = await comprehensiveSync.syncEntityType('CONTACT');
    
    const hasErrors = result.errors.length > 0;
    const statusCode = hasErrors ? 207 : 200;
    
    res.status(statusCode).json(createSuccessResponse({
      synchronization: {
        type: 'entity_specific',
        entityType: 'CONTACT',
        totalChecked: result.totalChecked,
        newEntities: result.newEntities,
        updatedEntities: result.updatedEntities,
        errors: result.errors,
        syncDuration: result.syncDuration,
        performance: {
          entitiesPerSecond: Math.round((result.totalChecked / result.syncDuration) * 1000),
          successRate: result.totalChecked > 0 ? Math.round(((result.totalChecked - result.errors.length) / result.totalChecked) * 100) : 100
        }
      },
      watermark: {
        previous: result.previousWatermark,
        current: result.watermarkTimestamp
      }
    }, hasErrors 
      ? `Contacts sync completed with ${result.errors.length} errors` 
      : 'Contacts sync completed successfully'
    ));
    
  } catch (error) {
    logger.error('Contacts incremental sync failed:', error);
    res.status(500).json(createErrorResponse(
      'Contacts incremental synchronization failed',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/batch/sync/companies-incremental
 * Lance une synchronisation incrémentielle des entreprises seulement
 */
batchRoutes.post('/sync/companies-incremental', asyncHandler(async (req, res) => {
  logger.info('Starting incremental sync for companies only');
  
  try {
    const result = await comprehensiveSync.syncEntityType('COMPANY');
    
    const hasErrors = result.errors.length > 0;
    const statusCode = hasErrors ? 207 : 200;
    
    res.status(statusCode).json(createSuccessResponse({
      synchronization: {
        type: 'entity_specific',
        entityType: 'COMPANY',
        totalChecked: result.totalChecked,
        newEntities: result.newEntities,
        updatedEntities: result.updatedEntities,
        errors: result.errors,
        syncDuration: result.syncDuration,
        performance: {
          entitiesPerSecond: Math.round((result.totalChecked / result.syncDuration) * 1000),
          successRate: result.totalChecked > 0 ? Math.round(((result.totalChecked - result.errors.length) / result.totalChecked) * 100) : 100
        }
      },
      watermark: {
        previous: result.previousWatermark,
        current: result.watermarkTimestamp
      }
    }, hasErrors 
      ? `Companies sync completed with ${result.errors.length} errors` 
      : 'Companies sync completed successfully'
    ));
    
  } catch (error) {
    logger.error('Companies incremental sync failed:', error);
    res.status(500).json(createErrorResponse(
      'Companies incremental synchronization failed',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/batch/sync/status-all
 * Récupère l'état de synchronisation de toutes les entités
 */
batchRoutes.get('/sync/status-all', asyncHandler(async (req, res) => {
  logger.info('Fetching comprehensive sync status for all entities');
  
  try {
    const allStats = await comprehensiveSync.getAllEntitiesSyncStatistics();
    
    // Calculer des métriques globales
    const entityTypes = Object.keys(allStats) as Array<keyof typeof allStats>;
    const totalEntities = entityTypes.reduce((sum, type) => sum + (allStats[type]?.entityCount || 0), 0);
    const totalErrors = entityTypes.reduce((sum, type) => sum + (allStats[type]?.errorCount || 0), 0);
    const avgDuration = entityTypes.length > 0 
      ? entityTypes.reduce((sum, type) => sum + (allStats[type]?.lastSyncDuration || 0), 0) / entityTypes.length 
      : 0;
    
    // Déterminer l'état global
    const syncHealthy = totalErrors < 10; // Seuil configurable
    const lastSyncTimes = entityTypes.map(type => allStats[type]?.lastWatermark).filter(Boolean);
    const oldestLastSync = lastSyncTimes.length > 0 ? Math.min(...lastSyncTimes.map(d => d!.getTime())) : null;
    const timeSinceOldest = oldestLastSync ? Date.now() - oldestLastSync : null;
    
    res.json(createSuccessResponse({
      entities: allStats,
      globalSummary: {
        totalEntitiesSynced: totalEntities,
        totalErrorsAcrossEntities: totalErrors,
        averageSyncDuration: Math.round(avgDuration),
        syncHealthy,
        oldestLastSync: oldestLastSync ? new Date(oldestLastSync) : null,
        timeSinceOldestSync: timeSinceOldest,
        entitiesWithErrors: entityTypes.filter(type => (allStats[type]?.errorCount || 0) > 0),
        entitiesNeedingSync: entityTypes.filter(type => !allStats[type]?.lastWatermark || (allStats[type]?.errorCount || 0) > 0)
      },
      recommendations: {
        shouldSyncAll: !syncHealthy || (timeSinceOldest && timeSinceOldest > 24 * 60 * 60 * 1000), // > 24h
        urgentEntities: entityTypes.filter(type => (allStats[type]?.errorCount || 0) > 5),
        message: syncHealthy 
          ? 'Toutes les entités sont synchronisées et en bonne santé' 
          : `${totalErrors} erreurs détectées across entités`
      }
    }, 'Multi-entity sync status retrieved successfully'));
    
  } catch (error) {
    logger.error('Failed to get comprehensive sync status:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve comprehensive sync status',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));