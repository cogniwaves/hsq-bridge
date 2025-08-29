import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  accessToken?: string;
  refreshToken?: string;
  realmId?: string;
}

export interface QuickBooksCustomer {
  id?: string;
  name: string;
  companyName?: string;
  billAddr?: {
    line1?: string;
    city?: string;
    countrySubDivisionCode?: string;
    postalCode?: string;
    country?: string;
  };
  primaryEmailAddr?: {
    address: string;
  };
  primaryPhone?: {
    freeFormNumber: string;
  };
}

export interface QuickBooksItem {
  id?: string;
  name: string;
  type: 'Service' | 'Inventory' | 'NonInventory';
  incomeAccountRef?: {
    value: string;
  };
  unitPrice?: number;
  description?: string;
}

export interface QuickBooksInvoice {
  id?: string;
  customerRef: {
    value: string;
  };
  line: Array<{
    amount: number;
    detailType: 'SalesItemLineDetail';
    salesItemLineDetail: {
      itemRef?: {
        value: string;
      };
      qty?: number;
      unitPrice?: number;
      taxCodeRef?: {
        value: string;
      };
    };
    description?: string;
  }>;
  totalAmt?: number;
  currencyRef?: {
    value: string;
  };
  dueDate?: string;
  invoiceDate?: string;
  docNumber?: string;
  privateNote?: string;
  customerMemo?: {
    value: string;
  };
}

export interface QuickBooksAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  realmId: string;
}

/**
 * Client API QuickBooks pour gérer les transferts d'entités
 */
export class QuickBooksClient {
  private client: AxiosInstance;
  private config: QuickBooksConfig;
  private baseUrl: string;

