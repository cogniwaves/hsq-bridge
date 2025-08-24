import { Router } from 'express';
import { ApiHandler } from '../types/api';
import { getHubSpotClient } from '../services/hubspotClient';
import { getInvoiceExtractor } from '../services/invoiceExtractor';
import { logger } from '../utils/logger';
import { HubSpotContact, HubSpotCompany } from '../types/hubspot';

export const testRoutes = Router();

// Test HubSpot connection endpoint (uses Invoices first, falls back to Deals)
testRoutes.get('/hubspot', (async (req, res) => {
  try {
    logger.info('Testing HubSpot connection...');
    
    const hubspotClient = getHubSpotClient();
    const isConnected = await hubspotClient.testConnection();
    
    if (!isConnected) {
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to HubSpot API',
        error: 'Connection test failed',
        timestamp: new Date().toISOString()
      });
    }

    // Try to get invoices first
    let invoicesData = null;
    let dealsData = null;

    try {
      const invoices = await hubspotClient.getAllInvoices();
      invoicesData = {
        count: invoices.length,
        sampleInvoice: invoices.length > 0 ? {
          id: invoices[0].id,
          number: invoices[0].properties.hs_invoice_number,
          amount: invoices[0].properties.hs_invoice_amount,
          currency: invoices[0].properties.hs_invoice_currency,
          status: invoices[0].properties.hs_invoice_status,
          date: invoices[0].properties.hs_invoice_date
        } : null
      };
      logger.info(`HubSpot connection successful - found ${invoices.length} invoices`);
    } catch (invoiceError) {
      logger.warn('Cannot access invoices, trying deals as fallback:', (invoiceError as any)?.response?.status || (invoiceError as Error).message);
      
      // Fallback to deals
      try {
        const sampleDeals = await hubspotClient.getAllClosedDeals();
        dealsData = {
          count: sampleDeals.length,
          sampleDeal: sampleDeals.length > 0 ? {
            id: sampleDeals[0].id,
            name: sampleDeals[0].properties.dealname,
            amount: sampleDeals[0].properties.amount,
            stage: sampleDeals[0].properties.dealstage,
            closeDate: sampleDeals[0].properties.closedate
          } : null
        };
        logger.info(`HubSpot connection successful - found ${sampleDeals.length} closed deals (fallback)`);
      } catch (dealError) {
        throw dealError; // Re-throw the deal error if both fail
      }
    }

    res.json({
      success: true,
      message: 'HubSpot connection successful',
      data: {
        connected: true,
        apiKeyValid: true,
        invoices: invoicesData,
        deals: dealsData,
        recommendation: invoicesData 
          ? 'Using HubSpot Invoices (recommended)' 
          : 'Using Deals as invoices (fallback)'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('HubSpot connection test failed:', error);
    
    // Determine error type for better user feedback
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;
    
    if ((error as any).response?.status === 401) {
      errorMessage = 'Invalid HubSpot API key - check your HUBSPOT_API_KEY environment variable';
      statusCode = 401;
    } else if ((error as any).response?.status === 403) {
      errorMessage = 'HubSpot API key needs scopes: crm.objects.invoices.read OR crm.objects.deals.read';
      statusCode = 403;
    } else if ((error as any).code === 'ENOTFOUND' || (error as any).code === 'ECONNREFUSED') {
      errorMessage = 'Cannot reach HubSpot API - check internet connection';
      statusCode = 502;
    }

    res.status(statusCode).json({
      success: false,
      message: 'HubSpot connection test failed',
      error: errorMessage,
      details: {
        errorCode: (error as any).response?.status || (error as any).code,
        errorMessage: (error as Error).message,
        requiredScopes: ['crm.objects.invoices.read', 'crm.objects.contacts.read', 'crm.objects.companies.read']
      },
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);

// Test comprehensive data extraction (single invoice)
testRoutes.post('/extract-comprehensive', (async (req, res) => {
  try {
    logger.info('Testing comprehensive data extraction...');
    
    const extractor = getInvoiceExtractor();
    const hubspotClient = getHubSpotClient();
    
    // Get first invoice from HubSpot
    const allInvoices = await hubspotClient.getAllInvoices();
    if (allInvoices.length === 0) {
      return res.json({
        success: false,
        message: 'No invoices found in HubSpot',
        timestamp: new Date().toISOString()
      });
    }

    const testInvoice = allInvoices[0];
    logger.info(`Testing comprehensive extraction on invoice ${testInvoice.id}`);
    logger.info(`Invoice associations: ${JSON.stringify(testInvoice.associations, null, 2)}`);

    // Test the association data retrieval first
    const [contactDetails, companyDetails] = await (extractor as any)['getAssociatedData'](testInvoice);
    
    logger.info(`Found ${contactDetails.length} contacts and ${companyDetails.length} companies for invoice ${testInvoice.id}`);
    
    // Test the comprehensive extraction method
    const result = await (extractor as any)['processHubSpotInvoice'](testInvoice, 'test-comprehensive');
    
    res.json({
      success: true,
      message: 'Comprehensive extraction test completed',
      data: {
        testInvoiceId: testInvoice.id,
        result,
        invoiceNumber: testInvoice.properties.hs_invoice_number,
        extractionMethod: 'comprehensive-with-contacts-companies',
        associationsFound: {
          contacts: contactDetails.length,
          companies: companyDetails.length,
          contactDetails: contactDetails.map((c: HubSpotContact) => ({ id: c?.id, email: c?.properties?.email })),
          companyDetails: companyDetails.map((c: HubSpotCompany) => ({ id: c?.id, name: c?.properties?.name }))
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Comprehensive extraction test failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Comprehensive extraction test failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);

// Test normalized extraction on a few invoices
testRoutes.post('/extract-normalized', (async (req, res) => {
  try {
    logger.info('Testing normalized extraction on 5 invoices...');
    
    const { getNormalizedInvoiceExtractor } = await import('../services/normalizedInvoiceExtractor');
    const extractor = getNormalizedInvoiceExtractor();
    
    // Modify extractor to process only first 5 invoices for testing
    const hubspotClient = await import('../services/hubspotClient');
    const client = hubspotClient.getHubSpotClient();
    const allInvoices = await client.getAllInvoices();
    const testInvoices = allInvoices.slice(0, 5);
    
    logger.info(`Testing with ${testInvoices.length} invoices`);
    
    // Create a custom stats object for testing
    const stats = {
      totalProcessed: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      newContacts: 0,
      updatedContacts: 0,
      newCompanies: 0,
      updatedCompanies: 0,
      errors: [] as string[],
      processingTime: 0,
      lastSyncTimestamp: new Date()
    };
    
    const startTime = Date.now();
    
    for (const invoice of testInvoices) {
      try {
        const result = await (extractor as any)['processNormalizedInvoice'](invoice, stats);
        if (result === 'created') stats.newInvoices++;
        else if (result === 'updated') stats.updatedInvoices++;
        else stats.skippedInvoices++;
        stats.totalProcessed++;
      } catch (error) {
        stats.errors.push(`Failed to process invoice ${invoice.id}: ${error}`);
      }
    }
    
    stats.processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Normalized extraction test completed',
      data: {
        ...stats,
        source: 'normalized-test',
        testInvoices: testInvoices.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Normalized extraction test failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Normalized extraction test failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);

// Test line items extraction for a specific invoice
testRoutes.get('/line-items/:invoiceId', (async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;
    logger.info(`Testing line items extraction for invoice ${invoiceId}...`);
    
    const hubspotClient = getHubSpotClient();
    
    // Get line items for this invoice
    const lineItems = await hubspotClient.getLineItemsForInvoice(invoiceId);
    
    // Calculate tax summary
    let totalTaxAmount = 0;
    let detectedCurrency = null;
    const taxBreakdown: Record<string, { rate: number, amount: number }> = {};
    
    for (const item of lineItems) {
      if (item.properties.hs_line_item_currency_code && !detectedCurrency) {
        detectedCurrency = item.properties.hs_line_item_currency_code;
      }
      
      if (item.properties.hs_tax_amount) {
        const taxAmount = parseFloat(item.properties.hs_tax_amount);
        totalTaxAmount += taxAmount;
        
        if (item.properties.hs_tax_label && taxAmount > 0) {
          const taxLabel = item.properties.hs_tax_label;
          const taxRate = item.properties.hs_tax_rate ? parseFloat(item.properties.hs_tax_rate) : 0;
          
          if (!taxBreakdown[taxLabel]) {
            taxBreakdown[taxLabel] = { rate: taxRate, amount: 0 };
          }
          taxBreakdown[taxLabel].amount += taxAmount;
        }
      }
    }

    res.json({
      success: true,
      message: 'Line items extraction test completed',
      data: {
        invoiceId,
        lineItemsCount: lineItems.length,
        detectedCurrency,
        totalTaxAmount,
        taxBreakdown,
        lineItems: lineItems.map(item => ({
          id: item.id,
          name: item.properties.name,
          quantity: item.properties.quantity,
          price: item.properties.price,
          amount: item.properties.amount,
          currency: item.properties.hs_line_item_currency_code,
          taxAmount: item.properties.hs_tax_amount,
          taxRate: item.properties.hs_tax_rate,
          taxLabel: item.properties.hs_tax_label,
          discountPercentage: item.properties.hs_discount_percentage,
          totalDiscount: item.properties.hs_total_discount
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Line items test failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Line items test failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);