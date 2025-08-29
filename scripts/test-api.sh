#!/bin/bash

# API Testing Script  
# Comprehensive API endpoint testing with health checks and integration tests

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:13000}"
API_KEY_ADMIN="${API_KEY_ADMIN:-test_admin_key}"
API_KEY_READ="${API_KEY_READ:-test_read_key}"
TIMEOUT=30
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Function to make API requests
api_request() {
    local method="$1"
    local endpoint="$2" 
    local data="$3"
    local auth_type="${4:-admin}"
    local expected_status="${5:-200}"
    
    local auth_header=""
    case $auth_type in
        "admin")
            auth_header="X-API-Key: $API_KEY_ADMIN"
            ;;
        "read")
            auth_header="X-API-Key: $API_KEY_READ"
            ;;
        "bearer")
            auth_header="Authorization: Bearer $data"
            data=""
            ;;
        "none")
            auth_header=""
            ;;
    esac
    
    local curl_args=("-s" "-w" "%{http_code}" "-o" "/tmp/api_response.json")
    
    if [ "$VERBOSE" = true ]; then
        curl_args+=("-v")
    fi
    
    if [ -n "$auth_header" ]; then
        curl_args+=("-H" "$auth_header")
    fi
    
    curl_args+=("-H" "Content-Type: application/json")
    curl_args+=("-X" "$method")
    
    if [ -n "$data" ] && [ "$data" != "" ]; then
        curl_args+=("-d" "$data")
    fi
    
    curl_args+=("$API_BASE_URL$endpoint")
    
    local status_code=$(curl "${curl_args[@]}")
    local response_body=$(cat /tmp/api_response.json 2>/dev/null || echo "{}")
    
    if [ "$status_code" -eq "$expected_status" ]; then
        log_success "$method $endpoint - Status: $status_code"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $response_body" | jq -r '.' 2>/dev/null || echo "$response_body"
        fi
        return 0
    else
        log_error "$method $endpoint - Expected: $expected_status, Got: $status_code"
        echo "Response: $response_body" | jq -r '.' 2>/dev/null || echo "$response_body"
        return 1
    fi
}

# Health check tests
test_health_endpoints() {
    log_info "Testing health endpoints..."
    
    # Basic health check
    api_request "GET" "/health" "" "none" 200 || return 1
    
    # Detailed health check  
    api_request "GET" "/health/detailed" "" "admin" 200 || return 1
    
    # API info
    api_request "GET" "/api/" "" "none" 200 || return 1
    
    log_success "All health endpoints passed"
}

# Authentication tests
test_authentication() {
    log_info "Testing authentication..."
    
    # Test admin access
    api_request "GET" "/api/admin/status" "" "admin" 200 || return 1
    
    # Test read-only access
    api_request "GET" "/api/invoices" "" "read" 200 || return 1
    
    # Test unauthorized access
    api_request "GET" "/api/admin/status" "" "none" 401 || return 1
    
    # Test invalid API key
    API_KEY_ADMIN="invalid_key"
    api_request "GET" "/api/admin/status" "" "admin" 401 || return 1
    
    # Restore valid API key
    API_KEY_ADMIN="${API_KEY_ADMIN:-test_admin_key}"
    
    log_success "Authentication tests passed"
}

# Invoice API tests
test_invoice_endpoints() {
    log_info "Testing invoice endpoints..."
    
    # List invoices
    api_request "GET" "/api/invoices" "" "read" 200 || return 1
    
    # List invoices with pagination
    api_request "GET" "/api/invoices?page=1&limit=10" "" "read" 200 || return 1
    
    # Get invoice by ID (should return 404 for non-existent invoice)
    api_request "GET" "/api/invoices/non-existent-id" "" "read" 404 || return 1
    
    # Create invoice (admin only)
    local invoice_data='{"amount": 100.00, "currency": "USD", "description": "Test invoice"}'
    api_request "POST" "/api/invoices" "$invoice_data" "admin" 201 || return 1
    
    # Try creating invoice with read-only access (should fail)
    api_request "POST" "/api/invoices" "$invoice_data" "read" 403 || return 1
    
    log_success "Invoice endpoints tests passed"
}

