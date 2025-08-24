// Middleware de validation pour les APIs
import { Request, Response, NextFunction } from 'express';
import { 
  validators, 
  sanitizeAndValidate, 
  logValidationError,
  isNonEmptyString,
  isValidUUID,
  isValidCurrencyCode
} from '../utils/typeGuards';
import { logger } from '../utils/logger';

// Interface pour les erreurs de validation
interface ValidationError {
  field: string;
  message: string;
  received: unknown;
  expected: string;
}

// Fonction pour créer des réponses d'erreur de validation standardisées
function createValidationErrorResponse(errors: ValidationError[]) {
  return {
    success: false,
    error: 'Validation Error',
    message: 'One or more fields failed validation',
    details: errors,
    timestamp: new Date().toISOString()
  };
}

// Middleware pour valider les paramètres d'URL
export function validateParams(validations: Record<string, (value: unknown) => boolean>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];
    
    for (const [paramName, validator] of Object.entries(validations)) {
      const paramValue = req.params[paramName];
      
      if (!validator(paramValue)) {
        errors.push({
          field: `params.${paramName}`,
          message: `Invalid parameter value`,
          received: paramValue,
          expected: 'Valid parameter according to validator'
        });
        
        logValidationError(
          `params.${paramName}`, 
          paramValue, 
          'valid parameter',
          `${req.method} ${req.path}`
        );
      }
    }
    
    if (errors.length > 0) {
      res.status(400).json(createValidationErrorResponse(errors));
      return;
    }
    
    next();
  };
}

// Middleware pour valider les query parameters
export function validateQuery(validations: Record<string, (value: unknown) => boolean>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];
    
    for (const [queryName, validator] of Object.entries(validations)) {
      const queryValue = req.query[queryName];
      
      // Skip validation si le paramètre est optionnel (undefined)
      if (queryValue !== undefined && !validator(queryValue)) {
        errors.push({
          field: `query.${queryName}`,
          message: `Invalid query parameter`,
          received: queryValue,
          expected: 'Valid query parameter according to validator'
        });
        
        logValidationError(
          `query.${queryName}`, 
          queryValue, 
          'valid query parameter',
          `${req.method} ${req.path}`
        );
      }
    }
    
    if (errors.length > 0) {
      res.status(400).json(createValidationErrorResponse(errors));
      return;
    }
    
    next();
  };
}

// Middleware pour valider le body des requêtes
export function validateBody<T>(validator: (obj: unknown) => obj is T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedBody = sanitizeAndValidate(req.body, validator, 'request body');
      req.body = validatedBody; // Remplacer le body par la version validée
      next();
    } catch (error) {
      logValidationError(
        'request body',
        req.body,
        'valid request body structure',
        `${req.method} ${req.path}`
      );
      
      res.status(400).json({
        success: false,
        error: 'Invalid Request Body',
        message: error instanceof Error ? error.message : 'Request body validation failed',
        received: typeof req.body,
        timestamp: new Date().toISOString()
      });
    }
  };
}

// Middleware pour valider les headers
export function validateHeaders(validations: Record<string, (value: unknown) => boolean>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];
    
    for (const [headerName, validator] of Object.entries(validations)) {
      const headerValue = req.header(headerName);
      
      if (!validator(headerValue)) {
        errors.push({
          field: `headers.${headerName}`,
          message: `Invalid or missing header`,
          received: headerValue,
          expected: 'Valid header value according to validator'
        });
        
        logValidationError(
          `headers.${headerName}`, 
          headerValue, 
          'valid header',
          `${req.method} ${req.path}`
        );
      }
    }
    
    if (errors.length > 0) {
      res.status(400).json(createValidationErrorResponse(errors));
      return;
    }
    
    next();
  };
}

