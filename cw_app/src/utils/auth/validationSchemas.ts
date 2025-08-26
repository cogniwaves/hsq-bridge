import { z } from 'zod';
import { TenantRole } from '@prisma/client';

/**
 * Zod validation schemas for authentication inputs
 * Provides comprehensive input validation with security considerations
 */

// Common validation patterns
const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim()
  .max(255, 'Email must be less than 255 characters');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character');

const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

const tenantSlugSchema = z
  .string()
  .min(3, 'Tenant slug must be at least 3 characters')
  .max(50, 'Tenant slug must be less than 50 characters')
  .regex(/^[a-z0-9\-]+$/, 'Tenant slug can only contain lowercase letters, numbers, and hyphens')
  .regex(/^[a-z]/, 'Tenant slug must start with a letter')
  .regex(/[a-z0-9]$/, 'Tenant slug must end with a letter or number');

// User Registration Schema
export const userRegistrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  tenantName: z.string().min(1, 'Tenant name is required').max(100).optional(),
  tenantSlug: tenantSlugSchema.optional(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// User Login Schema
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
  tenantSlug: z.string().optional(), // For multi-tenant login
});

// Password Reset Request Schema
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

// Password Reset Schema
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Change Password Schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

// Email Verification Schema
export const emailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Tenant Creation Schema
export const tenantCreationSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100),
  slug: tenantSlugSchema,
  description: z.string().max(500).optional(),
  domain: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
  country: z.string().length(2, 'Country must be 2-letter ISO code').optional(),
  timezone: z.string().default('UTC'),
  billingEmail: emailSchema.optional(),
  technicalEmail: emailSchema.optional(),
});

// Tenant Update Schema
export const tenantUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  domain: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
  country: z.string().length(2, 'Country must be 2-letter ISO code').optional(),
  timezone: z.string().optional(),
  billingEmail: emailSchema.optional(),
  technicalEmail: emailSchema.optional(),
  logo: z.string().url().optional(),
  settings: z.record(z.any()).optional(),
});

// Tenant Invitation Schema
export const tenantInvitationSchema = z.object({
  email: emailSchema,
  role: z.nativeEnum(TenantRole),
  message: z.string().max(500).optional(),
  sendEmail: z.boolean().default(true),
});

// Accept Invitation Schema
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: passwordSchema.optional(), // Required only for new users
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
});

// User Profile Update Schema
export const userProfileUpdateSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  preferences: z.record(z.any()).optional(),
});

// Session Refresh Schema
export const sessionRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Tenant Switch Schema
export const tenantSwitchSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
});

// Member Role Update Schema
export const memberRoleUpdateSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.nativeEnum(TenantRole),
});

// Resend Invitation Schema
export const resendInvitationSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
});

// Revoke Invitation Schema
export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
});

// Remove Member Schema
export const removeMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// API Key Creation Schema
export const apiKeyCreationSchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.date().optional(),
});

// Two-Factor Authentication Setup Schema
export const twoFactorSetupSchema = z.object({
  password: z.string().min(1, 'Password is required for 2FA setup'),
});

// Two-Factor Authentication Verification Schema
export const twoFactorVerificationSchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d+$/, 'Code must contain only digits'),
});

// Validate request with schema and return typed result
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    
    throw new ValidationError('Validation failed', errors);
  }
  
  return result.data;
}

// Custom validation error class
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Export type definitions from schemas
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TenantCreationInput = z.infer<typeof tenantCreationSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
export type TenantInvitationInput = z.infer<typeof tenantInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
export type SessionRefreshInput = z.infer<typeof sessionRefreshSchema>;
export type TenantSwitchInput = z.infer<typeof tenantSwitchSchema>;
export type MemberRoleUpdateInput = z.infer<typeof memberRoleUpdateSchema>;

// Email validation helper
export function isValidEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

// Password strength validation helper
export function isStrongPassword(password: string): boolean {
  try {
    passwordSchema.parse(password);
    return true;
  } catch {
    return false;
  }
}

// Tenant slug availability check helper (placeholder for actual DB check)
export async function isTenantSlugAvailable(slug: string): Promise<boolean> {
  // This should be implemented with actual database check
  // For now, returning true as placeholder
  return true;
}