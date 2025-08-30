/**
 * OAuth State Validation API Route
 * Validates OAuth state parameter for PKCE security
 * Prevents CSRF attacks in OAuth flows
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Store for OAuth states (in production, use Redis or database)
const oauthStateStore = new Map<string, {
  platform: string;
  timestamp: number;
  codeVerifier?: string;
  redirectUri?: string;
}>();

// Clean up old states (older than 10 minutes)
function cleanupOldStates() {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  
  for (const [state, data] of oauthStateStore.entries()) {
    if (now - data.timestamp > tenMinutes) {
      oauthStateStore.delete(state);
    }
  }
}

// Generate secure random state
function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate PKCE code verifier
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate PKCE code challenge
function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * POST /api/config/validate-state
 * Validates an OAuth state parameter
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { state, platform } = body;

    if (!state || !platform) {
      return NextResponse.json(
        { valid: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Clean up old states
    cleanupOldStates();

    // Check if state exists and is valid
    const storedData = oauthStateStore.get(state);
    
    if (!storedData) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired state' },
        { status: 401 }
      );
    }

    // Verify platform matches
    if (storedData.platform !== platform) {
      return NextResponse.json(
        { valid: false, error: 'Platform mismatch' },
        { status: 401 }
      );
    }

    // Check if state is not too old (10 minutes max)
    const age = Date.now() - storedData.timestamp;
    if (age > 10 * 60 * 1000) {
      oauthStateStore.delete(state);
      return NextResponse.json(
        { valid: false, error: 'State expired' },
        { status: 401 }
      );
    }

    // State is valid - remove it (one-time use)
    oauthStateStore.delete(state);

    return NextResponse.json({
      valid: true,
      codeVerifier: storedData.codeVerifier,
      redirectUri: storedData.redirectUri,
    });
  } catch (error) {
    console.error('State validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/config/validate-state
 * Generates a new OAuth state for PKCE flow
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const usePkce = searchParams.get('pkce') === 'true';
    const redirectUri = searchParams.get('redirect_uri');

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

    // Clean up old states
    cleanupOldStates();

    // Generate state and PKCE parameters
    const state = generateState();
    const codeVerifier = usePkce ? generateCodeVerifier() : undefined;
    const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : undefined;

    // Store state with metadata
    oauthStateStore.set(state, {
      platform,
      timestamp: Date.now(),
      codeVerifier,
      redirectUri: redirectUri || undefined,
    });

    // Also store in secure cookie as backup
    const cookieStore = cookies();
    cookieStore.set(`oauth_state_${platform}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    if (codeVerifier) {
      cookieStore.set(`oauth_verifier_${platform}`, codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      });
    }

    return NextResponse.json({
      state,
      codeChallenge,
      codeChallengeMethod: codeChallenge ? 'S256' : undefined,
    });
  } catch (error) {
    console.error('State generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate state' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/config/validate-state
 * Clears OAuth state for a platform
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform } = body;

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

    // Clear from store
    for (const [state, data] of oauthStateStore.entries()) {
      if (data.platform === platform) {
        oauthStateStore.delete(state);
      }
    }

    // Clear cookies
    const cookieStore = cookies();
    cookieStore.delete(`oauth_state_${platform}`);
    cookieStore.delete(`oauth_verifier_${platform}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('State clearing error:', error);
    return NextResponse.json(
      { error: 'Failed to clear state' },
      { status: 500 }
    );
  }
}