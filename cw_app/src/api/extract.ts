import { Router } from 'express';
import { ApiHandler } from '../types/api';
import { getInvoiceExtractor } from '../services/invoiceExtractor';
import { logger } from '../utils/logger';

export const extractRoutes = Router();

// HubSpot invoice extraction endpoint (legacy)
extractRoutes.post('/hubspot-invoices', async (req, res) => {
  try {
    logger.info('Starting HubSpot invoice extraction...');
    
    const extractor = getInvoiceExtractor();
    const stats = await extractor.performInitialInvoiceSync();
    
    logger.info(`Invoice extraction completed: ${stats.newInvoices} new, ${stats.updatedInvoices} updated`);

    res.json({
      success: true,
      message: 'HubSpot invoice extraction completed',
      data: {
        ...stats,
        source: 'hubspot-invoices-api',
        recommendation: 'Use this method for production - HubSpot Invoices API is more reliable than deals fallback'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('HubSpot invoice extraction failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Invoice extraction failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Normalized HubSpot invoice extraction endpoint 
extractRoutes.post('/hubspot-invoices-normalized', async (req, res) => {
  try {
    logger.info('Starting normalized HubSpot invoice extraction...');
    
    const { getNormalizedInvoiceExtractor } = await import('../services/normalizedInvoiceExtractor');
    const extractor = getNormalizedInvoiceExtractor();
    const stats = await extractor.performNormalizedExtraction();
    
    logger.info(`Normalized extraction completed: ${stats.newInvoices} new invoices, ${stats.newContacts} contacts, ${stats.newCompanies} companies`);

    res.json({
      success: true,
      message: 'Normalized HubSpot invoice extraction completed',
      data: {
        ...stats,
        source: 'hubspot-invoices-normalized',
        recommendation: 'This method uses normalized database structure for better data integrity'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Normalized invoice extraction failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Normalized invoice extraction failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced extraction on ALL invoices with line items and tax support
extractRoutes.post('/hubspot-invoices-enhanced', async (req, res) => {
  try {
    logger.info('Starting FULL enhanced HubSpot invoice extraction with line items and tax support...');
    
    const { getEnhancedInvoiceExtractor } = await import('../services/enhancedInvoiceExtractor');
    const extractor = getEnhancedInvoiceExtractor();
    const stats = await extractor.performEnhancedExtraction();
    
    logger.info(`Enhanced extraction completed: ${stats.newInvoices + stats.updatedInvoices} invoices processed, ${stats.newLineItems} line items, ${stats.taxSummariesCreated} tax summaries`);

    res.json({
      success: true,
      message: 'Enhanced HubSpot invoice extraction with line items and tax support completed',
      data: {
        ...stats,
        source: 'hubspot-invoices-enhanced-full',
        recommendation: 'This method provides complete invoice data with line items, tax details, and real currency detection'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Enhanced invoice extraction failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Enhanced invoice extraction failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test enhanced extraction on a single invoice
extractRoutes.post('/enhanced-extraction/:invoiceId', async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    logger.info(`Testing enhanced extraction for invoice ${invoiceId}...`);
    
    const { getEnhancedInvoiceExtractor } = await import('../services/enhancedInvoiceExtractor');
    const extractor = getEnhancedInvoiceExtractor();
    const { getHubSpotClient } = await import('../services/hubspotClient');
    const hubspotClient = getHubSpotClient();
    
    // Get the specific invoice from HubSpot
    const allInvoices = await hubspotClient.getAllInvoices();
    const invoice = allInvoices.find(inv => inv.id === invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice ${invoiceId} not found in HubSpot`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Create mock stats for single invoice processing
    const stats = {
      totalProcessed: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      newContacts: 0,
      updatedContacts: 0,
      newCompanies: 0,
      updatedCompanies: 0,
      newLineItems: 0,
      updatedLineItems: 0,
      taxSummariesCreated: 0,
      currenciesDetected: {} as Record<string, number>,
      errors: [] as string[],
      processingTime: 0,
      lastSyncTimestamp: new Date()
    };
    
    const startTime = Date.now();
    
    // Process single invoice with enhanced extractor
    const result = await (extractor as any)['processEnhancedInvoice'](invoice, stats);
    
    stats.processingTime = Date.now() - startTime;
    stats.totalProcessed = 1;
    
    if (result === 'created') stats.newInvoices = 1;
    else if (result === 'updated') stats.updatedInvoices = 1;
    else stats.skippedInvoices = 1;

    res.json({
      success: true,
      message: 'Enhanced extraction test completed',
      data: {
        invoiceId,
        result,
        invoiceNumber: invoice.properties.hs_invoice_number,
        extractionMethod: 'enhanced-with-line-items-and-taxes',
        ...stats
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Enhanced extraction test failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Enhanced extraction test failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});