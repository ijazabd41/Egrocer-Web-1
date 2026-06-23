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
  try {
    const res = await get('/api/bcp-product-template?limit=1');
    if (res.data && res.data[0]) {
      console.log("Product fields:\n", JSON.stringify(res.data[0], null, 2));
    } else {
      console.log("No product found", res);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
