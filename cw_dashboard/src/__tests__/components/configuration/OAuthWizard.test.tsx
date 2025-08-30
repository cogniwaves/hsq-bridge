/**
 * OAuth Wizard Component Tests
 * Comprehensive test suite for OAuth authorization wizard
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthWizard } from '../../../components/configuration/OAuthWizard';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { Platform } from '../../../types/configuration.types';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Setup MSW server for API mocking
const server = setupServer(
  rest.get('/api/config/:platform/oauth/authorize', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          authorizationUrl: 'https://auth.example.com/oauth/authorize',
          state: 'test-state-123',
          codeChallenge: 'test-challenge',
          codeChallengeMethod: 'S256'
        }
      })
    );
  }),
  rest.post('/api/config/:platform/oauth/callback', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          platform: req.params.platform,
          isActive: true,
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123'
        }
      })
    );
  }),
  rest.post('/api/config/:platform/oauth/refresh', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        message: 'Token refreshed successfully'
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('OAuthWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    platform: 'QUICKBOOKS' as Platform,
    isOpen: true,
    onComplete: mockOnComplete,
    onCancel: mockOnCancel
  };

  const renderWithTheme = (component: React.ReactElement) => {
    return render(
      <ThemeProvider>
        {component}
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.open
    global.open = jest.fn();
    // Mock crypto for PKCE
    global.crypto = {
      getRandomValues: jest.fn((array) => {
        return array.fill(1);
      }),
      subtle: {
        digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32)))
      }
    } as any;
  });

  describe('Wizard Steps', () => {
    it('should render introduction step', () => {
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      expect(screen.getByText(/Connect QuickBooks/i)).toBeInTheDocument();
      expect(screen.getByText(/authorize access to your QuickBooks account/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Authorization/i })).toBeInTheDocument();
    });

    it('should show platform-specific information', () => {
      renderWithTheme(
        <OAuthWizard 
          {...defaultProps} 
          platform="STRIPE"
        />
      );

      expect(screen.getByText(/Connect Stripe/i)).toBeInTheDocument();
      expect(screen.getByText(/Stripe account/i)).toBeInTheDocument();
    });

    it('should progress through wizard steps', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      // Step 1: Introduction
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
      
      const startButton = screen.getByRole('button', { name: /Start Authorization/i });
      await user.click(startButton);

      // Step 2: Pre-authorization
      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
        expect(screen.getByText(/Review Permissions/i)).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /Continue to QuickBooks/i });
      await user.click(continueButton);

      // Should open authorization window
      expect(global.open).toHaveBeenCalledWith(
        expect.stringContaining('https://auth.example.com'),
        'oauth-popup',
        expect.any(String)
      );
    });

    it('should handle OAuth callback', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      // Navigate to authorization step
      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Simulate OAuth callback
      await waitFor(() => {
        expect(screen.getByText(/Waiting for authorization/i)).toBeInTheDocument();
      });

      // Simulate successful callback
      window.postMessage({
        type: 'oauth-callback',
        code: 'auth-code-123',
        state: 'test-state-123'
      }, '*');

      await waitFor(() => {
        expect(screen.getByText(/Authorization successful/i)).toBeInTheDocument();
      });

      expect(mockOnComplete).toHaveBeenCalledWith({
        platform: 'QUICKBOOKS',
        isActive: true,
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it('should show completion step', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Simulate successful OAuth
      window.postMessage({
        type: 'oauth-callback',
        code: 'auth-code-123',
        state: 'test-state-123'
      }, '*');

      await waitFor(() => {
        expect(screen.getByText(/Successfully connected/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Finish/i })).toBeInTheDocument();
      });
    });
  });

  describe('PKCE Support', () => {
    it('should generate PKCE parameters', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      await waitFor(() => {
        expect(global.crypto.getRandomValues).toHaveBeenCalled();
        expect(global.crypto.subtle.digest).toHaveBeenCalled();
      });
    });

    it('should include code verifier in callback', async () => {
      const user = userEvent.setup();
      
      server.use(
        rest.post('/api/config/:platform/oauth/callback', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toHaveProperty('codeVerifier');
          return res(ctx.json({ success: true, data: {} }));
        })
      );

      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      window.postMessage({
        type: 'oauth-callback',
        code: 'auth-code-123',
        state: 'test-state-123'
      }, '*');

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authorization errors', async () => {
      server.use(
        rest.get('/api/config/:platform/oauth/authorize', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ error: 'Failed to generate authorization URL' })
          );
        })
      );

      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to generate authorization URL/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });

    it('should handle OAuth denial', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Simulate OAuth denial
      window.postMessage({
        type: 'oauth-error',
        error: 'access_denied',
        errorDescription: 'User denied access'
      }, '*');

      await waitFor(() => {
        expect(screen.getByText(/Authorization was denied/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
      });
    });

    it('should handle popup blocked', async () => {
      global.open = jest.fn().mockReturnValue(null);

      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      await waitFor(() => {
        expect(screen.getByText(/popup was blocked/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Open Manually/i })).toBeInTheDocument();
      });
    });

    it('should handle callback timeout', async () => {
      jest.useFakeTimers();
      
      const user = userEvent.setup({ delay: null });
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Fast-forward past timeout (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(screen.getByText(/Authorization timed out/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should validate state parameter', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Send callback with wrong state
      window.postMessage({
        type: 'oauth-callback',
        code: 'auth-code-123',
        state: 'wrong-state'
      }, '*');

      await waitFor(() => {
        expect(screen.getByText(/Invalid state parameter/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Navigation', () => {
    it('should allow going back to previous steps', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      // Go to step 2
      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
      });

      // Go back
      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    it('should handle cancel action', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should show confirmation before canceling mid-flow', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      // Progress to step 2
      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByText(/Step 2 of 4/i));

      // Try to cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Confirmation dialog should appear
      expect(screen.getByText(/Are you sure you want to cancel/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /Yes, Cancel/i });
      await user.click(confirmButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    it('should show refresh option for existing tokens', () => {
      renderWithTheme(
        <OAuthWizard 
          {...defaultProps} 
          existingConfig={{
            platform: 'QUICKBOOKS',
            hasRefreshToken: true,
            tokenExpiry: new Date(Date.now() + 3600000).toISOString()
          }}
        />
      );

      expect(screen.getByText(/existing connection found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Refresh Token/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reauthorize/i })).toBeInTheDocument();
    });

    it('should handle token refresh', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <OAuthWizard 
          {...defaultProps} 
          existingConfig={{
            platform: 'QUICKBOOKS',
            hasRefreshToken: true
          }}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /Refresh Token/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText(/Token refreshed successfully/i)).toBeInTheDocument();
      });

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it('should show expiry warning for soon-to-expire tokens', () => {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1); // Expires in 1 hour

      renderWithTheme(
        <OAuthWizard 
          {...defaultProps} 
          existingConfig={{
            platform: 'QUICKBOOKS',
            hasRefreshToken: true,
            tokenExpiry: expiryDate.toISOString()
          }}
        />
      );

      expect(screen.getByText(/Token expires in 1 hour/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('warning');
    });
  });

  describe('Platform-Specific Features', () => {
    it('should show QuickBooks company selection', async () => {
      server.use(
        rest.get('/api/quickbooks/companies', (req, res, ctx) => {
          return res(
            ctx.json({
              companies: [
                { id: 'company-1', name: 'Test Company 1' },
                { id: 'company-2', name: 'Test Company 2' }
              ]
            })
          );
        })
      );

      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} platform="QUICKBOOKS" />);

      // Progress through wizard
      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Complete OAuth
      window.postMessage({
        type: 'oauth-callback',
        code: 'auth-code-123',
        state: 'test-state-123'
      }, '*');

      await waitFor(() => {
        expect(screen.getByText(/Select Company/i)).toBeInTheDocument();
        expect(screen.getByText('Test Company 1')).toBeInTheDocument();
        expect(screen.getByText('Test Company 2')).toBeInTheDocument();
      });
    });

    it('should show Stripe account type selection', () => {
      renderWithTheme(<OAuthWizard {...defaultProps} platform="STRIPE" />);

      expect(screen.getByText(/Connect Stripe/i)).toBeInTheDocument();
      // Stripe uses API keys, not OAuth
      expect(screen.queryByText(/OAuth/i)).not.toBeInTheDocument();
      expect(screen.getByText(/API key/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithTheme(<OAuthWizard {...defaultProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      // Tab to start button
      await user.tab();
      expect(screen.getByRole('button', { name: /Start Authorization/i })).toHaveFocus();

      // Activate with Enter
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
      });

      // Tab to continue button
      await user.tab();
      await user.tab(); // Skip back button
      expect(screen.getByRole('button', { name: /Continue to QuickBooks/i })).toHaveFocus();
    });

    it('should announce step changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/Step 2 of 4/i);
      });
    });

    it('should have proper ARIA labels', () => {
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'OAuth Authorization Wizard');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Wizard progress');
    });
  });

  describe('Visual Feedback', () => {
    it('should show loading state during API calls', async () => {
      server.use(
        rest.get('/api/config/:platform/oauth/authorize', (req, res, ctx) => {
          return res(ctx.delay(1000), ctx.json({ success: true }));
        })
      );

      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      
      const continueButton = screen.getByRole('button', { name: /Continue to QuickBooks/i });
      await user.click(continueButton);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show step progress indicator', () => {
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');
      expect(progressBar).toHaveAttribute('aria-valuemax', '4');
    });

    it('should animate step transitions', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      const container = screen.getByRole('dialog');
      
      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));

      await waitFor(() => {
        expect(container).toHaveClass('step-transition');
      });
    });
  });

  describe('Security Features', () => {
    it('should validate authorization URL origin', async () => {
      server.use(
        rest.get('/api/config/:platform/oauth/authorize', (req, res, ctx) => {
          return res(
            ctx.json({
              success: true,
              data: {
                authorizationUrl: 'http://malicious.com/oauth', // Non-HTTPS
                state: 'test-state'
              }
            })
          );
        })
      );

      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid authorization URL/i)).toBeInTheDocument();
      });
    });

    it('should sanitize callback data', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Send callback with potential XSS
      window.postMessage({
        type: 'oauth-callback',
        code: '<script>alert("XSS")</script>',
        state: 'test-state-123'
      }, '*');

      await waitFor(() => {
        expect(screen.getByText(/Invalid authorization code/i)).toBeInTheDocument();
      });
    });

    it('should enforce same-origin for postMessage', async () => {
      const user = userEvent.setup();
      renderWithTheme(<OAuthWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Start Authorization/i }));
      await waitFor(() => screen.getByRole('button', { name: /Continue to QuickBooks/i }));
      await user.click(screen.getByRole('button', { name: /Continue to QuickBooks/i }));

      // Send callback from different origin
      const event = new MessageEvent('message', {
        data: {
          type: 'oauth-callback',
          code: 'auth-code-123',
          state: 'test-state-123'
        },
        origin: 'https://malicious.com'
      });

      window.dispatchEvent(event);

      // Should not process the message
      await waitFor(() => {
        expect(screen.getByText(/Waiting for authorization/i)).toBeInTheDocument();
      });
    });
  });
});