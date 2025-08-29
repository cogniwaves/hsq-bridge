import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { getQuickBooksClient } from '../services/quickbooksClient';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';

interface QuickBooksStatus {
  configured: boolean;
  authenticated: boolean;
  companyId: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  sandboxMode: boolean;
  connectionTest?: string;
  companyName?: string;
  error?: string;
}

interface CompanyInfo {
  CompanyName?: string;
  [key: string]: unknown;
}

export const authRoutes = Router();

/**
 * GET /api/auth/quickbooks/simple-status  
 * Simple QuickBooks configuration status check
 */
authRoutes.get('/quickbooks/simple-status', asyncHandler(async (req: Request, res: Response) => {
  const { getQuickBooksConfig } = await import('../config');
  const config = getQuickBooksConfig();
  
  const status: QuickBooksStatus = {
    configured: !!(config.clientId && config.clientSecret),
    authenticated: !!(config.accessToken && config.companyId),
    companyId: config.companyId || 'Not set',
    hasAccessToken: !!config.accessToken,
    hasRefreshToken: !!config.refreshToken,
    sandboxMode: true
  };
  
  if (status.authenticated) {
    try {
      const { quickbooksService } = await import('../services/quickbooksService');
      const connectionTest = await quickbooksService.testConnection();
      status.connectionTest = connectionTest ? 'success' : 'failed';
      
      if (connectionTest) {
        const companyInfo = await quickbooksService.getCompanyInfo() as CompanyInfo | undefined;
        status.companyName = companyInfo?.CompanyName || 'Unknown';
      }
    } catch (error) {
      status.connectionTest = 'error';
      status.error = error instanceof Error ? error.message : 'Connection test failed';
    }
  }
  
  res.json(createSuccessResponse(status, 'QuickBooks status retrieved'));
}));

/**
 * GET /api/auth/quickbooks/oauth-url
 * Generate OAuth URL for manual token acquisition
 */
