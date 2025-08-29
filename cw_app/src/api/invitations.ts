import { Router, Response } from 'express';
import { logger } from '../utils/logger';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '../utils/responses';
import { rateLimits } from '../middleware/rateLimiting';
import { 
  jwtAuth, 
  optionalJwtAuth,
  JWTAuthenticatedRequest, 
  requireTenantRole, 
  requireTenant,
  auditLog,
  tenantIsolation
} from '../middleware/jwtAuth';
import { invitationService } from '../services/auth/invitationService';
import { 
  validateRequest,
  tenantInvitationSchema,
  acceptInvitationSchema,
  // resendInvitationSchema,
  // revokeInvitationSchema,
  ValidationError
} from '../utils/auth/validationSchemas';
import { TenantRole, InvitationStatus } from '@prisma/client';

/**
 * Invitation Management API Routes
 * Handles team invitation system, accept/reject invitations, and member management
 */
export const invitationRoutes = Router();

/**
 * POST /api/invitations - Send invitation (requires auth and tenant context)
 */
invitationRoutes.post('/', 
  jwtAuth,
  rateLimits.write, 
  requireTenant, 
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER),
  auditLog('invitation_sent'),
  tenantIsolation,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const validatedData = validateRequest(tenantInvitationSchema, req.body);

      const invitation = await invitationService.createInvitation({
        tenantId: req.tenant!.id,
        email: validatedData.email,
        role: validatedData.role,
        message: validatedData.message,
        sendEmail: validatedData.sendEmail,
        invitedBy: req.auth!.userId,
      });

      logger.info('Invitation sent successfully', {
        invitationId: invitation.id,
        tenantId: req.tenant!.id,
        email: validatedData.email,
        role: validatedData.role,
        invitedBy: req.auth!.userId,
        ip: req.ip,
      });

      res.status(201).json(createSuccessResponse({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          message: invitation.message,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          tenant: {
            id: invitation.tenant.id,
            name: invitation.tenant.name,
            slug: invitation.tenant.slug,
          },
          invitedBy: {
            id: invitation.invitedBy.id,
            email: invitation.invitedBy.email,
            firstName: invitation.invitedBy.firstName,
            lastName: invitation.invitedBy.lastName,
          },
        },
      }, 'Invitation sent successfully'));

    } catch (error) {
      logger.error('Failed to send invitation', {
        tenantId: req.tenant?.id,
        email: req.body?.email,
        invitedBy: req.auth?.userId,
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

      if (error.message.includes('already a member')) {
        res.status(409).json(createErrorResponse(
          'User already a member',
          'This user is already a member of the tenant'
        ));
        return;
      }

      if (error.message.includes('invitation already exists')) {
        res.status(409).json(createErrorResponse(
          'Invitation already exists',
          'An active invitation has already been sent to this email'
        ));
        return;
      }

      if (error.message.includes('invitation limit')) {
        res.status(429).json(createErrorResponse(
          'Invitation limit reached',
          'You have reached the maximum number of pending invitations'
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Invitation failed',
        'Unable to send invitation. Please try again later.'
      ));
    }
  }
);

/**
 * GET /api/invitations - List tenant invitations (sent)
 */
invitationRoutes.get('/', 
  jwtAuth,
  rateLimits.api, 
  requireTenant, 
  tenantIsolation,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const status = req.query.status as InvitationStatus;
      const role = req.query.role as TenantRole;
      const search = req.query.search as string;

      const result = await invitationService.getTenantInvitations(req.tenant!.id, {
        page,
        limit,
        status,
        role,
        search,
      });

      const mappedInvitations = result.invitations.map(invitation => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        message: invitation.message,
        token: undefined, // Never expose tokens in API responses
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        acceptedAt: invitation.acceptedAt,
        rejectedAt: invitation.rejectedAt,
        invitedBy: {
          id: invitation.invitedBy.id,
          email: invitation.invitedBy.email,
          firstName: invitation.invitedBy.firstName,
          lastName: invitation.invitedBy.lastName,
        },
        acceptedBy: invitation.acceptedBy ? {
          id: invitation.acceptedBy.id,
          email: invitation.acceptedBy.email,
          firstName: invitation.acceptedBy.firstName,
          lastName: invitation.acceptedBy.lastName,
        } : null,
      }));

      res.json(createPaginatedResponse(
        mappedInvitations,
        page,
        limit,
        result.total,
        'Invitations retrieved successfully'
      ));

    } catch (error) {
      logger.error('Failed to retrieve tenant invitations', {
        tenantId: req.tenant?.id,
        userId: req.auth?.userId,
        error: error.message,
      });

      res.status(500).json(createErrorResponse(
        'Invitation retrieval failed',
        'Unable to retrieve invitations. Please try again.'
      ));
    }
  }
);

/**
 * GET /api/invitations/received - List user's received invitations
 */
