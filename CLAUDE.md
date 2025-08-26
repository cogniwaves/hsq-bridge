# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a production-ready HubSpot-Stripe-QuickBooks bridge system for bidirectional invoice and payment synchronization. The system is currently in Phase 1.6 with complete database schema standardization, full HubSpot invoice extraction capabilities, enhanced tax support, OAuth token refresh implementation, and real-time webhook processing.

## Technology Stack

### Backend Application (`cw_app/`)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with middleware (helmet, cors, rate limiting)
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: Redis with Bull for background jobs
- **External APIs**: HubSpot (@hubspot/api-client), Stripe, QuickBooks (node-quickbooks)
- **Testing**: Jest with ts-jest, 70% coverage threshold
- **Authentication**: JWT with bcryptjs, OAuth token management with encryption

### Dashboard (`cw_dashboard/`)
- **Framework**: Next.js 13+ with React 18
- **Styling**: Tailwind CSS with design system tokens
- **Components**: Headless UI, Heroicons, Recharts for analytics
- **HTTP Client**: Axios with SWR for data fetching

### Infrastructure
- **Containerization**: Docker Compose with 5 services
- **Database**: PostgreSQL 15 with custom initialization
- **Cache/Queue**: Redis 7 for job processing
- **Proxy**: Nginx with SSL support
- **Monitoring**: Winston logging with structured logs

## Development Commands

### Main Application (cw_app)
```bash
# Development
npm run dev                    # Start dev server with ts-node-dev
npm run build                  # Build TypeScript to dist/
npm run start                  # Start production build

# Database Operations
npm run db:generate           # Generate Prisma client
npm run db:push              # Push schema to database  
npm run db:migrate           # Run database migrations
npm run db:studio            # Open Prisma Studio
npm run db:seed              # Seed database with test data
npm run db:reset             # Reset database (WARNING: removes all data)

# Testing & Quality
npm test                     # Run Jest tests
npm run test:watch          # Jest in watch mode
npm run test:token          # Test OAuth token functionality specifically
npm run lint                # ESLint analysis
npm run lint:fix            # Fix linting issues

# Token Management
npm run migrate:tokens      # Migrate existing tokens to new format
```

### Dashboard (cw_dashboard)
```bash
npm run dev                  # Next.js development server
npm run build               # Production build
npm run start               # Start production build
npm run lint                # Next.js linting
npm run type-check          # TypeScript type checking
```

### Docker & Infrastructure
```bash
# Primary Commands
make start                   # Start all services with setup
make stop                   # Stop all services (keeps data)
make restart                # Full restart of all services
make clean-all              # Remove everything including data

# Database Management
make db-setup               # Setup database with migrations/seed
make db-seed                # Seed database with test data  
make db-studio              # Open Prisma Studio
make db-shell               # PostgreSQL shell access
make db-backup              # Create database backup

# Development Tools
make test                   # Run all tests
make test-coverage          # Tests with coverage report
make logs                   # Show all service logs
make logs-app               # Application logs only
make health                 # Check application health
make status                 # Show service status

# Service Access
make shell-app              # Access application container
make redis-cli              # Access Redis CLI
```

### Script Commands
```bash
# Direct script execution
./scripts/start-all.sh              # Complete system startup
./scripts/start-all.sh --build      # Start with image rebuild
./scripts/start-all.sh --skip-db    # Start without database setup
./scripts/stop-all.sh               # Stop all services
./scripts/run-tests.sh              # Run test suite
./scripts/setup-db.sh               # Database setup only
```

## System Architecture

### Docker Services Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                     │
├─────────────────────────────────────────────────────────────┤
│ cw_hsq_nginx    (Reverse Proxy)     :18080/18443           │
│ ├─ cw_hsq_app        (API Server)   :13000                 │
│ ├─ cw_hsq_dashboard  (Web UI)       :13001                 │
│ cw_hsq_postgres     (Database)      :15432                 │
│ cw_hsq_redis        (Queue/Cache)   :16379                 │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Design
The system uses a fully normalized PostgreSQL schema with comprehensive field coverage and proper relationships:

#### Core Business Tables (Enhanced Schema - Phase 1.6)
- **invoice_mapping** (36 columns): Complete invoice records with HubSpot, Stripe, QuickBooks IDs
  - Enhanced with 15+ additional fields: hubspotRawData, balanceDue, firstSyncAt
  - Full timestamp tracking: hubspotCreatedAt, invoiceSentAt, fullyPaidAt
  - Metadata fields: syncSource, hubspotObjectId, detectedCurrency
