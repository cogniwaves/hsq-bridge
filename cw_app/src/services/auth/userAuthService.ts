import { PrismaClient, User, Tenant, TenantMembership, TenantRole } from '@prisma/client';
import { logger } from '../../utils/logger';
import { createError } from '../../utils/errorHandler';
import { 
  hashPassword, 
  verifyPassword, 
  validatePasswordStrength 
} from '../../utils/auth/passwordUtils';
import { 
  generateTokenPair, 
  generatePasswordResetToken as generateJwtResetToken,
  verifyPasswordResetToken 
} from '../../utils/auth/jwtUtils';
import {
  generateEmailVerificationToken,
  generatePasswordResetToken,
  hashToken,
  generateSessionId
} from '../../utils/auth/tokenUtils';
import {
  UserRegistrationInput,
  UserLoginInput,
  PasswordResetRequestInput,
  PasswordResetInput,
  ChangePasswordInput,
  validateRequest,
  userRegistrationSchema,
  userLoginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  changePasswordSchema
} from '../../utils/auth/validationSchemas';

const prisma = new PrismaClient();

// Configuration constants
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const ACCOUNT_LOCKOUT_TIME = parseInt(process.env.ACCOUNT_LOCKOUT_TIME || '15', 10) * 60 * 1000; // Convert to milliseconds
const PASSWORD_RESET_EXPIRES = parseInt(process.env.PASSWORD_RESET_EXPIRES_HOURS || '1', 10) * 60 * 60 * 1000;

export interface AuthResult {
  user: User;
  tenant?: Tenant;
  membership?: TenantMembership;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: Date;
    refreshTokenExpiry: Date;
  };
  sessionId: string;
}

/**
 * User Authentication Service
 * Handles user registration, login, logout, and password management
 */
