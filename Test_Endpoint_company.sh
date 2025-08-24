#!/bin/bash

# Test HubSpot Companies API - crm.objects.companies.read scope
# This script tests the HubSpot Companies API to read company data

echo "Testing HubSpot Companies API..."
echo "================================"

curl -s "https://api.hubapi.com/crm/v3/objects/companies?limit=10&properties=name,domain,createdate,hs_lastmodifieddate,country,city,state,zip,industry" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "Test completed."