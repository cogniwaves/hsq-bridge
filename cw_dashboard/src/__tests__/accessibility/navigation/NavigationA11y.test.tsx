/**
 * Navigation Accessibility Tests
 * WCAG 2.1 AA compliance testing for navigation components
 */

/// <reference path="../../types/jest.d.ts" />

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SideNavigation } from '../../../components/navigation/SideNavigation';
import { NavigationItem } from '../../../components/navigation/NavigationItem';
import type { NavigationConfig, NavigationItem as NavigationItemType } from '../../../components/navigation/types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test configuration with accessibility-focused items
const a11yTestConfig: NavigationConfig = {
  sections: [
    {
      id: 'main',
      title: 'Main Navigation',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'home',
          href: '/dashboard',
          description: 'View your main dashboard with overview statistics',
        },
        {
          id: 'invoices',
          label: 'Invoices',
          icon: 'document-text',
          href: '/invoices',
          badge: { count: 5, color: 'error' },
          description: 'Manage customer invoices and billing',
        },
        {
          id: 'reports',
          label: 'Reports',
          icon: 'chart-bar',
          disabled: true,
          description: 'Generate and view business reports (Coming soon)',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: 'cog',
          href: '/settings',
          children: [
            {
              id: 'general',
              label: 'General Settings',
              icon: 'adjustments',
              href: '/settings/general',
            },
            {
              id: 'security',
              label: 'Security',
              icon: 'shield-check',
              href: '/settings/security',
            },
          ],
        },
      ],
    },
    {
      id: 'secondary',
      title: 'Tools',
      divider: true,
      collapsible: true,
      items: [
        {
          id: 'integrations',
          label: 'Integrations',
          icon: 'link',
          href: '/integrations',
          external: true,
        },
      ],
    },
  ],
  footer: {
    id: 'footer',
    items: [
      {
        id: 'profile',
        label: 'User Profile',
        icon: 'user',
        href: '/profile',
      },
      {
        id: 'help',
        label: 'Help & Support',
        icon: 'question-mark-circle',
        href: '/help',
      },
    ],
  },
  branding: {
    title: 'HSQ Bridge',
    subtitle: 'Dashboard Navigation',
  },
};

