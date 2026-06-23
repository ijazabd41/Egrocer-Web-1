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
      try {
        const j = JSON.parse(body);
        console.log('Keys in response:', Object.keys(j));
        if (j.data) {
           console.log('Keys in j.data:', Object.keys(j.data));
           if (j.data.store_manager_queue) console.log('manager queue:', j.data.store_manager_queue.length);
           if (j.data.store_keeper_queue) console.log('keeper queue:', j.data.store_keeper_queue.length);
           if (j.data.recent) console.log('recent orders:', j.data.recent.length);
           if (j.data.recent_orders) console.log('recent_orders:', j.data.recent_orders.length);
           if (j.data.results) console.log('results:', j.data.results.length);
           if (j.data.workflow_orders) console.log('workflow_orders:', j.data.workflow_orders.length);
        } else {
           console.log('Message:', j.message);
        }
      } catch(e) {
        console.log('Not JSON:', body.substring(0, 200));
      }
    });
  });
})();
