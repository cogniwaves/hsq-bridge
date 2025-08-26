/**
 * Authentication Utilities
 * Core authentication functions and API client
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthTokens, ApiResponse } from '../types/auth';

// Constants
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13000';
const TOKEN_STORAGE_KEY = 'auth_tokens';
const TENANT_STORAGE_KEY = 'current_tenant';

// Create axios instance with interceptors
export const authApi: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies
});

// Token management utilities
export const tokenManager = {
  getTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null;
    
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  setTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    
    // Set authorization header
    authApi.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
  },

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    delete authApi.defaults.headers.common['Authorization'];
  },

  isTokenExpired(tokens: AuthTokens): boolean {
    // Check if token is expired based on expiresIn
    const tokenData = this.parseJwt(tokens.accessToken);
    if (!tokenData || !tokenData.exp) return true;
    
    const expiryTime = tokenData.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const bufferTime = 60000; // 1 minute buffer
    
    return currentTime >= (expiryTime - bufferTime);
  },

  parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }
};

// Tenant management utilities
export const tenantManager = {
  getCurrentTenantId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TENANT_STORAGE_KEY);
  },

  setCurrentTenantId(tenantId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
    
    // Add tenant header to all requests
    authApi.defaults.headers.common['X-Tenant-Id'] = tenantId;
  },

  clearCurrentTenantId(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TENANT_STORAGE_KEY);
    delete authApi.defaults.headers.common['X-Tenant-Id'];
  }
};

// Request interceptor to add auth token and tenant ID
authApi.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const tokens = tokenManager.getTokens();
    if (tokens && !tokenManager.isTokenExpired(tokens)) {
      config.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    // Add tenant ID if available
    const tenantId = tenantManager.getCurrentTenantId();
    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and errors
authApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest: any = error.config;

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokens = tokenManager.getTokens();
        if (tokens?.refreshToken) {
          const response = await axios.post<ApiResponse<AuthTokens>>(
            `${API_URL}/api/auth/refresh`,
            { refreshToken: tokens.refreshToken }
          );

          if (response.data.success && response.data.data) {
            tokenManager.setTokens(response.data.data);
            originalRequest.headers['Authorization'] = `Bearer ${response.data.data.accessToken}`;
            return authApi(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        tokenManager.clearTokens();
        tenantManager.clearCurrentTenantId();
        
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/signin';
        }
      }
    }

    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      console.error('Access denied: Insufficient permissions');
    }

    return Promise.reject(error);
  }
);

// CSRF token management
export const csrfManager = {
  token: null as string | null,

  async fetchToken(): Promise<string> {
    try {
      const response = await authApi.get<ApiResponse<{ csrfToken: string }>>('/auth/csrf');
      if (response.data.success && response.data.data) {
        this.token = response.data.data.csrfToken;
        return this.token;
      }
      throw new Error('Failed to fetch CSRF token');
    } catch (error) {
      console.error('CSRF token fetch error:', error);
      throw error;
    }
  },

  getToken(): string | null {
    return this.token;
  },

  async ensureToken(): Promise<string> {
    if (!this.token) {
      return await this.fetchToken();
    }
    return this.token;
  }
};

// Form validation utilities
export const validators = {
  email: (value: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return 'Email is required';
    if (!emailRegex.test(value)) return 'Invalid email address';
    return null;
  },

  password: (value: string): string | null => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(value)) return 'Password must contain uppercase letter';
    if (!/[a-z]/.test(value)) return 'Password must contain lowercase letter';
    if (!/[0-9]/.test(value)) return 'Password must contain number';
    if (!/[!@#$%^&*]/.test(value)) return 'Password must contain special character';
    return null;
  },

  confirmPassword: (password: string, confirmPassword: string): string | null => {
    if (!confirmPassword) return 'Please confirm your password';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  },

  required: (value: string, fieldName: string = 'Field'): string | null => {
    if (!value || value.trim() === '') return `${fieldName} is required`;
    return null;
  },

  minLength: (value: string, min: number, fieldName: string = 'Field'): string | null => {
    if (value.length < min) return `${fieldName} must be at least ${min} characters`;
    return null;
  },

  maxLength: (value: string, max: number, fieldName: string = 'Field'): string | null => {
    if (value.length > max) return `${fieldName} must be no more than ${max} characters`;
    return null;
  }
};

// Session management utilities
export const sessionManager = {
  startSessionCheck(onExpire: () => void, intervalMs: number = 60000): NodeJS.Timer {
    return setInterval(() => {
      const tokens = tokenManager.getTokens();
      if (!tokens || tokenManager.isTokenExpired(tokens)) {
        onExpire();
      }
    }, intervalMs);
  },

  stopSessionCheck(timerId: NodeJS.Timer): void {
    clearInterval(timerId);
  }
};

// Redirect utilities
export const redirectManager = {
  saveRedirectUrl(url: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('redirect_after_login', url);
  },

  getRedirectUrl(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('redirect_after_login');
  },

  clearRedirectUrl(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('redirect_after_login');
  },

  getDefaultRedirectUrl(): string {
    return '/';
  }
};

// Error handling utilities
export const errorHandler = {
  getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiResponse>;
      
      // Check for API response error
      if (axiosError.response?.data?.error) {
        return axiosError.response.data.error;
      }
      
      if (axiosError.response?.data?.message) {
        return axiosError.response.data.message;
      }
      
      // Handle specific HTTP status codes
      switch (axiosError.response?.status) {
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'Authentication required. Please sign in.';
        case 403:
          return 'Access denied. You do not have permission.';
        case 404:
          return 'Resource not found.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'Server error. Please try again later.';
        default:
          return axiosError.message || 'An unexpected error occurred';
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'An unexpected error occurred';
  },

  getFieldErrors(error: any): Record<string, string[]> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiResponse>;
      if (axiosError.response?.data?.errors) {
        return axiosError.response.data.errors;
      }
    }
    return {};
  }
};