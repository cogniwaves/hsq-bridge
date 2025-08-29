import { logger } from '../utils/logger';
import { prisma } from '../index';
import { EntityType, ActionType, QueueStatus } from '@prisma/client';
import { MultiEntityChangeDetector, EntityChange, CascadeImpact } from './multiEntityChangeDetector';

export interface QueueEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  actionType: ActionType;
  status: QueueStatus;
  triggerReason: string;
  entityData: any;
  originalData?: any;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  validationNotes?: string;
  transferredAt?: Date;
  quickbooksId?: string;
  transferError?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueSummary {
  totalPendingReview: number;
  totalApproved: number;
  totalRejected: number;
  totalTransferred: number;
  totalFailed: number;
  byEntityType: {
    [key in EntityType]?: {
      pending: number;
      approved: number;
      rejected: number;
      transferred: number;
      failed: number;
    }
  };
  oldestPendingEntry: Date | null;
  estimatedReviewTime: number; // minutes
}

export interface BulkApprovalResult {
  totalProcessed: number;
  successfullyApproved: number;
  failed: Array<{
    entryId: string;
    error: string;
  }>;
  estimatedTransferTime: number;
}

/**
 * Service de gestion de la queue QuickBooks avec validation humaine
 * Implémente le workflow "human-in-the-loop" pour la validation des transferts
 */
export class QuickBooksTransferQueueService {
  private changeDetector = new MultiEntityChangeDetector();

  /**
   * Analyse les changements et ajoute les entités requérant une validation à la queue
   */
  async processChangesIntoQueue(): Promise<{
    newQueueEntries: number;
    cascadeEntriesAdded: number;
    highPriorityEntries: number;
    processingDuration: number;
  }> {
    const startTime = Date.now();
    logger.info('Processing changes into QuickBooks transfer queue');

    try {
      // 1. Détecter tous les changements et leurs impacts en cascade
      const changeAnalysis = await this.changeDetector.detectChangesAndCascadeImpacts();
      
      let newQueueEntries = 0;
      let cascadeEntriesAdded = 0;
      let highPriorityEntries = 0;

      // 2. Traiter chaque changement détecté
      for (const change of changeAnalysis.detectedChanges) {
        const entry = await this.addChangeToQueue(change, 'direct_change');
        if (entry) {
          newQueueEntries++;
          if (this.isHighPriority(change)) {
            highPriorityEntries++;
          }
        }
      }

      // 3. Traiter les impacts en cascade
      for (const cascadeImpact of changeAnalysis.cascadeImpacts) {
        for (const impactedEntity of cascadeImpact.impactedEntities) {
          if (impactedEntity.requiresSync) {
            const cascadeChange: EntityChange = {
              entityType: impactedEntity.entityType,
              entityId: impactedEntity.entityId,
              hubspotId: impactedEntity.hubspotId,
              changeType: 'updated',
              modificationDate: new Date()
            };

            const entry = await this.addChangeToQueue(cascadeChange, `cascade_from_${cascadeImpact.sourceChange.entityType}`);
            if (entry) {
              cascadeEntriesAdded++;
              if (impactedEntity.priority === 'high' || impactedEntity.priority === 'critical') {
                highPriorityEntries++;
              }
            }
          }
        }
      }

      const processingDuration = Date.now() - startTime;
      
      logger.info(`Queue processing completed in ${processingDuration}ms. Added ${newQueueEntries} direct entries and ${cascadeEntriesAdded} cascade entries`);
      
      return {
        newQueueEntries,
        cascadeEntriesAdded,
        highPriorityEntries,
        processingDuration
      };

    } catch (error) {
      logger.error('Failed to process changes into queue:', error);
      throw error;
    }
  }

  /**
   * Ajoute un changement spécifique à la queue
   */
  private async addChangeToQueue(change: EntityChange, triggerReason: string): Promise<QueueEntry | null> {
    try {
      // Vérifier si l'entrée existe déjà (éviter les doublons)
      const existing = await prisma.quickBooksTransferQueue.findFirst({
        where: {
          entityType: change.entityType,
          entityId: change.entityId,
          status: {
            in: ['PENDING_REVIEW', 'APPROVED']
          }
        }
      });

      if (existing) {
        logger.debug(`Queue entry already exists for ${change.entityType} ${change.hubspotId}`);
        return null;
      }

      // Récupérer les données complètes de l'entité
      const entityData = await this.getEntityData(change.entityType, change.entityId);
      
      if (!entityData) {
        logger.warn(`Could not retrieve entity data for ${change.entityType} ${change.entityId}`);
        return null;
      }

      const actionType = this.determineActionType(change);
      
      const queueEntry = await prisma.quickBooksTransferQueue.create({
        data: {
          entityType: change.entityType,
          entityId: change.entityId,
          actionType,
          status: 'PENDING_REVIEW',
          triggerReason,
          entityData: entityData,
          originalData: change.previousData || null
        }
      });

      logger.debug(`Added ${change.entityType} ${change.hubspotId} to transfer queue`);
      return queueEntry as QueueEntry;

    } catch (error) {
      logger.error(`Failed to add ${change.entityType} ${change.hubspotId} to queue:`, error);
      return null;
    }
  }

