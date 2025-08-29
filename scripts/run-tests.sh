#!/bin/bash

# Comprehensive Test Runner Script
# Runs all tests with proper environment setup and reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COVERAGE_THRESHOLD=70
PARALLEL_WORKERS=4

# Functions for colored output
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Function to check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running or accessible"
        exit 1
    fi
    
    log_success "Docker is available"
}

# Function to setup test environment
setup_test_env() {
    log_info "Setting up test environment..."
    
    # Start test services
    log_info "Starting test database and Redis services..."
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.test.yml up -d cw_hsq_postgres_test cw_hsq_redis_test
    
    # Wait for services to be ready
    log_info "Waiting for test services to be ready..."
    sleep 5
    
    # Setup test database
    if [ -f "scripts/setup-test-db.sh" ]; then
        log_info "Setting up test database..."
        ./scripts/setup-test-db.sh setup
    fi
    
    log_success "Test environment setup completed"
}

# Function to run backend tests
run_backend_tests() {
    local test_type="${1:-all}"
    
    log_info "Running backend tests (type: $test_type)..."
    cd "$PROJECT_ROOT/cw_app"
    
    # Ensure test environment file is loaded
    if [ -f ".env.test" ]; then
        export $(cat .env.test | grep -v '^#' | xargs)
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        log_info "Installing backend dependencies..."
        npm ci
    fi
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate
    
    case $test_type in
        "unit")
            log_info "Running backend unit tests..."
            npm run test -- --testPathPattern=unit --coverage
            ;;
        "integration")
            log_info "Running backend integration tests..."
            npm run test -- --testPathPattern=integration --coverage
            ;;
        "watch")
            log_info "Running backend tests in watch mode..."
            npm run test:watch
            ;;
        "ci")
            log_info "Running backend tests in CI mode..."
            npm run test -- --ci --coverage --watchAll=false --maxWorkers=$PARALLEL_WORKERS
            ;;
        *)
            log_info "Running all backend tests..."
            npm test -- --coverage --maxWorkers=$PARALLEL_WORKERS
            ;;
    esac
    
    local exit_code=$?
    cd "$PROJECT_ROOT"
    
    if [ $exit_code -eq 0 ]; then
        log_success "Backend tests completed successfully"
    else
        log_error "Backend tests failed"
        return $exit_code
    fi
}

# Function to run dashboard tests
run_dashboard_tests() {
    local test_type="${1:-all}"
    
    log_info "Running dashboard tests (type: $test_type)..."
    cd "$PROJECT_ROOT/cw_dashboard"
    
    # Ensure test environment file is loaded
    if [ -f ".env.test" ]; then
        export $(cat .env.test | grep -v '^#' | xargs)
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        log_info "Installing dashboard dependencies..."
        npm ci
    fi
    
    case $test_type in
        "unit")
            log_info "Running dashboard unit tests..."
            npm run test -- --testPathPattern=unit --coverage
            ;;
        "integration")
            log_info "Running dashboard integration tests..."
            npm run test:integration -- --coverage
            ;;
        "a11y"|"accessibility")
            log_info "Running accessibility tests..."
            npm run test:a11y -- --coverage
            ;;
        "performance")
            log_info "Running performance tests..."
            npm run test:performance -- --coverage
            ;;
        "watch")
            log_info "Running dashboard tests in watch mode..."
            npm run test:watch
            ;;
        "ci")
            log_info "Running dashboard tests in CI mode..."
            npm run test:ci -- --maxWorkers=$PARALLEL_WORKERS
            ;;
        *)
            log_info "Running all dashboard tests..."
            npm test -- --coverage --maxWorkers=$PARALLEL_WORKERS
            ;;
    esac
    
    local exit_code=$?
    cd "$PROJECT_ROOT"
    
    if [ $exit_code -eq 0 ]; then
        log_success "Dashboard tests completed successfully"
    else
        log_error "Dashboard tests failed"
        return $exit_code
    fi
}

# Function to run linting and type checking
run_quality_checks() {
    log_info "Running code quality checks..."
    
    # Backend quality checks
    log_info "Checking backend code quality..."
    cd "$PROJECT_ROOT/cw_app"
    
    if ! npm run lint; then
        log_error "Backend linting failed"
        return 1
    fi
    
    # Dashboard quality checks
    log_info "Checking dashboard code quality..."
    cd "$PROJECT_ROOT/cw_dashboard"
    
    if ! npm run lint; then
        log_error "Dashboard linting failed"
        return 1
    fi
    
    if ! npm run type-check; then
        log_error "Dashboard type checking failed"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    log_success "All code quality checks passed"
}