# Payment API tests  
test_payment_endpoints() {
    log_info "Testing payment endpoints..."
    
    # List payments
    api_request "GET" "/api/payments" "" "read" 200 || return 1
    
    # List payments with filters
    api_request "GET" "/api/payments?status=succeeded&limit=5" "" "read" 200 || return 1
    
    # Get payment by ID (should return 404 for non-existent payment)
    api_request "GET" "/api/payments/non-existent-id" "" "read" 404 || return 1
    
    log_success "Payment endpoints tests passed"
}

# Sync API tests
test_sync_endpoints() {
    log_info "Testing sync endpoints..."
    
    # Get sync status
    api_request "GET" "/api/sync/status" "" "admin" 200 || return 1
    
    # Get sync logs
    api_request "GET" "/api/sync/logs" "" "admin" 200 || return 1
    
    # Trigger manual sync (should be async)
    api_request "POST" "/api/sync/trigger" '{"source": "hubspot", "dryRun": true}' "admin" 202 || return 1
    
    log_success "Sync endpoints tests passed"
}

# Webhook tests
test_webhook_endpoints() {
    log_info "Testing webhook endpoints..."
    
    # Test HubSpot webhook endpoint (should return 400 for invalid signature)
    api_request "POST" "/api/webhooks/hubspot" '{"test": "data"}' "none" 400 || return 1
    
    # Test Stripe webhook endpoint (should return 400 for invalid signature)
    api_request "POST" "/api/webhooks/stripe" '{"test": "data"}' "none" 400 || return 1
    
    log_success "Webhook endpoints tests passed"
}

# Rate limiting tests
test_rate_limiting() {
    log_info "Testing rate limiting..."
    
    # Make multiple requests to trigger rate limiting
    local rate_limit_exceeded=false
    for i in {1..25}; do
        if ! api_request "GET" "/api/invoices" "" "read" 200; then
            if [ "$i" -gt 20 ]; then
                rate_limit_exceeded=true
                log_info "Rate limit triggered after $i requests"
                break
            fi
        fi
        sleep 0.1
    done
    
    if [ "$rate_limit_exceeded" = true ]; then
        log_success "Rate limiting is working correctly"
    else
        log_warning "Rate limiting may not be properly configured"
    fi
}

# Error handling tests
test_error_handling() {
    log_info "Testing error handling..."
    
    # Test invalid JSON
    api_request "POST" "/api/invoices" '{"invalid": json}' "admin" 400 || return 1
    
    # Test missing required fields
    api_request "POST" "/api/invoices" '{}' "admin" 400 || return 1
    
    # Test invalid endpoint
    api_request "GET" "/api/nonexistent" "" "admin" 404 || return 1
    
    # Test method not allowed
    api_request "DELETE" "/api/invoices" "" "admin" 405 || return 1
    
    log_success "Error handling tests passed"
}

# Performance tests (basic)
test_performance() {
    log_info "Running basic performance tests..."
    
    # Time a simple request
    local start_time=$(date +%s%3N)
    api_request "GET" "/health" "" "none" 200 || return 1
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if [ "$duration" -lt 1000 ]; then
        log_success "Health endpoint response time: ${duration}ms (Good)"
    elif [ "$duration" -lt 2000 ]; then
        log_warning "Health endpoint response time: ${duration}ms (Acceptable)"
    else
        log_error "Health endpoint response time: ${duration}ms (Slow)"
    fi
    
    # Test concurrent requests
    log_info "Testing concurrent requests..."
    for i in {1..5}; do
        api_request "GET" "/health" "" "none" 200 &
    done
    wait
    
    log_success "Concurrent requests completed"
}

