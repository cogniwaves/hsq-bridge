/**
 * Test script for debugging Userfront authentication issues
 * This will help us understand what's happening with the API calls
 */

const fetch = require('node-fetch');

const WORKSPACE_ID = '8nwx667b';
const TEST_EMAIL = 'hsqba@ste-marie.ca';
const TEST_PASSWORD = process.argv[2] || 'test123'; // Pass password as argument

async function testUserfrontLogin() {
  console.log('Testing Userfront Authentication...');
  console.log('Workspace ID:', WORKSPACE_ID);
  console.log('Test Email:', TEST_EMAIL);
  console.log('-----------------------------------\n');

  try {
    // Test 1: Check if we can reach the Userfront API
    console.log('1. Testing API connectivity...');
    const healthCheck = await fetch('https://api.userfront.com/v0/tenants/' + WORKSPACE_ID, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    console.log('   API Response Status:', healthCheck.status);
    const healthData = await healthCheck.text();
    console.log('   Response:', healthData.substring(0, 200));
    console.log('');

    // Test 2: Check workspace configuration
    console.log('2. Testing workspace endpoint...');
    const workspaceCheck = await fetch(`https://api.userfront.com/v0/tenants/${WORKSPACE_ID}/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    console.log('   Workspace Response Status:', workspaceCheck.status);
    if (workspaceCheck.ok) {
      const workspaceData = await workspaceCheck.json();
      console.log('   Workspace Data:', JSON.stringify(workspaceData, null, 2).substring(0, 500));
    }
    console.log('');

    // Test 3: Attempt login (only if password provided)
    if (TEST_PASSWORD !== 'test123') {
      console.log('3. Testing login endpoint...');
      const loginPayload = {
        method: 'password',
        email: TEST_EMAIL,
        password: TEST_PASSWORD
        // Remove tenantId from the payload - it's not needed for login
      };
      
      console.log('   Login payload:', JSON.stringify(loginPayload, null, 2));
      
      const loginResponse = await fetch(`https://api.userfront.com/v0/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:13001',
          'Referer': 'http://localhost:13001/',
        },
        body: JSON.stringify(loginPayload)
      });

      console.log('   Login Response Status:', loginResponse.status);
      console.log('   Response Headers:', JSON.stringify(Object.fromEntries(loginResponse.headers.entries()), null, 2));
      
      const loginData = await loginResponse.json();
      console.log('   Login Response Body:', JSON.stringify(loginData, null, 2));
      
      if (loginData.tokens && loginData.tokens.accessToken) {
        console.log('\n✅ SUCCESS: Access token received!');
        console.log('   Token preview:', loginData.tokens.accessToken.substring(0, 50) + '...');
      } else {
        console.log('\n❌ FAILURE: No access token in response');
        console.log('   Response structure:', Object.keys(loginData));
      }
    } else {
      console.log('3. Skipping login test (no password provided)');
      console.log('   To test login, run: node test-userfront-auth.js <password>');
    }

  } catch (error) {
    console.error('❌ ERROR during testing:', error);
    console.error('   Error details:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response body:', await error.response.text());
    }
  }
}

// Run the test
testUserfrontLogin().then(() => {
  console.log('\n-----------------------------------');
  console.log('Test completed');
}).catch(err => {
  console.error('Test failed:', err);
});