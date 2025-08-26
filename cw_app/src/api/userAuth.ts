import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
import { rateLimits } from '../middleware/rateLimiting';
import { jwtAuth, optionalJwtAuth, JWTAuthenticatedRequest, auditLog } from '../middleware/jwtAuth';
import { userAuthService } from '../services/auth/userAuthService';
import { sessionService } from '../services/auth/sessionService';
import { 
  validateRequest,
  userRegistrationSchema,
  userLoginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  changePasswordSchema,
  emailVerificationSchema,
  userProfileUpdateSchema,
  sessionRefreshSchema,
  ValidationError
} from '../utils/auth/validationSchemas';

/**
 * User Authentication API Routes
 * Handles user registration, login, logout, profile management, and password reset
 */
export const userAuthRoutes = Router();

/**
 * POST /api/auth/register - User registration with tenant creation
 */
userAuthRoutes.post('/register', rateLimits.auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(userRegistrationSchema, req.body);

    const result = await userAuthService.registerUser(validatedData, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('User registration successful', {
      userId: result.user.id,
      email: result.user.email,
      tenantId: result.tenant?.id,
      ip: req.ip,
    });

    res.status(201).json(createSuccessResponse({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isEmailVerified: result.user.isEmailVerified,
        isSuperAdmin: result.user.isSuperAdmin,
        createdAt: result.user.createdAt,
      },
      tenant: result.tenant ? {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      } : null,
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresAt: result.tokens.expiresAt,
      },
      emailVerificationRequired: !result.user.isEmailVerified,
    }, 'Registration successful. Please check your email for verification.'));

  } catch (error) {
    logger.error('Registration failed', {
      error: error.message,
      email: req.body?.email,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        error.errors
      ));
      return;
    }

    if (error.message.includes('already exists')) {
      res.status(409).json(createErrorResponse(
        'Email already exists',
        'An account with this email already exists. Please sign in instead.'
      ));
      return;
    }

    if (error.message.includes('slug already exists')) {
      res.status(409).json(createErrorResponse(
        'Tenant slug unavailable',
        'This tenant name is already taken. Please choose a different one.'
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Registration failed',
      'Unable to create account. Please try again later.'
    ));
  }
});

/**
 * POST /api/auth/login - User login with tenant selection
 */
userAuthRoutes.post('/login', rateLimits.auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(userLoginSchema, req.body);

    const result = await userAuthService.loginUser(validatedData, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('User login successful', {
      userId: result.user.id,
      email: result.user.email,
      tenantId: result.tenant?.id,
      sessionId: result.session.id,
      ip: req.ip,
    });

    res.json(createSuccessResponse({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isEmailVerified: result.user.isEmailVerified,
        isSuperAdmin: result.user.isSuperAdmin,
      },
      tenant: result.tenant ? {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        role: result.membership?.role,
      } : null,
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt,
      },
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresAt: result.tokens.expiresAt,
      },
      availableTenants: result.availableTenants.map(t => ({
        id: t.tenant.id,
        name: t.tenant.name,
        slug: t.tenant.slug,
        role: t.role,
      })),
    }, 'Login successful'));

  } catch (error) {
    logger.warn('Login attempt failed', {
      email: req.body?.email,
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        error.errors
      ));
      return;
    }

    if (error.message.includes('invalid credentials')) {
      res.status(401).json(createErrorResponse(
        'Invalid credentials',
        'The email or password you entered is incorrect.'
      ));
      return;
    }

    if (error.message.includes('account disabled')) {
      res.status(403).json(createErrorResponse(
        'Account disabled',
        'Your account has been disabled. Please contact support.'
      ));
      return;
    }

    if (error.message.includes('email not verified')) {
      res.status(403).json(createErrorResponse(
        'Email verification required',
        'Please verify your email address before signing in.',
        { requiresEmailVerification: true }
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Login failed',
      'Unable to sign in. Please try again later.'
    ));
  }
});

/**
 * POST /api/auth/logout - Session logout
 */
