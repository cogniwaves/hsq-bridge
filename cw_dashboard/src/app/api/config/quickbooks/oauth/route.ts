/**
 * QuickBooks OAuth API Routes
 * Handles OAuth flow for QuickBooks integration
 * Implements PKCE for enhanced security
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

// OAuth endpoints
const OAUTH_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://appcenter.intuit.com/connect/oauth2'
  : 'https://sandbox-quickbooks.api.intuit.com/connect/oauth2';

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

// QuickBooks OAuth configuration
const CLIENT_ID = process.env.NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_QUICKBOOKS_REDIRECT_URI || 
  'http://localhost:13001/api/config/quickbooks/callback';

// Scopes for QuickBooks access
const SCOPES = [
  'com.intuit.quickbooks.accounting',
  'com.intuit.quickbooks.payment',
  'openid',
  'profile',
  'email',
  'phone',
  'address'
];

/**
 * Generate PKCE challenge
 */
function generatePKCEChallenge() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  
  return { verifier, challenge };
}

/**
 * Generate OAuth state for CSRF protection
 */
function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * GET /api/config/quickbooks/oauth
 * Initiates the OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Generate PKCE and state
    const { verifier, challenge } = generatePKCEChallenge();
    const state = generateState();
    
    // Store verifier and state in secure cookies
    const cookieStore = cookies();
    cookieStore.set('qb_oauth_verifier', verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });
    
    cookieStore.set('qb_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });
    
    // Build authorization URL
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES.join(' '),
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    
    const authUrl = `${OAUTH_BASE_URL}/authorize?${params.toString()}`;
    
    return NextResponse.json({
      success: true,
      authUrl,
      state
    });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate OAuth flow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config/quickbooks/oauth
 * Exchanges authorization code for tokens
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state: receivedState, realmId } = body;
    
    if (!code || !receivedState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters'
        },
        { status: 400 }
      );
    }
    
    // Verify state to prevent CSRF
    const cookieStore = cookies();
    const storedState = cookieStore.get('qb_oauth_state')?.value;
    const storedVerifier = cookieStore.get('qb_oauth_verifier')?.value;
    
    if (!storedState || storedState !== receivedState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid state parameter - possible CSRF attack'
        },
        { status: 400 }
      );
    }
    
    if (!storedVerifier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing PKCE verifier'
        },
        { status: 400 }
      );
    }
    
    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: storedVerifier
    });
    
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
      },
      body: tokenParams.toString()
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to exchange code for tokens',
          details: errorData
        },
        { status: tokenResponse.status }
      );
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get company information
    let companyInfo = null;
    if (realmId && tokenData.access_token) {
      try {
        const companyResponse = await fetch(
          `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`
            }
          }
        );
        
        if (companyResponse.ok) {
          const companyData = await companyResponse.json();
          companyInfo = {
            id: companyData.CompanyInfo?.Id,
            name: companyData.CompanyInfo?.CompanyName,
            country: companyData.CompanyInfo?.Country,
            email: companyData.CompanyInfo?.Email,
            phone: companyData.CompanyInfo?.PrimaryPhone?.FreeFormNumber
          };
        }
      } catch (error) {
        console.error('Failed to fetch company info:', error);
      }
    }
    
    // Clear OAuth cookies
    cookieStore.delete('qb_oauth_state');
    cookieStore.delete('qb_oauth_verifier');
    
    // Store tokens securely (in production, encrypt these)
    // For now, we'll return them to the client to store in the configuration
    return NextResponse.json({
      success: true,
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        idToken: tokenData.id_token,
        realmId: realmId
      },
      companyInfo
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete OAuth flow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/config/quickbooks/oauth
 * Revokes OAuth tokens
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;
    
    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing refresh token'
        },
        { status: 400 }
      );
    }
    
    // Revoke the token
    const revokeParams = new URLSearchParams({
      token: refreshToken
    });
    
    const revokeResponse = await fetch(
      'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
        },
        body: revokeParams.toString()
      }
    );
    
    if (!revokeResponse.ok) {
      const errorData = await revokeResponse.json();
      console.error('Token revocation error:', errorData);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to revoke tokens',
          details: errorData
        },
        { status: revokeResponse.status }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tokens successfully revoked'
    });
  } catch (error) {
    console.error('Token revocation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revoke tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}