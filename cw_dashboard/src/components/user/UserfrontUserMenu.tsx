'use client';

/**
 * Userfront User Menu Component
 * Simple user menu that integrates with Userfront authentication
 */

import { useRouter } from 'next/navigation';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';

export function UserfrontUserMenu() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useUserfrontAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-4">
        <span 
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {user.email}
        </span>
        <button
          onClick={handleSignOut}
          className="text-sm font-medium text-red-600 hover:text-red-500"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}