// cd_web_api.js
// Shared API service for all web dashboard pages.
// Include this before your dashboard script:
//   <script src="cd_web_api.js"></script>
//
// CORRECT ENDPOINT TYPES:
//   CSV-based:  /api/{name-with-hyphens}   e.g. /api/delivery-management
//   Rider APIs: /api/rider-delivery        (always work)
//   Module:     /api/dashboard/full        (needs module installed)

const CdApi = (() => {
  const BASE = 'http://cooperp.freeddns.org:8076';
  const DB   = 'staging-apr17';

  // ── Auth helpers ──────────────────────────────────────────
  const session  = () => localStorage.getItem('cd_session_id') || '';
  const userId   = () => parseInt(localStorage.getItem('cd_user_id') || '0');
  const roleCode = () => localStorage.getItem('cd_role_code') || '';
  const userName = () => localStorage.getItem('cd_user_name') || '';

  const headers = () => ({
    'Content-Type': 'application/json',
    'Cookie': `session_id=${session()}`,
  });

  const _get = async (path, params = {}) => {
    const url = new URL(BASE + path);
    url.searchParams.set('by_AJR', '1');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      const res  = await fetch(url, { headers: headers(), credentials: 'include' });
      const text = await res.text();
      if (text.trim().startsWith('<')) {
        return { error: 'not_available',
                 message: 'Module not installed or session expired. Run login first.' };
      }
      return JSON.parse(text);
    } catch (e) { return { error: e.message }; }
  };

  // ── LOGIN ─────────────────────────────────────────────────
  const login = async (loginEmail, password) => {
    try {
      const res  = await fetch(`${BASE}/web/session/authenticate`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jsonrpc: '2.0',
          params:  { db: DB, login: loginEmail, password }
        })
      });
      const data   = await res.json();
      const result = data.result || {};
      if (result.uid) {
        localStorage.setItem('cd_session_id', result.session_id || '');
        localStorage.setItem('cd_user_id',    String(result.uid));
        localStorage.setItem('cd_user_name',  result.name || '');
        const role = result.cd_mobile_role || {};
        localStorage.setItem('cd_role_code', role.role_code || '');
        localStorage.setItem('cd_role_name', role.role_name || '');
      }
      return result;
    } catch (e) { return { error: e.message }; }
  };

  const logout = () => {
    ['cd_session_id','cd_user_id','cd_user_name','cd_role_code','cd_role_name']
      .forEach(k => localStorage.removeItem(k));
    window.location.href = 'login.html';
  };

  const isLoggedIn = () => !!session();
  const requireLogin = () => { if (!isLoggedIn()) window.location.href = 'login.html'; };

  const fmtK = (v) =>
    v >= 1000000 ? (v/1000000).toFixed(1)+'M'
    : v >= 1000  ? (v/1000).toFixed(1)+'K'
    : Number(v).toFixed(0);

  const fmtDate = (s) => s ? s.substring(0,10) : '';

  // ── OWNER ANALYTICS (needs module) ───────────────────────
  const dashboardFull = (period='today', startDate, endDate) => {
    const p = { period };
    if (period === 'custom' && startDate) p.start_date = startDate;
    if (period === 'custom' && endDate)   p.end_date   = endDate;
    return _get('/api/dashboard/full', p);
  };
  const dailyTrend      = (period='this_month') => _get('/api/dashboard/daily-trend', {period});
  const hourlySales     = ()                    => _get('/api/dashboard/hourly-sales');
  const orderStatus     = (period='today')      => _get('/api/dashboard/order-status', {period});
  const categorySales   = (period='this_month') => _get('/api/dashboard/category-sales', {period});
  const paymentMethods  = (period='this_month') => _get('/api/dashboard/payment-methods', {period});
  const returnsRefunds  = (period='this_month') => _get('/api/dashboard/returns-refunds', {period});
  const grossMargin     = (period='this_month') => _get('/api/dashboard/margin', {period});
  const topProducts     = (period='this_month', limit=10) =>
                          _get('/api/dashboard/top-products', {period, limit});
  const topCustomers    = (period='this_month', limit=10) =>
                          _get('/api/dashboard/top-customers', {period, limit});

  // ── OWNER MODEL DATA (CSV — works now) ───────────────────
  const saleOrderList  = (limit=20, offset=0) => _get('/api/sale-order-dashboard', {limit, offset});
  const invoiceList    = (limit=20)           => _get('/api/invoice-dashboard',     {limit});
  const customerList   = (limit=20)           => _get('/api/customer-analytics',    {limit});

  // ── DELIVERY STATS (needs module) ────────────────────────
  const deliveryDashboard = () => _get('/api/delivery/dashboard');

  // ── DELIVERY LISTS (CSV — works now) ─────────────────────
  const allDeliveries = (limit=20, offset=0, domain='') =>
    _get('/api/delivery-management', domain ? {limit,offset,domain} : {limit,offset});
  const unassignedDeliveries = (limit=20) =>
    _get('/api/delivery-management', {limit, domain:"[('state','=','assigned'),('user_id','=',False)]"});
  const myDeliveriesCSV = (uid, limit=20) =>
    _get('/api/my-delivery', {domain:`[('user_id','=',${uid})]`, limit});
  const deliveryPersons = () => _get('/api/delivery-person');

  // ── RIDER APIs (ALWAYS WORK) ─────────────────────────────
  const riderUnassigned  = (limit=10, offset=0) => _get('/api/rider-delivery', {limit, offset});
  const riderMyDeliveries= (uid, limit=10, offset=0) =>
    _get('/api/rider-own-delivery', {domain:`[('user_id','=',${uid})]`, limit, offset});
  const riderAccept      = (id, uid)    => _get(`/api/rider-delivery/${id}/update`, {user_id:uid});
  const riderSendOtp     = (id)         => _get(`/api/rider-own-delivery/${id}/regenerate_send_otp`);
  const riderVerifyOtp   = (id, otp)    => _get(`/api/rider-own-delivery/${id}/verify_otp`, {otp});
  const riderMarkDone    = (id, uid)    => _get(`/api/rider-own-delivery/${id}/mark_done`, {uid});
  const riderStart       = (id, uid, lat, lng) =>
    _get(`/api/delivery/${id}/start`, {user_id:uid, latitude:lat, longitude:lng});
  const riderCustomerWait= (id, uid, note='') =>
    _get(`/api/delivery/${id}/customer-wait`, {user_id:uid, note});
  const assignDelivery   = (id, assignTo) =>
    _get(`/api/delivery/${id}/assign`, {assign_to:assignTo});

  // ── STOCK STATS (needs module) ────────────────────────────
  const stockDashboard      = ()      => _get('/api/stock/dashboard');
  const inventoryValuation  = ()      => _get('/api/stock/inventory-valuation');
  const deadStock           = (days=30) => _get('/api/stock/dead-stock', {threshold_days:days,limit:50});

  // ── STOCK LISTS (CSV — works now) ────────────────────────
  const stockLocations = ()              => _get('/api/stock-location');
  const stockQuants    = (locId, search='', limit=50) =>
    _get('/api/stock-quant', {
      limit,
      domain: search
        ? `[('location_id','=',${locId}),('product_id.name','ilike','${search}')]`
        : `[('location_id','=',${locId})]`
    });
  const stockProducts  = (search='', limit=50, offset=0) =>
    _get('/api/stock-product', search
      ? {limit,offset,domain:`[('name','ilike','${search}')]`}
      : {limit,offset});
  const lowStock      = (limit=50) => _get('/api/stock-reorder-rule', {limit});
  const stockMovements= (limit=30) => _get('/api/stock-movement',     {limit});

  // ── STOCK ACTIONS (needs module) ─────────────────────────
  const updateCountedQty = (quantId, qty) =>
    _get('/api/stock/inventory/update-qty', {quant_id:quantId, counted_qty:qty});
  const validateInventory = (locId) =>
    _get('/api/stock/inventory/validate', {location_id:locId});

  return {
    // auth
    login, logout, isLoggedIn, requireLogin, session, userId, roleCode, userName,
    fmtK, fmtDate,
    // owner analytics
    dashboardFull, dailyTrend, hourlySales, orderStatus, categorySales,
    paymentMethods, returnsRefunds, grossMargin, topProducts, topCustomers,
    // owner model
    saleOrderList, invoiceList, customerList,
    // delivery
    deliveryDashboard, allDeliveries, unassignedDeliveries, myDeliveriesCSV,
    deliveryPersons, assignDelivery,
    // rider (always work)
    riderUnassigned, riderMyDeliveries, riderAccept, riderSendOtp,
    riderVerifyOtp, riderMarkDone, riderStart, riderCustomerWait,
    // stock
    stockDashboard, inventoryValuation, deadStock,
    stockLocations, stockQuants, stockProducts, lowStock, stockMovements,
    updateCountedQty, validateInventory,
  };
})();
