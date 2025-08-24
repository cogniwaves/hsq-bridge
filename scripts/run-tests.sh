#!/bin/bash

# Test runner script for HubSpot-Stripe-QuickBooks Bridge
set -e

echo "🧪 Running tests for hs_bridge..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
TEST_TYPE="all"
COVERAGE="false"
WATCH="false"
VERBOSE="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            shift
            ;;
        --integration)
            TEST_TYPE="integration"
            shift
            ;;
        --e2e)
            TEST_TYPE="e2e"
            shift
            ;;
        --coverage)
            COVERAGE="true"
            shift
            ;;
        --watch)
            WATCH="true"
            shift
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --unit        Run only unit tests"
            echo "  --integration Run only integration tests"
            echo "  --e2e         Run only end-to-end tests"
            echo "  --coverage    Generate coverage report"
            echo "  --watch       Run tests in watch mode"
            echo "  --verbose     Enable verbose output"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Start test services if needed
if [ "$TEST_TYPE" = "integration" ] || [ "$TEST_TYPE" = "e2e" ] || [ "$TEST_TYPE" = "all" ]; then
    print_status "Starting test services..."
    
    # Start PostgreSQL and Redis for integration tests
    docker-compose up -d cw_postgres cw_redis
    
    # Wait for services to be ready
    print_status "Waiting for test services to be ready..."
    timeout=30
    counter=0
    
    while ! docker-compose exec -T cw_postgres pg_isready -U hs_bridge_user -d hs_bridge > /dev/null 2>&1; do
        sleep 1
        counter=$((counter + 1))
        if [ $counter -gt $timeout ]; then
            print_error "PostgreSQL failed to start within ${timeout} seconds"
            exit 1
        fi
    done
    
    while ! docker-compose exec -T cw_redis redis-cli ping > /dev/null 2>&1; do
        sleep 1
        counter=$((counter + 1))
        if [ $counter -gt $timeout ]; then
            print_error "Redis failed to start within ${timeout} seconds"
            exit 1
        fi
    done
    
    print_success "Test services are ready"
    
    # Setup test database
    print_status "Setting up test database..."
    cd cw_app
    npm run db:generate
    
    # Create test database schema
    DATABASE_URL="postgresql://hs_bridge_user:${POSTGRES_PASSWORD:-hs_bridge_password}@localhost:5432/hs_bridge_test" \
    npx prisma db push --force-reset --accept-data-loss
    
    cd ..
fi

# Build Jest command
JEST_CMD="cd cw_app && npx jest"

# Add test type specific patterns
case $TEST_TYPE in
    "unit")
        JEST_CMD="$JEST_CMD tests/unit"
        ;;
    "integration")
        JEST_CMD="$JEST_CMD tests/integration"
        ;;
    "e2e")
        JEST_CMD="$JEST_CMD tests/e2e"
        ;;
    "all")
        # Run all tests
        ;;
esac

# Add coverage if requested
if [ "$COVERAGE" = "true" ]; then
    JEST_CMD="$JEST_CMD --coverage"
fi

# Add watch mode if requested
if [ "$WATCH" = "true" ]; then
    JEST_CMD="$JEST_CMD --watch"
fi

# Add verbose output if requested
if [ "$VERBOSE" = "true" ]; then
    JEST_CMD="$JEST_CMD --verbose"
fi

# Run linting first
print_status "Running ESLint..."
cd cw_app
if npm run lint; then
    print_success "Linting passed"
else
    print_warning "Linting issues found, but continuing with tests"
fi
cd ..

# Run the tests
print_status "Running ${TEST_TYPE} tests..."
echo "Command: $JEST_CMD"

if eval $JEST_CMD; then
    print_success "Tests passed!"
    
    # Show coverage report if generated
    if [ "$COVERAGE" = "true" ]; then
        print_status "Coverage report generated in cw_app/coverage/"
    fi
    
else
    print_error "Tests failed!"
    exit 1
fi

# Cleanup
if [ "$WATCH" != "true" ]; then
    if [ "$TEST_TYPE" = "integration" ] || [ "$TEST_TYPE" = "e2e" ] || [ "$TEST_TYPE" = "all" ]; then
        print_status "Cleaning up test services..."
        docker-compose down cw_postgres cw_redis
    fi
fi

print_success "Test run completed!"