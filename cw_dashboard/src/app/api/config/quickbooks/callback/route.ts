/**
 * QuickBooks OAuth Callback Route
 * Handles the OAuth callback from QuickBooks
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  // Build redirect URL with parameters
  const redirectUrl = new URL('/dashboard/configuration', request.url);
  redirectUrl.searchParams.set('oauth', 'quickbooks');
  
  if (error) {
    redirectUrl.searchParams.set('error', error);
    if (errorDescription) {
      redirectUrl.searchParams.set('error_description', errorDescription);
    }
  } else if (code && state) {
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', state);
    if (realmId) {
      redirectUrl.searchParams.set('realmId', realmId);
    }
  } else {
    redirectUrl.searchParams.set('error', 'missing_parameters');
  }
  
  // Redirect to the dashboard with OAuth parameters
  return NextResponse.redirect(redirectUrl);
}