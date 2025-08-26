/**
 * Enhanced debugging script for Userfront authentication
 * This script tests the actual Userfront SDK behavior
 */

// Test using the actual @userfront/core package
const Userfront = require('@userfront/core');

const WORKSPACE_ID = '8nwx667b';
const TEST_EMAIL = 'hsqba@ste-marie.ca';
const TEST_PASSWORD = process.argv[2];

async function debugUserfrontSDK() {
  console.log('===========================================');
  console.log('Userfront SDK Authentication Debug');
  console.log('===========================================');
  console.log('Workspace ID:', WORKSPACE_ID);
  console.log('Test Email:', TEST_EMAIL);
  console.log('Password provided:', !!TEST_PASSWORD);
  console.log('');

  try {
    // Initialize Userfront with workspace ID
    console.log('1. Initializing Userfront SDK...');
    Userfront.init(WORKSPACE_ID);
    console.log('   ✓ Userfront initialized with workspace:', WORKSPACE_ID);
    console.log('');

    // Check current user state
    console.log('2. Checking current user state...');
    console.log('   User:', Userfront.user);
    console.log('   IsLoggedIn:', Userfront.isLoggedIn);
    console.log('   Tokens:', Userfront.tokens);
    console.log('');

    if (TEST_PASSWORD) {
      console.log('3. Attempting login via SDK...');
      
      try {
        const loginOptions = {
          method: 'password',
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          redirect: false  // Important: prevent redirect
        };
        
        console.log('   Login options:', JSON.stringify({ ...loginOptions, password: '***' }, null, 2));
        
        const response = await Userfront.login(loginOptions);
        
        console.log('');
        console.log('   ✓ Login completed');
        console.log('   Response type:', typeof response);
        console.log('   Response keys:', Object.keys(response || {}));
        console.log('   Full response:', JSON.stringify(response, null, 2));
        console.log('');
        
        // Check post-login state
        console.log('4. Post-login state:');
        console.log('   User:', Userfront.user);
        console.log('   IsLoggedIn:', Userfront.isLoggedIn);
        console.log('   Tokens:', Userfront.tokens);
        console.log('   Access Token:', Userfront.tokens?.accessToken ? 'Present' : 'Missing');
        console.log('');
        
        if (Userfront.tokens?.accessToken) {
          console.log('✅ SUCCESS: Authentication working correctly');
          console.log('   Access token received');
          console.log('   User ID:', Userfront.user?.userId);
          console.log('   Email:', Userfront.user?.email);
        } else {
          console.log('❌ PROBLEM: No access token after login');
          console.log('   This indicates an issue with the authentication flow');
        }
        
      } catch (loginError) {
        console.error('   ❌ Login failed:', loginError.message);
        console.error('   Error details:', loginError);
        
        // Check if it's a credentials error
        if (loginError.message?.includes('password') || loginError.message?.includes('email')) {
          console.log('   → This appears to be a credentials issue');
        } else {
          console.log('   → This may be a configuration or API issue');
        }
      }
      
    } else {
      console.log('3. Skipping login test (no password provided)');
      console.log('   Usage: node debug-userfront.js <password>');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.error('   Stack trace:', error.stack);
  }

  console.log('');
  console.log('===========================================');
  console.log('Debug session complete');
  console.log('===========================================');
}

// Run the debug session
debugUserfrontSDK().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});