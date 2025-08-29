import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { 
  HubSpotInvoice, 
  HubSpotContact, 
  HubSpotCompany, 
  HubSpotLineItem,
  HubSpotDeal,
  HubSpotApiResponse,
  isHubSpotApiResponse 
} from '../types/hubspot';
import { HubSpotPaginationParams } from '../types/api';

// Re-export pour compatibilité (deprecated - utilisez les types de ../types/hubspot)
export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    closedate?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    dealstage?: string;
    pipeline?: string;
    hubspot_owner_id?: string;
    deal_currency_code?: string;
    description?: string;
    hs_deal_stage_probability?: string;
    [key: string]: string | undefined;
  };
  associations?: {
    contacts?: { id: string }[];
    companies?: { id: string }[];
  };
}

export interface HubSpotInvoiceObject {
  id: string;
  properties: {
    hs_invoice_number?: string;
    hs_invoice_amount?: string;
    hs_invoice_currency?: string;
    hs_invoice_status?: string;
    hs_invoice_date?: string;
    hs_invoice_due_date?: string;
    hs_invoice_description?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    [key: string]: string | undefined;
  };
  associations?: {
    contacts?: {
      results: { id: string; type: string }[];
    };
    companies?: {
      results: { id: string; type: string }[];
    };
    deals?: {
      results: { id: string; type: string }[];
    };
  };
}

export interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    jobtitle?: string;
    phone?: string;
    country?: string;
    city?: string;
    createdate?: string;
    lastmodifieddate?: string;
    [key: string]: string | undefined;
  };
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    industry?: string;
    country?: string;
    city?: string;
    state?: string;
    zip?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    [key: string]: string | undefined;
  };
}

export interface HubSpotLineItem {
  id: string;
  properties: {
    // Basic properties
    amount?: string;
    price?: string;
    quantity?: string;
    name?: string;
    hs_product_id?: string;
    hs_sku?: string;
    
    // Tax properties
    tax?: string;
    hs_tax_amount?: string;
    hs_tax_rate?: string;
    hs_tax_label?: string;
    hs_tax_category?: string;
    hs_line_item_currency_code?: string;
    hs_post_tax_amount?: string;
    hs_pre_discount_amount?: string;
    
    // Discount properties
    discount?: string;
    hs_discount_percentage?: string;
    hs_total_discount?: string;
    
    // Additional properties
    hs_external_tax_rate_id?: string;
    hs_effective_unit_price?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    [key: string]: string | undefined;
  };
}