authRoutes.get('/quickbooks/oauth-url', asyncHandler(async (req: Request, res: Response) => {
  const { getQuickBooksConfig } = await import('../config');
  const config = getQuickBooksConfig();
  
  if (!config.clientId) {
    return res.status(500).json(createErrorResponse('QuickBooks Client ID not configured'));
  }
  
  const scope = 'com.intuit.quickbooks.accounting';
  const state = 'security_token_' + Math.random().toString(36).substr(2, 15);
  const redirectUri = 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl';
  
  const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
    `client_id=${config.clientId}&` +
    `scope=${scope}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `access_type=offline&` +
    `state=${state}`;
  
  res.json(createSuccessResponse({
    authUrl,
    instructions: [
      '1. Click the authUrl link below',
      '2. Authorize the application',  
      '3. You\'ll be redirected to Intuit Playground',
      '4. Copy the access_token and refresh_token from the playground',
      '5. Update your .env file with these tokens'
    ],
    authUrl_clickable: authUrl
  }, 'QuickBooks OAuth URL generated'));
}));

/**
 * POST /api/auth/quickbooks/exchange-token
 * Exchange authorization code for access tokens
 */
authRoutes.post('/quickbooks/exchange-token', asyncHandler(async (req, res) => {
  const { code, realmId } = req.body;
  
  if (!code) {
    return res.status(400).json(createErrorResponse('Authorization code is required'));
  }
  
  const { getQuickBooksConfig } = await import('../config');
  const config = getQuickBooksConfig();
  
  if (!config.clientId || !config.clientSecret) {
    return res.status(500).json(createErrorResponse('QuickBooks credentials not configured'));
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Token exchange failed:', errorText);
      return res.status(400).json(createErrorResponse('Token exchange failed', errorText));
    }

    const tokens = await tokenResponse.json();
    
    logger.info('QuickBooks token exchange successful:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      realmId: realmId
    });

    res.json(createSuccessResponse({
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type
      },
      company_id: realmId || config.companyId,
      instructions: {
        message: 'SUCCESS! Update your .env file with these values:',
        env_vars: {
          QUICKBOOKS_ACCESS_TOKEN: tokens.access_token,
          QUICKBOOKS_REFRESH_TOKEN: tokens.refresh_token,
          QUICKBOOKS_COMPANY_ID: realmId || config.companyId
        },
        next_steps: [
          '1. Copy the tokens above to your .env file',
          '2. Restart the API: docker restart cw_hsq_app', 
          '3. Test sync by clicking "Sync Now" in the dashboard'
        ]
      }
    }, 'Token exchange successful'));

  } catch (error) {
    logger.error('Token exchange error:', error);
    res.status(500).json(createErrorResponse(
      'Token exchange failed',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/auth/quickbooks
 * Génère l'URL d'autorisation QuickBooks et redirige l'utilisateur
 */
authRoutes.get('/quickbooks', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Initiating QuickBooks OAuth flow');
  
  try {
    const qbClient = getQuickBooksClient();
    const state = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const authUrl = qbClient.getAuthUrl(state);
    
    // Stocker l'état pour validation (en production, utiliser Redis ou une session)
    // Pour la démo, on log simplement l'état
    logger.info(`QuickBooks OAuth state: ${state}`);
    
    res.json(createSuccessResponse({
      authUrl,
      state,
      instructions: {
        step1: 'Visit the authUrl to authorize the application',
        step2: 'You will be redirected to the callback URL after authorization',
        step3: 'The callback will exchange the code for access tokens'
      }
    }, 'QuickBooks authorization URL generated successfully'));
    
  } catch (error) {
    logger.error('Failed to generate QuickBooks auth URL:', error);
    res.status(500).json(createErrorResponse(
      'Failed to generate authorization URL',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/auth/quickbooks/callback
 * Callback OAuth QuickBooks - échange le code pour des tokens
 */
authRoutes.get('/quickbooks/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, realmId, state, error: oauthError } = req.query as {
    code?: string;
    realmId?: string;
    state?: string;
    error?: string;
  };
  
  logger.info(`QuickBooks OAuth callback received - RealmId: ${realmId}, State: ${state}`);
  
  try {
    if (oauthError) {
      logger.error('QuickBooks OAuth error:', oauthError);
      return res.status(400).json(createErrorResponse(
        'QuickBooks authorization failed',
        oauthError as string
      ));
    }

    if (!code || !realmId) {
      return res.status(400).json(createErrorResponse(
        'Missing required OAuth parameters',
        'Authorization code and realm ID are required'
      ));
    }

    const qbClient = getQuickBooksClient();
    const tokens = await qbClient.exchangeCodeForTokens(code as string, realmId as string);
    
    // En production, stocker ces tokens de manière sécurisée
    // Pour cette démo, on les log (attention: ne jamais faire ça en production!)
    logger.info('QuickBooks tokens obtained successfully');
    logger.info(`Access Token: ${tokens.access_token.substring(0, 20)}...`);
    logger.info(`Refresh Token: ${tokens.refresh_token.substring(0, 20)}...`);
    logger.info(`Realm ID: ${tokens.realmId}`);
    
    // Test de connexion
    const connectionTest = await qbClient.testConnection();
    
    res.json(createSuccessResponse({
      success: true,
      realmId: tokens.realmId,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      refreshTokenExpiresIn: tokens.x_refresh_token_expires_in,
      connectionTest: connectionTest ? 'successful' : 'failed',
      nextSteps: {
        message: connectionTest 
          ? 'QuickBooks integration is now active and ready for transfers'
          : 'Tokens obtained but connection test failed - check configuration',
        availableEndpoints: [
          'GET /api/quickbooks/test-connection',
          'POST /api/quickbooks/queue/process-changes',
          'GET /api/quickbooks/queue',
          'POST /api/quickbooks/transfer/process-approved'
        ]
      },
      // En production, ne pas exposer les tokens dans la réponse!
      credentials: {
        accessToken: `${tokens.access_token.substring(0, 20)}...`,
        refreshToken: `${tokens.refresh_token.substring(0, 20)}...`,
        realmId: tokens.realmId
      }
    }, 'QuickBooks authorization completed successfully'));
    
  } catch (error) {
    logger.error('QuickBooks OAuth callback failed:', error);
    res.status(500).json(createErrorResponse(
      'Failed to complete QuickBooks authorization',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/auth/quickbooks/status
 * Vérifie l'état de l'authentification QuickBooks
 */
authRoutes.get('/quickbooks/status', asyncHandler(async (req, res) => {
  logger.info('Checking QuickBooks authentication status');
  
  try {
    const qbClient = getQuickBooksClient();
    const config = qbClient.getConfig();
    
    const hasTokens = !!(config.accessToken && config.refreshToken && config.realmId);
    let connectionStatus = 'not_tested';
    let companyInfo = null;
    
    if (hasTokens) {
      try {
        const isConnected = await qbClient.testConnection();
        connectionStatus = isConnected ? 'connected' : 'failed';
        
        if (isConnected) {
          // Optionnel: récupérer des infos sur la compagnie
          companyInfo = {
            realmId: config.realmId,
            sandbox: config.sandbox,
            message: 'Successfully connected to QuickBooks'
          };
        }
      } catch (error) {
        connectionStatus = 'error';
        logger.error('QuickBooks connection test error:', error);
      }
    }
    
    res.json(createSuccessResponse({
      authenticated: hasTokens,
      connectionStatus,
      configuration: {
        clientConfigured: !!(config.clientId && config.clientSecret),
        sandbox: config.sandbox,
        hasAccessToken: !!config.accessToken,
        hasRefreshToken: !!config.refreshToken,
        hasRealmId: !!config.realmId
      },
      companyInfo,
      recommendations: {
        needsAuth: !hasTokens,
        authUrl: hasTokens ? null : '/api/auth/quickbooks',
        message: hasTokens 
          ? (connectionStatus === 'connected' ? 'Ready for transfers' : 'Authentication issues detected')
          : 'QuickBooks authorization required'
      }
    }, 'QuickBooks authentication status retrieved successfully'));
    
  } catch (error) {
    logger.error('Failed to check QuickBooks auth status:', error);
    res.status(500).json(createErrorResponse(
      'Failed to check authentication status',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/auth/quickbooks/refresh
 * Refresh manuellement les tokens QuickBooks
 */
authRoutes.post('/quickbooks/refresh', asyncHandler(async (req, res) => {
  logger.info('Manually refreshing QuickBooks tokens');
  
  try {
    const qbClient = getQuickBooksClient();
    await qbClient.refreshAccessToken();
    
    const connectionTest = await qbClient.testConnection();
    
    res.json(createSuccessResponse({
      tokenRefreshed: true,
      connectionTest: connectionTest ? 'successful' : 'failed',
      message: connectionTest 
        ? 'Tokens refreshed and connection verified'
        : 'Tokens refreshed but connection test failed'
    }, 'QuickBooks tokens refreshed successfully'));
    
  } catch (error) {
    logger.error('Failed to refresh QuickBooks tokens:', error);
    res.status(500).json(createErrorResponse(
      'Failed to refresh QuickBooks tokens',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * DELETE /api/auth/quickbooks/disconnect
 * Déconnecte QuickBooks (efface les tokens)
 */
authRoutes.delete('/quickbooks/disconnect', asyncHandler(async (req, res) => {
  logger.info('Disconnecting QuickBooks integration');
  
  try {
    const qbClient = getQuickBooksClient();
    
    // Effacer les tokens (en production, les supprimer de la base de données/stockage sécurisé)
    qbClient.updateTokens('', '', '');
    
    res.json(createSuccessResponse({
      disconnected: true,
      message: 'QuickBooks integration has been disconnected',
      nextSteps: {
        message: 'To reconnect, initiate the OAuth flow again',
        authUrl: '/api/auth/quickbooks'
      }
    }, 'QuickBooks integration disconnected successfully'));
    
  } catch (error) {
    logger.error('Failed to disconnect QuickBooks:', error);
    res.status(500).json(createErrorResponse(
      'Failed to disconnect QuickBooks',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));