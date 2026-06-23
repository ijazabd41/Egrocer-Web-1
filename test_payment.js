const http = require('http');

function req(path, method, bodyStr, cookie, csrf) {
  return new Promise(resolve => {
    const pathWithCsrf = path + (csrf && !path.includes('?') ? `?csrf_token=${csrf}` : (csrf ? `&csrf_token=${csrf}` : ''));
    const headers = { 
      'Cookie': cookie || '', 
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    };
    
    const q = http.request({
      hostname: '127.0.0.1', port: 3001,
      path: '/proxy' + pathWithCsrf, method, headers
    }, res => {
      let b = '';
      let c = cookie || '';
      (res.headers['set-cookie'] || []).forEach(cc => { if(cc.includes('session_id')) c = cc.split(';')[0]; });
      res.on('data', d => b += d);
      res.on('end', () => resolve({ body: b, status: res.statusCode, cookie: c }));
    });
    
    q.write(bodyStr);
    q.end();
  });
}

(async () => {
  // 1. Get session
  let r1 = await new Promise(resolve => {
    http.get('http://127.0.0.1:3001/proxy/shop', res => {
      let b = '', c = '';
      (res.headers['set-cookie'] || []).forEach(cc => { if(cc.includes('session_id')) c = cc.split(';')[0]; });
      res.on('data', d => b+=d);
      res.on('end', () => resolve({ body: b, cookie: c }));
    });
  });
  let sid = r1.cookie;
  const csrf = r1.body.match(/csrf_token:\s*"([^"]+)"/)?.[1] || '';

  // 2. Add to cart
  const cartBody = JSON.stringify({
    jsonrpc: '2.0', method: 'call', params: { 
       add_qty: 1, product_template_id: 75056, product_id: 73419, quantity: 1,
       no_variant_attribute_values: [], product_custom_attribute_values: []
    }
  });
  let rCart = await new Promise(resolve => {
    const q = http.request({
      hostname: '127.0.0.1', port: 3001, path: '/proxy/shop/cart/add', method: 'POST',
      headers: { 'Cookie': sid, 'Content-Type': 'application/json' }
    }, res => {
      let b = ''; res.on('data', d=>b+=d); res.on('end', ()=>resolve({status:res.statusCode,body:b}));
    });
    q.write(cartBody); q.end();
  });

  // 3. Postman Exact Payload
  const postmanPayload = {
    "id": 0,
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "partner_id": -1,
      "mode": "new",
      "name": "Test Test",
      "email": "test@example.com",
      "phone": "0555944719",
      "street": "test32",
      "street2": "",
      "city": "Dubai",
      "zip": "7878",
      "country_id": 233,
      "state_id": false
    }
  };
  
  let t1 = await req('/shop/address/submit?by_AJR=1', 'POST', JSON.stringify(postmanPayload), sid, csrf);
  console.log('Postman Exact Payload ->', t1.status, t1.body);

})();
