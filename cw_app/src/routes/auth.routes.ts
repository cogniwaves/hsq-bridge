import { Router } from 'express';
import { AuthenticatedRequest, jwtAuth, flexibleAuth } from '../middleware/auth';
import { 
  requireTenantRole, 
  requireTenant, 
  perUserRateLimit,
  auditLog 
} from '../middleware/jwtAuth';
import { TenantRole } from '@prisma/client';
import {
  userAuthService,
  sessionService,
  invitationService,
  tenantService
} from '../services/auth';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Authentication API Routes
 * Comprehensive JWT-based authentication endpoints
 */

// ============================================================================
// Public Authentication Routes (No Auth Required)
// ============================================================================

/**
 * @route POST /auth/register
 * @desc Register a new user with optional tenant creation
 * @access Public
 */
router.post('/register', 
  perUserRateLimit(5, 15), // 5 attempts per 15 minutes
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await userAuthService.register(req.body);
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        tenant: result.tenant ? {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        } : undefined,
        tokens: result.tokens,
        sessionId: result.sessionId,
      },
      message: 'Registration successful. Please verify your email.',
    });
  })
);

/**
 * @route POST /auth/login
 * @desc Authenticate user and receive tokens
 * @access Public
 */
router.post('/login',
  perUserRateLimit(10, 15), // 10 attempts per 15 minutes
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');
    
    const result = await userAuthService.login(req.body, ipAddress, userAgent);
    
    res.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: result.user.emailVerified,
        },
        tenant: result.tenant ? {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        } : undefined,
        role: result.membership?.role,
        tokens: result.tokens,
        sessionId: result.sessionId,
      },
    });
  })
);

/**
 * @route POST /auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public (with refresh token)
 */
router.post('/refresh',
  perUserRateLimit(20, 5), // 20 refreshes per 5 minutes
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
      return;
    }
    
    const result = await sessionService.refreshSession(refreshToken);
    
    res.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
        },
        tenant: result.tenant ? {
          id: result.tenant.id,
          slug: result.tenant.slug,
        } : undefined,
        tokens: result.tokens,
      },
    });
  })
);

/**
 * @route POST /auth/password-reset/request
 * @desc Request password reset email
 * @access Public
 */
router.post('/password-reset/request',
  perUserRateLimit(3, 60), // 3 requests per hour
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await userAuthService.requestPasswordReset(req.body);
    
    // Always return success for security (don't reveal if email exists)
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
    });
  })
);

/**
 * @route POST /auth/password-reset/confirm
 * @desc Reset password with token
 * @access Public (with reset token)
 */
router.post('/password-reset/confirm',
  perUserRateLimit(5, 60), // 5 attempts per hour
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await userAuthService.resetPassword(req.body);
    
    res.json({
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.',
    });
  })
);

/**
 * @route POST /auth/verify-email
 * @desc Verify email with token
 * @access Public (with verification token)
 */
router.post('/verify-email',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
      return;
    }
    
    await userAuthService.verifyEmail(token);
    
    res.json({
      success: true,
      message: 'Email verified successfully.',
    });
  })
);

// ============================================================================
// Protected Authentication Routes (JWT Required)
// ============================================================================

/**
 * @route POST /auth/logout
 * @desc Logout and invalidate session
 * @access Private
 */
router.post('/logout',
  jwtAuth,
  auditLog('USER_LOGOUT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.split(' ')[1];
    
    if (token) {
      await userAuthService.logout(token);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  })
);

/**
 * @route POST /auth/change-password
 * @desc Change password for authenticated user
 * @access Private
 */
router.post('/change-password',
  jwtAuth,
  auditLog('PASSWORD_CHANGE'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await userAuthService.changePassword(req.auth!.userId, req.body);
    
    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  })
);

/**
 * @route POST /auth/resend-verification
 * @desc Resend email verification
 * @access Private
 */
