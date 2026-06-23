const http = require('http');

(async () => {
  let r1 = await new Promise(resolve => {
    http.get('http://127.0.0.1:3001/proxy/shop', res => {
      let b = '', c = '';
      (res.headers['set-cookie'] || []).forEach(cc => { if(cc.includes('session_id')) c = cc.split(';')[0]; });
      res.on('data', d => b+=d);
      res.on('end', () => resolve({ body: b, cookie: c }));
    });
  });
  let sid = r1.cookie;

  http.get('http://127.0.0.1:3001/proxy/api/skytec-delivery/orders?by_AJR=1&state=delivered&limit=25&offset=0', {
    headers: { 'Cookie': sid }
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      const j = JSON.parse(body);
      console.log('results:', j.data.results.length);
      console.log('total:', j.data.total);
    });
  });
})();