invitationRoutes.get('/received', 
  jwtAuth,
  rateLimits.api, 
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const status = req.query.status as InvitationStatus;

      const invitations = await invitationService.getUserInvitations(req.auth!.email, status);

      const mappedInvitations = invitations.map(invitation => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        tenant: {
          id: invitation.tenant.id,
          name: invitation.tenant.name,
          slug: invitation.tenant.slug,
          logo: invitation.tenant.logo,
          description: invitation.tenant.description,
        },
        invitedBy: {
          id: invitation.invitedBy.id,
          email: invitation.invitedBy.email,
          firstName: invitation.invitedBy.firstName,
          lastName: invitation.invitedBy.lastName,
        },
        canAccept: invitation.status === InvitationStatus.PENDING && 
                  invitation.expiresAt > new Date(),
      }));

      res.json(createSuccessResponse({
        invitations: mappedInvitations,
        pendingCount: mappedInvitations.filter(inv => inv.canAccept).length,
      }, 'Received invitations retrieved successfully'));

    } catch (error) {
      logger.error('Failed to retrieve user invitations', {
        userId: req.auth?.userId,
        email: req.auth?.email,
        error: error.message,
      });

      res.status(500).json(createErrorResponse(
        'Invitation retrieval failed',
        'Unable to retrieve your invitations. Please try again.'
      ));
    }
  }
);

/**
 * POST /api/invitations/:token/accept - Accept invitation
 */
invitationRoutes.post('/:token/accept', 
  optionalJwtAuth, // Optional because new users might not have accounts yet
  rateLimits.auth,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const token = req.params.token;
      const validatedData = validateRequest(acceptInvitationSchema, {
        ...req.body,
        token,
      });

      // If user is not authenticated, they need to provide registration details
      const userId = req.auth?.userId;
      if (!userId && (!validatedData.password || !validatedData.firstName)) {
        res.status(400).json(createErrorResponse(
          'Registration details required',
          'New users must provide password and name to accept invitations',
          {
            requiredFields: ['password', 'firstName', 'lastName'],
          }
        ));
        return;
      }

      const result = await invitationService.acceptInvitation({
        token: validatedData.token,
        userId: userId,
        password: validatedData.password,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info('Invitation accepted successfully', {
        invitationId: result.invitation.id,
        tenantId: result.membership.tenantId,
        userId: result.user.id,
        email: result.user.email,
        isNewUser: !userId,
        ip: req.ip,
      });

      // For new users, provide tokens for immediate authentication
      const responseData: any = {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          isEmailVerified: result.user.isEmailVerified,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
        membership: {
          role: result.membership.role,
          joinedAt: result.membership.createdAt,
        },
        invitation: {
          id: result.invitation.id,
          role: result.invitation.role,
          acceptedAt: result.invitation.acceptedAt,
        },
      };

      // Add tokens for new users or if they're not currently authenticated
      if (result.tokens) {
        responseData.tokens = {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt: result.tokens.expiresAt,
        };
      }

      res.json(createSuccessResponse(
        responseData,
        `Invitation accepted successfully. Welcome to ${result.tenant.name}!`
      ));

    } catch (error) {
      logger.warn('Invitation acceptance failed', {
        token: req.params.token?.substring(0, 10) + '...',
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

      if (error.message.includes('invitation not found') || error.message.includes('expired')) {
        res.status(400).json(createErrorResponse(
          'Invalid invitation',
          'The invitation link is invalid or has expired'
        ));
        return;
      }

      if (error.message.includes('already accepted')) {
        res.status(409).json(createErrorResponse(
          'Invitation already accepted',
          'This invitation has already been accepted'
        ));
        return;
      }

      if (error.message.includes('already a member')) {
        res.status(409).json(createErrorResponse(
          'Already a member',
          'You are already a member of this tenant'
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Invitation acceptance failed',
        'Unable to accept invitation. Please try again later.'
      ));
    }
  }
);

/**
 * POST /api/invitations/:token/reject - Reject invitation
 */
invitationRoutes.post('/:token/reject', 
  optionalJwtAuth,
  rateLimits.api,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const token = req.params.token;

      const result = await invitationService.rejectInvitation(token, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info('Invitation rejected', {
        invitationId: result.id,
        tenantId: result.tenantId,
        email: result.email,
        rejectedBy: req.auth?.userId || 'anonymous',
        ip: req.ip,
      });

      res.json(createSuccessResponse({
        invitation: {
          id: result.id,
          email: result.email,
          role: result.role,
          status: result.status,
          rejectedAt: result.rejectedAt,
          tenant: {
            name: result.tenant.name,
          },
        },
      }, 'Invitation rejected successfully'));

    } catch (error) {
      logger.warn('Invitation rejection failed', {
        token: req.params.token?.substring(0, 10) + '...',
        userId: req.auth?.userId,
        error: error.message,
        ip: req.ip,
      });

      if (error.message.includes('invitation not found') || error.message.includes('expired')) {
        res.status(400).json(createErrorResponse(
          'Invalid invitation',
          'The invitation link is invalid or has expired'
        ));
        return;
      }

      if (error.message.includes('already processed')) {
        res.status(409).json(createErrorResponse(
          'Invitation already processed',
          'This invitation has already been accepted or rejected'
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Invitation rejection failed',
        'Unable to reject invitation. Please try again later.'
      ));
    }
  }
);

/**
 * POST /api/invitations/:id/resend - Resend invitation
 */
invitationRoutes.post('/:id/resend', 
  jwtAuth,
  rateLimits.write, 
  requireTenant, 
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER),
  auditLog('invitation_resent'),
  tenantIsolation,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const invitationId = req.params.id;

      const invitation = await invitationService.resendInvitation(invitationId, {
        tenantId: req.tenant!.id,
        userId: req.auth!.userId,
      });

      logger.info('Invitation resent successfully', {
        invitationId,
        tenantId: req.tenant!.id,
        email: invitation.email,
        resentBy: req.auth!.userId,
        ip: req.ip,
      });

      res.json(createSuccessResponse({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          updatedAt: invitation.updatedAt,
        },
      }, 'Invitation resent successfully'));

    } catch (error) {
      logger.error('Failed to resend invitation', {
        invitationId: req.params.id,
        tenantId: req.tenant?.id,
        userId: req.auth?.userId,
        error: error.message,
        ip: req.ip,
      });

      if (error.message.includes('invitation not found')) {
        res.status(404).json(createErrorResponse(
          'Invitation not found',
          'The specified invitation does not exist or you do not have access to it'
        ));
        return;
      }

      if (error.message.includes('cannot resend')) {
        res.status(400).json(createErrorResponse(
          'Cannot resend invitation',
          'This invitation cannot be resent (may have been accepted, rejected, or expired)'
        ));
        return;
      }

      if (error.message.includes('resend limit')) {
        res.status(429).json(createErrorResponse(
          'Resend limit reached',
          'This invitation has been resent too many times. Please create a new invitation.'
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Invitation resend failed',
        'Unable to resend invitation. Please try again later.'
      ));
    }
  }
);

