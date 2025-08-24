import { logger } from '../utils/logger';
import { prisma } from '../index';
import { getHubSpotClient } from './hubspotClient';
import { InvoiceExtractor } from './invoiceExtractor';

interface IncrementalSyncResult {
  totalChecked: number;
  newInvoices: number;
  updatedInvoices: number;
  errors: string[];
  watermarkTimestamp: Date;
  previousWatermark: Date | null;
  syncDuration: number;
}

export class IncrementalExtractionService {
  private hubspotClient = getHubSpotClient();
  private invoiceExtractor = new InvoiceExtractor();

  /**
   * Effectue une synchronisation incrémentielle basée sur les watermarks
   * Extrait seulement les données modifiées depuis la dernière synchronisation
   */
  async performIncrementalSync(): Promise<IncrementalSyncResult> {
    const startTime = Date.now();
    logger.info('Starting incremental synchronization with watermarks');

    try {
      // 1. Récupérer le dernier watermark depuis la base de données
      const lastWatermark = await this.getLastSyncWatermark();
      logger.info(`Using watermark timestamp: ${lastWatermark ? lastWatermark.toISOString() : 'none (full sync)'}`);

      // 2. Si aucun watermark, effectuer une synchronisation complète
      if (!lastWatermark) {
        logger.warn('No previous watermark found, performing full synchronization');
        return await this.performFullSyncWithWatermark(startTime);
      }

      // 3. Extraire seulement les factures modifiées depuis le watermark
      const modifiedInvoices = await this.hubspotClient.getInvoicesModifiedSince(lastWatermark);
      logger.info(`Found ${modifiedInvoices.length} invoices modified since ${lastWatermark.toISOString()}`);

      // 4. Traiter chaque facture modifiée
      let newInvoices = 0;
      let updatedInvoices = 0;
      const errors: string[] = [];

      for (const invoice of modifiedInvoices) {
        try {
          const existingInvoice = await prisma.invoiceMapping.findUnique({
            where: { hubspotInvoiceId: invoice.id }
          });

          if (existingInvoice) {
            // Mettre à jour l'invoice existante
            await this.invoiceExtractor.updateExistingInvoice(invoice, existingInvoice);
            updatedInvoices++;
            logger.debug(`Updated existing invoice: ${invoice.id}`);
          } else {
            // Créer une nouvelle invoice
            await this.invoiceExtractor.processAndStoreInvoice(invoice);
            newInvoices++;
            logger.debug(`Created new invoice: ${invoice.id}`);
          }
        } catch (error) {
          const errorMessage = `Failed to process invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMessage);
          errors.push(errorMessage);
        }
      }

      // 5. Mettre à jour le watermark avec le timestamp actuel
      const newWatermark = new Date();
      await this.updateLastSyncWatermark(newWatermark);

      const syncDuration = Date.now() - startTime;
      const result: IncrementalSyncResult = {
        totalChecked: modifiedInvoices.length,
        newInvoices,
        updatedInvoices,
        errors,
        watermarkTimestamp: newWatermark,
        previousWatermark: lastWatermark,
        syncDuration
      };

      logger.info(`Incremental sync completed in ${syncDuration}ms: ${newInvoices} new, ${updatedInvoices} updated, ${errors.length} errors`);
      return result;

    } catch (error) {
      logger.error('Incremental synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Effectue une synchronisation forcée depuis une date spécifique
   */
  async performIncrementalSyncSince(sinceDate: Date): Promise<IncrementalSyncResult> {
    const startTime = Date.now();
    logger.info(`Starting forced incremental sync since ${sinceDate.toISOString()}`);

    try {
      const modifiedInvoices = await this.hubspotClient.getInvoicesModifiedSince(sinceDate);
      
      let newInvoices = 0;
      let updatedInvoices = 0;
      const errors: string[] = [];

      for (const invoice of modifiedInvoices) {
        try {
          const existingInvoice = await prisma.invoiceMapping.findUnique({
            where: { hubspotInvoiceId: invoice.id }
          });

          if (existingInvoice) {
            await this.invoiceExtractor.updateExistingInvoice(invoice, existingInvoice);
            updatedInvoices++;
          } else {
            await this.invoiceExtractor.processAndStoreInvoice(invoice);
            newInvoices++;
          }
        } catch (error) {
          const errorMessage = `Failed to process invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
        }
      }

      // Mettre à jour le watermark
      const newWatermark = new Date();
      await this.updateLastSyncWatermark(newWatermark);

      const syncDuration = Date.now() - startTime;
      return {
        totalChecked: modifiedInvoices.length,
        newInvoices,
        updatedInvoices,
        errors,
        watermarkTimestamp: newWatermark,
        previousWatermark: sinceDate,
        syncDuration
      };
    } catch (error) {
      logger.error('Forced incremental sync failed:', error);
      throw error;
    }
  }

