import { 
  PrismaClient, 
  TenantInvitation, 
  TenantMembership, 
  User, 
  Tenant,
  TenantRole,
  InvitationStatus 
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { createError } from '../../utils/errorHandler';
import { generateInvitationToken } from '../../utils/auth/tokenUtils';
import { hashPassword } from '../../utils/auth/passwordUtils';
import {
  TenantInvitationInput,
  AcceptInvitationInput,
  validateRequest,
  tenantInvitationSchema,
  acceptInvitationSchema,
} from '../../utils/auth/validationSchemas';

const prisma = new PrismaClient();

// Configuration constants
const INVITATION_EXPIRES_DAYS = parseInt(process.env.INVITATION_EXPIRES_DAYS || '7', 10);

export interface InvitationResult {
  invitation: TenantInvitation;
  invitationUrl?: string;
}

export interface AcceptResult {
  user: User;
  tenant: Tenant;
  membership: TenantMembership;
}

/**
 * Invitation Management Service
 * Handles sending invites, accepting/rejecting, and managing team members
 */
export class InvitationService {
  /**
   * Create invitation (wrapper for sendInvitation)
   */
  async createInvitation(params: {
    tenantId: string;
    email: string;
    role: TenantRole;
    message?: string;
    sendEmail?: boolean;
    invitedBy: string;
  }): Promise<TenantInvitation & { tenant: Tenant; invitedBy: User }> {
    const result = await this.sendInvitation(params.tenantId, params.invitedBy, {
      email: params.email,
      role: params.role,
      message: params.message,
      sendEmail: params.sendEmail,
    });
    return result.invitation;
  }

  /**
   * Send invitation to join a tenant
   */
  async sendInvitation(
    tenantId: string,
    invitedById: string,
    input: TenantInvitationInput
  ): Promise<InvitationResult> {
    try {
      // Validate input
      const validatedInput = validateRequest(tenantInvitationSchema, input);

      // Check if inviter has permission
      const inviterMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: invitedById,
            tenantId,
          },
        },
      });

      if (!inviterMembership) {
        throw createError('You are not a member of this tenant', 403);
      }

      // Only OWNER and ADMIN can send invitations
      if (inviterMembership.role !== TenantRole.OWNER && inviterMembership.role !== TenantRole.ADMIN) {
        throw createError('You do not have permission to send invitations', 403);
      }

      // Check tenant exists and is active
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      if (!tenant) {
        throw createError('Tenant not found', 404);
      }

      if (!tenant.isActive) {
        throw createError('Tenant is not active', 403);
      }

      // Check if tenant has reached max users limit
      if (tenant._count.members >= tenant.maxUsers) {
        throw createError(`Tenant has reached maximum users limit (${tenant.maxUsers})`, 403);
      }

      // Check if user is already a member
      const existingMember = await prisma.user.findUnique({
        where: { email: validatedInput.email },
        include: {
          tenantMemberships: {
            where: { tenantId },
          },
        },
      });

      if (existingMember && existingMember.tenantMemberships.length > 0) {
        throw createError('User is already a member of this tenant', 409);
      }

      // Check for existing pending invitation
      const existingInvitation = await prisma.tenantInvitation.findFirst({
        where: {
          tenantId,
          email: validatedInput.email,
          status: InvitationStatus.PENDING,
        },
      });

      if (existingInvitation) {
        throw createError('An invitation has already been sent to this email', 409);
      }

      // Generate invitation token
      const invitationToken = generateInvitationToken({
        tenantId,
        email: validatedInput.email,
        role: validatedInput.role,
        invitedBy: invitedById,
      });

      // Create invitation
      const invitation = await prisma.tenantInvitation.create({
        data: {
          tenantId,
          email: validatedInput.email,
          role: validatedInput.role,
          invitationToken,
          message: validatedInput.message,
          invitedById,
          expiresAt: new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
        },
        include: {
          tenant: true,
          invitedBy: true,
        },
      });

      // Generate invitation URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const invitationUrl = `${baseUrl}/accept-invitation?token=${invitationToken}`;

      // TODO: Send invitation email if requested
      if (validatedInput.sendEmail !== false) {
        // await emailService.sendInvitationEmail(
        //   invitation.email,
        //   invitation.tenant.name,
        //   invitation.invitedBy.firstName + ' ' + invitation.invitedBy.lastName,
        //   invitationUrl,
        //   invitation.message
        // );
      }

      logger.info('Invitation sent', {
        tenantId,
        email: invitation.email,
        role: invitation.role,
        invitedById,
      });

      return { invitation, invitationUrl };
    } catch (error) {
      logger.error('Failed to send invitation', { 
        error: error.message,
        tenantId,
        email: input.email,
      });
      throw error;
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(input: AcceptInvitationInput): Promise<AcceptResult> {
    try {
      // Validate input
      const validatedInput = validateRequest(acceptInvitationSchema, input);

      // Find invitation
      const invitation = await prisma.tenantInvitation.findUnique({
        where: { invitationToken: validatedInput.token },
        include: {
          tenant: true,
        },
      });

      if (!invitation) {
        throw createError('Invalid invitation token', 400);
      }

      // Check invitation status
      if (invitation.status !== InvitationStatus.PENDING) {
        throw createError(`Invitation has already been ${invitation.status.toLowerCase()}`, 400);
      }

      // Check expiration
      if (invitation.expiresAt < new Date()) {
        // Mark as expired
        await prisma.tenantInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw createError('Invitation has expired', 400);
      }

      // Check if tenant is still active
      if (!invitation.tenant.isActive) {
        throw createError('Tenant is no longer active', 403);
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        let user: User;

        // Check if user exists
        const existingUser = await tx.user.findUnique({
          where: { email: invitation.email },
        });

        if (existingUser) {
          // Existing user - just add to tenant
          user = existingUser;
        } else {
          // New user - create account
          if (!validatedInput.password) {
            throw createError('Password is required for new users', 400);
          }

          const passwordHash = await hashPassword(validatedInput.password);

          user = await tx.user.create({
            data: {
              email: invitation.email,
              passwordHash,
              firstName: validatedInput.firstName,
              lastName: validatedInput.lastName,
              emailVerified: true, // Auto-verify since they came from invitation
              emailVerifiedAt: new Date(),
            },
          });
        }

        // Check if already a member (edge case)
        const existingMembership = await tx.tenantMembership.findUnique({
          where: {
            userId_tenantId: {
              userId: user.id,
              tenantId: invitation.tenantId,
            },
          },
        });

        if (existingMembership) {
          throw createError('You are already a member of this tenant', 409);
        }

        // Create membership
        const membership = await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: invitation.tenantId,
            role: invitation.role,
            invitedById: invitation.invitedById,
            invitationId: invitation.id,
            isPrimary: !existingUser, // Make primary if new user
          },
        });

        // Update invitation status
        await tx.tenantInvitation.update({
          where: { id: invitation.id },
          data: {
            status: InvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
        });

        logger.info('Invitation accepted', {
          userId: user.id,
          tenantId: invitation.tenantId,
          invitationId: invitation.id,
        });

        return { user, tenant: invitation.tenant, membership };
      });

      return result;
    } catch (error) {
      logger.error('Failed to accept invitation', {
        error: error.message,
        token: input.token,
      });
      throw error;
    }
  }

  /**
   * Reject an invitation
   */
  async rejectInvitation(
    token: string, 
    metadata?: { ip?: string; userAgent?: string }
  ): Promise<TenantInvitation & { tenant: Tenant }> {
    try {
      const invitation = await prisma.tenantInvitation.findUnique({
        where: { invitationToken: token },
        include: {
          tenant: true,
        },
      });

      if (!invitation) {
        throw createError('Invalid invitation token', 400);
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw createError(`Invitation has already been ${invitation.status.toLowerCase()}`, 400);
      }

      const updatedInvitation = await prisma.tenantInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.REJECTED,
          rejectedAt: new Date(),
        },
        include: {
          tenant: true,
        },
      });

      logger.info('Invitation rejected', { 
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        email: invitation.email,
        metadata,
      });

      return updatedInvitation;
    } catch (error) {
      logger.error('Failed to reject invitation', { 
        error: error.message, 
        token: token?.substring(0, 10) + '...', // Don't log full token
        metadata,
      });
      throw error;
    }
  }

  /**
   * Resend an invitation
   */
  async resendInvitation(
    invitationId: string, 
    options: { tenantId: string; userId: string }
  ): Promise<TenantInvitation> {
    try {
      const { tenantId, userId: requesterId } = options;

      const invitation = await prisma.tenantInvitation.findUnique({
        where: { id: invitationId },
        include: {
          tenant: true,
        },
      });

      if (!invitation) {
        throw createError('Invitation not found', 404);
      }

      // Verify invitation belongs to the specified tenant
      if (invitation.tenantId !== tenantId) {
        throw createError('Invitation not found', 404);
      }

      // Check permission
      const requesterMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: requesterId,
            tenantId: invitation.tenantId,
          },
        },
      });

      if (!requesterMembership) {
        throw createError('You are not a member of this tenant', 403);
      }

      if (
        requesterMembership.role !== TenantRole.OWNER &&
        requesterMembership.role !== TenantRole.ADMIN
      ) {
        throw createError('You do not have permission to resend invitations', 403);
      }

      // Only resend pending invitations
      if (invitation.status !== InvitationStatus.PENDING) {
        throw createError('Can only resend pending invitations', 400);
      }

      // Generate new token and extend expiration
      const newToken = generateInvitationToken({
        tenantId: invitation.tenantId,
        email: invitation.email,
        role: invitation.role,
        invitedBy: requesterId,
      });

      const updatedInvitation = await prisma.tenantInvitation.update({
        where: { id: invitationId },
        data: {
          invitationToken: newToken,
          expiresAt: new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      });

      // TODO: Send invitation email
      // const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      // const invitationUrl = `${baseUrl}/accept-invitation?token=${newToken}`;
      // await emailService.sendInvitationEmail(...)

      logger.info('Invitation resent', { 
        invitationId,
        tenantId,
        requesterId,
      });

      return updatedInvitation;
    } catch (error) {
      logger.error('Failed to resend invitation', {
        error: error.message,
        invitationId,
        options,
      });
      throw error;
    }
  }

  /**
   * Revoke a pending invitation
   */
  async revokeInvitation(
    invitationId: string, 
    options: { tenantId: string; userId: string }
  ): Promise<TenantInvitation> {
    try {
      const { tenantId, userId: requesterId } = options;

      const invitation = await prisma.tenantInvitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw createError('Invitation not found', 404);
      }

      // Verify invitation belongs to the specified tenant
      if (invitation.tenantId !== tenantId) {
        throw createError('Invitation not found', 404);
      }

      // Check permission
      const requesterMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: requesterId,
            tenantId: invitation.tenantId,
          },
        },
      });

      if (!requesterMembership) {
        throw createError('You are not a member of this tenant', 403);
      }

      if (
        requesterMembership.role !== TenantRole.OWNER &&
        requesterMembership.role !== TenantRole.ADMIN
      ) {
        throw createError('You do not have permission to revoke invitations', 403);
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw createError('Can only revoke pending invitations', 400);
      }

      // Update status instead of deleting (better audit trail)
      const revokedInvitation = await prisma.tenantInvitation.update({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.EXPIRED, // Using EXPIRED as revoked status
          updatedAt: new Date(),
        },
      });

      logger.info('Invitation revoked', { 
        invitationId,
        tenantId,
        requesterId,
      });

      return revokedInvitation;
    } catch (error) {
      logger.error('Failed to revoke invitation', {
        error: error.message,
        invitationId,
        options,
      });
      throw error;
    }
  }

  /**
   * Get pending invitations for a tenant with pagination and filtering
   */
  async getTenantInvitations(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: InvitationStatus;
      role?: TenantRole;
      search?: string;
    }
  ): Promise<{
    invitations: (TenantInvitation & { invitedBy: User; acceptedBy?: User | null })[];
    total: number;
  }> {
    try {
      const { page = 1, limit = 20, status, role, search } = options;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = { tenantId };
      
      if (status) {
        where.status = status;
      }
      
      if (role) {
        where.role = role;
      }
      
      if (search) {
        where.email = {
          contains: search,
          mode: 'insensitive',
        };
      }

      // Get total count
      const total = await prisma.tenantInvitation.count({ where });

      // Get invitations with pagination
      const invitations = await prisma.tenantInvitation.findMany({
        where,
        include: {
          invitedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          acceptedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      return { invitations, total };
    } catch (error) {
      logger.error('Failed to get tenant invitations', {
        error: error.message,
        tenantId,
        options,
      });
      throw error;
    }
  }

  /**
   * Remove a member from a tenant
   */
  async removeMember(
    tenantId: string,
    userId: string,
    requesterId: string
  ): Promise<void> {
    try {
      // Check requester permission
      const requesterMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: requesterId,
            tenantId,
          },
        },
      });

      if (!requesterMembership) {
        throw createError('You are not a member of this tenant', 403);
      }

      // Get target membership
      const targetMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!targetMembership) {
        throw createError('User is not a member of this tenant', 404);
      }

      // Permission checks
      if (userId === requesterId) {
        // Users can leave on their own unless they're the owner
        if (targetMembership.role === TenantRole.OWNER) {
          // Check if there are other owners
          const ownerCount = await prisma.tenantMembership.count({
            where: {
              tenantId,
              role: TenantRole.OWNER,
            },
          });

          if (ownerCount <= 1) {
            throw createError('Cannot remove the last owner of a tenant', 403);
          }
        }
      } else {
        // Only owners and admins can remove others
        if (
          requesterMembership.role !== TenantRole.OWNER &&
          requesterMembership.role !== TenantRole.ADMIN
        ) {
          throw createError('You do not have permission to remove members', 403);
        }

        // Admins cannot remove owners or other admins
        if (requesterMembership.role === TenantRole.ADMIN) {
          if (
            targetMembership.role === TenantRole.OWNER ||
            targetMembership.role === TenantRole.ADMIN
          ) {
            throw createError('You cannot remove owners or other admins', 403);
          }
        }
      }

      // Remove membership
      await prisma.tenantMembership.delete({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      // Revoke all sessions for this tenant
      await prisma.userSession.updateMany({
        where: {
          userId,
          tenantId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'Removed from tenant',
        },
      });

      logger.info('Member removed from tenant', {
        tenantId,
        userId,
        requesterId,
      });
    } catch (error) {
      logger.error('Failed to remove member', {
        error: error.message,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    tenantId: string,
    userId: string,
    newRole: TenantRole,
    requesterId: string
  ): Promise<TenantMembership> {
    try {
      // Check requester permission
      const requesterMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: requesterId,
            tenantId,
          },
        },
      });

      if (!requesterMembership) {
        throw createError('You are not a member of this tenant', 403);
      }

      // Only owners can change roles
      if (requesterMembership.role !== TenantRole.OWNER) {
        throw createError('Only owners can change member roles', 403);
      }

      // Cannot change own role
      if (userId === requesterId) {
        throw createError('You cannot change your own role', 400);
      }

      // Get target membership
      const targetMembership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!targetMembership) {
        throw createError('User is not a member of this tenant', 404);
      }

      // If demoting an owner, ensure there's at least one owner left
      if (targetMembership.role === TenantRole.OWNER && newRole !== TenantRole.OWNER) {
        const ownerCount = await prisma.tenantMembership.count({
          where: {
            tenantId,
            role: TenantRole.OWNER,
          },
        });

        if (ownerCount <= 1) {
          throw createError('Cannot demote the last owner of a tenant', 403);
        }
      }

      // Update role
      const updatedMembership = await prisma.tenantMembership.update({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
        data: {
          role: newRole,
        },
      });

      logger.info('Member role updated', {
        tenantId,
        userId,
        newRole,
        requesterId,
      });

      return updatedMembership;
    } catch (error) {
      logger.error('Failed to update member role', {
        error: error.message,
        tenantId,
        userId,
        newRole,
      });
      throw error;
    }
  }

  /**
   * Get invitations for a user by email
   */
  async getUserInvitations(email: string, status?: InvitationStatus): Promise<(TenantInvitation & { tenant: Tenant; invitedBy: User })[]> {
    try {
      const invitations = await prisma.tenantInvitation.findMany({
        where: {
          email,
          status: status || undefined,
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              description: true,
            },
          },
          invitedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return invitations;
    } catch (error) {
      logger.error('Failed to get user invitations', {
        error: error.message,
        email,
      });
      throw error;
    }
  }

  /**
   * Get invitation by token (public method for invitation preview)
   */
  async getInvitationByToken(token: string): Promise<(TenantInvitation & { tenant: Tenant; invitedBy: User }) | null> {
    try {
      const invitation = await prisma.tenantInvitation.findUnique({
        where: { invitationToken: token },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              description: true,
            },
          },
          invitedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return invitation;
    } catch (error) {
      logger.error('Failed to get invitation by token', {
        error: error.message,
        token: token?.substring(0, 10) + '...',
      });
      throw error;
    }
  }
}

// Export singleton instance
export const invitationService = new InvitationService();