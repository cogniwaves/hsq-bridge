# Multi-Tenant API Integration Guide

This guide explains how to integrate multi-tenant authentication and data isolation into existing API endpoints while maintaining backward compatibility.

## Architecture Overview

The multi-tenant system supports three authentication methods:

1. **JWT Bearer Token** (new): Full tenant context with data isolation
2. **API Key** (existing): Global access, no tenant isolation for backward compatibility  
3. **Basic Auth** (existing): Global access, no tenant isolation

## Key Components

### Authentication Routes

- **`/api/auth/*`** - User authentication (registration, login, logout, profile)
- **`/api/tenants/*`** - Tenant management (CRUD, member management, switching)
- **`/api/invitations/*`** - Team invitation system

### Middleware Stack

1. **`jwtAuth`** - JWT token validation and user context
2. **`flexibleAuth`** - Legacy API key/basic auth support
3. **`addTenantContext`** - Adds tenant context to requests
4. **`sanitizeTenantResponse`** - Removes tenant fields for API key users

### Tenant-Aware Request Types

```typescript
interface TenantAwareRequest extends AuthenticatedRequest, JWTAuthenticatedRequest {
  tenantContext?: {
    tenantId?: string;
    tenantSlug?: string;
    enforceIsolation: boolean;
    source: 'jwt' | 'api_key' | 'none';
  };
}
```

## Implementation Patterns

### 1. Basic Tenant-Aware Endpoint

```typescript
import { TenantAwareRequest, getTenantAwareQueryOptions } from '../middleware/tenantAware';

routerEndpoint.get('/endpoint', async (req: TenantAwareRequest, res: Response) => {
  const tenantId = req.tenantContext?.tenantId;
  const enforceIsolation = req.tenantContext?.enforceIsolation || false;

  // Build tenant-aware query
  const baseFilter = enforceIsolation && tenantId ? { tenantId } : {};
  
  const data = await prisma.someModel.findMany({
    where: baseFilter,
    // ... other options
  });

  res.json(createSuccessResponse(data));
});
```

### 2. Enhanced Tenant-Aware Endpoint

```typescript
import { 
  logTenantOperation, 
  TenantQueryFilter,
  sanitizeTenantResponse 
} from '../middleware/tenantAware';

routerEndpoint.get('/enhanced-endpoint',
  logTenantOperation('operation_name'), // Audit logging
  async (req: TenantAwareRequest, res: Response) => {
    const tenantId = req.tenantContext?.tenantId;
    const enforceIsolation = req.tenantContext?.enforceIsolation || false;

    // Use helper for complex queries
    const queryOptions = getTenantAwareQueryOptions(req, {
      orderBy: { createdAt: 'desc' },
      include: { relatedModel: true }
    });

    // Add specific tenant filtering
    if (enforceIsolation && tenantId) {
      queryOptions.where = TenantQueryFilter.addTenantFilter(
        queryOptions.where || {}, 
        tenantId
      );
    }

    const data = await prisma.someModel.findMany(queryOptions);

    // Transform response based on auth type
    const responseData = {
      items: data,
      // Only include tenant context for JWT users
      ...(req.tenantContext?.source === 'jwt' && {
        tenantContext: {
          tenantId,
          enforceIsolation,
        }
      })
    };

    res.json(createSuccessResponse(responseData));
  }
);
```

### 3. Resource Access Validation

```typescript
import { validateTenantAccess } from '../middleware/tenantAware';

routerEndpoint.get('/resource/:id',
  validateTenantAccess(async (req: TenantAwareRequest) => {
    // Return the tenant ID of the resource being accessed
    const resource = await prisma.someModel.findUnique({
      where: { id: req.params.id },
      select: { tenantId: true }
    });
    return resource?.tenantId || null;
  }),
  async (req: TenantAwareRequest, res: Response) => {
    // Access is pre-validated by middleware
    const resource = await prisma.someModel.findUnique({
      where: { id: req.params.id }
    });
    
    res.json(createSuccessResponse(resource));
  }
);
```

## Database Schema Requirements

### Existing Tables Enhancement

Add tenant relationships to existing tables:

```sql
-- Add tenant_id to existing tables
ALTER TABLE invoice_mapping ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payment_mapping ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE sync_log ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Create indexes for performance
CREATE INDEX idx_invoice_mapping_tenant_id ON invoice_mapping(tenant_id);
CREATE INDEX idx_payment_mapping_tenant_id ON payment_mapping(tenant_id);
CREATE INDEX idx_sync_log_tenant_id ON sync_log(tenant_id);
```

### Migration Strategy