# Service dependency tests
test_service_dependencies() {
    log_info "Testing service dependencies..."
    
    # Test database connectivity
    api_request "GET" "/api/admin/db-status" "" "admin" 200 || return 1
    
    # Test Redis connectivity  
    api_request "GET" "/api/admin/cache-status" "" "admin" 200 || return 1
    
    log_success "Service dependency tests passed"
}

# Wait for API to be ready
wait_for_api() {
    log_info "Waiting for API to be ready..."
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -s "$API_BASE_URL/health" > /dev/null 2>&1; then
            log_success "API is ready"
            return 0
        fi
        
        attempts=$((attempts + 1))
        log_info "Attempt $attempts/$max_attempts - waiting..."
        sleep 2
    done
    
    log_error "API failed to become ready after $max_attempts attempts"
    return 1
}

# Main test suite
run_all_tests() {
    log_info "Starting comprehensive API tests..."
    log_info "Target API: $API_BASE_URL"
    
    # Wait for API to be ready
    wait_for_api || exit 1
    
    local failed_tests=0
    
    # Run all test suites
    test_health_endpoints || ((failed_tests++))
    test_authentication || ((failed_tests++))
    test_invoice_endpoints || ((failed_tests++))
    test_payment_endpoints || ((failed_tests++))
    test_sync_endpoints || ((failed_tests++))
    test_webhook_endpoints || ((failed_tests++))
    test_error_handling || ((failed_tests++))
    test_rate_limiting || ((failed_tests++))
    test_performance || ((failed_tests++))
    test_service_dependencies || ((failed_tests++))
    
    if [ $failed_tests -eq 0 ]; then
        log_success "All API tests passed! 🎉"
        return 0
    else
        log_error "$failed_tests test suite(s) failed"
        return 1
    fi
}

# Show help
show_help() {
    cat << EOF
API Testing Script for HSQ Bridge

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  all              Run all API tests (default)
  health           Test health endpoints
  auth             Test authentication
  invoices         Test invoice endpoints
  payments         Test payment endpoints
  sync             Test sync endpoints
  webhooks         Test webhook endpoints
  errors           Test error handling
  rate-limit       Test rate limiting
  performance      Run performance tests
  dependencies     Test service dependencies
  
Options:
  --api-url URL    API base URL (default: $API_BASE_URL)
  --admin-key KEY  Admin API key (default: from env)
  --read-key KEY   Read API key (default: from env)
  --verbose        Verbose output
  --timeout N      Request timeout in seconds (default: $TIMEOUT)
  --help           Show this help

Examples:
  $0                                      # Run all tests
  $0 health --verbose                     # Test health with verbose output
  $0 auth --api-url http://localhost:3000 # Test auth on different URL
  $0 performance --timeout 10             # Performance test with 10s timeout

EOF
}

# Parse command line arguments
main() {
    local command="${1:-all}"
    
    # Parse options
    shift 2>/dev/null || true
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api-url)
                API_BASE_URL="$2"
                shift 2
                ;;
            --admin-key)
                API_KEY_ADMIN="$2" 
                shift 2
                ;;
            --read-key)
                API_KEY_READ="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
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
    
    # Execute command
    case $command in
        "all")
            run_all_tests
            ;;
        "health")
            test_health_endpoints
            ;;
        "auth")
            test_authentication
            ;;
        "invoices")
            test_invoice_endpoints
            ;;
        "payments")
            test_payment_endpoints
            ;;
        "sync")
            test_sync_endpoints
            ;;
        "webhooks")
            test_webhook_endpoints
            ;;
        "errors")
            test_error_handling
            ;;
        "rate-limit")
            test_rate_limiting
            ;;
        "performance")
            test_performance
            ;;
        "dependencies")
            test_service_dependencies
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Cleanup on exit
cleanup() {
    rm -f /tmp/api_response.json
}
trap cleanup EXIT

# Run main function
main "$@"