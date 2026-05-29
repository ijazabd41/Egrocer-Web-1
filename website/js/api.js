/**
 * Coop Discounts API v8 — Final Complete Build
 * Based on: 20260519_V1___CD_COM_postman_collection__3_.json + PDF guide
 *
 * ═══════════════════════════════════════════════════════════════
 * CRITICAL ENDPOINT CHANGES IN THIS COLLECTION:
 * ───────────────────────────────────────────────────────────────
 * CATEGORIES:   /api/bcd-website-category  (was /api/website-category)
 * PRODUCTS:     /api/bcp-product-template  (was /api/product-template)
 * PRODUCT DETAIL: /api/bcp-product-template/{id}
 * ORDER CREATE: ?sources=COOPDISCOUNT-WEB  (REQUIRED param)
 * USER IMAGE:   /web/image/res.partner/{pid}/image_1920
 * UPDATE LINE:  GET /api/order-line/{rec_id}/update?by_AJR=1&product_uom_qty={qty} (Postman)
 *
 * ORDER LINE QTY FLOW (per Postman):
 * 1. Save product_variant_id when adding to cart
 * 2. GET /api/order/{order_id} → find order_lines where product_variant_id matches → extract id = rec_id
 * 3. GET /api/order-line/{rec_id}/update?by_AJR=1&product_uom_qty={qty}
 * 4. GET /api/order-line-qty/{rec_id} → update UI counter
 * 5. If qty=0 → update with qty=0 → remove from cart UI
 *
 * IMAGE PATHS (ALL are paths → must prepend /proxy):
 * - image_1024 field: /web/image/product.template/123/image_1024
 * - banner_image:     /web/image/deal.day.slider/12/banner_image
 * - slider images:    image_ids[].id → /proxy/web/image/slider.image/{id}/image
 * - partner image:    /proxy/web/image/res.partner/{pid}/image_1920
 *
 * SESSION: session_id from cookie after login → send as X-Session-Token header
 * ORDER COMPLETE: invoice_ids[] AND picking_ids[] both non-empty
 * NOTIFICATION: on any API error → notify eicoopit@gmail.com (console log for now)
 * ═══════════════════════════════════════════════════════════════
 */

