import { Request, Response, NextFunction } from 'express';

// Interface pour le request avec utilisateur authentifié
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'api_key' | 'basic_auth';
    permissions?: string[];
  };
}

// Types génériques pour les API routes Express
export type ApiHandler = (req: Request, res: Response, next?: NextFunction) => void | Promise<void>;

export type ApiHandlerWithParams<TParams = {}> = (
  req: Request<TParams>, 
  res: Response, 
  next?: NextFunction
) => void | Promise<void>;

export type ApiHandlerWithQuery<TQuery = {}> = (
  req: Request<{}, {}, {}, TQuery>, 
  res: Response, 
  next?: NextFunction
) => void | Promise<void>;

export type ApiHandlerWithBody<TBody = {}> = (
  req: Request<{}, {}, TBody>, 
  res: Response, 
  next?: NextFunction
) => void | Promise<void>;

export type ApiHandlerFull<TParams = {}, TResBody = {}, TReqBody = {}, TQuery = {}> = (
  req: Request<TParams, TResBody, TReqBody, TQuery>, 
  res: Response<TResBody>, 
  next?: NextFunction
) => void | Promise<void>;

// Types pour les paramètres de requête courants
export interface PaginationQuery {
  page?: string;
  limit?: string;
  offset?: string;
}

export interface InvoiceQueryParams extends PaginationQuery {
  source?: 'database' | 'hubspot' | 'database-empty';
  status?: string;
  currency?: string;
  from_date?: string;
  to_date?: string;
}

// Types pour les paramètres de routes
export interface InvoiceParams {
  invoiceId: string;
}

export interface ContactParams {
  contactId: string;
}

export interface CompanyParams {
  companyId: string;
}

// Types pour les corps de requête
export interface ExtractInvoicesBody {
  source?: 'hubspot' | 'deals';
  limit?: number;
  includeAssociations?: boolean;
}

export interface WebhookTestBody {
  test?: string;
  eventType?: string;
  [key: string]: unknown;
}

// Types pour les réponses API standardisées
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Types pour HubSpot pagination
export interface HubSpotPaginationParams {
  limit?: number;
  after?: string;
  properties?: string;
  associations?: string;
  [key: string]: unknown;
}

// Types pour les erreurs d'API externe
export interface ExternalApiError extends Error {
  response?: {
    status: number;
    data?: unknown;
  };
  code?: string;
  status?: number;
}

// Type guard pour les erreurs d'API externe
export function isExternalApiError(error: unknown): error is ExternalApiError {
  return error instanceof Error && ('response' in error || 'code' in error || 'status' in error);
}

// Type guard pour vérifier si une erreur a une propriété response
export function hasResponseProperty(error: unknown): error is { response: { status: number } } {
  return typeof error === 'object' && error !== null && 'response' in error;
}

// Types pour les données d'invoice converties depuis HubSpot
export interface ConvertedInvoiceData {
  hubspotInvoiceId: string;
  hubspotObjectId: string;
  hubspotObjectType: string;
  totalAmount: number;
  subtotal: number;
  balanceDue: number;
  currency: string;
  status: import('@prisma/client').InvoiceStatus;
  dueDate?: Date;
  issueDate?: Date;
  description?: string;
  hubspotInvoiceNumber?: string;
  hubspotRawData: {
    properties: Record<string, unknown>;
    associations?: Record<string, unknown>;
  };
  hubspotCreatedAt?: Date;
  hubspotModifiedAt?: Date;
  syncSource: string;
}

// Types pour les données d'invoice enhanced avec line items
export interface EnhancedInvoiceData extends ConvertedInvoiceData {
  detectedCurrency?: string;
  lineItemsCount: number;
}

// Types pour les données de line item converties depuis HubSpot
export interface ConvertedLineItemData {
  hubspotLineItemId: string;
  productName?: string;
  hubspotProductId?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency?: string;
  discountAmount?: number | null;
  discountPercentage?: number | null;
  preDiscountAmount?: number | null;
  totalDiscount?: number | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxLabel?: string;
  taxCategory?: string;
  postTaxAmount?: number | null;
  externalTaxRateId?: string;
  hubspotRawData: {
    properties: Record<string, unknown>;
  };
  hubspotCreatedAt?: Date | null;
  hubspotUpdatedAt?: Date | null;
  lastSyncAt: Date;
}