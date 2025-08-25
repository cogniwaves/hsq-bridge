import axios, { AxiosError } from 'axios';
import { getHubSpotConfig, getStripeConfig, getQuickBooksConfig } from '../config';
import { logger } from './logger';

export interface ConnectivityTest {
  platform: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  responseTime?: number;
}

export async function testAllConnections(): Promise<ConnectivityTest[]> {
  const tests = await Promise.allSettled([
    testHubSpotConnection(),
    testStripeConnection(),
    testQuickBooksConnection(),
    testDatabaseConnection(),
    testRedisConnection()
  ]);

  return tests.map((test, index) => {
    const platforms = ['HubSpot', 'Stripe', 'QuickBooks', 'Database', 'Redis'];
    if (test.status === 'fulfilled') {
      return test.value;
    } else {
      return {
        platform: platforms[index],
        status: 'error' as const,
        message: 'Connection test failed',
        details: test.reason?.message || 'Unknown error'
      };
    }
  });
}

export async function testHubSpotConnection(): Promise<ConnectivityTest> {
  const startTime = Date.now();
  
  try {
    const config = getHubSpotConfig();
    
    if (!config.apiKey || config.apiKey === 'your_hubspot_api_key') {
      return {
        platform: 'HubSpot',
        status: 'warning',
        message: 'API key not configured',
        details: 'Please set HUBSPOT_API_KEY in your environment'
      };
    }

    // Test API connection with a simple call
    const response = await axios.get('https://api.hubapi.com/account-info/v3/details', {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 200) {
      return {
        platform: 'HubSpot',
        status: 'success',
        message: 'Connection successful',
        details: {
          portalId: response.data.portalId,
          timeZone: response.data.timeZone,
          currency: response.data.currency
        },
        responseTime
      };
    } else {
      return {
        platform: 'HubSpot',
        status: 'error',
        message: 'Unexpected response',
        details: { status: response.status }
      };
    }

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error instanceof AxiosError) {
      return {
        platform: 'HubSpot',
        status: 'error',
        message: 'API connection failed',
        details: {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        },
        responseTime
      };
    }

    return {
      platform: 'HubSpot',
      status: 'error',
      message: 'Connection test failed',
      details: error.message,
      responseTime
    };
  }
}

export async function testStripeConnection(): Promise<ConnectivityTest> {
  const startTime = Date.now();
  
  try {
    const config = getStripeConfig();
    
    if (!config.secretKey || config.secretKey.includes('your_stripe_secret_key')) {
      return {
        platform: 'Stripe',
        status: 'warning',
        message: 'API key not configured',
        details: 'Please set STRIPE_SECRET_KEY in your environment'
      };
    }

    // Test API connection
    const response = await axios.get('https://api.stripe.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 200) {
      const isTestMode = config.secretKey.startsWith('sk_test_');
      
      return {
        platform: 'Stripe',
        status: 'success',
        message: `Connection successful (${isTestMode ? 'test' : 'live'} mode)`,
        details: {
          accountId: response.data.id,
          country: response.data.country,
          currency: response.data.default_currency,
          testMode: isTestMode
        },
        responseTime
      };
    } else {
      return {
        platform: 'Stripe',
        status: 'error',
        message: 'Unexpected response',
        details: { status: response.status }
      };
    }

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error instanceof AxiosError) {
      return {
        platform: 'Stripe',
        status: 'error',
        message: 'API connection failed',
        details: {
          status: error.response?.status,
          message: error.response?.data?.error?.message || error.message
        },
        responseTime
      };
    }

    return {
      platform: 'Stripe',
      status: 'error',
      message: 'Connection test failed',
      details: error.message,
      responseTime
    };
  }
}

export async function testQuickBooksConnection(): Promise<ConnectivityTest> {
  try {
    const config = getQuickBooksConfig();
    
    if (!config.clientId || config.clientId === 'your_quickbooks_client_id') {
      return {
        platform: 'QuickBooks',
        status: 'warning',
        message: 'Client ID not configured',
        details: 'Please set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET'
      };
    }

    // For QuickBooks, we can only test the discovery document URL
    // Full OAuth testing requires user interaction
    const startTime = Date.now();
    
    const response = await axios.get(config.discoveryDocument, {
      timeout: 10000
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 200) {
      return {
        platform: 'QuickBooks',
        status: 'success',
        message: 'Discovery document accessible (OAuth setup required)',
        details: {
          baseUrl: config.sandboxBaseUrl,
          discoveryDocument: config.discoveryDocument,
          note: 'Full API access requires OAuth authentication'
        },
        responseTime
      };
    }

    return {
      platform: 'QuickBooks',
      status: 'error',
      message: 'Discovery document not accessible',
      details: { status: response.status }
    };

  } catch (error: any) {
    if (error instanceof AxiosError) {
      return {
        platform: 'QuickBooks',
        status: 'error',
        message: 'Discovery document request failed',
        details: {
          status: error.response?.status,
          message: error.message
        }
      };
    }

    return {
      platform: 'QuickBooks',
      status: 'error',
      message: 'Connection test failed',
      details: error.message
    };
  }
}

export async function testDatabaseConnection(): Promise<ConnectivityTest> {
  const startTime = Date.now();
  
  try {
    // Import prisma here to avoid circular dependency
    const { prisma } = await import('../index');
    
    await prisma.$queryRaw`SELECT 1 as test`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      platform: 'Database',
      status: 'success',
      message: 'PostgreSQL connection successful',
      responseTime
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      platform: 'Database',
      status: 'error',
      message: 'Database connection failed',
      details: error.message,
      responseTime
    };
  }
}

export async function testRedisConnection(): Promise<ConnectivityTest> {
  const startTime = Date.now();
  
  try {
    const Redis = await import('ioredis');
    const { getRedisConfig } = await import('../config');
    
    const redisUrl = getRedisConfig();
    const redis = new Redis.default(redisUrl);
    
    await redis.ping();
    await redis.quit();
    
    const responseTime = Date.now() - startTime;
    
    return {
      platform: 'Redis',
      status: 'success',
      message: 'Redis connection successful',
      responseTime
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      platform: 'Redis',
      status: 'error',
      message: 'Redis connection failed',
      details: error.message,
      responseTime
    };
  }
}

export async function logConnectivityReport() {
  logger.info('🔍 Testing connectivity to all services...');
  
  const results = await testAllConnections();
  
  results.forEach(test => {
    const icon = test.status === 'success' ? '✅' : test.status === 'warning' ? '⚠️' : '❌';
    const time = test.responseTime ? ` (${test.responseTime}ms)` : '';
    
    logger.info(`${icon} ${test.platform}: ${test.message}${time}`);
    
    if (test.details && (test.status === 'error' || test.status === 'warning')) {
      logger.warn(`   Details: ${JSON.stringify(test.details)}`);
    }
  });
  
  const successCount = results.filter(r => r.status === 'success').length;
  const totalCount = results.length;
  
  if (successCount === totalCount) {
    logger.info('🎉 All connectivity tests passed!');
  } else {
    logger.warn(`⚠️ ${successCount}/${totalCount} connectivity tests passed`);
  }
  
  return results;
}