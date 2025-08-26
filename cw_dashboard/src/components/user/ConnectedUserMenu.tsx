'use client';

/**
 * Connected User Menu Component
 * Wrapper around UserMenu that connects to authentication context
 */

import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { UserMenu } from './UserMenu';

export function ConnectedUserMenu() {
  const router = useRouter();
  const { user, tenant, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleProfile = () => {
    router.push('/profile');
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleSwitchTenant = () => {
    router.push('/tenants/select');
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <UserMenu
      user={user}
      tenant={tenant}
      onProfile={handleProfile}
      onSettings={handleSettings}
      onSwitchTenant={handleSwitchTenant}
      onSignOut={handleSignOut}
    />
  );
}