/**
 * Navigation Responsive Testing
 * Tests for responsive behavior across device breakpoints and orientations
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNavigation } from '../../../components/navigation/SideNavigation';
import type { NavigationConfig } from '../../../components/navigation/types';

// Responsive breakpoints (matching design system)
const BREAKPOINTS = {
  mobile: { width: 320, height: 568 },    // Small mobile
  mobileMd: { width: 375, height: 667 },  // Medium mobile
  mobileLg: { width: 414, height: 896 },  // Large mobile
  tablet: { width: 768, height: 1024 },   // Tablet portrait
  tabletLs: { width: 1024, height: 768 }, // Tablet landscape
  desktop: { width: 1024, height: 768 },  // Small desktop
  desktopLg: { width: 1440, height: 900 }, // Large desktop
  desktopXl: { width: 1920, height: 1080 }, // Extra large desktop
};

const testConfig: NavigationConfig = global.testUtils.createMockNavigationConfig({
  sections: [
    {
      id: 'main',
      title: 'Main Navigation',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'home', href: '/dashboard' },
        { id: 'invoices', label: 'Invoices', icon: 'document-text', href: '/invoices' },
        { id: 'payments', label: 'Payments', icon: 'currency-dollar', href: '/payments' },
        { id: 'sync', label: 'Sync', icon: 'arrow-path', href: '/sync' },
      ],
    },
    {
      id: 'admin',
      title: 'Administration',
      collapsible: true,
      items: [
        { id: 'users', label: 'Users', icon: 'users', href: '/admin/users' },
        { id: 'settings', label: 'Settings', icon: 'cog', href: '/admin/settings' },
      ],
    },
  ],
});

describe('Navigation Responsive Behavior', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Reset to default desktop size
    global.testUtils.mockViewport(1024, 768);
  });

  describe('Viewport Breakpoint Behavior', () => {
    it('should render rail mode on desktop', async () => {
      global.testUtils.mockViewport(BREAKPOINTS.desktop.width, BREAKPOINTS.desktop.height);
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /open navigation menu/i })).not.toBeInTheDocument();
      });
    });

    it('should render modal mode on mobile', async () => {
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
        expect(screen.queryByTestId('navigation-rail')).not.toBeInTheDocument();
      });
    });

    it('should switch modes when crossing tablet breakpoint', async () => {
      const { rerender } = render(<SideNavigation config={testConfig} />);
      
      // Start desktop
      global.testUtils.mockViewport(BREAKPOINTS.desktop.width, BREAKPOINTS.desktop.height);
      rerender(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();
      });

      // Switch to tablet
      global.testUtils.mockViewport(BREAKPOINTS.tablet.width, BREAKPOINTS.tablet.height);
      rerender(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('navigation-rail')).toBeInTheDocument(); // Still rail on tablet
      });

      // Switch to mobile
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      rerender(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
      });
    });

    it('should handle orientation changes', async () => {
      // Start with mobile portrait
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      const { rerender } = render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
      });

      // Rotate to landscape (swap dimensions)
      global.testUtils.mockViewport(BREAKPOINTS.mobile.height, BREAKPOINTS.mobile.width);
      rerender(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        // Still mobile in landscape
        expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
      });
    });
  });

  describe('Touch Interface Adaptations', () => {
    it('should increase touch targets on mobile', async () => {
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        const navItems = screen.getAllByRole('link');
        navItems.forEach(item => {
          const styles = window.getComputedStyle(item);
          const height = parseInt(styles.height);
          expect(height).toBeGreaterThanOrEqual(44); // WCAG minimum touch target
        });
      });
    });

    it('should support swipe gestures on mobile', async () => {
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
        
        // Simulate swipe to close
        const touchStart = mockFactories.createMockTouchEvent('touchstart', [
          { clientX: 50, clientY: 100 }
        ]);
        const touchMove = mockFactories.createMockTouchEvent('touchmove', [
          { clientX: 200, clientY: 100 }
        ]);
        const touchEnd = mockFactories.createMockTouchEvent('touchend', []);
        
        modal.dispatchEvent(touchStart);
        modal.dispatchEvent(touchMove);
        modal.dispatchEvent(touchEnd);
        
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      });
    });

    it('should handle pinch-to-zoom gracefully', async () => {
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(<SideNavigation config={testConfig} />);
      
      // Mock zoom event
      Object.defineProperty(window, 'visualViewport', {
        value: {
          scale: 2.0, // Zoomed in
          width: BREAKPOINTS.mobile.width / 2,
          height: BREAKPOINTS.mobile.height / 2,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        configurable: true,
      });

      await waitFor(() => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        expect(menuButton).toBeInTheDocument();
        
        // Navigation should still be functional when zoomed
        const styles = window.getComputedStyle(menuButton);
        expect(styles.position).toBe('fixed'); // Should maintain fixed positioning
      });
    });
  });

  describe('Layout Adaptation', () => {
    it('should adjust navigation width based on content', async () => {
      global.testUtils.mockViewport(BREAKPOINTS.desktopLg.width, BREAKPOINTS.desktopLg.height);
      
      const longLabelConfig = {
        ...testConfig,
        sections: [
          {
            id: 'main',
            items: [
              { id: 'very-long-label', label: 'Very Long Navigation Label That Might Overflow', icon: 'home', href: '/' },
            ],
          },
        ],
      };

      render(<SideNavigation config={longLabelConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        const styles = window.getComputedStyle(navigation);
        
        // Should maintain minimum width
        const width = parseInt(styles.width);
        expect(width).toBeGreaterThanOrEqual(280); // Minimum drawer width
        expect(width).toBeLessThanOrEqual(400); // Maximum reasonable width
      });
    });

    it('should handle content overflow gracefully', async () => {
      const manyItemsConfig = {
        sections: [
          {
            id: 'main',
            items: Array.from({ length: 20 }, (_, i) => ({
              id: `item-${i}`,
              label: `Navigation Item ${i + 1}`,
              icon: 'home',
              href: `/item-${i}`,
            })),
          },
        ],
      };

      render(<SideNavigation config={manyItemsConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        const styles = window.getComputedStyle(navigation);
        
        // Should be scrollable
        expect(styles.overflowY).toBe('auto');
        expect(styles.maxHeight).toBeTruthy();
        
        // Should show all items (via scrolling)
        const items = screen.getAllByRole('link');
        expect(items.length).toBe(20);
      });
    });

    it('should adjust main content offset responsively', async () => {
      const { rerender } = render(
        <SideNavigation config={testConfig}>
          <div>Main content</div>
        </SideNavigation>
      );

      // Desktop: Should have rail offset
      global.testUtils.mockViewport(BREAKPOINTS.desktop.width, BREAKPOINTS.desktop.height);
      rerender(
        <SideNavigation config={testConfig}>
          <div>Main content</div>
        </SideNavigation>
      );
      
      await waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).toHaveStyle('margin-left: 80px');
      });

      // Mobile: Should have no offset
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      rerender(
        <SideNavigation config={testConfig}>
          <div>Main content</div>
        </SideNavigation>
      );
      
      await waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).not.toHaveStyle('margin-left: 80px');
      });
    });
  });

  describe('Typography and Spacing Scaling', () => {
    it('should scale typography appropriately across devices', async () => {
      const { rerender } = render(<SideNavigation config={testConfig} defaultMode="drawer" />);

      // Mobile: Smaller text
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      rerender(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        const navItems = screen.getAllByRole('link');
        const firstItem = navItems[0];
        const styles = window.getComputedStyle(firstItem);
        
        expect(parseInt(styles.fontSize)).toBeLessThanOrEqual(16);
      });

      // Desktop: Larger text
      global.testUtils.mockViewport(BREAKPOINTS.desktopLg.width, BREAKPOINTS.desktopLg.height);
      rerender(<SideNavigation config={testConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        const navItems = screen.getAllByRole('link');
        const firstItem = navItems[0];
        const styles = window.getComputedStyle(firstItem);
        
        expect(parseInt(styles.fontSize)).toBeGreaterThanOrEqual(14);
      });
    });

    it('should maintain readable spacing on all devices', async () => {
      Object.values(BREAKPOINTS).forEach(async ({ width, height }) => {
        global.testUtils.mockViewport(width, height);
        const { rerender } = render(<SideNavigation config={testConfig} />);
        
        await waitFor(() => {
          const navigation = screen.getByRole('navigation');
          const styles = window.getComputedStyle(navigation);
          
          // Should have adequate padding
          const padding = parseInt(styles.padding);
          expect(padding).toBeGreaterThanOrEqual(8);
        });

        rerender(<></>); // Clean up
      });
    });
  });

  describe('Performance on Different Devices', () => {
    it('should render efficiently on low-end mobile devices', async () => {
      // Simulate slow device
      const mockPerformance = {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
      };
      Object.defineProperty(window, 'performance', {
        value: mockPerformance,
        configurable: true,
      });

      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      
      const startTime = performance.now();
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (< 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle rapid viewport changes smoothly', async () => {
      const { rerender } = render(<SideNavigation config={testConfig} />);
      
      // Rapid viewport changes
      const viewports = [
        BREAKPOINTS.mobile,
        BREAKPOINTS.tablet,
        BREAKPOINTS.desktop,
        BREAKPOINTS.mobile,
        BREAKPOINTS.desktopLg,
      ];

      for (const viewport of viewports) {
        global.testUtils.mockViewport(viewport.width, viewport.height);
        rerender(<SideNavigation config={testConfig} />);
        await global.testUtils.waitForAnimation();
      }

      // Should end up in correct state
      await waitFor(() => {
        expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Across Devices', () => {
    it('should maintain accessibility on touch devices', async () => {
      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        
        // Should have proper touch target size
        const styles = window.getComputedStyle(menuButton);
        expect(parseInt(styles.width)).toBeGreaterThanOrEqual(44);
        expect(parseInt(styles.height)).toBeGreaterThanOrEqual(44);
        
        // Should be keyboard accessible
        menuButton.focus();
        expect(menuButton).toHaveFocus();
        
        await user.keyboard('{Enter}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should support screen reader navigation on all devices', async () => {
      Object.values(BREAKPOINTS).forEach(async ({ width, height }) => {
        global.testUtils.mockViewport(width, height);
        render(<SideNavigation config={testConfig} />);
        
        await waitFor(() => {
          const navigation = screen.getByRole('navigation');
          expect(navigation).toHaveAttribute('aria-label');
          
          // Skip link should always be present
          const skipLink = screen.getByText('Skip to main content');
          expect(skipLink).toBeInTheDocument();
        });
      });
    });
  });

  describe('Progressive Enhancement', () => {
    it('should work without JavaScript', async () => {
      // Simulate no JavaScript environment
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn().mockImplementation((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        // Disable event listeners to simulate no JS
        element.addEventListener = jest.fn();
        return element;
      });

      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        // Should still render navigation structure
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        
        // Links should still work (via href)
        const links = screen.getAllByRole('link');
        links.forEach(link => {
          expect(link).toHaveAttribute('href');
        });
      });

      document.createElement = originalCreateElement;
    });

    it('should provide fallbacks for CSS custom properties', () => {
      // Mock unsupported CSS custom properties
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: jest.fn().mockImplementation((prop) => {
            return !prop.startsWith('--'); // Custom properties not supported
          }),
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('fallback-styles');
    });
  });

  describe('Network Conditions Adaptation', () => {
    it('should handle slow network connections', async () => {
      // Mock slow connection
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.25,
          rtt: 2000,
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        // Should show loading state longer on slow connections
        expect(navigation).toHaveClass('slow-connection');
      });
    });

    it('should prefetch resources on fast connections', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          downlink: 10,
          rtt: 100,
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      const prefetchLinks = document.querySelectorAll('link[rel="prefetch"]');
      expect(prefetchLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Device-Specific Features', () => {
    it('should support iOS safe areas', async () => {
      // Mock iOS environment
      Object.defineProperty(navigator, 'platform', {
        value: 'iPhone',
        configurable: true,
      });

      // Mock safe area insets
      Object.defineProperty(document.documentElement.style, 'setProperty', {
        value: jest.fn(),
      });

      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
          '--safe-area-inset-top',
          expect.any(String)
        );
      });
    });

    it('should handle Android back button', async () => {
      // Mock Android environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        configurable: true,
      });

      global.testUtils.mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        await user.click(menuButton);
        
        // Simulate Android back button
        const backEvent = new PopStateEvent('popstate');
        window.dispatchEvent(backEvent);
        
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      });
    });

    it('should optimize for foldable devices', async () => {
      // Mock foldable device
      global.testUtils.mockViewport(720, 1680); // Unfolded
      
      Object.defineProperty(window.screen, 'isExtended', {
        value: true,
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveClass('foldable-device');
      });
    });
  });
});