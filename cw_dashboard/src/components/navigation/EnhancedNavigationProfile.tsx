/**
 * Enhanced Navigation Profile Component
 * Advanced user profile with avatar upload, status indicators, and preferences
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { useUserProfile } from '../../hooks/useUserProfile';
import { NavigationProfileProps } from './types';
import { 
  UserIcon, 
  Cog6ToothIcon, 
  ArrowRightOnRectangleIcon,
  CameraIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

export interface EnhancedNavigationProfileProps extends NavigationProfileProps {
  /** Enable tooltip */
  enableTooltips?: boolean;
  /** Enable animations */
  enableAnimations?: boolean;
  /** Show status indicator */
  showStatus?: boolean;
  /** Show preferences menu */
  showPreferencesMenu?: boolean;
  /** Enable avatar upload */
  enableAvatarUpload?: boolean;
  /** Profile click handler */
  onProfileClick?: () => void;
  /** Settings click handler */
  onSettingsClick?: () => void;
  /** Logout click handler */
  onLogoutClick?: () => void;
  /** Status change handler */
  onStatusChange?: (status: 'online' | 'offline' | 'busy' | 'available') => void;
}

export function EnhancedNavigationProfile({
  mode,
  className = '',
  showAvatar = true,
  showEmail = true,
  showRole = true,
  showStatus = true,
  showPreferencesMenu = true,
  enableTooltips = true,
  enableAnimations = true,
  enableAvatarUpload = true,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  onStatusChange,
  a11yLabel = 'User profile menu',
}: EnhancedNavigationProfileProps) {
  const { user, logout } = useUserfrontAuth();
  const { surfaces, spacing, typography } = useNavigationTheme();
  const {
    profile,
    getAvatarUrl,
    getDisplayName,
    getUserInitials,
    getStatusProps,
    uploadAvatar,
    setStatus,
  } = useUserProfile({
    enableAvatarUpload,
    trackActivity: true,
  });

  // Local state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get profile surfaces
  const profileSurfaces = surfaces?.[mode]?.profile || {};
  
  // Handle avatar upload
  const handleAvatarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !enableAvatarUpload) return;

    try {
      setIsUploading(true);
      await uploadAvatar(file);
    } catch (error) {
      console.error('Avatar upload failed:', error);
      // You could show a toast notification here
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [enableAvatarUpload, uploadAvatar]);

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus: 'online' | 'offline' | 'busy' | 'available') => {
    try {
      await setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Status change failed:', error);
    }
  }, [setStatus, onStatusChange]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      onLogoutClick?.();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, onLogoutClick]);

  // Toggle menu
  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  // Handle profile click
  const handleProfileClick = useCallback(() => {
    if (mode === 'rail') {
      toggleMenu();
    } else {
      onProfileClick?.();
    }
  }, [mode, onProfileClick, toggleMenu]);

  // Get user data with fallbacks
  const displayName = getDisplayName() || user?.name || user?.email || 'User';
  const userEmail = user?.email || '';
  const userRole = user?.role || profile?.role || '';
  const avatarUrl = getAvatarUrl();
  const userInitials = getUserInitials() || 'U';
  const statusProps = getStatusProps();

  // Avatar component
  const AvatarComponent = () => (
    <div
      className="nav-profile-avatar"
      style={{
        position: 'relative',
        width: mode === 'rail' ? '40px' : '48px',
        height: mode === 'rail' ? '40px' : '48px',
        borderRadius: '50%',
        overflow: 'hidden',
        cursor: enableAvatarUpload ? 'pointer' : 'default',
        transition: enableAnimations ? 'transform 200ms ease' : 'none',
        transform: isAvatarHovered && enableAnimations ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsAvatarHovered(true)}
      onMouseLeave={() => setIsAvatarHovered(false)}
      onClick={() => enableAvatarUpload && fileInputRef.current?.click()}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${displayName} avatar`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--color-primary, #FF6B35)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: mode === 'rail' ? '16px' : '18px',
            fontWeight: '600',
          }}
        >
          {userInitials}
        </div>
      )}

      {/* Upload overlay */}
      {enableAvatarUpload && isAvatarHovered && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: enableAnimations ? 'opacity 200ms ease' : 'none',
          }}
        >
          <CameraIcon className="w-5 h-5 text-white" />
        </div>
      )}

      {/* Upload spinner */}
      {isUploading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="avatar-upload-spinner"
            style={{
              width: '20px',
              height: '20px',
              border: '2px solid transparent',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'nav-loading-spin 1s linear infinite',
            }}
          />
        </div>
      )}

      {/* Status indicator */}
      {showStatus && profile?.status && (
        <div
          {...statusProps}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: mode === 'rail' ? '12px' : '14px',
            height: mode === 'rail' ? '12px' : '14px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(profile.status),
            border: '2px solid white',
          }}
        />
      )}
    </div>
  );

  // Status color helper
  function getStatusColor(status: string): string {
    switch (status) {
      case 'online': return '#10B981';
      case 'busy': return '#DC2626';
      case 'available': return '#10B981';
      case 'offline': return '#6B7280';
      default: return '#6B7280';
    }
  }

  // Profile menu
  const ProfileMenu = () => (
    <div
      ref={menuRef}
      className="nav-profile-menu"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: mode === 'rail' ? '80px' : '0px',
        width: '240px',
        backgroundColor: 'var(--color-surface, #ffffff)',
        border: '1px solid var(--color-outline, #e0e0e0)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        padding: '8px',
        zIndex: 1100,
        transform: enableAnimations ? (isMenuOpen ? 'scale(1)' : 'scale(0.95)') : 'scale(1)',
        opacity: isMenuOpen ? 1 : 0,
        visibility: isMenuOpen ? 'visible' : 'hidden',
        transition: enableAnimations ? 'all 200ms ease' : 'none',
        transformOrigin: mode === 'rail' ? 'left bottom' : 'center bottom',
      }}
    >
      {/* User info */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--color-outline, #e0e0e0)',
          marginBottom: '8px',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
          {displayName}
        </div>
        {showEmail && userEmail && (
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginBottom: '4px' }}>
            {userEmail}
          </div>
        )}
        {showRole && userRole && (
          <div style={{ fontSize: '11px', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {userRole}
          </div>
        )}
      </div>

      {/* Status options */}
      {showStatus && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 8px', color: 'var(--color-on-surface-variant)' }}>
            Status
          </div>
          {(['online', 'busy', 'available', 'offline'] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: profile?.status === status ? 'var(--color-primary-container)' : 'transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                fontSize: '13px',
                marginBottom: '2px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(status),
                  marginRight: '8px',
                }}
              />
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {profile?.status === status && (
                <CheckCircleIconSolid className="w-4 h-4 ml-auto text-primary" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Menu items */}
      <div>
        <button
          onClick={() => {
            setIsMenuOpen(false);
            onSettingsClick?.();
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            backgroundColor: 'transparent',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            marginBottom: '2px',
          }}
        >
          <Cog6ToothIcon className="w-4 h-4 mr-3" />
          Settings
        </button>
        
        <button
          onClick={() => {
            setIsMenuOpen(false);
            handleLogout();
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            backgroundColor: 'transparent',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            color: 'var(--color-error, #DC2626)',
          }}
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );

  // Rail mode (compact)
  if (mode === 'rail') {
    return (
      <div
        className={`nav-profile nav-profile--rail ${className}`}
        style={{
          position: 'relative',
          marginTop: 'auto',
          padding: '8px',
        }}
      >
        <button
          onClick={handleProfileClick}
          className="nav-profile-button"
          aria-label={a11yLabel}
          style={{
            width: '48px',
            height: '48px',
            border: 'none',
            backgroundColor: 'transparent',
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: enableAnimations ? 'all 200ms ease' : 'none',
          }}
          onMouseEnter={(e) => {
            if (enableAnimations) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (enableAnimations) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <AvatarComponent />
        </button>

        {/* Profile menu for rail mode */}
        {isMenuOpen && <ProfileMenu />}

        {/* Hidden file input */}
        {enableAvatarUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: 'none' }}
          />
        )}
      </div>
    );
  }

  // Drawer/Modal mode (expanded)
  return (
    <div
      className={`nav-profile nav-profile--${mode} ${className}`}
      style={{
        marginTop: 'auto',
        padding: spacing?.profile?.padding || '16px',
        borderTop: `1px solid ${profileSurfaces.border || 'var(--color-outline, #e0e0e0)'}`,
      }}
    >
      <button
        onClick={handleProfileClick}
        className="nav-profile-button"
        aria-label={a11yLabel}
        style={{
          width: '100%',
          padding: '12px',
          border: 'none',
          backgroundColor: 'transparent',
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'left',
          transition: enableAnimations ? 'all 200ms ease' : 'none',
        }}
        onMouseEnter={(e) => {
          if (enableAnimations) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.08)';
          }
        }}
        onMouseLeave={(e) => {
          if (enableAnimations) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <AvatarComponent />
        
        <div style={{ marginLeft: '12px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </div>
          {showEmail && userEmail && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-on-surface-variant)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userEmail}
            </div>
          )}
          {showRole && userRole && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginTop: '2px',
              }}
            >
              {userRole}
            </div>
          )}
        </div>

        <EllipsisVerticalIcon className="w-5 h-5 ml-2" />
      </button>

      {/* Hidden file input */}
      {enableAvatarUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}

export default EnhancedNavigationProfile;