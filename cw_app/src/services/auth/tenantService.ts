import { 
  PrismaClient, 
  Tenant, 
  TenantMembership, 
  User,
  TenantRole 
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { createError } from '../../utils/errorHandler';
import {
  TenantCreationInput,
  TenantUpdateInput,
  TenantSwitchInput,
  validateRequest,
  tenantCreationSchema,
  tenantUpdateSchema,
  tenantSwitchSchema,
} from '../../utils/auth/validationSchemas';

const prisma = new PrismaClient();

export interface TenantWithMembers extends Tenant {
  members: (TenantMembership & {
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'avatarUrl'>;
  })[];
  _count: {
    members: number;
    invitations: number;
  };
}

export interface TenantStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  storageUsed?: number;
  apiCallsThisMonth?: number;
}

/**
 * Tenant Management Service
 * Handles tenant creation, management, and switching
 */
export class TenantService {
  /**
   * Create a new tenant
   */
  async createTenant(
    userId: string,
    input: TenantCreationInput
  ): Promise<{ tenant: Tenant; membership: TenantMembership }> {
    try {
      // Validate input
      const validatedInput = validateRequest(tenantCreationSchema, input);

      // Check if slug is available
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug: validatedInput.slug },
      });

      if (existingTenant) {
        throw createError('Tenant slug is already taken', 409);
      }

      // Check if domain is available (if provided)
      if (validatedInput.domain) {
        const domainTenant = await prisma.tenant.findUnique({
          where: { domain: validatedInput.domain },
        });

        if (domainTenant) {
          throw createError('Domain is already registered', 409);
        }
      }

      // Get user to check permissions
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { tenantMemberships: true },
          },
        },
      });

      if (!user) {
        throw createError('User not found', 404);
      }

      // Check if user has reached tenant limit (unless super admin)
      const maxTenantsPerUser = parseInt(process.env.MAX_TENANTS_PER_USER || '3', 10);
      if (!user.isSuperAdmin && user._count.tenantMemberships >= maxTenantsPerUser) {
        throw createError(`You have reached the maximum number of tenants (${maxTenantsPerUser})`, 403);
      }

      // Create tenant and membership in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name: validatedInput.name,
            slug: validatedInput.slug,
            description: validatedInput.description,
            domain: validatedInput.domain || undefined,
            industry: validatedInput.industry,
            size: validatedInput.size,
            country: validatedInput.country,
            timezone: validatedInput.timezone,
            billingEmail: validatedInput.billingEmail,
            technicalEmail: validatedInput.technicalEmail,
            createdById: userId,
            isTrial: true,
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
            maxUsers: 5, // Default for new tenants
            settings: {},
          },
        });

        // Create owner membership
        const membership = await tx.tenantMembership.create({
          data: {
            userId,
            tenantId: tenant.id,
            role: TenantRole.OWNER,
            isPrimary: user._count.tenantMemberships === 0, // Primary if first tenant
          },
        });

        logger.info('Tenant created', {
          tenantId: tenant.id,
          slug: tenant.slug,
          userId,
        });

        return { tenant, membership };
      });

      return result;
    } catch (error) {
      logger.error('Failed to create tenant', {
        error: error.message,
        userId,
        slug: input.slug,
      });
      throw error;
    }
  }

  /**
   * Update tenant details
   */
  async updateTenant(
    tenantId: string,
    userId: string,
    input: TenantUpdateInput
  ): Promise<Tenant> {
    try {
      // Validate input
      const validatedInput = validateRequest(tenantUpdateSchema, input);

      // Check user permission
      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!membership) {
        throw createError('You are not a member of this tenant', 403);
      }

      // Only owners and admins can update tenant
      if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
        throw createError('You do not have permission to update this tenant', 403);
      }

      // Check if domain is available (if being changed)
      if (validatedInput.domain !== undefined) {
        const existingTenant = await prisma.tenant.findFirst({
          where: {
            domain: validatedInput.domain,
            NOT: { id: tenantId },
          },
        });

        if (existingTenant) {
          throw createError('Domain is already registered', 409);
        }
      }

      // Update tenant
      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          name: validatedInput.name,
          description: validatedInput.description,
          domain: validatedInput.domain,
          industry: validatedInput.industry,
          size: validatedInput.size,
          country: validatedInput.country,
          timezone: validatedInput.timezone,
          billingEmail: validatedInput.billingEmail,
          technicalEmail: validatedInput.technicalEmail,
          logo: validatedInput.logo,
          settings: validatedInput.settings,
        },
      });

      logger.info('Tenant updated', {
        tenantId,
        userId,
        changes: Object.keys(validatedInput),
      });

      return updatedTenant;
    } catch (error) {
      logger.error('Failed to update tenant', {
        error: error.message,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete a tenant (soft delete)
   */
  async deleteTenant(tenantId: string, userId: string): Promise<void> {
    try {
      // Check user permission
      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!membership) {
        throw createError('You are not a member of this tenant', 403);
      }

      // Only owners can delete tenant
      if (membership.role !== TenantRole.OWNER) {
        throw createError('Only owners can delete a tenant', 403);
      }

      // Soft delete tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // Revoke all sessions for this tenant
      await prisma.userSession.updateMany({
        where: {
          tenantId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'Tenant deleted',
        },
      });

      logger.info('Tenant deleted', { tenantId, userId });
    } catch (error) {
      logger.error('Failed to delete tenant', {
        error: error.message,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string, userId: string): Promise<TenantWithMembers> {
    try {
      // Check user permission
      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!membership) {
        throw createError('You are not a member of this tenant', 403);
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
          _count: {
            select: {
              members: true,
              invitations: {
                where: {
                  status: 'PENDING',
                },
              },
            },
          },
        },
      });

      if (!tenant) {
        throw createError('Tenant not found', 404);
      }

      if (!tenant.isActive) {
        throw createError('Tenant is not active', 403);
      }

      return tenant as TenantWithMembers;
    } catch (error) {
      logger.error('Failed to get tenant', {
        error: error.message,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user's tenants
   */
  async getUserTenants(userId: string): Promise<(TenantMembership & { tenant: Tenant })[]> {
    try {
      const memberships = await prisma.tenantMembership.findMany({
        where: { userId },
        include: {
          tenant: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { joinedAt: 'asc' },
        ],
      });

      // Filter out inactive tenants unless user is owner
      const activeMemberships = memberships.filter(
        m => m.tenant.isActive || m.role === TenantRole.OWNER
      );

      return activeMemberships;
    } catch (error) {
      logger.error('Failed to get user tenants', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Switch to a different tenant
   */
  async switchTenant(
    userId: string,
    input: TenantSwitchInput,
    sessionToken?: string
  ): Promise<{ tenant: Tenant; membership: TenantMembership }> {
    try {
      // Validate input
      const validatedInput = validateRequest(tenantSwitchSchema, input);

      // Check membership
      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId: validatedInput.tenantId,
          },
        },
        include: {
          tenant: true,
        },
      });

      if (!membership) {
        throw createError('You are not a member of this tenant', 403);
      }

      if (!membership.tenant.isActive) {
        throw createError('Tenant is not active', 403);
      }

      // Update session if provided
      if (sessionToken) {
        await prisma.userSession.updateMany({
          where: {
            sessionToken,
            userId,
          },
          data: {
            tenantId: validatedInput.tenantId,
          },
        });
      }

      // Update last accessed
      await prisma.tenantMembership.update({
        where: {
          userId_tenantId: {
            userId,
            tenantId: validatedInput.tenantId,
          },
        },
        data: {
          lastAccessedAt: new Date(),
        },
      });

      logger.info('Tenant switched', {
        userId,
        tenantId: validatedInput.tenantId,
      });

      return { tenant: membership.tenant, membership };
    } catch (error) {
      logger.error('Failed to switch tenant', {
        error: error.message,
        userId,
        tenantId: input.tenantId,
      });
      throw error;
    }
  }

  /**
   * Set primary tenant for user
   */
  async setPrimaryTenant(userId: string, tenantId: string): Promise<void> {
    try {
      // Check membership
      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!membership) {
        throw createError('You are not a member of this tenant', 403);
      }

      // Update primary status in transaction
      await prisma.$transaction(async (tx) => {
        // Remove primary from all other tenants
        await tx.tenantMembership.updateMany({
          where: {
            userId,
            NOT: { tenantId },
          },
          data: {
            isPrimary: false,
          },
        });

        // Set new primary
        await tx.tenantMembership.update({
          where: {
            userId_tenantId: {
              userId,
              tenantId,
            },
          },
          data: {
            isPrimary: true,
          },
        });
      });

      logger.info('Primary tenant updated', { userId, tenantId });
    } catch (error) {
      logger.error('Failed to set primary tenant', {
        error: error.message,
        userId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId: string, userId: string): Promise<TenantStats> {
    try {
      // Check permission
      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
      });

      if (!membership) {
        throw createError('You are not a member of this tenant', 403);
      }

      // Get member counts
      const [totalMembers, activeMembers, pendingInvitations] = await Promise.all([
        prisma.tenantMembership.count({
          where: { tenantId },
        }),
        prisma.tenantMembership.count({
          where: {
            tenantId,
            user: {
              lastActivityAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Active in last 30 days
              },
            },
          },
        }),
        prisma.tenantInvitation.count({
          where: {
            tenantId,
            status: 'PENDING',
          },
        }),
      ]);

      // TODO: Add storage and API call tracking
      const stats: TenantStats = {
        totalMembers,
        activeMembers,
        pendingInvitations,
        storageUsed: 0, // Placeholder
        apiCallsThisMonth: 0, // Placeholder
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get tenant stats', {
        error: error.message,
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if tenant has reached user limit
   */
  async checkTenantUserLimit(tenantId: string): Promise<boolean> {
    try {
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

      return tenant._count.members >= tenant.maxUsers;
    } catch (error) {
      logger.error('Failed to check tenant user limit', {
        error: error.message,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update tenant subscription
   */
  async updateTenantSubscription(
    tenantId: string,
    subscriptionData: {
      status: string;
      plan: string;
      maxUsers: number;
      isTrial?: boolean;
      trialEndsAt?: Date;
    }
  ): Promise<Tenant> {
    try {
      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: subscriptionData.status,
          subscriptionPlan: subscriptionData.plan,
          maxUsers: subscriptionData.maxUsers,
          isTrial: subscriptionData.isTrial ?? false,
          trialEndsAt: subscriptionData.trialEndsAt,
          subscriptionStartedAt: subscriptionData.isTrial ? undefined : new Date(),
        },
      });

      logger.info('Tenant subscription updated', {
        tenantId,
        plan: subscriptionData.plan,
        status: subscriptionData.status,
      });

      return updatedTenant;
    } catch (error) {
      logger.error('Failed to update tenant subscription', {
        error: error.message,
        tenantId,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const tenantService = new TenantService();