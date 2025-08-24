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
	@./scripts/run-tests.sh --unit

test-integration: ## Run integration tests only
	@./scripts/run-tests.sh --integration

test-coverage: ## Run tests with coverage report
	@./scripts/run-tests.sh --coverage

test-watch: ## Run tests in watch mode
	@./scripts/run-tests.sh --watch

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
	@echo "Management:"
	@echo "  • Prisma Studio: make db-studio"
	@echo "  • Logs:          make logs"
	@echo "  • Tests:         make test"