// Middlewares pré-configurés pour des validations communes
export const commonValidators = {
  // Valider un UUID dans les paramètres
  uuidParam: (paramName: string) => validateParams({
    [paramName]: isValidUUID
  }),
  
  // Valider une devise dans les paramètres
  currencyParam: (paramName: string) => validateParams({
    [paramName]: isValidCurrencyCode
  }),
  
  // Valider les paramètres de pagination
  paginationQuery: validateQuery({
    page: (value) => {
      if (value === undefined) return true; // Optionnel
      const num = parseInt(value as string);
      return !isNaN(num) && num > 0;
    },
    limit: (value) => {
      if (value === undefined) return true; // Optionnel
      const num = parseInt(value as string);
      return !isNaN(num) && num > 0 && num <= 1000;
    }
  }),
  
  // Valider les headers d'API key
  apiKeyHeader: validateHeaders({
    'X-API-Key': (value) => isNonEmptyString(value)
  }),
  
  // Valider le content-type pour JSON
  jsonContentType: validateHeaders({
    'content-type': (value) => {
      if (!isNonEmptyString(value)) return false;
      return value.toLowerCase().includes('application/json');
    }
  }),
  
  // Valider les données webhook HubSpot
  hubspotWebhookBody: validateBody(validators.hubspotIncoming.webhookEvents),
  
  // Valider les paramètres de date
  dateRangeQuery: validateQuery({
    startDate: (value) => {
      if (value === undefined) return true;
      return validators.system.dateString(value);
    },
    endDate: (value) => {
      if (value === undefined) return true;
      return validators.system.dateString(value);
    }
  })
};

// Middleware pour valider et nettoyer les données financières
export function validateFinancialData(req: Request, res: Response, next: NextFunction): void {
  const errors: ValidationError[] = [];
  
  // Valider les montants dans le body
  if (req.body.amount !== undefined && !validators.financial.amount(req.body.amount)) {
    errors.push({
      field: 'body.amount',
      message: 'Invalid financial amount',
      received: req.body.amount,
      expected: 'Number between -1,000,000 and 1,000,000,000'
    });
  }
  
  if (req.body.taxRate !== undefined && !validators.financial.taxRate(req.body.taxRate)) {
    errors.push({
      field: 'body.taxRate',
      message: 'Invalid tax rate',
      received: req.body.taxRate,
      expected: 'Number between 0 and 100'
    });
  }
  
  if (req.body.currency !== undefined && !validators.financial.currency(req.body.currency)) {
    errors.push({
      field: 'body.currency',
      message: 'Invalid currency code',
      received: req.body.currency,
      expected: '3-letter uppercase currency code (e.g., USD, CAD, EUR)'
    });
  }
  
  if (errors.length > 0) {
    res.status(400).json(createValidationErrorResponse(errors));
    return;
  }
  
  next();
}

// Middleware pour log toutes les erreurs de validation
export function logValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Intercepter les réponses d'erreur de validation
    if (res.statusCode === 400 && typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error === 'Validation Error') {
          logger.warn('Validation error occurred', {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.header('User-Agent'),
            validationErrors: parsed.details
          });
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

// Fonction utilitaire pour créer des validateurs personnalisés
export function createValidationChain(...middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let currentIndex = 0;
    
    function runNext(): void {
      if (currentIndex >= middlewares.length) {
        next();
        return;
      }
      
      const currentMiddleware = middlewares[currentIndex++];
      currentMiddleware(req, res, runNext);
    }
    
    runNext();
  };
}

// Utilitaires pour des validations spécifiques aux endpoints
export const endpointValidators = {
  // Pour les endpoints d'extraction d'invoices
  invoiceExtraction: createValidationChain(
    commonValidators.paginationQuery,
    validateQuery({
      status: (value) => {
        if (value === undefined) return true;
        return ['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(value as string);
      },
      currency: (value) => {
        if (value === undefined) return true;
        return isValidCurrencyCode(value);
      }
    })
  ),
  
  // Pour les endpoints de webhook
  webhookReceiver: createValidationChain(
    validateHeaders({
      'content-type': (value) => isNonEmptyString(value) && value.includes('application/json')
    }),
    commonValidators.hubspotWebhookBody
  ),
  
  // Pour les endpoints d'analyse
  analysisEndpoint: createValidationChain(
    commonValidators.paginationQuery,
    commonValidators.dateRangeQuery
  )
};