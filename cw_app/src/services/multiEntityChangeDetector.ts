import { logger } from '../utils/logger';
import { prisma } from '../index';
import { EntityType } from '@prisma/client';

export interface EntityChange {
  entityType: EntityType;
  entityId: string;
  hubspotId: string;
  changeType: 'created' | 'updated' | 'deleted';
  modificationDate: Date;
  previousData?: any;
  currentData?: any;
}

export interface CascadeImpact {
  sourceChange: EntityChange;
  impactedEntities: {
    entityType: EntityType;
    entityId: string;
    hubspotId: string;
    impactReason: string;
    requiresSync: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }[];
  totalImpactedEntities: number;
  cascadeDepth: number;
}

export interface ChangeDetectionResult {
  detectedChanges: EntityChange[];
  cascadeImpacts: CascadeImpact[];
  totalEntitiesRequiringSync: number;
  highPriorityImpacts: number;
  estimatedSyncDuration: number; // milliseconds
}

/**
 * Service de détection des impacts en cascade pour les changements multi-entités
 * Détecte les associations et dépendances entre contacts, companies, invoices et line items
 */
export class MultiEntityChangeDetector {

  /**
   * Détecte les changements depuis le dernier watermark et analyse leurs impacts
   */
  async detectChangesAndCascadeImpacts(): Promise<ChangeDetectionResult> {
    logger.info('Starting multi-entity cascade impact detection');
    
    const startTime = Date.now();
    
    // 1. Détecter tous les changements par entité depuis les derniers watermarks
    const detectedChanges: EntityChange[] = [];
    const entityTypes: EntityType[] = ['CONTACT', 'COMPANY', 'INVOICE', 'LINE_ITEM'];
    
    for (const entityType of entityTypes) {
      const changes = await this.detectChangesForEntity(entityType);
      detectedChanges.push(...changes);
    }

    // 2. Analyser les impacts en cascade pour chaque changement
    const cascadeImpacts: CascadeImpact[] = [];
    
    for (const change of detectedChanges) {
      try {
        const impact = await this.analyzeCascadeImpact(change);
        if (impact.impactedEntities.length > 0) {
          cascadeImpacts.push(impact);
        }
      } catch (error) {
        logger.error(`Failed to analyze cascade impact for ${change.entityType} ${change.hubspotId}:`, error);
      }
    }

    // 3. Calculer les métriques globales
    const totalEntitiesRequiringSync = new Set(
      cascadeImpacts.flatMap(impact => 
        impact.impactedEntities
          .filter(entity => entity.requiresSync)
          .map(entity => `${entity.entityType}:${entity.hubspotId}`)
      )
    ).size;

    const highPriorityImpacts = cascadeImpacts.reduce((count, impact) => 
      count + impact.impactedEntities.filter(e => e.priority === 'high' || e.priority === 'critical').length,
      0
    );

    // Estimation empirique basée sur l'historique de synchronisation
    const estimatedSyncDuration = totalEntitiesRequiringSync * 1500; // 1.5s par entité en moyenne

    const result: ChangeDetectionResult = {
      detectedChanges,
      cascadeImpacts,
      totalEntitiesRequiringSync,
      highPriorityImpacts,
      estimatedSyncDuration
    };

    const detectionDuration = Date.now() - startTime;
    logger.info(`Cascade detection completed in ${detectionDuration}ms. Found ${detectedChanges.length} changes with ${cascadeImpacts.length} cascade impacts`);
    
    return result;
  }

  /**
   * Détecte les changements pour un type d'entité spécifique
   */
  private async detectChangesForEntity(entityType: EntityType): Promise<EntityChange[]> {
    const watermark = await prisma.syncWatermark.findUnique({
      where: { entityType }
    });

    const since = watermark?.lastSyncAt || new Date('2020-01-01');
    const changes: EntityChange[] = [];

    try {
      switch (entityType) {
        case 'CONTACT':
          return await this.detectContactChanges(since);
        
        case 'COMPANY':
          return await this.detectCompanyChanges(since);
        
        case 'INVOICE':
          return await this.detectInvoiceChanges(since);
        
        case 'LINE_ITEM':
          return await this.detectLineItemChanges(since);
        
        default:
          logger.warn(`Unsupported entity type for change detection: ${entityType}`);
          return [];
      }
    } catch (error) {
      logger.error(`Error detecting changes for ${entityType}:`, error);
      return [];
    }
  }