export class UserAuthService {
  /**
   * Register a new user with optional tenant creation
   */
  async register(input: UserRegistrationInput): Promise<AuthResult> {
    try {
      // Validate input
      const validatedInput = validateRequest(userRegistrationSchema, input);
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedInput.email },
      });

      if (existingUser) {
        throw createError('Email already registered', 409);
      }

      // Validate password strength
      const passwordStrength = validatePasswordStrength(validatedInput.password);
      if (!passwordStrength.isValid) {
        throw createError(`Password requirements not met: ${passwordStrength.feedback.join(', ')}`, 400);
      }

      // Hash password
      const passwordHash = await hashPassword(validatedInput.password);
      
      // Generate email verification token
      const emailVerificationToken = generateEmailVerificationToken('', validatedInput.email);

      // Create user and optionally a tenant in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email: validatedInput.email,
            passwordHash,
            firstName: validatedInput.firstName,
            lastName: validatedInput.lastName,
            emailVerificationToken,
            emailVerified: false,
          },
        });

        let tenant: Tenant | undefined;
        let membership: TenantMembership | undefined;

        // Create tenant if requested
        if (validatedInput.tenantName) {
          // Generate slug if not provided
          const slug = validatedInput.tenantSlug || 
            validatedInput.tenantName.toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');

          // Check if slug is available
          const existingTenant = await tx.tenant.findUnique({
            where: { slug },
          });

          if (existingTenant) {
            throw createError('Tenant slug already exists', 409);
          }

          // Create tenant
          tenant = await tx.tenant.create({
            data: {
              name: validatedInput.tenantName,
              slug,
              createdById: user.id,
              maxUsers: 5, // Default for new tenants
              isTrial: true,
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
            },
          });

          // Create membership as owner
          membership = await tx.tenantMembership.create({
            data: {
              userId: user.id,
              tenantId: tenant.id,
              role: TenantRole.OWNER,
              isPrimary: true,
            },
          });
        }

        // Create session
        const sessionId = generateSessionId();
        const tokens = generateTokenPair(
          user.id,
          user.email,
          tenant?.id,
          tenant?.slug,
          membership?.role,
          sessionId
        );

        // Save session
        await tx.userSession.create({
          data: {
            userId: user.id,
            tenantId: tenant?.id,
            sessionToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.accessTokenExpiry,
            refreshExpiresAt: tokens.refreshTokenExpiry,
          },
        });

        // Update user login info
        await tx.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            loginCount: 1,
          },
        });

        logger.info('User registered successfully', {
          userId: user.id,
          email: user.email,
          tenantId: tenant?.id,
        });

        return { user, tenant, membership, tokens, sessionId };
      });

      // TODO: Send verification email
      // await emailService.sendVerificationEmail(user.email, emailVerificationToken);

      return result;
    } catch (error) {
      logger.error('Registration failed', { error: error.message, email: input.email });
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  async login(input: UserLoginInput, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
    try {
      // Validate input
      const validatedInput = validateRequest(userLoginSchema, input);

      // Find user with memberships
      const user = await prisma.user.findUnique({
        where: { email: validatedInput.email },
        include: {
          tenantMemberships: {
            include: {
              tenant: true,
            },
          },
        },
      });

      if (!user) {
        // Don't reveal if user exists
        await this.simulatePasswordVerification();
        throw createError('Invalid credentials', 401);
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        throw createError(`Account locked. Try again in ${minutesRemaining} minutes`, 423);
      }

      // Check if account is active
      if (!user.isActive) {
        throw createError('Account is disabled', 403);
      }

      // Verify password
      const isValidPassword = await verifyPassword(validatedInput.password, user.passwordHash);

      if (!isValidPassword) {
        await this.handleFailedLogin(user.id);
        throw createError('Invalid credentials', 401);
      }

      // Reset failed login attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Determine which tenant to use
      let selectedTenant: Tenant | undefined;
      let selectedMembership: TenantMembership | undefined;

      if (validatedInput.tenantSlug) {
        // Find specific tenant by slug
        const membership = user.tenantMemberships.find(
          m => m.tenant.slug === validatedInput.tenantSlug && m.tenant.isActive
        );
        
        if (!membership) {
          throw createError('You do not have access to this tenant', 403);
        }
        
        selectedTenant = membership.tenant;
        selectedMembership = membership;
      } else if (user.tenantMemberships.length > 0) {
        // Use primary tenant or first available
        const primaryMembership = user.tenantMemberships.find(m => m.isPrimary && m.tenant.isActive);
        const membership = primaryMembership || user.tenantMemberships.find(m => m.tenant.isActive);
        
        if (membership) {
          selectedTenant = membership.tenant;
          selectedMembership = membership;
        }
      }

      // Create session
      const sessionId = generateSessionId();
      const tokens = generateTokenPair(
        user.id,
        user.email,
        selectedTenant?.id,
        selectedTenant?.slug,
        selectedMembership?.role,
        sessionId,
        undefined,
        user.isSuperAdmin
      );

      // Save session
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tenantId: selectedTenant?.id,
          sessionToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          ipAddress,
          userAgent,
          expiresAt: tokens.accessTokenExpiry,
          refreshExpiresAt: tokens.refreshTokenExpiry,
        },
      });

      // Update user login info
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 },
          lastActivityAt: new Date(),
        },
      });

      // Update membership last access
      if (selectedMembership) {
        await prisma.tenantMembership.update({
          where: { id: selectedMembership.id },
          data: { lastAccessedAt: new Date() },
        });
      }

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        tenantId: selectedTenant?.id,
        ipAddress,
      });

      // Remove sensitive data
      const { passwordHash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword as User,
        tenant: selectedTenant,
        membership: selectedMembership,
        tokens,
        sessionId,
      };
    } catch (error) {
      logger.error('Login failed', { error: error.message, email: input.email });
      throw error;
    }
  }

  /**
   * Logout user by invalidating session
   */
  async logout(sessionToken: string): Promise<void> {
    try {
      const session = await prisma.userSession.findUnique({
        where: { sessionToken },
      });

      if (!session) {
        logger.warn('Logout attempt with invalid session token');
        return; // Silent success for security
      }

      // Revoke session
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'User logout',
        },
      });

      logger.info('User logged out successfully', { userId: session.userId });
    } catch (error) {
      logger.error('Logout failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(input: PasswordResetRequestInput): Promise<void> {
    try {
      // Validate input
      const validatedInput = validateRequest(passwordResetRequestSchema, input);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: validatedInput.email },
      });

      if (!user) {
        // Don't reveal if user exists
        logger.info('Password reset requested for non-existent email', { email: validatedInput.email });
        return; // Silent success for security
      }

      // Generate reset token
      const resetToken = generatePasswordResetToken();
      const hashedToken = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES);

      // Save reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetExpiresAt: expiresAt,
        },
      });

      // TODO: Send password reset email
      // await emailService.sendPasswordResetEmail(user.email, resetToken);

      logger.info('Password reset requested', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Password reset request failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(input: PasswordResetInput): Promise<void> {
    try {
      // Validate input
      const validatedInput = validateRequest(passwordResetSchema, input);

      // Hash the provided token to compare with stored hash
      const hashedToken = hashToken(validatedInput.token);

      // Find user with valid reset token
      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: hashedToken,
          passwordResetExpiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        throw createError('Invalid or expired reset token', 400);
      }

      // Validate new password
      const passwordStrength = validatePasswordStrength(validatedInput.password);
      if (!passwordStrength.isValid) {
        throw createError(`Password requirements not met: ${passwordStrength.feedback.join(', ')}`, 400);
      }

      // Hash new password
      const passwordHash = await hashPassword(validatedInput.password);

      // Update user password and clear reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          lastPasswordChangeAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Revoke all existing sessions for security
      await prisma.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'Password reset',
        },
      });

      logger.info('Password reset successfully', { userId: user.id });
    } catch (error) {
      logger.error('Password reset failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    try {
      // Validate input
      const validatedInput = validateRequest(changePasswordSchema, input);

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw createError('User not found', 404);
      }

      // Verify current password
      const isValidPassword = await verifyPassword(validatedInput.currentPassword, user.passwordHash);
      
      if (!isValidPassword) {
        throw createError('Current password is incorrect', 401);
      }

      // Validate new password
      const passwordStrength = validatePasswordStrength(validatedInput.newPassword);
      if (!passwordStrength.isValid) {
        throw createError(`Password requirements not met: ${passwordStrength.feedback.join(', ')}`, 400);
      }

      // Hash new password
      const passwordHash = await hashPassword(validatedInput.newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          lastPasswordChangeAt: new Date(),
        },
      });

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Password change failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      // Find user with verification token
      const user = await prisma.user.findUnique({
        where: { emailVerificationToken: token },
      });

      if (!user) {
        throw createError('Invalid verification token', 400);
      }

      if (user.emailVerified) {
        throw createError('Email already verified', 400);
      }

      // Verify email
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
        },
      });

      logger.info('Email verified successfully', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Email verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw createError('User not found', 404);
      }

      if (user.emailVerified) {
        throw createError('Email already verified', 400);
      }

      // Generate new verification token
      const emailVerificationToken = generateEmailVerificationToken(user.id, user.email);

      // Update token
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken },
      });

      // TODO: Send verification email
      // await emailService.sendVerificationEmail(user.email, emailVerificationToken);

      logger.info('Verification email resent', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Failed to resend verification email', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const failedAttempts = user.failedLoginAttempts + 1;
    const updateData: any = {
      failedLoginAttempts: failedAttempts,
    };

    // Lock account if max attempts reached
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_TIME);
      logger.warn('Account locked due to failed login attempts', { userId, attempts: failedAttempts });
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  /**
   * Simulate password verification delay to prevent timing attacks
   */
  private async simulatePasswordVerification(): Promise<void> {
    // Simulate the time it takes to verify a password
    const fakeHash = await hashPassword('DummyPassword123!');
    await verifyPassword('WrongPassword456!', fakeHash);
  }
}

// Export singleton instance
export const userAuthService = new UserAuthService();