- **line_items**: Product-level invoice details with tax information  
- **tax_summary**: Aggregated tax calculations by invoice
- **payment_mapping**: Payment records across platforms with full synchronization tracking
- **invoice_payments**: Many-to-many invoice-payment relationships

#### Entity Management (Standardized)
- **contacts/companies**: Normalized entity storage with lastSyncAt tracking
- **invoice_associations**: Many-to-many relationships with proper unique constraints

#### System Infrastructure (Optimized)
- **webhook_events**: Real-time event processing with retry logic
- **sync_logs**: Complete audit trail with proper foreign key relationships (no more polymorphic issues)
- **sync_watermarks**: Track incremental sync progress by entity type
- **quickbooks_transfer_queue**: Approval workflow for QuickBooks transfers

#### Security & Authentication
- **oauth_tokens**: Encrypted OAuth token storage with refresh capabilities
- **token_refresh_logs**: Audit trail for all token refresh operations

#### Performance & Analytics (New)
- **mv_invoice_summary**: Materialized view for real-time analytics
- **15+ Performance Indexes**: Optimized for common query patterns
- **Data Integrity Constraints**: Check constraints and validation rules

### API Integration Services

#### HubSpot Integration (`services/hubspotClient.ts`)
- Complete API client with rate limiting and pagination
- Supports invoices, contacts, companies, and line items APIs
- Real-time webhook processing with signature verification
- Enhanced tax extraction with proper currency detection

#### Service Layer Architecture
- **NormalizedInvoiceExtractor**: Main extraction service with contact/company normalization
- **EnhancedInvoiceExtractor**: Tax processing and line items support  
- **WebhookService**: Real-time event processing for all platforms
- **ContactService/CompanyService**: Entity management with deduplication
- **QuickBooksTransferQueue**: Approval workflow for QuickBooks synchronization

#### Authentication & Token Management (`services/auth/`)
- **TokenManager**: Core OAuth token management with encryption
- **RefreshScheduler**: Automatic token refresh scheduling
- **TokenStorage**: Secure encrypted storage for sensitive tokens

## Key Development Patterns

### Database Operations
- Always use Prisma Client for type-safe database access
- Leverage normalized schema - avoid data duplication
- Use transaction patterns for multi-table operations
- Implement proper error handling with retry logic

### API Integration Best Practices  
- Respect rate limits with exponential backoff
- Store raw API responses for debugging and data recovery
- Use proper webhook signature verification
- Implement comprehensive logging for API interactions

### Testing Strategy
- Unit tests for business logic and utilities
- Integration tests for API endpoints and database operations
- Jest configuration with 70% coverage threshold enforced
- Proper test isolation with database cleanup
- Specific OAuth token functionality testing (`npm run test:token`)

### Error Handling Patterns
```typescript
// Consistent error handling across services
try {
  const result = await someOperation();
  logger.info('Operation succeeded', { result });
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw new ServiceError('Meaningful error message', error);
}
```

## Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://hs_bridge_user:password@cw_hsq_postgres:5432/hs_bridge

# HubSpot Integration  
HUBSPOT_API_KEY=pat-na1-your-private-app-token
HUBSPOT_WEBHOOK_SECRET=your-webhook-secret

# Stripe Integration
STRIPE_SECRET_KEY=sk_test_or_live_key
STRIPE_WEBHOOK_SECRET=whsec_webhook_secret

# QuickBooks Integration
QUICKBOOKS_CLIENT_ID=your-quickbooks-app-id
QUICKBOOKS_CLIENT_SECRET=your-quickbooks-secret
QUICKBOOKS_ACCESS_TOKEN=stored-in-oauth_tokens-table
QUICKBOOKS_REFRESH_TOKEN=stored-in-oauth_tokens-table  
QUICKBOOKS_COMPANY_ID=your-company-realm-id

# System Configuration
NODE_ENV=development|production
PORT=3000
REDIS_URL=redis://cw_hsq_redis:6379

