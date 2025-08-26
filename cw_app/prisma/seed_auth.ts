/**
 * Phase 2 Authentication System - Seed Script
 * 
 * This script seeds the database with sample authentication data for testing
 * the multi-tenant authentication system.
 */

import { PrismaClient, TenantRole, InvitationStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a URL-safe slug from a string
 */
function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('🌱 Starting Phase 2 Authentication seed...');

  // ============================================================================
  // Create Sample Users
  // ============================================================================
  
  const password = await bcrypt.hash('Password123!', 10);
  
  // Owner user
  const ownerUser = await prisma.user.create({
    data: {
      email: 'owner@example.com',
      passwordHash: password,
      firstName: 'John',
      lastName: 'Owner',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          inApp: true,
        },
      },
    },
  });

  // Admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: password,
      firstName: 'Jane',
      lastName: 'Admin',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  // Member user
  const memberUser = await prisma.user.create({
    data: {
      email: 'member@example.com',
      passwordHash: password,
      firstName: 'Bob',
      lastName: 'Member',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  // Viewer user
  const viewerUser = await prisma.user.create({
    data: {
      email: 'viewer@example.com',
      passwordHash: password,
      firstName: 'Alice',
      lastName: 'Viewer',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  // Unverified user (for testing email verification)
  const unverifiedUser = await prisma.user.create({
    data: {
      email: 'unverified@example.com',
      passwordHash: password,
      firstName: 'Charlie',
      lastName: 'Unverified',
      emailVerified: false,
      emailVerificationToken: generateToken(),
      isActive: true,
    },
  });

  console.log('✅ Created 5 sample users');

  // ============================================================================
  // Create Sample Tenants
  // ============================================================================

  // Primary tenant
  const primaryTenant = await prisma.tenant.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'acme.example.com',
      description: 'Leading provider of innovative solutions',
      industry: 'Technology',
      size: '50-100',
      country: 'USA',
      timezone: 'America/New_York',
      billingEmail: 'billing@acme.example.com',
      technicalEmail: 'tech@acme.example.com',
      isActive: true,
      isTrial: false,
      subscriptionStatus: 'active',
      subscriptionPlan: 'professional',
      subscriptionStartedAt: new Date('2024-01-01'),
      maxUsers: 20,
      createdById: ownerUser.id,
      settings: {
        features: {
          advancedReporting: true,
          apiAccess: true,
          customBranding: true,
        },
        integrations: {
          hubspot: true,
          stripe: true,
          quickbooks: true,
        },
      },
    },
  });

  // Trial tenant
  const trialTenant = await prisma.tenant.create({
    data: {
      name: 'StartUp Inc',
      slug: 'startup-inc',
      description: 'Emerging startup in fintech',
      industry: 'Finance',
      size: '1-10',
      country: 'USA',
      timezone: 'America/Los_Angeles',
      billingEmail: 'billing@startup.example.com',
      isActive: true,
      isTrial: true,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      maxUsers: 5,
      createdById: adminUser.id,
      settings: {
        features: {
          advancedReporting: false,
          apiAccess: false,
          customBranding: false,
        },
      },
    },
  });

  console.log('✅ Created 2 sample tenants');

  // ============================================================================
  // Create Tenant Memberships
  // ============================================================================

  // Owner membership for primary tenant
  await prisma.tenantMembership.create({
    data: {
      userId: ownerUser.id,
      tenantId: primaryTenant.id,
      role: TenantRole.OWNER,
      isPrimary: true,
      joinedAt: new Date('2024-01-01'),
      lastAccessedAt: new Date(),
    },
  });

  // Admin membership for primary tenant
  await prisma.tenantMembership.create({
    data: {
      userId: adminUser.id,
      tenantId: primaryTenant.id,
      role: TenantRole.ADMIN,
      isPrimary: true,
      joinedAt: new Date('2024-01-15'),
      lastAccessedAt: new Date(),
      permissions: {
        canManageUsers: true,
        canManageIntegrations: true,
        canViewBilling: false,
      },
    },
  });

  // Member membership for primary tenant
  await prisma.tenantMembership.create({
    data: {
      userId: memberUser.id,
      tenantId: primaryTenant.id,
      role: TenantRole.MEMBER,
      isPrimary: true,
      joinedAt: new Date('2024-02-01'),
      lastAccessedAt: new Date(),
    },
  });

  // Viewer membership for primary tenant
  await prisma.tenantMembership.create({
    data: {
      userId: viewerUser.id,
      tenantId: primaryTenant.id,
      role: TenantRole.VIEWER,
      isPrimary: true,
      joinedAt: new Date('2024-03-01'),
    },
  });

  // Admin user also owns the trial tenant
  await prisma.tenantMembership.create({
    data: {
      userId: adminUser.id,
      tenantId: trialTenant.id,
      role: TenantRole.OWNER,
      isPrimary: false,
      joinedAt: new Date(),
    },
  });

  console.log('✅ Created 5 tenant memberships');

  // ============================================================================
  // Create Tenant Invitations
  // ============================================================================

  // Pending invitation
  await prisma.tenantInvitation.create({
    data: {
      tenantId: primaryTenant.id,
      email: 'pending@example.com',
      role: TenantRole.MEMBER,
      invitationToken: generateToken(),
      status: InvitationStatus.PENDING,
      message: 'We would love to have you join our team!',
      invitedById: ownerUser.id,
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Accepted invitation (historical)
  await prisma.tenantInvitation.create({
    data: {
      tenantId: primaryTenant.id,
      email: memberUser.email,
      role: TenantRole.MEMBER,
      invitationToken: generateToken(),
      status: InvitationStatus.ACCEPTED,
      invitedById: ownerUser.id,
      invitedAt: new Date('2024-01-20'),
      acceptedAt: new Date('2024-01-21'),
      expiresAt: new Date('2024-01-27'),
    },
  });

  // Expired invitation
  await prisma.tenantInvitation.create({
    data: {
      tenantId: primaryTenant.id,
      email: 'expired@example.com',
      role: TenantRole.VIEWER,
      invitationToken: generateToken(),
      status: InvitationStatus.EXPIRED,
      invitedById: adminUser.id,
      invitedAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-08'),
    },
  });

  console.log('✅ Created 3 tenant invitations');

  // ============================================================================
  // Create User Sessions
  // ============================================================================

  // Active session for owner
  await prisma.userSession.create({
    data: {
      userId: ownerUser.id,
      tenantId: primaryTenant.id,
      sessionToken: generateToken(),
      refreshToken: generateToken(),
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      deviceInfo: {
        browser: 'Chrome',
        version: '120.0.0',
        os: 'Windows',
        device: 'Desktop',
      },
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Active session for admin
  await prisma.userSession.create({
    data: {
      userId: adminUser.id,
      tenantId: primaryTenant.id,
      sessionToken: generateToken(),
      refreshToken: generateToken(),
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      deviceInfo: {
        browser: 'Safari',
        version: '17.0',
        os: 'macOS',
        device: 'Desktop',
      },
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Expired session (for testing cleanup)
  await prisma.userSession.create({
    data: {
      userId: memberUser.id,
      tenantId: primaryTenant.id,
      sessionToken: generateToken(),
      ipAddress: '192.168.1.102',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      deviceInfo: {
        browser: 'Safari',
        version: '17.0',
        os: 'iOS',
        device: 'Mobile',
      },
      lastActivityAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-02'),
      createdAt: new Date('2024-01-01'),
    },
  });

  console.log('✅ Created 3 user sessions');

  // ============================================================================
  // Link Sample Tenant to Existing Data
  // ============================================================================
  
  // Update a sample of existing records to use the new tenant
  const tenantId = primaryTenant.id;

  // Update some invoices
  const invoiceUpdate = await prisma.invoiceMapping.updateMany({
    where: {
      tenant_id: {
        in: ['test-tenant-1', 'test-tenant-2'], // Replace with actual tenant_ids if they exist
      },
    },
    data: {
      tenant_id: tenantId,
    },
  });

  if (invoiceUpdate.count > 0) {
    console.log(`✅ Updated ${invoiceUpdate.count} invoices to new tenant`);
  }

  // Update OAuth tokens
  const tokenUpdate = await prisma.oAuthToken.updateMany({
    where: {
      tenantId: {
        in: ['test-tenant-1', 'test-tenant-2'],
      },
    },
    data: {
      tenantId: tenantId,
    },
  });

  if (tokenUpdate.count > 0) {
    console.log(`✅ Updated ${tokenUpdate.count} OAuth tokens to new tenant`);
  }

  console.log('\n🎉 Phase 2 Authentication seed completed successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('  Email: owner@example.com, Password: Password123!, Role: OWNER');
  console.log('  Email: admin@example.com, Password: Password123!, Role: ADMIN');
  console.log('  Email: member@example.com, Password: Password123!, Role: MEMBER');
  console.log('  Email: viewer@example.com, Password: Password123!, Role: VIEWER');
  console.log('\n🏢 Test Tenants:');
  console.log('  Acme Corporation (acme-corp) - Active subscription');
  console.log('  StartUp Inc (startup-inc) - Trial period');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding authentication data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });