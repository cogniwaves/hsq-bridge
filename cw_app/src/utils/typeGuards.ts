// Type guards pour la validation des données externes
import { HubSpotInvoice, HubSpotContact, HubSpotCompany, HubSpotLineItem, HubSpotWebhookEvent } from '../types/hubspot';

// Type guard pour les strings non-vides
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Type guard pour les nombres valides
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

// Type guard pour les nombres positifs
export function isPositiveNumber(value: unknown): value is number {
  return isValidNumber(value) && value > 0;
}

// Type guard pour les dates valides
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

// Type guard pour les strings de date
export function isValidDateString(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const date = new Date(value);
  return isValidDate(date);
}

// Type guard pour les codes de devise
export function isValidCurrencyCode(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  return /^[A-Z]{3}$/.test(value);
}

// Type guard pour les emails
export function isValidEmail(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

// Type guard pour les URLs
export function isValidUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Type guard pour les UUIDs
export function isValidUUID(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// Type guard pour les objets avec propriétés requises
export function hasRequiredProperties<T extends Record<string, unknown>>(
  obj: unknown,
  requiredProps: (keyof T)[]
): obj is T {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const record = obj as Record<string, unknown>;
  return requiredProps.every(prop => prop in record);
}

// Type guard pour les propriétés d'invoice HubSpot
export function isValidHubSpotInvoiceProperties(obj: unknown): obj is Record<string, string | null> {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const record = obj as Record<string, unknown>;
  return Object.values(record).every(value => 
    value === null || typeof value === 'string'
  );
}

// Type guard pour les objets d'invoice HubSpot
export function isValidHubSpotInvoice(obj: unknown): obj is HubSpotInvoice {
  if (!hasRequiredProperties(obj, ['id', 'properties', 'createdAt', 'updatedAt', 'archived'])) {
    return false;
  }
  
  const invoice = obj as HubSpotInvoice;
  
  return (
    isNonEmptyString(invoice.id) &&
    isValidHubSpotInvoiceProperties(invoice.properties) &&
    isValidDateString(invoice.createdAt) &&
    isValidDateString(invoice.updatedAt) &&
    typeof invoice.archived === 'boolean'
  );
}

// Type guard pour les réponses d'API HubSpot
export function isValidHubSpotApiResponse<T>(
  obj: unknown,
  itemValidator: (item: unknown) => item is T
): obj is { results: T[]; paging?: { next?: { after: string } } } {
  if (!hasRequiredProperties(obj, ['results'])) return false;
  
  const response = obj as { results: unknown[]; paging?: unknown };
  
  if (!Array.isArray(response.results)) return false;
  
  // Valider chaque item dans les résultats
  if (!response.results.every(itemValidator)) return false;
  
  // Valider la pagination si présente
  if (response.paging !== undefined) {
    if (typeof response.paging !== 'object' || response.paging === null) return false;
    
    const paging = response.paging as Record<string, unknown>;
    if (paging.next !== undefined) {
      if (!hasRequiredProperties(paging.next, ['after']) || !isNonEmptyString((paging.next as any).after)) {
        return false;
      }
    }
  }
  
  return true;
}

// Type guard pour les événements webhook HubSpot
export function isValidHubSpotWebhookEvent(obj: unknown): obj is HubSpotWebhookEvent {
  if (!hasRequiredProperties(obj, [
    'eventId', 'subscriptionId', 'portalId', 'occurredAt', 
    'subscriptionType', 'attemptNumber', 'objectId', 'changeSource', 'eventType'
  ])) {
    return false;
  }
  
  const event = obj as HubSpotWebhookEvent;
  
  return (
    isNonEmptyString(event.eventId) &&
    isNonEmptyString(event.subscriptionId) &&
    isNonEmptyString(event.portalId) &&
    isValidNumber(event.occurredAt) &&
    isNonEmptyString(event.subscriptionType) &&
    isValidNumber(event.attemptNumber) &&
    isNonEmptyString(event.objectId) &&
    isNonEmptyString(event.changeSource) &&
    ['propertyChange', 'create', 'update', 'delete'].includes(event.eventType)
  );
}

// Type guard pour les arrays d'événements webhook
export function isValidHubSpotWebhookEventArray(obj: unknown): obj is HubSpotWebhookEvent[] {
  if (!Array.isArray(obj)) return false;
  return obj.every(isValidHubSpotWebhookEvent);
}

// Type guard pour les montants financiers
export function isValidFinancialAmount(value: unknown): value is number {
  if (!isValidNumber(value)) return false;
  
  // Vérifier que c'est un montant raisonnable (pas de milliards ou de valeurs négatives extrêmes)
  return value >= -1000000 && value <= 1000000000;
}

// Type guard pour les taux de taxe
export function isValidTaxRate(value: unknown): value is number {
  if (!isValidNumber(value)) return false;
  
  // Les taux de taxe doivent être entre 0% et 100%
  return value >= 0 && value <= 100;
}

// Type guard pour les codes de statut d'invoice
export function isValidInvoiceStatus(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  
  const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'voided'];
  return validStatuses.includes(value.toLowerCase());
}

// Fonction pour valider et nettoyer les données d'entrée
export function sanitizeAndValidate<T>(
  data: unknown,
  validator: (obj: unknown) => obj is T,
  fieldName: string = 'data'
): T {
  if (!validator(data)) {
    throw new Error(`Invalid ${fieldName}: does not match expected type structure`);
  }
  
  return data;
}

// Fonction pour valider un objet avec plusieurs validateurs
export function validateWithMultipleChecks<T>(
  data: unknown,
  checks: Array<{
    validator: (obj: unknown) => boolean;
    errorMessage: string;
  }>
): T {
  for (const check of checks) {
    if (!check.validator(data)) {
      throw new Error(check.errorMessage);
    }
  }
  
  return data as T;
}

// Type guard pour les réponses d'erreur d'API externe
export function isApiErrorResponse(obj: unknown): obj is {
  status: number;
  message: string;
  category?: string;
  correlationId?: string;
} {
  if (!hasRequiredProperties(obj, ['status', 'message'])) return false;
  
  const error = obj as any;
  return (
    isValidNumber(error.status) &&
    error.status >= 400 &&
    error.status < 600 &&
    isNonEmptyString(error.message)
  );
}

// Fonction pour créer des validateurs personnalisés
export function createCustomValidator<T>(
  baseValidator: (obj: unknown) => obj is T,
  additionalChecks: Array<(obj: T) => boolean>,
  errorMessage: string = 'Custom validation failed'
) {
  return (obj: unknown): obj is T => {
    if (!baseValidator(obj)) return false;
    return additionalChecks.every(check => check(obj));
  };
}

// Validateurs spécialisés pour différents contextes
export const validators = {
  // Validateur pour les données HubSpot incoming
  hubspotIncoming: {
    invoice: (obj: unknown): obj is HubSpotInvoice => {
      return isValidHubSpotInvoice(obj);
    },
    
    invoiceList: (obj: unknown): obj is { results: HubSpotInvoice[] } => {
      return isValidHubSpotApiResponse(obj, isValidHubSpotInvoice);
    },
    
    webhookEvent: (obj: unknown): obj is HubSpotWebhookEvent => {
      return isValidHubSpotWebhookEvent(obj);
    },
    
    webhookEvents: (obj: unknown): obj is HubSpotWebhookEvent[] => {
      return isValidHubSpotWebhookEventArray(obj);
    }
  },
  
  // Validateur pour les données financières
  financial: {
    amount: isValidFinancialAmount,
    taxRate: isValidTaxRate,
    currency: isValidCurrencyCode
  },
  
  // Validateur pour les données système
  system: {
    uuid: isValidUUID,
    email: isValidEmail,
    url: isValidUrl,
    date: isValidDate,
    dateString: isValidDateString
  }
};

// Fonction utilitaire pour log les erreurs de validation
export function logValidationError(
  fieldName: string, 
  receivedValue: unknown, 
  expectedType: string,
  context?: string
): void {
  console.error(`Validation Error: ${fieldName}`, {
    field: fieldName,
    received: typeof receivedValue,
    expected: expectedType,
    value: receivedValue,
    context: context || 'unknown'
  });
}