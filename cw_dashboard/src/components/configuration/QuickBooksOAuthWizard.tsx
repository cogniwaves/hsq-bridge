/**
 * QuickBooks OAuth Wizard Component
 * Complete OAuth flow management with PKCE security
 * Step-by-step authorization with error recovery
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../design-system/themes/themeProvider';
import { QuickBooksOAuthFlowProps, QuickBooksOAuthState } from './types';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  BuildingOffice2Icon,
  ArrowPathIcon,
  XMarkIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ClockIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export function QuickBooksOAuthWizard({
  onComplete,
  onCancel,
  initialState,
  redirectUri,
  environment = 'sandbox',
  className = '',
}: QuickBooksOAuthFlowProps) {
  const { theme, resolvedMode } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  // OAuth state management
  const [oauthState, setOauthState] = useState<QuickBooksOAuthState>({
    step: initialState?.step || 'initiate',
    authUrl: initialState?.authUrl,
    state: initialState?.state,
    code: initialState?.code,
    realmId: initialState?.realmId,
    companyInfo: initialState?.companyInfo,
    error: initialState?.error,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<Record<string, any> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'pending' | 'testing' | 'connected' | 'failed'>('pending');

  // Check for OAuth callback parameters
  useEffect(() => {
    const oauth = searchParams.get('oauth');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (oauth === 'quickbooks') {
      if (error) {
        setOauthState(prev => ({
          ...prev,
          step: 'callback',
          error: errorDescription || error,
        }));
      } else if (code && state) {
        setOauthState(prev => ({
          ...prev,
          step: 'callback',
          code,
          state,
          realmId: realmId || prev.realmId,
        }));
        // Automatically exchange code for tokens
        handleTokenExchange(code, state, realmId || '');
      }
    }
  }, [searchParams]);

  // Initiate OAuth flow
  const initiateOAuth = async () => {
    setIsLoading(true);
    setOauthState(prev => ({ ...prev, error: undefined }));

    try {
      const response = await fetch('/api/config/quickbooks/oauth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.authUrl) {
        setOauthState(prev => ({
          ...prev,
          step: 'authorize',
          authUrl: data.authUrl,
          state: data.state,
        }));

        // Open authorization URL in new window
        const authWindow = window.open(
          data.authUrl,
          'QuickBooksAuth',
          'width=800,height=600,menubar=no,toolbar=no,location=no,status=no'
        );

        // Monitor the popup window
        const checkInterval = setInterval(() => {
          if (authWindow && authWindow.closed) {
            clearInterval(checkInterval);
            // Check if we received the callback
            if (oauthState.step === 'authorize') {
              setOauthState(prev => ({
                ...prev,
                error: 'Authorization window was closed',
              }));
            }
          }
        }, 1000);
      } else {
        setOauthState(prev => ({
          ...prev,
          error: data.error || 'Failed to initiate OAuth flow',
        }));
      }
    } catch (error) {
      setOauthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initiate OAuth',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Exchange authorization code for tokens
  const handleTokenExchange = async (code: string, state: string, realmId: string) => {
    setIsLoading(true);
    setConnectionStatus('testing');

    try {
      const response = await fetch('/api/config/quickbooks/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          realmId,
        }),
      });

      const data = await response.json();

      if (data.success && data.tokens) {
        setTokenInfo(data.tokens);
        setOauthState(prev => ({
          ...prev,
          step: 'complete',
          companyInfo: data.companyInfo,
          error: undefined,
        }));
        setConnectionStatus('connected');

        // Test the connection
        await testConnection(data.tokens);
      } else {
        setOauthState(prev => ({
          ...prev,
          step: 'callback',
          error: data.error || 'Failed to exchange code for tokens',
        }));
        setConnectionStatus('failed');
      }
    } catch (error) {
      setOauthState(prev => ({
        ...prev,
        step: 'callback',
        error: error instanceof Error ? error.message : 'Failed to exchange tokens',
      }));
      setConnectionStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Test the connection with new tokens
  const testConnection = async (tokens: Record<string, any>) => {
    try {
      const response = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'QUICKBOOKS',
          config: {
            accessToken: tokens.accessToken,
            realmId: tokens.realmId,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('failed');
    }
  };

  // Revoke tokens and reset
  const revokeTokens = async () => {
    if (!tokenInfo?.refreshToken) return;

    setIsLoading(true);

    try {
      await fetch('/api/config/quickbooks/oauth', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: tokenInfo.refreshToken,
        }),
      });

      // Reset state
      setOauthState({
        step: 'initiate',
      });
      setTokenInfo(null);
      setConnectionStatus('pending');
    } catch (error) {
      console.error('Failed to revoke tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Complete the OAuth flow
  const handleComplete = async () => {
    if (tokenInfo && onComplete) {
      await onComplete(tokenInfo);
    }
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
    maxWidth: '600px',
    width: '100%',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: theme.spacing?.container?.lg || '24px',
    borderBottom: `1px solid ${colors.outlineVariant}`,
    backgroundColor: colors.primaryContainer,
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.headlineMedium,
    color: colors.onPrimaryContainer,
    margin: 0,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const contentStyle: React.CSSProperties = {
    padding: theme.spacing?.container?.lg || '24px',
    flex: 1,
  };

  // Render step content
  const renderStepContent = () => {
    switch (oauthState.step) {
      case 'initiate':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Introduction */}
            <div>
              <h3
                style={{
                  ...theme.typography?.headlineSmall,
                  color: colors.onSurface,
                  margin: 0,
                  marginBottom: '12px',
                }}
              >
                Connect to QuickBooks Online
              </h3>
              <p
                style={{
                  ...theme.typography?.bodyLarge,
                  color: colors.onSurfaceVariant,
                  margin: 0,
                }}
              >
                Authorize this application to access your QuickBooks Online company data.
                This secure OAuth 2.0 flow ensures your credentials are never shared.
              </p>
            </div>

            {/* Security Features */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              <SecurityFeature
                icon={<ShieldCheckIcon />}
                title="Secure OAuth 2.0"
                description="Industry-standard security"
              />
              <SecurityFeature
                icon={<LockClosedIcon />}
                title="PKCE Protection"
                description="Enhanced security flow"
              />
              <SecurityFeature
                icon={<GlobeAltIcon />}
                title={environment === 'production' ? 'Production' : 'Sandbox'}
                description={`${environment === 'production' ? 'Live' : 'Test'} environment`}
              />
              <SecurityFeature
                icon={<ClockIcon />}
                title="Auto-Refresh"
                description="Tokens refresh automatically"
              />
            </div>

            {/* Environment Notice */}
            {environment === 'sandbox' && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.warningContainer,
                  borderRadius: '8px',
                  border: `1px solid ${colors.warning}`,
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <InformationCircleIcon
                  style={{
                    width: '20px',
                    height: '20px',
                    color: colors.warning,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      ...theme.typography?.labelLarge,
                      color: colors.onWarningContainer,
                      fontWeight: 600,
                    }}
                  >
                    Sandbox Environment
                  </div>
                  <div
                    style={{
                      ...theme.typography?.bodySmall,
                      color: colors.onWarningContainer,
                      opacity: 0.9,
                    }}
                  >
                    You're connecting to a test environment. Use sandbox credentials only.
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={initiateOAuth}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '16px 24px',
                backgroundColor: colors.primary,
                color: colors.onPrimary,
                border: 'none',
                borderRadius: '8px',
                ...theme.typography?.labelLarge,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
              }}
            >
              {isLoading ? (
                <>
                  <ArrowPathIcon
                    style={{
                      width: '20px',
                      height: '20px',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  Initializing...
                </>
              ) : (
                <>
                  <BuildingOffice2Icon style={{ width: '20px', height: '20px' }} />
                  Connect to QuickBooks
                  <ArrowRightIcon style={{ width: '16px', height: '16px' }} />
                </>
              )}
            </button>
          </div>
        );

      case 'authorize':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div
              style={{
                padding: '20px',
                backgroundColor: colors.primaryContainer,
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  margin: '0 auto 16px',
                  border: `3px solid ${colors.primary}`,
                  borderTop: `3px solid transparent`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <h3
                style={{
                  ...theme.typography?.headlineSmall,
                  color: colors.onPrimaryContainer,
                  margin: 0,
                  marginBottom: '8px',
                }}
              >
                Waiting for Authorization
              </h3>
              <p
                style={{
                  ...theme.typography?.bodyMedium,
                  color: colors.onPrimaryContainer,
                  margin: 0,
                  opacity: 0.9,
                }}
              >
                Please complete the authorization in the QuickBooks window.
                This window will update automatically once authorization is complete.
              </p>
            </div>

            {oauthState.authUrl && (
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    ...theme.typography?.bodySmall,
                    color: colors.onSurfaceVariant,
                    marginBottom: '12px',
                  }}
                >
                  Didn't see the authorization window?
                </p>
                <button
                  onClick={() => window.open(oauthState.authUrl, '_blank')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: colors.primary,
                    border: `1px solid ${colors.primary}`,
                    borderRadius: '6px',
                    ...theme.typography?.labelMedium,
                    cursor: 'pointer',
                  }}
                >
                  Open Authorization Window
                </button>
              </div>
            )}
          </div>
        );

      case 'callback':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    margin: '0 auto 16px',
                    border: `3px solid ${colors.outlineVariant}`,
                    borderTop: `3px solid ${colors.primary}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <h3
                  style={{
                    ...theme.typography?.headlineSmall,
                    color: colors.onSurface,
                    margin: 0,
                    marginBottom: '8px',
                  }}
                >
                  Exchanging Tokens
                </h3>
                <p
                  style={{
                    ...theme.typography?.bodyMedium,
                    color: colors.onSurfaceVariant,
                    margin: 0,
                  }}
                >
                  Securely exchanging authorization code for access tokens...
                </p>
              </div>
            ) : oauthState.error ? (
              <div>
                <div
                  style={{
                    padding: '20px',
                    backgroundColor: colors.errorContainer,
                    borderRadius: '8px',
                    border: `1px solid ${colors.error}`,
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <ExclamationTriangleIcon
                      style={{
                        width: '24px',
                        height: '24px',
                        color: colors.error,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <h3
                        style={{
                          ...theme.typography?.labelLarge,
                          color: colors.error,
                          margin: 0,
                          marginBottom: '4px',
                        }}
                      >
                        Authorization Failed
                      </h3>
                      <p
                        style={{
                          ...theme.typography?.bodyMedium,
                          color: colors.onErrorContainer,
                          margin: 0,
                        }}
                      >
                        {oauthState.error}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={initiateOAuth}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                    border: 'none',
                    borderRadius: '8px',
                    ...theme.typography?.labelLarge,
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <ArrowPathIcon style={{ width: '16px', height: '16px' }} />
                  Try Again
                </button>
              </div>
            ) : null}
          </div>
        );

      case 'complete':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Success Message */}
            <div
              style={{
                padding: '20px',
                backgroundColor: colors.successContainer,
                borderRadius: '8px',
                border: `1px solid #10b981`,
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <CheckCircleIcon
                  style={{
                    width: '24px',
                    height: '24px',
                    color: '#10b981',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      ...theme.typography?.labelLarge,
                      color: '#047857',
                      margin: 0,
                      marginBottom: '4px',
                    }}
                  >
                    Successfully Connected
                  </h3>
                  <p
                    style={{
                      ...theme.typography?.bodyMedium,
                      color: '#047857',
                      margin: 0,
                    }}
                  >
                    Your QuickBooks account has been successfully connected.
                  </p>
                </div>
              </div>
            </div>

            {/* Company Information */}
            {oauthState.companyInfo && (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: colors.surfaceVariant,
                  borderRadius: '8px',
                }}
              >
                <h4
                  style={{
                    ...theme.typography?.labelLarge,
                    color: colors.onSurfaceVariant,
                    margin: 0,
                    marginBottom: '12px',
                  }}
                >
                  Connected Company
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <InfoRow label="Company Name" value={oauthState.companyInfo.name} />
                  <InfoRow label="Company ID" value={oauthState.companyInfo.id} />
                  {oauthState.companyInfo.country && (
                    <InfoRow label="Country" value={oauthState.companyInfo.country} />
                  )}
                </div>
              </div>
            )}

            {/* Connection Status */}
            {connectionStatus === 'connected' && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.primaryContainer,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
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
                    ...theme.typography?.bodyMedium,
                    color: colors.onPrimaryContainer,
                  }}
                >
                  Connection verified and active
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleComplete}
                style={{
                  flex: 1,
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
                Complete Setup
              </button>
              <button
                onClick={revokeTokens}
                style={{
                  padding: '12px 20px',
                  backgroundColor: 'transparent',
                  color: colors.error,
                  border: `1px solid ${colors.error}`,
                  borderRadius: '8px',
                  ...theme.typography?.labelLarge,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Helper component for security features
  const SecurityFeature = ({ icon, title, description }: any) => (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        backgroundColor: colors.surfaceVariant,
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.primary,
          flexShrink: 0,
        }}
      >
        {React.cloneElement(icon, { style: { width: '20px', height: '20px' } })}
      </div>
      <div>
        <div
          style={{
            ...theme.typography?.labelMedium,
            color: colors.onSurface,
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        <div
          style={{
            ...theme.typography?.bodySmall,
            color: colors.onSurfaceVariant,
            opacity: 0.8,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );

  // Helper component for info rows
  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span
        style={{
          ...theme.typography?.bodyMedium,
          color: colors.onSurfaceVariant,
          opacity: 0.8,
        }}
      >
        {label}:
      </span>
      <span
        style={{
          ...theme.typography?.bodyMedium,
          color: colors.onSurface,
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div
      className={`quickbooks-oauth-wizard ${className}`}
      style={containerStyle}
      data-testid="quickbooks-oauth-wizard"
    >
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          <BuildingOffice2Icon style={{ width: '28px', height: '28px' }} />
          QuickBooks Authorization
        </h2>
        <p
          style={{
            ...theme.typography?.bodyMedium,
            color: colors.onPrimaryContainer,
            margin: 0,
            opacity: 0.9,
          }}
        >
          Secure OAuth 2.0 authentication with PKCE
        </p>
      </div>

      {/* Content */}
      <div style={contentStyle}>{renderStepContent()}</div>

      {/* Error Display */}
      {oauthState.error && oauthState.step !== 'callback' && (
        <div
          style={{
            padding: '16px',
            backgroundColor: colors.errorContainer,
            borderTop: `1px solid ${colors.error}`,
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExclamationTriangleIcon
              style={{
                width: '20px',
                height: '20px',
                color: colors.error,
              }}
            />
            <span
              style={{
                ...theme.typography?.bodyMedium,
                color: colors.onErrorContainer,
              }}
            >
              {oauthState.error}
            </span>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      {onCancel && oauthState.step !== 'complete' && (
        <div
          style={{
            padding: theme.spacing?.container?.md || '16px',
            borderTop: `1px solid ${colors.outlineVariant}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: colors.onSurfaceVariant,
              border: `1px solid ${colors.outlineVariant}`,
              borderRadius: '6px',
              ...theme.typography?.labelMedium,
              cursor: 'pointer',
            }}
          >
            <XMarkIcon style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            Cancel
          </button>
        </div>
      )}

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

export default QuickBooksOAuthWizard;