const http = require('http');

const ODOO = 'http://cooperp.freeddns.org:8076';

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const url = `${ODOO}${path}?by_AJR=1`;
    const body = JSON.stringify(payload);
    
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const testNumbers = ['71', '1', '2', '10', '100', '123'];
  console.log("Testing Shareholder Lookup on Odoo ERP...\n");
  for (const num of testNumbers) {
    try {
      const res = await post('/api/shareholder/lookup', {
        shareholder_number: num,
        partner_sequence: num
      });
      if (res.success || res.success === 1) {
        console.log(`✅ Number "${num}" works! Response:`, JSON.stringify(res, null, 2));
      } else {
        console.log(`❌ Number "${num}" fails:`, res.message || res.error || "Not found");
      }
    } catch (err) {
      console.log(`❌ Number "${num}" encountered error:`, err.message);
    }
  }
}

main();
