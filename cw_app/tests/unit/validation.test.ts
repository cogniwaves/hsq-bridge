import {
  uuidSchema,
  emailSchema,
  amountSchema,
  paginationSchema,
  invoiceQuerySchema,
  paymentAllocationSchema,
  validateSchema
} from '../../src/utils/validation';
import { mockRequest, mockResponse, mockNext } from '../setup';

describe('Validation Utilities', () => {
  describe('Basic Schemas', () => {
    describe('uuidSchema', () => {
      it('should validate valid UUID', () => {
        const validUuid = '123e4567-e89b-12d3-a456-426614174000';
        const result = uuidSchema.parse(validUuid);
        expect(result).toBe(validUuid);
      });

      it('should reject invalid UUID', () => {
        expect(() => uuidSchema.parse('invalid-uuid')).toThrow();
        expect(() => uuidSchema.parse('123')).toThrow();
        expect(() => uuidSchema.parse('')).toThrow();
      });
    });

    describe('emailSchema', () => {
      it('should validate valid email', () => {
        const validEmail = 'test@example.com';
        const result = emailSchema.parse(validEmail);
        expect(result).toBe(validEmail);
      });

      it('should reject invalid email', () => {
        expect(() => emailSchema.parse('invalid-email')).toThrow();
        expect(() => emailSchema.parse('test@')).toThrow();
        expect(() => emailSchema.parse('@example.com')).toThrow();
      });
    });

    describe('amountSchema', () => {
      it('should validate positive amounts', () => {
        expect(amountSchema.parse(100)).toBe(100);
        expect(amountSchema.parse(0.01)).toBe(0.01);
        expect(amountSchema.parse(999999.99)).toBe(999999.99);
      });

      it('should reject negative or zero amounts', () => {
        expect(() => amountSchema.parse(0)).toThrow();
        expect(() => amountSchema.parse(-100)).toThrow();
        expect(() => amountSchema.parse(-0.01)).toThrow();
      });
    });
  });

  describe('Complex Schemas', () => {
    describe('paginationSchema', () => {
      it('should parse valid pagination parameters', () => {
        const result = paginationSchema.parse({ page: '2', limit: '50' });
        expect(result).toEqual({ page: 2, limit: 50 });
      });

      it('should use default values', () => {
        const result = paginationSchema.parse({});
        expect(result).toEqual({ page: 1, limit: 20 });
      });

      it('should reject invalid pagination parameters', () => {
        expect(() => paginationSchema.parse({ page: '0' })).toThrow();
        expect(() => paginationSchema.parse({ limit: '101' })).toThrow();
        expect(() => paginationSchema.parse({ page: 'invalid' })).toThrow();
      });
    });

    describe('invoiceQuerySchema', () => {
      it('should parse valid invoice query parameters', () => {
        const query = {
          page: '2',
          limit: '10',
          status: 'PAID',
          clientEmail: 'test@example.com'
        };

        const result = invoiceQuerySchema.parse(query);
        expect(result).toEqual({
          page: 2,
          limit: 10,
          status: 'PAID',
          clientEmail: 'test@example.com'
        });
      });

      it('should reject invalid status values', () => {
        expect(() => invoiceQuerySchema.parse({ status: 'INVALID_STATUS' })).toThrow();
      });
    });

    describe('paymentAllocationSchema', () => {
      it('should parse valid allocation data', () => {
        const data = {
          invoiceId: '123e4567-e89b-12d3-a456-426614174000',
          amount: 100.50
        };

        const result = paymentAllocationSchema.parse(data);
        expect(result).toEqual(data);
      });

      it('should reject invalid allocation data', () => {
        expect(() => paymentAllocationSchema.parse({
          invoiceId: 'invalid-uuid',
          amount: 100
        })).toThrow();

        expect(() => paymentAllocationSchema.parse({
          invoiceId: '123e4567-e89b-12d3-a456-426614174000',
          amount: -100
        })).toThrow();
      });
    });
  });

  describe('validateSchema Middleware', () => {
    const testSchema = paginationSchema;

    it('should validate and transform request data', () => {
      const req = mockRequest({
        query: { page: '2', limit: '10' }
      });
      const res = mockResponse();
      const next = mockNext;

      const middleware = validateSchema(testSchema);
      middleware(req, res, next);

      expect(req.query.page).toBe(2);
      expect(req.query.limit).toBe(10);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return validation error for invalid data', () => {
      const req = mockRequest({
        query: { page: 'invalid' }
      });
      const res = mockResponse();
      const next = mockNext;

      const middleware = validateSchema(testSchema);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
            message: expect.any(String),
            code: expect.any(String)
          })
        ])
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should merge validation results into request', () => {
      const req = mockRequest({
        body: { amount: 100 },
        query: { page: '1' },
        params: { id: 'test' }
      });
      const res = mockResponse();
      const next = mockNext;

      const middleware = validateSchema(testSchema);
      middleware(req, res, next);

      // Should preserve original data and add validated data
      expect(req.body.amount).toBe(100);
      expect(req.query.page).toBe(1);
      expect(req.params.id).toBe('test');
      expect(next).toHaveBeenCalledWith();
    });

    it('should pass through non-validation errors', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;
      const testError = new Error('Non-validation error');

      const middleware = validateSchema(testSchema);
      
      // Mock the schema parse to throw a non-ZodError
      jest.spyOn(testSchema, 'parse').mockImplementation(() => {
        throw testError;
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(testError);
    });
  });
});