# Configuration Management Schema Documentation

## Overview

This document describes the comprehensive configuration management system for QuickBooks, HubSpot, and Stripe integrations. The schema extensions provide a robust, secure, and auditable framework for managing integration configurations across multiple tenants.

## Schema Architecture

### Core Design Principles

1. **Multi-tenant Isolation**: All configurations are scoped by `tenant_id`
2. **Encryption at Rest**: Sensitive data (API keys, secrets) are encrypted using AES-256-GCM
3. **Audit Trail**: Complete history of all configuration changes
4. **Performance Optimization**: Strategic indexing for common query patterns
5. **Backward Compatibility**: Extensions don't break existing functionality

## Extended Tables

### 1. OAuth Tokens Table (Extended)

The `oauth_tokens` table has been extended with platform-specific fields:

#### New Fields

| Field | Type | Description |
|-------|------|-------------|
| `hubspot_portal_id` | VARCHAR(255) | HubSpot account portal ID |
| `hubspot_user_id` | VARCHAR(255) | HubSpot user identifier |
| `hubspot_app_id` | VARCHAR(255) | HubSpot application ID |
| `stripe_account_id` | VARCHAR(255) | Stripe connected account ID |
| `stripe_user_id` | VARCHAR(255) | Stripe user identifier |
| `stripe_livemode` | BOOLEAN | Whether Stripe is in live mode |
| `is_active` | BOOLEAN | Token active status |
| `revoked_at` | TIMESTAMP | When token was revoked |
| `revoked_by` | VARCHAR(255) | User who revoked the token |
| `revoked_reason` | TEXT | Reason for revocation |
| `encryption_key_version` | INTEGER | Version of encryption key used |
| `metadata` | JSONB | Additional provider-specific data |
| `created_by` | VARCHAR(255) | User who created the token |

#### New Indexes
- `idx_oauth_tokens_tenant_active`: (tenant_id, is_active)
- `idx_oauth_tokens_stripe_account`: (stripe_account_id)
- `idx_oauth_tokens_hubspot_portal`: (hubspot_portal_id)

### 2. Integration Configs Table (New)

Stores non-OAuth configuration data for platform integrations.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | VARCHAR(255) | Tenant identifier |
| `platform` | ENUM | HUBSPOT, STRIPE, QUICKBOOKS |
| `config_type` | ENUM | API_KEY, WEBHOOK, OAUTH, SETTINGS |
| `is_primary` | BOOLEAN | Primary config for the platform |
| `api_key` | TEXT | Encrypted API key |
| `api_secret` | TEXT | Encrypted API secret |
| `sync_interval` | INTEGER | Minutes between syncs |
| `sync_direction` | ENUM | INBOUND, OUTBOUND, BIDIRECTIONAL |
| `health_status` | ENUM | HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN |
| `features` | JSONB | Platform-specific feature toggles |
| `mapping_rules` | JSONB | Field mapping configuration |
| `filter_rules` | JSONB | Data filtering rules |
| `transform_rules` | JSONB | Data transformation rules |

#### Indexes
- Unique: (tenant_id, platform, config_type, environment)
- Performance: (tenant_id, platform, is_active)
- Health monitoring: (platform, health_status)
- Sync scheduling: (next_sync_at)

### 3. Webhook Configurations Table (New)

Manages webhook endpoints, signatures, and monitoring.

#### Key Features

- **Circuit Breaker Pattern**: Prevents cascading failures
- **Retry Configuration**: Exponential backoff with configurable limits
- **Event Filtering**: Subscribe to specific events with filters
- **Security**: Multiple authentication methods supported

#### Important Fields

| Field | Type | Description |
|-------|------|-------------|
| `webhook_type` | ENUM | INBOUND or OUTBOUND |
| `endpoint_url` | TEXT | Webhook endpoint URL |
| `signing_secret` | TEXT | Encrypted signing secret |
| `auth_type` | ENUM | NONE, SIGNATURE, BEARER, API_KEY, BASIC, CUSTOM |
| `subscribed_events` | JSONB | Array of event types |
| `circuit_breaker_status` | ENUM | CLOSED, OPEN, HALF_OPEN |
| `consecutive_failures` | INTEGER | Failure count for circuit breaker |
| `total_trigger_count` | INTEGER | Total webhook triggers |

#### Circuit Breaker Logic
```sql
-- Opens circuit after threshold failures
IF consecutive_failures >= circuit_breaker_threshold THEN
  circuit_breaker_status = 'OPEN'
  
-- Resets to half-open after timeout
IF status = 'OPEN' AND (NOW() - opened_at) > reset_after THEN
  circuit_breaker_status = 'HALF_OPEN'
```

### 4. Configuration Audit Logs Table (New)

Tracks all configuration changes for security and compliance.

#### Audit Features

- **Change Tracking**: Before/after values (masked for sensitive fields)
- **Risk Assessment**: Automatic risk level assignment
- **Review Workflow**: High-risk changes require review
- **Security Context**: IP address, user agent, session tracking

#### Risk Levels

| Level | Description | Examples |
|-------|-------------|----------|
| LOW | Normal configuration changes | Update sync interval |
| MEDIUM | Changes to sensitive settings | Modify API endpoint |
| HIGH | Critical security changes | Change API key |
| CRITICAL | Requires immediate review | Delete configuration |

## Query Patterns

### 1. Get Active Configuration for Platform

```sql
SELECT * FROM integration_configs
WHERE tenant_id = ? 
  AND platform = ?
  AND is_active = true
  AND is_primary = true
  AND deleted_at IS NULL;
```

