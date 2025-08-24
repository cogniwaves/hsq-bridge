# QuickBooks OAuth Token Refresh Implementation

## Overview

This document describes the comprehensive QuickBooks OAuth token refresh system implemented for the HSQ Bridge application. The system provides automatic token refresh, secure storage, monitoring, and error handling with enterprise-grade reliability.

## Architecture Components

### 1. Token Storage (`src/services/auth/tokenStorage.ts`)
- **Database Storage**: Encrypted token storage in PostgreSQL
- **Redis Caching**: Optional caching layer for performance
- **Encryption**: AES-256-GCM encryption for tokens at rest
- **Multi-tenant Support**: Tenant-isolated token storage

### 2. Token Manager (`src/services/auth/tokenManager.ts`)
- **Automatic Refresh**: Proactive token refresh 30 minutes before expiry
- **Circuit Breaker**: Protection against repeated failures
- **Event System**: Real-time notifications for token events
- **Retry Logic**: Exponential backoff with jitter for failed refreshes
- **Deduplication**: Prevents concurrent refresh attempts

### 3. Refresh Scheduler (`src/services/auth/refreshScheduler.ts`)
- **Background Processing**: Bull queue for async token refresh
- **Job Scheduling**: Automatic scheduling based on token expiry
- **Health Monitoring**: Periodic checks for token health
- **Priority Queue**: High-priority refresh for expiring tokens

### 4. Enhanced QuickBooks Service (`src/services/quickbooksEnhancedService.ts`)
- **Automatic Token Injection**: Fresh tokens for every API call
- **Request Retry**: Automatic retry on authentication failures
- **Rate Limiting**: Built-in QuickBooks API rate limit handling
- **Request Deduplication**: Prevents duplicate API calls

### 5. Crypto Utils (`src/utils/crypto.ts`)
- **Token Encryption**: Secure encryption/decryption utilities
- **Token Masking**: Safe token logging without exposure
- **Token Validation**: Format validation for tokens
- **Key Derivation**: PBKDF2 for encryption key generation

## Database Schema

### OAuth Token Table
```sql
-- Stores encrypted OAuth tokens
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY,
  provider VARCHAR(50),
  tenant_id VARCHAR(100),
  access_token TEXT, -- Encrypted
  refresh_token TEXT, -- Encrypted
  expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  realm_id VARCHAR(100),
  company_id VARCHAR(100),
  last_refreshed_at TIMESTAMP,
  refresh_count INTEGER DEFAULT 0,
  failed_refresh_count INTEGER DEFAULT 0,
  last_refresh_error TEXT,
  encryption_iv VARCHAR(255),
  UNIQUE(provider, tenant_id)
);
```

### Token Refresh Log Table
```sql
-- Audit trail for token refresh attempts
CREATE TABLE token_refresh_logs (
  id UUID PRIMARY KEY,
  token_id VARCHAR(255),
  provider VARCHAR(50),
  tenant_id VARCHAR(100),
  refresh_type VARCHAR(50),
  status VARCHAR(20),
  attempted_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT,
  retry_attempt INTEGER
);
```

## API Endpoints

### Token Management Routes (`/api/tokens`)

#### Get Token Status
```http
GET /api/tokens/status
Authorization: X-API-Key: your-api-key

Response:
{
  "tokens": [{
    "provider": "quickbooks",
    "tenantId": "default",
    "expiresAt": "2024-08-24T15:30:00Z",
    "status": {
      "health": "healthy",
      "timeUntilExpiryMinutes": 45,
      "needsRefresh": false
    }
  }],
  "summary": {
    "total": 1,
    "healthy": 1,
    "warning": 0,
    "expired": 0
  }
}
```

#### Manual Token Refresh
```http
POST /api/tokens/refresh/quickbooks
Authorization: X-API-Key: your-api-key
Content-Type: application/json

{
  "tenantId": "default"
}

Response:
{
  "success": true,
  "provider": "quickbooks",
  "refreshed": true,
  "expiresAt": "2024-08-24T16:30:00Z"
}
```

#### Get Refresh History
```http
GET /api/tokens/history/quickbooks?limit=10
Authorization: X-API-Key: your-api-key

Response:
{
  "provider": "quickbooks",
  "history": [...],
  "stats": {
    "totalAttempts": 50,
    "successful": 48,
    "failed": 2,
    "averageDuration": 1250
  }
}
```

#### Token Management Health
```http
GET /api/tokens/health
Authorization: X-API-Key: your-api-key

Response:
{
  "status": "healthy",
  "scheduler": {
    "initialized": true,
    "status": "running"
  },
  "storage": {
    "database": "connected",
    "redis": "connected"
  },
  "tokens": {
    "total": 1,
    "healthy": 1,
    "expiring": 0,
    "expired": 0
  }
}
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Encryption Configuration
ENCRYPTION_MASTER_KEY=your-32-character-minimum-master-key
ENCRYPTION_SALT=your-custom-salt-for-key-derivation

# QuickBooks OAuth (keep these, remove tokens)
QUICKBOOKS_CLIENT_ID=your-client-id
QUICKBOOKS_CLIENT_SECRET=your-client-secret
QUICKBOOKS_COMPANY_ID=your-company-id
QUICKBOOKS_SANDBOX_BASE_URL=https://sandbox-quickbooks.api.intuit.com

# Remove these after migration
# QUICKBOOKS_ACCESS_TOKEN=xxx
# QUICKBOOKS_REFRESH_TOKEN=xxx
```