export interface HubSpotInvoice {
  id: string;
  objectType: 'deal' | 'quote' | 'invoice';
  properties: {
    [key: string]: string | undefined;
  };
  associations?: {
    contacts?: { id: string }[];
    companies?: { id: string }[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  totalProcessed: number;
  newInvoices: number;
  updatedInvoices: number;
  errors: string[];
  lastSyncTimestamp: Date;
}

class HubSpotClient {
  private client: AxiosInstance;
  private rateLimitDelay = 100; // 100ms between requests (safe rate limiting)

  constructor(private apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.hubapi.com',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      await this.delay(this.rateLimitDelay);
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          logger.warn('HubSpot rate limit hit, increasing delay');
          this.rateLimitDelay = Math.min(this.rateLimitDelay * 2, 1000);
        }
        throw error;
      }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async paginate<T>(
    endpoint: string,
    params: HubSpotPaginationParams = {},
    limit = 100
  ): Promise<T[]> {
    const results: T[] = [];
    let after: string | undefined;

    do {
      const requestParams = {
        limit,
        ...params,
        ...(after && { after })
      };

      try {
        const response: AxiosResponse<{
          results: T[];
          paging?: { next?: { after?: string } };
        }> = await this.client.get(endpoint, { params: requestParams });

        results.push(...response.data.results);
        after = response.data.paging?.next?.after;

        logger.debug(`HubSpot API: Retrieved ${response.data.results.length} items from ${endpoint}`);
      } catch (error) {
        logger.error(`Error fetching from ${endpoint}:`, error);
        throw error;
      }
    } while (after);

    return results;
  }

  // Extraction complète de toutes les factures HubSpot
  async getAllInvoices(): Promise<HubSpotInvoiceObject[]> {
    logger.info('Starting extraction of all invoices from HubSpot');

    const properties = [
      'hs_invoice_number', 'hs_invoice_amount', 'hs_invoice_currency',
      'hs_invoice_status', 'hs_invoice_date', 'hs_invoice_due_date',
      'hs_invoice_description', 'createdate', 'hs_lastmodifieddate',
      // Additional amount-related properties that might contain the data
      'amount', 'total_amount', 'hs_total_amount', 'subtotal',
      'hs_subtotal', 'net_amount', 'gross_amount', 'line_total',
      'invoice_total', 'balance_due', 'hs_balance_due'
    ];

    const params = {
      properties: properties.join(','),
      associations: 'contacts,companies,deals'
    };

    const invoices = await this.paginate<HubSpotInvoiceObject>('/crm/v3/objects/invoices', params);

    logger.info(`Retrieved ${invoices.length} invoices from HubSpot`);
    return invoices;
  }

  // Extraction incrémentielle des factures modifiées depuis une date donnée
  async getInvoicesModifiedSince(timestamp: Date): Promise<HubSpotInvoiceObject[]> {
    logger.info(`Starting incremental extraction of invoices modified since ${timestamp.toISOString()}`);

    const properties = [
      'hs_invoice_number', 'hs_invoice_amount', 'hs_invoice_currency',
      'hs_invoice_status', 'hs_invoice_date', 'hs_invoice_due_date',
      'hs_invoice_description', 'createdate', 'hs_lastmodifieddate',
      'amount', 'total_amount', 'hs_total_amount', 'subtotal',
      'hs_subtotal', 'net_amount', 'gross_amount', 'line_total',
      'invoice_total', 'balance_due', 'hs_balance_due'
    ];

    const params = {
      properties: properties.join(','),
      associations: 'contacts,companies,deals'
    };

    // Récupérer toutes les factures puis filtrer (HubSpot API ne supporte pas le filtrage direct par date de modification)
    const allInvoices = await this.paginate<HubSpotInvoiceObject>('/crm/v3/objects/invoices', params);

    // Filtrer par date de modification
    const recentInvoices = allInvoices.filter(invoice => {
      const modifiedDate = invoice.properties.hs_lastmodifieddate;
      
      if (!modifiedDate) return false;
      
      const invoiceModified = new Date(parseInt(modifiedDate));
      return invoiceModified >= timestamp;
    });

    logger.info(`Retrieved ${recentInvoices.length} recently modified invoices out of ${allInvoices.length} total`);
    return recentInvoices;
  }

  // Extraction incrémentielle des contacts modifiés depuis une date donnée
  async getContactsModifiedSince(timestamp: Date): Promise<HubSpotContact[]> {
    logger.info(`Starting incremental extraction of contacts modified since ${timestamp.toISOString()}`);

    const properties = [
      'email', 'firstname', 'lastname', 'company', 'jobtitle', 'phone',
      'country', 'city', 'createdate', 'lastmodifieddate', 'hs_object_id'
    ];

    const params = {
      properties: properties.join(','),
      associations: 'companies,deals'
    };

    // Récupérer tous les contacts puis filtrer par date de modification
    const allContacts = await this.paginate<HubSpotContact>('/crm/v3/objects/contacts', params);

    // Filtrer par date de modification
    const recentContacts = allContacts.filter(contact => {
      const modifiedDate = contact.properties.lastmodifieddate;
      
      if (!modifiedDate) return false;
      
      const contactModified = new Date(parseInt(modifiedDate));
      return contactModified >= timestamp;
    });

    logger.info(`Retrieved ${recentContacts.length} recently modified contacts out of ${allContacts.length} total`);
    return recentContacts;
  }

  // Extraction incrémentielle des entreprises modifiées depuis une date donnée
  async getCompaniesModifiedSince(timestamp: Date): Promise<HubSpotCompany[]> {
    logger.info(`Starting incremental extraction of companies modified since ${timestamp.toISOString()}`);

    const properties = [
      'name', 'domain', 'industry', 'country', 'city', 'state', 'zip',
      'createdate', 'hs_lastmodifieddate', 'hs_object_id'
    ];

    const params = {
      properties: properties.join(','),
      associations: 'contacts,deals'
    };

    // Récupérer toutes les entreprises puis filtrer par date de modification
    const allCompanies = await this.paginate<HubSpotCompany>('/crm/v3/objects/companies', params);

    // Filtrer par date de modification
    const recentCompanies = allCompanies.filter(company => {
      const modifiedDate = company.properties.hs_lastmodifieddate;
      
      if (!modifiedDate) return false;
      
      const companyModified = new Date(parseInt(modifiedDate));
      return companyModified >= timestamp;
    });

    logger.info(`Retrieved ${recentCompanies.length} recently modified companies out of ${allCompanies.length} total`);
    return recentCompanies;
  }

  // Extraction incrémentielle des line items modifiés depuis une date donnée
  async getLineItemsModifiedSince(timestamp: Date): Promise<HubSpotLineItem[]> {
    logger.info(`Starting incremental extraction of line items modified since ${timestamp.toISOString()}`);

    const properties = [
      'amount', 'price', 'quantity', 'name', 'hs_product_id', 'hs_sku',
      'tax', 'hs_tax_amount', 'hs_tax_rate', 'hs_tax_label', 'hs_tax_category',
      'hs_line_item_currency_code', 'hs_post_tax_amount', 'hs_pre_discount_amount',
      'discount', 'hs_discount_percentage', 'hs_total_discount',
      'hs_external_tax_rate_id', 'hs_effective_unit_price',
      'createdate', 'hs_lastmodifieddate'
    ];

    const params = {
      properties: properties.join(',')
    };

    // Récupérer tous les line items puis filtrer par date de modification
    const allLineItems = await this.paginate<HubSpotLineItem>('/crm/v3/objects/line_items', params);

    // Filtrer par date de modification
    const recentLineItems = allLineItems.filter(lineItem => {
      const modifiedDate = lineItem.properties.hs_lastmodifieddate;
      
      if (!modifiedDate) return false;
      
      const lineItemModified = new Date(parseInt(modifiedDate));
      return lineItemModified >= timestamp;
    });

    logger.info(`Retrieved ${recentLineItems.length} recently modified line items out of ${allLineItems.length} total`);
    return recentLineItems;
  }

  // Extraction complète de tous les deals fermés (factures potentielles - fallback)
  async getAllClosedDeals(): Promise<HubSpotDeal[]> {
    logger.info('Starting extraction of all closed deals from HubSpot (fallback method)');

    const properties = [
      'dealname', 'amount', 'closedate', 'createdate', 'hs_lastmodifieddate',
      'dealstage', 'pipeline', 'hubspot_owner_id', 'deal_currency_code',
      'description', 'hs_deal_stage_probability'
    ];

    const params = {
      properties: properties.join(','),
      associations: 'contacts,companies'
    };

    const allDeals = await this.paginate<HubSpotDeal>('/crm/v3/objects/deals', params);

    // Filtrer seulement les deals fermés gagnés
    const closedDeals = allDeals.filter(deal => {
      const stage = deal.properties.dealstage?.toLowerCase();
      return stage?.includes('closed') && stage?.includes('won');
    });

    logger.info(`Retrieved ${closedDeals.length} closed deals out of ${allDeals.length} total deals`);
    return closedDeals;
  }

  // Extraction incrémentielle depuis une date donnée
  async getClosedDealsSince(timestamp: Date): Promise<HubSpotDeal[]> {
    logger.info(`Starting incremental extraction of deals since ${timestamp.toISOString()}`);

    const properties = [
      'dealname', 'amount', 'closedate', 'createdate', 'hs_lastmodifieddate',
      'dealstage', 'pipeline', 'hubspot_owner_id', 'deal_currency_code',
      'description', 'hs_deal_stage_probability'
    ];

    const params = {
      properties: properties.join(','),
      associations: 'contacts,companies'
    };

    const allDeals = await this.paginate<HubSpotDeal>('/crm/v3/objects/deals', params);

    // Filtrer par date de modification et statut fermé
    const recentClosedDeals = allDeals.filter(deal => {
      const modifiedDate = deal.properties.hs_lastmodifieddate;
      const stage = deal.properties.dealstage?.toLowerCase();
      
      if (!modifiedDate) return false;
      
      const dealModified = new Date(parseInt(modifiedDate));
      const isClosed = stage?.includes('closed') && stage?.includes('won');
      
      return dealModified >= timestamp && isClosed;
    });

    logger.info(`Retrieved ${recentClosedDeals.length} recently modified closed deals`);
    return recentClosedDeals;
  }

  // Récupération d'un deal spécifique par ID
  async getDeal(dealId: string): Promise<HubSpotDeal | null> {
    try {
      const properties = [
        'dealname', 'amount', 'closedate', 'createdate', 'hs_lastmodifieddate',
        'dealstage', 'pipeline', 'hubspot_owner_id', 'deal_currency_code',
        'description', 'hs_deal_stage_probability'
      ];

      const response = await this.client.get(`/crm/v3/objects/deals/${dealId}`, {
        params: {
          properties: properties.join(','),
          associations: 'contacts,companies'
        }
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn(`Deal ${dealId} not found in HubSpot`);
        return null;
      }
      logger.error(`Error fetching deal ${dealId}:`, error);
      throw error;
    }
  }

  // Récupération des contacts associés à un deal
  async getContactsForDeal(dealId: string): Promise<HubSpotContact[]> {
    try {
      const response = await this.client.get(`/crm/v3/objects/deals/${dealId}/associations/contacts`);
      const contactIds = response.data.results.map((assoc: { id: string }) => assoc.id);

      if (contactIds.length === 0) return [];

      const contacts = await Promise.all(
        contactIds.map((id: string) => this.getContact(id))
      );

      return contacts.filter(contact => contact !== null) as HubSpotContact[];
    } catch (error) {
      logger.error(`Error fetching contacts for deal ${dealId}:`, error);
      return [];
    }
  }

  // Récupération d'un contact par ID
  async getContact(contactId: string): Promise<HubSpotContact | null> {
    try {
      const response = await this.client.get(`/crm/v3/objects/contacts/${contactId}`, {
        params: {
          properties: 'email,firstname,lastname,company,jobtitle,phone,country,city,createdate,lastmodifieddate'
        }
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error(`Error fetching contact ${contactId}:`, error);
      throw error;
    }
  }

  // Récupération des entreprises associées à un deal
  async getCompaniesForDeal(dealId: string): Promise<HubSpotCompany[]> {
    try {
      const response = await this.client.get(`/crm/v3/objects/deals/${dealId}/associations/companies`);
      const companyIds = response.data.results.map((assoc: { id: string }) => assoc.id);

      if (companyIds.length === 0) return [];

      const companies = await Promise.all(
        companyIds.map((id: string) => this.getCompany(id))
      );

      return companies.filter(company => company !== null) as HubSpotCompany[];
    } catch (error) {
      logger.error(`Error fetching companies for deal ${dealId}:`, error);
      return [];
    }
  }

  // Récupération d'une entreprise par ID
  async getCompany(companyId: string): Promise<HubSpotCompany | null> {
    try {
      const response = await this.client.get(`/crm/v3/objects/companies/${companyId}`, {
        params: {
          properties: 'name,domain,industry,country,city,state,zip,createdate,hs_lastmodifieddate'
        }
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error(`Error fetching company ${companyId}:`, error);
      throw error;
    }
  }

  // Récupération des line items associés à une facture
  async getLineItemsForInvoice(invoiceId: string): Promise<HubSpotLineItem[]> {
    try {
      const response = await this.client.get(`/crm/v3/objects/invoices/${invoiceId}/associations/line_items`);
      const lineItemIds = response.data.results.map((assoc: { id: string }) => assoc.id);

      if (lineItemIds.length === 0) return [];

      const lineItems = await Promise.all(
        lineItemIds.map((id: string) => this.getLineItem(id))
      );

      return lineItems.filter(item => item !== null) as HubSpotLineItem[];
    } catch (error) {
      logger.error(`Error fetching line items for invoice ${invoiceId}:`, error);
      return [];
    }
  }

  // Récupération d'un line item par ID
  async getLineItem(lineItemId: string): Promise<HubSpotLineItem | null> {
    try {
      const properties = [
        // Basic properties
        'amount', 'price', 'quantity', 'name', 'hs_product_id', 'hs_sku',
        // Tax properties
        'tax', 'hs_tax_amount', 'hs_tax_rate', 'hs_tax_label', 'hs_tax_category',
        'hs_line_item_currency_code', 'hs_post_tax_amount', 'hs_pre_discount_amount',
        // Discount properties
        'discount', 'hs_discount_percentage', 'hs_total_discount',
        // Additional properties
        'hs_external_tax_rate_id', 'hs_effective_unit_price',
        'createdate', 'hs_lastmodifieddate'
      ];

      const response = await this.client.get(`/crm/v3/objects/line_items/${lineItemId}`, {
        params: {
          properties: properties.join(',')
        }
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error(`Error fetching line item ${lineItemId}:`, error);
      throw error;
    }
  }

  // Récupération de tous les line items (avec pagination)
  async getAllLineItems(): Promise<HubSpotLineItem[]> {
    logger.info('Starting extraction of all line items from HubSpot');

    const properties = [
      'amount', 'price', 'quantity', 'name', 'hs_product_id', 'hs_sku',
      'tax', 'hs_tax_amount', 'hs_tax_rate', 'hs_tax_label', 'hs_tax_category',
      'hs_line_item_currency_code', 'hs_post_tax_amount', 'hs_pre_discount_amount',
      'discount', 'hs_discount_percentage', 'hs_total_discount',
      'hs_external_tax_rate_id', 'hs_effective_unit_price',
      'createdate', 'hs_lastmodifieddate'
    ];

    const params = {
      properties: properties.join(',')
    };

    const lineItems = await this.paginate<HubSpotLineItem>('/crm/v3/objects/line_items', params);

    logger.info(`Retrieved ${lineItems.length} line items from HubSpot`);
    return lineItems;
  }

  // Transformation des deals en format facture unifié
  async transformDealsToInvoices(deals: HubSpotDeal[]): Promise<HubSpotInvoice[]> {
    const invoices: HubSpotInvoice[] = [];

    for (const deal of deals) {
      try {
        // Récupération des contacts et entreprises associés
        const contacts = await this.getContactsForDeal(deal.id);
        const companies = await this.getCompaniesForDeal(deal.id);

        const invoice: HubSpotInvoice = {
          id: deal.id,
          objectType: 'deal' as const,
          properties: {
            ...deal.properties,
            // Ajout des informations de contacts/entreprises
            primaryContactEmail: contacts[0]?.properties.email,
            primaryContactName: contacts[0] ? 
              `${contacts[0].properties.firstname || ''} ${contacts[0].properties.lastname || ''}`.trim() : 
              undefined,
            primaryCompanyName: companies[0]?.properties.name
          },
          associations: {
            contacts: contacts.map(c => ({ id: c.id })),
            companies: companies.map(c => ({ id: c.id }))
          },
          createdAt: deal.properties.createdate || new Date().toISOString(),
          updatedAt: deal.properties.hs_lastmodifieddate || new Date().toISOString()
        };

        invoices.push(invoice);
      } catch (error) {
        logger.error(`Error transforming deal ${deal.id} to invoice:`, error);
      }
    }

    return invoices;
  }

  // Test de connexion à l'API HubSpot
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/account-info/v3/details');
      logger.info('HubSpot connection successful');
      return true;
    } catch (error) {
      logger.error('HubSpot connection failed:', error);
      return false;
    }
  }

  /**
   * Test connection with a specific API key
   * Used for validating credentials before saving configuration
   */
  async testConnectionWithKey(apiKey: string): Promise<{
    success: boolean;
    message?: string;
    portalId?: string;
    scopes?: string[];
    apiCalls?: {
      used: number;
      limit: number;
    };
  }> {
    try {
      // Create a temporary client with the provided API key
      const testClient = axios.create({
        baseURL: 'https://api.hubapi.com',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });

      // Test the connection with account info endpoint
      const response = await testClient.get('/account-info/v3/details');
      
      // Extract portal ID from the response
      const portalId = response.data?.portalId || response.data?.hub_id;
      
      // Try to get access token info for scopes
      let scopes: string[] = [];
      let apiCalls = { used: 0, limit: 0 };
      
      try {
        const tokenInfo = await testClient.get('/oauth/v1/access-tokens/' + apiKey.substring(7, 43));
        scopes = tokenInfo.data?.scopes || [];
      } catch {
        // Token info endpoint may not be available for all API keys
        // Try to extract from headers if available
        if (response.headers['x-hubspot-api-usage']) {
          const usage = response.headers['x-hubspot-api-usage'];
          const match = usage.match(/(\d+)\/(\d+)/);
          if (match) {
            apiCalls = {
              used: parseInt(match[1]),
              limit: parseInt(match[2])
            };
          }
        }
      }

      logger.info('HubSpot API key validation successful', { portalId });
      
      return {
        success: true,
        message: 'Connection successful',
        portalId: portalId?.toString(),
        scopes,
        apiCalls
      };
    } catch (error: any) {
      logger.error('HubSpot API key validation failed:', error.response?.data || error.message);
      
      let message = 'Connection failed';
      
      if (error.response?.status === 401) {
        message = 'Invalid API key - authentication failed';
      } else if (error.response?.status === 403) {
        message = 'API key lacks required permissions';
      } else if (error.response?.status === 429) {
        message = 'Rate limit exceeded - too many requests';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        message = 'Unable to connect to HubSpot API';
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      
      return {
        success: false,
        message
      };
    }
  }
}

// Instance singleton
let hubspotClient: HubSpotClient | null = null;

export function getHubSpotClient(): HubSpotClient {
  if (!hubspotClient) {
    const apiKey = process.env.HUBSPOT_API_KEY;
    if (!apiKey) {
      throw new Error('HUBSPOT_API_KEY environment variable is required');
    }
    hubspotClient = new HubSpotClient(apiKey);
  }
  return hubspotClient;
}

export { HubSpotClient };