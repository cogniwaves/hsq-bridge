/**
 * Navigation Profile Component
 * User profile section integrated with Userfront authentication
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { NavigationProfileProps, NavigationMode } from './types';
import {
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronUpIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

export function NavigationProfile({
  mode,
  className = '',
  showAvatar = true,
  showEmail = true,
  showRole = false,
  onSettingsClick,
  onLogoutClick,
  a11yLabel = 'User profile menu',
}: NavigationProfileProps) {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useUserfrontAuth();
  const { surfaces, typography, spacing, itemStates, mode: themeMode } = useNavigationTheme();
  
  // Safe access to theme surfaces with fallbacks
  const railSurfaces = surfaces?.rail || {};
  const modalSurfaces = surfaces?.modal || {};
  const drawerSurfaces = surfaces?.drawer || {};
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      if (onLogoutClick) {
        onLogoutClick();
      }
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSettings = () => {
    if (onSettingsClick) {
      onSettingsClick();
    }
    router.push('/settings');
    setIsMenuOpen(false);
  };

  const handleProfileClick = () => {
    router.push('/profile');
    setIsMenuOpen(false);
  };

  // Extract user information
  const userName = user.name || user.email?.split('@')[0] || 'User';
  const userEmail = user.email || '';
  const userRole = user.role || user.authorization?.tenantId || 'Member';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Rail mode - compact view
  if (mode === 'rail') {
    return (
      <div
        className={`nav-profile nav-profile-rail ${className}`}
        style={{
          borderTop: `1px solid ${railSurfaces.border || 'var(--color-surface-variant, #e0e0e0)'}`,
          padding: spacing.userProfile.borderTopMargin,
          marginTop: spacing.userProfile.marginTop,
        }}
      >
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="nav-profile-avatar-button"
          aria-label={a11yLabel}
          aria-expanded={isMenuOpen}
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: itemStates[themeMode].hover.background,
            color: itemStates[themeMode].default.color,
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background-color 200ms ease',
          }}
        >
          {showAvatar ? (
            <div
              className="nav-avatar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: itemStates[themeMode].active.background,
                color: itemStates[themeMode].active.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              {userInitials}
            </div>
          ) : (
            <UserCircleIcon className="w-8 h-8" />
          )}
        </button>

        {/* Dropdown menu for rail mode */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="nav-profile-menu"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '100%',
              marginLeft: '8px',
              marginBottom: '8px',
              minWidth: '200px',
              backgroundColor: modalSurfaces.background || 'var(--color-surface, #ffffff)',
              border: `1px solid ${modalSurfaces.border || 'var(--color-surface-variant, #e0e0e0)'}`,
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              padding: '8px',
              zIndex: 1000,
            }}
          >
            <ProfileMenu
              userName={userName}
              userEmail={userEmail}
              userRole={userRole}
              showRole={showRole}
              onProfileClick={handleProfileClick}
              onSettingsClick={handleSettings}
              onLogoutClick={handleLogout}
              themeMode={themeMode}
              itemStates={itemStates}
            />
          </div>
        )}
      </div>
    );
  }

  // Drawer and Modal modes - expanded view
  return (
    <div
      className={`nav-profile nav-profile-${mode} ${className}`}
      style={{
        borderTop: `1px solid ${(mode === 'rail' ? railSurfaces : mode === 'modal' ? modalSurfaces : drawerSurfaces).border || 'var(--color-surface-variant, #e0e0e0)'}`,
        padding: spacing.container[mode].padding,
        paddingTop: spacing.userProfile.paddingTop,
        marginTop: spacing.userProfile.marginTop,
      }}
    >
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="nav-profile-button"
        aria-label={a11yLabel}
        aria-expanded={isMenuOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: spacing.userProfile.avatarToText,
          padding: `8px ${spacing.container[mode].itemPadding}`,
          backgroundColor: isMenuOpen ? itemStates[themeMode].hover.background : 'transparent',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'background-color 200ms ease',
        }}
      >
        {/* Avatar */}
        {showAvatar && (
          <div
            className="nav-avatar"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: itemStates[themeMode].active.background,
              color: itemStates[themeMode].active.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '600',
              flexShrink: 0,
            }}
          >
            {userInitials}
          </div>
        )}

        {/* User Info */}
        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div
            style={{
              ...typography.userProfile.name,
              color: itemStates[themeMode].default.color,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {userName}
          </div>
          {showEmail && (
            <div
              style={{
                ...typography.userProfile.email,
                color: itemStates[themeMode].default.icon,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userEmail}
            </div>
          )}
          {showRole && (
            <div
              style={{
                ...typography.userProfile.role,
                color: itemStates[themeMode].default.icon,
                marginTop: '2px',
              }}
            >
              {userRole}
            </div>
          )}
        </div>

        {/* Chevron Icon */}
        <ChevronUpIcon
          className="w-4 h-4"
          style={{
            transform: isMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
            color: itemStates[themeMode].default.icon,
          }}
        />
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="nav-profile-menu"
          style={{
            marginTop: '8px',
            backgroundColor: modalSurfaces.background || 'var(--color-surface, #ffffff)',
            border: `1px solid ${modalSurfaces.border || 'var(--color-surface-variant, #e0e0e0)'}`,
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          <ProfileMenu
            userName={userName}
            userEmail={userEmail}
            userRole={userRole}
            showRole={false}
            onProfileClick={handleProfileClick}
            onSettingsClick={handleSettings}
            onLogoutClick={handleLogout}
            themeMode={themeMode}
            itemStates={itemStates}
          />
        </div>
      )}
    </div>
  );
}

// Profile menu items component
function ProfileMenu({
  userName,
  userEmail,
  userRole,
  showRole,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  themeMode,
  itemStates,
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  showRole: boolean;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onLogoutClick: () => void;
  themeMode: 'light' | 'dark';
  itemStates: any;
}) {
  const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    color: itemStates[themeMode].default.color,
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'background-color 200ms ease',
  };

  const menuItemHoverStyle = {
    backgroundColor: itemStates[themeMode].hover.background,
    color: itemStates[themeMode].hover.color,
  };

  return (
    <>
      <button
        onClick={onProfileClick}
        style={menuItemStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
      >
        <UserIcon className="w-5 h-5" />
        <span>View Profile</span>
      </button>

      <button
        onClick={onSettingsClick}
        style={menuItemStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
      >
        <Cog6ToothIcon className="w-5 h-5" />
        <span>Settings</span>
      </button>

      <div style={{ height: '1px', backgroundColor: itemStates[themeMode].default.icon, opacity: 0.2, margin: '8px 0' }} />

      <button
        onClick={onLogoutClick}
        style={{
          ...menuItemStyle,
          color: 'rgb(239, 68, 68)', // red-500
        }}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'rgb(220, 38, 38)', // red-600
        })}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, {
          backgroundColor: 'transparent',
          color: 'rgb(239, 68, 68)',
        })}
      >
        <ArrowRightOnRectangleIcon className="w-5 h-5" />
        <span>Sign Out</span>
      </button>
    </>
  );
}

export default NavigationProfile;