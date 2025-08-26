import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { TenantRole } from '@prisma/client';

/**
 * JWT utility functions for token generation and validation
 * Implements secure token practices with refresh rotation
 */

// Configuration from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const JWT_ISSUER = process.env.JWT_ISSUER || 'hsq-bridge';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'hsq-bridge-api';

// Token payload interfaces
export interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: TenantRole;
  sessionId?: string;
  tokenType: 'access' | 'refresh';
}

export interface AccessTokenPayload extends TokenPayload {
  tokenType: 'access';
  permissions?: string[];
  isSuperAdmin?: boolean;
}

export interface RefreshTokenPayload extends TokenPayload {
  tokenType: 'refresh';
  tokenFamily?: string; // For refresh token rotation
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
}

/**
 * Generate an access token
 */
export function generateAccessToken(
  userId: string,
  email: string,
  tenantId?: string,
  tenantSlug?: string,
  role?: TenantRole,
  sessionId?: string,
  permissions?: string[],
  isSuperAdmin?: boolean
): string {
  const payload: AccessTokenPayload = {
    userId,
    email,
    tenantId,
    tenantSlug,
    role,
    sessionId,
    permissions,
    isSuperAdmin,
    tokenType: 'access',
    jti: uuidv4(), // JWT ID for tracking
    iat: Math.floor(Date.now() / 1000),
  };

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256',
  };

  try {
    const token = jwt.sign(payload, JWT_SECRET, options);
    
    logger.debug('Access token generated', {
      userId,
      tenantId,
      expiresIn: JWT_EXPIRES_IN,
      tokenId: payload.jti,
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate access token', { error: error.message, userId });
    throw new Error('Token generation failed');
  }
}

/**
 * Generate a refresh token with family tracking for rotation
 */
export function generateRefreshToken(
  userId: string,
  email: string,
  tenantId?: string,
  sessionId?: string,
  tokenFamily?: string
): string {
  const payload: RefreshTokenPayload = {
    userId,
    email,
    tenantId,
    sessionId,
    tokenType: 'refresh',
    tokenFamily: tokenFamily || uuidv4(),
    jti: uuidv4(),
    iat: Math.floor(Date.now() / 1000),
  };

  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256',
  };

  try {
    const token = jwt.sign(payload, JWT_REFRESH_SECRET, options);
    
    logger.debug('Refresh token generated', {
      userId,
      tenantId,
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      tokenFamily: payload.tokenFamily,
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate refresh token', { error: error.message, userId });
    throw new Error('Token generation failed');
  }
}

/**
 * Generate a complete token pair
 */
export function generateTokenPair(
  userId: string,
  email: string,
  tenantId?: string,
  tenantSlug?: string,
  role?: TenantRole,
  sessionId?: string,
  permissions?: string[],
  isSuperAdmin?: boolean,
  tokenFamily?: string
): TokenPair {
  const accessToken = generateAccessToken(
    userId,
    email,
    tenantId,
    tenantSlug,
    role,
    sessionId,
    permissions,
    isSuperAdmin
  );

  const refreshToken = generateRefreshToken(
    userId,
    email,
    tenantId,
    sessionId,
    tokenFamily
  );

  // Calculate expiry dates
  const accessTokenExpiry = new Date(Date.now() + parseExpiry(JWT_EXPIRES_IN));
  const refreshTokenExpiry = new Date(Date.now() + parseExpiry(JWT_REFRESH_EXPIRES_IN));

  return {
    accessToken,
    refreshToken,
    accessTokenExpiry,
    refreshTokenExpiry,
  };
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const options: VerifyOptions = {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ['HS256'],
  };

  try {
    const decoded = jwt.verify(token, JWT_SECRET, options) as AccessTokenPayload;
    
    if (decoded.tokenType !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Access token expired', { error: error.message });
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid access token', { error: error.message });
      throw new Error('Invalid token');
    }
    
    logger.error('Token verification failed', { error: error.message });
    throw new Error('Token verification failed');
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const options: VerifyOptions = {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ['HS256'],
  };

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, options) as RefreshTokenPayload;
    
    if (decoded.tokenType !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Refresh token expired', { error: error.message });
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid refresh token', { error: error.message });
      throw new Error('Invalid refresh token');
    }
    
    logger.error('Refresh token verification failed', { error: error.message });
    throw new Error('Token verification failed');
  }
}

/**
 * Decode a token without verification (for debugging/logging)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if token is about to expire (within threshold)
 */
export function isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    const timeUntilExpiry = expiryTime - Date.now();
    
    return timeUntilExpiry <= thresholdSeconds * 1000;
  } catch {
    return true;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Parse expiry string to milliseconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

/**
 * Generate a JWT for password reset (short-lived)
 */
export function generatePasswordResetToken(userId: string, email: string): string {
  const payload = {
    userId,
    email,
    purpose: 'password_reset',
    jti: uuidv4(),
    iat: Math.floor(Date.now() / 1000),
  };

  const options: SignOptions = {
    expiresIn: process.env.PASSWORD_RESET_EXPIRES || '1h',
    issuer: JWT_ISSUER,
    algorithm: 'HS256',
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify a password reset token
 */
export function verifyPasswordResetToken(token: string): { userId: string; email: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.purpose !== 'password_reset') {
      throw new Error('Invalid token purpose');
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    logger.warn('Invalid password reset token', { error: error.message });
    throw new Error('Invalid or expired reset token');
  }
}