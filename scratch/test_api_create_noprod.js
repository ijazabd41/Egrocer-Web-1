const http = require('http');

async function testApiCreateLineNoProd() {
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
    
    // 2. Create Order
    const oReq = http.request({
      hostname: 'localhost', port: 3001, path: '/proxy/api/order/create_order?sources=COOPDISCOUNT-WEB&by_AJR=1', method: 'GET',
      headers: { 'Origin': 'http://localhost', 'Cookie': cookie }
    }, ores => {
      let oraw = ''; ores.on('data', c => oraw += c); ores.on('end', () => {
        const odata = JSON.parse(oraw);
        const oid = odata.response?.[0]?.id || odata.data?.[0]?.id || odata.data?.id;
        console.log('Created Order ID:', oid);
        
        // 3. /api/order-line/create without product_id
        const qReq = http.request({
          hostname: 'localhost', port: 3001, 
          path: `/proxy/api/order-line/create?order_id=${oid}&price_unit=-5.0&name=DiscountTestNoProd&display_type=line_note`, 
          method: 'GET',
          headers: { 'Origin': 'http://localhost', 'Cookie': cookie }
        }, qres => {
          let qraw = ''; qres.on('data', c => qraw += c); qres.on('end', () => {
            console.log('Create Line Result:', qraw);
          });
        });
        qReq.end();
      });
    });
    oReq.end();
  });
  lReq.write(payload);
  lReq.end();
}

testApiCreateLineNoProd();