### Token Refresh Configuration

```typescript
const refreshConfig: TokenRefreshConfig = {
  provider: 'quickbooks',
  tenantId: 'default',
  clientId: process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
  tokenEndpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  refreshBeforeExpiry: 30, // minutes
  maxRetries: 3,
  retryDelay: 1000, // ms
  enableAutoRefresh: true,
  enableCircuitBreaker: true
};
```

## Migration Guide

### Step 1: Update Database Schema

Run Prisma migrations:
```bash
npx prisma migrate dev --name add-oauth-tokens
npx prisma generate
```

### Step 2: Migrate Existing Tokens

Run the migration script:
```bash
npm run migrate:tokens
# or
ts-node src/scripts/migrateTokens.ts
```

### Step 3: Update Service Usage

Replace old service:
```typescript
// Old
import { quickbooksService } from './services/quickbooksService';

// New
import { getQuickBooksEnhancedService } from './services/quickbooksEnhancedService';

const qbService = getQuickBooksEnhancedService(prisma, redis);
```

### Step 4: Remove Token Environment Variables

After successful migration, remove from `.env`:
- `QUICKBOOKS_ACCESS_TOKEN`
- `QUICKBOOKS_REFRESH_TOKEN`

## Security Features

### Token Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **IV**: Unique per token
- **Authentication Tag**: Ensures data integrity

### Access Control
- **API Key Authentication**: Required for all token management endpoints
- **Permission-based Access**: Write permissions required for token operations
- **Tenant Isolation**: Tokens isolated per tenant in multi-tenant setup

### Audit Trail
- **Refresh Logging**: Every refresh attempt is logged
- **Error Tracking**: Failed attempts with error details
- **Metrics Collection**: Success/failure rates, duration tracking

## Monitoring & Observability

### Events

The system emits the following events:

```typescript
enum TokenManagerEvents {
  TOKEN_REFRESHED = 'token:refreshed',
  TOKEN_REFRESH_FAILED = 'token:refresh:failed',
  TOKEN_EXPIRED = 'token:expired',
  TOKEN_NEAR_EXPIRY = 'token:near:expiry',
  CIRCUIT_BREAKER_OPEN = 'circuit:breaker:open',
  CIRCUIT_BREAKER_CLOSED = 'circuit:breaker:closed'
}
```

### Metrics

Track these key metrics:
- Token refresh success rate
- Average refresh duration
- Failed refresh count
- Time until token expiry
- Circuit breaker status

### Health Checks

Periodic checks for:
- Token expiry status
- Failed refresh counts
- Queue job status
- Storage connectivity

## Error Handling

### Retry Strategy
- **Exponential Backoff**: 2^attempt * 1000ms base delay
- **Jitter**: Random 0-1000ms added to prevent thundering herd
- **Max Retries**: Configurable, default 3
- **Circuit Breaker**: Opens after 3 consecutive failures

### Error Recovery
1. **Authentication Errors**: Automatic token refresh and retry
2. **Network Errors**: Exponential backoff retry
3. **Rate Limiting**: Respect retry-after header
4. **Token Expiry**: Proactive refresh before expiry

## Best Practices

### Development
1. Use sandbox environment for testing
2. Enable debug logging for troubleshooting
3. Test token refresh manually before relying on automation
4. Monitor refresh logs during initial deployment

### Production
1. Set up alerts for failed refreshes
2. Monitor token expiry closely
3. Keep refresh buffer at 30+ minutes
4. Implement redundant refresh scheduling
5. Regular backup of refresh tokens

### Security
1. Never log full token values
2. Rotate encryption keys periodically
3. Use separate tokens per environment
4. Implement token rotation on refresh
5. Monitor for suspicious refresh patterns

## Troubleshooting

### Common Issues

#### Token Refresh Fails
```bash
# Check token status
curl -X GET http://localhost:3000/api/tokens/status \
  -H "X-API-Key: your-api-key"

# View refresh history
curl -X GET http://localhost:3000/api/tokens/history/quickbooks \
  -H "X-API-Key: your-api-key"

# Manually trigger refresh
curl -X POST http://localhost:3000/api/tokens/refresh/quickbooks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "default"}'
```

#### Circuit Breaker Open
- Wait for reset timeout (60 seconds)
- Check error logs for root cause
- Verify QuickBooks API status
- Check client credentials

#### Encryption Errors
- Verify encryption key configuration
- Check database connectivity
- Ensure encryption IV is stored correctly

## Testing

### Unit Tests
```typescript
describe('TokenManager', () => {
  it('should refresh token before expiry', async () => {
    // Test implementation
  });
  
  it('should handle refresh failures with retry', async () => {
    // Test implementation
  });
  
  it('should prevent concurrent refreshes', async () => {
    // Test implementation
  });
});
```

### Integration Tests
```typescript
describe('QuickBooks OAuth Flow', () => {
  it('should complete full OAuth flow', async () => {
    // Test implementation
  });
  
  it('should automatically refresh expired token', async () => {
    // Test implementation
  });
});
```

### Load Tests
- Test concurrent API calls with token refresh
- Verify rate limiting behavior
- Test circuit breaker under load

## Support

For issues or questions:
1. Check the troubleshooting guide above
2. Review logs in `logs/` directory
3. Check QuickBooks API status
4. Contact support with error logs and token status

## License

This implementation is part of the HSQ Bridge application and follows the same licensing terms.