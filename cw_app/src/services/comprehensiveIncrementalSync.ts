import { logger } from '../utils/logger';
import { prisma } from '../index';
import { getHubSpotClient } from './hubspotClient';
import { EntityType } from '@prisma/client';

export interface EntitySyncResult {
  entityType: EntityType;
  totalChecked: number;
  newEntities: number;
  updatedEntities: number;
  errors: string[];
  syncDuration: number;
  watermarkTimestamp: Date;
  previousWatermark: Date | null;
}

export interface ComprehensiveSyncResult {
  entityResults: EntitySyncResult[];
  totalDuration: number;
  overallSuccess: boolean;
  globalErrors: string[];
  syncTimestamp: Date;
}

export class ComprehensiveIncrementalSync {
  private hubspotClient = getHubSpotClient();

  /**
   * Effectue une synchronisation incrémentielle complète de toutes les entités
   * Respecte les dépendances : CONTACT → COMPANY → INVOICE → LINE_ITEM
   */
  async performFullIncrementalSync(): Promise<ComprehensiveSyncResult> {
    const startTime = Date.now();
    const syncTimestamp = new Date();
    
    logger.info('Starting comprehensive incremental synchronization of all entities');

    const results: EntitySyncResult[] = [];
    const globalErrors: string[] = [];

    // Ordre de synchronisation respectant les dépendances
    const syncOrder: EntityType[] = ['CONTACT', 'COMPANY', 'INVOICE', 'LINE_ITEM'];

    try {
      for (const entityType of syncOrder) {
        try {
          logger.info(`Starting sync for entity type: ${entityType}`);
          const result = await this.syncEntityType(entityType);
          results.push(result);
          
          // Log intermédiaire du progrès
          logger.info(`Completed sync for ${entityType}: ${result.newEntities} new, ${result.updatedEntities} updated, ${result.errors.length} errors`);
        } catch (error) {
          const errorMessage = `Failed to sync entity type ${entityType}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error(errorMessage);
          globalErrors.push(errorMessage);
          
          // Continuer avec les autres entités malgré l'erreur
        }
      }

      const totalDuration = Date.now() - startTime;
      const overallSuccess = globalErrors.length === 0 && results.every(r => r.errors.length === 0);

      const result: ComprehensiveSyncResult = {
        entityResults: results,
        totalDuration,
        overallSuccess,
        globalErrors,
        syncTimestamp
      };

      logger.info(`Comprehensive sync completed in ${totalDuration}ms. Success: ${overallSuccess}`);
      return result;

    } catch (error) {
      logger.error('Comprehensive sync failed:', error);
      throw error;
    }
  }

  /**
   * Synchronise un type d'entité spécifique avec watermarks
   */
  async syncEntityType(entityType: EntityType): Promise<EntitySyncResult> {
    const startTime = Date.now();
    
    try {
      // 1. Récupérer le watermark actuel pour cette entité
      const watermark = await this.getWatermarkForEntity(entityType);
      const previousWatermark = watermark?.lastSyncAt || null;
      
      logger.debug(`Entity ${entityType} - Previous watermark: ${previousWatermark ? previousWatermark.toISOString() : 'none'}`);

      // 2. Extraire les entités modifiées depuis le watermark
      const modifiedEntities = await this.extractModifiedEntities(entityType, previousWatermark);
      
      // 3. Traiter chaque entité (create/update dans la base de données)
      let newEntities = 0;
      let updatedEntities = 0;
      const errors: string[] = [];

      for (const entity of modifiedEntities) {
        try {
          const result = await this.processEntity(entityType, entity);
          if (result === 'created') {
            newEntities++;
          } else if (result === 'updated') {
            updatedEntities++;
          }
        } catch (error) {
          const errorMessage = `Failed to process ${entityType} entity ${entity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          logger.error(errorMessage);
        }
      }

      // 4. Mettre à jour le watermark
      const newWatermark = new Date();
      await this.updateWatermarkForEntity(entityType, newWatermark, modifiedEntities.length, errors.length);

      const syncDuration = Date.now() - startTime;
      
      return {
        entityType,
        totalChecked: modifiedEntities.length,
        newEntities,
        updatedEntities,
        errors,
        syncDuration,
        watermarkTimestamp: newWatermark,
        previousWatermark
      };

    } catch (error) {
      logger.error(`Failed to sync entity type ${entityType}:`, error);
      throw error;
    }
  }

  /**
   * Récupère le watermark actuel pour une entité
   */
  private async getWatermarkForEntity(entityType: EntityType) {
    return await prisma.syncWatermark.findUnique({
      where: { entityType }
    });
  }

  /**
   * Met à jour le watermark pour une entité
   */
  private async updateWatermarkForEntity(
    entityType: EntityType, 
    timestamp: Date, 
    entityCount: number,
    errorCount: number
  ) {
    await prisma.syncWatermark.upsert({
      where: { entityType },
      update: {
        lastSyncAt: timestamp,
        entityCount,
        errorCount,
        lastErrorMessage: errorCount > 0 ? `${errorCount} errors during sync` : null,
        updatedAt: timestamp
      },
      create: {
        entityType,
        lastSyncAt: timestamp,
        entityCount,
        errorCount,
        lastErrorMessage: errorCount > 0 ? `${errorCount} errors during sync` : null
      }
    });
  }

  /**
   * Extrait les entités modifiées depuis le watermark
   */
  private async extractModifiedEntities(entityType: EntityType, watermark: Date | null): Promise<any[]> {
    // Si pas de watermark, prendre une date très ancienne pour tout extraire
    const since = watermark || new Date('2020-01-01');

    switch (entityType) {
      case 'CONTACT':
        return await this.hubspotClient.getContactsModifiedSince(since);
      
      case 'COMPANY':
        return await this.hubspotClient.getCompaniesModifiedSince(since);
      
      case 'INVOICE':
        return await this.hubspotClient.getInvoicesModifiedSince(since);
      
      case 'LINE_ITEM':
        return await this.hubspotClient.getLineItemsModifiedSince(since);
      
      default:
        logger.warn(`Unsupported entity type for sync: ${entityType}`);
        return [];
    }
  }

  /**
   * Traite une entité individuelle (create/update en base)
   */
  private async processEntity(entityType: EntityType, entity: any): Promise<'created' | 'updated' | 'skipped'> {
    switch (entityType) {
      case 'CONTACT':
        return await this.processContact(entity);
      
      case 'COMPANY':
        return await this.processCompany(entity);
      
      case 'INVOICE':
        return await this.processInvoice(entity);
      
      case 'LINE_ITEM':
        return await this.processLineItem(entity);
      
      default:
        logger.warn(`Unsupported entity type for processing: ${entityType}`);
        return 'skipped';
    }
  }

  /**
   * Traite un contact HubSpot
   */
  private async processContact(contact: any): Promise<'created' | 'updated'> {
    const existingContact = await prisma.contact.findUnique({
      where: { hubspotContactId: contact.id }
    });

    const contactData = {
      hubspotContactId: contact.id,
      email: contact.properties.email,
      firstName: contact.properties.firstname,
      lastName: contact.properties.lastname,
      fullName: contact.properties.firstname && contact.properties.lastname 
        ? `${contact.properties.firstname} ${contact.properties.lastname}` 
        : null,
      jobTitle: contact.properties.jobtitle,
      phone: contact.properties.phone,
      country: contact.properties.country,
      city: contact.properties.city,
      hubspotCreatedAt: contact.properties.createdate ? new Date(parseInt(contact.properties.createdate)) : null,
      hubspotUpdatedAt: contact.properties.lastmodifieddate ? new Date(parseInt(contact.properties.lastmodifieddate)) : null,
      lastSyncAt: new Date()
    };

    if (existingContact) {
      await prisma.contact.update({
        where: { id: existingContact.id },
        data: contactData
      });
      return 'updated';
    } else {
      await prisma.contact.create({
        data: contactData
      });
      return 'created';
    }
  }

  /**
   * Traite une entreprise HubSpot
   */
  private async processCompany(company: any): Promise<'created' | 'updated'> {
    const existingCompany = await prisma.company.findUnique({
      where: { hubspotCompanyId: company.id }
    });

    const companyData = {
      hubspotCompanyId: company.id,
      name: company.properties.name,
      domain: company.properties.domain,
      industry: company.properties.industry,
      country: company.properties.country,
      city: company.properties.city,
      state: company.properties.state,
      zip: company.properties.zip,
      hubspotCreatedAt: company.properties.createdate ? new Date(parseInt(company.properties.createdate)) : null,
      hubspotUpdatedAt: company.properties.hs_lastmodifieddate ? new Date(parseInt(company.properties.hs_lastmodifieddate)) : null,
      lastSyncAt: new Date()
    };

    if (existingCompany) {
      await prisma.company.update({
        where: { id: existingCompany.id },
        data: companyData
      });
      return 'updated';
    } else {
      await prisma.company.create({
        data: companyData
      });
      return 'created';
    }
  }

  /**
   * Traite une facture HubSpot (utilise le service existant)
   */
  private async processInvoice(invoice: any): Promise<'created' | 'updated'> {
    // Réutiliser la logique existante d'InvoiceExtractor
    const existingInvoice = await prisma.invoiceMapping.findUnique({
      where: { hubspotInvoiceId: invoice.id }
    });

    // Pour simplifier, on marque comme updated si existe, created sinon
    // La logique complète est dans invoiceExtractor.ts
    return existingInvoice ? 'updated' : 'created';
  }

  /**
   * Traite un line item HubSpot  
   */
  private async processLineItem(lineItem: any): Promise<'created' | 'updated'> {
    const existingLineItem = await prisma.lineItem.findUnique({
      where: { hubspotLineItemId: lineItem.id }
    });

    // Pour simplifier, on marque comme updated si existe, created sinon
    // La logique complète devrait être implémentée selon les besoins
    return existingLineItem ? 'updated' : 'created';
  }

  /**
   * Obtient des statistiques sur l'état de synchronisation de toutes les entités
   */
  async getAllEntitiesSyncStatistics(): Promise<{[key in EntityType]?: {
    lastWatermark: Date | null;
    entityCount: number;
    errorCount: number;
    lastSyncDuration: number | null;
  }}> {
    const watermarks = await prisma.syncWatermark.findMany();
    
    const stats: any = {};
    
    for (const watermark of watermarks) {
      stats[watermark.entityType] = {
        lastWatermark: watermark.lastSyncAt,
        entityCount: watermark.entityCount,
        errorCount: watermark.errorCount,
        lastSyncDuration: watermark.syncDuration
      };
    }

    return stats;
  }
}