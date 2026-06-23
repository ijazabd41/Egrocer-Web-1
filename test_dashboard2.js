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

  http.get('http://127.0.0.1:3001/proxy/api/skytec-delivery/dashboard?by_AJR=1&status=delivered&limit=25&offset=0', {
    headers: { 'Cookie': sid }
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      const j = JSON.parse(body);
      console.log('recent:', j.data.recent.length);
      console.log('realtime_orders:', j.data.realtime_orders?.length);
      console.log('workflow_orders:', j.data.workflow_orders?.length);
      console.log('filtered_total:', j.data.filtered_total);
    });
  });
})();
