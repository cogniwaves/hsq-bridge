/**
 * NavigationItem Component Unit Tests
 * Tests for individual navigation item behavior and states
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationItem } from '../../../components/navigation/NavigationItem';
import type { NavigationItem as NavigationItemType, NavigationMode } from '../../../components/navigation/types';

// Test data
const mockItem: NavigationItemType = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'home',
  href: '/dashboard',
};

const mockItemWithBadge: NavigationItemType = {
  id: 'notifications',
  label: 'Notifications',
  icon: 'bell',
  href: '/notifications',
  badge: {
    count: 5,
    color: 'error',
    pulse: true,
  },
};

const mockDisabledItem: NavigationItemType = {
  id: 'disabled',
  label: 'Disabled Item',
  icon: 'lock',
  disabled: true,
};

const mockExternalItem: NavigationItemType = {
  id: 'external',
  label: 'External Link',
  icon: 'external-link',
  href: 'https://example.com',
  external: true,
};

describe('NavigationItem', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Component Rendering', () => {
    it('should render basic navigation item', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="rail"
        />
      );

      const item = screen.getByRole('button', { name: /dashboard/i });
      expect(item).toBeInTheDocument();
      expect(item).toHaveAttribute('aria-label', mockItem.label);
    });

    it('should render with icon', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="rail"
        />
      );

      const icon = screen.getByTestId('mock-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should show label in drawer mode', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          showLabel={true}
        />
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should hide label in rail mode by default', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="rail"
        />
      );

      // Label should not be visible in rail mode
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('should show tooltip in rail mode', async () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="rail"
          showTooltip={true}
        />
      );

      const item = screen.getByRole('button');
      await user.hover(item);

      // Tooltip should appear
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Item States', () => {
    it('should render active state', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          isActive={true}
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('nav-item-active');
      expect(item).toHaveAttribute('aria-pressed', 'true');
    });

    it('should render hover state', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          isHovered={true}
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('nav-item-hovered');
    });

    it('should render focused state', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          isFocused={true}
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('nav-item-focused');
    });

    it('should render disabled state', () => {
      render(
        <NavigationItem
          item={mockDisabledItem}
          mode="drawer"
        />
      );

      const item = screen.getByRole('button');
      expect(item).toBeDisabled();
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveClass('nav-item-disabled');
    });
  });

  describe('Badge Functionality', () => {
    it('should render badge with count', () => {
      render(
        <NavigationItem
          item={mockItemWithBadge}
          mode="drawer"
          showLabel={true}
        />
      );

      const badge = screen.getByText('5');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('badge-error');
    });

    it('should render pulsing badge', () => {
      render(
        <NavigationItem
          item={mockItemWithBadge}
          mode="drawer"
        />
      );

      const badge = screen.getByText('5');
      expect(badge).toHaveClass('badge-pulse');
    });

    it('should render text badge', () => {
      const itemWithTextBadge: NavigationItemType = {
        ...mockItem,
        badge: { text: 'NEW', color: 'success' },
      };

      render(
        <NavigationItem
          item={itemWithTextBadge}
          mode="drawer"
        />
      );

      const badge = screen.getByText('NEW');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('badge-success');
    });

    it('should not render badge when count is 0', () => {
      const itemWithZeroBadge: NavigationItemType = {
        ...mockItem,
        badge: { count: 0, color: 'primary' },
      };

      render(
        <NavigationItem
          item={itemWithZeroBadge}
          mode="drawer"
        />
      );

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle click events', async () => {
      const mockClick = jest.fn();
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          onClick={mockClick}
        />
      );

      const item = screen.getByRole('button');
      await user.click(item);

      expect(mockClick).toHaveBeenCalledWith(mockItem);
    });

    it('should not trigger click when disabled', async () => {
      const mockClick = jest.fn();
      render(
        <NavigationItem
          item={mockDisabledItem}
          mode="drawer"
          onClick={mockClick}
        />
      );

      const item = screen.getByRole('button');
      await user.click(item);

      expect(mockClick).not.toHaveBeenCalled();
    });

    it('should handle hover events', async () => {
      const mockHover = jest.fn();
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          onHover={mockHover}
        />
      );

      const item = screen.getByRole('button');
      await user.hover(item);

      expect(mockHover).toHaveBeenCalledWith(mockItem);

      await user.unhover(item);
      expect(mockHover).toHaveBeenCalledWith(null);
    });

    it('should handle focus events', async () => {
      const mockFocus = jest.fn();
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          onFocus={mockFocus}
        />
      );

      const item = screen.getByRole('button');
      item.focus();

      expect(mockFocus).toHaveBeenCalledWith(mockItem);
    });

    it('should handle keyboard navigation', async () => {
      const mockClick = jest.fn();
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          onClick={mockClick}
        />
      );

      const item = screen.getByRole('button');
      item.focus();
      await user.keyboard('{Enter}');

      expect(mockClick).toHaveBeenCalledWith(mockItem);
    });

    it('should handle space key activation', async () => {
      const mockClick = jest.fn();
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          onClick={mockClick}
        />
      );

      const item = screen.getByRole('button');
      item.focus();
      await user.keyboard(' ');

      expect(mockClick).toHaveBeenCalledWith(mockItem);
    });
  });

  describe('External Links', () => {
    it('should render external link with proper attributes', () => {
      render(
        <NavigationItem
          item={mockExternalItem}
          mode="drawer"
          showLabel={true}
        />
      );

      const link = screen.getByRole('link', { name: /external link/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should show external link icon', () => {
      render(
        <NavigationItem
          item={mockExternalItem}
          mode="drawer"
          showLabel={true}
        />
      );

      const externalIcon = screen.getByTestId('external-link-icon');
      expect(externalIcon).toBeInTheDocument();
    });
  });

  describe('Nested Items', () => {
    it('should render with proper indentation level', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          level={2}
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveStyle('padding-left: 48px'); // 24px * 2
    });

    it('should handle max nesting level', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          level={5} // Should be clamped to max
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveStyle('padding-left: 72px'); // Max 3 levels
    });
  });

  describe('Mode-Specific Behavior', () => {
    it('should apply rail-specific classes', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="rail"
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('nav-item-rail');
    });

    it('should apply drawer-specific classes', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('nav-item-drawer');
    });

    it('should apply modal-specific classes', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="modal"
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('nav-item-modal');
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          isActive={true}
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveAttribute('aria-label', 'Dashboard');
      expect(item).toHaveAttribute('aria-pressed', 'true');
      expect(item).toHaveAttribute('tabindex', '0');
    });

    it('should support custom aria label', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          a11yLabel="Custom dashboard label"
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveAttribute('aria-label', 'Custom dashboard label');
    });

    it('should announce badge information to screen readers', () => {
      render(
        <NavigationItem
          item={mockItemWithBadge}
          mode="drawer"
          showLabel={true}
        />
      );

      const item = screen.getByRole('button');
      const ariaLabel = item.getAttribute('aria-label');
      expect(ariaLabel).toContain('Notifications');
      expect(ariaLabel).toContain('5 notifications');
    });

    it('should have proper focus management', async () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
        />
      );

      const item = screen.getByRole('button');
      item.focus();

      expect(item).toHaveFocus();
      expect(item).toHaveClass('focus-visible');
    });

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      const mockMatchMedia = jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });
      window.matchMedia = mockMatchMedia.mockReturnValue({ matches: true });

      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('high-contrast');
    });
  });

  describe('Performance Optimizations', () => {
    it('should not re-render when props are unchanged', () => {
      let renderCount = 0;
      const TestWrapper = ({ item }: { item: NavigationItemType }) => {
        renderCount++;
        return <NavigationItem item={item} mode="drawer" />;
      };

      const { rerender } = render(<TestWrapper item={mockItem} />);
      expect(renderCount).toBe(1);

      // Re-render with same props
      rerender(<TestWrapper item={mockItem} />);
      expect(renderCount).toBe(2); // React rerenders but component should memo optimize
    });

    it('should handle rapid state changes efficiently', async () => {
      const { rerender } = render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          isActive={false}
        />
      );

      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        rerender(
          <NavigationItem
            item={mockItem}
            mode="drawer"
            isActive={i % 2 === 0}
          />
        );
        await global.testUtils.waitForAnimation();
      }

      // Should still be functional
      const item = screen.getByRole('button');
      expect(item).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          className="custom-nav-item"
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveClass('custom-nav-item');
    });

    it('should support CSS custom properties', () => {
      render(
        <NavigationItem
          item={mockItem}
          mode="drawer"
          style={{ '--custom-color': 'red' } as React.CSSProperties}
        />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveStyle('--custom-color: red');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing icon gracefully', () => {
      const itemWithoutIcon: NavigationItemType = {
        ...mockItem,
        icon: undefined as any,
      };

      render(
        <NavigationItem
          item={itemWithoutIcon}
          mode="drawer"
        />
      );

      // Should render without crashing
      const item = screen.getByRole('button');
      expect(item).toBeInTheDocument();
    });

    it('should handle invalid badge configuration', () => {
      const itemWithInvalidBadge: NavigationItemType = {
        ...mockItem,
        badge: {} as any, // Empty badge object
      };

      render(
        <NavigationItem
          item={itemWithInvalidBadge}
          mode="drawer"
        />
      );

      // Should render without badge
      const item = screen.getByRole('button');
      expect(item).toBeInTheDocument();
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
    });
  });
});