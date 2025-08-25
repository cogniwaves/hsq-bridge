# HubSpot-Stripe-QuickBooks Bridge - Docker Setup Documentation

## Overview (Updated August 25, 2025)

This project uses Docker and Docker Compose to orchestrate a complete microservices architecture for the HubSpot-Stripe-QuickBooks bridge. All services use the `cw_hsq_` prefix for clear identification and conflict avoidance.

**Current Status**: All 5 services operational with recently rebuilt Docker images (August 25, 2025). Both cw_hsq_app and cw_hsq_dashboard containers have been completely rebuilt with no-cache builds for optimal performance and latest dependencies.

## Architecture

### Service Components
- **cw_hsq_app**: Main API application (Node.js/TypeScript + Prisma)
- **cw_hsq_dashboard**: Web dashboard (Next.js 13.5.11 with Material Design 3 theme)
- **cw_hsq_postgres**: Database (PostgreSQL 15)
- **cw_hsq_redis**: Cache and job queue (Redis 7)
- **cw_hsq_nginx**: Reverse proxy and load balancer (Nginx Alpine)

### Network Architecture
- **Network**: `cw_hsq_network` (bridge driver)
- **Internal Communication**: Services communicate via container names on standard ports
- **External Access**: Mapped to non-conflicting ports for host access

## Port Configuration

### External Port Mapping (Host Access)
- **API Server**: `http://localhost:13000` → `cw_hsq_app:3000`
- **Dashboard**: `http://localhost:13001` → `cw_hsq_dashboard:3000`
- **Nginx Proxy**: `http://localhost:18080` → `cw_hsq_nginx:80`
- **Nginx HTTPS**: `https://localhost:18443` → `cw_hsq_nginx:443`
- **PostgreSQL**: `localhost:15432` → `cw_hsq_postgres:5432`
- **Redis**: `localhost:16379` → `cw_hsq_redis:6379`

### Internal Communication
- `cw_hsq_app:3000` - API application
- `cw_hsq_dashboard:3000` - Dashboard application
- `cw_hsq_postgres:5432` - Database
- `cw_hsq_redis:6379` - Cache/Queue
- `cw_hsq_nginx:80/443` - Reverse proxy

## Quick Start

### Development Mode
```bash
# Start all services
make start
# or
./scripts/start-all.sh

# Check status
make status
docker compose ps

# View logs
make logs
make logs-app
```

### Production Mode
```bash
# Build and start in production mode
make prod-build
make prod-start

# Or manually
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Health Monitoring

All services include comprehensive health checks:

### Health Check Endpoints
- **API**: `http://localhost:13000/health`
- **Dashboard**: `http://localhost:13001`
- **Dashboard Health**: `http://localhost:13001/api/health`
- **Detailed Health**: `http://localhost:13000/health/detailed`
- **Metrics**: `http://localhost:13000/api/metrics`

### Container Health Status
```bash
# Check all container health
docker compose ps

# Individual service health
docker inspect cw_hsq_app --format='{{.State.Health.Status}}'
docker inspect cw_hsq_dashboard --format='{{.State.Health.Status}}'
docker inspect cw_hsq_postgres --format='{{.State.Health.Status}}'
```

## Resource Management

### Memory and CPU Limits
- **cw_hsq_app**: 512MB RAM, 1 CPU (development) / 1GB RAM, 2 CPU (production)
- **cw_hsq_dashboard**: 256MB RAM, 0.5 CPU (development) / 512MB RAM, 1 CPU (production)
- **cw_hsq_postgres**: 2GB RAM, 2 CPU (production)
- **cw_hsq_redis**: 512MB RAM, 1 CPU (production)
- **cw_hsq_nginx**: 64MB RAM, 0.25 CPU

### Monitoring Resource Usage
```bash
# Real-time resource monitoring
make top
docker stats

# Detailed resource usage
docker compose exec cw_hsq_app top
```

## Data Persistence

### Volumes
- `cw_hsq_postgres_data`: Database storage
- `cw_hsq_redis_data`: Redis persistence
- `cw_hsq_nginx_logs`: Nginx access and error logs
- `cw_hsq_app_logs`: Application logs (production)

### Backup and Restore
```bash
# Create database backup
make backup
make db-backup

# Restore from backup
make restore BACKUP_FILE=backups/db_20240101_120000.sql
```

## Development Tools

### Database Management
```bash
# Access database shell
make db-shell
docker compose exec cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge

# Prisma Studio
make db-studio
docker compose exec cw_hsq_app npm run db:studio

# Database migrations
docker compose exec cw_hsq_app npm run db:migrate
```

### Redis Management
```bash
# Access Redis CLI
make redis-cli
docker compose exec cw_hsq_redis redis-cli

# Monitor Redis
docker compose exec cw_hsq_redis redis-cli monitor
```

### Application Shells
```bash
# Access application container
make shell-app
docker compose exec cw_hsq_app bash

# Access dashboard container
make shell-dashboard  
docker compose exec cw_hsq_dashboard bash
```

## Logging and Debugging

### Log Access
```bash
# All service logs
make logs

# Individual service logs
make logs-app       # API application logs
make logs-db        # Database logs
make logs-dashboard # Dashboard logs
docker compose logs cw_hsq_nginx    # Nginx logs
docker compose logs cw_hsq_redis    # Redis logs
```

### Log Cleanup
```bash
# Clean application logs
make clean-logs

# Clean Docker logs
docker system prune -f
```

## Testing

### Running Tests
```bash
# All tests
make test

# Unit tests only
make test-unit

# Integration tests
make test-integration

# Tests with coverage
make test-coverage
```