  /**
   * Récupère le dernier timestamp de synchronisation depuis la base de données
   */
  private async getLastSyncWatermark(): Promise<Date | null> {
    try {
      // Chercher la dernière synchronisation réussie
      const lastSyncedInvoice = await prisma.invoiceMapping.findFirst({
        where: {
          lastSyncAt: { not: null }
        },
        orderBy: {
          lastSyncAt: 'desc'
        },
        select: {
          lastSyncAt: true
        }
      });

      return lastSyncedInvoice?.lastSyncAt || null;
    } catch (error) {
      logger.error('Failed to retrieve last sync watermark:', error);
      return null;
    }
  }

  /**
   * Met à jour le watermark de synchronisation pour toutes les invoices synchronisées
   */
  private async updateLastSyncWatermark(timestamp: Date): Promise<void> {
    try {
      // Mettre à jour toutes les invoices avec le nouveau timestamp de sync
      await prisma.invoiceMapping.updateMany({
        data: {
          lastSyncAt: timestamp
        }
      });

      logger.debug(`Updated sync watermark to ${timestamp.toISOString()}`);
    } catch (error) {
      logger.error('Failed to update sync watermark:', error);
      throw error;
    }
  }

  /**
   * Effectue une synchronisation complète en cas d'absence de watermark
   */
  private async performFullSyncWithWatermark(startTime: number): Promise<IncrementalSyncResult> {
    logger.info('Performing full synchronization to establish initial watermark');

    const allInvoices = await this.hubspotClient.getAllInvoices();
    let newInvoices = 0;
    let updatedInvoices = 0;
    const errors: string[] = [];

    for (const invoice of allInvoices) {
      try {
        const existingInvoice = await prisma.invoiceMapping.findUnique({
          where: { hubspotInvoiceId: invoice.id }
        });

        if (existingInvoice) {
          await this.invoiceExtractor.updateExistingInvoice(invoice, existingInvoice);
          updatedInvoices++;
        } else {
          await this.invoiceExtractor.processAndStoreInvoice(invoice);
          newInvoices++;
        }
      } catch (error) {
        const errorMessage = `Failed to process invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
      }
    }

    const newWatermark = new Date();
    await this.updateLastSyncWatermark(newWatermark);

    const syncDuration = Date.now() - startTime;
    return {
      totalChecked: allInvoices.length,
      newInvoices,
      updatedInvoices,
      errors,
      watermarkTimestamp: newWatermark,
      previousWatermark: null,
      syncDuration
    };
  }

  /**
   * Obtient des statistiques sur l'état de la synchronisation
   */
  async getSyncStatistics(): Promise<{
    lastWatermark: Date | null;
    totalInvoices: number;
    invoicesNeedingSync: number;
    oldestUnsyncedInvoice: Date | null;
  }> {
    try {
      const lastWatermark = await this.getLastSyncWatermark();
      
      const totalInvoices = await prisma.invoiceMapping.count();
      
      const invoicesNeedingSync = await prisma.invoiceMapping.count({
        where: {
          OR: [
            { lastSyncAt: null },
            { 
              hubspotModifiedAt: { 
                gt: lastWatermark || new Date(0) 
              } 
            }
          ]
        }
      });

      const oldestUnsynced = await prisma.invoiceMapping.findFirst({
        where: {
          lastSyncAt: null
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          createdAt: true
        }
      });

      return {
        lastWatermark,
        totalInvoices,
        invoicesNeedingSync,
        oldestUnsyncedInvoice: oldestUnsynced?.createdAt || null
      };
    } catch (error) {
      logger.error('Failed to get sync statistics:', error);
      throw error;
    }
  }
}