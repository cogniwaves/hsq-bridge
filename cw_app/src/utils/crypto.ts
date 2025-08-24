import * as crypto from 'crypto';
import { logger } from './logger';

/**
 * Encryption utilities for secure token storage
 */
export class CryptoUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 32;

  /**
   * Get or generate encryption key from environment
   */
  private static getEncryptionKey(): Buffer {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY || process.env.JWT_SECRET;
    
    if (!masterKey || masterKey.length < 32) {
      throw new Error('Encryption master key must be at least 32 characters');
    }

    // Derive a key using PBKDF2
    const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'quickbooks-oauth-salt-2024', 'utf8');
    return crypto.pbkdf2Sync(masterKey, salt, this.ITERATIONS, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt sensitive data (tokens)
   */
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const key = this.getEncryptionKey();
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data (tokens)
   */
  static decrypt(encryptedData: string, iv: string, tag: string): string {
    try {
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        key,
        Buffer.from(iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data for comparison without storing plaintext
   */
  static hash(text: string): string {
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Mask token for logging (show only first and last few characters)
   */
  static maskToken(token: string, showChars: number = 4): string {
    if (!token || token.length <= showChars * 2) {
      return '***';
    }
    
    const start = token.substring(0, showChars);
    const end = token.substring(token.length - showChars);
    const maskLength = Math.max(3, token.length - (showChars * 2));
    const mask = '*'.repeat(Math.min(maskLength, 20));
    
    return `${start}${mask}${end}`;
  }

  /**
   * Validate token format
   */
  static isValidTokenFormat(token: string): boolean {
    // Basic validation - tokens should be non-empty strings
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return false;
    }
    
    // Check for common token patterns
    // Most OAuth tokens are base64 or JWT format
    const validPatterns = [
      /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/, // JWT
      /^[A-Za-z0-9\-_+=\/]+$/, // Base64
      /^[A-Za-z0-9]+$/ // Alphanumeric
    ];
    
    return validPatterns.some(pattern => pattern.test(token));
  }

  /**
   * Securely compare two tokens (constant time comparison)
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  }
}

/**
 * Token encryption wrapper for database storage
 */
export class TokenEncryption {
  /**
   * Prepare token for secure storage
   */
  static async encryptForStorage(token: string): Promise<{
    encryptedToken: string;
    encryptionIV: string;
    encryptionTag: string;
  }> {
    const { encrypted, iv, tag } = CryptoUtils.encrypt(token);
    
    return {
      encryptedToken: encrypted,
      encryptionIV: iv,
      encryptionTag: tag
    };
  }

  /**
   * Retrieve and decrypt token from storage
   */
  static async decryptFromStorage(
    encryptedToken: string,
    encryptionIV: string,
    encryptionTag: string
  ): Promise<string> {
    return CryptoUtils.decrypt(encryptedToken, encryptionIV, encryptionTag);
  }

  /**
   * Validate and sanitize token before storage
   */
  static validateToken(token: string, tokenType: 'access' | 'refresh'): boolean {
    if (!CryptoUtils.isValidTokenFormat(token)) {
      logger.warn(`Invalid ${tokenType} token format detected`);
      return false;
    }
    
    // Additional validation based on token type
    if (tokenType === 'refresh' && token.length < 20) {
      logger.warn('Refresh token seems too short');
      return false;
    }
    
    return true;
  }
}