/**
 * DELETE /api/invitations/:id - Cancel/revoke invitation
 */
invitationRoutes.delete('/:id', 
  jwtAuth,
  rateLimits.write, 
  requireTenant, 
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER),
  auditLog('invitation_revoked'),
  tenantIsolation,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const invitationId = req.params.id;

      const invitation = await invitationService.revokeInvitation(invitationId, {
        tenantId: req.tenant!.id,
        userId: req.auth!.userId,
      });

      logger.info('Invitation revoked successfully', {
        invitationId,
        tenantId: req.tenant!.id,
        email: invitation.email,
        revokedBy: req.auth!.userId,
        ip: req.ip,
      });

      res.json(createSuccessResponse({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          revokedAt: invitation.updatedAt,
        },
      }, 'Invitation revoked successfully'));

    } catch (error) {
      logger.error('Failed to revoke invitation', {
        invitationId: req.params.id,
        tenantId: req.tenant?.id,
        userId: req.auth?.userId,
        error: error.message,
        ip: req.ip,
      });

      if (error.message.includes('invitation not found')) {
        res.status(404).json(createErrorResponse(
          'Invitation not found',
          'The specified invitation does not exist or you do not have access to it'
        ));
        return;
      }

      if (error.message.includes('cannot revoke')) {
        res.status(400).json(createErrorResponse(
          'Cannot revoke invitation',
          'This invitation cannot be revoked (may have been already accepted or rejected)'
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Invitation revocation failed',
        'Unable to revoke invitation. Please try again later.'
      ));
    }
  }
);

/**
 * GET /api/invitations/:token/info - Get invitation info (public endpoint for invitation preview)
 */
invitationRoutes.get('/:token/info', 
  rateLimits.public,
  async (req, res): Promise<void> => {
    try {
      const token = req.params.token;

      const invitation = await invitationService.getInvitationByToken(token);

      if (!invitation || invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) {
        res.status(404).json(createErrorResponse(
          'Invitation not found',
          'The invitation link is invalid, expired, or has already been processed'
        ));
        return;
      }

      // Return minimal public information about the invitation
      res.json(createSuccessResponse({
        tenant: {
          name: invitation.tenant.name,
          logo: invitation.tenant.logo,
          description: invitation.tenant.description,
        },
        role: invitation.role,
        invitedBy: {
          firstName: invitation.invitedBy.firstName,
          lastName: invitation.invitedBy.lastName,
        },
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        message: invitation.message,
      }, 'Invitation information retrieved'));

    } catch (error) {
      logger.warn('Failed to retrieve invitation info', {
        token: req.params.token?.substring(0, 10) + '...',
        error: error.message,
        ip: req.ip,
      });

      res.status(404).json(createErrorResponse(
        'Invitation not found',
        'The invitation link is invalid or has expired'
      ));
    }
  }
);