# Security & Authentication
WEBHOOK_SECRET=your-webhook-signing-secret
API_KEY_ADMIN=admin-access-key
API_KEY_READ_ONLY=readonly-access-key
API_KEY_WEBHOOK=webhook-processing-key
```

## Current Implementation Status

### Phase 1 ✅ Complete
- Full HubSpot invoice extraction (1,124+ invoices)
- Normalized database schema with proper relationships
- Real-time webhook infrastructure with signature verification
- Complete API layer with health checks and monitoring
- Production-ready Docker infrastructure

### Phase 1.5 ✅ Complete  
- Enhanced tax support with line items API integration
- Real currency detection (CAD, USD, EUR support)
- Product-level invoice breakdown with tax calculations
- Enhanced database schema with line_items and tax_summary tables
- Business intelligence SQL scripts for analytics
- Comprehensive OAuth token refresh system for QuickBooks integration
- Encrypted token storage with automatic refresh scheduling
- Token refresh audit trail and monitoring

### Phase 1.6 ✅ Complete (December 2024)
- **Complete Database Schema Standardization**: Fixed all schema discrepancies identified in analysis
- **InvoiceMapping Model Enhancement**: Added 15+ missing fields (hubspotRawData, balanceDue, firstSyncAt, etc.)
- **Contact/Company Model Updates**: Added missing lastSyncAt fields for proper sync tracking
- **SyncLog Relationship Fixes**: Replaced invalid polymorphic relationships with proper foreign keys
- **Service Layer Standardization**: Unified Prisma client imports across 8+ service files
- **Performance Optimization**: Added 15+ database indexes and materialized views for analytics
- **Data Integrity**: Implemented comprehensive check constraints and validation rules
- **Migration Safety**: Preserved all existing production data during schema updates
- **Documentation**: Complete DATABASE_SCHEMA.md and DATABASE_DISCREPANCY.md analysis

### Phase 2 📋 Planned
- Stripe payment integration with webhook processing
- AI-powered payment-to-invoice matching algorithm  
- Real-time payment status synchronization
- Partial payment and refund handling

## Testing & Quality Assurance

### Running Tests
- Unit tests: `npm test` or `make test-unit`
- Integration tests: `npm run test:coverage` or `make test-integration`  
- Watch mode: `npm run test:watch` or `make test-watch`
- OAuth token tests: `npm run test:token` (specific to auth functionality)
- Coverage reports generated in `coverage/` directory

### Code Quality
- ESLint configuration with TypeScript rules
- Prettier for code formatting (run with `npm run lint:fix`)
- Pre-commit hooks for code quality (if configured)
- 70% test coverage threshold enforced

## Monitoring & Health Checks

### Health Endpoints
- **Basic Health**: `GET /health` - Quick status check
- **Detailed Health**: `GET /health/detailed` - Full system diagnostics
- **API Info**: `GET /api/` - API documentation and status
- **Metrics**: `GET /api/metrics` - Application metrics

### Logging Strategy
- Structured logging with Winston
- Separate log files: app.log, error.log, combined.log
- Request/response logging for API interactions
- Performance metrics and timing information

## Known Limitations & Workarounds

### HubSpot API Constraints
- Rate limiting: 100 requests per 10 seconds per application
- Webhook activation requires public URL (use ngrok for development)
- Some tax properties require specific API scopes

### Development Considerations
- Database migrations are handled automatically by Prisma
- Redis required for background job processing
- All external API keys must be configured for full functionality
- Docker volumes persist data between restarts

## Troubleshooting Guide

### Common Issues
```bash
# Service won't start
make status                    # Check service status
make logs-app                  # Check application logs
docker compose ps             # Verify container status

# Database connection issues
make db-shell                 # Test database connectivity
make db-reset                 # Reset database (WARNING: destroys data)

# API connectivity issues  
curl http://localhost:13000/health              # Basic health check
curl http://localhost:13000/api/test/hubspot    # HubSpot connectivity

# Performance issues
make top                      # Check resource usage
make metrics                  # Application metrics
```

### Recovery Procedures
- **Full Reset**: `make clean-all && make start`
- **Database Only**: `make db-reset && make db-setup`
- **Logs Cleanup**: `make clean-logs`
- **Service Restart**: `make restart`

## OAuth Token Management

### Token Storage and Security
- OAuth tokens encrypted using AES-256-GCM encryption before database storage
- Automatic token refresh scheduling prevents expiration
- Comprehensive audit trail in `token_refresh_logs` table
- Support for multi-tenant token management

### Token Refresh Process
```typescript
// Automatic refresh triggered before expiration
// Manual refresh can be triggered via API:
POST /api/token/refresh/quickbooks
```

### Key Components
- **services/auth/tokenManager.ts**: Core token operations
- **services/auth/refreshScheduler.ts**: Automatic refresh scheduling  
- **services/auth/tokenStorage.ts**: Encrypted storage layer

## Security Considerations

- All API keys stored in environment variables (never in code)
- OAuth tokens encrypted at rest with AES-256-GCM
- Webhook signature verification implemented and enforced
- Database credentials use non-root user with limited privileges
- CORS configured for production domains only
- Input validation with express-validator and Zod schemas
- Rate limiting on all API endpoints

## Performance Optimization

- Database indexes on all foreign keys and frequently queried columns
- Redis caching for frequently accessed data
- Pagination implemented for large data sets
- Batch processing for bulk operations
- Connection pooling for database and external APIs