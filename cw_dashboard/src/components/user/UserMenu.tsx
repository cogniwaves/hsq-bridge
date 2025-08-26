'use client';

/**
 * User Menu Component
 * Dropdown menu for user actions in navigation with accessibility support
 */

import { Fragment, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { 
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { UserMenuProps } from '../../types/components';

export function UserMenu({
  user,
  tenant,
  onProfile,
  onSettings,
  onSignOut,
  onSwitchTenant,
  customMenuItems = [],
  position = 'bottom-right',
  testId = 'user-menu',
  className = '',
  ...props
}: UserMenuProps) {
  const [imageError, setImageError] = useState(false);

  // Get position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'left-0 mt-2 origin-top-left';
      case 'bottom-right':
        return 'right-0 mt-2 origin-top-right';
      case 'top-left':
        return 'left-0 bottom-full mb-2 origin-bottom-left';
      case 'top-right':
        return 'right-0 bottom-full mb-2 origin-bottom-right';
      default:
        return 'right-0 mt-2 origin-top-right';
    }
  };

  return (
    <Menu as="div" className={`relative ${className}`} data-testid={testId} {...props}>
      <Menu.Button
        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          backgroundColor: 'var(--color-surface-variant)',
          '--tw-ring-color': 'var(--color-primary)'
        }}
        aria-label="User menu"
      >
        {/* User avatar */}
        {user.profileImageUrl && !imageError ? (
          <img
            src={user.profileImageUrl}
            alt=""
            onError={() => setImageError(true)}
            className="h-8 w-8 rounded-full object-cover"
            aria-hidden="true"
          />
        ) : (
          <div 
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-primary-container)' }}
            aria-hidden="true"
          >
            <UserIcon 
              className="h-5 w-5" 
              style={{ color: 'var(--color-on-primary-container)' }}
            />
          </div>
        )}

        {/* User info */}
        <div className="hidden sm:block text-left">
          <p 
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {user.firstName} {user.lastName}
          </p>
          {tenant && (
            <p 
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {tenant.name}
            </p>
          )}
        </div>

        {/* Dropdown icon */}
        <ChevronDownIcon 
          className="h-4 w-4 transition-transform duration-200 ui-open:rotate-180"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden="true"
        />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          className={`absolute ${getPositionClasses()} w-64 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50`}
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-outline)'
          }}
        >
          {/* User header */}
          <div 
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-outline)' }}
          >
            <p 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Signed in as
            </p>
            <p 
              className="text-sm truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {user.email}
            </p>
            {tenant && (
              <p 
                className="text-xs mt-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <BuildingOfficeIcon className="h-3 w-3 inline mr-1" aria-hidden="true" />
                {tenant.name}
              </p>
            )}
          </div>

          <div className="py-1">
            {/* Profile */}
            {onProfile && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onProfile}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-150 ${
                      active ? 'bg-opacity-10' : ''
                    }`}
                    style={{
                      backgroundColor: active ? 'var(--color-primary-container)' : 'transparent',
                      color: active ? 'var(--color-on-primary-container)' : 'var(--color-text-primary)'
                    }}
                  >
                    <UserCircleIcon className="h-5 w-5" aria-hidden="true" />
                    Your Profile
                  </button>
                )}
              </Menu.Item>
            )}

            {/* Settings */}
            {onSettings && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onSettings}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-150 ${
                      active ? 'bg-opacity-10' : ''
                    }`}
                    style={{
                      backgroundColor: active ? 'var(--color-primary-container)' : 'transparent',
                      color: active ? 'var(--color-on-primary-container)' : 'var(--color-text-primary)'
                    }}
                  >
                    <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
                    Settings
                  </button>
                )}
              </Menu.Item>
            )}

            {/* Switch Tenant */}
            {onSwitchTenant && tenant && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onSwitchTenant}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-150 ${
                      active ? 'bg-opacity-10' : ''
                    }`}
                    style={{
                      backgroundColor: active ? 'var(--color-primary-container)' : 'transparent',
                      color: active ? 'var(--color-on-primary-container)' : 'var(--color-text-primary)'
                    }}
                  >
                    <BuildingOfficeIcon className="h-5 w-5" aria-hidden="true" />
                    Switch Organization
                  </button>
                )}
              </Menu.Item>
            )}

            {/* Custom menu items */}
            {customMenuItems.map((item, index) => (
              <Fragment key={index}>
                {item.divider && (
                  <div 
                    className="my-1 border-t"
                    style={{ borderColor: 'var(--color-outline)' }}
                  />
                )}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-150 ${
                        active ? 'bg-opacity-10' : ''
                      }`}
                      style={{
                        backgroundColor: active ? 'var(--color-primary-container)' : 'transparent',
                        color: active ? 'var(--color-on-primary-container)' : 'var(--color-text-primary)'
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  )}
                </Menu.Item>
              </Fragment>
            ))}

            {/* Divider */}
            {onSignOut && (
              <div 
                className="my-1 border-t"
                style={{ borderColor: 'var(--color-outline)' }}
              />
            )}

            {/* Sign out */}
            {onSignOut && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onSignOut}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-150 ${
                      active ? 'bg-opacity-10' : ''
                    }`}
                    style={{
                      backgroundColor: active ? 'var(--color-error-container)' : 'transparent',
                      color: active ? 'var(--color-on-error-container)' : 'var(--color-error)'
                    }}
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
                    Sign Out
                  </button>
                )}
              </Menu.Item>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}