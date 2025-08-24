import axios, { AxiosInstance } from 'axios';
import { getQuickBooksConfig } from '../config';
import { logger } from '../utils/logger';

export interface QuickBooksCustomer {
  Id?: string;
  Name: string;
  DisplayName: string;  // Required field in QuickBooks
  CompanyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

export interface QuickBooksInvoice {
  Id?: string;
  DocNumber?: string;
  CustomerRef: {
    value: string;
    name?: string;
  };
  Line: Array<{
    Amount: number;
    DetailType: 'SalesItemLineDetail';
    SalesItemLineDetail: {
      ItemRef?: {
        value: string;
        name?: string;
      };
      UnitPrice?: number;
      Qty?: number;
    };
    Description?: string;
  }>;
  TotalAmt: number;
  CurrencyRef?: {
    value: string;
  };
  DueDate?: string;
  TxnDate?: string;
  PrivateNote?: string;
}

export class QuickBooksService {
  private client: AxiosInstance;
  private config: ReturnType<typeof getQuickBooksConfig>;

  constructor() {
    this.config = getQuickBooksConfig();
    
    if (!this.config.accessToken || !this.config.companyId) {
      logger.warn('QuickBooks service initialized without access token or company ID');
    }

    this.client = axios.create({
      baseURL: `${this.config.sandboxBaseUrl}/v3/company/${this.config.companyId}`,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Request interceptor for logging
    this.client.interceptors.request.use((config) => {
      logger.info(`QuickBooks API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Response interceptor for error handling and automatic token refresh
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`QuickBooks API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        // Safely log error without circular references
        const errorInfo = {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        };
        logger.error('QuickBooks API Error:', errorInfo);

        // Handle authentication errors with automatic token refresh
        const isAuthError = error.response?.status === 401 || 
                           error.response?.status === 403 ||
                           (error.response?.data && 
                            (error.response.data.Fault?.Error?.[0]?.code === '3200' ||
                             error.response.data.Fault?.Error?.[0]?.Detail?.includes('Authentication failed') ||
                             error.message?.includes('Authentication failed')));

        if (isAuthError && this.config.refreshToken) {
          try {
            logger.info('QuickBooks access token expired, attempting refresh...');
            await this.refreshAccessToken();
            
            // Retry the original request with new token
            const originalRequest = error.config;
            if (originalRequest && !originalRequest._retried) {
              originalRequest._retried = true;
              originalRequest.headers.Authorization = `Bearer ${this.config.accessToken}`;
              logger.info('Retrying QuickBooks request with refreshed token');
              return this.client.request(originalRequest);
            }
          } catch (refreshError) {
            logger.error('Failed to refresh QuickBooks access token:', refreshError);
            // Fall through to original error
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Test connection to QuickBooks API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/companyinfo/1');
      logger.info('QuickBooks connection test successful');
      return true;
    } catch (error) {
      logger.error('QuickBooks connection test failed:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      return false;
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo() {
    try {
      const response = await this.client.get('/companyinfo/1');
      logger.info('Company info response:', JSON.stringify(response.data, null, 2));
      
      // Handle different response structures
      if (response.data.QueryResponse && response.data.QueryResponse.CompanyInfo) {
        return response.data.QueryResponse.CompanyInfo[0];
      } else if (response.data.CompanyInfo) {
        return response.data.CompanyInfo[0];
      } else {
        return response.data;
      }
    } catch (error) {
      logger.error('Failed to get company info:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error('Failed to retrieve QuickBooks company information');
    }
  }

  /**
   * Search for existing customer by name or email
   */
  async findCustomer(name: string, email?: string): Promise<QuickBooksCustomer | null> {
    try {
      // Search by DisplayName first (QuickBooks uses DisplayName for search, not Name)
      const escapedName = name.replace(/'/g, "''"); // SQL proper escape
      let query = `SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`;
      let response = await this.client.get(`/query?query=${encodeURIComponent(query)}`);
      
      if (response.data.QueryResponse && response.data.QueryResponse.Customer && response.data.QueryResponse.Customer.length > 0) {
        return response.data.QueryResponse.Customer[0];
      }

      // Also try searching by Name field
      query = `SELECT * FROM Customer WHERE Name = '${escapedName}'`;
      response = await this.client.get(`/query?query=${encodeURIComponent(query)}`);
      
      if (response.data.QueryResponse && response.data.QueryResponse.Customer && response.data.QueryResponse.Customer.length > 0) {
        return response.data.QueryResponse.Customer[0];
      }

      // If no match by name and email provided, search by email
      if (email) {
        // Use proper email query format for QuickBooks  
        const escapedEmail = email.replace(/'/g, "''");
        query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapedEmail}'`;
        response = await this.client.get(`/query?query=${encodeURIComponent(query)}`);
        
        if (response.data.QueryResponse && response.data.QueryResponse.Customer && response.data.QueryResponse.Customer.length > 0) {
          return response.data.QueryResponse.Customer[0];
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find customer:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        data: error.response?.data
      });
      return null;
    }
  }

  /**
   * Create a new customer in QuickBooks
   */
  async createCustomer(customer: Omit<QuickBooksCustomer, 'Id'>): Promise<QuickBooksCustomer> {
    try {
      logger.info('Creating customer with data:', JSON.stringify(customer, null, 2));
      const response = await this.client.post('/customer', customer);
      
      // QuickBooks API returns different response structures
      let createdCustomer;
      if (response.data.QueryResponse && response.data.QueryResponse.Customer) {
        createdCustomer = response.data.QueryResponse.Customer[0];
      } else if (response.data.Customer) {
        createdCustomer = response.data.Customer;
      } else {
        createdCustomer = response.data;
      }
      
      logger.info(`Created QuickBooks customer: ${createdCustomer.Id} - ${createdCustomer.DisplayName || createdCustomer.Name}`);
      return createdCustomer;
    } catch (error) {
      logger.error('Failed to create customer. Request data:', JSON.stringify(customer, null, 2));
      logger.error('QuickBooks customer creation error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: JSON.stringify(error.response?.data, null, 2)
      });
      throw new Error('Failed to create QuickBooks customer');
    }
  }

  /**
   * Get or create customer (find existing or create new)
   */
  async getOrCreateCustomer(name: string, email?: string, phone?: string): Promise<QuickBooksCustomer> {
    // Try to find existing customer
    const existingCustomer = await this.findCustomer(name, email);
    if (existingCustomer) {
      logger.info(`Found existing QuickBooks customer: ${existingCustomer.Id} - ${existingCustomer.DisplayName || existingCustomer.Name}`);
      return existingCustomer;
    }

    // Create new customer - start with minimal working format, then add contact info
    const newCustomer: any = {
      DisplayName: name  // DisplayName is the only required field (working format)
    };

    // Add contact information when available
    if (email) {
      newCustomer.PrimaryEmailAddr = { Address: email };
      logger.info(`Adding email to customer: ${email}`);
    }

    if (phone) {
      newCustomer.PrimaryPhone = { FreeFormNumber: phone };
      logger.info(`Adding phone to customer: ${phone}`);
    }

    // Add company name for business entities
    if (name.includes('Corp') || name.includes('Inc') || name.includes('LLC') || name.includes('Ltd') || 
        name.includes('Corporation') || name.includes('Company') || name.includes('Co.') ||
        name.includes('Cie') || name.includes('Ltée') || name.includes('Limitée')) {
      newCustomer.CompanyName = name;
      logger.info(`Adding company name: ${name}`);
    }

    return await this.createCustomer(newCustomer);
  }

  /**
   * Find invoice by DocNumber in QuickBooks
   */
  async findInvoiceByDocNumber(docNumber: string): Promise<QuickBooksInvoice | null> {
    try {
      const escapedDocNumber = docNumber.replace(/'/g, "''");
      const query = `SELECT * FROM Invoice WHERE DocNumber = '${escapedDocNumber}'`;
      const response = await this.client.get(`/query?query=${encodeURIComponent(query)}`);
      
      if (response.data.QueryResponse && response.data.QueryResponse.Invoice && response.data.QueryResponse.Invoice.length > 0) {
        logger.info(`Found existing invoice with DocNumber ${docNumber}: ${response.data.QueryResponse.Invoice[0].Id}`);
        return response.data.QueryResponse.Invoice[0];
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to find invoice by DocNumber ${docNumber}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status
      });
      return null;
    }
  }

  /**
   * Create an invoice in QuickBooks
   */
  async createInvoice(invoice: Omit<QuickBooksInvoice, 'Id'>): Promise<QuickBooksInvoice> {
    try {
      // Check if invoice with this DocNumber already exists
      if (invoice.DocNumber) {
        const existingInvoice = await this.findInvoiceByDocNumber(invoice.DocNumber);
        if (existingInvoice) {
          logger.info(`Invoice with DocNumber ${invoice.DocNumber} already exists in QuickBooks with ID: ${existingInvoice.Id}`);
          logger.info('Returning existing invoice instead of creating duplicate');
          return existingInvoice;
        }
      }

      logger.info('Creating invoice with data:', JSON.stringify(invoice, null, 2));
      const response = await this.client.post('/invoice', invoice);
      
      // QuickBooks API returns different response structures
      let createdInvoice;
      if (response.data.QueryResponse && response.data.QueryResponse.Invoice) {
        createdInvoice = response.data.QueryResponse.Invoice[0];
      } else if (response.data.Invoice) {
        createdInvoice = response.data.Invoice;
      } else {
        createdInvoice = response.data;
      }
      
      logger.info(`Created QuickBooks invoice: ${createdInvoice.Id} - $${createdInvoice.TotalAmt}`);
      return createdInvoice;
    } catch (error) {
      logger.error('Failed to create invoice. Request data:');
      console.log('Invoice data:', JSON.stringify(invoice, null, 2));
      logger.error('QuickBooks invoice creation error response:');
      console.log('Error data:', JSON.stringify(error.response?.data, null, 2));
      logger.error('Error status:', error.response?.status);
      
      // Check if this is a duplicate document number error
      if (error.response?.data?.Fault?.Error?.[0]?.code === '6140') {
        logger.info('Handling duplicate document number error by retrieving existing invoice');
        
        // Try to find and return the existing invoice
        if (invoice.DocNumber) {
          const existingInvoice = await this.findInvoiceByDocNumber(invoice.DocNumber);
          if (existingInvoice) {
            logger.info(`Found existing invoice with DocNumber ${invoice.DocNumber}: ${existingInvoice.Id}`);
            return existingInvoice;
          }
        }
      }
      
      throw new Error(`Failed to create QuickBooks invoice: ${error.response?.data?.Fault?.Error?.[0]?.Message || 'Unknown error'}`);
    }
  }

  /**
   * Get invoice details by ID
   */
  async getInvoice(invoiceId: string): Promise<QuickBooksInvoice> {
    try {
      const response = await this.client.get(`/invoice/${invoiceId}`);
      return response.data.QueryResponse.Invoice[0];
    } catch (error) {
      logger.error(`Failed to get invoice ${invoiceId}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status
      });
      throw new Error('Failed to retrieve QuickBooks invoice');
    }
  }

  /**
   * Get available tax codes
   */
  async getTaxCodes(): Promise<any[]> {
    try {
      const query = `SELECT * FROM TaxCode WHERE Active = true`;
      const response = await this.client.get(`/query?query=${encodeURIComponent(query)}`);
      
      if (response.data.QueryResponse && response.data.QueryResponse.TaxCode) {
        const taxCodes = response.data.QueryResponse.TaxCode;
        logger.info(`Found ${taxCodes.length} tax codes:`);
        taxCodes.forEach(tc => {
          logger.info(`  ${tc.Id} - ${tc.Name} (Rate: ${tc.RatePercent}%, Taxable: ${tc.Taxable}, Active: ${tc.Active})`);
        });
        return taxCodes;
      }
      
      logger.info('No tax codes found in response');
      return [];
    } catch (error) {
      logger.error('Failed to get tax codes:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status
      });
      return [];
    }
  }

  /**
   * Get or create a default service item for invoices
   */
  async getDefaultServiceItem(): Promise<{ value: string; name: string }> {
    try {
      // First try to find an existing service item
      const query = `SELECT * FROM Item WHERE Type = 'Service' AND Active = true`;
      const response = await this.client.get(`/query?query=${encodeURIComponent(query)}`);
      
      logger.info('Service item query response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.QueryResponse && response.data.QueryResponse.Item && response.data.QueryResponse.Item.length > 0) {
        const item = response.data.QueryResponse.Item[0];
        logger.info(`Found existing service item: ${item.Id} - ${item.Name}`);
        return { value: item.Id, name: item.Name };
      }

      logger.info('No existing service items found, attempting to create default service item');

      // If no service item exists, create a default one
      const defaultService = {
        Name: 'General Service',
        Type: 'Service',
        IncomeAccountRef: {
          value: '1'  // Default income account ID
        }
      };

      const createResponse = await this.client.post('/item', defaultService);
      let createdItem;
      if (createResponse.data.QueryResponse && createResponse.data.QueryResponse.Item) {
        createdItem = createResponse.data.QueryResponse.Item[0];
      } else if (createResponse.data.Item) {
        createdItem = createResponse.data.Item;
      } else {
        createdItem = createResponse.data;
      }

      logger.info(`Created default service item: ${createdItem.Id} - ${createdItem.Name}`);
      return { value: createdItem.Id, name: createdItem.Name };

    } catch (error) {
      logger.error('Failed to get/create default service item:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Fall back to a generic item reference
      logger.warn('Using fallback item reference');
      return { value: '1', name: 'Services' };
    }
  }

  /**
   * Generate QuickBooks Online URL for invoice
   */
  getInvoiceUrl(invoiceId: string): string {
    const baseUrl = this.config.sandboxBaseUrl.includes('sandbox') 
      ? 'https://c2.qbo.intuit.com' 
      : 'https://qbo.intuit.com';
    return `${baseUrl}/app/invoice?txnId=${invoiceId}`;
  }

  /**
   * Refresh the QuickBooks access token using the refresh token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available for QuickBooks');
    }

    const tokenEndpoint = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken
    });

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    try {
      logger.info('Refreshing QuickBooks access token...');
      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      // Update the configuration with new tokens
      this.config.accessToken = response.data.access_token;
      if (response.data.refresh_token) {
        this.config.refreshToken = response.data.refresh_token;
      }

      // Update the axios client headers
      this.client.defaults.headers['Authorization'] = `Bearer ${this.config.accessToken}`;

      logger.info('QuickBooks access token refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh QuickBooks access token:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error('Failed to refresh QuickBooks access token');
    }
  }

  /**
   * Check if service is configured and ready
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && 
             this.config.clientSecret && 
             this.config.companyId && 
             this.config.accessToken);
  }
}

// Export singleton instance
export const quickbooksService = new QuickBooksService();