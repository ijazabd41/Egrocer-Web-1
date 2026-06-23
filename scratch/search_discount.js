const http = require('http');

const ODOO = 'http://cooperp.freeddns.org:8076';

function get(path) {
  return new Promise((resolve, reject) => {
    const url = `${ODOO}${path}${path.includes('?') ? '&' : '?'}by_AJR=1`;
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
  console.log("Searching for discount products...");
  try {
    const res = await get('/api/bcp-product-template?domain=[("name","ilike","discount")]');
    console.log("Discount search results:", JSON.stringify(res, null, 2));
    
    const res2 = await get('/api/bcp-product-template?domain=[("name","ilike","pickup")]');
    console.log("Pickup search results:", JSON.stringify(res2, null, 2));
  } catch (err) {
    console.error("Error searching products:", err);
  }
}

main();
