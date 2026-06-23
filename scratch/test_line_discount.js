const http = require('http');

const ODOO = 'http://cooperp.freeddns.org:8076';
const DB = 'staging-apr17';

function postJson(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(`${ODOO}${path}`);
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };
    const req = http.request(opts, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        try {
          resolve({
            data: JSON.parse(respData),
            headers: res.headers
          });
        } catch(e) {
          resolve({ data: respData, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, params = {}, sessionToken = '') {
  return new Promise((resolve, reject) => {
    let url = `${ODOO}${path}`;
    const urlParams = new URLSearchParams();
    urlParams.set('by_AJR', '1');
    Object.entries(params).forEach(([k, v]) => urlParams.set(k, v));
    url += '?' + urlParams.toString();
    
    const u = new URL(url);
    const headers = {};
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken;
      headers['Cookie'] = `session_id=${sessionToken}`;
    }
    
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: 'GET',
      headers
    };
    
    http.get(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("Authenticating...");
  const authPayload = {
    jsonrpc: '2.0',
    method: 'call',
    id: 1,
    params: {
      db: DB,
      login: 'itcom1020@gmail.com',
      password: 'dds@123'
    }
  };
  
  try {
    const authRes = await postJson('/web/session/authenticate', authPayload);
    
    let sessionId = '';
    const sc = authRes.headers['set-cookie'];
    if (sc) {
      for (const c of sc) {
        const match = c.match(/session_id=([^;]+)/);
        if (match) sessionId = match[1];
      }
    }
    console.log("Session ID extracted:", sessionId);
    
    // Fetch a variant ID
    const productsRes = await getJson('/api/product', { limit: 5 }, sessionId);
    const variantId = productsRes.data?.[0]?.id;
    if (!variantId) {
      console.log("No product variant found");
      return;
    }
    
    // Create order
    const orderRes = await getJson('/api/order/create_order', { sources: 'COOPDISCOUNT-WEB', website_id: 1 }, sessionId);
    const orderId = orderRes.response?.[0]?.id;
    
    // Add product
    const addRes = await getJson('/api/order-line/create', { order_id: orderId, product_id: variantId }, sessionId);
    const lineId = addRes.data?.rec_id;
    console.log("Line created ID:", lineId);
    
    // Fetch line before update
    let lineObj = await getJson(`/api/order-line/${lineId}`, {}, sessionId);
    console.log("Line before discount update:", JSON.stringify(lineObj.data[0], null, 2));

    // Try updating line with discount: 5
    console.log("Updating line with discount: 5...");
    const updRes = await getJson(`/api/order-line/${lineId}/update`, { product_uom_qty: 1, discount: 5 }, sessionId);
    console.log("Update response:", updRes);
    
    // Fetch line after update
    lineObj = await getJson(`/api/order-line/${lineId}`, {}, sessionId);
    console.log("Line after discount update:", JSON.stringify(lineObj.data[0], null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
