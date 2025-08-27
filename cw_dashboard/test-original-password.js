/**
 * Test the original password with a new email
 */

const https = require('https');

const WORKSPACE_ID = '8nwx667b';
const TEST_EMAIL = 'hsbb-test-' + Date.now() + '@ste-marie.ca'; // Unique email
const TEST_PASSWORD = 'vtp.keg.gmu1WFR6cyg'; // Original password with periods
const TEST_NAME = 'Test User';

async function testOriginalPassword() {
  console.log('===============================================');
  console.log('Testing Original Password with New Email');
  console.log('===============================================\n');
  
  console.log('Configuration:');
  console.log('  Workspace ID:', WORKSPACE_ID);
  console.log('  Email:', TEST_EMAIL);
  console.log('  Password:', TEST_PASSWORD);
  console.log('  Password Length:', TEST_PASSWORD.length);
  console.log('');
  
  const payload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
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
            console.log('\n✅ SUCCESS: Original password with periods ACCEPTED!');
            console.log('   User created successfully');
            console.log('   This proves the password itself is valid');
            console.log('\n🔍 ROOT CAUSE IDENTIFIED:');
            console.log('   The error was NOT due to the password.');
            console.log('   The email hsbb@ste-marie.ca was already registered.');
          } else if (res.statusCode === 400) {
            console.log('\n❌ FAILED:');
            console.log('Response Body:', JSON.stringify(responseData, null, 2));
            
            const errorMessage = responseData.message || responseData.error || '';
            if (errorMessage.toLowerCase().includes('password')) {
              console.log('\n⚠️  Password validation error:');
              console.log('   Message:', errorMessage);
              console.log('   This would mean there IS an issue with periods in passwords');
            } else {
              console.log('   Error:', errorMessage);
            }
          }
          
          resolve(responseData);
        } catch (e) {
          console.log('Response (raw):', data);
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

testOriginalPassword().catch(err => {
  console.error('Test failed:', err);
});