'use client';

/**
 * Userfront Authentication Context Provider
 * Manages global authentication state using Userfront SDK v2
 * 
 * @userfront/react v2.0.3 - Uses UserfrontProvider and useUserfront hook
 * @userfront/core v1.1.2 - Provides core authentication methods
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UserfrontProvider as BaseUserfrontProvider, 
  useUserfront as useUserfrontBase 
} from '@userfront/react';
import Userfront from '@userfront/core';

// Initialize Userfront Core with workspace ID
const WORKSPACE_ID = process.env.NEXT_PUBLIC_USERFRONT_WORKSPACE_ID || '8nwx667b';

// Track initialization state
let isUserfrontInitialized = false;

// Initialize Userfront Core globally ONLY in browser environment
// This is critical - Userfront requires window object and won't work in SSR
function initializeUserfront() {
  if (!isUserfrontInitialized && typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Initialize Userfront with workspace ID
    try {
      Userfront.init(WORKSPACE_ID);
      isUserfrontInitialized = true;
      // Userfront initialized successfully
    } catch (error) {
      console.error('[UserfrontAuth] Failed to initialize Userfront:', error);
    }
  }
}

// Initialize on module load if in browser
if (typeof window !== 'undefined') {
  initializeUserfront();
}

/**
 * Enhanced authentication context value with additional state management
 */
interface UserfrontAuthContextValue {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string; tenantId?: string }) => Promise<void>;
  register: (data: { email: string; password: string; name?: string; tenantId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  // Multi-tenant specific methods
  setTenantContext: (tenantId: string) => void;
  getCurrentTenant: () => string | null;
}

// Create the enhanced context
export const UserfrontAuthContext = createContext<UserfrontAuthContextValue | undefined>(undefined);

/**
 * Internal provider component that uses the Userfront hook
 * This component must be wrapped by UserfrontProvider
 */
function InternalAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const userfrontState = useUserfrontBase();
  const [error, setError] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  
  // Ensure Userfront is initialized when component mounts
  useEffect(() => {
    initializeUserfront();
  }, []);

  // Extract user and loading state from Userfront hook
  const { user, isLoading: baseIsLoading } = userfrontState;
  const isAuthenticated = !!user?.userId;

  // Set tenant context from user data or JWT claims
  useEffect(() => {
    if (user?.tenantId) {
      setCurrentTenantId(user.tenantId);
    } else if (user?.authorization?.tenantId) {
      setCurrentTenantId(user.authorization.tenantId);
    }
  }, [user]);

  /**
   * Enhanced login with multi-tenant support
   */
  const login = useCallback(async (credentials: { 
    email: string; 
    password: string; 
    tenantId?: string 
  }) => {
    try {
      setError(null);

      // Prepare login options - Note: tenantId is NOT passed to Userfront.login()
      // The workspace/tenant is already configured via Userfront.init()
      const loginOptions: any = {
        method: 'password',
        email: credentials.email,
        password: credentials.password,
        redirect: false  // Disable auto-redirect to handle it manually
      };

      // Track tenant context locally if provided (for multi-tenant app logic)
      if (credentials.tenantId) {
        setCurrentTenantId(credentials.tenantId);
      }

      // Use Userfront Core login method
      // Attempting login with Userfront
      
      // Ensure we're in browser environment
      if (typeof window === 'undefined') {
        throw new Error('Authentication can only be performed in browser environment');
      }
      
      const response = await Userfront.login(loginOptions);

      // Login response received - check for successful authentication
      
      // Check if login was successful - response may not contain tokens directly
      // but Userfront will handle authentication state internally
      if (response && (response.tokens?.accessToken || response.redirectTo || !response.error)) {
        // Login successful - redirect to dashboard
        router.push('/');
      } else {
        console.error('[UserfrontAuth] Login failed:', response);
        throw new Error(response?.message || 'Login failed - please check your credentials');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [router]);

  /**
   * Enhanced registration with multi-tenant support
   */
  const register = useCallback(async (data: { 
    email: string; 
    password: string; 
    name?: string;
    tenantId?: string;
  }) => {
    try {
      setError(null);

      // Log registration attempt (without sensitive data in production)
      console.log('[UserfrontAuth] Registration attempt for:', data.email);

      // Prepare signup options - The SDK expects 'method' field
      // but we need to check if this is causing issues
      const signupOptions: any = {
        method: 'password',
        email: data.email,
        password: data.password,
        name: data.name,
        redirect: false  // Disable auto-redirect to handle it manually
      };


      // Track tenant context locally if provided (for multi-tenant app logic)
      if (data.tenantId) {
        setCurrentTenantId(data.tenantId);
      }

      // Ensure we're in browser environment
      if (typeof window === 'undefined') {
        throw new Error('Registration can only be performed in browser environment');
      }
      
      // Use Userfront Core signup method
      const response = await Userfront.signup(signupOptions);

      console.log('[UserfrontAuth] Signup response received:', { 
        hasTokens: !!response?.tokens, 
        hasAccessToken: !!response?.tokens?.accessToken,
        mode: response?.mode,
        responseKeys: Object.keys(response || {}),
        fullResponse: response
      });
      
      if (response.tokens?.accessToken) {
        // Registration successful - manually redirect to main dashboard
        console.log('[UserfrontAuth] Registration successful, redirecting to dashboard');
        router.push('/');
      } else if (response.mode === 'live' && !response.tokens) {
        // User needs to verify email in live mode
        console.log('[UserfrontAuth] Email verification required');
        router.push('/auth/verify-email');
      } else {
        console.error('[UserfrontAuth] Registration failed:', response);
        throw new Error('Registration failed');
      }
    } catch (err: any) {
      console.error('[UserfrontAuth ERROR] Registration failed:', err);
      
      
      // Check for specific error messages
      let errorMessage = err.message || 'Registration failed. Please try again.';
      
      // Handle common Userfront errors
      if (errorMessage.includes('Email exists') || errorMessage.includes('already exists')) {
        errorMessage = 'This email is already registered. Please use a different email or sign in.';
      } else if (errorMessage.includes('Password must')) {
        // Password validation error - log the exact requirements
        console.log('[UserfrontAuth ERROR] Password validation failed:', errorMessage);
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [router]);

  /**
   * Enhanced logout
   */
  const logout = useCallback(async () => {
    try {
      setError(null);
      
      // Use Userfront Core logout method with redirect disabled
      await Userfront.logout({ redirect: false });
      
      // Clear tenant context
      setCurrentTenantId(null);
      
      // Manually redirect to login page
      router.push('/auth/signin');
    } catch (err: any) {
      console.error('Logout error:', err);
      const errorMessage = err.message || 'Logout failed';
      setError(errorMessage);
    }
  }, [router]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Set tenant context for multi-tenant operations
   */
  const setTenantContext = useCallback((tenantId: string) => {
    setCurrentTenantId(tenantId);
    // Note: We should NOT reinitialize Userfront with tenantId
    // The workspace ID should remain constant
    // tenantId is for application-level multi-tenancy, not Userfront workspaces
  }, []);

  /**
   * Get current tenant context
   */
  const getCurrentTenant = useCallback(() => {
    return currentTenantId;
  }, [currentTenantId]);

  // Create the context value
  const contextValue: UserfrontAuthContextValue = {
    user,
    isAuthenticated,
    isLoading: baseIsLoading,
    login,
    register,
    logout,
    error,
    clearError,
    setTenantContext,
    getCurrentTenant,
  };

  return (
    <UserfrontAuthContext.Provider value={contextValue}>
      {children}
    </UserfrontAuthContext.Provider>
  );
}

/**
 * Main Userfront Auth Provider that wraps the application
 * This includes both the base UserfrontProvider and our enhanced context
 */
export function UserfrontAuthProvider({ 
  children,
  loginUrl = '/auth/signin',
  loginRedirect = '/',
  signupRedirect = '/onboarding',
  logoutRedirect = '/auth/signin',
  requireAuth = false,
}: { 
  children: React.ReactNode;
  loginUrl?: string;
  loginRedirect?: string | false;
  signupRedirect?: string | false;
  logoutRedirect?: string | false;
  requireAuth?: boolean;
}) {
  return (
    <BaseUserfrontProvider 
      tenantId={WORKSPACE_ID}
      loginUrl={loginUrl}
      loginRedirect={loginRedirect}
      signupRedirect={signupRedirect}
      logoutRedirect={logoutRedirect}
      requireAuth={requireAuth}
    >
      <InternalAuthProvider>
        {children}
      </InternalAuthProvider>
    </BaseUserfrontProvider>
  );
}

/**
 * Custom hook to use the enhanced Userfront authentication context
 */
export function useUserfrontAuth() {
  const context = useContext(UserfrontAuthContext);
  
  if (!context) {
    throw new Error('useUserfrontAuth must be used within a UserfrontAuthProvider');
  }
  
  return context;
}

/**
 * Export the base useUserfront hook for components that need direct access
 */
export { useUserfront as useUserfrontBase } from '@userfront/react';

/**
 * Export Userfront Core for direct method calls
 */
export { default as UserfrontCore } from '@userfront/core';

/**
 * Export pre-built components from @userfront/react
 */
export { LoginForm, SignupForm, PasswordResetForm, LogoutButton } from '@userfront/react';