/**
 * Configuration Components Utility Functions
 * Shared utilities for configuration management, validation, and API integration
 */

import { Platform, HealthStatus, APIKeyValidation, ValidationError, ConnectionTestResult } from './types';

// ============================================================================
// Platform Utilities
// ============================================================================

export const platformInfo = {
  HUBSPOT: {
    name: 'HubSpot',
    color: '#ff7a00',
    icon: '🔶',
    description: 'Customer relationship management and marketing automation',
    apiKeyPattern: /^pat-na\d+-[a-zA-Z0-9-]{36,}$/,
    apiKeyPrefix: 'pat-na',
    docs: 'https://developers.hubspot.com/docs/api/private-apps',
  },
  STRIPE: {
    name: 'Stripe',
    color: '#635bff',
    icon: '💳',
    description: 'Online payment processing and financial services',
    apiKeyPattern: /^(sk_test_|sk_live_)[a-zA-Z0-9]{24,}$/,
    apiKeyPrefix: 'sk_',
    docs: 'https://stripe.com/docs/keys',
  },
  QUICKBOOKS: {
    name: 'QuickBooks',
    color: '#0077c5',
    icon: '📊',
    description: 'Accounting and financial management software',
    apiKeyPattern: /^[A-Za-z0-9]{20,}$/,
    apiKeyPrefix: '',
    docs: 'https://developer.intuit.com/app/developer/qbo/docs',
  },
} as const;

export const getPlatformInfo = (platform: Platform) => {
  return platformInfo[platform];
};

export const getPlatformColor = (platform: Platform) => {
  return platformInfo[platform].color;
};

export const getPlatformName = (platform: Platform) => {
  return platformInfo[platform].name;
};

// ============================================================================
// Health Status Utilities
// ============================================================================

export const healthStatusInfo = {
  HEALTHY: {
    label: 'Healthy',
    color: '#10b981',
    bgColor: '#ecfdf5',
    icon: '✓',
    description: 'Connection is working properly',
  },
  DEGRADED: {
    label: 'Degraded',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    icon: '⚠',
    description: 'Connection has minor issues',
  },
  UNHEALTHY: {
    label: 'Unhealthy',
    color: '#ef4444',
    bgColor: '#fef2f2',
    icon: '✗',
    description: 'Connection is not working',
  },
  UNKNOWN: {
    label: 'Unknown',
    color: '#6b7280',
    bgColor: '#f9fafb',
    icon: '?',
    description: 'Connection status not tested',
  },
} as const;

export const getHealthStatusInfo = (status: HealthStatus) => {
  return healthStatusInfo[status];
};

export const getHealthStatusColor = (status: HealthStatus) => {
  return healthStatusInfo[status].color;
};

// ============================================================================
// API Key Validation
// ============================================================================

export const validateAPIKey = (platform: Platform, apiKey: string): APIKeyValidation => {
  const info = getPlatformInfo(platform);
  const isValid = info.apiKeyPattern.test(apiKey);
  
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (!apiKey) {
    errors.push('API key is required');
  } else if (!isValid) {
    errors.push(`Invalid ${info.name} API key format`);
    
    if (info.apiKeyPrefix && !apiKey.startsWith(info.apiKeyPrefix)) {
      errors.push(`API key should start with "${info.apiKeyPrefix}"`);
    }
  } else {
    // Determine strength based on key characteristics
    if (apiKey.length >= 40) {
      strength = 'strong';
    } else if (apiKey.length >= 30) {
      strength = 'medium';
    }
  }

  return {
    isValid: errors.length === 0,
    strength,
    errors,
    format: {
      prefix: info.apiKeyPrefix,
      length: 0, // Will be determined based on actual format
      pattern: info.apiKeyPattern,
    },
  };
};

export const maskAPIKey = (apiKey: string, visibleChars: number = 4): string => {
  if (!apiKey || apiKey.length <= visibleChars) return apiKey;
  
  const start = Math.min(4, visibleChars);
  const end = Math.min(visibleChars, apiKey.length - start);
  
  return `${apiKey.substring(0, start)}${'•'.repeat(apiKey.length - start - end)}${apiKey.substring(apiKey.length - end)}`;
};

// ============================================================================
// Form Validation Utilities
// ============================================================================

export const validateFormField = (
  name: string,
  value: any,
  rules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    email?: boolean;
    url?: boolean;
    custom?: (value: any) => string | null;
  }
): ValidationError | null => {
  if (!rules) return null;

  // Required validation
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return {
      field: name,
      message: `${name} is required`,
      code: 'REQUIRED',
    };
  }

  // Skip other validations if field is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  // String-specific validations
  if (typeof value === 'string') {
    // Length validations
    if (rules.minLength && value.length < rules.minLength) {
      return {
        field: name,
        message: `${name} must be at least ${rules.minLength} characters`,
        code: 'MIN_LENGTH',
      };
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return {
        field: name,
        message: `${name} must be no more than ${rules.maxLength} characters`,
        code: 'MAX_LENGTH',
      };
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      return {
        field: name,
        message: `${name} format is invalid`,
        code: 'PATTERN',
      };
    }

    // Email validation
    if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return {
        field: name,
        message: `${name} must be a valid email address`,
        code: 'EMAIL',
      };
    }

    // URL validation
    if (rules.url) {
      try {
        new URL(value);
      } catch {
        return {
          field: name,
          message: `${name} must be a valid URL`,
          code: 'URL',
        };
      }
    }
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return {
        field: name,
        message: customError,
        code: 'CUSTOM',
      };
    }
  }

  return null;
};

