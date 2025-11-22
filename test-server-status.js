// test-server-status.js
// Quick script to check if the test server is running

const http = require('http');

const testUrl = 'http://localhost:8080/version.json';

console.log('Checking test server status...');
console.log(`Testing: ${testUrl}\n`);

const req = http.get(testUrl, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Test server is RUNNING!');
            console.log(`Response: ${data}`);
        } else {
            console.log(`❌ Server responded with status: ${res.statusCode}`);
        }
    });
});

req.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.log('❌ Test server is NOT running');
        console.log('\nTo start it, run:');
        console.log('  npm run test-server');
    } else {
        console.log(`❌ Error: ${err.message}`);
    }
});

req.setTimeout(3000, () => {
    req.destroy();
    console.log('❌ Connection timeout - server is not responding');
});