### 2. Check Webhook Circuit Breaker Status

```sql
SELECT id, circuit_breaker_status, consecutive_failures
FROM webhook_configurations
WHERE tenant_id = ?
  AND platform = ?
  AND circuit_breaker_status != 'CLOSED';
```

### 3. Audit Trail for High-Risk Changes

```sql
SELECT * FROM configuration_audit_logs
WHERE tenant_id = ?
  AND risk_level IN ('HIGH', 'CRITICAL')
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

### 4. Pending Configuration Reviews

```sql
SELECT * FROM configuration_audit_logs
WHERE tenant_id = ?
  AND requires_review = true
  AND reviewed_at IS NULL
  AND risk_level >= 'HIGH';
```

## Security Considerations

### Encryption

All sensitive fields are encrypted using AES-256-GCM:

1. **Encrypted Fields**:
   - API keys and secrets
   - Webhook signing secrets
   - OAuth tokens (existing)
   - Authentication tokens

2. **Encryption Process**:
   ```typescript
   // Encryption
   const encrypted = encrypt(plaintext);
   store(encrypted.ciphertext, encrypted.iv);
   
   // Decryption
   const plaintext = decrypt(ciphertext, iv);
   ```

3. **Key Rotation**:
   - `encryption_key_version` tracks key version
   - Supports gradual migration to new keys
   - Old versions maintained for decryption

### Access Control

1. **Tenant Isolation**:
   - All queries must include tenant_id
   - Cross-tenant access prevented at database level
   - Unique constraints include tenant_id

2. **Audit Requirements**:
   - All modifications logged with performer identity
   - IP address and session tracking
   - Timestamp for all operations

## Migration Strategy

### Step 1: Apply Schema Extensions

```bash
# Run migration
psql -d $DATABASE_URL -f prisma/migrations/add_configuration_management.sql

# Verify migration
psql -d $DATABASE_URL -c "\d integration_configs"
```

### Step 2: Migrate Existing Data

```sql
-- Migrate existing OAuth tokens to new format
UPDATE oauth_tokens
SET 
  is_active = true,
  encryption_key_version = 1,
  metadata = '{}'::jsonb
WHERE is_active IS NULL;
```

### Step 3: Seed Initial Configurations

```bash
# Run seed script
npm run db:seed:config
```

### Rollback Procedure

```bash
# If rollback needed
psql -d $DATABASE_URL -f prisma/migrations/rollback_configuration_management.sql
```

## Performance Optimizations

### Index Strategy

1. **Primary Access Patterns**:
   - Tenant + Platform lookups: `(tenant_id, platform)`
   - Active configs: `(tenant_id, is_active)`
   - Health monitoring: `(platform, health_status)`

2. **Audit Performance**:
   - Time-based queries: `(created_at)`
   - Entity lookups: `(entity_type, entity_id)`
   - Risk filtering: `(risk_level, requires_review)`

3. **Webhook Optimization**:
   - Circuit breaker checks: `(circuit_breaker_status)`
   - Last trigger tracking: `(last_trigger_at)`

### Query Optimization Tips

1. **Use Partial Indexes**:
   ```sql
   CREATE INDEX idx_pending_reviews 
   ON configuration_audit_logs(tenant_id, risk_level)
   WHERE requires_review = true AND reviewed_at IS NULL;
   ```

2. **Leverage JSONB Indexes**:
   ```sql
   CREATE INDEX idx_features_gin 
   ON integration_configs USING gin(features);
   ```

3. **Partition Large Tables** (future):
   - Audit logs by month
   - Webhook events by tenant

## Monitoring and Maintenance

### Health Checks

```sql
-- Check unhealthy integrations
SELECT tenant_id, platform, health_status, health_message
FROM integration_configs
WHERE health_status IN ('DEGRADED', 'UNHEALTHY')
  AND is_active = true;
```

### Circuit Breaker Monitoring

```sql
-- Monitor circuit breaker states
SELECT 
  platform,
  COUNT(*) FILTER (WHERE circuit_breaker_status = 'OPEN') as open_circuits,
  COUNT(*) FILTER (WHERE circuit_breaker_status = 'HALF_OPEN') as half_open,
  AVG(consecutive_failures) as avg_failures
FROM webhook_configurations
WHERE is_active = true
GROUP BY platform;
```

### Audit Compliance

```sql
-- Daily audit summary
SELECT 
  DATE(created_at) as audit_date,
  entity_type,
  action,
  risk_level,
  COUNT(*) as count
FROM configuration_audit_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 4 DESC;
```

## Best Practices

1. **Always Use Transactions**: Configuration changes should be atomic
2. **Encrypt Before Storage**: Never store plaintext secrets
3. **Audit Everything**: All changes must create audit logs
4. **Validate Configurations**: Test connections before activation
5. **Monitor Health**: Regular health checks for all integrations
6. **Review High-Risk Changes**: Implement approval workflow
7. **Rotate Secrets Regularly**: Use encryption key versioning
8. **Test Circuit Breakers**: Ensure proper failure handling

## Future Enhancements

1. **Configuration Templates**: Pre-built configs for common scenarios
2. **Configuration Versioning**: Track configuration history
3. **Automated Remediation**: Self-healing for common issues
4. **Advanced Analytics**: Configuration performance metrics
5. **Multi-Region Support**: Geographic configuration distribution
6. **Secret Rotation Automation**: Automatic key/secret rotation
7. **Configuration as Code**: GitOps-style configuration management