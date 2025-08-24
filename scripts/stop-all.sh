#!/bin/bash

# Complete shutdown script for HubSpot-Stripe-QuickBooks Bridge
set -e

echo "🛑 Stopping HubSpot-Stripe-QuickBooks Bridge..."

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

# Parse command line arguments
REMOVE_VOLUMES="false"
REMOVE_IMAGES="false"
FORCE_STOP="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --volumes)
            REMOVE_VOLUMES="true"
            shift
            ;;
        --images)
            REMOVE_IMAGES="true"
            shift
            ;;
        --force)
            FORCE_STOP="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --volumes     Remove all volumes (WARNING: This will delete all data)"
            echo "  --images      Remove built images"
            echo "  --force       Force stop containers (kill instead of graceful stop)"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Show warning for destructive operations
if [ "$REMOVE_VOLUMES" = "true" ]; then
    print_warning "WARNING: This will delete all database data and Redis cache!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled"
        exit 0
    fi
fi

# Stop services
if [ "$FORCE_STOP" = "true" ]; then
    print_status "Force stopping all services..."
    docker compose kill
else
    print_status "Gracefully stopping all services..."
    docker compose down
fi

print_success "Services stopped"

# Remove volumes if requested
if [ "$REMOVE_VOLUMES" = "true" ]; then
    print_status "Removing all volumes..."
    docker compose down -v
    
    # Also remove any orphaned volumes
    if docker volume ls -q -f "name=hs_bridge" | grep -q .; then
        docker volume rm $(docker volume ls -q -f "name=hs_bridge")
    fi
    
    print_warning "All data volumes removed"
fi

# Remove images if requested
if [ "$REMOVE_IMAGES" = "true" ]; then
    print_status "Removing built images..."
    
    # Remove project images
    if docker images -q hs_bridge_* | grep -q .; then
        docker rmi $(docker images -q hs_bridge_*)
    fi
    
    # Remove dangling images
    if docker images -q -f "dangling=true" | grep -q .; then
        docker rmi $(docker images -q -f "dangling=true")
    fi
    
    print_success "Images removed"
fi

# Clean up any orphaned containers
print_status "Cleaning up orphaned containers..."
docker system prune -f > /dev/null 2>&1

# Show status
print_status "Checking remaining Docker resources..."

# Check if any containers are still running
running_containers=$(docker ps --format "table {{.Names}}" | grep "cw_hsq_" | wc -l || echo "0")
if [ "$running_containers" -gt 0 ]; then
    print_warning "Some containers are still running:"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep "cw_hsq_"
else
    print_success "No containers are running"
fi

# Check volumes
if [ "$REMOVE_VOLUMES" = "false" ]; then
    volumes=$(docker volume ls -q -f "name=hs_bridge" | wc -l || echo "0")
    if [ "$volumes" -gt 0 ]; then
        print_status "Data volumes preserved:"
        docker volume ls -f "name=hs_bridge"
        print_warning "Your data is safe. Use --volumes flag to remove data if needed."
    fi
else
    print_success "All data volumes removed"
fi

# Check images
if [ "$REMOVE_IMAGES" = "false" ]; then
    images=$(docker images -q hs_bridge_* | wc -l || echo "0")
    if [ "$images" -gt 0 ]; then
        print_status "Built images preserved for faster startup:"
        docker images hs_bridge_*
        print_status "Use --images flag to remove images if needed"
    fi
else
    print_success "All built images removed"
fi

echo ""
print_success "HubSpot-Stripe-QuickBooks Bridge stopped successfully!"
echo ""
echo "🔄 To start again:"
echo "   ./scripts/start-all.sh"
echo ""
echo "🧹 Complete cleanup (removes all data):"
echo "   ./scripts/stop-all.sh --volumes --images"
echo ""
echo "📋 Docker system status:"
echo "   docker system df"
echo ""

print_status "Shutdown complete"