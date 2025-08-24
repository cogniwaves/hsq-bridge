// Middleware de rate limiting simple
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimit {
  count: number;
  resetTime: number;
}

// Store en mémoire pour les rate limits (en production, utiliser Redis)
const rateLimitStore = new Map<string, RateLimit>();

// Configuration par défaut
const DEFAULT_LIMITS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,         // 100 requêtes par fenêtre
  skipSuccessfulRequests: false,
  skipFailedRequests: false
};

export interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

// Fonction pour générer une clé unique par client
function defaultKeyGenerator(req: Request): string {
  // Utiliser l'IP + User-Agent pour identifier le client
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.header('User-Agent') || 'unknown';
  return `${ip}:${userAgent.substring(0, 50)}`;
}

// Middleware de rate limiting
export function createRateLimit(config: RateLimitConfig = {}) {
  const options = { ...DEFAULT_LIMITS, ...config };
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Nettoyer les entrées expirées périodiquement
    if (Math.random() < 0.01) { // 1% de chance à chaque requête
      cleanupExpiredEntries(now);
    }
    
    let rateLimit = rateLimitStore.get(key);
    
    // Initialiser ou réinitialiser si la fenêtre est expirée
    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimit = {
        count: 0,
        resetTime: now + options.windowMs
      };
      rateLimitStore.set(key, rateLimit);
    }
    
    // Incrémenter le compteur
    rateLimit.count++;
    
    // Ajouter les headers de rate limit
    const remaining = Math.max(0, options.maxRequests - rateLimit.count);
    const resetTime = Math.ceil((rateLimit.resetTime - now) / 1000);
    
    res.set({
      'X-RateLimit-Limit': options.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
      'X-RateLimit-Reset-Seconds': resetTime.toString()
    });
    
    // Vérifier si la limite est dépassée
    if (rateLimit.count > options.maxRequests) {
      logger.warn(`Rate limit exceeded for key: ${key}`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        count: rateLimit.count,
        limit: options.maxRequests
      });
      
      // Callback personnalisé si défini
      if (options.onLimitReached) {
        options.onLimitReached(req, res);
        return;
      }
      
      // Réponse par défaut
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
        details: {
          limit: options.maxRequests,
          windowMs: options.windowMs,
          remaining: 0,
          resetTime: new Date(rateLimit.resetTime).toISOString()
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    next();
  };
}

// Fonction pour nettoyer les entrées expirées
function cleanupExpiredEntries(now: number): void {
  const keysToDelete: string[] = [];
  
  for (const [key, rateLimit] of rateLimitStore.entries()) {
    if (now > rateLimit.resetTime) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => rateLimitStore.delete(key));
  
  if (keysToDelete.length > 0) {
    logger.debug(`Cleaned up ${keysToDelete.length} expired rate limit entries`);
  }
}

// Configurations prédéfinies pour différents types d'endpoints
export const rateLimits = {
  // Endpoints publics (plus restrictifs)
  public: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50            // 50 requêtes par 15 min
  }),
  
  // Endpoints API authentifiés (modérés)
  api: createRateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 200          // 200 requêtes par 10 min
  }),
  
  // Endpoints admin (plus permissifs)
  admin: createRateLimit({
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 500          // 500 requêtes par 5 min
  }),
  
  // Webhooks (très permissifs)
  webhook: createRateLimit({
    windowMs: 1 * 60 * 1000,  // 1 minute
    maxRequests: 1000         // 1000 requêtes par minute
  }),
  
  // Endpoints de lecture intensive (modérés)
  read: createRateLimit({
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 300          // 300 requêtes par 5 min
  }),
  
  // Endpoints d'écriture (plus restrictifs)
  write: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100          // 100 requêtes par 15 min
  })
};

// Utilitaire pour obtenir les statistiques de rate limiting
export function getRateLimitStats(): {
  totalKeys: number;
  entries: Array<{ key: string; count: number; resetTime: string }>;
} {
  const entries = Array.from(rateLimitStore.entries()).map(([key, rateLimit]) => ({
    key: key.length > 50 ? key.substring(0, 47) + '...' : key,
    count: rateLimit.count,
    resetTime: new Date(rateLimit.resetTime).toISOString()
  }));
  
  return {
    totalKeys: rateLimitStore.size,
    entries: entries.sort((a, b) => b.count - a.count) // Trier par count décroissant
  };
}

// Utilitaire pour réinitialiser tous les rate limits (admin seulement)
export function resetAllRateLimits(): number {
  const count = rateLimitStore.size;
  rateLimitStore.clear();
  logger.info(`Reset all rate limits: ${count} entries cleared`);
  return count;
}

// Middleware spécialisé pour les endpoints sensibles
export function sensitiveEndpointLimit(req: Request, res: Response, next: NextFunction): void {
  const restrictiveLimit = createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: 10,          // 10 requêtes par heure
    onLimitReached: (req, res) => {
      logger.warn(`Sensitive endpoint rate limit exceeded`, {
        ip: req.ip,
        path: req.path,
        userAgent: req.header('User-Agent')
      });
      
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for sensitive operation',
        message: 'This operation is rate limited. Please try again later.',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  restrictiveLimit(req, res, next);
}