  /**
   * Récupère toutes les entrées en attente de validation
   */
  async getPendingEntries(limit?: number, entityType?: EntityType): Promise<QueueEntry[]> {
    const entries = await prisma.quickBooksTransferQueue.findMany({
      where: {
        status: 'PENDING_REVIEW',
        ...(entityType && { entityType })
      },
      orderBy: [
        { createdAt: 'asc' } // FIFO - First In, First Out
      ],
      ...(limit && { take: limit })
    });

    return entries as QueueEntry[];
  }

  /**
   * Approuve une entrée de la queue
   */
  async approveEntry(entryId: string, approvedBy: string, validationNotes?: string): Promise<QueueEntry> {
    const entry = await prisma.quickBooksTransferQueue.update({
      where: { id: entryId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
        validationNotes: validationNotes || null
      }
    });

    logger.info(`Queue entry ${entryId} approved by ${approvedBy}`);
    return entry as QueueEntry;
  }

  /**
   * Rejette une entrée de la queue
   */
  async rejectEntry(entryId: string, rejectedBy: string, rejectionReason: string, validationNotes?: string): Promise<QueueEntry> {
    const entry = await prisma.quickBooksTransferQueue.update({
      where: { id: entryId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason,
        validationNotes: validationNotes || null
      }
    });

    logger.info(`Queue entry ${entryId} rejected by ${rejectedBy}: ${rejectionReason}`);
    return entry as QueueEntry;
  }

