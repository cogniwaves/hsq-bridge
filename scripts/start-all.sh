#!/bin/bash

# Complete startup script for HubSpot-Stripe-QuickBooks Bridge
set -e

echo "🚀 Starting HubSpot-Stripe-QuickBooks Bridge..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Parse command line arguments
SETUP_DB="true"
BUILD_IMAGES="false"
SKIP_DEPS="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-db)
            SETUP_DB="false"
            shift
            ;;
        --build)
            BUILD_IMAGES="true"
            shift
            ;;
        --skip-deps)
            SKIP_DEPS="false"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --skip-db     Skip database setup"
            echo "  --build       Force rebuild of Docker images"
            echo "  --skip-deps   Skip dependency installation"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_warning ".env file not found, creating from .env.example"
    cp .env.example .env
    print_warning "Please update .env with your actual API keys before proceeding"
    print_status "You can continue for now with mock values for development"
fi

# Build images if requested
if [ "$BUILD_IMAGES" = "true" ]; then
    print_status "Building Docker images..."
    docker compose build --no-cache
fi

# Start infrastructure services first
print_status "Starting infrastructure services..."
docker compose up -d cw_hsq_postgres cw_hsq_redis

# Wait for infrastructure to be ready
print_status "Waiting for infrastructure services..."
timeout=60
counter=0

# Wait for PostgreSQL
while ! docker compose exec -T cw_hsq_postgres pg_isready -U hs_bridge_user -d hs_bridge > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -gt $timeout ]; then
        print_error "PostgreSQL failed to start within ${timeout} seconds"
        docker compose logs cw_hsq_postgres
        exit 1
    fi
done

print_success "PostgreSQL is ready"

# Wait for Redis
counter=0
while ! docker compose exec -T cw_hsq_redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -gt 30 ]; then
        print_error "Redis failed to start within 30 seconds"
        docker compose logs cw_hsq_redis
        exit 1
    fi
done

print_success "Redis is ready"

# Setup database if needed
if [ "$SETUP_DB" = "true" ]; then
    print_status "Setting up database..."
    
    # Start app service temporarily for database setup
    docker compose up -d cw_hsq_app
    sleep 10
    
    # Install dependencies
    if [ "$SKIP_DEPS" = "false" ]; then
        print_status "Installing dependencies..."
        docker compose exec cw_hsq_app npm ci
    fi
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    docker compose exec cw_hsq_app npm run db:generate
    
    # Push database schema
    print_status "Pushing database schema..."
    docker compose exec cw_hsq_app npm run db:push
    
    # Seed database
    print_status "Seeding database..."
    docker compose exec cw_hsq_app npm run db:seed
    
    print_success "Database setup completed"
    
    # Stop app service temporarily
    docker compose stop cw_hsq_app
fi

# Install dashboard dependencies
if [ "$SKIP_DEPS" = "false" ]; then
    print_status "Setting up dashboard..."
    docker compose run --rm cw_hsq_dashboard npm install
    print_success "Dashboard dependencies installed"
fi

# Start all services
print_status "Starting all services..."
docker compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 15

# Check service health
services=("cw_hsq_postgres" "cw_hsq_redis" "cw_hsq_app" "cw_hsq_dashboard" "cw_hsq_nginx")
all_healthy=true

for service in "${services[@]}"; do
    if docker compose ps | grep -q "${service}.*Up"; then
        print_success "${service} is running"
    else
        print_error "${service} is not running"
        all_healthy=false
    fi
done

# Test API endpoints
print_status "Testing API endpoints..."

# Wait a bit more for app to fully start
sleep 10

if curl -s http://localhost:13000/health > /dev/null; then
    print_success "API health endpoint is responding"
else
    print_warning "API health endpoint is not responding yet (this is normal during startup)"
fi

if curl -s http://localhost:13001 > /dev/null; then
    print_success "Dashboard is accessible"
else
    print_warning "Dashboard is not accessible yet (this is normal during startup)"
fi

# Show service URLs
echo ""
echo "🎉 HubSpot-Stripe-QuickBooks Bridge is starting up!"
echo ""
echo "📊 Service URLs:"
echo "   • API:           http://localhost:13000"
echo "   • Health Check:  http://localhost:13000/health"
echo "   • API Docs:      http://localhost:13000/api"
echo "   • Dashboard:     http://localhost:13001"
echo "   • Nginx Proxy:   http://localhost:18080"
echo ""
echo "🔧 Management Commands:"
echo "   • View logs:     docker compose logs -f [service_name]"
echo "   • Stop all:      docker compose down"
echo "   • Database CLI:  docker compose exec cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge"
echo "   • Redis CLI:     docker compose exec cw_hsq_redis redis-cli"
echo "   • App shell:     docker compose exec cw_hsq_app bash"
echo ""
echo "📝 Useful Log Commands:"
echo "   • All logs:      docker compose logs -f"
echo "   • App logs:      docker compose logs -f cw_hsq_app"
echo "   • DB logs:       docker compose logs -f cw_hsq_postgres"
echo "   • Dashboard:     docker compose logs -f cw_hsq_dashboard"
echo ""

if [ "$all_healthy" = true ]; then
    print_success "All services started successfully!"
    echo "✨ Your bridge is ready to synchronize HubSpot, Stripe, and QuickBooks!"
else
    print_warning "Some services may still be starting up. Check the logs if needed."
    echo "⏳ Give it a few more minutes and check the service URLs above."
fi

echo ""
print_status "Setup complete! Monitor the logs with: docker compose logs -f"