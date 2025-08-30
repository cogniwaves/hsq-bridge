# Phase 8 Configuration Management - Docker Deployment Guide

This document outlines the comprehensive Docker configuration updates to support Phase 8 configuration management features for the HubSpot-Stripe-QuickBooks bridge system.

## 📋 Overview

Phase 8 introduces advanced configuration management capabilities requiring significant Docker infrastructure updates to support:

- **New Configuration Management API** endpoints at `/api/config/*`
- **Extended Database Schema** with 4 new tables for configuration storage
- **Enhanced Dashboard UI** with settings pages and configuration wizards
- **OAuth Flow Management** for secure third-party integrations
- **Real-time Health Monitoring** and configuration validation
- **Audit Logging** and compliance tracking
- **Encrypted Configuration Storage** with backup capabilities

## 🚀 Updated Docker Architecture

### Service Configuration Overview

```
┌─────────────────────────────────────────────────────────────┐
│                Phase 8 Enhanced Architecture                │
├─────────────────────────────────────────────────────────────┤
│ cw_hsq_nginx    (Enhanced Proxy)    :18080/18443           │
│ ├─ /api/config/*     (Config API Routes)                   │
│ ├─ /settings/*       (Settings UI Routes)                  │
│ ├─ OAuth Callbacks   (Secure OAuth Flow)                   │
│                                                             │
│ cw_hsq_app      (Enhanced API)      :13000                 │
│ ├─ Configuration Manager Service                            │
│ ├─ OAuth State Management (Redis)                          │
│ ├─ Encrypted Config Storage                                │
│ ├─ Health Monitoring & Validation                          │
│                                                             │
│ cw_hsq_dashboard (Enhanced UI)      :13001                 │
│ ├─ Settings Pages (/settings/*)                            │
│ ├─ Configuration Wizards                                   │
│ ├─ Health Dashboard                                        │
│ ├─ Audit Log Viewer                                        │
│                                                             │
│ cw_hsq_postgres (Enhanced Schema)   :15432                 │
│ ├─ integration_configs (New)                               │
│ ├─ webhook_configurations (New)                            │
│ ├─ configuration_audit_logs (New)                          │
│ ├─ Enhanced oauth_tokens                                   │
│                                                             │
│ cw_hsq_redis    (Enhanced Cache)    :16379                 │
│ ├─ OAuth State Storage                                     │
│ ├─ Configuration Cache                                     │
│ ├─ Circuit Breaker State                                   │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration Updates

### 1. Backend Application (cw_hsq_app)

#### New Environment Variables
```bash
# Phase 8 Configuration Management
ENCRYPTION_KEY=your-strong-encryption-key-32-chars-minimum
CONFIG_BACKUP_ENABLED=true
CONFIG_BACKUP_INTERVAL=3600
OAUTH_STATE_TTL=600
HEALTH_CHECK_INTERVAL=300
CIRCUIT_BREAKER_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90
CONFIGURATION_API_RATE_LIMIT=10
QUICKBOOKS_OAUTH_REDIRECT_URI=http://localhost:13001/api/config/quickbooks/callback
CONFIG_VALIDATION_TIMEOUT=30
```

#### Volume Mounts
- **Configuration Backups**: `cw_hsq_config_backups:/app/backups`
- Secure storage for configuration exports and backups

#### Enhanced Health Checks
- Added configuration health endpoint validation
- Extended timeout for comprehensive health checks
- Circuit breaker status monitoring

### 2. Dashboard Application (cw_hsq_dashboard)

#### New Environment Variables
```bash
# Phase 8 Dashboard Configuration UI
NEXT_PUBLIC_ENABLE_CONFIGURATION_UI=true
NEXT_PUBLIC_CONFIGURATION_API_BASE=http://localhost:13000/api/config
NEXT_PUBLIC_OAUTH_CALLBACK_BASE=http://localhost:13001
NEXT_PUBLIC_ENABLE_HEALTH_DASHBOARD=true
NEXT_PUBLIC_ENABLE_AUDIT_LOGS=true
NEXT_PUBLIC_MAX_FILE_UPLOAD_SIZE=10485760
NEXT_PUBLIC_CONFIGURATION_WIZARD_ENABLED=true
```

#### New Routes Support
- `/settings/*` - Configuration management pages
- `/configuration-advanced` - Advanced configuration features
- `/configuration-demo` - Configuration demonstration

### 3. Database (cw_hsq_postgres)

#### Enhanced Extensions
```sql
-- Phase 8 Configuration Management Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- For encryption functions
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- For enhanced indexing
```

#### Comprehensive Permissions
- Enhanced permissions for configuration tables
- Default privileges for future Phase 8 tables
- Encryption function access

### 4. Redis (cw_hsq_redis)

#### Enhanced Configuration
```bash
# Optimized for OAuth state and configuration caching
--maxmemory 256mb
--maxmemory-policy allkeys-lru
--appendonly yes
--save 300 10 60 1000
```

#### Resource Optimization
- Increased memory allocation for enhanced caching
- Persistence configuration for OAuth state
- LRU eviction policy for optimal performance

### 5. Nginx Proxy (cw_hsq_nginx)

#### New Rate Limiting Zones
```nginx
# Phase 8 Configuration Management Rate Limiting
limit_req_zone $binary_remote_addr zone=config:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=oauth:10m rate=2r/s;
```

#### Enhanced Security Routes
- **Configuration API Routes** (`/api/config/`) - Stricter rate limiting (5r/s)
- **OAuth Callback Routes** - Very strict rate limiting (2r/s)
- **Settings Pages** - Enhanced security headers
- **Configuration UI** - Additional security measures

#### Security Headers
```nginx
# Enhanced security for configuration endpoints
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options DENY;
add_header Referrer-Policy strict-origin-when-cross-origin;
add_header Cache-Control "no-cache, no-store, must-revalidate";  # OAuth routes
```

## 📦 New Docker Volumes

### Configuration Management Volumes
```yaml
volumes:
  cw_hsq_config_backups:   # Phase 8 configuration backup storage
```

## 🔍 Health Monitoring Enhancements

### Enhanced Health Checks

#### Backend Application
```bash
# Multi-endpoint health validation
curl -f http://localhost:3000/health && curl -f http://localhost:3000/api/config/health
```

#### Dashboard Application
```bash
# Dashboard and API health validation
curl -f http://localhost:3000 && curl -f http://localhost:3000/api/health
```

#### Nginx Proxy
```bash
# Proxy and configuration API validation
curl -f http://localhost/health && curl -f http://localhost/api/config/health
```

## 🛠️ Management Commands

### New Makefile Commands

#### Configuration Health Monitoring
```bash
make config-health      # Check configuration management health
make config-status      # Show all configuration status
make config-audit       # Show recent configuration audit logs
```

#### Configuration Testing
```bash
make test-config            # Run configuration management tests
make test-config-workflow   # Test full configuration workflow
```

#### Configuration Backup & Restore
```bash
make backup-config                           # Backup configuration data
make restore-config CONFIG_FILE=backup.json # Restore configuration
```

## 🧪 Testing & Validation

### Comprehensive Test Suite

The `scripts/test-config-workflow.sh` script validates:

1. **Docker Services Health** - All services running properly
2. **Phase 8 API Endpoints** - Configuration management API availability
3. **Redis Configuration Cache** - Proper caching setup
4. **Database Schema** - New Phase 8 tables existence
5. **Docker Volume Mounts** - Configuration backup storage
6. **Environment Variables** - All Phase 8 variables loaded
7. **Nginx Route Configuration** - Proxy routing for new features
8. **Configuration Features** - End-to-end workflow testing
9. **Resource Limits** - Proper Docker resource allocation
10. **Health Check Integration** - Enhanced monitoring validation

### Running Tests
```bash
# Test complete Phase 8 Docker setup
./scripts/test-config-workflow.sh

# Or via Makefile
make test-config-workflow
```

## 🚀 Deployment Instructions

### Development Deployment
```bash
# 1. Copy environment template
cp .env.phase8.example .env

# 2. Update environment variables
nano .env

# 3. Start services
make start

# 4. Verify Phase 8 features
make test-config-workflow
```

### Production Deployment
```bash
# 1. Set production environment variables
export ENCRYPTION_KEY_PRODUCTION="your-production-encryption-key"

# 2. Start in production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Verify deployment
make config-health
```

## 📊 Monitoring & Observability

### Key Endpoints for Monitoring

#### Configuration Management
- **Health**: `http://localhost:13000/api/config/health`
- **Status**: `http://localhost:13000/api/config/status`
- **Audit Logs**: `http://localhost:13000/api/config/audit`

#### Dashboard Access Points
- **Settings**: `http://localhost:13001/settings`
- **HubSpot Configuration**: `http://localhost:13001/settings/hubspot`
- **QuickBooks Setup**: `http://localhost:13001/settings/quickbooks`
- **Stripe Configuration**: `http://localhost:13001/settings/stripe`

#### Health Monitoring
```bash
# Basic health check
make health

# Detailed system health
make health-detailed

# Configuration-specific health
make config-health

# Complete status overview
make config-status
```

## 🔒 Security Considerations

### Enhanced Security Measures

1. **Encryption at Rest**
   - All sensitive configuration data encrypted with AES-256-GCM
   - Configurable encryption keys via environment variables

2. **OAuth Security**
   - Strict rate limiting on OAuth endpoints (2 requests/second)
   - Secure state management via Redis
   - No-cache headers on sensitive OAuth routes

3. **Configuration API Security**
   - Rate limiting on configuration endpoints (5 requests/second)
   - Enhanced security headers on all configuration routes
   - Audit logging for all configuration changes

4. **Network Security**
   - Enhanced Nginx security configurations
   - Strict CORS policies for configuration APIs
   - Referrer policy enforcement

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Configuration API Not Available
```bash
# Check service health
make health

# Check configuration-specific health
make config-health

# Check service logs
make logs-app
```

#### OAuth Flows Not Working
```bash
# Check Redis connectivity
make redis-cli
# Run: PING

# Check OAuth state storage
# Run: KEYS oauth:*

# Verify environment variables
docker compose exec cw_hsq_app printenv | grep OAUTH
```

#### Settings Pages Not Loading
```bash
# Check dashboard health
curl http://localhost:13001/api/health

# Check Nginx routing
curl http://localhost:18080/settings

# Check dashboard logs
make logs-dashboard
```

#### Database Schema Issues
```bash
# Check Phase 8 tables
make db-shell
# Run: \\dt integration_configs

# Run migrations if needed
docker compose exec cw_hsq_app npm run db:migrate
```

## 📈 Performance Optimization

### Resource Allocation

#### Production Optimizations
- **Application**: 1GB memory, 2 CPU cores
- **Dashboard**: 512MB memory, 1 CPU core  
- **Database**: 2GB memory, 2 CPU cores, optimized PostgreSQL settings
- **Redis**: 512MB memory, 1 CPU core, enhanced caching
- **Nginx**: 128MB memory, 0.5 CPU core

#### Database Performance
- Enhanced PostgreSQL configuration for configuration tables
- Optimized connection pooling
- Efficient indexing for audit logs

#### Redis Performance  
- Optimized memory allocation (512MB production)
- LRU eviction policy for OAuth states
- Persistence configuration for reliability

## 🔄 Migration Guide

### Upgrading from Previous Phases

1. **Update Docker Configuration**
   ```bash
   # Pull latest configuration
   git pull origin main
   
   # Update environment variables
   cp .env.phase8.example .env
   # Edit .env with your values
   ```

2. **Database Migration**
   ```bash
   # Run Phase 8 database migrations
   docker compose exec cw_hsq_app npm run db:migrate
   ```

3. **Rebuild Services**
   ```bash
   # Rebuild with new configuration
   make clean
   make build
   make start
   ```

4. **Verify Phase 8 Features**
   ```bash
   # Test complete Phase 8 setup
   make test-config-workflow
   ```

## 📚 Related Documentation

- **Configuration Management Schema**: `cw_app/docs/CONFIGURATION_MANAGEMENT_SCHEMA.md`
- **API Documentation**: Available at `http://localhost:13000/api`
- **Dashboard User Guide**: Settings pages include built-in help
- **Security Guide**: Enhanced security configurations documented

## 🎯 Next Steps

With Phase 8 Docker configuration complete, you can:

1. **Deploy Configuration Management** - Start using the new configuration features
2. **Set Up OAuth Integrations** - Configure HubSpot, QuickBooks, and Stripe
3. **Monitor Configuration Health** - Use new health monitoring capabilities
4. **Backup Configurations** - Implement configuration backup workflows
5. **Audit Configuration Changes** - Track all configuration modifications

The Phase 8 Docker deployment provides a robust, secure, and scalable foundation for advanced configuration management in the HubSpot-Stripe-QuickBooks bridge system.