  /**
   * Approbation en lot (bulk approval)
   */
  async bulkApprove(entryIds: string[], approvedBy: string, validationNotes?: string): Promise<BulkApprovalResult> {
    const startTime = Date.now();
    let successfullyApproved = 0;
    const failed: Array<{ entryId: string; error: string }> = [];

    for (const entryId of entryIds) {
      try {
        await this.approveEntry(entryId, approvedBy, validationNotes);
        successfullyApproved++;
      } catch (error) {
        failed.push({
          entryId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        logger.error(`Failed to approve entry ${entryId}:`, error);
      }
    }

    // Estimation du temps de transfert (2s par entité en moyenne)
    const estimatedTransferTime = successfullyApproved * 2000;

    const result: BulkApprovalResult = {
      totalProcessed: entryIds.length,
      successfullyApproved,
      failed,
      estimatedTransferTime
    };

    logger.info(`Bulk approval completed: ${successfullyApproved}/${entryIds.length} successful`);
    return result;
  }

  /**
   * Obtient un résumé de l'état de la queue
   */
  async getQueueSummary(): Promise<QueueSummary> {
    // Compter par statut
    const statusCounts = await prisma.quickBooksTransferQueue.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    // Compter par entity type et statut
    const entityTypeCounts = await prisma.quickBooksTransferQueue.groupBy({
      by: ['entityType', 'status'],
      _count: {
        id: true
      }
    });

    // Plus ancienne entrée en attente
    const oldestPending = await prisma.quickBooksTransferQueue.findFirst({
      where: { status: 'PENDING_REVIEW' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    });

    // Construire le résumé
    let totalPendingReview = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalTransferred = 0;
    let totalFailed = 0;

    statusCounts.forEach(count => {
      switch (count.status) {
        case 'PENDING_REVIEW':
          totalPendingReview = count._count.id;
          break;
        case 'APPROVED':
          totalApproved = count._count.id;
          break;
        case 'REJECTED':
          totalRejected = count._count.id;
          break;
        case 'TRANSFERRED':
          totalTransferred = count._count.id;
          break;
        case 'FAILED':
          totalFailed = count._count.id;
          break;
      }
    });

    // Construire le résumé par type d'entité
    const byEntityType: QueueSummary['byEntityType'] = {};
    const entityTypes: EntityType[] = ['CONTACT', 'COMPANY', 'INVOICE', 'LINE_ITEM'];

    entityTypes.forEach(entityType => {
      byEntityType[entityType] = {
        pending: 0,
        approved: 0,
        rejected: 0,
        transferred: 0,
        failed: 0
      };
    });

    entityTypeCounts.forEach(count => {
      const entityType = count.entityType;
      const status = count.status;
      const countValue = count._count.id;

      if (byEntityType[entityType]) {
        switch (status) {
          case 'PENDING_REVIEW':
            byEntityType[entityType].pending = countValue;
            break;
          case 'APPROVED':
            byEntityType[entityType].approved = countValue;
            break;
          case 'REJECTED':
            byEntityType[entityType].rejected = countValue;
            break;
          case 'TRANSFERRED':
            byEntityType[entityType].transferred = countValue;
            break;
          case 'FAILED':
            byEntityType[entityType].failed = countValue;
            break;
        }
      }
    });

    // Estimation du temps de review (2 minutes par entrée)
    const estimatedReviewTime = totalPendingReview * 2;

    return {
      totalPendingReview,
      totalApproved,
      totalRejected,
      totalTransferred,
      totalFailed,
      byEntityType,
      oldestPendingEntry: oldestPending?.createdAt || null,
      estimatedReviewTime
    };
  }

  /**
   * Marque une entrée comme transférée avec succès
   */
  async markAsTransferred(entryId: string, quickbooksId: string): Promise<QueueEntry> {
    const entry = await prisma.quickBooksTransferQueue.update({
      where: { id: entryId },
      data: {
        status: 'TRANSFERRED',
        transferredAt: new Date(),
        quickbooksId,
        transferError: null
      }
    });

    logger.info(`Queue entry ${entryId} successfully transferred to QuickBooks (ID: ${quickbooksId})`);
    return entry as QueueEntry;
  }

  /**
   * Marque une entrée comme échouée au transfert
   */
  async markAsFailed(entryId: string, transferError: string, incrementRetry = true): Promise<QueueEntry> {
    const updateData: any = {
      status: 'FAILED',
      transferError
    };

    if (incrementRetry) {
      // Incrémenter le compteur de retry et programmer le prochain essai
      const currentEntry = await prisma.quickBooksTransferQueue.findUnique({
        where: { id: entryId }
      });

      if (currentEntry) {
        const newRetryCount = currentEntry.retryCount + 1;
        const nextRetryDelay = Math.min(Math.pow(2, newRetryCount) * 60000, 24 * 60 * 60 * 1000); // Exponential backoff, max 24h
        
        updateData.retryCount = newRetryCount;
        updateData.nextRetryAt = new Date(Date.now() + nextRetryDelay);
        
        // Si moins de 3 retries, repasser en APPROVED pour retry automatique
        if (newRetryCount < 3) {
          updateData.status = 'APPROVED';
        }
      }
    }

    const entry = await prisma.quickBooksTransferQueue.update({
      where: { id: entryId },
      data: updateData
    });

    logger.error(`Queue entry ${entryId} failed to transfer: ${transferError}`);
    return entry as QueueEntry;
  }

  /**
   * Récupère les entrées approuvées prêtes pour le transfert
   */
  async getApprovedEntries(limit?: number): Promise<QueueEntry[]> {
    const entries = await prisma.quickBooksTransferQueue.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } }
        ]
      },
      orderBy: [
        { approvedAt: 'asc' }
      ],
      ...(limit && { take: limit })
    });

    return entries as QueueEntry[];
  }

  /**
   * Récupère les données complètes d'une entité selon son type
   */
  private async getEntityData(entityType: EntityType, entityId: string): Promise<any | null> {
    try {
      switch (entityType) {
        case 'CONTACT':
          return await prisma.contact.findUnique({
            where: { id: entityId },
            include: {
              invoiceAssociations: {
                include: {
                  invoice: true,
                  company: true
                }
              }
            }
          });

        case 'COMPANY':
          return await prisma.company.findUnique({
            where: { id: entityId },
            include: {
              invoiceAssociations: {
                include: {
                  invoice: true,
                  contact: true
                }
              }
            }
          });

        case 'INVOICE':
          return await prisma.invoiceMapping.findUnique({
            where: { id: entityId },
            include: {
              lineItems: true,
              associations: {
                include: {
                  contact: true,
                  company: true
                }
              },
              taxSummary: true
            }
          });

        case 'LINE_ITEM':
          return await prisma.lineItem.findUnique({
            where: { id: entityId },
            include: {
              invoice: {
                include: {
                  associations: {
                    include: {
                      contact: true,
                      company: true
                    }
                  }
                }
              }
            }
          });

        default:
          logger.warn(`Unsupported entity type for data retrieval: ${entityType}`);
          return null;
      }
    } catch (error) {
      logger.error(`Error retrieving entity data for ${entityType} ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Détermine le type d'action selon le changement
   */
  private determineActionType(change: EntityChange): ActionType {
    switch (change.changeType) {
      case 'created':
        return 'CREATE';
      case 'updated':
        return 'UPDATE';
      case 'deleted':
        return 'DELETE';
      default:
        return 'UPDATE';
    }
  }

  /**
   * Détermine si un changement est de haute priorité
   */
  private isHighPriority(change: EntityChange): boolean {
    // Les factures et line items sont toujours haute priorité
    return change.entityType === 'INVOICE' || change.entityType === 'LINE_ITEM';
  }

  /**
   * Nettoie les anciennes entrées de la queue (housekeeping)
   */
  async cleanupOldEntries(olderThanDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.quickBooksTransferQueue.deleteMany({
      where: {
        status: {
          in: ['TRANSFERRED', 'REJECTED']
        },
        updatedAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info(`Cleaned up ${result.count} old queue entries older than ${olderThanDays} days`);
    return result.count;
  }
}