userAuthRoutes.post('/logout', jwtAuth, auditLog('user_logout'), async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.auth?.sessionId) {
      await sessionService.invalidateSession(req.auth.sessionId);
    }

    logger.info('User logout successful', {
      userId: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      ip: req.ip,
    });

    res.json(createSuccessResponse(null, 'Logout successful'));

  } catch (error) {
    logger.error('Logout failed', {
      userId: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json(createErrorResponse(
      'Logout failed',
      'Unable to logout properly. Please try again.'
    ));
  }
});

/**
 * POST /api/auth/refresh - Token refresh
 */
userAuthRoutes.post('/refresh', rateLimits.auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(sessionRefreshSchema, req.body);

    const result = await sessionService.refreshTokens(validatedData.refreshToken, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.debug('Token refresh successful', {
      userId: result.user.id,
      sessionId: result.session.id,
      ip: req.ip,
    });

    res.json(createSuccessResponse({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isEmailVerified: result.user.isEmailVerified,
        isSuperAdmin: result.user.isSuperAdmin,
      },
      tenant: result.tenant ? {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        role: result.membership?.role,
      } : null,
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt,
      },
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresAt: result.tokens.expiresAt,
      },
    }, 'Tokens refreshed successfully'));

  } catch (error) {
    logger.warn('Token refresh failed', {
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Invalid refresh token format',
        error.errors
      ));
      return;
    }

    if (error.message.includes('expired') || error.message.includes('invalid')) {
      res.status(401).json(createErrorResponse(
        'Invalid refresh token',
        'Please sign in again.'
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Token refresh failed',
      'Unable to refresh tokens. Please try again.'
    ));
  }
});

/**
 * GET /api/auth/me - Current user profile
 */
userAuthRoutes.get('/me', jwtAuth, async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.json(createSuccessResponse({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        avatarUrl: req.user!.avatarUrl,
        isEmailVerified: req.user!.isEmailVerified,
        isSuperAdmin: req.user!.isSuperAdmin,
        preferences: req.user!.preferences,
        createdAt: req.user!.createdAt,
        lastLoginAt: req.user!.lastLoginAt,
      },
      currentTenant: req.tenant ? {
        id: req.tenant.id,
        name: req.tenant.name,
        slug: req.tenant.slug,
        role: req.membership?.role,
        isActive: req.tenant.isActive,
      } : null,
      session: {
        id: req.auth!.sessionId,
        createdAt: new Date().toISOString(), // This would come from session data
      },
    }, 'User profile retrieved successfully'));

  } catch (error) {
    logger.error('Failed to retrieve user profile', {
      userId: req.auth?.userId,
      error: error.message,
    });

    res.status(500).json(createErrorResponse(
      'Profile retrieval failed',
      'Unable to retrieve your profile. Please try again.'
    ));
  }
});

/**
 * PUT /api/auth/profile - Update user profile
 */
userAuthRoutes.put('/profile', jwtAuth, auditLog('profile_update'), async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(userProfileUpdateSchema, req.body);

    const updatedUser = await userAuthService.updateUserProfile(req.auth!.userId, validatedData);

    logger.info('User profile updated', {
      userId: req.auth!.userId,
      changes: Object.keys(validatedData),
      ip: req.ip,
    });

    res.json(createSuccessResponse({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatarUrl: updatedUser.avatarUrl,
        preferences: updatedUser.preferences,
        updatedAt: updatedUser.updatedAt,
      },
    }, 'Profile updated successfully'));

  } catch (error) {
    logger.error('Profile update failed', {
      userId: req.auth?.userId,
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        error.errors
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Profile update failed',
      'Unable to update your profile. Please try again.'
    ));
  }
});

/**
 * POST /api/auth/verify-email - Email verification
 */