  /**
   * Détecte les changements de contacts
   */
  private async detectContactChanges(since: Date): Promise<EntityChange[]> {
    // Récupérer les contacts existants modifiés
    const existingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { hubspotUpdatedAt: { gt: since } },
          { lastSyncAt: { gt: since } }
        ]
      }
    });

    return existingContacts.map(contact => ({
      entityType: 'CONTACT' as EntityType,
      entityId: contact.id,
      hubspotId: contact.hubspotContactId,
      changeType: 'updated' as const,
      modificationDate: contact.hubspotUpdatedAt || contact.updatedAt,
      currentData: contact
    }));
  }

  /**
   * Détecte les changements d'entreprises
   */
  private async detectCompanyChanges(since: Date): Promise<EntityChange[]> {
    const existingCompanies = await prisma.company.findMany({
      where: {
        OR: [
          { hubspotUpdatedAt: { gt: since } },
          { lastSyncAt: { gt: since } }
        ]
      }
    });

    return existingCompanies.map(company => ({
      entityType: 'COMPANY' as EntityType,
      entityId: company.id,
      hubspotId: company.hubspotCompanyId,
      changeType: 'updated' as const,
      modificationDate: company.hubspotUpdatedAt || company.updatedAt,
      currentData: company
    }));
  }

  /**
   * Détecte les changements de factures
   */
  private async detectInvoiceChanges(since: Date): Promise<EntityChange[]> {
    const existingInvoices = await prisma.invoiceMapping.findMany({
      where: {
        OR: [
          { hubspotModifiedAt: { gt: since } },
          { lastSyncAt: { gt: since } }
        ]
      }
    });

    return existingInvoices.map(invoice => ({
      entityType: 'INVOICE' as EntityType,
      entityId: invoice.id,
      hubspotId: invoice.hubspotInvoiceId || invoice.hubspotDealId || '',
      changeType: 'updated' as const,
      modificationDate: invoice.hubspotModifiedAt || invoice.updatedAt,
      currentData: invoice
    }));
  }

  /**
   * Détecte les changements de line items
   */
  private async detectLineItemChanges(since: Date): Promise<EntityChange[]> {
    const existingLineItems = await prisma.lineItem.findMany({
      where: {
        OR: [
          { hubspotUpdatedAt: { gt: since } },
          { lastSyncAt: { gt: since } }
        ]
      }
    });

    return existingLineItems.map(lineItem => ({
      entityType: 'LINE_ITEM' as EntityType,
      entityId: lineItem.id,
      hubspotId: lineItem.hubspotLineItemId,
      changeType: 'updated' as const,
      modificationDate: lineItem.hubspotUpdatedAt || lineItem.updatedAt,
      currentData: lineItem
    }));
  }

  /**
   * Analyse l'impact en cascade d'un changement spécifique
   */
  private async analyzeCascadeImpact(change: EntityChange): Promise<CascadeImpact> {
    const impactedEntities = [];

    switch (change.entityType) {
      case 'CONTACT':
        impactedEntities.push(...await this.analyzeContactCascade(change));
        break;
      
      case 'COMPANY':
        impactedEntities.push(...await this.analyzeCompanyCascade(change));
        break;
      
      case 'INVOICE':
        impactedEntities.push(...await this.analyzeInvoiceCascade(change));
        break;
      
      case 'LINE_ITEM':
        impactedEntities.push(...await this.analyzeLineItemCascade(change));
        break;
    }

    return {
      sourceChange: change,
      impactedEntities,
      totalImpactedEntities: impactedEntities.length,
      cascadeDepth: this.calculateCascadeDepth(impactedEntities)
    };
  }

  /**
   * Analyse l'impact cascade d'un changement de contact
   */
  private async analyzeContactCascade(change: EntityChange) {
    const impacts = [];
    
    // Trouver toutes les factures associées à ce contact
    const associatedInvoices = await prisma.invoiceAssociation.findMany({
      where: { 
        contact: {
          hubspotContactId: change.hubspotId
        }
      },
      include: {
        invoice: true,
        company: true
      }
    });

    for (const association of associatedInvoices) {
      impacts.push({
        entityType: 'INVOICE' as EntityType,
        entityId: association.invoice.id,
        hubspotId: association.invoice.hubspotInvoiceId || association.invoice.hubspotDealId || '',
        impactReason: 'Contact modification may affect invoice contact details',
        requiresSync: true,
        priority: association.isPrimaryContact ? 'high' as const : 'medium' as const
      });

      // Si c'est le contact principal, vérifier les line items
      if (association.isPrimaryContact) {
        const lineItems = await prisma.lineItem.findMany({
          where: { invoiceId: association.invoice.id }
        });

        for (const lineItem of lineItems) {
          impacts.push({
            entityType: 'LINE_ITEM' as EntityType,
            entityId: lineItem.id,
            hubspotId: lineItem.hubspotLineItemId,
            impactReason: 'Primary contact change affects line item billing information',
            requiresSync: true,
            priority: 'medium' as const
          });
        }
      }
    }

    return impacts;
  }

  /**
   * Analyse l'impact cascade d'un changement d'entreprise
   */
  private async analyzeCompanyCascade(change: EntityChange) {
    const impacts = [];
    
    // Trouver toutes les factures associées à cette entreprise
    const associatedInvoices = await prisma.invoiceAssociation.findMany({
      where: { 
        company: {
          hubspotCompanyId: change.hubspotId
        }
      },
      include: {
        invoice: true,
        contact: true
      }
    });

    for (const association of associatedInvoices) {
      impacts.push({
        entityType: 'INVOICE' as EntityType,
        entityId: association.invoice.id,
        hubspotId: association.invoice.hubspotInvoiceId || association.invoice.hubspotDealId || '',
        impactReason: 'Company modification may affect invoice billing details',
        requiresSync: true,
        priority: association.isPrimaryCompany ? 'high' as const : 'medium' as const
      });

      // Si c'est l'entreprise principale, impact élevé sur les contacts
      if (association.isPrimaryCompany && association.contact) {
        impacts.push({
          entityType: 'CONTACT' as EntityType,
          entityId: association.contact.id,
          hubspotId: association.contact.hubspotContactId,
          impactReason: 'Primary company change affects contact company association',
          requiresSync: true,
          priority: 'medium' as const
        });
      }
    }

    return impacts;
  }

  /**
   * Analyse l'impact cascade d'un changement de facture
   */
  private async analyzeInvoiceCascade(change: EntityChange) {
    const impacts = [];
    
    // Toutes les line items associées
    const lineItems = await prisma.lineItem.findMany({
      where: { 
        invoice: {
          OR: [
            { hubspotInvoiceId: change.hubspotId },
            { hubspotDealId: change.hubspotId }
          ]
        }
      }
    });

    for (const lineItem of lineItems) {
      impacts.push({
        entityType: 'LINE_ITEM' as EntityType,
        entityId: lineItem.id,
        hubspotId: lineItem.hubspotLineItemId,
        impactReason: 'Invoice modification may require line items recalculation',
        requiresSync: true,
        priority: 'high' as const
      });
    }

    // Associations avec contacts/entreprises
    const associations = await prisma.invoiceAssociation.findMany({
      where: { 
        invoice: {
          OR: [
            { hubspotInvoiceId: change.hubspotId },
            { hubspotDealId: change.hubspotId }
          ]
        }
      },
      include: {
        contact: true,
        company: true
      }
    });

    for (const association of associations) {
      if (association.contact) {
        impacts.push({
          entityType: 'CONTACT' as EntityType,
          entityId: association.contact.id,
          hubspotId: association.contact.hubspotContactId,
          impactReason: 'Invoice status change may affect contact payment history',
          requiresSync: false,
          priority: 'low' as const
        });
      }

      if (association.company) {
        impacts.push({
          entityType: 'COMPANY' as EntityType,
          entityId: association.company.id,
          hubspotId: association.company.hubspotCompanyId,
          impactReason: 'Invoice status change may affect company billing summary',
          requiresSync: false,
          priority: 'low' as const
        });
      }
    }

    return impacts;
  }

  /**
   * Analyse l'impact cascade d'un changement de line item
   */
  private async analyzeLineItemCascade(change: EntityChange) {
    const impacts = [];
    
    // Facture parent
    const lineItem = await prisma.lineItem.findUnique({
      where: { hubspotLineItemId: change.hubspotId },
      include: { invoice: true }
    });

    if (lineItem?.invoice) {
      impacts.push({
        entityType: 'INVOICE' as EntityType,
        entityId: lineItem.invoice.id,
        hubspotId: lineItem.invoice.hubspotInvoiceId || lineItem.invoice.hubspotDealId || '',
        impactReason: 'Line item change requires invoice total recalculation',
        requiresSync: true,
        priority: 'critical' as const
      });

      // Tax summary si elle existe
      const taxSummary = await prisma.taxSummary.findUnique({
        where: { invoiceId: lineItem.invoice.id }
      });

      if (taxSummary) {
        impacts.push({
          entityType: 'INVOICE' as EntityType,
          entityId: lineItem.invoice.id,
          hubspotId: lineItem.invoice.hubspotInvoiceId || lineItem.invoice.hubspotDealId || '',
          impactReason: 'Line item change requires tax summary recalculation',
          requiresSync: true,
          priority: 'critical' as const
        });
      }
    }

    return impacts;
  }

  /**
   * Calcule la profondeur de cascade (nombre de niveaux d'impact)
   */
  private calculateCascadeDepth(impacts: any[]): number {
    const entityTypes = new Set(impacts.map(impact => impact.entityType));
    return entityTypes.size;
  }

  /**
   * Obtient un résumé des changements par type d'entité
   */
  async getChangesSummary(since?: Date): Promise<{
    [key in EntityType]?: {
      changeCount: number;
      lastChange: Date | null;
      criticalChanges: number;
      estimatedSyncTime: number;
    }
  }> {
    const summary: any = {};
    const entityTypes: EntityType[] = ['CONTACT', 'COMPANY', 'INVOICE', 'LINE_ITEM'];

    for (const entityType of entityTypes) {
      const changes = await this.detectChangesForEntity(entityType);
      const criticalChanges = changes.filter(change => {
        // Facture et line items sont critiques par nature
        return entityType === 'INVOICE' || entityType === 'LINE_ITEM';
      }).length;

      summary[entityType] = {
        changeCount: changes.length,
        lastChange: changes.length > 0 
          ? changes.sort((a, b) => b.modificationDate.getTime() - a.modificationDate.getTime())[0].modificationDate
          : null,
        criticalChanges,
        estimatedSyncTime: changes.length * (entityType === 'LINE_ITEM' ? 2000 : 1500) // Line items plus lents
      };
    }

    return summary;
  }
}