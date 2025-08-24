/**
 * Theme Toggle Component
 * Professional theme switcher for business applications
 */

'use client';

import React from 'react';
import { useTheme } from '../themes/themeProvider';

// Icon components (using CSS for simplicity, can be replaced with icon library)
const SunIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      fillRule="evenodd" 
      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" 
      clipRule="evenodd" 
    />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" 
    />
  </svg>
);

const SystemIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      fillRule="evenodd" 
      d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" 
      clipRule="evenodd" 
    />
  </svg>
);

// Theme toggle component props
interface ThemeToggleProps {
  variant?: 'icon' | 'button' | 'select';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
  includeSystem?: boolean;
}

// Icon button variant
function IconToggle({ 
  size = 'medium', 
  showTooltip = true, 
  className = '',
  includeSystem = true 
}: ThemeToggleProps) {
  const { mode, resolvedMode, toggleMode, setMode } = useTheme();

  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-5 w-5',
    large: 'h-6 w-6',
  };

  const buttonSizeClasses = {
    small: 'p-1',
    medium: 'p-2',
    large: 'p-3',
  };

  const handleClick = () => {
    if (includeSystem) {
      // Cycle through: light -> dark -> system -> light
      if (mode === 'light') setMode('dark');
      else if (mode === 'dark') setMode('system');
      else setMode('light');
    } else {
      // Simple toggle between light and dark
      toggleMode();
    }
  };

  const getIcon = () => {
    if (mode === 'system') {
      return <SystemIcon className={sizeClasses[size]} />;
    }
    return resolvedMode === 'dark' ? 
      <MoonIcon className={sizeClasses[size]} /> : 
      <SunIcon className={sizeClasses[size]} />;
  };

  const getTooltipText = () => {
    if (mode === 'system') return 'Using system theme';
    return `Switch to ${resolvedMode === 'light' ? 'dark' : 'light'} theme`;
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center justify-center rounded-md
        transition-all duration-200 ease-in-out
        hover:bg-black/5 dark:hover:bg-white/5
        focus:outline-none focus:ring-2 focus:ring-offset-2 
        focus:ring-[var(--color-primary)] 
        ${buttonSizeClasses[size]}
        ${className}
      `}
      title={showTooltip ? getTooltipText() : undefined}
      aria-label={`Current theme: ${mode}. Click to change theme.`}
    >
      <span 
        className="transition-transform duration-200 ease-in-out hover:scale-110"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {getIcon()}
      </span>
    </button>
  );
}

// Button variant
function ButtonToggle({ 
  size = 'medium', 
  showLabel = true, 
  className = '',
  includeSystem = true 
}: ThemeToggleProps) {
  const { mode, resolvedMode, toggleMode, setMode } = useTheme();

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1.5 text-sm',
    large: 'px-4 py-2 text-base',
  };

  const iconSizeClasses = {
    small: 'h-3 w-3',
    medium: 'h-4 w-4',
    large: 'h-5 w-5',
  };

  const handleClick = () => {
    if (includeSystem) {
      if (mode === 'light') setMode('dark');
      else if (mode === 'dark') setMode('system');
      else setMode('light');
    } else {
      toggleMode();
    }
  };

  const getIcon = () => {
    if (mode === 'system') {
      return <SystemIcon className={iconSizeClasses[size]} />;
    }
    return resolvedMode === 'dark' ? 
      <MoonIcon className={iconSizeClasses[size]} /> : 
      <SunIcon className={iconSizeClasses[size]} />;
  };

  const getLabel = () => {
    if (mode === 'system') return 'System';
    return resolvedMode === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center space-x-2 rounded-md
        border border-gray-300 dark:border-gray-600
        bg-white dark:bg-gray-800
        transition-all duration-200 ease-in-out
        hover:bg-gray-50 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-offset-2 
        focus:ring-[var(--color-primary)]
        ${sizeClasses[size]}
        ${className}
      `}
      aria-label={`Current theme: ${mode}. Click to change theme.`}
    >
      <span style={{ color: 'var(--color-text-secondary)' }}>
        {getIcon()}
      </span>
      {showLabel && (
        <span 
          className="font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {getLabel()}
        </span>
      )}
    </button>
  );
}

// Select variant
function SelectToggle({ 
  size = 'medium', 
  className = '',
  includeSystem = true 
}: ThemeToggleProps) {
  const { mode, setMode } = useTheme();

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1.5 text-sm',
    large: 'px-4 py-2 text-base',
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = event.target.value as 'light' | 'dark' | 'system';
    setMode(newMode);
  };

  return (
    <select
      value={mode}
      onChange={handleChange}
      className={`
        rounded-md border border-gray-300 dark:border-gray-600
        bg-white dark:bg-gray-800
        transition-all duration-200 ease-in-out
        hover:bg-gray-50 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-offset-2 
        focus:ring-[var(--color-primary)]
        ${sizeClasses[size]}
        ${className}
      `}
      style={{ color: 'var(--color-text-primary)' }}
      aria-label="Select theme"
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      {includeSystem && <option value="system">System</option>}
    </select>
  );
}

// Main theme toggle component
export function ThemeToggle(props: ThemeToggleProps) {
  const { variant = 'icon' } = props;

  switch (variant) {
    case 'button':
      return <ButtonToggle {...props} />;
    case 'select':
      return <SelectToggle {...props} />;
    case 'icon':
    default:
      return <IconToggle {...props} />;
  }
}

// Hook for custom theme toggle implementation
export function useThemeToggle() {
  const { mode, resolvedMode, setMode, toggleMode, systemPreference } = useTheme();

  return {
    mode,
    resolvedMode,
    systemPreference,
    setMode,
    toggleMode,
    isLight: resolvedMode === 'light',
    isDark: resolvedMode === 'dark',
    isSystem: mode === 'system',
  };
}

export default ThemeToggle;