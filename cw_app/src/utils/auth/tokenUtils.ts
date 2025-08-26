import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

/**
 * Utility functions for secure token generation
 * Used for invitations, email verification, and other non-JWT tokens
 */

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  try {
    // Generate random bytes and convert to hex string
    const token = crypto.randomBytes(length).toString('hex');
    
    logger.debug('Secure token generated', { length });
    
    return token;
  } catch (error) {
    logger.error('Failed to generate secure token', { error: error.message });
    throw new Error('Token generation failed');
  }
}

/**
 * Generate a URL-safe token (base64url encoding)
 */
export function generateUrlSafeToken(length: number = 32): string {
  try {
    const token = crypto.randomBytes(length)
      .toString('base64url')
      .replace(/[^a-zA-Z0-9\-_]/g, '');
    
    logger.debug('URL-safe token generated', { length });
    
    return token;
  } catch (error) {
    logger.error('Failed to generate URL-safe token', { error: error.message });
    throw new Error('Token generation failed');
  }
}

/**
 * Generate an invitation token with embedded metadata
 */
export interface InvitationTokenData {
  tenantId: string;
  email: string;
  role: string;
  invitedBy: string;
}

export function generateInvitationToken(data: InvitationTokenData): string {
  try {
    // Create a unique token combining UUID and random bytes
    const tokenId = uuidv4();
    const randomPart = crypto.randomBytes(16).toString('hex');
    const token = `inv_${tokenId}_${randomPart}`;
    
    logger.debug('Invitation token generated', {
      tenantId: data.tenantId,
      email: data.email,
      role: data.role,
    });
    
    return token;
  } catch (error) {
    logger.error('Failed to generate invitation token', { error: error.message });
    throw new Error('Invitation token generation failed');
  }
}

/**
 * Generate an email verification token
 */
export function generateEmailVerificationToken(userId: string, email: string): string {
  try {
    // Create a token with user context
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(20).toString('hex');
    const token = `verify_${timestamp}_${randomPart}`;
    
    logger.debug('Email verification token generated', { userId, email });
    
    return token;
  } catch (error) {
    logger.error('Failed to generate email verification token', { error: error.message });
    throw new Error('Verification token generation failed');
  }
}

/**
 * Generate a password reset token
 */
export function generatePasswordResetToken(): string {
  try {
    // Generate a strong random token for password reset
    const token = `reset_${crypto.randomBytes(32).toString('hex')}`;
    
    logger.debug('Password reset token generated');
    
    return token;
  } catch (error) {
    logger.error('Failed to generate password reset token', { error: error.message });
    throw new Error('Reset token generation failed');
  }
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return `sess_${uuidv4()}`;
}

/**
 * Generate an API key
 */
export function generateApiKey(prefix: string = 'api'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Hash a token for storage (one-way)
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Create a time-limited token
 */
export interface TimeLimitedToken {
  token: string;
  hashedToken: string;
  expiresAt: Date;
}

export function createTimeLimitedToken(
  expiryMinutes: number = 60
): TimeLimitedToken {
  const token = generateSecureToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  return {
    token,
    hashedToken,
    expiresAt,
  };
}

/**
 * Verify token timing (not expired)
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a nonce for security headers
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Create a signed token (for URL parameters)
 */
export function createSignedToken(data: any, secret: string): string {
  const payload = JSON.stringify(data);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const token = Buffer.from(payload).toString('base64url');
  return `${token}.${signature}`;
}

/**
 * Verify a signed token
 */
export function verifySignedToken(token: string, secret: string): any | null {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      return null;
    }
    
    const data = Buffer.from(payload, 'base64url').toString();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    
    // Timing-safe comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )) {
      return null;
    }
    
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Failed to verify signed token', { error: error.message });
    return null;
  }
}

/**
 * Generate a short OTP code (for 2FA)
 */
export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, digits.length);
    otp += digits[randomIndex];
  }
  
  return otp;
}

/**
 * Mask a token for display (show only first/last few characters)
 */
export function maskToken(token: string, showChars: number = 4): string {
  if (token.length <= showChars * 2) {
    return '***';
  }
  
  const start = token.substring(0, showChars);
  const end = token.substring(token.length - showChars);
  const masked = '*'.repeat(Math.min(8, token.length - showChars * 2));
  
  return `${start}${masked}${end}`;
}