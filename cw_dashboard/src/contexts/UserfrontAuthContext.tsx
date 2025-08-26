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
// Import Userfront Core - Note: This is a CommonJS module that exports directly
import * as UserfrontCore from '@userfront/core';
const Userfront = UserfrontCore as any;

// Initialize Userfront Core with workspace ID
const WORKSPACE_ID = process.env.NEXT_PUBLIC_USERFRONT_WORKSPACE_ID || '8nwx667b';

// Track initialization state
let isUserfrontInitialized = false;

// Initialize Userfront Core globally ONLY in browser environment
// This is critical - Userfront requires window object and won't work in SSR
function initializeUserfront() {
  if (!isUserfrontInitialized && typeof window !== 'undefined' && typeof document !== 'undefined') {
    console.log('[UserfrontAuth] Initializing Userfront in browser with workspace:', WORKSPACE_ID);
    try {
      Userfront.init(WORKSPACE_ID);
      isUserfrontInitialized = true;
      console.log('[UserfrontAuth] Userfront initialized successfully');
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
      console.log('[UserfrontAuth] Attempting login for:', credentials.email);
      
      // Ensure we're in browser environment
      if (typeof window === 'undefined') {
        throw new Error('Authentication can only be performed in browser environment');
      }
      
      const response = await Userfront.login(loginOptions);

      console.log('[UserfrontAuth] Login response received:', { 
        hasTokens: !!response?.tokens, 
        hasAccessToken: !!response?.tokens?.accessToken,
        responseKeys: Object.keys(response || {}),
        fullResponse: response
      });
      
      if (response.tokens?.accessToken) {
        // Login successful - manually redirect to main dashboard
        console.log('[UserfrontAuth] Login successful, redirecting to dashboard');
        router.push('/');
      } else {
        console.error('[UserfrontAuth] No access token in response:', response);
        throw new Error('Login failed - no access token received');
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

      // Prepare signup options - Note: tenantId is NOT passed to Userfront.signup()
      // The workspace/tenant is already configured via Userfront.init()
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

      // Use Userfront Core signup method
      console.log('[UserfrontAuth] Attempting registration for:', data.email);
      
      // Ensure we're in browser environment
      if (typeof window === 'undefined') {
        throw new Error('Registration can only be performed in browser environment');
      }
      
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
      console.error('Registration error:', err);
      const errorMessage = err.message || 'Registration failed. Please try again.';
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
      
      // Use Userfront Core logout method
      await Userfront.logout();
      
      // Clear tenant context
      setCurrentTenantId(null);
      
      // Redirect to login page
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