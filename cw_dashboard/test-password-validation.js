/**
 * Direct test of Userfront password validation issue
 * Tests the specific password that's being rejected
 */

const https = require('https');

const WORKSPACE_ID = '8nwx667b';
const TEST_EMAIL = 'hsbb@ste-marie.ca';
const TEST_PASSWORD = 'vtp.keg.gmu1WFR6cyg';
const TEST_NAME = 'Test User';

// Analyze password characteristics
function analyzePassword(password) {
  const analysis = {
    password: password,
    length: password.length,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /[0-9]/.test(password),
    hasSpecialChars: /[^A-Za-z0-9]/.test(password),
    specialChars: password.match(/[^A-Za-z0-9]/g) || [],
    numbers: password.match(/[0-9]/g) || [],
    uppercase: password.match(/[A-Z]/g) || [],
    lowercase: password.match(/[a-z]/g) || [],
    meetsLengthRequirement: password.length >= 16,
    meetsAlternativeRequirement: password.length >= 8 && /[0-9]/.test(password) && /[a-zA-Z]/.test(password)
  };
  
  return analysis;
}

// Test direct API call to Userfront
async function testUserfrontSignup() {
  console.log('===============================================');
  console.log('Testing Userfront Password Validation');
  console.log('===============================================\n');
  
  console.log('Configuration:');
  console.log('  Workspace ID:', WORKSPACE_ID);
  console.log('  Email:', TEST_EMAIL);
  console.log('  Password:', TEST_PASSWORD);
  console.log('  Name:', TEST_NAME);
  console.log('');
  
  // Analyze password
  const analysis = analyzePassword(TEST_PASSWORD);
  console.log('Password Analysis:');
  console.log('  Length:', analysis.length, '(requirement: >= 16 OR >= 8 with number and letter)');
  console.log('  Has Uppercase:', analysis.hasUpperCase, analysis.uppercase.join(', '));
  console.log('  Has Lowercase:', analysis.hasLowerCase, analysis.lowercase.join(', '));
  console.log('  Has Numbers:', analysis.hasNumbers, analysis.numbers.join(', '));
  console.log('  Has Special Chars:', analysis.hasSpecialChars, analysis.specialChars.join(', '));
  console.log('  Meets Length Requirement (>=16):', analysis.meetsLengthRequirement);
  console.log('  Meets Alternative Requirement (>=8 + number + letter):', analysis.meetsAlternativeRequirement);
  console.log('');
  
  // Prepare request payload - NO method or tenantId fields!
  const payload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: TEST_NAME
  });
  
  console.log('Request Payload:');
  console.log(JSON.stringify(JSON.parse(payload), null, 2));
  console.log('');
  
  // Prepare request options
  const options = {
    hostname: 'api.userfront.com',
    port: 443,
    path: `/v0/tenants/${WORKSPACE_ID}/auth/create`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Origin': 'http://localhost:13001',
      'Referer': 'http://localhost:13001/'
    }
  };
  
  console.log('Making API Request to:', `https://${options.hostname}${options.path}`);
  console.log('');
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
        console.log('');
        
        try {
          const responseData = JSON.parse(data);
          console.log('Response Body:');
          console.log(JSON.stringify(responseData, null, 2));
          
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('\n✅ SUCCESS: User created successfully!');
            if (responseData.tokens && responseData.tokens.access) {
              console.log('Access token received');
            }
          } else if (res.statusCode === 400) {
            console.log('\n❌ VALIDATION ERROR:');
            if (responseData.message) {
              console.log('  Message:', responseData.message);
            }
            if (responseData.error) {
              console.log('  Error:', responseData.error);
            }
            if (responseData.errors) {
              console.log('  Errors:', JSON.stringify(responseData.errors, null, 2));
            }
            
            // Check if it's specifically a password issue
            const errorMessage = responseData.message || responseData.error || '';
            if (errorMessage.toLowerCase().includes('password')) {
              console.log('\n⚠️  This appears to be a password validation issue.');
              console.log('   The password meets the stated requirements but is still being rejected.');
              console.log('\nPossible causes:');
              console.log('   1. Hidden password requirements not mentioned in error message');
              console.log('   2. Special character (.) might be causing issues');
              console.log('   3. Server-side validation bug');
              console.log('   4. Workspace-specific password rules');
            }
          } else {
            console.log('\n❌ UNEXPECTED ERROR:');
            console.log('  Status:', res.statusCode);
          }
          
          resolve(responseData);
        } catch (e) {
          console.log('Response Body (raw):', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Request Error:', e.message);
      reject(e);
    });
    
    req.write(payload);
    req.end();
  });
}

// Alternative test without special characters
async function testAlternativePassword() {
  console.log('\n\n===============================================');
  console.log('Testing Alternative Password (without periods)');
  console.log('===============================================\n');
  
  const ALT_PASSWORD = 'vtpkegmu1WFR6cyg'; // Same password but without periods
  const ALT_EMAIL = 'hsbb-test2@ste-marie.ca';
  
  const analysis = analyzePassword(ALT_PASSWORD);
  console.log('Alternative Password:', ALT_PASSWORD);
  console.log('  Length:', analysis.length);
  console.log('  Meets Requirements:', analysis.meetsLengthRequirement || analysis.meetsAlternativeRequirement);
  console.log('');
  
  const payload = JSON.stringify({
    email: ALT_EMAIL,
    password: ALT_PASSWORD,
    name: TEST_NAME
  });
  
  const options = {
    hostname: 'api.userfront.com',
    port: 443,
    path: `/v0/tenants/${WORKSPACE_ID}/auth/create`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Origin': 'http://localhost:13001',
      'Referer': 'http://localhost:13001/'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        
        try {
          const responseData = JSON.parse(data);
          
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ Alternative password ACCEPTED');
            console.log('   This suggests periods might be causing the issue');
          } else if (res.statusCode === 400) {
            const errorMessage = responseData.message || responseData.error || '';
            if (errorMessage.toLowerCase().includes('password')) {
              console.log('❌ Alternative password also REJECTED');
              console.log('   Error:', errorMessage);
              console.log('   This suggests the issue is NOT related to special characters');
            } else if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('exists')) {
              console.log('⚠️  Email already exists, cannot test alternative password');
            } else {
              console.log('❌ Error:', errorMessage);
            }
          }
          
          resolve(responseData);
        } catch (e) {
          console.log('Response:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Request Error:', e.message);
      reject(e);
    });
    
    req.write(payload);
    req.end();
  });
}

// Run tests
async function runTests() {
  try {
    // Test original password
    await testUserfrontSignup();
    
    // Test alternative password
    await testAlternativePassword();
    
    console.log('\n===============================================');
    console.log('Testing Complete');
    console.log('===============================================');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();