## Security Features

### Container Security
- Non-root users in all application containers
- Minimal base images (Alpine/Slim)
- Security headers in Nginx configuration
- Network isolation
- Resource limits to prevent DoS

### Network Security
- Rate limiting in Nginx (10 req/s for API, 100 req/s for webhooks)
- CORS configuration
- Helmet.js security middleware
- Internal network communication only

## Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check memory usage
docker stats cw_hsq_app

# Restart with memory limit
docker compose restart cw_hsq_app
```

#### Database Connection Issues
```bash
# Check database connectivity
docker compose exec cw_hsq_app npm run db:generate
make health-detailed

# Reset database (WARNING: Data loss)
make db-reset
```

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep -E ':(13000|13001|15432|16379|18080|18443)'

# Stop conflicting services
docker ps | grep -E ':(13000|13001|15432|16379|18080|18443)'
```

### Service Recovery
```bash
# Restart individual service
docker compose restart cw_hsq_app

# Restart all services
make restart

# Clean restart (rebuild images)
make rebuild
```

## Maintenance

### Updates
```bash
# Update dependencies
make update-deps

# Rebuild with latest base images
make build-nocache
```

### Recent Container Rebuild (August 25, 2025)

A complete rebuild was performed for both application containers:

#### Changes Made:
- **cw_hsq_app**: Rebuilt with --no-cache to ensure fresh dependencies and optimal layering
- **cw_hsq_dashboard**: Rebuilt with --no-cache, created missing `public/` directory for Next.js compatibility
- **Configuration Fix**: Updated .env service names from `cw_postgres`/`cw_redis` to `cw_hsq_postgres`/`cw_hsq_redis`
- **Volume Mounts**: Temporarily disabled development volume mounts to resolve permission issues

#### Container Rebuild Process:
```bash
# Stop all services
docker compose down

# Remove old images
docker rmi hsq-bridge-cw_hsq_app:latest hsq-bridge-cw_hsq_dashboard:latest

# Rebuild with no cache
docker compose build --no-cache cw_hsq_app
docker compose build --no-cache cw_hsq_dashboard

# Start services
docker compose up -d
```

#### Verification Steps:
- ✅ All 5 services running and healthy
- ✅ API responding at http://localhost:13000/health
- ✅ Dashboard accessible at http://localhost:13001
- ✅ Nginx proxy functional at http://localhost:18080
- ✅ Database and Redis connectivity confirmed

#### Known Issues Resolved:
- Fixed service name mismatch in environment variables
- Created missing Next.js public directory
- Resolved container permission issues
- Confirmed all health checks passing

### Cleanup
```bash
# Stop services (keep data)
make clean

# Remove everything (including data)
make clean-all

# Clean unused Docker resources
docker system prune -af
docker volume prune -f
```

## Production Deployment

### Environment Setup
1. Copy `.env.example` to `.env`
2. Configure production API keys and secrets
3. Set `NODE_ENV=production`

### Production Start
```bash
# Build and start production services
make prod-build
make prod-start

# Or manually
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Production Monitoring
```bash
# Health checks
curl -f http://your-domain/health
curl -f https://your-domain/health

# Metrics endpoint
curl -s https://your-domain/api/metrics | jq '.'
```

## Dashboard Service Details

### HubSpot Bridge Dashboard (cw_hsq_dashboard)

The dashboard is a Next.js 13.5.11 application with the following features:
- **Framework**: Next.js with standalone output for optimal Docker deployment
- **Theme**: Material Design 3 theme system with amber/black dark theme
- **Styling**: CSS custom properties for dynamic theming
- **Architecture**: Professional business interface for HubSpot-QuickBooks integration
- **Dependencies**: No external database dependencies (frontend only)

#### Dashboard Configuration
- **Container**: `cw_hsq_dashboard`
- **Port**: External `13001` → Internal `3000`
- **Build**: Multi-stage Docker build optimized for production
- **Base Image**: Node.js 18 Alpine (minimal size)
- **User**: Non-root `nextjs:nodejs` (security)
- **Resource Limits**: 256MB RAM, 0.5 CPU
- **Health Check**: `/api/health` endpoint with system metrics

#### Dashboard Environment Variables
```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_API_URL=http://cw_hsq_app:3000
PORT=3000
```

#### Dashboard Management Commands
```bash
# Build dashboard only
docker compose build cw_hsq_dashboard

# Restart dashboard only
docker compose restart cw_hsq_dashboard

# View dashboard logs
docker compose logs -f cw_hsq_dashboard

# Access dashboard container
docker compose exec cw_hsq_dashboard sh

# Dashboard health check
curl http://localhost:13001/api/health
```

#### Dashboard Development Mode
For development, the dashboard can be run outside Docker:
```bash
cd cw_dashboard
npm install
npm run dev    # Runs on http://localhost:3000
```

## Service URLs Summary

### Development URLs
- **API Health**: `http://localhost:13000/health`
- **API Documentation**: `http://localhost:13000/api`
- **Dashboard**: `http://localhost:13001`
- **Dashboard Health**: `http://localhost:13001/api/health`
- **Nginx Proxy**: `http://localhost:18080`
- **Database**: `localhost:15432`
- **Redis**: `localhost:16379`

### Key Management Commands
- **Start**: `make start` or `./scripts/start-all.sh`
- **Stop**: `make stop` or `./scripts/stop-all.sh`
- **Status**: `make status`
- **Logs**: `make logs`
- **Health**: `make health`
- **Backup**: `make backup`
- **Clean**: `make clean`