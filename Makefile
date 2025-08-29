# HubSpot-Stripe-QuickBooks Bridge - Development Makefile
# Simplify common development tasks

.PHONY: help start stop restart build clean test logs db-setup db-seed db-reset

# Default target
help: ## Show this help message
	@echo "HubSpot-Stripe-QuickBooks Bridge - Available Commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# Development Commands
start: ## Start all services
	@./scripts/start-all.sh

start-minimal: ## Start only infrastructure (DB + Redis)
	@docker compose up -d cw_hsq_postgres cw_hsq_redis

stop: ## Stop all services (keeps data)
	@./scripts/stop-all.sh

restart: ## Restart all services
	@./scripts/stop-all.sh
	@./scripts/start-all.sh

# Build Commands
build: ## Build all Docker images
	@docker compose build

build-nocache: ## Build all Docker images without cache
	@docker compose build --no-cache

rebuild: ## Clean build (removes images and rebuilds)
	@./scripts/stop-all.sh --images
	@./scripts/start-all.sh --build

# Cleanup Commands
clean: ## Stop and remove containers (keeps data)
	@docker compose down

clean-all: ## Stop and remove everything including data
	@./scripts/stop-all.sh --volumes --images

clean-logs: ## Clean up log files
	@rm -rf cw_hsq_app/logs/*.log
	@echo "Log files cleaned"

# Database Commands
db-setup: ## Setup database with migrations and seed data
	@./scripts/setup-db.sh

db-seed: ## Seed database with test data
	@docker compose exec cw_hsq_app npm run db:seed

db-reset: ## Reset database (WARNING: removes all data)
	@docker compose exec cw_hsq_app npm run db:reset

db-studio: ## Open Prisma Studio
	@docker compose exec cw_hsq_app npm run db:studio

db-shell: ## Access PostgreSQL shell
	@docker compose exec cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge

db-backup: ## Create database backup
	@docker compose exec cw_hsq_postgres pg_dump -U hs_bridge_user hs_bridge > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Database backed up to backup_$(shell date +%Y%m%d_%H%M%S).sql"

# Testing Commands
test: ## Run all tests
	@./scripts/run-tests.sh

test-unit: ## Run unit tests only
	@./scripts/run-tests.sh unit

test-integration: ## Run integration tests only
	@./scripts/run-tests.sh integration

# Phase 8 Configuration Management Tests
test-config: ## Run configuration management tests
	@./scripts/run-config-tests.sh

test-config-workflow: ## Test full configuration workflow
	@./scripts/test-config-workflow.sh

test-backend: ## Run backend tests only
	@./scripts/run-tests.sh backend

test-dashboard: ## Run dashboard tests only
	@./scripts/run-tests.sh dashboard

test-a11y: ## Run accessibility tests
	@./scripts/run-tests.sh a11y

test-performance: ## Run performance tests
	@./scripts/run-tests.sh performance

test-quality: ## Run code quality checks
	@./scripts/run-tests.sh quality

test-coverage: ## Run tests with coverage report
	@./scripts/run-tests.sh all --coverage

test-watch-backend: ## Run backend tests in watch mode
	@./scripts/run-tests.sh watch backend

test-watch-dashboard: ## Run dashboard tests in watch mode
	@./scripts/run-tests.sh watch dashboard

test-ci: ## Run tests in CI mode
	@./scripts/run-tests.sh ci

test-api: ## Test API endpoints
	@./scripts/test-api.sh

test-api-health: ## Test API health endpoints
	@./scripts/test-api.sh health

test-setup: ## Setup test environment
	@./scripts/setup-test-db.sh setup

test-clean: ## Clean test environment
	@./scripts/setup-test-db.sh clean

test-reset: ## Reset test environment
	@./scripts/setup-test-db.sh reset

# Coverage Reporting Commands
coverage-report: ## Generate comprehensive coverage report
	@./scripts/generate-coverage-report.sh

coverage-check: ## Check coverage quality gates
	@./scripts/generate-coverage-report.sh check-gates

coverage-badge: ## Generate coverage badge
	@./scripts/generate-coverage-report.sh badge

coverage-open: ## Open coverage reports in browser
	@if [ -f "test-reports/coverage-report.html" ]; then \
		xdg-open test-reports/coverage-report.html 2>/dev/null || \
		open test-reports/coverage-report.html 2>/dev/null || \
		echo "Coverage report available at: test-reports/coverage-report.html"; \
	else \
		echo "Coverage report not found. Run 'make coverage-report' first."; \
	fi

# Development Setup Commands
install-hooks: ## Install git hooks for quality gates
	@./scripts/install-git-hooks.sh

setup-dev: ## Complete development setup
	@echo "🚀 Setting up HSQ Bridge development environment..."
	@./scripts/install-git-hooks.sh
	@echo "✅ Development setup completed!"

# Development Tools
logs: ## Show logs for all services
	@docker compose logs -f

logs-app: ## Show logs for main application
	@docker compose logs -f cw_hsq_app

logs-db: ## Show database logs
	@docker compose logs -f cw_hsq_postgres

logs-dashboard: ## Show dashboard logs
	@docker compose logs -f cw_hsq_dashboard

shell-app: ## Access application shell
	@docker compose exec cw_hsq_app bash

shell-dashboard: ## Access dashboard shell
	@docker compose exec cw_hsq_dashboard bash

redis-cli: ## Access Redis CLI
	@docker compose exec cw_hsq_redis redis-cli

# Monitoring Commands
status: ## Show status of all services
	@docker compose ps

health: ## Check application health
	@curl -s http://localhost:13000/health | jq '.' 2>/dev/null || curl -s http://localhost:13000/health

health-detailed: ## Detailed health check
	@curl -s http://localhost:13000/health/detailed | jq '.' 2>/dev/null || curl -s http://localhost:13000/health/detailed

# Phase 8 Configuration Management Health Checks
config-health: ## Check configuration management health
	@curl -s http://localhost:13000/api/config/health | jq '.' 2>/dev/null || curl -s http://localhost:13000/api/config/health

config-status: ## Show all configuration status
	@curl -s http://localhost:13000/api/config/status | jq '.' 2>/dev/null || curl -s http://localhost:13000/api/config/status

config-audit: ## Show recent configuration audit logs
	@curl -s http://localhost:13000/api/config/audit | jq '.' 2>/dev/null || curl -s http://localhost:13000/api/config/audit

metrics: ## Show application metrics
	@curl -s http://localhost:13000/api/metrics | jq '.' 2>/dev/null || curl -s http://localhost:13000/api/metrics

top: ## Show resource usage
	@docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Maintenance Commands
update-deps: ## Update all dependencies
	@docker compose exec cw_hsq_app npm update
	@docker compose exec cw_hsq_dashboard npm update

lint: ## Run linting
	@docker compose exec cw_hsq_app npm run lint

lint-fix: ## Fix linting issues
	@docker compose exec cw_hsq_app npm run lint:fix

format: ## Format code
	@docker compose exec cw_hsq_app npm run prettier --write src/

# Production Commands
prod-build: ## Build for production
	@docker compose -f docker compose.yml -f docker compose.prod.yml build

prod-start: ## Start in production mode
	@docker compose -f docker compose.yml -f docker compose.prod.yml up -d

# Backup and Restore
backup: ## Create full backup (database + config)
	@mkdir -p backups
	@docker compose exec cw_hsq_postgres pg_dump -U hs_bridge_user hs_bridge > backups/db_$(shell date +%Y%m%d_%H%M%S).sql
	@cp .env backups/env_$(shell date +%Y%m%d_%H%M%S).backup
	@echo "Backup created in backups/ directory"

# Phase 8 Configuration Management Backup
backup-config: ## Backup configuration data and settings
	@mkdir -p backups/config
	@docker compose exec cw_hsq_app node -e "require('./dist/scripts/backup-config.js')" > backups/config/config_$(shell date +%Y%m%d_%H%M%S).json
	@echo "Configuration backup created in backups/config/ directory"

restore-config: ## Restore configuration from backup (provide CONFIG_FILE=filename)
	@if [ -z "$(CONFIG_FILE)" ]; then echo "Usage: make restore-config CONFIG_FILE=backups/config/config_YYYYMMDD_HHMMSS.json"; exit 1; fi
	@docker compose exec -T cw_hsq_app node -e "require('./dist/scripts/restore-config.js')" < $(CONFIG_FILE)
	@echo "Configuration restored from $(CONFIG_FILE)"

restore: ## Restore from backup (provide BACKUP_FILE=filename)
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Usage: make restore BACKUP_FILE=backups/db_YYYYMMDD_HHMMSS.sql"; exit 1; fi
	@docker compose exec -T cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge < $(BACKUP_FILE)
	@echo "Database restored from $(BACKUP_FILE)"

# Documentation
docs: ## Generate API documentation
	@echo "API documentation available at:"
	@echo "  http://localhost:3000/api"

info: ## Show project information
	@echo "HubSpot-Stripe-QuickBooks Bridge"
	@echo "================================"
	@echo "Services:"
	@echo "  • API Server:     http://localhost:13000"
	@echo "  • Dashboard:      http://localhost:13001"
	@echo "  • PostgreSQL:     localhost:15432"
	@echo "  • Redis:          localhost:16379"
	@echo "  • Nginx Proxy:    http://localhost:18080"
	@echo ""
	@echo "Key endpoints:"
	@echo "  • Health:         http://localhost:13000/health"
	@echo "  • API Info:       http://localhost:13000/api"
	@echo "  • Metrics:        http://localhost:13000/api/metrics"
	@echo ""
	@echo "Phase 8 Configuration Management:"
	@echo "  • Config Health:  http://localhost:13000/api/config/health"
	@echo "  • Settings UI:    http://localhost:13001/settings"
	@echo "  • HubSpot Setup:  http://localhost:13001/settings/hubspot"
	@echo "  • QuickBooks:     http://localhost:13001/settings/quickbooks"
	@echo "  • Stripe Setup:   http://localhost:13001/settings/stripe"
	@echo ""
	@echo "Management:"
	@echo "  • Prisma Studio: make db-studio"
	@echo "  • Logs:          make logs"
	@echo "  • Tests:         make test"
	@echo "  • Config Health: make config-health"