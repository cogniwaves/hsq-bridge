/**
 * ConfigurationCard Component Tests
 * Comprehensive test suite for configuration card component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurationCard } from '../../../components/configuration/ConfigurationCard';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { Platform, HealthStatus } from '../../../types/configuration.types';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Mock Material Design 3 icons
jest.mock('../../../components/icons', () => ({
  CheckCircleIcon: () => <div data-testid="check-icon">✓</div>,
  XCircleIcon: () => <div data-testid="error-icon">✗</div>,
  ExclamationTriangleIcon: () => <div data-testid="warning-icon">⚠</div>,
  CloudIcon: () => <div data-testid="cloud-icon">☁</div>,
  CreditCardIcon: () => <div data-testid="card-icon">💳</div>,
  CalculatorIcon: () => <div data-testid="calc-icon">🧮</div>
}));

describe('ConfigurationCard', () => {
  const mockOnEdit = jest.fn();
  const mockOnTest = jest.fn();
  const mockOnDelete = jest.fn();

  const defaultProps = {
    platform: 'HUBSPOT' as Platform,
    isConfigured: true,
    isActive: true,
    healthStatus: HealthStatus.HEALTHY,
    lastSync: '2024-01-15T10:30:00Z',
    onEdit: mockOnEdit,
    onTest: mockOnTest,
    onDelete: mockOnDelete
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
  });

  describe('Rendering', () => {
    it('should render HubSpot configuration card', () => {
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      expect(screen.getByText('HubSpot')).toBeInTheDocument();
      expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      expect(screen.getByTestId('cloud-icon')).toBeInTheDocument();
    });

    it('should render Stripe configuration card', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          platform="STRIPE" 
        />
      );

      expect(screen.getByText('Stripe')).toBeInTheDocument();
      expect(screen.getByTestId('card-icon')).toBeInTheDocument();
    });

    it('should render QuickBooks configuration card', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          platform="QUICKBOOKS" 
        />
      );

      expect(screen.getByText('QuickBooks')).toBeInTheDocument();
      expect(screen.getByTestId('calc-icon')).toBeInTheDocument();
    });

    it('should show not configured state', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          isConfigured={false}
          healthStatus={undefined}
        />
      );

      expect(screen.getByText(/Not Configured/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configure/i })).toBeInTheDocument();
    });

    it('should show inactive state', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          isActive={false}
        />
      );

      expect(screen.getByText(/Inactive/i)).toBeInTheDocument();
    });
  });

  describe('Health Status Display', () => {
    it('should display healthy status', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.HEALTHY}
        />
      );

      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    });

    it('should display unhealthy status', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.UNHEALTHY}
        />
      );

      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
      expect(screen.getByText(/Connection Error/i)).toBeInTheDocument();
    });

    it('should display degraded status', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.DEGRADED}
        />
      );

      expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
      expect(screen.getByText(/Degraded/i)).toBeInTheDocument();
    });

    it('should display checking status', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.CHECKING}
        />
      );

      expect(screen.getByText(/Checking/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Last Sync Display', () => {
    it('should display last sync time', () => {
      const recentSync = new Date();
      recentSync.setMinutes(recentSync.getMinutes() - 5);

      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          lastSync={recentSync.toISOString()}
        />
      );

      expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument();
    });

    it('should display never synced', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          lastSync={undefined}
        />
      );

      expect(screen.getByText(/Never synced/i)).toBeInTheDocument();
    });

    it('should format old sync times', () => {
      const oldSync = new Date('2023-01-01T00:00:00Z');

      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          lastSync={oldSync.toISOString()}
        />
      );

      expect(screen.getByText(/Jan 1, 2023/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onEdit when edit button clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      const editButton = screen.getByRole('button', { name: /Edit/i });
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith('HUBSPOT');
    });

    it('should call onTest when test button clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      await user.click(testButton);

      expect(mockOnTest).toHaveBeenCalledWith('HUBSPOT');
    });

    it('should call onDelete when delete button clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      const moreButton = screen.getByRole('button', { name: /More options/i });
      await user.click(moreButton);

      const deleteButton = screen.getByRole('menuitem', { name: /Delete/i });
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('HUBSPOT');
    });

    it('should show confirmation dialog before delete', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          requireDeleteConfirmation={true}
        />
      );

      const moreButton = screen.getByRole('button', { name: /More options/i });
      await user.click(moreButton);

      const deleteButton = screen.getByRole('menuitem', { name: /Delete/i });
      await user.click(deleteButton);

      // Check confirmation dialog appears
      expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /Confirm/i });
      await user.click(confirmButton);

      expect(mockOnDelete).toHaveBeenCalledWith('HUBSPOT');
    });

    it('should disable actions when card is disabled', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          disabled={true}
        />
      );

      expect(screen.getByRole('button', { name: /Edit/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDisabled();
    });
  });

  describe('Loading States', () => {
    it('should show loading state', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          isLoading={true}
        />
      );

      expect(screen.getAllByRole('progressbar')).toHaveLength(2); // Skeleton loaders
    });

    it('should show testing state', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          testInProgress={true}
        />
      );

      const testButton = screen.getByRole('button', { name: /Testing/i });
      expect(testButton).toBeDisabled();
      expect(within(testButton).getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          error="Failed to connect to HubSpot API"
        />
      );

      expect(screen.getByText(/Failed to connect to HubSpot API/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should show retry button on error', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.UNHEALTHY}
          error="Connection timeout"
          onRetry={mockOnTest}
        />
      );

      const retryButton = screen.getByRole('button', { name: /Retry/i });
      await user.click(retryButton);

      expect(mockOnTest).toHaveBeenCalledWith('HUBSPOT');
    });
  });

  describe('Advanced Features', () => {
    it('should display sync statistics', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          syncStats={{
            totalSynced: 1250,
            successRate: 98.5,
            lastError: null
          }}
        />
      );

      expect(screen.getByText(/1,250 items synced/i)).toBeInTheDocument();
      expect(screen.getByText(/98.5% success rate/i)).toBeInTheDocument();
    });

    it('should show OAuth expiry warning', () => {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 2); // Expires in 2 hours

      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          platform="QUICKBOOKS"
          oauthExpiry={expiryDate.toISOString()}
        />
      );

      expect(screen.getByText(/Token expires in 2 hours/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Refresh Token/i })).toBeInTheDocument();
    });

    it('should display rate limit information', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          rateLimit={{
            limit: 100,
            remaining: 25,
            resetAt: new Date(Date.now() + 3600000).toISOString()
          }}
        />
      );

      expect(screen.getByText(/25 of 100 requests remaining/i)).toBeInTheDocument();
      expect(screen.getByText(/Resets in 1 hour/i)).toBeInTheDocument();
    });

    it('should show circuit breaker status', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          circuitBreaker={{
            status: 'OPEN',
            openedAt: new Date().toISOString(),
            errorCount: 5
          }}
        />
      );

      expect(screen.getByText(/Circuit breaker is open/i)).toBeInTheDocument();
      expect(screen.getByText(/5 consecutive errors/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <ConfigurationCard {...defaultProps} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      // Tab to first button
      await user.tab();
      expect(screen.getByRole('button', { name: /Edit/i })).toHaveFocus();

      // Tab to test button
      await user.tab();
      expect(screen.getByRole('button', { name: /Test Connection/i })).toHaveFocus();

      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(mockOnTest).toHaveBeenCalled();
    });

    it('should have proper ARIA labels', () => {
      renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.UNHEALTHY}
        />
      );

      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'HubSpot configuration');
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce status changes', async () => {
      const { rerender } = renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.HEALTHY}
        />
      );

      rerender(
        <ThemeProvider>
          <ConfigurationCard 
            {...defaultProps} 
            healthStatus={HealthStatus.UNHEALTHY}
          />
        </ThemeProvider>
      );

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/Connection Error/i);
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme styles', () => {
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      const card = screen.getByRole('article');
      expect(card).toHaveClass('md3-card');
    });

    it('should support dark theme', () => {
      render(
        <ThemeProvider initialTheme="dark">
          <ConfigurationCard {...defaultProps} />
        </ThemeProvider>
      );

      const card = screen.getByRole('article');
      expect(card).toHaveClass('md3-card--dark');
    });

    it('should apply elevation on hover', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      const card = screen.getByRole('article');
      await user.hover(card);

      expect(card).toHaveClass('md3-card--elevated');
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      const card = screen.getByRole('article');
      expect(card).toHaveClass('md3-card--mobile');
    });

    it('should show compact actions on small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      // Actions should be in menu on mobile
      expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /More actions/i })).toBeInTheDocument();
    });
  });

  describe('Integration with Parent Components', () => {
    it('should work within a grid layout', () => {
      const { container } = render(
        <ThemeProvider>
          <div className="configuration-grid">
            <ConfigurationCard {...defaultProps} platform="HUBSPOT" />
            <ConfigurationCard {...defaultProps} platform="STRIPE" />
            <ConfigurationCard {...defaultProps} platform="QUICKBOOKS" />
          </div>
        </ThemeProvider>
      );

      const cards = container.querySelectorAll('.md3-card');
      expect(cards).toHaveLength(3);
    });

    it('should handle prop updates', () => {
      const { rerender } = renderWithTheme(
        <ConfigurationCard 
          {...defaultProps} 
          healthStatus={HealthStatus.HEALTHY}
        />
      );

      expect(screen.getByText(/Connected/i)).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <ConfigurationCard 
            {...defaultProps} 
            healthStatus={HealthStatus.UNHEALTHY}
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/Connection Error/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should memoize expensive computations', () => {
      const expensiveComputation = jest.fn(() => 'computed');
      
      const EnhancedCard = () => {
        const result = React.useMemo(() => expensiveComputation(), []);
        return (
          <ConfigurationCard 
            {...defaultProps} 
            customData={result}
          />
        );
      };

      const { rerender } = renderWithTheme(<EnhancedCard />);
      rerender(<ThemeProvider><EnhancedCard /></ThemeProvider>);

      expect(expensiveComputation).toHaveBeenCalledTimes(1);
    });

    it('should debounce rapid test clicks', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      
      renderWithTheme(<ConfigurationCard {...defaultProps} />);

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      
      // Click multiple times rapidly
      await user.click(testButton);
      await user.click(testButton);
      await user.click(testButton);

      jest.runAllTimers();

      // Should only call once due to debouncing
      expect(mockOnTest).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });
});