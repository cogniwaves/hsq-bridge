import axios, { AxiosInstance, AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { TokenManager, TokenRefreshConfig } from './auth/tokenManager';
import { getQuickBooksConfig } from '../config';
import { logger } from '../utils/logger';
import { CryptoUtils } from '../utils/crypto';

/**
 * Enhanced QuickBooks Service with automatic token refresh
 */
export class QuickBooksEnhancedService {
  private client: AxiosInstance;
  private tokenManager: TokenManager;
  private config: ReturnType<typeof getQuickBooksConfig>;
  private refreshConfig: TokenRefreshConfig;
  private tenantId: string;
  private requestQueue: Map<string, Promise<any>> = new Map();
  
  // Rate limiting
  private requestCount: number = 0;
  private requestResetTime: Date = new Date();
  private readonly MAX_REQUESTS_PER_MINUTE = 500; // QuickBooks API limit

  constructor(
    prisma: PrismaClient,
    redis?: Redis,
    tenantId: string = 'default'
  ) {
    this.config = getQuickBooksConfig();
    this.tenantId = tenantId;
    
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('QuickBooks client credentials not configured');
    }

    // Initialize token manager
    this.tokenManager = new TokenManager(prisma, redis);

    // Set up refresh configuration
    this.refreshConfig = {
      provider: 'quickbooks',
      tenantId: this.tenantId,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      tokenEndpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      refreshBeforeExpiry: 30, // 30 minutes
      maxRetries: 3,
      retryDelay: 1000,
      enableAutoRefresh: true,
      enableCircuitBreaker: true
    };

    // Initialize axios client
    this.client = axios.create({
      baseURL: `${this.config.sandboxBaseUrl}/v3/company/${this.config.companyId}`,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    this.initializeTokenManager();
  }

  /**
   * Initialize token manager with stored tokens
   */
  private async initializeTokenManager(): Promise<void> {
    try {
      // If we have tokens in environment, save them to secure storage
      if (this.config.accessToken && this.config.refreshToken) {
        const tokenData = {
          accessToken: this.config.accessToken,
          refreshToken: this.config.refreshToken,
          tokenType: 'Bearer',
          expiresIn: 3600, // Default 1 hour
          realmId: this.config.companyId,
          companyId: this.config.companyId
        };

        await this.tokenManager['storage'].saveTokens(tokenData, {
          provider: 'quickbooks',
          tenantId: this.tenantId
        });

        logger.info('Migrated environment tokens to secure storage');
      }

      // Initialize token manager with refresh config
      await this.tokenManager.initialize([this.refreshConfig]);
      
      logger.info('QuickBooks Enhanced Service initialized with automatic token refresh');
    } catch (error) {
      logger.error('Failed to initialize token manager:', error);
    }
  }

  /**
   * Set up axios interceptors for automatic token refresh
   */
  private setupInterceptors(): void {
    // Request interceptor - add fresh token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Rate limiting check
          await this.checkRateLimit();

          // Get fresh access token
          const accessToken = await this.tokenManager.getAccessToken(this.refreshConfig);
          config.headers.Authorization = `Bearer ${accessToken}`;
          
          logger.debug(
            `QuickBooks API Request: ${config.method?.toUpperCase()} ${config.url} ` +
            `[Token: ${CryptoUtils.maskToken(accessToken)}]`
          );
        } catch (error) {
          logger.error('Failed to get access token for request:', error);
          throw error;
        }
        
        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors and retry
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          `QuickBooks API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any;
        
        // Log error details
        const errorInfo = {
          url: originalRequest?.url,
          method: originalRequest?.method?.toUpperCase(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        };
        logger.error('QuickBooks API Error:', errorInfo);

        // Check if it's an authentication error
        const isAuthError = this.isAuthenticationError(error);

        if (isAuthError && !originalRequest._retry) {
          originalRequest._retry = true;
          
          logger.info('Authentication error detected, refreshing token and retrying...');
          
          try {
            // Force token refresh
            await this.tokenManager.refreshToken(this.refreshConfig);
            
            // Get new token and retry
            const accessToken = await this.tokenManager.getAccessToken(this.refreshConfig);
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            
            return this.client.request(originalRequest);
          } catch (refreshError) {
            logger.error('Token refresh failed, cannot retry request:', refreshError);
            throw refreshError;
          }
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          logger.warn(`Rate limited by QuickBooks. Retrying after ${retryAfter} seconds`);
          
          await this.sleep(retryAfter * 1000);
          return this.client.request(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if error is authentication-related
   */
  private isAuthenticationError(error: AxiosError): boolean {
    if (!error.response) return false;

    const { status, data } = error.response;
    
    // Check status codes
    if (status === 401 || status === 403) return true;

    // Check QuickBooks-specific error codes
    const qbError = (data as any)?.Fault?.Error?.[0];
    if (qbError) {
      const authErrorCodes = ['3200', '3201', '3202', '3203'];
      if (authErrorCodes.includes(qbError.code)) return true;
      
      if (qbError.Detail?.includes('Authentication') || 
          qbError.Detail?.includes('token')) return true;
    }

    return false;
  }

  /**
   * Rate limiting implementation
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date();
    
    // Reset counter every minute
    if (now.getTime() - this.requestResetTime.getTime() > 60000) {
      this.requestCount = 0;
      this.requestResetTime = now;
    }

    this.requestCount++;

    if (this.requestCount > this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - (now.getTime() - this.requestResetTime.getTime());
      logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      
      // Reset after waiting
      this.requestCount = 1;
      this.requestResetTime = new Date();
    }
  }

  /**
   * Test connection with automatic retry
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/companyinfo/1');
      logger.info('QuickBooks connection test successful');
      return true;
    } catch (error) {
      logger.error('QuickBooks connection test failed:', error);
      return false;
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(): Promise<any> {
    try {
      const response = await this.makeRequest('GET', '/companyinfo/1');
      
      if (response.data.QueryResponse?.CompanyInfo) {
        return response.data.QueryResponse.CompanyInfo[0];
      } else if (response.data.CompanyInfo) {
        return response.data.CompanyInfo;
      }
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get company info:', error);
      throw new Error('Failed to retrieve QuickBooks company information');
    }
  }

  /**
   * Create a customer with retry logic
   */
  async createCustomer(customerData: any): Promise<any> {
    return this.makeRequest('POST', '/customer', customerData);
  }

  /**
   * Create an invoice with retry logic
   */
  async createInvoice(invoiceData: any): Promise<any> {
    return this.makeRequest('POST', '/invoice', invoiceData);
  }

  /**
   * Generic request method with deduplication
   */
  private async makeRequest(
    method: string,
    path: string,
    data?: any,
    options?: any
  ): Promise<any> {
    // Create request key for deduplication
    const requestKey = `${method}:${path}:${JSON.stringify(data || {})}`;
    
    // Check if same request is already in progress
    const existingRequest = this.requestQueue.get(requestKey);
    if (existingRequest) {
      logger.debug('Request already in progress, waiting for result...');
      return existingRequest;
    }

    // Create new request promise
    const requestPromise = this.executeRequest(method, path, data, options);
    this.requestQueue.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      this.requestQueue.delete(requestKey);
      return result;
    } catch (error) {
      this.requestQueue.delete(requestKey);
      throw error;
    }
  }

  /**
   * Execute actual HTTP request
   */
  private async executeRequest(
    method: string,
    path: string,
    data?: any,
    options?: any
  ): Promise<any> {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.request({
          method,
          url: path,
          data,
          ...options
        });

        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) except auth errors
        if (error.response?.status >= 400 && 
            error.response?.status < 500 && 
            !this.isAuthenticationError(error as AxiosError)) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn(
            `Request failed (attempt ${attempt}/${maxRetries}), ` +
            `retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Batch API operations for efficiency
   */
  async batchOperation(operations: Array<{
    method: string;
    path: string;
    data?: any;
  }>): Promise<any[]> {
    // QuickBooks batch endpoint
    const batchRequest = {
      BatchItemRequest: operations.map((op, index) => ({
        bId: `bid_${index}`,
        operation: op.method,
        entity: op.path.split('/')[1], // Extract entity type
        optionalData: op.data
      }))
    };

    const response = await this.makeRequest('POST', '/batch', batchRequest);
    return response.data.BatchItemResponse || [];
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    connected: boolean;
    tokenValid: boolean;
    companyId: string;
    rateLimitStatus: {
      requests: number;
      resetTime: Date;
      remaining: number;
    };
  }> {
    const tokenValid = await this.testConnection();
    
    return {
      connected: tokenValid,
      tokenValid,
      companyId: this.config.companyId || 'not_set',
      rateLimitStatus: {
        requests: this.requestCount,
        resetTime: this.requestResetTime,
        remaining: Math.max(0, this.MAX_REQUESTS_PER_MINUTE - this.requestCount)
      }
    };
  }

  /**
   * Manual token refresh
   */
  async refreshTokensManually(): Promise<void> {
    logger.info('Manually refreshing QuickBooks tokens...');
    await this.tokenManager.refreshToken(this.refreshConfig);
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down QuickBooks Enhanced Service...');
    await this.tokenManager.shutdown();
  }
}

// Export singleton instance
let quickbooksEnhancedService: QuickBooksEnhancedService | null = null;

export function getQuickBooksEnhancedService(
  prisma: PrismaClient,
  redis?: Redis,
  tenantId?: string
): QuickBooksEnhancedService {
  if (!quickbooksEnhancedService) {
    quickbooksEnhancedService = new QuickBooksEnhancedService(prisma, redis, tenantId);
  }
  return quickbooksEnhancedService;
}