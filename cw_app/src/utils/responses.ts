// Utilitaires pour créer des réponses API standardisées

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
  timestamp: string;
}

/**
 * Crée une réponse de succès standardisée
 */
export function createSuccessResponse<T = any>(
  data: T, 
  message?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Crée une réponse d'erreur standardisée
 */
export function createErrorResponse(
  error: string,
  message?: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Crée une réponse paginée standardisée
 */
export interface PaginatedResponse<T = any> extends SuccessResponse<{
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {}

export function createPaginatedResponse<T = any>(
  items: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    },
    message,
    timestamp: new Date().toISOString()
  };
}