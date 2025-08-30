#!/bin/bash

# Test script for Configuration Management API endpoints
# Requires a valid JWT token from authentication

API_URL="${API_URL:-http://localhost:3000}"
JWT_TOKEN="${JWT_TOKEN:-}"

if [ -z "$JWT_TOKEN" ]; then
    echo "Please set JWT_TOKEN environment variable"
    echo "You can get a token by logging in via the dashboard or using the /api/auth/login endpoint"
    exit 1
fi

echo "Testing Configuration Management API endpoints..."
echo "==========================================="
echo ""

# Test 1: Get overall configuration status
echo "1. Testing GET /api/config/status"
curl -s -X GET \
  "${API_URL}/api/config/status" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# Test 2: Get HubSpot configuration
echo "2. Testing GET /api/config/hubspot"
curl -s -X GET \
  "${API_URL}/api/config/hubspot" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# Test 3: Get Stripe configuration
echo "3. Testing GET /api/config/stripe"
curl -s -X GET \
  "${API_URL}/api/config/stripe" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# Test 4: Get QuickBooks configuration
echo "4. Testing GET /api/config/quickbooks"
curl -s -X GET \
  "${API_URL}/api/config/quickbooks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# Test 5: Test all connections
echo "5. Testing GET /api/config/test-connections"
curl -s -X GET \
  "${API_URL}/api/config/test-connections" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# Test 6: Get webhook configurations
echo "6. Testing GET /api/config/webhooks"
curl -s -X GET \
  "${API_URL}/api/config/webhooks" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "---"
echo ""

# Test 7: Get audit logs (requires admin role)
echo "7. Testing GET /api/config/audit-logs"
curl -s -X GET \
  "${API_URL}/api/config/audit-logs?limit=5" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "==========================================="
echo "Configuration API tests completed!"
echo ""
echo "To test write operations (POST endpoints), you need ADMIN or OWNER role and should use them carefully:"
echo "  - POST /api/config/hubspot - Update HubSpot configuration"
echo "  - POST /api/config/stripe - Update Stripe configuration"
echo "  - POST /api/config/quickbooks/initiate - Start QuickBooks OAuth"
echo "  - POST /api/config/webhooks - Configure webhooks"
echo "  - DELETE /api/config/{platform} - Remove platform configuration (OWNER only)"