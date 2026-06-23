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
  console.log("Fetching loyalty programs...");
  try {
    const res = await get('/api/loyalty-program');
    console.log("Loyalty programs:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Error fetching loyalty programs:", err);
  }
}

main();
