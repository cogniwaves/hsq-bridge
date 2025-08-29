/**
 * OAuth Callback Handler Component
 * Handles OAuth return flow and token exchange
 * Provides error recovery and retry mechanisms
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../design-system/themes/themeProvider';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface OAuthCallbackHandlerProps {
  onSuccess?: (tokens: Record<string, any>) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  redirectPath?: string;
  className?: string;
}

type CallbackState = 'processing' | 'success' | 'error' | 'cancelled';

export function OAuthCallbackHandler({
  onSuccess,
  onError,
  onCancel,
  redirectPath = '/dashboard/configuration',
  className = '',
}: OAuthCallbackHandlerProps) {
  const { theme, resolvedMode } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const colors = theme.colors;

  const [state, setState] = useState<CallbackState>('processing');
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, any> | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    handleCallback();
  }, [searchParams]);

  const handleCallback = async () => {
    const platform = searchParams.get('oauth');
    const code = searchParams.get('code');
    const oauthState = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle error from OAuth provider
    if (errorParam) {
      setState('error');
      setError(errorDescription || errorParam || 'OAuth authorization failed');
      if (onError) {
        onError(errorDescription || errorParam);
      }
      return;
    }

    // Handle missing parameters
    if (!platform || !code || !oauthState) {
      setState('error');
      setError('Missing required OAuth parameters');
      if (onError) {
        onError('Missing required OAuth parameters');
      }
      return;
    }

    // Exchange code for tokens based on platform
    try {
      setState('processing');
      
      let response;
      switch (platform) {
        case 'quickbooks':
          response = await fetch('/api/config/quickbooks/oauth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              state: oauthState,
              realmId,
            }),
          });
          break;
        
        // Add other OAuth providers here
        default:
          throw new Error(`Unsupported OAuth platform: ${platform}`);
      }

      const data = await response.json();

      if (data.success && data.tokens) {
        setState('success');
        setTokens(data.tokens);
        
        if (onSuccess) {
          onSuccess(data.tokens);
        }

        // Redirect after success
        setTimeout(() => {
          router.push(redirectPath);
        }, 2000);
      } else {
        setState('error');
        setError(data.error || 'Failed to complete OAuth flow');
        if (onError) {
          onError(data.error || 'Failed to complete OAuth flow');
        }
      }
    } catch (error) {
      setState('error');
      const errorMessage = error instanceof Error ? error.message : 'OAuth callback processing failed';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setState('processing');
    setError(null);
    handleCallback();
  };

  const handleCancel = () => {
    setState('cancelled');
    if (onCancel) {
      onCancel();
    }
    router.push(redirectPath);
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    padding: theme.spacing?.container?.lg || '32px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
    maxWidth: '500px',
    width: '100%',
    margin: '0 auto',
  };

  const iconContainerStyle: React.CSSProperties = {
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px',
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.headlineMedium,
    color: colors.onSurface,
    margin: 0,
    marginBottom: '8px',
    textAlign: 'center',
  };

  const messageStyle: React.CSSProperties = {
    ...theme.typography?.bodyLarge,
    color: colors.onSurfaceVariant,
    margin: 0,
    marginBottom: '24px',
    textAlign: 'center',
    maxWidth: '400px',
  };

  const renderContent = () => {
    switch (state) {
      case 'processing':
        return (
          <>
            <div style={iconContainerStyle}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  border: `4px solid ${colors.outlineVariant}`,
                  borderTop: `4px solid ${colors.primary}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
            <h2 style={titleStyle}>Processing OAuth Response</h2>
            <p style={messageStyle}>
              Exchanging authorization code for access tokens...
              {retryCount > 0 && ` (Retry ${retryCount})`}
            </p>
          </>
        );

      case 'success':
        return (
          <>
            <div style={iconContainerStyle}>
              <CheckCircleIcon
                style={{
                  width: '64px',
                  height: '64px',
                  color: '#10b981',
                }}
              />
            </div>
            <h2 style={titleStyle}>Authorization Successful</h2>
            <p style={messageStyle}>
              Your account has been successfully connected. Redirecting to configuration...
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: colors.successContainer,
                borderRadius: '8px',
                marginTop: '16px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span
                style={{
                  ...theme.typography?.labelMedium,
                  color: '#047857',
                }}
              >
                Connection Active
              </span>
            </div>
          </>
        );

      case 'error':
        return (
          <>
            <div style={iconContainerStyle}>
              <XCircleIcon
                style={{
                  width: '64px',
                  height: '64px',
                  color: colors.error,
                }}
              />
            </div>
            <h2 style={titleStyle}>Authorization Failed</h2>
            <p style={messageStyle}>{error || 'An unexpected error occurred during authorization.'}</p>
            
            {/* Error Details */}
            <div
              style={{
                padding: '16px',
                backgroundColor: colors.errorContainer,
                borderRadius: '8px',
                border: `1px solid ${colors.error}`,
                marginBottom: '24px',
                maxWidth: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <ExclamationTriangleIcon
                  style={{
                    width: '20px',
                    height: '20px',
                    color: colors.error,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      ...theme.typography?.labelMedium,
                      color: colors.onErrorContainer,
                      marginBottom: '4px',
                    }}
                  >
                    What went wrong?
                  </div>
                  <div
                    style={{
                      ...theme.typography?.bodySmall,
                      color: colors.onErrorContainer,
                      opacity: 0.9,
                    }}
                  >
                    {error?.includes('state') && 'The authorization state was invalid. This could be a security issue.'}
                    {error?.includes('code') && 'The authorization code was invalid or expired.'}
                    {error?.includes('Missing') && 'Required parameters were missing from the OAuth response.'}
                    {!error?.includes('state') && !error?.includes('code') && !error?.includes('Missing') && 
                      'The OAuth provider rejected the request or the connection timed out.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleRetry}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                  border: 'none',
                  borderRadius: '8px',
                  ...theme.typography?.labelLarge,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ArrowPathIcon style={{ width: '16px', height: '16px' }} />
                Try Again
              </button>
              <button
                onClick={handleCancel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: 'transparent',
                  color: colors.onSurfaceVariant,
                  border: `1px solid ${colors.outlineVariant}`,
                  borderRadius: '8px',
                  ...theme.typography?.labelLarge,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeftIcon style={{ width: '16px', height: '16px' }} />
                Back to Configuration
              </button>
            </div>
          </>
        );

      case 'cancelled':
        return (
          <>
            <div style={iconContainerStyle}>
              <ExclamationTriangleIcon
                style={{
                  width: '64px',
                  height: '64px',
                  color: colors.onSurfaceVariant,
                }}
              />
            </div>
            <h2 style={titleStyle}>Authorization Cancelled</h2>
            <p style={messageStyle}>
              The OAuth authorization was cancelled. Returning to configuration...
            </p>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`oauth-callback-handler ${className}`}
      style={containerStyle}
      data-testid="oauth-callback-handler"
    >
      {renderContent()}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default OAuthCallbackHandler;