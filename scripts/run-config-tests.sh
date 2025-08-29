#!/bin/bash

# Configuration Management Test Runner Script
# Comprehensive test execution with coverage reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Configuration Management Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to run backend tests
run_backend_tests() {
    echo -e "\n${YELLOW}Running Backend Tests...${NC}"
    cd "$PROJECT_ROOT/cw_app"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing backend dependencies...${NC}"
        npm install
    fi
    
    # Generate Prisma client
    echo -e "${YELLOW}Generating Prisma client...${NC}"
    npm run db:generate
    
    # Run different test suites
    echo -e "\n${GREEN}Running Unit Tests...${NC}"
    npm test -- --testMatch="**/tests/unit/**/*.test.ts" --coverage
    
    echo -e "\n${GREEN}Running Integration Tests...${NC}"
    npm test -- --testMatch="**/tests/integration/**/*.test.ts" --coverage
    
    if [ "$1" == "--e2e" ]; then
        echo -e "\n${GREEN}Running E2E Tests...${NC}"
        
        # Start test database
        echo -e "${YELLOW}Starting test database...${NC}"
        docker compose -f ../docker-compose.test.yml up -d postgres redis
        
        # Wait for database
        sleep 5
        
        # Run migrations on test database
        DATABASE_URL="postgresql://test:test@localhost:5433/test_db" npm run db:push
        
        # Run E2E tests
        npm test -- --testMatch="**/tests/e2e/**/*.test.ts" --coverage
        
        # Stop test containers
        docker compose -f ../docker-compose.test.yml down
    fi
    
    # Generate coverage report
    echo -e "\n${GREEN}Generating backend coverage report...${NC}"
    npm run test:coverage || true
}

# Function to run frontend tests
run_frontend_tests() {
    echo -e "\n${YELLOW}Running Frontend Tests...${NC}"
    cd "$PROJECT_ROOT/cw_dashboard"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        npm install
    fi
    
    # Run component tests
    echo -e "\n${GREEN}Running Component Tests...${NC}"
    npm test -- --testMatch="**/__tests__/components/configuration/**/*.test.tsx" --coverage
    
    # Run integration tests
    echo -e "\n${GREEN}Running Frontend Integration Tests...${NC}"
    npm test -- --testMatch="**/__tests__/integration/**/*.test.tsx" --coverage
    
    # Run accessibility tests
    echo -e "\n${GREEN}Running Accessibility Tests...${NC}"
    npm run test:a11y
    
    # Generate coverage report
    echo -e "\n${GREEN}Generating frontend coverage report...${NC}"
    npm run test:coverage || true
}

# Function to run security tests
run_security_tests() {
    echo -e "\n${YELLOW}Running Security Tests...${NC}"
    
    cd "$PROJECT_ROOT/cw_app"
    
    # Run security-focused tests
    npm test -- --testMatch="**/tests/**/*security*.test.ts" --coverage
    
    # Run dependency audit
    echo -e "\n${GREEN}Running dependency audit...${NC}"
    npm audit --production || true
    
    cd "$PROJECT_ROOT/cw_dashboard"
    npm audit --production || true
}

# Function to run performance tests
run_performance_tests() {
    echo -e "\n${YELLOW}Running Performance Tests...${NC}"
    
    cd "$PROJECT_ROOT/cw_app"
    
    # Run performance-focused tests
    npm test -- --testMatch="**/tests/**/*performance*.test.ts" --coverage
    
    cd "$PROJECT_ROOT/cw_dashboard"
    
    # Run frontend performance tests
    npm run test:performance
}

# Function to generate combined report
generate_report() {
    echo -e "\n${YELLOW}Generating Combined Test Report...${NC}"
    
    # Create report directory
    REPORT_DIR="$PROJECT_ROOT/test-reports"
    mkdir -p "$REPORT_DIR"
    
    # Copy backend coverage
    if [ -d "$PROJECT_ROOT/cw_app/coverage" ]; then
        cp -r "$PROJECT_ROOT/cw_app/coverage" "$REPORT_DIR/backend-coverage"
    fi
    
    # Copy frontend coverage
    if [ -d "$PROJECT_ROOT/cw_dashboard/coverage" ]; then
        cp -r "$PROJECT_ROOT/cw_dashboard/coverage" "$REPORT_DIR/frontend-coverage"
    fi
    
    # Create summary report
    cat > "$REPORT_DIR/summary.md" << EOF
# Configuration Management Test Report

Generated: $(date)

## Test Coverage Summary

### Backend Tests
- Unit Tests: ✅ Completed
- Integration Tests: ✅ Completed
- E2E Tests: $([ "$1" == "--e2e" ] && echo "✅ Completed" || echo "⏭️ Skipped")

### Frontend Tests
- Component Tests: ✅ Completed
- Integration Tests: ✅ Completed
- Accessibility Tests: ✅ Completed

### Additional Tests
- Security Tests: $([ "$2" == "--security" ] && echo "✅ Completed" || echo "⏭️ Skipped")
- Performance Tests: $([ "$3" == "--performance" ] && echo "✅ Completed" || echo "⏭️ Skipped")

## Coverage Reports
- Backend: [View Report](./backend-coverage/index.html)
- Frontend: [View Report](./frontend-coverage/index.html)

## Test Configuration
- Coverage Threshold: 80%
- Test Timeout: 30s (60s for E2E)
- Parallel Execution: Enabled

EOF
    
    echo -e "${GREEN}Report generated at: $REPORT_DIR/summary.md${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker is not installed${NC}"
        exit 1
    fi
    
    # Check PostgreSQL client (for E2E tests)
    if [ "$1" == "--e2e" ] && ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}Warning: PostgreSQL client not found (optional for E2E tests)${NC}"
    fi
    
    echo -e "${GREEN}Prerequisites check passed${NC}"
}

# Main execution
main() {
    # Parse arguments
    RUN_E2E=false
    RUN_SECURITY=false
    RUN_PERFORMANCE=false
    RUN_ALL=false
    
    for arg in "$@"; do
        case $arg in
            --e2e)
                RUN_E2E=true
                ;;
            --security)
                RUN_SECURITY=true
                ;;
            --performance)
                RUN_PERFORMANCE=true
                ;;
            --all)
                RUN_ALL=true
                RUN_E2E=true
                RUN_SECURITY=true
                RUN_PERFORMANCE=true
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --e2e          Run E2E tests (requires Docker)"
                echo "  --security     Run security tests"
                echo "  --performance  Run performance tests"
                echo "  --all          Run all test suites"
                echo "  --help         Show this help message"
                exit 0
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites $RUN_E2E
    
    # Start timer
    START_TIME=$(date +%s)
    
    # Run tests
    run_backend_tests $RUN_E2E
    run_frontend_tests
    
    if [ "$RUN_SECURITY" = true ]; then
        run_security_tests
    fi
    
    if [ "$RUN_PERFORMANCE" = true ]; then
        run_performance_tests
    fi
    
    # Generate report
    generate_report $RUN_E2E $RUN_SECURITY $RUN_PERFORMANCE
    
    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${GREEN}✅ All tests completed successfully!${NC}"
    echo -e "${GREEN}Duration: ${DURATION} seconds${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    # Open coverage report if available
    if command -v open &> /dev/null && [ -f "$PROJECT_ROOT/test-reports/backend-coverage/index.html" ]; then
        echo -e "\n${YELLOW}Opening coverage report in browser...${NC}"
        open "$PROJECT_ROOT/test-reports/backend-coverage/index.html"
    fi
}

# Handle errors
trap 'echo -e "${RED}Test execution failed${NC}"; exit 1' ERR

# Run main function
main "$@"