router.post('/resend-verification',
  jwtAuth,
  perUserRateLimit(3, 60), // 3 requests per hour
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await userAuthService.resendVerificationEmail(req.auth!.userId);
    
    res.json({
      success: true,
      message: 'Verification email sent.',
    });
  })
);

/**
 * @route GET /auth/sessions
 * @desc Get all active sessions for user
 * @access Private
 */
router.get('/sessions',
  jwtAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sessions = await sessionService.getUserSessions(req.auth!.userId);
    
    res.json({
      success: true,
      data: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActivityAt: s.lastActivityAt,
        createdAt: s.createdAt,
      })),
    });
  })
);

/**
 * @route DELETE /auth/sessions/:sessionId
 * @desc Revoke a specific session
 * @access Private
 */
router.delete('/sessions/:sessionId',
  jwtAuth,
  auditLog('SESSION_REVOKE'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await sessionService.revokeSession(req.params.sessionId, 'User requested');
    
    res.json({
      success: true,
      message: 'Session revoked.',
    });
  })
);

/**
 * @route POST /auth/sessions/revoke-all
 * @desc Revoke all sessions except current
 * @access Private
 */
router.post('/sessions/revoke-all',
  jwtAuth,
  auditLog('SESSION_REVOKE_ALL'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await sessionService.revokeAllUserSessions(req.auth!.userId, 'User requested');
    
    res.json({
      success: true,
      message: 'All sessions revoked.',
    });
  })
);

// ============================================================================
// Tenant Management Routes
// ============================================================================

/**
 * @route GET /auth/tenants
 * @desc Get user's tenants
 * @access Private
 */
router.get('/tenants',
  jwtAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const tenants = await tenantService.getUserTenants(req.auth!.userId);
    
    res.json({
      success: true,
      data: tenants.map(m => ({
        tenant: {
          id: m.tenant.id,
          name: m.tenant.name,
          slug: m.tenant.slug,
          logo: m.tenant.logo,
        },
        role: m.role,
        isPrimary: m.isPrimary,
        joinedAt: m.joinedAt,
      })),
    });
  })
);

/**
 * @route POST /auth/tenants
 * @desc Create a new tenant
 * @access Private
 */
router.post('/tenants',
  jwtAuth,
  auditLog('TENANT_CREATE'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await tenantService.createTenant(req.auth!.userId, req.body);
    
    res.status(201).json({
      success: true,
      data: {
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
        role: result.membership.role,
      },
    });
  })
);

/**
 * @route GET /auth/tenants/:tenantId
 * @desc Get tenant details with members
 * @access Private (Tenant Member)
 */
router.get('/tenants/:tenantId',
  jwtAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const tenant = await tenantService.getTenant(req.params.tenantId, req.auth!.userId);
    
    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * @route PATCH /auth/tenants/:tenantId
 * @desc Update tenant details
 * @access Private (Owner/Admin)
 */
router.patch('/tenants/:tenantId',
  jwtAuth,
  auditLog('TENANT_UPDATE'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const tenant = await tenantService.updateTenant(
      req.params.tenantId,
      req.auth!.userId,
      req.body
    );
    
    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * @route POST /auth/tenants/:tenantId/switch
 * @desc Switch to a different tenant
 * @access Private (Tenant Member)
 */
router.post('/tenants/:tenantId/switch',
  jwtAuth,
  auditLog('TENANT_SWITCH'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.split(' ')[1];
    
    const result = await tenantService.switchTenant(
      req.auth!.userId,
      { tenantId: req.params.tenantId },
      token
    );
    
    res.json({
      success: true,
      data: {
        tenant: result.tenant,
        role: result.membership.role,
      },
    });
  })
);

/**
 * @route GET /auth/tenants/:tenantId/stats
 * @desc Get tenant statistics
 * @access Private (Tenant Member)
 */
router.get('/tenants/:tenantId/stats',
  jwtAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await tenantService.getTenantStats(
      req.params.tenantId,
      req.auth!.userId
    );
    
    res.json({
      success: true,
      data: stats,
    });
  })
);

