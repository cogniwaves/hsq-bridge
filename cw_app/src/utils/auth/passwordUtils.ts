import bcrypt from 'bcryptjs';
import { logger } from '../logger';

/**
 * Password utility functions for secure password handling
 * Implements OWASP password guidelines and security best practices
 */

// Configuration constants
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Password strength requirements
const PASSWORD_PATTERNS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /[0-9]/,
  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
  noCommonPatterns: /^(?!.*(password|123456|qwerty|admin|letmein|welcome))/i,
};

export interface PasswordStrength {
  score: number; // 0-5 scale
  feedback: string[];
  isValid: boolean;
}

/**
 * Hash a password using bcrypt with configured salt rounds
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password before hashing
    const validation = validatePasswordStrength(password);
    if (!validation.isValid) {
      throw new Error(`Password does not meet requirements: ${validation.feedback.join(', ')}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    logger.debug('Password hashed successfully', {
      rounds: BCRYPT_ROUNDS,
      hashLength: hashedPassword.length,
    });

    return hashedPassword;
  } catch (error) {
    logger.error('Failed to hash password', { error: error.message });
    throw error;
  }
}

/**
 * Verify a password against a hash
 * Implements timing attack protection
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    // Basic input validation
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    // Use bcrypt's built-in timing-safe comparison
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);

    // Add artificial delay to prevent timing attacks on failed attempts
    if (!isMatch) {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
    }

    return isMatch;
  } catch (error) {
    logger.error('Failed to verify password', { error: error.message });
    return false;
  }
}

/**
 * Validate password strength and return detailed feedback
 */
export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Check basic length requirements
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    feedback.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  } else {
    score++;
  }

  if (password && password.length > MAX_PASSWORD_LENGTH) {
    feedback.push(`Password must be no more than ${MAX_PASSWORD_LENGTH} characters long`);
  }

  // Check character class requirements
  if (PASSWORD_PATTERNS.uppercase.test(password)) {
    score++;
  } else {
    feedback.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_PATTERNS.lowercase.test(password)) {
    score++;
  } else {
    feedback.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_PATTERNS.digit.test(password)) {
    score++;
  } else {
    feedback.push('Password must contain at least one digit');
  }

  if (PASSWORD_PATTERNS.special.test(password)) {
    score++;
  } else {
    feedback.push('Password must contain at least one special character');
  }

  // Check for common patterns
  if (!PASSWORD_PATTERNS.noCommonPatterns.test(password)) {
    feedback.push('Password contains common patterns and is too predictable');
    score = Math.max(0, score - 2);
  }

  // Additional strength checks
  if (password && password.length >= 12) {
    score = Math.min(5, score + 1);
  }

  if (password && password.length >= 16) {
    score = Math.min(5, score + 1);
  }

  // Check for repeated characters
  const hasRepeatedChars = /(.)\1{2,}/.test(password || '');
  if (hasRepeatedChars) {
    feedback.push('Password contains too many repeated characters');
    score = Math.max(0, score - 1);
  }

  return {
    score: Math.min(5, Math.max(0, score)),
    feedback,
    isValid: feedback.length === 0 && score >= 3,
  };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  
  // Ensure at least one character from each required class
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*()_+-=[]{}|;:,.<>?'[Math.floor(Math.random() * 27)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if password needs to be rehashed (e.g., if bcrypt rounds changed)
 */
export function needsRehash(hashedPassword: string): boolean {
  try {
    // Extract the cost factor from the hash
    const match = hashedPassword.match(/^\$2[ayb]\$(\d+)\$/);
    if (!match) {
      return true; // Invalid hash format
    }
    
    const currentRounds = parseInt(match[1], 10);
    return currentRounds !== BCRYPT_ROUNDS;
  } catch {
    return true;
  }
}

/**
 * Sanitize password for logging (never log actual passwords)
 */
export function sanitizePasswordForLogging(password: string): string {
  if (!password) return '[empty]';
  return `[${password.length} chars, strength: ${validatePasswordStrength(password).score}/5]`;
}