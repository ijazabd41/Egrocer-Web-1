const http = require('http');

async function searchDiscountProduct() {
  const qReq = http.request({
    hostname: 'localhost', port: 3001, 
    path: `/proxy/api/bcp-product-template?domain=[('name','ilike','discount')]`, 
    method: 'GET',
    headers: { 'Origin': 'http://localhost' }
  }, qres => {
    let qraw = ''; qres.on('data', c => qraw += c); qres.on('end', () => {
      console.log('Search Result:', qraw);
    });
  });
  qReq.end();
}

searchDiscountProduct();