const API = ((_DB='staging-apr17', SK='cd_session', NOTIFY='eicoopit@gmail.com') => {
  const API_BUILD = '8.4';

  // ── PROXY BASE URL ─────────────────────────────────────────────
  // Auto-detect: when opened from file:// or a different host, use the full
  // proxy server URL. When served by the proxy itself, use a relative path.
  const PROXY_PORT = '3001';
  const PX = (() => {
    if (typeof location === 'undefined') return '/proxy';               // Node/SSR
    if (location.protocol === 'file:') return `http://localhost:${PROXY_PORT}/proxy`;  // opened from filesystem
    // If served from the proxy's own port, use relative path
    if (location.port === PROXY_PORT) return '/proxy';
    // Otherwise point to the proxy on localhost
    return `http://localhost:${PROXY_PORT}/proxy`;
  })();
  const DB = _DB;

  // ── SESSION ───────────────────────────────────────────────────
  const sess      = () => { try { return JSON.parse(localStorage.getItem(SK)||'null'); } catch(_){ return null; } };
  const saveSess  = d  => { try { localStorage.setItem(SK, JSON.stringify(d)); } catch(_){} };
  const clearSess = ()  => { localStorage.removeItem(SK); localStorage.removeItem('cd_oid'); };
  const loggedIn  = ()  => !!(sess() && sess().uid);
  const me        = ()  => sess();
  const myPid     = ()  => { const s=sess(); if(!s)return null; return Array.isArray(s.partner_id)?s.partner_id[0]:s.partner_id; };
  const mySessionId = () => sess()?.session_id||'';
  const myUserId  = ()  => sess()?.uid||null;
  const myName    = ()  => sess()?.name||'';

  // ── IMAGE HELPERS ─────────────────────────────────────────────
  // ALL image fields are PATHS — MUST prepend proxy base to display
  const img        = p  => p ? PX+p : '';
  const prodImg    = id => `${PX}/web/image/product.template/${id}/image_1024`;
  const catImg     = id => `${PX}/web/image/product.public.category/${id}/image_1024`;
  const sliderImg  = id => `${PX}/web/image/slider.image/${id}/image`;
  const partnerImg = pid=> `${PX}/web/image/res.partner/${pid}/image_1920`;
  const bannerImg  = id => `${PX}/web/image/deal.day.slider/${id}/banner_image`;
  const invPdfUrl  = (id,tok) => `${PX}/my/invoices/${id}?access_token=${tok}&report_type=pdf&download=true`;

  // ── LOGGING ───────────────────────────────────────────────────
  // Toggle: localStorage.setItem('cd_debug','0') to silence, '1' for all API calls
  const Log = (() => {
    const PREFIX = '[Coop Discounts]';
    const ORDER_RE = /\/api\/order|order-line|\/web\/session|payment-provider/;

    function level() {
      try {
        const v = localStorage.getItem('cd_debug');
        if (v === '0') return 'off';
        if (v === '2') return 'verbose';
      } catch (_) {}
      return 'normal';
    }
    function enabled() { return level() !== 'off'; }
    function verbose() { return level() === 'verbose'; }
    function setLevel(l) {
      const map = { off: '0', normal: '1', verbose: '2', '0': '0', '1': '1', '2': '2' };
      try { localStorage.setItem('cd_debug', map[l] ?? '1'); } catch (_) {}
    }
    function stamp() { return new Date().toISOString().slice(11, 23); }
    function payload(scope, event, data) {
      const row = { t: stamp(), scope, event };
      if (data !== undefined) row.data = data;
      return row;
    }
    function debug(scope, event, data) {
      if (!enabled()) return;
      console.debug(PREFIX, payload(scope, event, data));
    }
    function info(scope, event, data) {
      if (!enabled()) return;
      console.info(PREFIX, payload(scope, event, data));
    }
    function warn(scope, event, data) {
      console.warn(PREFIX, payload(scope, event, data));
    }
    function error(scope, event, data) {
      console.error(PREFIX, payload(scope, event, data));
    }
    function isOrderPath(path) { return ORDER_RE.test(path || ''); }
    function sanitizeParams(p) {
      if (!p || typeof p !== 'object') return p;
      const out = { ...p };
      ['password', 'token', 'access_token'].forEach(k => { if (k in out) out[k] = '***'; });
      return out;
    }
    function summarize(path, d) {
      if (!d || typeof d !== 'object') return {};
      if (path.includes('create_order')) {
        const rec = d.response?.[0] || d.data?.[0] || d.data;
        return { orderId: rec?.id, name: rec?.name };
      }
      if (path.includes('order-line/create')) return { rec_id: d.data?.rec_id, message: d.data?.message };
      if (path.includes('/update')) return { rec_id: d.data?.rec_id, message: d.data?.message, success: d.success };
      if (/\/api\/order\/\d+$/.test(path)) {
        const o = Array.isArray(d.data) ? d.data[0] : d.data;
        const lines = o?.order_line || o?.order_lines || [];
        return { orderId: o?.id, name: o?.name, state: o?.state, lineCount: lines.length, total: o?.amount_total };
      }
      if (path.includes('/order-line') && Array.isArray(d.data)) return { lineCount: d.data.length, ids: d.data.map(l => l.id).slice(0, 8) };
      if (d.success !== undefined) return { success: d.success };
      return {};
    }
    function apiStart(method, path, params) {
      if (!enabled()) return;
      const data = { method, path };
      if (params && Object.keys(params).length) data.params = sanitizeParams(params);
      if (isOrderPath(path) || verbose()) info('API', '→ request', data);
      else debug('API', '→ request', data);
    }
    function apiDone(method, path, status, ms, body) {
      if (!enabled()) return;
      const data = { method, path, status, ms };
      if (isOrderPath(path) || verbose()) Object.assign(data, summarize(path, body));
      if (isOrderPath(path) || verbose()) info('API', '← response', data);
      else debug('API', '← response', data);
    }
    function apiFail(method, path, status, ms, err, rawSnippet) {
      error('API', '✗ failed', {
        method, path, status, ms,
        message: err?.message || String(err),
        body: rawSnippet ? rawSnippet.substring(0, 400) : undefined
      });
    }
    return { debug, info, warn, error, enabled, verbose, setLevel, isOrderPath, apiStart, apiDone, apiFail, sanitizeParams, summarize };
  })();

  // ── ERROR NOTIFICATION ────────────────────────────────────────
  function notifyError(endpoint, error) {
    Log.error('API', 'notify', { endpoint, message: error.message || String(error), notify: NOTIFY });
  }

  // ── HTTP ──────────────────────────────────────────────────────
  function mkUrl(path, p={}) {
    // Build a full URL — PX is already absolute when needed (file:// or cross-origin)
    let fullPath;
    if (path.startsWith('http')) {
      fullPath = path;
    } else {
      fullPath = PX + path;
    }
    const u = fullPath.startsWith('http')
      ? new URL(fullPath)
      : new URL(fullPath, location.origin);
    // Odoo list params (args, domain, line_ids) must keep literal brackets — URLSearchParams encodes them wrong.
    const ODOO_LIST_KEYS = new Set(['args', 'domain', 'line_ids']);
    const listParams = [];
    const normal = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (ODOO_LIST_KEYS.has(k)) listParams.push([k, String(v)]);
      else normal[k] = String(v);
    });
    u.searchParams.set('by_AJR', '1');
    Object.entries(normal).forEach(([k, v]) => u.searchParams.set(k, v));
    let url = u.toString();
    for (const [k, v] of listParams) {
      url += (url.includes('?') ? '&' : '?') + k + '=' + v;
    }
    return url;
  }
  function hdrs() {
    const h = { 'Content-Type':'application/json' };
    const s = mySessionId();
    if(s) h['X-Session-Token'] = s;
    return h;
  }
  /** Map Odoo ACL / access errors to a short message customers can act on. */
  function normalizeApiErrorMessage(msg) {
    if (!msg) return msg;
    const s = String(msg);
    if (/not allowed to access/i.test(s) && /sale\.order|Sales Order/i.test(s)) {
      return 'Your login does not have permission to manage shop orders. The store administrator must assign your user the Portal role (or Sales / Own Documents) in Odoo, then you should sign out and sign in again.';
    }
    if (/AccessError|access rights|security groups/i.test(s)) {
      return 'Permission denied on the server. Please contact Coop Discounts support — your account may need the Portal customer role enabled.';
    }
    return s.length > 280 ? s.substring(0, 280) + '…' : s;
  }

  function isOdooAccessError(err) {
    const m = (err && err.message) ? String(err.message) : String(err || '');
    // Only treat sale.order access errors as "order access" errors.
    // Payment Transaction access errors should NOT trigger Cart.clear().
    if (/not allowed to access/i.test(m) && /sale\.order|Sales Order/i.test(m)) return true;
    // Also match errors explicitly flagged as access errors on order endpoints
    if (err && err.isAccessError && /\/api\/order\//i.test(m)) return true;
    return false;
  }

  /** Pull a human message from Odoo HTML/JSON error bodies. */
  function parseErrorBody(rawBody, status, path) {
    if (!rawBody) return null;
    const pathL = String(path || '').toLowerCase();

    try {
      const body = JSON.parse(rawBody);
      const m = body.message || body.error || body.detail
        || body.result?.message || body.result?.error;
      if (m) return String(m);
      if (body.success === 0 && (body.message || body.error)) return String(body.message || body.error);
    } catch (_) {}

    const html = rawBody.toLowerCase().includes('<html');
    if (!html) return rawBody.length > 500 ? rawBody.substring(0, 500) : rawBody;

    const odooMsg = [
      /UserError[^(]*\(\s*['"]([^'"]+)['"]/,
      /ValidationError[^(]*\(\s*['"]([^'"]+)['"]/,
      /AccessError[^(]*\(\s*['"]([^'"]+)['"]/,
      /<div[^>]*class="[^"]*alert[^"]*alert-danger[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ].map(re => rawBody.match(re)).find(m => m && m[1]);
    if (odooMsg) {
      const t = odooMsg[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (t.length > 8) return t;
    }

    const text = rawBody.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (/not allowed to access/i.test(text)) {
      const slice = text.match(/You are not allowed[\s\S]{0,350}/i);
      return slice ? slice[0] : text.substring(0, 280);
    }
    if (/loyalty|coupon|reward|points|insufficient/i.test(text)) {
      const i = text.search(/loyalty|coupon|reward|not enough|insufficient|points/i);
      if (i >= 0) return text.substring(i, i + 240).trim();
    }

    if (status === 400 || status === 422) {
      if (/order-line/.test(pathL)) {
        return 'Could not add this product to your order. Try removing the item and adding it again from the shop, or start a new cart.';
      }
      if (/order_transaction_mark_done|get_or_create_transaction/.test(pathL)) {
        return 'Could not confirm payment on the server. The order may have a stale payment from a previous attempt — try again, or contact support with your order number.';
      }
      if (/loyalty|apply_loyalty|coupon/.test(pathL)) {
        return 'Could not apply this loyalty code. Make sure you are signed in, the code is yours, the cart has products, and you have enough points.';
      }
      if (/\/order/.test(pathL)) {
        return 'Could not update this order on the server. Try refreshing the page or contact support if it continues.';
      }
      if (/contacts|registration|new_registration/.test(pathL)) {
        return 'Invalid data or duplicate entry (e.g. email or phone already registered).';
      }
      return `The server rejected this request (HTTP ${status}).`;
    }
    if (status === 400 && !html) {
      return rawBody.length > 200 ? rawBody.substring(0, 200) : rawBody;
    }
    if (status >= 500) return 'Server error. Please try again later.';
    return `Server returned an error page (HTTP ${status}).`;
  }

  async function extractError(r, path, method = 'GET', ms = 0) {
    let msg = `HTTP ${r.status}`;
    let rawBody = '';
    try {
      rawBody = await r.text();
      const parsed = parseErrorBody(rawBody, r.status, path);
      if (parsed) msg = parsed;
    } catch (_) {}

    msg = normalizeApiErrorMessage(msg);
    Log.apiFail(method, path, r.status, ms, new Error(msg), rawBody);
    const e = new Error(msg);
    e.isAccessError = /not allowed to access/i.test(msg);
    notifyError(path, e);
    throw e;
  }

  async function httpRequest(method, path, p = {}, body = null) {
    const url = method === 'POST' && body != null && !Object.keys(p).length ? mkUrl(path) : mkUrl(path, p);
    Log.apiStart(method, path, method === 'POST' && body ? { bodyKeys: Object.keys(body) } : p);
    const t0 = performance.now();
    const opts = { method, credentials: 'include', headers: hdrs() };
    if (body != null) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const ms = Math.round(performance.now() - t0);
    if (!r.ok) return extractError(r, path, method, ms);
    const d = await r.json();
    if (d.success === 0) {
      const msg = normalizeApiErrorMessage(d.message || d.error || 'API error');
      Log.apiFail(method, path, r.status, ms, new Error(msg));
      const e = new Error(msg);
      e.isAccessError = /not allowed to access/i.test(msg);
      notifyError(path, e);
      throw e;
    }
    const sidHeader = r.headers.get('X-Set-Session-Token');
    if (sidHeader) d.__session_id = sidHeader;
    Log.apiDone(method, path, r.status, ms, d);
    return d;
  }

  async function GET(path, p={}) {
    return httpRequest('GET', path, p);
  }
  async function PUT(path, p={}) {
    return httpRequest('PUT', path, p);
  }
  async function POST(path, body={}) {
    return httpRequest('POST', path, {}, body);
  }
  function getGeo() {
    return new Promise(res => {
      if(!navigator.geolocation) return res({});
      navigator.geolocation.getCurrentPosition(
        p => res({ lat:p.coords.latitude, lng:p.coords.longitude }),
        () => res({}), { timeout:3000 }
      );
    });
  }

  // ── AUTH ──────────────────────────────────────────────────────
  async function login(emailOrPhone, password) {
    const d = await POST('/web/session/authenticate', {
      jsonrpc:'2.0', method:'call', id:1,
      params: { db:DB, login:emailOrPhone, password }
    });
    
    if (d.error) {
      return { ok:false, err: d.error.data?.message || d.error.message || 'Invalid credentials' };
    }
    
    const r = d.result;
    if(!r?.uid) return { ok:false, err:r?.message||'Invalid credentials' };
    
    let sessionId = d.__session_id || r.session_id || '';
    if (!sessionId) {
      const sidM = document.cookie.match(/session_id=([^;]+)/);
      sessionId = sidM ? sidM[1] : '';
    }
    const session = {
      uid: r.uid, name: r.name||'', username: r.username||emailOrPhone,
      partner_id: r.partner_id, user_id: r.uid,
      lang: r.user_context?.lang||'en_US', tz: r.user_context?.tz||'Asia/Dubai',
      session_id: sessionId, login_time: Date.now()
    };
    saveSess(session);
    // After login: update contact with device/geo info
    const pid = Array.isArray(r.partner_id) ? r.partner_id[0] : r.partner_id;
    if(pid) {
      const geo = await getGeo();
      const devId = 'web-' + (navigator.platform||'browser').replace(/[^a-zA-Z0-9]/g,'').substring(0,20);
      GET(`/api/contacts/${pid}/update`, {
        name: r.name||'', email: emailOrPhone.includes('@')?emailOrPhone:'',
        phone: emailOrPhone.includes('@')?'':emailOrPhone,
        deviceid: devId, firebase:'', latitude:geo.lat||'', longitude:geo.lng||''
      }).catch(()=>{});
    }
    return { ok:true, data:session };
  }

  async function logout() {
    try { await GET('/web/session/logout'); } catch(_){}
    clearSess();
  }

  // Register by email or mobile — both use same endpoint
  const register = (name,email,phone,password='',devId='web') =>
    GET('/api/contacts/new_registration', {name,email,phone,password,
      deviceid:devId, firebase:'',latitude:'',longitude:''});

  const updatePassword = (uid, pw) => GET(`/api/user/${uid}/update`, { password:pw });

  // ── STARTUP / SLIDERS ─────────────────────────────────────────
  // Logo:       /api/deal-day-slider/12 → banner_image = path → img(banner_image)
  // Sliders:    /api/deal-day-slider/9  → image_ids[].id → sliderImg(id)
  // Deals etc:  /api/deal-day-slider/{2,1,3,4,5,8} → image_ids[].id
  const getLogo        = () => GET('/api/deal-day-slider/12');
  const getHomeSliders = () => GET('/api/deal-day-slider/9');
  const getDealOfDay   = () => GET('/api/deal-day-slider/2');
  const getBestSeller  = () => GET('/api/deal-day-slider/1');
  const getRecommended = () => GET('/api/deal-day-slider/3');
  const getFeatured    = () => GET('/api/deal-day-slider/4');
  const getFreshPick   = () => GET('/api/deal-day-slider/5');
  const getBrands      = () => GET('/api/deal-day-slider/8');
  const getAllDeals     = () => GET('/api/deal-day-slider');
  const getDealById    = id  => GET(`/api/deal-day-slider/${id}`);

  // ── WEB SETTINGS ──────────────────────────────────────────────
  const initSettings = () => GET('/api/config-settings/create', { user_id:'2' });
  const getSettings  = () => GET('/api/config-settings', { user_id:'2' });

  // ── CATEGORIES ────────────────────────────────────────────────
  // NEW ENDPOINT: /api/bcd-website-category (updated in this collection)
  // image_1024 = PATH → API.img(c.image_1024)
  const getCats    = () => GET('/api/bcd-website-category');
  const getCatById = id  => GET(`/api/bcd-website-category/${id}`);

  // ── PRODUCTS ──────────────────────────────────────────────────
  // NEW ENDPOINT: /api/bcp-product-template (updated in this collection)
  // image_1024 = PATH → API.img(p.image_1024) to display
  // product_variant_id[].id = variant ID for order lines
  const getProds    = (p={}) => GET('/api/bcp-product-template', p);
  const getProdById = id     => GET(`/api/bcp-product-template/${id}`);
  const searchProds = q      => GET('/api/bcp-product-template', {domain:`[('name','ilike','${q.replace(/'/g,"\\'")}')]`});
  const byBarcode   = bc     => GET('/api/bcp-product-template', {domain:`[('barcode','=','${bc}')]`});
  const getVariants = ()     => GET('/api/product');

  // ── ORDERS ────────────────────────────────────────────────────
  // MUST include sources=COOPDISCOUNT-WEB
  // Response: response[0].id, response[0].name
  // Order complete when: invoice_ids[] AND picking_ids[] both non-empty
  async function createOrder() {
    Log.info('Order', 'createOrder → start', { partner_id: myPid() });
    const params = { sources: 'COOPDISCOUNT-WEB', website_id: 1 };
    const pid = myPid();
    if (pid) params.partner_id = pid;
    const d = await GET('/api/order/create_order', params);
    const rec = d.response?.[0] || d.data?.[0] || d.data;
    if(!rec?.id) throw new Error('Order creation failed: ' + JSON.stringify(d));
    Log.info('Order', 'createOrder ✓', { orderId: rec.id, name: rec.name });
    return { id:rec.id, name:rec.name };
  }
  async function abandonCheckoutOrder(orderId) {
    const oid = parseInt(orderId, 10);
    try {
      await updOrder(oid, {
        note: '[COOPDISCOUNT-WEB ABANDONED — payment retry]',
        origin: 'COOPDISCOUNT-WEB-ABANDONED',
        client_order_ref: `abandoned-${Date.now()}`,
      });
    } catch (_) {}
    Log.warn('Order', 'abandoned poisoned checkout order', { orderId: oid });
  }
  /**
   * create_order often returns the same draft quotation. If it has stuck payment
   * transactions (e.g. tx 153 on order 168), abandon it and request a clean draft.
   */
  async function ensureCleanCheckoutOrder(maxAttempts = 4) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const ro = await createOrder();
      const oid = ro.id;
      let order;
      try {
        order = await fetchOrderRecord(oid);
      } catch (_) {
        return ro;
      }
      if (await isOrderConfirmed(oid)) {
        if (typeof Cart !== 'undefined' && Cart.markPlaced) Cart.markPlaced(oid);
        continue;
      }
      const txs = orderTransactions(order);
      const pending = txs.filter(isPendingTransaction);
      if (!pending.length) return ro;

      Log.warn('Order', 'draft has pending payment transactions — trying to settle or abandon', {
        orderId: oid, txIds: pending.map(t => t.id), attempt: attempt + 1,
      });

      let settled = false;
      for (const tx of pending) {
        const prov = txProviderId(tx) || 22;
        for (const p of [prov, 22, 6]) {
          try {
            await markDone(oid, tx.id, p);
            settled = true;
            break;
          } catch (_) {}
        }
      }
      if (settled && await isOrderConfirmed(oid)) {
        if (typeof Cart !== 'undefined' && Cart.markPlaced) Cart.markPlaced(oid);
        continue;
      }

      await abandonCheckoutOrder(oid);
      if (typeof Cart !== 'undefined' && Cart.markPlaced) Cart.markPlaced(oid);
    }
    return createOrder();
  }
  async function prepareOrderForPayment(orderId) {
    const oid = parseInt(orderId, 10);
    const pid = myPid();
    const fields = { website_id: 1, origin: 'COOPDISCOUNT-WEB' };
    if (pid) {
      fields.partner_id = pid;
      fields.partner_invoice_id = pid;
      fields.partner_shipping_id = pid;
    }
    await updOrder(oid, fields);
    Log.info('Order', 'prepareOrderForPayment ✓', { orderId: oid, partner_id: pid });
  }
  function orderStateKey(o) {
    if (!o) return '';
    return Array.isArray(o.state) ? o.state[0] : (o.state || '');
  }
  function isDraftOrder(o) {
    const k = orderStateKey(o);
    return !k || k === 'draft' || k === 'sent';
  }
  /** Draft quotation that already went through checkout (note / origin set). */
  function isOrderSubmitted(o) {
    if (!o) return false;
    const note = String(o.note || '').trim();
    const origin = String(o.origin || '').trim();
    if (note.includes('[STORE PICKUP]')) return true;
    if (/\|/.test(note) && (note.includes('@') || /\d{7,}/.test(note))) return true;
    if (/coopmart|coopdiscount/i.test(origin)) return true;
    return false;
  }
  async function isOrderDraft(orderId) {
    try {
      const d = await getOrder(orderId);
      const o = Array.isArray(d.data) ? d.data[0] : d.data;
      return isDraftOrder(o);
    } catch(_) { return false; }
  }
  async function isOrderReusable(orderId) {
    try {
      const d = await getOrder(orderId);
      const o = Array.isArray(d.data) ? d.data[0] : d.data;
      if (!o || !isDraftOrder(o)) return false;
      if (isOrderSubmitted(o)) return false;
      if (await isOrderComplete(orderId)) return false;
      return true;
    } catch(_) { return false; }
  }
  async function orderLinesMatchCart(orderId, cartItems) {
    const want = (cartItems || [])
      .map(it => String(it.variant_id || it.product_id))
      .filter(Boolean)
      .sort();
    if (!want.length) return false;
    try {
      const lr = await GET('/api/order-line', { domain: `[('order_id','=',${parseInt(orderId, 10)})]` });
      const got = (lr.data || [])
        .map(lineVariantId)
        .filter(Boolean)
        .map(String)
        .sort();
      if (got.length !== want.length) return false;
      return want.every((v, i) => v === got[i]);
    } catch(_) { return false; }
  }
  async function isOrderComplete(orderId) {
    try {
      const d = await getOrder(orderId);
      const o = Array.isArray(d.data) ? d.data[0] : d.data;
      if(!o) return true;
      const stateKey = orderStateKey(o);
      if (stateKey === 'sale' || stateKey === 'done' || stateKey === 'cancel') return true;
      const hasInv  = Array.isArray(o.invoice_ids) ? o.invoice_ids.length>0 : !!o.invoice_ids;
      const hasPick = Array.isArray(o.picking_ids) ? o.picking_ids.length>0 : !!o.picking_ids;
      return hasInv && hasPick;
    } catch(_) { return false; }
  }
  async function getOrder(id) {
    try {
      return await GET(`/api/order/${id}`);
    } catch (e) {
      if (isOdooAccessError(e) || e.isAccessError || /500|Server error/i.test(e.message)) {
        try {
          const fallback = await GET('/api/order', { domain: `[('id','=',${id})]` });
          if (fallback && fallback.data && fallback.data.length > 0) {
            return { success: 1, data: fallback.data };
          }
        } catch (_) {}
      }
      throw e;
    }
  }
  const getOrders = (p={}) => GET('/api/order', p);
  const updOrder  = (id,f) => GET(`/api/order/${id}/update`, f);

  // ── CART / ORDER LINES ────────────────────────────────────────
  // addLine: product_id = variant_id (Postman: only order_id + product_id on create)
  function orderLinesFromOrder(o) {
    if (!o) return [];
    const raw = o.order_line || o.order_lines || o.website_order_line || [];
    return Array.isArray(raw) ? raw : [];
  }
  function lineVariantId(line) {
    if (!line) return null;
    const pv = line.product_variant_id;
    if (pv != null) {
      if (Array.isArray(pv)) return typeof pv[0] === 'object' ? pv[0]?.id : pv[0];
      return pv;
    }
    const p = line.product_id;
    if (Array.isArray(p)) {
      const first = p[0];
      return typeof first === 'object' ? first?.id : first;
    }
    return p ?? null;
  }

  async function getRecIdForVariant(orderId, variantId) {
    const want = String(variantId);
    const matchLine = (line) => line && String(lineVariantId(line)) === want;

    try {
      const d = await getOrder(orderId);
      const o = Array.isArray(d.data) ? d.data[0] : d.data;
      const found = orderLinesFromOrder(o).find(matchLine);
      if (found?.id) return found.id;
    } catch (_) {}

    try {
      const lr = await GET('/api/order-line', { domain: `[('order_id','=',${orderId})]` });
      const list = lr.data || [];
      const found = list.find(matchLine);
      if (found?.id) return found.id;
    } catch (_) {}

    return null;
  }

  // qty flow: GET order → match variant_id → extract rec_id → GET update → GET qty
  // Postman: GET /api/order-line/{rec_id}/update?by_AJR=1&product_uom_qty={qty}
  const updLine  = (recId, qty) => GET(`/api/order-line/${recId}/update`, {product_uom_qty:qty});
  const rmLines  = (oid, ids)              => GET(`/api/order/${oid}/remove_card_item`, {line_ids:`[${ids.join(',')}]`});
  const getLines = oid                     => GET('/api/order-line', {domain:`[('order_id','=',${oid})]`});
  const getLine  = lid                     => GET(`/api/order-line/${lid}`);
  const getLineQty = recId                 => GET(`/api/order-line-qty/${recId}`);

  async function lineBelongsToOrder(recId, orderId) {
    try {
      const lr = await GET(`/api/order-line/${recId}`);
      const line = Array.isArray(lr.data) ? lr.data[0] : lr.data;
      if (!line) return false;
      const o = line.order_id;
      const lineOid = Array.isArray(o) ? (typeof o[0] === 'object' ? o[0]?.id : o[0]) : o;
      return parseInt(lineOid, 10) === parseInt(orderId, 10);
    } catch (_) { return false; }
  }

  /** Create or update a line (avoids HTTP 400 from duplicate create). */
  async function upsertOrderLine(orderId, variantId, qty = 1) {
    const oid = parseInt(orderId, 10);
    const vid = parseInt(variantId, 10);
    if (!oid || !vid) throw new Error('Invalid order or product');
    const q = Math.max(1, qty || 1);
    Log.debug('OrderLine', 'upsert → start', { orderId: oid, variantId: vid, qty: q });

    let recId = await getRecIdForVariant(oid, vid);
    if (recId && !(await lineBelongsToOrder(recId, oid))) {
      Log.warn('OrderLine', 'stale rec_id ignored', { recId, orderId: oid, variantId: vid });
      recId = null;
    }
    if (recId) {
      try {
        await updLine(recId, q);
        Log.info('OrderLine', 'update ✓', { orderId: oid, variantId: vid, recId, qty: q });
        return { rec_id: recId };
      } catch (e) {
        Log.warn('OrderLine', 'update failed, will create', { recId, orderId: oid, message: e.message });
        recId = null;
      }
    }

    try {
      const d = await GET('/api/order-line/create', { order_id: oid, product_id: vid });
      recId = d.data?.rec_id;
      if (!recId) throw new Error(d.data?.message || d.message || 'Line create failed');
      if (q > 1) await updLine(recId, q).catch(() => {});
      Log.info('OrderLine', 'create ✓', { orderId: oid, variantId: vid, recId, qty: q });
      return { rec_id: recId };
    } catch (e) {
      recId = await getRecIdForVariant(oid, vid);
      if (recId && await lineBelongsToOrder(recId, oid)) {
        await updLine(recId, q);
        Log.info('OrderLine', 'create retry update ✓', { orderId: oid, variantId: vid, recId, qty: q });
        return { rec_id: recId };
      }
      Log.error('OrderLine', 'upsert ✗', { orderId: oid, variantId: vid, qty: q, message: e.message });
      throw e;
    }
  }

  async function addLine(oid, variantId, qty = 1) {
    const r = await upsertOrderLine(oid, variantId, qty);
    return { success: 1, data: { rec_id: r.rec_id, message: 'record create successfully' } };
  }

  // Full qty update flow per Postman:
  // 1. GET order → find rec_id by variant_id
  // 2. GET update qty (0 = remove)
  // 3. GET updated qty for UI
  async function updateCartQty(orderId, variantId, newQty) {
    const oid = parseInt(orderId, 10);
    const vid = parseInt(variantId, 10);
    if (!oid || !vid) throw new Error('Invalid order or product');
    Log.debug('OrderLine', 'updateCartQty', { orderId: oid, variantId: vid, qty: newQty });
    if (newQty > 0) {
      let recId = await getRecIdForVariant(oid, vid);
      if (!recId || !(await lineBelongsToOrder(recId, oid))) {
        const r = await upsertOrderLine(oid, vid, newQty);
        return { recId: r.rec_id, qty: newQty, removed: false };
      }
      await updLine(recId, newQty);
      const qtyR = await getLineQty(recId);
      const qty = qtyR.data?.product_uom_qty || qtyR.data?.qty || newQty;
      Log.info('OrderLine', 'updateCartQty ✓', { orderId: oid, variantId: vid, recId, qty });
      return { recId, qty, removed: false };
    }
    let recId = await getRecIdForVariant(oid, vid);
    if (!recId || !(await lineBelongsToOrder(recId, oid))) {
      Log.debug('OrderLine', 'updateCartQty remove (no line)', { orderId: oid, variantId: vid });
      return { recId: null, qty: 0, removed: true };
    }
    await updLine(recId, 0);
    Log.info('OrderLine', 'updateCartQty removed', { orderId: oid, variantId: vid, recId });
    return { recId, qty: 0, removed: true };
  }

  // ── DELIVERY ──────────────────────────────────────────────────
  // delivery-method → carrier_id for home/store pickup
  // Home delivery: add customer address via updContact
  // Store pickup: show company address from description field + Google Maps button
  const getDeliveryMethods = () => GET('/api/delivery-method', { user_id:'2' });
  const updDelivery = (oid, cid) => GET(`/api/order/${oid}/update`, { carrier_id:cid, origin:'COOPDISCOUNT-WEB' });
  const getDeliveries = (p={}) => GET('/api/delivery-order', p);
  async function getDelivery(id) {
    try { return await GET(`/api/delivery-order/${id}`); }
    catch (e) {
      if (isOdooAccessError(e) || e.isAccessError || /500|Server error/i.test(e.message)) {
        try {
          const fb = await GET('/api/delivery-order', { domain: `[('id','=',${id})]` });
          if (fb && fb.data && fb.data.length > 0) return { success: 1, data: fb.data };
        } catch (_) {}
      }
      throw e;
    }
  }

  // ── PAYMENT ───────────────────────────────────────────────────
  const getPayProviders = () => GET('/api/payment-provider', {domain:`[('state','in',['enabled','test'])]`});
  const getPayProvider  = id => GET(`/api/payment-provider/${id}`);
  /** Prefer Cash on Delivery; deprioritize Demo/test providers (Postman: 22=COD, 6=Demo). */
  function isDemoProvider(p) {
    const code = Array.isArray(p?.code) ? p.code[0] : p?.code;
    return code === 'demo' || /demo/i.test(String(p?.name || ''));
  }
  function sortPaymentProviders(providers) {
    const score = (p) => {
      const name = String(p?.name || '').toLowerCase();
      const code = Array.isArray(p?.code) ? String(p.code[0] || '') : String(p?.code || '');
      if (/cash|cod/.test(name) || code === 'custom') return 0;
      if (isDemoProvider(p)) return 9;
      return 5;
    };
    return [...(providers || [])].sort((a, b) => score(a) - score(b));
  }
  function filterCheckoutProviders(providers) {
    // Keep demo providers for testing purposes as requested by user
    return sortPaymentProviders(providers || []);
  }
  function pickDefaultPaymentProvider(providers) {
    const sorted = filterCheckoutProviders(providers);
    const cod = sorted.find(p => /cash|cod/i.test(p.name || '') || (Array.isArray(p.code) && p.code[0] === 'custom'));
    return cod || sorted[0] || null;
  }
  function buildPaymentProviderCandidates(preferredId) {
    const pref = parseInt(preferredId, 10) || 22;
    const ids = [pref];
    if (pref !== 22) ids.push(22);
    return ids;
  }
  function refId(field) {
    if (field == null || field === '' || field === false) return null;
    if (typeof field === 'number') return field;
    if (Array.isArray(field)) {
      const first = field[0];
      if (first == null) return null;
      return typeof first === 'object' ? (first.id ?? null) : first;
    }
    if (typeof field === 'object') return field.id ?? null;
    return null;
  }
  async function fetchOrderRecord(orderId) {
    const d = await GET(`/api/order/${orderId}`);
    return Array.isArray(d.data) ? d.data[0] : d.data;
  }
  function orderTransactions(o) {
    const raw = o?.transaction_ids;
    return Array.isArray(raw) ? raw : [];
  }
  function txStateKey(tx) {
    const s = tx?.state;
    return Array.isArray(s) ? s[0] : (s || '');
  }
  function isPendingTransaction(tx) {
    const k = txStateKey(tx);
    return !k || k === 'draft' || k === 'pending' || k === 'authorized';
  }
  function isDoneTransaction(tx) {
    const k = txStateKey(tx);
    return k === 'done' || k === 'completed' || k === 'posted';
  }
  function isCanceledTransaction(tx) {
    return txStateKey(tx) === 'cancel';
  }
  function txProviderId(tx) {
    return refId(tx?.provider_id) || refId(tx?.payment_provider_id);
  }
  function findTransaction(order, txId) {
    const want = parseInt(txId, 10);
    return orderTransactions(order).find(t => parseInt(t.id, 10) === want) || null;
  }
  function latestPendingTransaction(order) {
    const txs = orderTransactions(order).filter(isPendingTransaction);
    return txs.length ? txs[txs.length - 1] : null;
  }
  async function fetchTransactionRecord(txId) {
    const id = parseInt(txId, 10);
    if (!id) return null;
    try {
      const d = await GET(`/api/payment-transaction/${id}`);
      return Array.isArray(d.data) ? d.data[0] : d.data;
    } catch (_) {
      try {
        const d = await GET('/api/payment-transaction', { domain: `[('id','=',${id})]` });
        return (d.data || [])[0] || null;
      } catch (_) {
        return null;
      }
    }
  }
  async function resolvePaymentTx(orderId, txId, requestedProvId) {
    const order = await fetchOrderRecord(orderId);
    let tx = order ? findTransaction(order, txId) : null;
    let actualProv = txProviderId(tx);
    if (!actualProv) {
      tx = await fetchTransactionRecord(txId);
      actualProv = txProviderId(tx);
    }
    actualProv = actualProv || requestedProvId;
    if (actualProv && requestedProvId && actualProv !== requestedProvId) {
      Log.warn('Payment', 'transaction provider mismatch — using provider on transaction record', {
        orderId, txId, requested: requestedProvId, actual: actualProv,
      });
    }
    return { txId: parseInt(txId, 10), providerId: actualProv || requestedProvId, order, tx };
  }
  async function markDoneWithFallback(oid, txId, provIds) {
    const tried = new Set();
    let lastErr = null;
    for (const p of provIds) {
      const prov = parseInt(p, 10);
      if (!prov || tried.has(prov)) continue;
      tried.add(prov);
      try {
        return await markDone(oid, txId, prov);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Could not confirm payment on the server (mark done failed).');
  }
  function parseTxId(d) {
    if (!d) return null;
    const fromResp = d.response?.[0]?.id;
    if (fromResp) return fromResp;
    if (d.data?.rec_id) return d.data.rec_id;
    if (d.data?.id) return d.data.id;
    if (Array.isArray(d.data) && d.data[0]?.id) return d.data[0].id;
    return null;
  }
  // Postman: GET /api/order/{id}/get_or_create_transaction?args=[provider_id]
  async function createTx(oid, provId) {
    Log.info('Payment', 'createTx → start', { orderId: oid, providerId: provId });
    const d = await GET(`/api/order/${oid}/get_or_create_transaction`, { args: `[${provId}]` });
    const txId = parseTxId(d);
    if (!txId) throw new Error('Payment transaction was not created (no transaction id returned).');
    Log.info('Payment', 'createTx ✓', { orderId: oid, providerId: provId, txId });
    return { txId, providerId: provId, raw: d };
  }
  // Postman: GET /api/order/{id}/order_transaction_mark_done — multiple param styles documented
  async function markDone(oid, txId, provId) {
    const tx = parseInt(txId, 10);
    const prov = parseInt(provId, 10);
    const uid = myUserId() || 2;
    const attempts = [
      { args: `[${prov}]`, transaction_id: tx },
      { transaction_id: tx, provider_id: prov },
      { args: `[${prov}]`, transaction_id: tx, user_id: uid },
      { transaction_id: tx, provider_id: prov, user_id: uid },
      { args: `[${prov}]`, transaction_id: tx, provider_id: prov },
    ];
    let lastErr = null;
    for (const params of attempts) {
      try {
        Log.info('Payment', 'markDone attempt', { orderId: oid, params });
        const d = await GET(`/api/order/${oid}/order_transaction_mark_done`, params);
        Log.info('Payment', 'markDone ✓', { orderId: oid, params, success: d.success });
        return d;
      } catch (e) {
        lastErr = e;
        Log.warn('Payment', 'markDone attempt failed', { orderId: oid, params, message: e.message });
      }
    }
    throw lastErr || new Error('Could not confirm payment on the server (mark done failed).');
  }
  async function finalizeOrderAfterPayment(orderId, markDoneSucceeded = false) {
    const oid = parseInt(orderId, 10);
    // If markDone already succeeded, the order IS confirmed and the invoice IS created.
    // The portal user often can't read the order after state changes to 'sale',
    // so skip verification to avoid spurious 500/access errors.
    if (markDoneSucceeded) {
      Log.info('Payment', 'finalizeOrder — markDone succeeded, skipping verification', { orderId: oid });
      return true;
    }
    const confirmed = await isOrderConfirmed(oid);
    if (!confirmed) {
      try {
        await createInvoice(oid);
        Log.info('Payment', 'createInvoice ✓', { orderId: oid });
      } catch (e) {
        Log.warn('Payment', 'createInvoice failed', { orderId: oid, message: e.message });
      }
    }
    return await isOrderConfirmed(oid);
  }
  async function isOrderConfirmed(orderId) {
    try {
      const d = await getOrder(orderId);
      const o = Array.isArray(d.data) ? d.data[0] : d.data;
      const stateKey = orderStateKey(o);
      return stateKey === 'sale' || stateKey === 'done';
    } catch (_) { return false; }
  }
  /**
   * Full Postman checkout confirmation:
   * createTx → markDone → createInvoice → verify order state = sale
   */
  async function confirmOrderPayment(orderId, preferredProviderId) {
    const oid = parseInt(orderId, 10);
    await prepareOrderForPayment(oid);

    if (await isOrderConfirmed(oid)) {
      Log.info('Payment', 'confirmOrder — already confirmed', { orderId: oid });
      return { orderId: oid, txId: null, providerId: preferredProviderId || 22 };
    }

    const preferred = parseInt(preferredProviderId, 10) || 22;
    const candidates = buildPaymentProviderCandidates(preferred);
    Log.info('Payment', 'confirmOrder → start', { orderId: oid, providers: candidates });

    let order = await fetchOrderRecord(oid);
    const pendingTx = latestPendingTransaction(order);
    let txId = null;
    let provId = preferred;

    if (pendingTx?.id) {
      const pendingProv = txProviderId(pendingTx);
      if (!pendingProv || pendingProv === preferred) {
        txId = pendingTx.id;
        provId = pendingProv || preferred;
        Log.info('Payment', 'reusing pending transaction on order', { orderId: oid, txId, providerId: provId });
      } else {
        Log.warn('Payment', 'skipping stale pending transaction (wrong provider)', {
          orderId: oid, txId: pendingTx.id, pendingProvider: pendingProv, preferred,
        });
      }
    }
    if (!txId) {
      let lastErr = null;
      for (const candidate of candidates) {
        try {
          const created = await createTx(oid, candidate);
          txId = created.txId;
          provId = candidate;
          break;
        } catch (e) {
          lastErr = e;
          Log.warn('Payment', 'createTx failed — trying next provider', { orderId: oid, providerId: candidate, message: e.message });
        }
      }
      if (!txId) {
        throw lastErr || new Error('Could not start payment for this order. Please try Cash on Delivery or contact support.');
      }
    }

    // Resolve the transaction — but don't let access errors block the flow
    let resolved;
    try {
      resolved = await resolvePaymentTx(oid, txId, provId);
      txId = resolved.txId;
      provId = resolved.providerId;
    } catch (e) {
      Log.warn('Payment', 'resolvePaymentTx failed (access rights) — proceeding with known ids', { orderId: oid, txId, provId, message: e.message });
      resolved = { txId, providerId: provId, order: null, tx: null };
    }

    // Stale-tx check — skip if we can't read the transaction (access error)
    try {
      const txRec = resolved.tx || await fetchTransactionRecord(txId);
      if (txRec && isDoneTransaction(txRec)) {
        const alreadyConfirmed = await isOrderConfirmed(oid);
        if (!alreadyConfirmed) {
          throw new Error('This order has a stuck payment from a previous attempt. Please refresh the page and try again.');
        }
      }
    } catch (e) {
      // If it's an access error, skip the stale check — the portal user simply can't read these records
      if (!isOdooAccessError(e) && !e.isAccessError && !/500/.test(e.message)) throw e;
      Log.warn('Payment', 'stale-tx check skipped (access rights)', { orderId: oid, txId, message: e.message });
    }

    const markProvIds = [provId, preferred, 22];
    if (!markProvIds.includes(6)) markProvIds.push(6);
    let markOk = false;
    let markErr = null;
    try {
      await markDoneWithFallback(oid, txId, markProvIds);
      markOk = true;
    } catch (e) {
      markErr = e;
      Log.warn('Payment', 'markDone failed — trying createInvoice fallback', { orderId: oid, message: e.message });
    }
    if (!markOk) {
      // Only check isOrderConfirmed if markDone failed — otherwise we already know it worked
      try {
        if (await isOrderConfirmed(oid)) {
          markOk = true;
        } else {
          try {
            await createInvoice(oid);
            if (await isOrderConfirmed(oid)) markOk = true;
          } catch (invErr) {
            Log.warn('Payment', 'createInvoice fallback failed', { orderId: oid, message: invErr.message });
          }
        }
      } catch (accessErr) {
        // If we can't even read the order (500/access error), treat markDone failure as fatal
        Log.warn('Payment', 'order access failed during fallback', { orderId: oid, message: accessErr.message });
      }
    }
    if (!markOk) throw markErr || new Error('Could not confirm payment on the server (mark done failed).');

    // markDone succeeded — pass that flag so we skip redundant verification
    const confirmed = await finalizeOrderAfterPayment(oid, markOk);
    Log.info('Payment', 'confirmOrder done', { orderId: oid, confirmed, providerId: provId, txId });
    if (!confirmed) {
      throw new Error('Payment was processed but the order is still a quotation on the server. Your Odoo user may need Portal permissions for order confirmation — contact support with your order number.');
    }
    return { orderId: oid, txId, providerId: provId };
  }

  // ── INVOICES ──────────────────────────────────────────────────
  const createInvoice = oid    => GET(`/api/order/${oid}/create_invoice`);
  const getInvoices   = ()     => GET('/api/invoice');
  async function getInvoice(id) {
    try { return await GET(`/api/invoice/${id}`); }
    catch (e) {
      if (isOdooAccessError(e) || e.isAccessError || /500|Server error/i.test(e.message)) {
        try {
          const fb = await GET('/api/invoice', { domain: `[('id','=',${id})]` });
          if (fb && fb.data && fb.data.length > 0) return { success: 1, data: fb.data };
        } catch (_) {}
      }
      throw e;
    }
  }
  const updInvoice    = (id,f) => GET(`/api/invoice/${id}/update`, f);

  // ── LOYALTY (PDF §11 + Postman "Promotions & Loyalty APIs") ─────
  // Flow: GET /api/loyalty-coupon?domain=[('partner_id','=',pid)] OR by code
  //       → program_id[0].reward_ids[0].id = reward_id
  //       → coupon.id = cart_id on apply
  //       → GET /api/order/{oid}/apply_loyalty_point?reward_id=&cart_id=
  const getLoyaltyCoupons  = pid        => GET('/api/loyalty-coupon', {domain:`[('partner_id','=',${pid})]`});
  const getLoyaltyCouponByCode = code   => GET('/api/loyalty-coupon', {domain:`[('code','=','${(code||'').replace(/'/g,"\\'")}')]`});
  const getLoyaltyCards    = ()         => GET('/api/loyalty-card');
  const getLoyaltyPrograms = ()         => GET('/api/loyalty-program');
  const getLoyaltyReward   = id         => {
    const uid = myUserId();
    const p = uid ? { user_id: uid } : {};
    return GET(`/api/loyalty-reward/${id}`, p);
  };
  const applyLoyalty       = (oid, rid, cid) =>
    GET(`/api/order/${oid}/apply_loyalty_point`, { reward_id: rid, cart_id: cid });

  function _loyaltyPartnerId(record) {
    const p = record?.partner_id;
    if (!p) return null;
    if (Array.isArray(p)) return typeof p[0] === 'object' ? p[0].id : p[0];
    return p;
  }
  function _loyaltyPoints(record) {
    return parseFloat(record?.points ?? record?.points_balance ?? record?.point ?? 0) || 0;
  }
  function _loyaltyIsActive(record) {
    const a = record?.active;
    if (a === false || a === 'False' || a === 'false') return false;
    return true;
  }
  function filterLoyaltyByPartner(items, pid) {
    if (!pid || !items?.length) return items || [];
    return items.filter(item => {
      const id = _loyaltyPartnerId(item);
      return id == null || String(id) === String(pid);
    });
  }
  function resolveLoyaltyRewardId(coupon) {
    if (!coupon) return null;
    const prog = Array.isArray(coupon.program_id) ? coupon.program_id[0] : coupon.program_id;
    if (prog?.reward_ids?.length) {
      const r = prog.reward_ids[0];
      return typeof r === 'object' ? (r.id ?? null) : r;
    }
    if (coupon.reward_id != null) {
      return Array.isArray(coupon.reward_id) ? coupon.reward_id[0] : coupon.reward_id;
    }
    return null;
  }
  function resolveLoyaltyProgramName(coupon) {
    const prog = Array.isArray(coupon?.program_id) ? coupon.program_id[0] : coupon?.program_id;
    return prog?.name || coupon?.display_name || 'Loyalty Program';
  }
  function formatLoyaltyRewardLabel(reward) {
    if (!reward) return '';
    const desc = reward.description || reward.display_name || 'Loyalty reward';
    const disc = parseFloat(reward.discount || 0);
    const mode = Array.isArray(reward.discount_mode) ? reward.discount_mode[0] : reward.discount_mode;
    if (disc > 0 && mode === 'per_point') return `${desc} — ${disc} AED per point`;
    if (disc > 0 && mode === 'percent') return `${desc} — ${(disc * 100).toFixed(0)}% off`;
    if (disc > 0) return `${desc} — discount ${disc}`;
    return desc;
  }

  async function findLoyaltyByCode(code) {
    if (!code) throw new Error('Code is required');
    const norm = code.trim();
    const normLow = norm.toLowerCase();
    let coupon = null;
    const pid = myPid();

    // Partner-scoped list first (works best for portal / website users).
    if (pid) {
      try {
        const r2 = await getLoyaltyCoupons(pid);
        const mine = r2.data || [];
        coupon = mine.find(c => String(c.code || '').toLowerCase() === normLow) || null;
      } catch (_) {}
    }

    if (!coupon) {
      try {
        const r = await getLoyaltyCouponByCode(norm);
        const list = r.data || [];
        coupon = list.find(c => String(c.code || '').toLowerCase() === normLow) || list[0] || null;
        if (coupon && pid) {
          const cp = _loyaltyPartnerId(coupon);
          if (cp != null && String(cp) !== String(pid)) {
            throw new Error('This loyalty code belongs to another account');
          }
        }
      } catch (e) {
        if (e.message && e.message.includes('another account')) throw e;
      }
    }

    if (!coupon) throw new Error('Coupon code not found. Use the code shown in My Account → Loyalty.');
    if (!_loyaltyIsActive(coupon)) throw new Error('This coupon is no longer active');

    const rewardId = resolveLoyaltyRewardId(coupon);
    if (!rewardId) throw new Error('No reward is linked to this coupon');

    let reward = null;
    try {
      const rr = await getLoyaltyReward(rewardId);
      reward = Array.isArray(rr.data) ? rr.data[0] : rr.data;
    } catch (_) {}

    return {
      coupon,
      rewardId,
      reward,
      programName: resolveLoyaltyProgramName(coupon),
      rewardLabel: formatLoyaltyRewardLabel(reward)
    };
  }

  /** Read discount already applied on an order (after apply_loyalty_point). */
  async function getOrderDiscountAmount(orderId) {
    const r = await getOrder(parseInt(orderId));
    const o = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!o) return 0;

    const explicit = parseFloat(o.amount_discount || 0);
    if (explicit > 0) return explicit;

    const lines = o.order_line || o.order_lines || [];
    let fromLines = 0;
    lines.forEach(l => {
      const sub = parseFloat(l.price_subtotal ?? l.price_total ?? 0);
      if (sub < 0) fromLines += Math.abs(sub);
      const name = (Array.isArray(l.product_id) ? l.product_id[1] : l.name || '').toString().toLowerCase();
      if (name.includes('discount') || name.includes('reward') || name.includes('coupon')) {
        if (sub < 0) fromLines += Math.abs(sub);
      }
    });
    if (fromLines > 0) return fromLines;

    return 0;
  }

  function estimateLoyaltyDiscount(coupon, reward) {
    const points = _loyaltyPoints(coupon);
    const perPoint = parseFloat(reward?.discount || 0);
    const mode = Array.isArray(reward?.discount_mode) ? reward.discount_mode[0] : reward?.discount_mode;
    if (points > 0 && perPoint > 0 && (mode === 'per_point' || mode == null)) {
      return +(points * perPoint).toFixed(2);
    }
    return 0;
  }

  /**
   * Full coupon flow for cart/checkout: sync lines → lookup → apply_loyalty_point → read discount.
   * cart_id = loyalty coupon id; reward_id = loyalty-reward id (from program.reward_ids).
   */
  async function applyCouponToOrder(orderId, code, opts = {}) {
    let oid = parseInt(orderId, 10);
    if (!oid) throw new Error('Invalid order');
    if (!loggedIn()) throw new Error('Please sign in to use loyalty codes');

    // Use latest draft order and sync cart lines (loyalty needs products on the quotation).
    if (typeof Cart !== 'undefined' && !opts.skipSync) {
      if (Cart.ensureOrder) {
        const fresh = await Cart.ensureOrder();
        if (fresh) oid = parseInt(fresh, 10);
      }
      if (Cart.syncToOrder) await Cart.syncToOrder(oid);
    }

    const found = await findLoyaltyByCode(code);
    const points = _loyaltyPoints(found.coupon);
    if (points <= 0) throw new Error('This loyalty code has no points left to redeem');

    let applyData = null;
    try {
      applyData = await applyLoyalty(oid, found.rewardId, found.coupon.id);
    } catch (e) {
      if (isOdooAccessError(e)) {
        throw new Error('Cannot apply loyalty: your account cannot modify orders. Ask support to enable Portal access in Odoo.');
      }
      throw e;
    }

    let discount = 0;
    let orderTotal = 0;
    let orderSubtotal = 0;
    try {
      discount = await getOrderDiscountAmount(oid);
      const orderR = await getOrder(oid);
      const order = Array.isArray(orderR.data) ? orderR.data[0] : orderR.data;
      orderTotal = parseFloat(order?.amount_total || 0);
      orderSubtotal = parseFloat(order?.amount_untaxed || order?.amount_undiscounted || 0);
      const rewardAmt = parseFloat(order?.reward_amount || 0);
      if (!discount && rewardAmt > 0) discount = rewardAmt;
    } catch (e) {
      if (isOdooAccessError(e)) {
        discount = estimateLoyaltyDiscount(found.coupon, found.reward);
      } else {
        console.warn('applyCoupon: could not read order after apply', e.message);
        discount = estimateLoyaltyDiscount(found.coupon, found.reward);
      }
    }

    if (!discount) discount = estimateLoyaltyDiscount(found.coupon, found.reward);
    if (orderSubtotal > 0 && discount > orderSubtotal) discount = +orderSubtotal.toFixed(2);

    let refreshedCoupon = null;
    try {
      const pid = myPid();
      if (pid) {
        const lr = await getLoyaltyCoupons(pid);
        const mine = lr.data || [];
        const codeLow = String(found.coupon?.code || '').toLowerCase();
        refreshedCoupon = mine.find(c => String(c.code || '').toLowerCase() === codeLow) || null;
      }
    } catch (_) {}

    const pointsBefore = _loyaltyPoints(found.coupon);
    const pointsAfter = refreshedCoupon ? _loyaltyPoints(refreshedCoupon) : pointsBefore;
    const pointsSpent = Math.max(0, +(pointsBefore - pointsAfter).toFixed(2));

    return {
      ...found,
      orderId: oid,
      discount,
      orderTotal,
      orderSubtotal,
      pointsBefore,
      pointsAfter,
      pointsSpent,
      code: code.trim(),
      applyData
    };
  }

  /** Partner-scoped loyalty balance for dashboard / account. */
  async function getLoyaltyBalance() {
    const pid = myPid();
    if (!pid) return { points: 0, coupons: [], cards: [] };

    const [couponR, cardR] = await Promise.allSettled([
      getLoyaltyCoupons(pid),
      getLoyaltyCards()
    ]);
    const coupons = couponR.status === 'fulfilled' ? (couponR.value.data || []) : [];
    let cards = cardR.status === 'fulfilled' ? (cardR.value.data || []) : [];
    cards = filterLoyaltyByPartner(cards, pid);

    let points = 0;
    if (cards.length) {
      cards.forEach(c => { points += _loyaltyPoints(c); });
    } else if (coupons.length) {
      coupons.forEach(c => { points += _loyaltyPoints(c); });
    }

    return { points, coupons, cards };
  }

  // ── CONTACTS & ADDRESS ────────────────────────────────────────
  // updContact: all address fields + image_1920 (for profile photo)
  const getContact  = pid  => GET(`/api/contacts/${pid}`);
  const getContacts = ()   => GET('/api/contacts');
  const updContact  = (pid,f) => GET(`/api/contacts/${pid}/update`, f);

  // Save home address to the logged-in customer AND apply carrier_id to an open order.
  // Per request: "Add new address and update to api and select the carrier_id to update order details"
  async function saveHomeAddressAndApplyCarrier(addressFields, orderId, carrierId) {
    const pid = myPid();
    if (!pid) throw new Error('Please sign in to save a delivery address');
    // 1. Persist address to res.partner via /api/contacts/{pid}/update
    await updContact(pid, addressFields);
    // 2. If we have an order & carrier, update the order with carrier_id (delivery method)
    if (orderId && carrierId) {
      await updDelivery(parseInt(orderId), parseInt(carrierId));
    }
    return { ok: true, pid, orderId, carrierId };
  }

  // ── COUNTRIES & STATES ────────────────────────────────────────
  const getCountries = ()  => GET('/api/country');
  const getCountry   = id  => GET(`/api/country/${id}`);
  const getStates    = ()  => GET('/api/country-state');

  // ── RIDER/DELIVERY APIs ───────────────────────────────────────
  const getRiderDeliveries = (userId) => GET('/api/rider-delivery', { user_id:userId||'2' });
  const acceptRiderDelivery = (id,userId) => GET(`/api/rider-delivery/${id}/update`, { user_id:userId });
  const myRiderDeliveries  = (userId) => GET('/api/rider-delivery', { user_id:userId });

  // ── MY ACCOUNT ────────────────────────────────────────────────
  // IMPORTANT: scope orders/invoices to the logged-in customer (partner_id).
  // Without the domain filter the backend can return every record the session
  // can read (e.g. for staff accounts) which makes the dashboard counts wrong.
  const myOrders   = () => {
    const p = myPid();
    return p ? GET('/api/order',   { domain:`[('partner_id','=',${p})]` })
             : GET('/api/order');
  };
  const myInvoices = () => {
    const p = myPid();
    return p ? GET('/api/invoice', { domain:`[('partner_id','=',${p})]` })
             : GET('/api/invoice');
  };
  const myLoyalty  = () => { const p=myPid(); return p?getLoyaltyCoupons(p):Promise.resolve({data:[]}); };
  const myCards    = async () => {
    const p = myPid();
    const r = await getLoyaltyCards();
    const all = r.data || [];
    return { ...r, data: p ? filterLoyaltyByPartner(all, p) : all };
  };
  const myProfile  = () => { const p=myPid(); return p?getContact(p):Promise.resolve({data:[]}); };

  return {
    build: API_BUILD,
    // Image helpers
    img, prodImg, catImg, sliderImg, partnerImg, bannerImg, invPdfUrl,
    // Session
    loggedIn, me, myPid, mySessionId, myUserId, myName, sess, saveSess, clearSess,
    // Auth
    login, logout, register, updatePassword,
    // Startup/Sliders
    getLogo, getHomeSliders, getDealOfDay, getBestSeller, getRecommended,
    getFeatured, getFreshPick, getBrands, getAllDeals, getDealById,
    // Settings
    initSettings, getSettings,
    // Catalog (NEW endpoints)
    getCats, getCatById, getProds, getProdById, searchProds, byBarcode, getVariants,
    // Orders
    createOrder, ensureCleanCheckoutOrder, abandonCheckoutOrder, isOrderSubmitted, isDraftOrder, isOrderDraft, isOrderReusable, isOrderComplete,
    orderLinesMatchCart, lineVariantId, getOrder, getOrders, updOrder,
    // Cart (GET update per Postman, full qty flow)
    addLine, upsertOrderLine, updLine, rmLines, getLines, getLine, getLineQty,
    getRecIdForVariant, updateCartQty,
    // Delivery
    getDeliveryMethods, updDelivery, getDeliveries, getDelivery,
    // Payment
    getPayProviders, getPayProvider, sortPaymentProviders, filterCheckoutProviders,
    pickDefaultPaymentProvider, buildPaymentProviderCandidates, prepareOrderForPayment,
    createTx, markDone, confirmOrderPayment, isOrderConfirmed,
    // Invoices
    createInvoice, getInvoices, getInvoice, updInvoice, invPdfUrl,
    // Loyalty
    getLoyaltyCoupons, getLoyaltyCouponByCode, getLoyaltyCards, getLoyaltyPrograms,
    getLoyaltyReward, applyLoyalty, findLoyaltyByCode, applyCouponToOrder,
    getLoyaltyBalance, getOrderDiscountAmount, resolveLoyaltyRewardId,
    normalizeApiErrorMessage, isOdooAccessError,
    // Contacts
    getContact, getContacts, updContact, saveHomeAddressAndApplyCarrier,
    // Countries & States
    getCountries, getCountry, getStates,
    // Rider/Delivery
    getRiderDeliveries, acceptRiderDelivery, myRiderDeliveries,
    // My Account
    myOrders, myInvoices, myLoyalty, myCards, myProfile,
    // Raw HTTP
    GET, PUT, POST,
    // Config
    NOTIFY_EMAIL: NOTIFY,
    // Proxy base URL — use API.PX instead of hardcoding '/proxy'
    PX,
    // Session accessor for admin panel
    _s: sess,
    // Structured console logging (localStorage cd_debug: 0=off, 1=normal, 2=verbose)
    log: Log
  };
})();
if (typeof window !== 'undefined') {
  window.CDLog = API.log;
  if (API.log.enabled()) {
    API.log.info('App', 'logging ready', {
      build: API.build,
      level: localStorage.getItem('cd_debug') || '1 (default)',
      hint: "CDLog.setLevel('off'|'normal'|'verbose')"
    });
  }
}
