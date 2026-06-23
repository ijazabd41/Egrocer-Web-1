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
    
    if (!sessionId) {
      console.log("Auth failed, no session ID");
      return;
    }
    
    // Fetch a variant ID
    console.log("Fetching product variants...");
    const productsRes = await getJson('/api/product', { limit: 5 }, sessionId);
    console.log("Products:", JSON.stringify(productsRes.data, null, 2));
    const variantId = productsRes.data?.[0]?.id;
    if (!variantId) {
      console.log("No product variant found");
      return;
    }
    console.log("Found variant ID:", variantId);
    
    // Create order
    console.log("Creating order...");
    const orderRes = await getJson('/api/order/create_order', { sources: 'COOPDISCOUNT-WEB', website_id: 1 }, sessionId);
    console.log("Create order response:", orderRes);
    const orderId = orderRes.response?.[0]?.id;
    if (!orderId) return;
    
    // Add product
    console.log("Adding product...");
    const addRes = await getJson('/api/order-line/create', { order_id: orderId, product_id: variantId }, sessionId);
    console.log("Add product response:", addRes);
    
    // Try updating order with amount_discount
    console.log("Trying to update order with amount_discount...");
    const updRes = await getJson(`/api/order/${orderId}/update`, { amount_discount: 5 }, sessionId);
    console.log("Update amount_discount response:", updRes);
    
    // Fetch order
    let ord = await getJson(`/api/order/${orderId}`, {}, sessionId);
    console.log("Order totals after update:", JSON.stringify(ord.data[0], ['id', 'name', 'amount_untaxed', 'amount_tax', 'amount_total', 'amount_discount', 'order_line'], 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