1. **Phase 1**: Add nullable tenant_id columns
2. **Phase 2**: Populate tenant_id for existing data (default tenant)
3. **Phase 3**: Make tenant_id required for new records
4. **Phase 4**: Add foreign key constraints

## Authentication Flow Examples

### JWT Authentication (New Users)

```bash
# 1. Register user (creates default tenant)
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "tenantName": "My Company"
}

# 2. Use returned JWT token
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# 3. Access tenant-aware endpoints
GET /api/dashboard-v2/overview
# Returns data filtered to user's current tenant
```

### API Key Authentication (Existing Integration)

```bash
# Continue using existing API keys
X-API-Key: your-existing-api-key

# Access same endpoints (backward compatible)
GET /api/dashboard/overview
# Returns global data (no tenant filtering)
```

## Response Format Differences

### JWT Response (Tenant-Aware)
```json
{
  "success": true,
  "data": {
    "items": [...],
    "tenantContext": {
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "enforceIsolation": true
    }
  }
}
```

### API Key Response (Global)
```json
{
  "success": true,
  "data": {
    "items": [...]
    // No tenant context exposed
  }
}
```

## Security Considerations

### Data Isolation

- JWT users see only their tenant's data
- API key users see global data (existing behavior)
- Super admin users bypass tenant restrictions

### Access Control

- Tenant roles: OWNER, ADMIN, MEMBER
- Resource-level access validation
- Audit logging for sensitive operations

### Rate Limiting

- Per-user rate limits for JWT users
- Global rate limits for API key users
- Separate limits for different operation types

## Testing Strategy

### Unit Tests

```typescript
describe('Tenant-Aware Endpoint', () => {
  it('should filter data by tenant for JWT users', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);
    
    // Verify only tenant data is returned
    expect(response.body.data.tenantContext.tenantId).toBe(testTenantId);
  });

  it('should return global data for API key users', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .set('X-API-Key', apiKey)
      .expect(200);
    
    // Verify no tenant context in response
    expect(response.body.data.tenantContext).toBeUndefined();
  });
});
```

### Integration Tests

- Test tenant isolation across different users
- Verify API key backward compatibility
- Test tenant switching functionality
- Validate invitation flow

## Migration Checklist

When updating existing endpoints to be tenant-aware:

- [ ] Add `TenantAwareRequest` type to endpoint
- [ ] Import tenant-aware middleware
- [ ] Add tenant filtering to database queries
- [ ] Update response format conditionally
- [ ] Add tenant access validation if needed
- [ ] Update API documentation
- [ ] Add unit tests for both auth types
- [ ] Test backward compatibility with API keys

## Example: Converting Existing Route

### Before (API Key Only)
```typescript
routerEndpoint.get('/invoices', async (req: AuthenticatedRequest, res: Response) => {
  const invoices = await prisma.invoiceMapping.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  res.json({ success: true, data: invoices });
});
```

### After (Multi-Tenant)
```typescript
import { TenantAwareRequest, logTenantOperation } from '../middleware/tenantAware';

routerEndpoint.get('/invoices',
  logTenantOperation('list_invoices'),
  async (req: TenantAwareRequest, res: Response) => {
    const tenantId = req.tenantContext?.tenantId;
    const enforceIsolation = req.tenantContext?.enforceIsolation || false;

    const invoices = await prisma.invoiceMapping.findMany({
      where: enforceIsolation && tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(createSuccessResponse({
      invoices,
      ...(req.tenantContext?.source === 'jwt' && {
        tenantContext: { tenantId, enforceIsolation }
      })
    }));
  }
);
```

## Best Practices

1. **Always use type-safe requests** (`TenantAwareRequest`)
2. **Log tenant operations** for audit trails
3. **Validate tenant access** for sensitive resources
4. **Maintain backward compatibility** for API key users
5. **Use helper functions** for consistent query building
6. **Test both authentication methods** in every endpoint
7. **Document tenant-aware behavior** in API documentation

## Common Patterns

### Conditional Tenant Filtering
```typescript
const baseFilter = enforceIsolation && tenantId ? { tenantId } : {};
```

### Conditional Response Enhancement
```typescript
const responseData = {
  items: data,
  ...(req.tenantContext?.source === 'jwt' && {
    tenantContext: { tenantId, enforceIsolation }
  })
};
```

### Tenant Access Check
```typescript
if (!checkTenantAccess(req, resourceTenantId)) {
  return res.status(403).json(createErrorResponse('Access denied'));
}
```

This guide ensures consistent implementation of multi-tenant features while maintaining backward compatibility with existing integrations.