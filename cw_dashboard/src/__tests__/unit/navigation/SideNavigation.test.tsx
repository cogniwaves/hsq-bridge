/**
 * SideNavigation Component Unit Tests
 * Comprehensive testing for the main navigation container
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNavigation } from '../../../components/navigation/SideNavigation';
import type { NavigationConfig, NavigationMode } from '../../../components/navigation/types';

// Test utilities and mocks
const mockConfig: NavigationConfig = global.testUtils.createMockNavigationConfig();

describe('SideNavigation', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Reset viewport to desktop size
    global.testUtils.mockViewport(1024, 768);
  });

  describe('Component Rendering', () => {
    it('should render loading state during SSR', () => {
      // Mock mounted state to false to simulate SSR
      const { container } = render(<SideNavigation config={mockConfig} />);
      
      expect(container.querySelector('.nav-loading')).toBeInTheDocument();
    });

    it('should render skip to content link for accessibility', async () => {
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(() => {
        const skipLink = screen.getByText('Skip to main content');
        expect(skipLink).toBeInTheDocument();
        expect(skipLink).toHaveAttribute('href', '#main-content');
      });
    });

    it('should render with default props', async () => {
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    it('should apply custom className', async () => {
      const customClass = 'custom-navigation-class';
      const { container } = render(
        <SideNavigation config={mockConfig} className={customClass} />
      );
      
      await waitFor(() => {
        expect(container.firstChild).toHaveClass(customClass);
      });
    });

    it('should render children in main content area', async () => {
      const testContent = 'Test main content';
      render(
        <SideNavigation config={mockConfig}>
          <div>{testContent}</div>
        </SideNavigation>
      );
      
      await waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).toBeInTheDocument();
        expect(mainContent).toHaveTextContent(testContent);
        expect(mainContent).toHaveAttribute('id', 'main-content');
      });
    });
  });

  describe('Navigation Modes', () => {
    it('should render rail mode on desktop by default', async () => {
      global.testUtils.mockViewport(1024, 768);
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();
      });
    });

    it('should render modal mode on mobile', async () => {
      global.testUtils.mockViewport(640, 480);
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
      });
    });

    it('should switch modes on viewport change', async () => {
      const { rerender } = render(<SideNavigation config={mockConfig} />);
      
      // Start with desktop size (rail mode)
      await waitFor(() => {
        expect(screen.queryByTestId('navigation-rail')).toBeInTheDocument();
      });
      
      // Switch to mobile size
      global.testUtils.mockViewport(640, 480);
      rerender(<SideNavigation config={mockConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
      });
    });

    it('should respect defaultMode prop', async () => {
      render(<SideNavigation config={mockConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('navigation-drawer')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation State Management', () => {
    it('should handle expand/collapse in rail mode', async () => {
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        expect(expandButton).toBeInTheDocument();
        
        await user.click(expandButton);
        
        await waitFor(() => {
          expect(screen.getByTestId('navigation-drawer')).toBeInTheDocument();
        });
      });
    });

    it('should handle collapse in drawer mode', async () => {
      render(<SideNavigation config={mockConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        const collapseButton = screen.getByRole('button', { name: /collapse/i });
        expect(collapseButton).toBeInTheDocument();
        
        await user.click(collapseButton);
        
        await waitFor(() => {
          expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();
        });
      });
    });

    it('should open modal navigation on mobile', async () => {
      global.testUtils.mockViewport(640, 480);
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: 'Open navigation menu' });
        await user.click(menuButton);
        
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
      });
    });

    it('should close modal navigation', async () => {
      global.testUtils.mockViewport(640, 480);
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        // Open modal
        const menuButton = screen.getByRole('button', { name: 'Open navigation menu' });
        await user.click(menuButton);
        
        await waitFor(async () => {
          // Close modal
          const closeButton = screen.getByRole('button', { name: /close/i });
          await user.click(closeButton);
          
          await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
          });
        });
      });
    });
  });

  describe('Item Interactions', () => {
    it('should handle item clicks', async () => {
      const mockItemClick = jest.fn();
      render(
        <SideNavigation config={mockConfig} onItemClick={mockItemClick} />
      );
      
      await waitFor(async () => {
        const dashboardItem = screen.getByRole('button', { name: /dashboard/i });
        await user.click(dashboardItem);
        
        expect(mockItemClick).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'dashboard', label: 'Dashboard' })
        );
      });
    });

    it('should set active item on click', async () => {
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        const invoicesItem = screen.getByRole('button', { name: /invoices/i });
        await user.click(invoicesItem);
        
        await waitFor(() => {
          expect(invoicesItem).toHaveAttribute('aria-pressed', 'true');
        });
      });
    });

    it('should handle keyboard navigation', async () => {
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        const firstItem = screen.getByRole('button', { name: /dashboard/i });
        firstItem.focus();
        
        await user.keyboard('{ArrowDown}');
        
        const secondItem = screen.getByRole('button', { name: /invoices/i });
        expect(secondItem).toHaveFocus();
      });
    });
  });

  describe('Event Callbacks', () => {
    it('should call onModeChange when mode changes', async () => {
      const mockModeChange = jest.fn();
      render(
        <SideNavigation 
          config={mockConfig} 
          onModeChange={mockModeChange}
        />
      );
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        expect(mockModeChange).toHaveBeenCalledWith('drawer');
      });
    });

    it('should call onExpandedChange when expansion state changes', async () => {
      const mockExpandedChange = jest.fn();
      render(
        <SideNavigation 
          config={mockConfig} 
          onExpandedChange={mockExpandedChange}
        />
      );
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        expect(mockExpandedChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Content Offset', () => {
    it('should apply correct margin for rail mode', async () => {
      render(
        <SideNavigation config={mockConfig}>
          <div>Main content</div>
        </SideNavigation>
      );
      
      await waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).toHaveStyle('margin-left: 80px');
      });
    });

    it('should apply correct margin for drawer mode', async () => {
      render(
        <SideNavigation config={mockConfig} defaultMode="drawer">
          <div>Main content</div>
        </SideNavigation>
      );
      
      await waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).toHaveStyle('margin-left: 280px');
      });
    });

    it('should have no offset for modal mode', async () => {
      global.testUtils.mockViewport(640, 480);
      render(
        <SideNavigation config={mockConfig}>
          <div>Main content</div>
        </SideNavigation>
      );
      
      await waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).not.toHaveStyle('margin-left: 80px');
        expect(mainContent).not.toHaveStyle('margin-left: 280px');
      });
    });
  });

  describe('Accessibility Features', () => {
    it('should provide proper aria labels', async () => {
      const customLabel = 'Custom navigation label';
      render(<SideNavigation config={mockConfig} a11yLabel={customLabel} />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveAttribute('aria-label', customLabel);
      });
    });

    it('should support skip to content functionality', async () => {
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        const skipLink = screen.getByText('Skip to main content');
        skipLink.focus();
        
        expect(skipLink).toHaveFocus();
        expect(skipLink).toBeVisible();
      });
    });

    it('should announce navigation state changes', async () => {
      const mockAnnounce = jest.fn();
      // Mock live region announcements
      const originalCreate = document.createElement;
      document.createElement = jest.fn().mockImplementation((tagName) => {
        const element = originalCreate.call(document, tagName);
        if (tagName === 'div' && element.setAttribute) {
          element.setAttribute = jest.fn().mockImplementation((attr, value) => {
            if (attr === 'aria-live') {
              element.textContent = 'Navigation expanded';
              mockAnnounce(element.textContent);
            }
          });
        }
        return element;
      });
      
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        // Verify announcement was made
        expect(mockAnnounce).toHaveBeenCalledWith(
          expect.stringContaining('expanded')
        );
      });
      
      // Restore original createElement
      document.createElement = originalCreate;
    });
  });

  describe('Error Handling', () => {
    it('should handle missing config gracefully', async () => {
      const { container } = render(<SideNavigation />);
      
      await waitFor(() => {
        // Should not crash and render with fallback config
        expect(container.firstChild).toBeInTheDocument();
      });
    });

    it('should handle invalid config gracefully', async () => {
      const invalidConfig = { sections: null } as any;
      const { container } = render(<SideNavigation config={invalidConfig} />);
      
      await waitFor(() => {
        // Should not crash
        expect(container.firstChild).toBeInTheDocument();
      });
    });

    it('should handle context provider errors', async () => {
      // Spy on console.error to verify error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Component that uses navigation context outside provider
      const { useNavigationContext } = require('../../../components/navigation/SideNavigation');
      const TestComponent = () => {
        const context = useNavigationContext();
        return <div>Context: {context ? 'Available' : 'Not Available'}</div>;
      };
      
      // Test rendering outside provider should throw an error
      expect(() => {
        render(<TestComponent />);
      }).toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', async () => {
      let renderCount = 0;
      const TestWrapper = ({ config }: { config: NavigationConfig }) => {
        renderCount++;
        return <SideNavigation config={config} />;
      };
      
      const { rerender } = render(<TestWrapper config={mockConfig} />);
      
      await waitFor(() => {
        expect(renderCount).toBe(1);
      });
      
      // Re-render with same props
      rerender(<TestWrapper config={mockConfig} />);
      
      await waitFor(() => {
        // Should only render once more due to React's reconciliation
        expect(renderCount).toBe(2);
      });
    });

    it('should handle rapid mode changes efficiently', async () => {
      render(<SideNavigation config={mockConfig} />);
      
      await waitFor(async () => {
        // Rapid expand/collapse
        const expandButton = screen.getByRole('button', { name: /expand/i });
        
        // Multiple rapid clicks
        for (let i = 0; i < 5; i++) {
          await user.click(expandButton);
          await global.testUtils.waitForAnimation();
        }
        
        // Should still be in a stable state
        expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();
      });
    });
  });

  describe('Custom Configuration', () => {
    it('should render with custom branding', async () => {
      const configWithBranding: NavigationConfig = {
        ...mockConfig,
        branding: {
          title: 'Custom App',
          subtitle: 'Test Environment',
        },
      };
      
      render(<SideNavigation config={configWithBranding} />);
      
      await waitFor(() => {
        expect(screen.getByText('Custom App')).toBeInTheDocument();
        expect(screen.getByText('Test Environment')).toBeInTheDocument();
      });
    });

    it('should handle nested navigation items', async () => {
      const configWithNested: NavigationConfig = {
        sections: [
          {
            id: 'main',
            items: [
              {
                id: 'dashboard',
                label: 'Dashboard',
                icon: 'home',
                children: [
                  { id: 'overview', label: 'Overview', icon: 'chart' },
                  { id: 'analytics', label: 'Analytics', icon: 'graph' },
                ],
              },
            ],
          },
        ],
      };
      
      render(<SideNavigation config={configWithNested} />);
      
      await waitFor(async () => {
        const dashboardItem = screen.getByRole('button', { name: /dashboard/i });
        await user.click(dashboardItem);
        
        // Should expand to show nested items
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument();
        });
      });
    });
  });
});