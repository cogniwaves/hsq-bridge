/**
 * Navigation Error Handling Tests
 * Tests for graceful degradation and error recovery in navigation system
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNavigation } from '../../../components/navigation/SideNavigation';
import type { NavigationConfig } from '../../../components/navigation/types';

// Error boundary component for testing
class NavigationErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" aria-live="assertive">
          <h2>Navigation Error</h2>
          <p>Something went wrong with the navigation.</p>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

describe('Navigation Error Handling', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    user = userEvent.setup();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Configuration Errors', () => {
    it('should handle null configuration gracefully', async () => {
      render(<SideNavigation config={null as any} />);
      
      await waitFor(() => {
        // Should render with fallback configuration
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByText(/navigation unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle undefined configuration', async () => {
      render(<SideNavigation />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        // Should not crash
      });
    });

    it('should handle malformed configuration objects', async () => {
      const malformedConfig = {
        sections: 'not an array',
        invalid: true,
      } as any;

      render(<SideNavigation config={malformedConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/invalid configuration/i)).toBeInTheDocument();
      });
    });

    it('should handle missing required properties', async () => {
      const incompleteConfig: NavigationConfig = {
        sections: [
          {
            id: 'test',
            items: [
              { label: 'Missing ID', icon: 'home' } as any, // Missing required 'id' property
            ],
          },
        ],
      };

      render(<SideNavigation config={incompleteConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/configuration error/i)).toBeInTheDocument();
      });
    });

    it('should handle circular references in nested items', async () => {
      const circularConfig: any = {
        sections: [
          {
            id: 'circular',
            items: [
              {
                id: 'parent',
                label: 'Parent',
                icon: 'home',
                children: [], // Will be modified to create circular reference
              },
            ],
          },
        ],
      };

      // Create circular reference
      circularConfig.sections[0].items[0].children = [circularConfig.sections[0].items[0]];

      render(<SideNavigation config={circularConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/circular reference detected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Network and API Errors', () => {
    it('should handle API failures gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load navigation data/i)).toBeInTheDocument();
        
        // Should provide retry option
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should handle timeout errors', async () => {
      global.fetch = jest.fn().mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should handle 500 server errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server temporarily unavailable' }),
      });
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByText(/server temporarily unavailable/i)).toBeInTheDocument();
        
        // Should show appropriate user message
        expect(screen.getByText(/please try again later/i)).toBeInTheDocument();
      });
    });

    it('should handle 401 unauthorized errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Token expired' }),
      });
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in again/i })).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument();
        expect(screen.getByText(/check your network/i)).toBeInTheDocument();
      });
    });
  });

  describe('Component Error Recovery', () => {
    it('should recover from JavaScript errors', async () => {
      const erroringConfig = {
        sections: [
          {
            id: 'error',
            items: [
              {
                id: 'error-item',
                label: 'Error Item',
                icon: 'home',
                onClick: () => {
                  throw new Error('Component error');
                },
              },
            ],
          },
        ],
      };

      const onError = jest.fn();
      
      render(
        <NavigationErrorBoundary onError={onError}>
          <SideNavigation config={erroringConfig} />
        </NavigationErrorBoundary>
      );
      
      await waitFor(async () => {
        const errorItem = screen.getByRole('button', { name: /error item/i });
        await user.click(errorItem);
        
        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText('Navigation Error')).toBeInTheDocument();
          expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
        
        // Should be able to recover
        const tryAgainButton = screen.getByRole('button', { name: /try again/i });
        await user.click(tryAgainButton);
        
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    it('should isolate errors to specific sections', async () => {
      const ErrorComponent = () => {
        throw new Error('Section error');
      };

      const configWithErrorSection = {
        sections: [
          {
            id: 'working',
            items: [
              { id: 'working-item', label: 'Working Item', icon: 'home', href: '/working' },
            ],
          },
          {
            id: 'error',
            component: ErrorComponent,
            items: [],
          },
        ],
      };

      render(<SideNavigation config={configWithErrorSection} />);
      
      await waitFor(() => {
        // Working section should still be visible
        expect(screen.getByRole('link', { name: /working item/i })).toBeInTheDocument();
        
        // Error section should show error state
        expect(screen.getByText(/section temporarily unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle render errors gracefully', async () => {
      const BadComponent = () => {
        // This will cause a render error
        return <div>{undefined.nonExistentProperty}</div>;
      };

      const configWithBadComponent = {
        sections: [
          {
            id: 'bad',
            items: [
              {
                id: 'bad-item',
                label: 'Bad Item',
                icon: 'home',
                component: BadComponent,
              },
            ],
          },
        ],
      };

      render(
        <NavigationErrorBoundary>
          <SideNavigation config={configWithBadComponent} />
        </NavigationErrorBoundary>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
      });
    });
  });

  describe('Data Validation Errors', () => {
    it('should handle invalid icon references', async () => {
      const configWithInvalidIcon = {
        sections: [
          {
            id: 'test',
            items: [
              { id: 'item', label: 'Test Item', icon: 'non-existent-icon', href: '/test' },
            ],
          },
        ],
      };

      render(<SideNavigation config={configWithInvalidIcon} />);
      
      await waitFor(() => {
        const item = screen.getByRole('link', { name: /test item/i });
        expect(item).toBeInTheDocument();
        
        // Should show fallback icon
        const fallbackIcon = screen.getByTestId('fallback-icon');
        expect(fallbackIcon).toBeInTheDocument();
      });
    });

    it('should handle invalid URLs', async () => {
      const configWithInvalidURL = {
        sections: [
          {
            id: 'test',
            items: [
              { id: 'item', label: 'Test Item', icon: 'home', href: 'invalid-url' },
            ],
          },
        ],
      };

      render(<SideNavigation config={configWithInvalidURL} />);
      
      await waitFor(() => {
        const item = screen.getByRole('button', { name: /test item/i }); // Should be button, not link
        expect(item).toBeInTheDocument();
        expect(item).toHaveAttribute('aria-disabled', 'true');
        expect(item).toHaveAttribute('title', 'Invalid URL');
      });
    });

    it('should validate permission requirements', async () => {
      const configWithInvalidPermissions = {
        sections: [
          {
            id: 'test',
            items: [
              {
                id: 'item',
                label: 'Admin Item',
                icon: 'shield',
                href: '/admin',
                requiredPermissions: null, // Invalid permissions format
              },
            ],
          },
        ],
      };

      render(<SideNavigation config={configWithInvalidPermissions} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/invalid permissions configuration/i)).toBeInTheDocument();
      });
    });
  });

  describe('Browser Compatibility Fallbacks', () => {
    it('should work without modern JavaScript features', async () => {
      // Mock older browser environment
      const originalPromise = global.Promise;
      delete (global as any).Promise;

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByText(/basic navigation mode/i)).toBeInTheDocument();
      });

      global.Promise = originalPromise;
    });

    it('should handle missing CSS custom property support', () => {
      // Mock unsupported CSS custom properties
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: jest.fn().mockImplementation((prop) => {
            return !prop.startsWith('--'); // No custom property support
          }),
        },
        configurable: true,
      });

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('fallback-styles');
    });

    it('should handle missing localStorage', async () => {
      // Mock missing localStorage
      const originalLocalStorage = window.localStorage;
      delete (window as any).localStorage;

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        // Should work without preference persistence
      });

      window.localStorage = originalLocalStorage;
    });

    it('should handle missing WebSocket support', async () => {
      // Mock missing WebSocket
      const originalWebSocket = global.WebSocket;
      delete (global as any).WebSocket;
      
      process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET = 'true';

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        // Should fall back to polling
        expect(screen.getByText(/using basic updates/i)).toBeInTheDocument();
      });

      global.WebSocket = originalWebSocket;
    });
  });

  describe('Accessibility Error Handling', () => {
    it('should provide meaningful error messages to screen readers', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
        expect(errorAlert).toHaveTextContent(/navigation data could not be loaded/i);
        
        // Should provide context for screen readers
        expect(errorAlert).toHaveAttribute('aria-describedby');
        const description = document.getElementById(
          errorAlert.getAttribute('aria-describedby')!
        );
        expect(description).toHaveTextContent(/api error/i);
      });
    });

    it('should maintain keyboard navigation during errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(async () => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        
        // Should be keyboard accessible
        retryButton.focus();
        expect(retryButton).toHaveFocus();
        
        await user.keyboard('{Enter}');
        // Should trigger retry logic
      });
    });

    it('should announce error recovery to screen readers', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValue(mockFactories.createMockResponse({ data: 'success' }));
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(async () => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        await user.click(retryButton);
        
        await waitFor(() => {
          const successMessage = screen.getByRole('status');
          expect(successMessage).toHaveTextContent(/navigation restored/i);
          expect(successMessage).toHaveAttribute('aria-live', 'polite');
        });
      });
    });
  });

  describe('Memory and Resource Error Handling', () => {
    it('should handle out of memory gracefully', async () => {
      // Mock memory exhaustion
      const originalError = global.Error;
      global.Error = class extends originalError {
        constructor(message?: string) {
          super(message);
          if (message?.includes('memory')) {
            this.name = 'RangeError';
            this.message = 'Maximum call stack size exceeded';
          }
        }
      };

      const largeConfig = {
        sections: Array.from({ length: 10000 }, (_, i) => ({
          id: `section-${i}`,
          items: Array.from({ length: 100 }, (_, j) => ({
            id: `item-${i}-${j}`,
            label: `Item ${i}-${j}`,
            icon: 'home',
          })),
        })),
      };

      render(<SideNavigation config={largeConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/navigation too large/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /use simplified view/i })).toBeInTheDocument();
      });

      global.Error = originalError;
    });

    it('should handle resource loading failures', async () => {
      // Mock resource loading error
      const originalError = console.error;
      console.error = jest.fn().mockImplementation((message) => {
        if (message.includes('ChunkLoadError')) {
          // Simulate chunk loading error
        }
      });

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      // Simulate chunk loading failure
      const event = new ErrorEvent('error', {
        message: 'Loading chunk 0 failed',
        filename: '/chunk-0.js',
      });
      window.dispatchEvent(event);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/please refresh the page/i)).toBeInTheDocument();
      });

      console.error = originalError;
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should implement exponential backoff for retries', async () => {
      let attemptCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve(mockFactories.createMockResponse({ success: true }));
      });

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(async () => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        
        // First retry - immediate
        await user.click(retryButton);
        expect(attemptCount).toBe(2);
        
        // Second retry - should wait longer
        await user.click(retryButton);
        
        await waitFor(() => {
          expect(attemptCount).toBe(3);
          expect(screen.getByRole('navigation')).toBeInTheDocument();
        });
      });
    });

    it('should provide fallback functionality during outages', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        // Should show offline mode
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
        
        // Basic navigation should still work
        const basicNavItems = screen.getAllByRole('link');
        expect(basicNavItems.length).toBeGreaterThan(0);
        
        // Should show cached/static content
        expect(screen.getByText(/using cached navigation/i)).toBeInTheDocument();
      });
    });

    it('should maintain critical functionality during partial failures', async () => {
      // Mock partial API failure
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('badges')) {
          return Promise.reject(new Error('Badge service down'));
        }
        return Promise.resolve(mockFactories.createMockResponse({ data: 'success' }));
      });

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        // Core navigation should work
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        const navItems = screen.getAllByRole('link');
        expect(navItems.length).toBeGreaterThan(0);
        
        // Should show warning about degraded functionality
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/some features unavailable/i)).toBeInTheDocument();
        
        // Badges should be hidden or show fallback
        expect(screen.queryByText(/\d+/)).toBeNull(); // No badge numbers visible
      });
    });
  });
});