// ============================================================================
// Invitation Management Routes
// ============================================================================

/**
 * @route POST /auth/invitations
 * @desc Send invitation to join tenant
 * @access Private (Owner/Admin)
 */
router.post('/invitations',
  jwtAuth,
  requireTenant,
  requireTenantRole(TenantRole.OWNER, TenantRole.ADMIN),
  auditLog('INVITATION_SEND'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await invitationService.sendInvitation(
      req.tenant!.id,
      req.auth!.userId,
      req.body
    );
    
    res.status(201).json({
      success: true,
      data: {
        invitation: {
          id: result.invitation.id,
          email: result.invitation.email,
          role: result.invitation.role,
          expiresAt: result.invitation.expiresAt,
        },
        invitationUrl: result.invitationUrl,
      },
    });
  })
);

/**
 * @route GET /auth/invitations
 * @desc Get tenant invitations
 * @access Private (Tenant Member)
 */
router.get('/invitations',
  jwtAuth,
  requireTenant,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const invitations = await invitationService.getTenantInvitations(
      req.tenant!.id,
      req.auth!.userId
    );
    
    res.json({
      success: true,
      data: invitations,
    });
  })
);

/**
 * @route POST /auth/invitations/accept
 * @desc Accept an invitation
 * @access Public (with invitation token)
 */
router.post('/invitations/accept',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await invitationService.acceptInvitation(req.body);
    
    res.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
        role: result.membership.role,
      },
      message: 'Invitation accepted successfully.',
    });
  })
);

/**
 * @route POST /auth/invitations/:invitationId/resend
 * @desc Resend an invitation
 * @access Private (Owner/Admin)
 */
router.post('/invitations/:invitationId/resend',
  jwtAuth,
  requireTenant,
  requireTenantRole(TenantRole.OWNER, TenantRole.ADMIN),
  auditLog('INVITATION_RESEND'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await invitationService.resendInvitation(
      req.params.invitationId,
      req.auth!.userId
    );
    
    res.json({
      success: true,
      data: {
        invitationUrl: result.invitationUrl,
      },
      message: 'Invitation resent.',
    });
  })
);

/**
 * @route DELETE /auth/invitations/:invitationId
 * @desc Revoke an invitation
 * @access Private (Owner/Admin)
 */
router.delete('/invitations/:invitationId',
  jwtAuth,
  requireTenant,
  requireTenantRole(TenantRole.OWNER, TenantRole.ADMIN),
  auditLog('INVITATION_REVOKE'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await invitationService.revokeInvitation(
      req.params.invitationId,
      req.auth!.userId
    );
    
    res.json({
      success: true,
      message: 'Invitation revoked.',
    });
  })
);

/**
 * @route DELETE /auth/members/:userId
 * @desc Remove member from tenant
 * @access Private (Owner/Admin or Self)
 */
router.delete('/members/:userId',
  jwtAuth,
  requireTenant,
  auditLog('MEMBER_REMOVE'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await invitationService.removeMember(
      req.tenant!.id,
      req.params.userId,
      req.auth!.userId
    );
    
    res.json({
      success: true,
      message: 'Member removed.',
    });
  })
);

/**
 * @route PATCH /auth/members/:userId/role
 * @desc Update member role
 * @access Private (Owner)
 */
router.patch('/members/:userId/role',
  jwtAuth,
  requireTenant,
  requireTenantRole(TenantRole.OWNER),
  auditLog('MEMBER_ROLE_UPDATE'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const membership = await invitationService.updateMemberRole(
      req.tenant!.id,
      req.params.userId,
      req.body.role,
      req.auth!.userId
    );
    
    res.json({
      success: true,
      data: {
        userId: membership.userId,
        role: membership.role,
      },
    });
  })
);

export default router;