'use client';

/**
 * Authentication Context Provider
 * Manages global authentication state and operations
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Tenant,
  TenantMembership,
  AuthContextValue,
  LoginCredentials,
  RegisterData,
  PasswordResetRequest,
  PasswordResetData,
  TenantRole,
  ApiResponse,
  AuthSession
} from '../types/auth';
import {
  authApi,
  tokenManager,
  tenantManager,
  sessionManager,
  redirectManager,
  errorHandler
} from '../utils/auth';

// Create the authentication context
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Authentication Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session check timer
  const [sessionCheckTimer, setSessionCheckTimer] = useState<NodeJS.Timer | null>(null);

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
    
    // Cleanup on unmount
    return () => {
      if (sessionCheckTimer) {
        sessionManager.stopSessionCheck(sessionCheckTimer);
      }
    };
  }, []);

  // Initialize authentication from stored tokens
  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      const tokens = tokenManager.getTokens();
      
      if (tokens && !tokenManager.isTokenExpired(tokens)) {
        // Fetch current user data
        await fetchCurrentUser();
        
        // Start session monitoring
        startSessionMonitoring();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      tokenManager.clearTokens();
      tenantManager.clearCurrentTenantId();
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      const response = await authApi.get<ApiResponse<AuthSession>>('/auth/me');
      
      if (response.data.success && response.data.data) {
        const session = response.data.data;
        setUser(session.user);
        setTenant(session.tenant);
        setMemberships(session.memberships);
        
        // Set current tenant if available
        if (session.tenant) {
          tenantManager.setCurrentTenantId(session.tenant.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      throw error;
    }
  };

  // Start monitoring session expiration
  const startSessionMonitoring = () => {
    const timer = sessionManager.startSessionCheck(() => {
      handleSessionExpired();
    });
    setSessionCheckTimer(timer);
  };

  // Handle expired session
  const handleSessionExpired = async () => {
    try {
      await refreshSession();
    } catch (error) {
      // Session refresh failed, logout user
      await logout();
      router.push('/auth/signin?reason=session_expired');
    }
  };

  // Login function
  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.post<ApiResponse<AuthSession>>('/auth/login', credentials);
      
      if (response.data.success && response.data.data) {
        const session = response.data.data;
        
        // Store tokens
        if (session.tokens) {
          tokenManager.setTokens(session.tokens);
        }
        
        // Update state
        setUser(session.user);
        setTenant(session.tenant);
        setMemberships(session.memberships);
        
        // Set current tenant
        if (session.tenant) {
          tenantManager.setCurrentTenantId(session.tenant.id);
        } else if (session.memberships.length > 0) {
          // If no tenant selected but user has memberships, redirect to tenant selection
          router.push('/tenants/select');
          return;
        }
        
        // Start session monitoring
        startSessionMonitoring();
        
        // Handle redirect
        const redirectUrl = redirectManager.getRedirectUrl() || redirectManager.getDefaultRedirectUrl();
        redirectManager.clearRedirectUrl();
        router.push(redirectUrl);
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.post<ApiResponse<AuthSession>>('/auth/register', data);
      
      if (response.data.success && response.data.data) {
        const session = response.data.data;
        
        // Store tokens
        if (session.tokens) {
          tokenManager.setTokens(session.tokens);
        }
        
        // Update state
        setUser(session.user);
        setTenant(session.tenant);
        setMemberships(session.memberships);
        
        // Set current tenant if created
        if (session.tenant) {
          tenantManager.setCurrentTenantId(session.tenant.id);
        }
        
        // Start session monitoring
        startSessionMonitoring();
        
        // Redirect to email verification or dashboard
        if (!session.user.emailVerified) {
          router.push('/auth/verify-email');
        } else {
          router.push('/');
        }
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Call logout API
      await authApi.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state and storage
      setUser(null);
      setTenant(null);
      setMemberships([]);
      tokenManager.clearTokens();
      tenantManager.clearCurrentTenantId();
      
      // Stop session monitoring
      if (sessionCheckTimer) {
        sessionManager.stopSessionCheck(sessionCheckTimer);
        setSessionCheckTimer(null);
      }
      
      setIsLoading(false);
      
      // Redirect to signin page
      router.push('/auth/signin');
    }
  }, [router, sessionCheckTimer]);

  // Refresh session
  const refreshSession = async () => {
    try {
      const tokens = tokenManager.getTokens();
      if (!tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.post<ApiResponse<{ tokens: AuthSession['tokens'] }>>(
        '/auth/refresh',
        { refreshToken: tokens.refreshToken }
      );
      
      if (response.data.success && response.data.data?.tokens) {
        tokenManager.setTokens(response.data.data.tokens);
        await fetchCurrentUser();
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      throw error;
    }
  };

  // Switch tenant
  const switchTenant = async (tenantId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user has access to the tenant
      const membership = memberships.find(m => m.tenantId === tenantId);
      if (!membership) {
        throw new Error('Access denied to this tenant');
      }

      const response = await authApi.post<ApiResponse<AuthSession>>(
        '/auth/switch-tenant',
        { tenantId }
      );
      
      if (response.data.success && response.data.data) {
        const session = response.data.data;
        
        // Update state
        setTenant(session.tenant);
        
        // Update tenant ID in storage and headers
        if (session.tenant) {
          tenantManager.setCurrentTenantId(session.tenant.id);
        }
        
        // Refresh the page or navigate to dashboard
        router.push('/');
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (data: Partial<User>) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.patch<ApiResponse<User>>('/auth/profile', data);
      
      if (response.data.success && response.data.data) {
        setUser(response.data.data);
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify email
  const verifyEmail = async (token: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.post<ApiResponse>('/auth/verify-email', { token });
      
      if (response.data.success) {
        // Update user's email verified status
        if (user) {
          setUser({ ...user, emailVerified: true });
        }
        
        // Redirect to dashboard
        router.push('/');
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Request password reset
  const requestPasswordReset = async (data: PasswordResetRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.post<ApiResponse>('/auth/forgot-password', data);
      
      if (response.data.success) {
        // Redirect to confirmation page
        router.push('/auth/forgot-password/sent');
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (data: PasswordResetData) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.post<ApiResponse>('/auth/reset-password', data);
      
      if (response.data.success) {
        // Redirect to signin page
        router.push('/auth/signin?message=password_reset_success');
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Accept invitation
  const acceptInvitation = async (token: string, password?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.post<ApiResponse<AuthSession>>(
        '/invitations/accept',
        { token, password }
      );
      
      if (response.data.success && response.data.data) {
        const session = response.data.data;
        
        // Store tokens
        if (session.tokens) {
          tokenManager.setTokens(session.tokens);
        }
        
        // Update state
        setUser(session.user);
        setTenant(session.tenant);
        setMemberships(session.memberships);
        
        // Set current tenant
        if (session.tenant) {
          tenantManager.setCurrentTenantId(session.tenant.id);
        }
        
        // Start session monitoring
        startSessionMonitoring();
        
        // Redirect to dashboard
        router.push('/');
      }
    } catch (error) {
      const errorMessage = errorHandler.getErrorMessage(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user has specific role in current tenant
  const hasRole = useCallback((role: TenantRole): boolean => {
    if (!tenant || !user) return false;
    
    const membership = memberships.find(m => m.tenantId === tenant.id);
    if (!membership) return false;
    
    // Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
    const roleHierarchy = {
      [TenantRole.OWNER]: 4,
      [TenantRole.ADMIN]: 3,
      [TenantRole.MEMBER]: 2,
      [TenantRole.VIEWER]: 1
    };
    
    return roleHierarchy[membership.role] >= roleHierarchy[role];
  }, [tenant, user, memberships]);

  // Check if user can access specific tenant
  const canAccessTenant = useCallback((tenantId: string): boolean => {
    return memberships.some(m => m.tenantId === tenantId);
  }, [memberships]);

  // Memoized context value
  const contextValue = useMemo<AuthContextValue>(() => ({
    // State
    user,
    tenant,
    memberships,
    isAuthenticated: !!user,
    isLoading,
    error,
    
    // Actions
    login,
    register,
    logout,
    refreshSession,
    switchTenant,
    updateProfile,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    acceptInvitation,
    
    // Utilities
    hasRole,
    canAccessTenant
  }), [user, tenant, memberships, isLoading, error, logout, hasRole, canAccessTenant]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use authentication context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}