  constructor(config: QuickBooksConfig) {
    this.config = config;
    this.baseUrl = config.sandbox 
      ? 'https://sandbox-quickbooks.api.intuit.com' 
      : 'https://quickbooks.api.intuit.com';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Interceptor pour ajouter l'authentification
    this.client.interceptors.request.use((config) => {
      if (this.config.accessToken) {
        config.headers.Authorization = `Bearer ${this.config.accessToken}`;
      }
      return config;
    });

    // Interceptor pour gérer le refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.config.refreshToken) {
          try {
            await this.refreshAccessToken();
            // Retry la requête originale
            const originalRequest = error.config;
            originalRequest.headers.Authorization = `Bearer ${this.config.accessToken}`;
            return this.client.request(originalRequest);
          } catch (refreshError) {
            logger.error('Failed to refresh QuickBooks access token:', refreshError);
            throw error;
          }
        }
        throw error;
      }
    );
  }

  /**
   * URL d'autorisation QuickBooks OAuth
   */
  getAuthUrl(state?: string): string {
    const scope = 'com.intuit.quickbooks.accounting';
    const redirectUri = encodeURIComponent(process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3000/auth/quickbooks/callback');
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
    
    return `https://appcenter.intuit.com/connect/oauth2?` +
           `client_id=${this.config.clientId}&` +
           `scope=${scope}&` +
           `redirect_uri=${redirectUri}&` +
           `response_type=code${stateParam}`;
  }

  /**
   * Échange le code d'autorisation contre des tokens
   */
  async exchangeCodeForTokens(authorizationCode: string, realmId: string): Promise<QuickBooksAuthTokens> {
    const tokenEndpoint = this.config.sandbox 
      ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
      : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3000/auth/quickbooks/callback'
    });

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    try {
      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens: QuickBooksAuthTokens = {
        ...response.data,
        realmId
      };

      // Mettre à jour la configuration
      this.config.accessToken = tokens.access_token;
      this.config.refreshToken = tokens.refresh_token;
      this.config.realmId = tokens.realmId;

      logger.info('QuickBooks tokens obtained successfully');
      return tokens;
    } catch (error) {
      logger.error('Failed to exchange authorization code for tokens:', error);
      throw new Error('Failed to obtain QuickBooks access tokens');
    }
  }

  /**
   * Refresh le token d'accès
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenEndpoint = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken
    });

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    try {
      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.config.accessToken = response.data.access_token;
      this.config.refreshToken = response.data.refresh_token;
      
      logger.info('QuickBooks access token refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh QuickBooks access token:', error);
      throw new Error('Failed to refresh QuickBooks access token');
    }
  }

  /**
   * Test de connexion à l'API QuickBooks
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.accessToken || !this.config.realmId) {
      logger.warn('QuickBooks not authenticated - missing access token or realm ID');
      return false;
    }

    try {
      const response = await this.client.get(
        `/v3/company/${this.config.realmId}/companyinfo/${this.config.realmId}`
      );
      
      logger.info('QuickBooks connection test successful');
      return true;
    } catch (error) {
      logger.error('QuickBooks connection test failed:', error);
      return false;
    }
  }

  /**
   * Crée un client dans QuickBooks
   */
  async createCustomer(customerData: QuickBooksCustomer): Promise<{ id: string; customer: any }> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const response = await this.client.post(
        `/v3/company/${this.config.realmId}/customer`,
        customerData
      );

      const customer = response.data.QueryResponse?.Customer?.[0] || response.data.Customer;
      logger.info(`Created QuickBooks customer: ${customer.Id} - ${customer.Name}`);
      
      return {
        id: customer.Id,
        customer: customer
      };
    } catch (error) {
      logger.error('Failed to create QuickBooks customer:', error);
      throw new Error(`Failed to create customer in QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recherche un client par nom ou email
   */
  async findCustomer(searchTerm: string): Promise<any[]> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const query = `SELECT * FROM Customer WHERE Name LIKE '%${searchTerm}%' OR PrimaryEmailAddr LIKE '%${searchTerm}%'`;
      const response = await this.client.get(
        `/v3/company/${this.config.realmId}/query?query=${encodeURIComponent(query)}`
      );

      const customers = response.data.QueryResponse?.Customer || [];
      logger.info(`Found ${customers.length} matching customers in QuickBooks`);
      
      return customers;
    } catch (error) {
      logger.error('Failed to search QuickBooks customers:', error);
      return [];
    }
  }

  /**
   * Get company information from QuickBooks
   */
  async getCompanyInfo(): Promise<any> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const response = await this.client.get(
        `/v3/company/${this.config.realmId}/companyinfo/1`
      );

      const companyInfo = response.data.CompanyInfo;
      logger.info('Retrieved QuickBooks company info:', companyInfo?.CompanyName);
      
      return companyInfo;
    } catch (error) {
      logger.error('Failed to get QuickBooks company info:', error);
      throw new Error(`Failed to get company info from QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Crée un article/service dans QuickBooks
   */
  async createItem(itemData: QuickBooksItem): Promise<{ id: string; item: any }> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const response = await this.client.post(
        `/v3/company/${this.config.realmId}/item`,
        itemData
      );

      const item = response.data.QueryResponse?.Item?.[0] || response.data.Item;
      logger.info(`Created QuickBooks item: ${item.Id} - ${item.Name}`);
      
      return {
        id: item.Id,
        item: item
      };
    } catch (error) {
      logger.error('Failed to create QuickBooks item:', error);
      throw new Error(`Failed to create item in QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Crée une facture dans QuickBooks
   */
  async createInvoice(invoiceData: QuickBooksInvoice): Promise<{ id: string; invoice: any }> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const response = await this.client.post(
        `/v3/company/${this.config.realmId}/invoice`,
        invoiceData
      );

      const invoice = response.data.QueryResponse?.Invoice?.[0] || response.data.Invoice;
      logger.info(`Created QuickBooks invoice: ${invoice.Id} - ${invoice.DocNumber}`);
      
      return {
        id: invoice.Id,
        invoice: invoice
      };
    } catch (error) {
      logger.error('Failed to create QuickBooks invoice:', error);
      throw new Error(`Failed to create invoice in QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Met à jour une facture existante dans QuickBooks
   */
  async updateInvoice(invoiceId: string, invoiceData: QuickBooksInvoice): Promise<{ id: string; invoice: any }> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      // D'abord récupérer la facture existante pour obtenir le SyncToken
      const existingInvoice = await this.getInvoice(invoiceId);
      const updatedData = {
        ...invoiceData,
        Id: invoiceId,
        SyncToken: existingInvoice.SyncToken
      };

      const response = await this.client.post(
        `/v3/company/${this.config.realmId}/invoice`,
        updatedData
      );

      const invoice = response.data.QueryResponse?.Invoice?.[0] || response.data.Invoice;
      logger.info(`Updated QuickBooks invoice: ${invoice.Id} - ${invoice.DocNumber}`);
      
      return {
        id: invoice.Id,
        invoice: invoice
      };
    } catch (error) {
      logger.error('Failed to update QuickBooks invoice:', error);
      throw new Error(`Failed to update invoice in QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère une facture par ID
   */
  async getInvoice(invoiceId: string): Promise<any> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const response = await this.client.get(
        `/v3/company/${this.config.realmId}/invoice/${invoiceId}`
      );

      const invoice = response.data.QueryResponse?.Invoice?.[0] || response.data.Invoice;
      return invoice;
    } catch (error) {
      logger.error(`Failed to get QuickBooks invoice ${invoiceId}:`, error);
      throw new Error(`Failed to retrieve invoice from QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Supprime une facture (non recommandé en production)
   */
  async deleteInvoice(invoiceId: string): Promise<boolean> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      // QuickBooks ne supporte généralement pas la suppression directe des factures
      // On peut les marquer comme "Void" ou "Deleted" selon la version
      const existingInvoice = await this.getInvoice(invoiceId);
      
      const voidData = {
        Id: invoiceId,
        SyncToken: existingInvoice.SyncToken,
        sparse: true,
        Void: true
      };

      await this.client.post(
        `/v3/company/${this.config.realmId}/invoice`,
        voidData
      );

      logger.info(`Voided QuickBooks invoice: ${invoiceId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to void QuickBooks invoice ${invoiceId}:`, error);
      throw new Error(`Failed to void invoice in QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Obtient les comptes de revenus disponibles
   */
  async getIncomeAccounts(): Promise<any[]> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const query = "SELECT * FROM Account WHERE AccountType = 'Income'";
      const response = await this.client.get(
        `/v3/company/${this.config.realmId}/query?query=${encodeURIComponent(query)}`
      );

      const accounts = response.data.QueryResponse?.Account || [];
      logger.info(`Found ${accounts.length} income accounts in QuickBooks`);
      
      return accounts;
    } catch (error) {
      logger.error('Failed to get QuickBooks income accounts:', error);
      return [];
    }
  }

  /**
   * Obtient les codes de taxe disponibles
   */
  async getTaxCodes(): Promise<any[]> {
    if (!this.config.realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    try {
      const query = "SELECT * FROM TaxCode";
      const response = await this.client.get(
        `/v3/company/${this.config.realmId}/query?query=${encodeURIComponent(query)}`
      );

      const taxCodes = response.data.QueryResponse?.TaxCode || [];
      logger.info(`Found ${taxCodes.length} tax codes in QuickBooks`);
      
      return taxCodes;
    } catch (error) {
      logger.error('Failed to get QuickBooks tax codes:', error);
      return [];
    }
  }

  /**
   * Met à jour les tokens de configuration
   */
  updateTokens(accessToken: string, refreshToken: string, realmId: string): void {
    this.config.accessToken = accessToken;
    this.config.refreshToken = refreshToken;
    this.config.realmId = realmId;
  }

  /**
   * Obtient les informations de configuration actuelles
   */
  getConfig(): QuickBooksConfig {
    return { ...this.config };
  }
}

// Instance singleton
let quickbooksClient: QuickBooksClient | null = null;

export function getQuickBooksClient(): QuickBooksClient {
  if (!quickbooksClient) {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
    const sandbox = process.env.QUICKBOOKS_SANDBOX === 'true';

    if (!clientId || !clientSecret) {
      throw new Error('QuickBooks client ID and secret must be configured in environment variables');
    }

    quickbooksClient = new QuickBooksClient({
      clientId,
      clientSecret,
      sandbox,
      accessToken: process.env.QUICKBOOKS_ACCESS_TOKEN,
      refreshToken: process.env.QUICKBOOKS_REFRESH_TOKEN,
      realmId: process.env.QUICKBOOKS_REALM_ID
    });
  }

  return quickbooksClient;
}

export { QuickBooksClient };