# Function to generate test reports
generate_reports() {
    log_info "Generating test reports..."
    
    local reports_dir="$PROJECT_ROOT/test-reports"
    mkdir -p "$reports_dir"
    
    # Copy backend coverage reports
    if [ -d "$PROJECT_ROOT/cw_app/coverage" ]; then
        cp -r "$PROJECT_ROOT/cw_app/coverage" "$reports_dir/backend-coverage"
        log_info "Backend coverage report available at: $reports_dir/backend-coverage/lcov-report/index.html"
    fi
    
    # Copy dashboard coverage reports  
    if [ -d "$PROJECT_ROOT/cw_dashboard/coverage" ]; then
        cp -r "$PROJECT_ROOT/cw_dashboard/coverage" "$reports_dir/dashboard-coverage"
        log_info "Dashboard coverage report available at: $reports_dir/dashboard-coverage/lcov-report/index.html"
    fi
    
    log_success "Test reports generated in: $reports_dir/"
}

# Function to cleanup test environment
cleanup_test_env() {
    log_info "Cleaning up test environment..."
    cd "$PROJECT_ROOT"
    
    # Stop test containers
    docker compose -f docker-compose.test.yml down
    
    log_success "Test environment cleanup completed"
}

# Function to display help
show_help() {
    cat << EOF
Test Runner Script for HSQ Bridge

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  all              Run all tests (default)
  backend          Run only backend tests
  dashboard        Run only dashboard tests
  unit             Run only unit tests
  integration      Run only integration tests
  a11y             Run only accessibility tests  
  performance      Run only performance tests
  quality          Run code quality checks only
  watch            Run tests in watch mode
  ci               Run tests in CI mode
  clean            Clean test environment
  setup            Setup test environment only
  
Options:
  --skip-setup     Skip test environment setup
  --skip-cleanup   Skip test environment cleanup
  --coverage       Force coverage reporting
  --parallel N     Set number of parallel workers (default: $PARALLEL_WORKERS)
  --threshold N    Set coverage threshold (default: $COVERAGE_THRESHOLD%)
  --help           Show this help message

Examples:
  $0                           # Run all tests with setup
  $0 backend --skip-setup      # Run backend tests only
  $0 ci --parallel 8           # Run CI tests with 8 workers
  $0 watch backend            # Watch backend tests
  $0 clean                    # Clean test environment

EOF
}

# Main execution function
main() {
    local command="${1:-all}"
    local skip_setup=false
    local skip_cleanup=false
    
    # Parse arguments
    shift 2>/dev/null || true
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-setup)
                skip_setup=true
                shift
                ;;
            --skip-cleanup)
                skip_cleanup=true
                shift
                ;;
            --coverage)
                force_coverage=true
                shift
                ;;
            --parallel)
                PARALLEL_WORKERS="$2"
                shift 2
                ;;
            --threshold)
                COVERAGE_THRESHOLD="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_warning "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Set trap for cleanup
    if [ "$skip_cleanup" = false ]; then
        trap cleanup_test_env EXIT
    fi
    
    log_info "Starting test execution with command: $command"
    log_info "Configuration: threshold=$COVERAGE_THRESHOLD%, workers=$PARALLEL_WORKERS"
    
    # Check prerequisites
    check_docker
    
    # Setup test environment unless skipped
    if [ "$skip_setup" = false ] && [ "$command" != "clean" ] && [ "$command" != "setup" ]; then
        setup_test_env
    fi
    
    # Execute command
    case $command in
        "all")
            run_quality_checks
            run_backend_tests "all"
            run_dashboard_tests "all"
            generate_reports
            ;;
        "backend")
            run_backend_tests "all"
            ;;
        "dashboard")
            run_dashboard_tests "all"
            ;;
        "unit")
            run_backend_tests "unit"
            run_dashboard_tests "unit"
            ;;
        "integration")
            run_backend_tests "integration"
            run_dashboard_tests "integration"
            ;;
        "a11y"|"accessibility")
            run_dashboard_tests "a11y"
            ;;
        "performance")
            run_dashboard_tests "performance"
            ;;
        "quality")
            run_quality_checks
            ;;
        "watch")
            local watch_target="${2:-all}"
            if [ "$watch_target" = "backend" ]; then
                run_backend_tests "watch"
            elif [ "$watch_target" = "dashboard" ]; then
                run_dashboard_tests "watch"
            else
                log_error "Watch mode requires specifying 'backend' or 'dashboard'"
                exit 1
            fi
            ;;
        "ci")
            run_quality_checks
            run_backend_tests "ci"
            run_dashboard_tests "ci"
            generate_reports
            ;;
        "clean")
            cleanup_test_env
            ;;
        "setup")
            setup_test_env
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
    
    log_success "Test execution completed!"
}

# Execute main function with all arguments
main "$@"