const http = require('http');

const ODOO = 'http://cooperp.freeddns.org:8076';

function get(path, params = {}) {
  return new Promise((resolve, reject) => {
    let url = `${ODOO}${path}`;
    const urlParams = new URLSearchParams();
    urlParams.set('by_AJR', '1');
    Object.entries(params).forEach(([k, v]) => urlParams.set(k, v));
    url += '?' + urlParams.toString();
    
    http.get(url, (res) => {
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
  console.log("Creating a test order...");
  try {
    // Create order
    const orderRes = await get('/api/order/create_order', { sources: 'COOPDISCOUNT-WEB', website_id: 1 });
    console.log("Create order response:", orderRes);
    const orderId = orderRes.response?.[0]?.id;
    if (!orderId) return;
    
    // Add product variant 78562 (AL AIN FARMS FRESH LABAN 250 ML)
    console.log("Adding product variant...");
    const addRes = await get('/api/order-line/create', { order_id: orderId, product_id: 78562 });
    console.log("Add product response:", addRes);
    
    // Get order details
    let ord = await get(`/api/order/${orderId}`);
    console.log("Order before discount:", JSON.stringify(ord.data[0], ['id', 'name', 'amount_untaxed', 'amount_tax', 'amount_total', 'amount_discount', 'order_line'], 2));

    // Try updating order with amount_discount or discount_rate or similar
    console.log("Trying to update order with amount_discount...");
    const updRes = await get(`/api/order/${orderId}/update`, { amount_discount: 5 });
    console.log("Update amount_discount response:", updRes);
    
    ord = await get(`/api/order/${orderId}`);
    console.log("Order after amount_discount update:", JSON.stringify(ord.data[0], ['id', 'name', 'amount_untaxed', 'amount_tax', 'amount_total', 'amount_discount'], 2));

    console.log("Trying to update order with note/carrier to see if it works...");
    const updRes2 = await get(`/api/order/${orderId}/update`, { carrier_id: 3 });
    console.log("Update carrier response:", updRes2);
    
    ord = await get(`/api/order/${orderId}`);
    console.log("Order after carrier update:", JSON.stringify(ord.data[0], ['id', 'name', 'amount_untaxed', 'amount_tax', 'amount_total', 'carrier_id'], 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
