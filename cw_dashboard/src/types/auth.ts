/**
 * Authentication Type Definitions
 * Comprehensive types for multi-tenant authentication system
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  emailVerified: boolean;
  profileImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logoUrl?: string | null;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMembership {
  id: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
  tenant: Tenant;
  joinedAt: string;
  updatedAt: string;
}

export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthSession {
  user: User;
  tenant: Tenant | null;
  memberships: TenantMembership[];
  tokens?: AuthTokens;
}

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName?: string;
  acceptedTerms: boolean;
}

export interface InvitationData {
  id: string;
  email: string;
  role: TenantRole;
  tenant: Tenant;
  invitedBy: User;
  token: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

export interface PasswordResetRequest {
  email: string;
  tenantId?: string;
}

export interface PasswordResetData {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  message?: string;
}

export interface AuthContextValue {
  // State
  user: User | null;
  tenant: Tenant | null;
  memberships: TenantMembership[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  requestPasswordReset: (data: PasswordResetRequest) => Promise<void>;
  resetPassword: (data: PasswordResetData) => Promise<void>;
  acceptInvitation: (token: string, password?: string) => Promise<void>;
  
  // Utilities
  hasRole: (role: TenantRole) => boolean;
  canAccessTenant: (tenantId: string) => boolean;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: TenantRole;
  requireTenant?: boolean;
  fallbackUrl?: string;
}