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
  console.log("Listing products...");
  try {
    const res = await get('/api/bcp-product-template?limit=100');
    console.log("Products count:", res.data ? res.data.length : 0);
    if (res.data) {
      const names = res.data.map(p => `${p.id}: ${p.name} (${p.display_name})`);
      console.log("Product list:\n", names.join('\n'));
    }
  } catch (err) {
    console.error("Error listing products:", err);
  }
}

main();
