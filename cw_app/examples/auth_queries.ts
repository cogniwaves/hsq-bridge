/**
 * Phase 2 Authentication System - Query Examples
 * 
 * This file demonstrates common query patterns for the multi-tenant
 * authentication system, including tenant isolation, role-based access,
 * and performance-optimized queries.
 */

import { PrismaClient, TenantRole, InvitationStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// USER AUTHENTICATION QUERIES
// ============================================================================

/**
 * Authenticate a user by email and return their profile with active tenants
 */
export async function authenticateUser(email: string) {
  return await prisma.user.findUnique({
    where: { 
      email,
      isActive: true,
      emailVerified: true,
    },
    include: {
      tenantMemberships: {
        where: {
          tenant: {
            isActive: true,
          },
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              subscriptionStatus: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Get user with their primary tenant for quick login
 */
export async function getUserWithPrimaryTenant(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenantMemberships: {
        where: { isPrimary: true },
        include: {
          tenant: true,
        },
      },
    },
  });
}

/**
 * Create a new user session with tenant context
 */
export async function createUserSession(
  userId: string,
  tenantId: string,
  sessionData: {
    sessionToken: string;
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  // Verify user has access to tenant
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!membership) {
    throw new Error('User does not have access to this tenant');
  }

  // Create session
  const session = await prisma.userSession.create({
    data: {
      userId,
      tenantId,
      ...sessionData,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Update user last login
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
    },
  });

  // Update membership last accessed
  await prisma.tenantMembership.update({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
    data: {
      lastAccessedAt: new Date(),
    },
  });

  return session;
}

// ============================================================================
// TENANT ISOLATION QUERIES
// ============================================================================

/**
 * Get all invoices for a specific tenant with proper isolation
 */
export async function getTenantInvoices(tenantId: string, userId: string) {
  // First verify user has access to this tenant
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!membership) {
    throw new Error('Access denied: User is not a member of this tenant');
  }

  // For viewers, limit to basic data
  if (membership.role === TenantRole.VIEWER) {
    return await prisma.invoiceMapping.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        hubspotInvoiceNumber: true,
        totalAmount: true,
        currency: true,
        status: true,
        issueDate: true,
        dueDate: true,
        clientName: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Full access for other roles
  return await prisma.invoiceMapping.findMany({
    where: { tenant_id: tenantId },
    include: {
      lineItems: true,
      taxSummary: true,
      payments: {
        include: {
          payment: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get tenant-specific OAuth tokens with proper isolation
 */
export async function getTenantOAuthTokens(tenantId: string, userId: string) {
  // Verify user is admin or owner
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!membership || 
      (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN)) {
    throw new Error('Access denied: Insufficient permissions');
  }

  return await prisma.oAuthToken.findMany({
    where: { tenantId },
    select: {
      id: true,
      provider: true,
      scope: true,
      expiresAt: true,
      lastRefreshedAt: true,
      refreshCount: true,
      createdAt: true,
      updatedAt: true,
      // Never return actual tokens in queries
    },
  });
}

// ============================================================================
// ROLE-BASED ACCESS QUERIES
// ============================================================================

/**
 * Check if user can perform an action based on their role
 */
export async function canUserPerformAction(
  userId: string,
  tenantId: string,
  action: 'view' | 'edit' | 'admin' | 'owner'
): Promise<boolean> {
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!membership) return false;

  const roleHierarchy = {
    [TenantRole.OWNER]: ['view', 'edit', 'admin', 'owner'],
    [TenantRole.ADMIN]: ['view', 'edit', 'admin'],
    [TenantRole.MEMBER]: ['view', 'edit'],
    [TenantRole.VIEWER]: ['view'],
  };

  return roleHierarchy[membership.role]?.includes(action) || false;
}

/**
 * Get tenant members with role filtering
 */
export async function getTenantMembers(
  tenantId: string,
  requestingUserId: string,
  roleFilter?: TenantRole
) {
  // Check if requesting user is admin or owner
  const canViewMembers = await canUserPerformAction(
    requestingUserId,
    tenantId,
    'admin'
  );

  if (!canViewMembers) {
    throw new Error('Access denied: Cannot view tenant members');
  }

  return await prisma.tenantMembership.findMany({
    where: {
      tenantId,
      ...(roleFilter && { role: roleFilter }),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          lastLoginAt: true,
          isActive: true,
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

// ============================================================================
// INVITATION QUERIES
// ============================================================================

/**
 * Create a new tenant invitation
 */
export async function createTenantInvitation(
  tenantId: string,
  invitedById: string,
  invitationData: {
    email: string;
    role: TenantRole;
    message?: string;
  }
) {
  // Verify inviter has admin permissions
  const canInvite = await canUserPerformAction(invitedById, tenantId, 'admin');
  if (!canInvite) {
    throw new Error('Access denied: Cannot send invitations');
  }

  // Check if user already exists and is a member
  const existingUser = await prisma.user.findUnique({
    where: { email: invitationData.email },
  });

  if (existingUser) {
    const existingMembership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: existingUser.id,
          tenantId,
        },
      },
    });

    if (existingMembership) {
      throw new Error('User is already a member of this tenant');
    }
  }

  // Check for pending invitation
  const pendingInvitation = await prisma.tenantInvitation.findFirst({
    where: {
      tenantId,
      email: invitationData.email,
      status: InvitationStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
  });

  if (pendingInvitation) {
    throw new Error('A pending invitation already exists for this email');
  }

  // Create invitation
  return await prisma.tenantInvitation.create({
    data: {
      tenantId,
      invitedById,
      ...invitationData,
      invitationToken: generateSecureToken(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    include: {
      tenant: {
        select: {
          name: true,
          slug: true,
        },
      },
      invitedBy: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Accept a tenant invitation
 */
export async function acceptTenantInvitation(
  invitationToken: string,
  userId: string
) {
  const invitation = await prisma.tenantInvitation.findUnique({
    where: { invitationToken },
    include: { tenant: true },
  });

  if (!invitation) {
    throw new Error('Invalid invitation token');
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new Error(`Invitation has already been ${invitation.status.toLowerCase()}`);
  }

  if (invitation.expiresAt < new Date()) {
    // Mark as expired
    await prisma.tenantInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
    });
    throw new Error('Invitation has expired');
  }

  // Create transaction to accept invitation and create membership
  return await prisma.$transaction(async (tx) => {
    // Update invitation status
    const updatedInvitation = await tx.tenantInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    // Create tenant membership
    const membership = await tx.tenantMembership.create({
      data: {
        userId,
        tenantId: invitation.tenantId,
        role: invitation.role,
        invitationId: invitation.id,
        invitedById: invitation.invitedById,
      },
    });

    return { invitation: updatedInvitation, membership };
  });
}

// ============================================================================
// PERFORMANCE-OPTIMIZED QUERIES
// ============================================================================

/**
 * Get tenant dashboard data with minimal queries
 */
export async function getTenantDashboard(tenantId: string, userId: string) {
  // Verify access
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!membership) {
    throw new Error('Access denied');
  }

  // Parallel queries for dashboard data
  const [tenant, invoiceStats, recentActivity, memberCount] = await Promise.all([
    // Tenant details
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        trialEndsAt: true,
        isTrial: true,
        maxUsers: true,
      },
    }),

    // Invoice statistics
    prisma.invoiceMapping.groupBy({
      by: ['status'],
      where: { tenant_id: tenantId },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),

    // Recent webhook events
    prisma.webhookEvent.findMany({
      where: { tenant_id: tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        platform: true,
        eventType: true,
        processed: true,
        createdAt: true,
      },
    }),

    // Member count
    prisma.tenantMembership.count({
      where: { tenantId },
    }),
  ]);

  return {
    tenant,
    invoiceStats,
    recentActivity,
    memberCount,
    userRole: membership.role,
  };
}

/**
 * Batch check user permissions for multiple actions
 */
export async function batchCheckPermissions(
  userId: string,
  tenantId: string
): Promise<Record<string, boolean>> {
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!membership) {
    return {
      canView: false,
      canEdit: false,
      canAdmin: false,
      canDelete: false,
      canInvite: false,
      canManageIntegrations: false,
      canViewBilling: false,
    };
  }

  const basePermissions = {
    [TenantRole.OWNER]: {
      canView: true,
      canEdit: true,
      canAdmin: true,
      canDelete: true,
      canInvite: true,
      canManageIntegrations: true,
      canViewBilling: true,
    },
    [TenantRole.ADMIN]: {
      canView: true,
      canEdit: true,
      canAdmin: true,
      canDelete: false,
      canInvite: true,
      canManageIntegrations: true,
      canViewBilling: false,
    },
    [TenantRole.MEMBER]: {
      canView: true,
      canEdit: true,
      canAdmin: false,
      canDelete: false,
      canInvite: false,
      canManageIntegrations: false,
      canViewBilling: false,
    },
    [TenantRole.VIEWER]: {
      canView: true,
      canEdit: false,
      canAdmin: false,
      canDelete: false,
      canInvite: false,
      canManageIntegrations: false,
      canViewBilling: false,
    },
  };

  // Merge base permissions with custom permissions if any
  const permissions = basePermissions[membership.role];
  if (membership.permissions) {
    return { ...permissions, ...(membership.permissions as any) };
  }

  return permissions;
}

// ============================================================================
// CLEANUP & MAINTENANCE QUERIES
// ============================================================================

/**
 * Clean up expired sessions and invitations
 */
export async function cleanupExpiredData() {
  const now = new Date();

  // Delete expired sessions
  const deletedSessions = await prisma.userSession.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  // Mark expired invitations
  const expiredInvitations = await prisma.tenantInvitation.updateMany({
    where: {
      status: InvitationStatus.PENDING,
      expiresAt: { lt: now },
    },
    data: {
      status: InvitationStatus.EXPIRED,
    },
  });

  return {
    deletedSessions: deletedSessions.count,
    expiredInvitations: expiredInvitations.count,
  };
}

/**
 * Get tenants approaching trial expiration
 */
export async function getExpiringTrialTenants(daysBeforeExpiry: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysBeforeExpiry);

  return await prisma.tenant.findMany({
    where: {
      isTrial: true,
      isActive: true,
      trialEndsAt: {
        gte: new Date(),
        lte: cutoffDate,
      },
    },
    include: {
      _count: {
        select: {
          members: true,
        },
      },
      createdBy: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { trialEndsAt: 'asc' },
  });
}

// Helper function to generate secure tokens
function generateSecureToken(): string {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}

// Export for use in other modules
export {
  prisma,
  TenantRole,
  InvitationStatus,
};