/**
 * Navigation Authentication Integration Tests
 * Tests for navigation system integration with Userfront authentication
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNavigation } from '../../../components/navigation/SideNavigation';
import { UserfrontAuthProvider } from '../../../contexts/UserfrontAuthContext';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

// Create test wrapper with authentication context
const AuthTestWrapper = ({ 
  children, 
  authState = {} 
}: { 
  children: React.ReactNode;
  authState?: Partial<any>;
}) => {
  const mockAuthValue = {
    user: global.testUtils.createMockUser(),
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
    refreshUser: jest.fn(),
    ...authState,
  };

  // Mock the auth context
  jest.doMock('../../../contexts/UserfrontAuthContext', () => ({
    useUserfrontAuth: () => mockAuthValue,
    UserfrontAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  }));

  return <UserfrontAuthProvider>{children}</UserfrontAuthProvider>;
};

describe('Navigation Authentication Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockConfig = global.testUtils.createMockNavigationConfig({
    sections: [
      {
        id: 'main',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'home', href: '/dashboard' },
          { 
            id: 'admin', 
            label: 'Admin', 
            icon: 'cog', 
            href: '/admin',
            requiredPermissions: ['admin'],
            visible: (user: any) => user?.role === 'admin'
          },
          { 
            id: 'billing', 
            label: 'Billing', 
            icon: 'currency-dollar', 
            href: '/billing',
            requiredPermissions: ['billing.read']
          },
        ],
      },
    ],
    footer: {
      id: 'footer',
      items: [
        { id: 'profile', label: 'Profile', icon: 'user', href: '/profile' },
        { id: 'logout', label: 'Logout', icon: 'logout', onClick: () => {} },
      ],
    },
  });

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  describe('Authenticated User Navigation', () => {
    it('should render navigation for authenticated user', async () => {
      render(
        <AuthTestWrapper>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
      });
    });

    it('should show user profile information', async () => {
      const mockUser = global.testUtils.createMockUser({
        name: 'John Doe',
        email: 'john@example.com',
      });

      render(
        <AuthTestWrapper authState={{ user: mockUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });
    });

    it('should handle user permissions correctly', async () => {
      const regularUser = global.testUtils.createMockUser({
        role: 'user',
        permissions: ['billing.read'],
      });

      render(
        <AuthTestWrapper authState={{ user: regularUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        // Regular user should see dashboard and billing
        expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /billing/i })).toBeInTheDocument();
        
        // But not admin section
        expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument();
      });
    });

    it('should show admin items for admin users', async () => {
      const adminUser = global.testUtils.createMockUser({
        role: 'admin',
        permissions: ['admin', 'billing.read'],
      });

      render(
        <AuthTestWrapper authState={{ user: adminUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /billing/i })).toBeInTheDocument();
      });
    });

    it('should handle logout functionality', async () => {
      const mockLogout = jest.fn();
      
      render(
        <AuthTestWrapper authState={{ logout: mockLogout }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(async () => {
        const logoutButton = screen.getByRole('button', { name: /logout/i });
        await user.click(logoutButton);

        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe('Unauthenticated User Navigation', () => {
    it('should handle unauthenticated state', async () => {
      render(
        <AuthTestWrapper authState={{ 
          user: null, 
          isAuthenticated: false 
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        // Navigation should still render but with limited functionality
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        
        // Items requiring authentication should not be clickable
        const protectedItems = screen.queryAllByRole('button');
        protectedItems.forEach(item => {
          expect(item).toBeDisabled();
        });
      });
    });

    it('should redirect to login on protected route access', async () => {
      render(
        <AuthTestWrapper authState={{ 
          user: null, 
          isAuthenticated: false 
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(async () => {
        const dashboardLink = screen.getByText('Dashboard').closest('a');
        if (dashboardLink) {
          await user.click(dashboardLink);
          
          // Should redirect to login
          expect(mockPush).toHaveBeenCalledWith('/auth/signin?redirect=%2Fdashboard');
        }
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while authentication is pending', async () => {
      render(
        <AuthTestWrapper authState={{ 
          user: null, 
          isAuthenticated: false,
          isLoading: true
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navigation-skeleton')).toBeInTheDocument();
      });
    });

    it('should transition from loading to authenticated state', async () => {
      const { rerender } = render(
        <AuthTestWrapper authState={{ 
          user: null, 
          isAuthenticated: false,
          isLoading: true
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navigation-skeleton')).toBeInTheDocument();
      });

      // Simulate authentication completion
      rerender(
        <AuthTestWrapper authState={{ 
          user: global.testUtils.createMockUser(),
          isAuthenticated: true,
          isLoading: false
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('navigation-skeleton')).not.toBeInTheDocument();
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const authError = new Error('Authentication failed');
      
      render(
        <AuthTestWrapper authState={{ 
          user: null, 
          isAuthenticated: false,
          isLoading: false,
          error: authError
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should handle token refresh failures', async () => {
      const mockRefreshUser = jest.fn().mockRejectedValue(new Error('Token refresh failed'));
      
      render(
        <AuthTestWrapper authState={{ 
          user: global.testUtils.createMockUser(),
          isAuthenticated: true,
          refreshUser: mockRefreshUser
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      // Simulate token refresh attempt
      await mockRefreshUser();

      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in again/i })).toBeInTheDocument();
      });
    });
  });

  describe('Multi-tenant Support', () => {
    it('should handle tenant-specific navigation', async () => {
      const tenantUser = global.testUtils.createMockUser({
        tenantId: 'tenant-123',
        tenantData: {
          name: 'Acme Corp',
          plan: 'premium',
        },
      });

      const tenantConfig = {
        ...mockConfig,
        sections: [
          {
            id: 'tenant',
            title: 'Tenant Features',
            items: [
              { 
                id: 'multi-user', 
                label: 'User Management', 
                icon: 'users',
                visible: (user: any) => user?.tenantData?.plan === 'premium'
              },
            ],
          },
          ...mockConfig.sections,
        ],
      };

      render(
        <AuthTestWrapper authState={{ user: tenantUser }}>
          <SideNavigation config={tenantConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /user management/i })).toBeInTheDocument();
      });
    });

    it('should handle tenant switching', async () => {
      const mockSwitchTenant = jest.fn();
      const tenantUser = global.testUtils.createMockUser({
        tenantId: 'tenant-123',
        availableTenants: [
          { id: 'tenant-123', name: 'Acme Corp' },
          { id: 'tenant-456', name: 'Beta Inc' },
        ],
        switchTenant: mockSwitchTenant,
      });

      render(
        <AuthTestWrapper authState={{ user: tenantUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(async () => {
        const tenantSwitcher = screen.getByRole('button', { name: /acme corp/i });
        await user.click(tenantSwitcher);

        const betaOption = screen.getByRole('option', { name: /beta inc/i });
        await user.click(betaOption);

        expect(mockSwitchTenant).toHaveBeenCalledWith('tenant-456');
      });
    });
  });

  describe('Session Management', () => {
    it('should handle session expiry during navigation', async () => {
      const mockUser = global.testUtils.createMockUser({
        accessToken: 'expired-token',
      });

      // Mock API call that returns 401
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Token expired' }),
      });

      render(
        <AuthTestWrapper authState={{ user: mockUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(async () => {
        const dashboardItem = screen.getByRole('button', { name: /dashboard/i });
        await user.click(dashboardItem);

        // Should redirect to login
        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/auth/signin?redirect=%2Fdashboard');
        });
      });
    });

    it('should refresh token automatically', async () => {
      const mockRefreshUser = jest.fn().mockResolvedValue(
        global.testUtils.createMockUser({ accessToken: 'new-token' })
      );

      render(
        <AuthTestWrapper authState={{ 
          user: global.testUtils.createMockUser(),
          refreshUser: mockRefreshUser
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      // Simulate token refresh trigger
      await waitFor(() => {
        // Should automatically refresh token on navigation data load
        expect(mockRefreshUser).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation State Persistence', () => {
    it('should persist navigation state across page reloads', async () => {
      const mockUser = global.testUtils.createMockUser();
      
      // Mock localStorage
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem')
        .mockReturnValue(JSON.stringify({
          mode: 'drawer',
          activeItemId: 'billing',
          expandedSections: ['main'],
        }));

      render(
        <AuthTestWrapper authState={{ user: mockUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        // Should restore from localStorage
        expect(screen.getByTestId('navigation-drawer')).toBeInTheDocument();
        
        const billingItem = screen.getByRole('button', { name: /billing/i });
        expect(billingItem).toHaveAttribute('aria-pressed', 'true');
      });

      getItemSpy.mockRestore();
    });

    it('should save navigation state changes', async () => {
      const mockUser = global.testUtils.createMockUser();
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

      render(
        <AuthTestWrapper authState={{ user: mockUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);

        expect(setItemSpy).toHaveBeenCalledWith(
          'navigation-preferences',
          expect.stringContaining('"mode":"drawer"')
        );
      });

      setItemSpy.mockRestore();
    });
  });

  describe('Real-time Updates', () => {
    it('should update navigation badges from API', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            pendingInvoices: 5,
            recentPayments: 3,
            failedWebhooks: 1,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ count: 7 }),
        });

      render(
        <AuthTestWrapper>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        // Should show updated badge counts
        expect(screen.getByText('5')).toBeInTheDocument(); // Invoice badge
        expect(screen.getByText('7')).toBeInTheDocument(); // Notification badge
      });
    });

    it('should handle WebSocket real-time updates', async () => {
      process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET = 'true';

      render(
        <AuthTestWrapper>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        // WebSocket connection should be established
        expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3000/ws');
      });

      // Simulate real-time update
      const ws = new (global.WebSocket as any)('ws://test');
      ws.simulateMessage({
        type: 'notification',
        payload: { count: 1 },
      });

      await waitFor(() => {
        // Badge should be updated
        expect(screen.getByText('8')).toBeInTheDocument(); // Previous 7 + 1
      });
    });
  });

  describe('Accessibility with Authentication', () => {
    it('should announce authentication state changes', async () => {
      const { rerender } = render(
        <AuthTestWrapper authState={{ 
          user: null, 
          isAuthenticated: false,
          isLoading: true
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      // Simulate successful authentication
      rerender(
        <AuthTestWrapper authState={{ 
          user: global.testUtils.createMockUser({ name: 'John Doe' }),
          isAuthenticated: true,
          isLoading: false
        }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/signed in as john doe/i);
      });
    });

    it('should provide proper screen reader context for protected items', async () => {
      const limitedUser = global.testUtils.createMockUser({
        role: 'user',
        permissions: [],
      });

      render(
        <AuthTestWrapper authState={{ user: limitedUser }}>
          <SideNavigation config={mockConfig} />
        </AuthTestWrapper>
      );

      await waitFor(() => {
        const adminItem = screen.queryByRole('button', { name: /admin/i });
        if (adminItem) {
          expect(adminItem).toHaveAttribute('aria-disabled', 'true');
          expect(adminItem).toHaveAttribute('aria-describedby', expect.stringContaining('insufficient-permissions'));
        }
      });
    });
  });
});