import { z } from 'zod';

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format');
export const amountSchema = z.number().positive('Amount must be positive');
export const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);
export const dateSchema = z.string().datetime('Invalid date format');

// API request validation schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('20')
});

export const invoiceQuerySchema = z.object({
  ...paginationSchema.shape,
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
  platform: z.enum(['HUBSPOT', 'STRIPE', 'QUICKBOOKS']).optional(),
  clientEmail: emailSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional()
});

export const paymentQuerySchema = z.object({
  ...paginationSchema.shape,
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
  unallocated: z.string().transform(val => val === 'true').optional(),
  paymentMethod: z.enum(['STRIPE_CARD', 'STRIPE_BANK_TRANSFER', 'QUICKBOOKS_CHECK', 'QUICKBOOKS_CASH', 'QUICKBOOKS_CREDIT_CARD', 'QUICKBOOKS_BANK_TRANSFER', 'OTHER']).optional()
});

export const paymentAllocationSchema = z.object({
  invoiceId: uuidSchema,
  amount: amountSchema
});

export const syncTriggerSchema = z.object({
  platform: z.enum(['HUBSPOT', 'STRIPE', 'QUICKBOOKS']),
  entityType: z.enum(['INVOICE', 'PAYMENT']),
  entityId: uuidSchema.optional()
});

// Webhook validation schemas
export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.any())
  }),
  created: z.number()
});

export const hubspotWebhookSchema = z.array(z.object({
  subscriptionType: z.string(),
  objectId: z.number(),
  occurredAt: z.number(),
  portalId: z.number().optional(),
  propertyName: z.string().optional(),
  propertyValue: z.string().optional()
}));

export const quickbooksWebhookSchema = z.object({
  eventNotifications: z.array(z.object({
    realmId: z.string(),
    dataChangeEvent: z.object({
      entities: z.array(z.object({
        name: z.string(),
        id: z.string(),
        operation: z.enum(['Create', 'Update', 'Delete']),
        lastUpdated: z.string()
      }))
    })
  }))
});

// Business logic validation
export const invoiceCreateSchema = z.object({
  hubspotDealId: z.string().optional(),
  totalAmount: amountSchema,
  currency: currencySchema.default('USD'),
  clientEmail: emailSchema.optional(),
  clientName: z.string().min(1).optional(),
  dueDate: dateSchema.optional(),
  issueDate: dateSchema.default(() => new Date().toISOString()),
  description: z.string().optional()
});

export const paymentCreateSchema = z.object({
  stripePaymentId: z.string().optional(),
  quickbooksPaymentId: z.string().optional(),
  amount: amountSchema,
  currency: currencySchema.default('USD'),
  paymentMethod: z.enum(['STRIPE_CARD', 'STRIPE_BANK_TRANSFER', 'QUICKBOOKS_CHECK', 'QUICKBOOKS_CASH', 'QUICKBOOKS_CREDIT_CARD', 'QUICKBOOKS_BANK_TRANSFER', 'OTHER']),
  transactionDate: dateSchema.default(() => new Date().toISOString()),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Validation middleware helper
export function validateSchema<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse({
        ...req.body,
        ...req.query,
        ...req.params
      });
      
      // Merge validated data back to request
      Object.assign(req, {
        body: { ...req.body, ...validated },
        query: { ...req.query, ...validated },
        params: { ...req.params, ...validated }
      });
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      next(error);
    }
  };
}