export const validateForm = (
  data: Record<string, any>,
  fieldRules: Record<string, any>
): ValidationError[] => {
  const errors: ValidationError[] = [];

  for (const [fieldName, rules] of Object.entries(fieldRules)) {
    const error = validateFormField(fieldName, data[fieldName], rules);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
};

// ============================================================================
// API Integration Utilities
// ============================================================================

// Function to get authentication headers
const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Get access token from Userfront in browser environment
  if (typeof window !== 'undefined') {
    let accessToken: string | null = null;
    
    try {
      // Try multiple approaches to get the access token
      // 1. Direct from Userfront.tokens (most reliable)
      if ((window as any).Userfront?.tokens?.accessToken) {
        accessToken = (window as any).Userfront.tokens.accessToken;
        console.log('[API Client] Using Userfront access token');
      }
      // 2. From localStorage (fallback)
      else if (localStorage.getItem('userfront:accessToken')) {
        accessToken = localStorage.getItem('userfront:accessToken');
        console.log('[API Client] Using localStorage access token');
      }
      // 3. From Userfront.user (another approach)
      else if ((window as any).Userfront?.user?.tokens?.accessToken) {
        accessToken = (window as any).Userfront.user.tokens.accessToken;
        console.log('[API Client] Using Userfront user token');
      }
      // 4. Development fallback - use development token
      else {
        accessToken = 'dev-token-authenticated-user';
        console.log('[API Client] Using development token (no Userfront token found)');
      }
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    } catch (error) {
      console.warn('[API Client] Failed to retrieve Userfront access token:', error);
      // Fallback to development token
      headers['Authorization'] = `Bearer dev-token-authenticated-user`;
    }
  }
  
  return headers;
};

export const createAPIClient = (baseURL: string) => {
  const client = {
    async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(),
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },

    async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          ...options?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },

    async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          ...options?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },

    async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
  };

  return client;
};

// Configuration API client - use full API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13000';
export const configAPI = createAPIClient(`${API_BASE_URL}/api/config`);

// ============================================================================
// Configuration Testing Utilities
// ============================================================================

export const testPlatformConnection = async (
  platform: Platform,
  config: Record<string, any>
): Promise<ConnectionTestResult> => {
  try {
    const endpoint = platform.toLowerCase();
    const response = await configAPI.post(`/test-${endpoint}`, config);
    
    return {
      success: true,
      message: response.message || 'Connection successful',
      details: response.details,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
      details: {
        apiReachable: false,
        authValid: false,
        errorCount: 1,
      },
    };
  }
};

export const testAllConnections = async (): Promise<Record<Platform, ConnectionTestResult>> => {
  try {
    const response = await configAPI.get('/test-connections');
    return response.results;
  } catch (error) {
    // Return failed results for all platforms
    const platforms: Platform[] = ['HUBSPOT', 'STRIPE', 'QUICKBOOKS'];
    return platforms.reduce((acc, platform) => {
      acc[platform] = {
        success: false,
        message: 'Connection test failed',
      };
      return acc;
    }, {} as Record<Platform, ConnectionTestResult>);
  }
};

// ============================================================================
// Format Utilities
// ============================================================================

export const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'Never';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Invalid date';
  
  return d.toLocaleDateString() + ' at ' + d.toLocaleTimeString();
};

export const formatRelativeTime = (date: Date | string | undefined): string => {
  if (!date) return 'Never';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  
  return d.toLocaleDateString();
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================================================
// Error Handling Utilities
// ============================================================================

export const parseAPIError = (error: any): string => {
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (error?.response?.data?.message) return error.response.data.message;
  
  if (error?.message) return error.message;
  
  return 'An unexpected error occurred';
};

export const createErrorToast = (error: any, fallbackMessage = 'Operation failed') => {
  return {
    type: 'error' as const,
    title: 'Error',
    message: parseAPIError(error) || fallbackMessage,
    duration: 5000,
  };
};

export const createSuccessToast = (message: string, title = 'Success') => {
  return {
    type: 'success' as const,
    title,
    message,
    duration: 3000,
  };
};

// ============================================================================
// Debounce Utility
// ============================================================================

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// ============================================================================
// Local Storage Utilities
// ============================================================================

export const saveToLocalStorage = (key: string, data: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

export const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

export const removeFromLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove from localStorage:', error);
  }
};