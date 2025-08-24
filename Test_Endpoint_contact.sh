#!/bin/bash

# Test HubSpot Contacts API - crm.objects.contacts.read scope
# This script tests the HubSpot Contacts API to read contact data

echo "Testing HubSpot Contacts API..."
echo "==============================="

curl -s "https://api.hubapi.com/crm/v3/objects/contacts?limit=10&properties=email,firstname,lastname,company,phone,createdate,lastmodifieddate,jobtitle,country,city" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "Test completed."