describe('Navigation Accessibility', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations in rail mode', async () => {
      const { container } = render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });

    it('should have no accessibility violations in drawer mode', async () => {
      global.testUtils.mockViewport(1024, 768);
      const { container } = render(
        <SideNavigation config={a11yTestConfig} defaultMode="drawer" />
      );
      
      await waitFor(async () => {
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });

    it('should have no accessibility violations in modal mode', async () => {
      global.testUtils.mockViewport(640, 480);
      const { container } = render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        // Open modal first
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });

    it('should have no violations with expanded collapsible sections', async () => {
      const { container } = render(
        <SideNavigation config={a11yTestConfig} defaultMode="drawer" />
      );
      
      await waitFor(async () => {
        // Expand collapsible section
        const toolsSection = screen.getByRole('button', { name: /tools/i });
        await user.click(toolsSection);
        
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  });

  describe('Semantic HTML Structure', () => {
    it('should use proper landmark roles', async () => {
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('should have proper heading hierarchy', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings).toHaveLength(3); // Branding title + section titles
        
        // Check heading levels
        expect(headings[0]).toHaveAttribute('aria-level', '1'); // Main title
        expect(headings[1]).toHaveAttribute('aria-level', '2'); // Main Navigation
        expect(headings[2]).toHaveAttribute('aria-level', '2'); // Tools
      });
    });

    it('should use proper list structure for navigation items', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const lists = screen.getAllByRole('list');
        expect(lists.length).toBeGreaterThan(0);
        
        const listItems = screen.getAllByRole('listitem');
        expect(listItems.length).toBeGreaterThan(0);
      });
    });

    it('should use proper button vs link semantics', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        // Items with href should be links
        const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
        expect(dashboardLink).toHaveAttribute('href', '/dashboard');
        
        // Items with onClick should be buttons
        const expandButton = screen.getByRole('button', { name: /settings/i });
        expect(expandButton).not.toHaveAttribute('href');
        
        // External links should have proper attributes
        const externalLink = screen.getByRole('link', { name: /integrations/i });
        expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
        expect(externalLink).toHaveAttribute('target', '_blank');
      });
    });
  });

  describe('ARIA Labels and Descriptions', () => {
    it('should have proper aria-label for navigation', async () => {
      render(
        <SideNavigation 
          config={a11yTestConfig} 
          a11yLabel="Main application navigation" 
        />
      );
      
      await waitFor(() => {
        const nav = screen.getByRole('navigation');
        expect(nav).toHaveAttribute('aria-label', 'Main application navigation');
      });
    });

    it('should describe badge information for screen readers', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const invoicesItem = screen.getByRole('link', { name: /invoices/i });
        const ariaLabel = invoicesItem.getAttribute('aria-label') || 
                         invoicesItem.getAttribute('aria-describedby');
        
        expect(ariaLabel).toContain('5');
        expect(ariaLabel).toMatch(/unread|notifications/);
      });
    });

    it('should indicate disabled state to screen readers', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const disabledItem = screen.getByRole('button', { name: /reports/i });
        expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
        expect(disabledItem).toHaveAttribute('aria-describedby');
        
        const description = document.getElementById(
          disabledItem.getAttribute('aria-describedby')!
        );
        expect(description).toHaveTextContent(/coming soon/i);
      });
    });

    it('should indicate active state to screen readers', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        const dashboardItem = screen.getByRole('link', { name: /dashboard/i });
        await user.click(dashboardItem);
        
        await waitFor(() => {
          expect(dashboardItem).toHaveAttribute('aria-current', 'page');
        });
      });
    });

    it('should indicate expanded/collapsed state for collapsible sections', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const toolsSection = screen.getByRole('button', { name: /tools/i });
        expect(toolsSection).toHaveAttribute('aria-expanded', 'false');
        expect(toolsSection).toHaveAttribute('aria-controls');
      });

      await user.click(screen.getByRole('button', { name: /tools/i }));
      
      await waitFor(() => {
        const toolsSection = screen.getByRole('button', { name: /tools/i });
        expect(toolsSection).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all interactive elements', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        // Tab through all focusable elements
        await user.tab(); // Skip to content link
        await user.tab(); // First navigation item
        
        expect(screen.getByRole('link', { name: /dashboard/i })).toHaveFocus();
        
        await user.tab();
        expect(screen.getByRole('link', { name: /invoices/i })).toHaveFocus();
        
        await user.tab();
        expect(screen.getByRole('button', { name: /reports/i })).toHaveFocus();
      });
    });

    it('should support arrow key navigation within sections', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        // Focus first item
        const firstItem = screen.getByRole('link', { name: /dashboard/i });
        firstItem.focus();
        
        // Navigate with arrow keys
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('link', { name: /invoices/i })).toHaveFocus();
        
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('button', { name: /reports/i })).toHaveFocus();
        
        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('link', { name: /invoices/i })).toHaveFocus();
      });
    });

    it('should support Enter and Space key activation', async () => {
      const mockItemClick = jest.fn();
      
      render(
        <SideNavigation 
          config={a11yTestConfig} 
          defaultMode="drawer"
          onItemClick={mockItemClick}
        />
      );
      
      await waitFor(async () => {
        const settingsItem = screen.getByRole('button', { name: /settings/i });
        settingsItem.focus();
        
        await user.keyboard('{Enter}');
        expect(mockItemClick).toHaveBeenCalled();
        
        await user.keyboard(' ');
        expect(mockItemClick).toHaveBeenCalledTimes(2);
      });
    });

    it('should support Home/End key navigation', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        const middleItem = screen.getByRole('link', { name: /invoices/i });
        middleItem.focus();
        
        await user.keyboard('{Home}');
        expect(screen.getByRole('link', { name: /dashboard/i })).toHaveFocus();
        
        await user.keyboard('{End}');
        const lastItem = screen.getAllByRole('link').pop()!;
        expect(lastItem).toHaveFocus();
      });
    });

    it('should trap focus in modal mode', async () => {
      global.testUtils.mockViewport(640, 480);
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        // Open modal
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
        
        // Focus should be trapped within modal
        const firstFocusableElement = screen.getByRole('button', { name: /close/i });
        expect(firstFocusableElement).toHaveFocus();
        
        // Tab should cycle within modal
        await user.tab();
        const firstNavItem = screen.getByRole('link', { name: /dashboard/i });
        expect(firstNavItem).toHaveFocus();
      });
    });

    it('should return focus after modal closes', async () => {
      global.testUtils.mockViewport(640, 480);
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        // Close modal with Escape
        await user.keyboard('{Escape}');
        
        // Focus should return to menu button
        expect(menuButton).toHaveFocus();
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide skip to content functionality', async () => {
      render(
        <SideNavigation config={a11yTestConfig}>
          <div id="main-content">Main content area</div>
        </SideNavigation>
      );
      
      await waitFor(async () => {
        const skipLink = screen.getByText('Skip to main content');
        expect(skipLink).toHaveAttribute('href', '#main-content');
        
        // Focus skip link
        skipLink.focus();
        expect(skipLink).toBeVisible();
        
        // Click skip link
        await user.click(skipLink);
        
        const mainContent = screen.getByRole('main');
        expect(mainContent).toHaveFocus();
      });
    });

    it('should announce navigation state changes', async () => {
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        // Expand navigation
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        // Check for live region announcement
        const liveRegion = screen.getByRole('status', { hidden: true });
        expect(liveRegion).toHaveTextContent(/navigation expanded/i);
      });
    });

    it('should provide context for nested navigation items', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        // Expand settings menu
        const settingsButton = screen.getByRole('button', { name: /settings/i });
        await user.click(settingsButton);
        
        const generalSettings = screen.getByRole('link', { name: /general settings/i });
        const ariaLabel = generalSettings.getAttribute('aria-label');
        
        expect(ariaLabel).toContain('Settings submenu');
        expect(generalSettings).toHaveAttribute('aria-level', '2');
      });
    });

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-contrast: high)',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        })),
      });

      render(<SideNavigation config={a11yTestConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('high-contrast');
    });

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        })),
      });

      render(<SideNavigation config={a11yTestConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('reduced-motion');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet minimum color contrast ratios', async () => {
      const { container } = render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        // Test with axe color contrast rules
        const results = await axe(container, {
          rules: {
            'color-contrast': { enabled: true },
          },
        });
        
        expect(results).toHaveNoViolations();
      });
    });

    it('should provide sufficient focus indicators', async () => {
      render(<SideNavigation config={a11yTestConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        const firstItem = screen.getByRole('link', { name: /dashboard/i });
        firstItem.focus();
        
        const focusStyles = window.getComputedStyle(firstItem, ':focus');
        expect(focusStyles.outline).not.toBe('none');
        expect(focusStyles.outlineWidth).toBeTruthy();
      });
    });

    it('should handle forced colors mode', () => {
      // Mock forced colors media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(forced-colors: active)',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        })),
      });

      render(<SideNavigation config={a11yTestConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('forced-colors');
    });
  });

  describe('Touch and Gesture Accessibility', () => {
    it('should have minimum touch target sizes', async () => {
      global.testUtils.mockViewport(375, 667); // Mobile viewport
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        const styles = window.getComputedStyle(menuButton);
        
        const width = parseInt(styles.width);
        const height = parseInt(styles.height);
        
        // WCAG minimum 44px touch target
        expect(width).toBeGreaterThanOrEqual(44);
        expect(height).toBeGreaterThanOrEqual(44);
      });
    });

    it('should support swipe gestures with proper announcements', async () => {
      global.testUtils.mockViewport(375, 667);
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        // Simulate swipe to close
        const modal = screen.getByRole('dialog');
        const swipeEvent = mockFactories.createMockTouchEvent('touchstart', [
          { clientX: 0, clientY: 100 }
        ]);
        
        modal.dispatchEvent(swipeEvent);
        
        // Should announce gesture
        const liveRegion = screen.getByRole('status', { hidden: true });
        expect(liveRegion).toHaveTextContent(/swipe to close/i);
      });
    });
  });

  describe('Individual Component Accessibility', () => {
    const testItem: NavigationItemType = {
      id: 'test-item',
      label: 'Test Item',
      icon: 'test',
      href: '/test',
      badge: { count: 3, color: 'primary' },
      description: 'Test navigation item description',
    };

    it('should render NavigationItem with proper accessibility attributes', () => {
      render(
        <NavigationItem
          item={testItem}
          mode="drawer"
          isActive={true}
          showLabel={true}
        />
      );
      
      const item = screen.getByRole('link');
      expect(item).toHaveAttribute('aria-label');
      expect(item).toHaveAttribute('aria-current', 'page');
      
      const badge = screen.getByText('3');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('3'));
    });

    it('should handle disabled NavigationItem accessibility', () => {
      const disabledItem: NavigationItemType = {
        ...testItem,
        disabled: true,
      };

      render(
        <NavigationItem
          item={disabledItem}
          mode="drawer"
          showLabel={true}
        />
      );
      
      const item = screen.getByRole('button');
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toBeDisabled();
    });
  });

  describe('Error State Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      // Mock API error
      global.fetch = jest.fn().mockRejectedValue(new Error('Failed to load navigation data'));
      
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent(/failed to load/i);
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should provide retry functionality with proper labeling', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      render(<SideNavigation config={a11yTestConfig} />);
      
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry loading navigation/i });
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveAttribute('aria-describedby');
        
        const description = document.getElementById(
          retryButton.getAttribute('aria-describedby')!
        );
        expect(description).toHaveTextContent(/network error/i);
      });
    });
  });
});