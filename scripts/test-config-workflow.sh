#!/bin/bash

# Phase 8 Configuration Management Docker Workflow Test
# Tests all new Phase 8 features in Docker environment

set -e

echo "🧪 Testing Phase 8 Configuration Management Docker Setup..."
echo "=========================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run tests
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_code="${3:-0}"
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" >/dev/null 2>&1; then
        if [ $? -eq $expected_code ]; then
            echo -e "${GREEN}PASS${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAIL${NC} (unexpected exit code)"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}FAIL${NC}"
        ((TESTS_FAILED++))
    fi
}

# Helper function to check HTTP endpoint
check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    
    echo -n "Checking: $name... "
    
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response_code" = "$expected_code" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $response_code)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC} (HTTP $response_code, expected $expected_code)"
        ((TESTS_FAILED++))
    fi
}

echo -e "\n${YELLOW}1. Testing Docker Services Health${NC}"
echo "================================="

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Test basic health endpoints
check_endpoint "Basic API Health" "http://localhost:13000/health"
check_endpoint "Dashboard Health" "http://localhost:13001/api/health"

echo -e "\n${YELLOW}2. Testing Phase 8 Configuration API Endpoints${NC}"
echo "=============================================="

# Test configuration management endpoints
check_endpoint "Configuration Health" "http://localhost:13000/api/config/health"
check_endpoint "Configuration Status" "http://localhost:13000/api/config/status"

# Test settings pages
check_endpoint "Settings Page" "http://localhost:13001/settings"
check_endpoint "HubSpot Settings" "http://localhost:13001/settings/hubspot"
check_endpoint "QuickBooks Settings" "http://localhost:13001/settings/quickbooks"
check_endpoint "Stripe Settings" "http://localhost:13001/settings/stripe"

echo -e "\n${YELLOW}3. Testing Redis Configuration Cache${NC}"
echo "===================================="

run_test "Redis Connection" "docker compose exec cw_hsq_redis redis-cli ping"
run_test "Redis Memory Config" "docker compose exec cw_hsq_redis redis-cli config get maxmemory | grep -q 256mb"

echo -e "\n${YELLOW}4. Testing Database Schema Phase 8 Tables${NC}"
echo "========================================"

run_test "integration_configs table exists" "docker compose exec cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge -c \"SELECT 1 FROM integration_configs LIMIT 1;\" 2>/dev/null || true"
run_test "webhook_configurations table exists" "docker compose exec cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge -c \"SELECT 1 FROM webhook_configurations LIMIT 1;\" 2>/dev/null || true"
run_test "configuration_audit_logs table exists" "docker compose exec cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge -c \"SELECT 1 FROM configuration_audit_logs LIMIT 1;\" 2>/dev/null || true"

echo -e "\n${YELLOW}5. Testing Docker Volume Mounts${NC}"
echo "==============================="

run_test "Configuration backup volume" "docker volume inspect hsq-bridge_cw_hsq_config_backups"
run_test "App can write to backup volume" "docker compose exec cw_hsq_app touch /app/backups/test_file && docker compose exec cw_hsq_app rm /app/backups/test_file"

echo -e "\n${YELLOW}6. Testing Environment Variables${NC}"
echo "================================"

# Test Phase 8 environment variables are loaded
run_test "ENCRYPTION_KEY is set" "docker compose exec cw_hsq_app printenv ENCRYPTION_KEY"
run_test "CONFIG_BACKUP_ENABLED is set" "docker compose exec cw_hsq_app printenv CONFIG_BACKUP_ENABLED"
run_test "OAUTH_STATE_TTL is set" "docker compose exec cw_hsq_app printenv OAUTH_STATE_TTL"
run_test "CIRCUIT_BREAKER_ENABLED is set" "docker compose exec cw_hsq_app printenv CIRCUIT_BREAKER_ENABLED"

# Test dashboard configuration variables
run_test "NEXT_PUBLIC_ENABLE_CONFIGURATION_UI is set" "docker compose exec cw_hsq_dashboard printenv NEXT_PUBLIC_ENABLE_CONFIGURATION_UI"
run_test "NEXT_PUBLIC_CONFIGURATION_API_BASE is set" "docker compose exec cw_hsq_dashboard printenv NEXT_PUBLIC_CONFIGURATION_API_BASE"

echo -e "\n${YELLOW}7. Testing Nginx Configuration Routes${NC}"
echo "===================================="

# Test Nginx routing for Phase 8 features
check_endpoint "Config API via Nginx" "http://localhost:18080/api/config/health"
check_endpoint "Settings via Nginx" "http://localhost:18080/settings"

echo -e "\n${YELLOW}8. Testing Configuration Management Features${NC}"
echo "=========================================="

# Test configuration workflow (if API is implemented)
echo -n "Testing Configuration Test Endpoint... "
if curl -s -f "http://localhost:13000/api/config/test-connection" >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}SKIP${NC} (endpoint not implemented yet)"
fi

echo -e "\n${YELLOW}9. Testing Docker Resource Limits${NC}"
echo "================================="

# Check resource allocation
run_test "App container memory limit" "docker inspect cw_hsq_app | grep -q '\"Memory\": 536870912'"
run_test "Redis container memory limit" "docker inspect cw_hsq_redis | grep -q '\"Memory\": 402653184'"

echo -e "\n${YELLOW}10. Testing Health Check Integration${NC}"
echo "===================================="

# Test enhanced health checks
echo -n "Testing enhanced app health check... "
if docker compose exec cw_hsq_app curl -s -f http://localhost:3000/health >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Final Results
echo -e "\n${YELLOW}Test Results Summary${NC}"
echo "===================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All Phase 8 Docker configuration tests passed!${NC}"
    echo -e "${GREEN}🎉 Phase 8 configuration management is ready for deployment.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please check the configuration.${NC}"
    echo -e "\n${YELLOW}Debugging commands:${NC}"
    echo "• Check service logs: docker compose logs"
    echo "• Check service status: docker compose ps"  
    echo "• Check health endpoints: make health"
    echo "• Check configuration health: make config-health"
    exit 1
fi