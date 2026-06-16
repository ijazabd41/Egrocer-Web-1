const http = require('http');

async function testFetchLine() {
  const em = 'test_1781644506312@test.com'; // User created in previous session
  const pw = 'password123';
  
  // 1. Authenticate
  const payload = JSON.stringify({
    jsonrpc: "2.0", method: "call", params: { db: "staging-apr17", login: em, password: pw }
  });
  
  const lReq = http.request({
    hostname: 'localhost', port: 3001, path: '/proxy/web/session/authenticate', method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost' }
  }, lres => {
    let cookie = lres.headers['set-cookie'] ? lres.headers['set-cookie'][0] : '';
    console.log('Got cookie:', cookie ? 'YES' : 'NO');
    
    const fetchReq = http.request({
      hostname: 'localhost', port: 3001, path: '/proxy/api/order-line/2058', method: 'GET',
      headers: { 'Origin': 'http://localhost', 'Cookie': cookie }
    }, fres => {
      let fraw = ''; fres.on('data', c => fraw += c); fres.on('end', () => {
        console.log('Fetch Line:', fraw);
      });
    });
    fetchReq.end();
  });
  lReq.write(payload);
  lReq.end();
}

testFetchLine();
