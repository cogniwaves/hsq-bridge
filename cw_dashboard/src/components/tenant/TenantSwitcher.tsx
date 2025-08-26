'use client';

/**
 * Tenant Switcher Component
 * Enhanced tenant switching with search and role display
 */

import { Fragment, useState, useMemo } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { 
  CheckIcon, 
  ChevronUpDownIcon,
  BuildingOfficeIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { TenantSwitcherProps } from '../../types/components';
import { TenantRole } from '../../types/auth';

// Role badge component
function RoleBadge({ role }: { role: TenantRole }) {
  const getRoleColor = () => {
    switch (role) {
      case TenantRole.OWNER:
        return {
          bg: 'var(--color-error-container)',
          text: 'var(--color-on-error-container)'
        };
      case TenantRole.ADMIN:
        return {
          bg: 'var(--color-warning-container)',
          text: 'var(--color-on-warning-container)'
        };
      case TenantRole.MEMBER:
        return {
          bg: 'var(--color-primary-container)',
          text: 'var(--color-on-primary-container)'
        };
      case TenantRole.VIEWER:
        return {
          bg: 'var(--color-surface-variant)',
          text: 'var(--color-text-secondary)'
        };
      default:
        return {
          bg: 'var(--color-surface-variant)',
          text: 'var(--color-text-secondary)'
        };
    }
  };

  const colors = getRoleColor();

  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: colors.bg,
        color: colors.text
      }}
    >
      {role}
    </span>
  );
}

export function TenantSwitcher({
  currentTenant,
  memberships,
  onSwitch,
  onCreate,
  searchable = true,
  showRole = true,
  compact = false,
  isLoading = false,
  testId = 'tenant-switcher',
  className = '',
  ...props
}: TenantSwitcherProps) {
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter memberships based on search query
  const filteredMemberships = useMemo(() => {
    if (!searchable || query === '') {
      return memberships;
    }

    return memberships.filter((membership) =>
      membership.tenant.name.toLowerCase().includes(query.toLowerCase()) ||
      membership.tenant.domain?.toLowerCase().includes(query.toLowerCase())
    );
  }, [memberships, query, searchable]);

  // Handle tenant selection
  const handleSelect = async (membership: typeof memberships[0] | null) => {
    if (!membership || !onSwitch || membership.tenantId === currentTenant?.id) return;

    setIsSubmitting(true);
    try {
      await onSwitch(membership.tenantId);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find current membership
  const currentMembership = memberships.find(m => m.tenantId === currentTenant?.id);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid={testId} {...props}>
        <BuildingOfficeIcon 
          className="h-4 w-4"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden="true"
        />
        <span 
          className="text-sm font-medium truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {currentTenant?.name || 'Select Organization'}
        </span>
        {showRole && currentMembership && (
          <RoleBadge role={currentMembership.role} />
        )}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`} data-testid={testId} {...props}>
      <Combobox value={currentMembership} onChange={handleSelect}>
        <div className="relative">
          <div className="relative w-full">
            <Combobox.Button 
              className="relative w-full py-2 pl-10 pr-10 text-left rounded-lg shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-outline)',
                '--tw-ring-color': 'var(--color-primary)'
              }}
              disabled={isLoading || isSubmitting}
              aria-label="Select organization"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <BuildingOfficeIcon 
                  className="h-5 w-5"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-hidden="true"
                />
              </span>
              <span className="block truncate" style={{ color: 'var(--color-text-primary)' }}>
                {currentTenant?.name || 'Select Organization'}
              </span>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2">
                {isSubmitting ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <ChevronUpDownIcon 
                    className="h-5 w-5"
                    style={{ color: 'var(--color-text-secondary)' }}
                    aria-hidden="true"
                  />
                )}
              </span>
            </Combobox.Button>

            {showRole && currentMembership && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <RoleBadge role={currentMembership.role} />
              </div>
            )}
          </div>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => setQuery('')}
          >
            <Combobox.Options 
              className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-outline)'
              }}
            >
              {searchable && (
                <div className="sticky top-0 px-3 py-2" style={{ backgroundColor: 'var(--color-surface)' }}>
                  <div className="relative">
                    <MagnifyingGlassIcon 
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: 'var(--color-text-secondary)' }}
                      aria-hidden="true"
                    />
                    <Combobox.Input
                      className="w-full pl-10 pr-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline)',
                        color: 'var(--color-text-primary)'
                      }}
                      placeholder="Search organizations..."
                      onChange={(event) => setQuery(event.target.value)}
                      displayValue={(membership: any) => membership?.tenant?.name || ''}
                    />
                  </div>
                </div>
              )}

              {filteredMemberships.length === 0 && query !== '' ? (
                <div 
                  className="px-4 py-2 text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  No organizations found.
                </div>
              ) : (
                filteredMemberships.map((membership) => (
                  <Combobox.Option
                    key={membership.id}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                        active ? 'bg-opacity-10' : ''
                      }`
                    }
                    style={({ active }) => ({
                      backgroundColor: active ? 'var(--color-primary-container)' : 'transparent',
                      color: active ? 'var(--color-on-primary-container)' : 'var(--color-text-primary)'
                    })}
                    value={membership}
                    disabled={membership.tenantId === currentTenant?.id}
                  >
                    {({ selected, active }) => (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                              {membership.tenant.name}
                            </span>
                            {membership.tenant.domain && (
                              <span 
                                className="block text-xs truncate"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                {membership.tenant.domain}
                              </span>
                            )}
                          </div>
                          {showRole && (
                            <RoleBadge role={membership.role} />
                          )}
                        </div>
                        {selected && (
                          <span
                            className="absolute inset-y-0 left-0 flex items-center pl-3"
                            style={{ color: active ? 'var(--color-on-primary-container)' : 'var(--color-primary)' }}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </Combobox.Option>
                ))
              )}

              {onCreate && (
                <>
                  <div 
                    className="my-1 border-t"
                    style={{ borderColor: 'var(--color-outline)' }}
                  />
                  <button
                    onClick={onCreate}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-150 hover:bg-opacity-10"
                    style={{
                      color: 'var(--color-primary)'
                    }}
                  >
                    <PlusCircleIcon className="h-5 w-5" aria-hidden="true" />
                    Create New Organization
                  </button>
                </>
              )}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  );
}