userAuthRoutes.post('/verify-email', optionalJwtAuth, async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(emailVerificationSchema, req.body);

    await userAuthService.verifyEmail(validatedData.token);

    logger.info('Email verification successful', {
      token: validatedData.token.substring(0, 10) + '...',
      ip: req.ip,
    });

    res.json(createSuccessResponse(null, 'Email verified successfully'));

  } catch (error) {
    logger.warn('Email verification failed', {
      token: req.body?.token?.substring(0, 10) + '...',
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Invalid verification token format',
        error.errors
      ));
      return;
    }

    if (error.message.includes('expired') || error.message.includes('invalid')) {
      res.status(400).json(createErrorResponse(
        'Invalid verification token',
        'The verification link has expired or is invalid. Please request a new one.'
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Email verification failed',
      'Unable to verify your email. Please try again.'
    ));
  }
});

/**
 * POST /api/auth/forgot-password - Password reset request
 */
userAuthRoutes.post('/forgot-password', rateLimits.auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(passwordResetRequestSchema, req.body);

    await userAuthService.requestPasswordReset(validatedData.email, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Password reset requested', {
      email: validatedData.email,
      ip: req.ip,
    });

    // Always return success to prevent email enumeration
    res.json(createSuccessResponse(null, 
      'If an account with this email exists, you will receive a password reset link.'
    ));

  } catch (error) {
    logger.error('Password reset request failed', {
      email: req.body?.email,
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Please provide a valid email address',
        error.errors
      ));
      return;
    }

    // Always return success to prevent email enumeration
    res.json(createSuccessResponse(null, 
      'If an account with this email exists, you will receive a password reset link.'
    ));
  }
});

/**
 * POST /api/auth/reset-password - Password reset completion
 */
userAuthRoutes.post('/reset-password', rateLimits.auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(passwordResetSchema, req.body);

    await userAuthService.resetPassword(validatedData.token, validatedData.password, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Password reset successful', {
      token: validatedData.token.substring(0, 10) + '...',
      ip: req.ip,
    });

    res.json(createSuccessResponse(null, 'Password reset successful. You can now sign in with your new password.'));

  } catch (error) {
    logger.warn('Password reset failed', {
      token: req.body?.token?.substring(0, 10) + '...',
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        error.errors
      ));
      return;
    }

    if (error.message.includes('expired') || error.message.includes('invalid')) {
      res.status(400).json(createErrorResponse(
        'Invalid reset token',
        'The password reset link has expired or is invalid. Please request a new one.'
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Password reset failed',
      'Unable to reset your password. Please try again.'
    ));
  }
});

/**
 * POST /api/auth/change-password - Change password (authenticated)
 */
userAuthRoutes.post('/change-password', jwtAuth, auditLog('password_change'), async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(changePasswordSchema, req.body);

    await userAuthService.changePassword(
      req.auth!.userId, 
      validatedData.currentPassword,
      validatedData.newPassword
    );

    logger.info('Password change successful', {
      userId: req.auth!.userId,
      ip: req.ip,
    });

    res.json(createSuccessResponse(null, 'Password changed successfully'));

  } catch (error) {
    logger.warn('Password change failed', {
      userId: req.auth?.userId,
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        error.errors
      ));
      return;
    }

    if (error.message.includes('current password')) {
      res.status(400).json(createErrorResponse(
        'Current password incorrect',
        'The current password you provided is incorrect.'
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Password change failed',
      'Unable to change your password. Please try again.'
    ));
  }
});

/**
 * POST /api/auth/resend-verification - Resend email verification
 */
userAuthRoutes.post('/resend-verification', rateLimits.auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json(createErrorResponse(
        'Email required',
        'Please provide an email address'
      ));
      return;
    }

    await userAuthService.resendEmailVerification(email);

    logger.info('Email verification resent', {
      email,
      ip: req.ip,
    });

    res.json(createSuccessResponse(null, 
      'If an account with this email exists and is not verified, a new verification email has been sent.'
    ));

  } catch (error) {
    logger.error('Resend verification failed', {
      email: req.body?.email,
      error: error.message,
      ip: req.ip,
    });

    // Always return success to prevent email enumeration
    res.json(createSuccessResponse(null, 
      'If an account with this email exists and is not verified, a new verification email has been sent.'
    ));
  }
});