/**
 * Connection Testing API
 * Tests connections to various platforms
 */

import { NextRequest, NextResponse } from 'next/server';

interface TestRequest {
  platform: 'HUBSPOT' | 'STRIPE' | 'QUICKBOOKS';
  config: Record<string, any>;
}

interface TestResult {
  success: boolean;
  message: string;
  details: {
    apiReachable: boolean;
    authValid: boolean;
    rateLimitOk: boolean;
    responseTime: number;
    errorCount: number;
    metadata?: Record<string, any>;
  };
}

/**
 * Test HubSpot connection
 */
async function testHubSpotConnection(config: Record<string, any>): Promise<TestResult> {
  const startTime = Date.now();
  const apiKey = config.apiKey;
  
  if (!apiKey) {
    return {
      success: false,
      message: 'API key is required',
      details: {
        apiReachable: false,
        authValid: false,
        rateLimitOk: false,
        responseTime: 0,
        errorCount: 1
      }
    };
  }
  
  try {
    // Test API connectivity and authentication
    const response = await fetch('https://api.hubapi.com/account-info/v3/details', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      // Check rate limit headers
      const rateLimitRemaining = response.headers.get('X-HubSpot-RateLimit-Remaining');
      const rateLimitOk = !rateLimitRemaining || parseInt(rateLimitRemaining) > 10;
      
      return {
        success: true,
        message: `Connected to HubSpot account: ${data.portalId}`,
        details: {
          apiReachable: true,
          authValid: true,
          rateLimitOk,
          responseTime,
          errorCount: 0,
          metadata: {
            portalId: data.portalId,
            timeZone: data.timeZone,
            currency: data.currency
          }
        }
      };
    } else if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid API key - authentication failed',
        details: {
          apiReachable: true,
          authValid: false,
          rateLimitOk: true,
          responseTime,
          errorCount: 1
        }
      };
    } else if (response.status === 429) {
      return {
        success: false,
        message: 'Rate limit exceeded - too many requests',
        details: {
          apiReachable: true,
          authValid: true,
          rateLimitOk: false,
          responseTime,
          errorCount: 1
        }
      };
    } else {
      return {
        success: false,
        message: `API error: ${response.statusText}`,
        details: {
          apiReachable: true,
          authValid: false,
          rateLimitOk: true,
          responseTime,
          errorCount: 1
        }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      details: {
        apiReachable: false,
        authValid: false,
        rateLimitOk: false,
        responseTime: Date.now() - startTime,
        errorCount: 1
      }
    };
  }
}

/**
 * Test Stripe connection
 */
async function testStripeConnection(config: Record<string, any>): Promise<TestResult> {
  const startTime = Date.now();
  const secretKey = config.secretKey;
  
  if (!secretKey) {
    return {
      success: false,
      message: 'Secret key is required',
      details: {
        apiReachable: false,
        authValid: false,
        rateLimitOk: false,
        responseTime: 0,
        errorCount: 1
      }
    };
  }
  
  try {
    // Test API connectivity by fetching account details
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      return {
        success: true,
        message: `Connected to Stripe account: ${data.id}`,
        details: {
          apiReachable: true,
          authValid: true,
          rateLimitOk: true,
          responseTime,
          errorCount: 0,
          metadata: {
            accountId: data.id,
            businessName: data.business_profile?.name,
            country: data.country,
            defaultCurrency: data.default_currency
          }
        }
      };
    } else if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid API key - authentication failed',
        details: {
          apiReachable: true,
          authValid: false,
          rateLimitOk: true,
          responseTime,
          errorCount: 1
        }
      };
    } else if (response.status === 429) {
      return {
        success: false,
        message: 'Rate limit exceeded',
        details: {
          apiReachable: true,
          authValid: true,
          rateLimitOk: false,
          responseTime,
          errorCount: 1
        }
      };
    } else {
      const errorData = await response.json();
      return {
        success: false,
        message: errorData.error?.message || `API error: ${response.statusText}`,
        details: {
          apiReachable: true,
          authValid: false,
          rateLimitOk: true,
          responseTime,
          errorCount: 1
        }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      details: {
        apiReachable: false,
        authValid: false,
        rateLimitOk: false,
        responseTime: Date.now() - startTime,
        errorCount: 1
      }
    };
  }
}

/**
 * Test QuickBooks connection
 */
async function testQuickBooksConnection(config: Record<string, any>): Promise<TestResult> {
  const startTime = Date.now();
  const { accessToken, realmId } = config;
  
  if (!accessToken || !realmId) {
    return {
      success: false,
      message: 'Access token and Realm ID are required',
      details: {
        apiReachable: false,
        authValid: false,
        rateLimitOk: false,
        responseTime: 0,
        errorCount: 1
      }
    };
  }
  
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
  
  try {
    // Test API connectivity by fetching company info
    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const companyInfo = data.CompanyInfo;
      
      return {
        success: true,
        message: `Connected to QuickBooks company: ${companyInfo.CompanyName}`,
        details: {
          apiReachable: true,
          authValid: true,
          rateLimitOk: true,
          responseTime,
          errorCount: 0,
          metadata: {
            companyId: companyInfo.Id,
            companyName: companyInfo.CompanyName,
            country: companyInfo.Country,
            fiscalYearStart: companyInfo.FiscalYearStartMonth
          }
        }
      };
    } else if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid or expired access token',
        details: {
          apiReachable: true,
          authValid: false,
          rateLimitOk: true,
          responseTime,
          errorCount: 1
        }
      };
    } else if (response.status === 429) {
      return {
        success: false,
        message: 'Rate limit exceeded',
        details: {
          apiReachable: true,
          authValid: true,
          rateLimitOk: false,
          responseTime,
          errorCount: 1
        }
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        message: `API error: ${response.statusText}`,
        details: {
          apiReachable: true,
          authValid: false,
          rateLimitOk: true,
          responseTime,
          errorCount: 1
        }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      details: {
        apiReachable: false,
        authValid: false,
        rateLimitOk: false,
        responseTime: Date.now() - startTime,
        errorCount: 1
      }
    };
  }
}

/**
 * POST /api/config/test-connection
 * Tests a connection to a platform
 */
export async function POST(request: NextRequest) {
  try {
    const body: TestRequest = await request.json();
    const { platform, config } = body;
    
    if (!platform || !config) {
      return NextResponse.json(
        {
          success: false,
          error: 'Platform and configuration are required'
        },
        { status: 400 }
      );
    }
    
    let result: TestResult;
    
    switch (platform) {
      case 'HUBSPOT':
        result = await testHubSpotConnection(config);
        break;
      case 'STRIPE':
        result = await testStripeConnection(config);
        break;
      case 'QUICKBOOKS':
        result = await testQuickBooksConnection(config);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported platform: ${platform}`
          },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}