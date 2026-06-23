# CD.COM Web Dashboards — Developer Integration Guide

## Files

```
cd_dashboard_shared.css    ← shared layout (sidebar, cards, tables, charts)
web1_vars.css              ← Web1 Coop light theme (red #D61F26)
web1_stock_vars.css        ← Web1 stock manager (yellow #F5C800 accent)
web6_vars.css              ← Web6 Coop dark theme (red #FF3B42)
web6_stock_vars.css        ← Web6 stock manager (yellow accent on dark)

web1_owner_dashboard.html  ← Company Owner (Coop light)
web1_delivery_dashboard.html
web1_stock_dashboard.html

web6_owner_dashboard.html  ← Company Owner (dark/blue)
web6_delivery_dashboard.html
web6_stock_dashboard.html
```

---

## HOW TO ADD TO YOUR EXISTING WEBSITE

### Step 1 — Copy CSS files into your project
```
/assets/css/cd_dashboard_shared.css
/assets/css/web1_vars.css          (or web6_vars.css + web6_stock_vars.css for stock)
```

### Step 2 — Copy the dashboard HTML pages
Each HTML file is a **separate page** at a URL like:
```
/dashboard/owner        → web1_owner_dashboard.html (or web6)
/dashboard/delivery     → web1_delivery_dashboard.html
/dashboard/stock        → web1_stock_dashboard.html
```

### Step 3 — After login, redirect by role

```javascript
// In your login handler:
const result = await loginAPI(email, password);
const roleCode = result.cd_mobile_role.role_code;

const routes = {
  'company_owner':    '/dashboard/owner',
  'store_manager':    '/dashboard/owner',
  'delivery_manager': '/dashboard/delivery',
  'delivery_boy':     '/dashboard/delivery',
  'stock_manager':    '/dashboard/stock',
};

window.location.href = routes[roleCode] || '/';
```

### Step 4 — Choose theme per user or set globally
If your website uses **Web1** (light theme) → use `web1_*.html` files.
If your website uses **Web6** (dark theme) → use `web6_*.html` files.

Or let users toggle: add `web6_vars.css` conditionally.

---

## HOW TO WIRE UP THE API DATA

Every section has a comment like:
```
// API: GET /api/dashboard/full?period=today&by_AJR=1
```

### Basic fetch pattern (copy-paste for every section):

```javascript
const BASE_URL = 'http://cooperp.freeddns.org:8076';

async function fetchAPI(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include'   // sends session cookie
  });
  return res.json();
}

// Example: load owner dashboard
async function loadOwnerDashboard(period = 'today') {
  const data = await fetchAPI(`/api/dashboard/full?period=${period}&by_AJR=1`);
  const s    = data.summary;

  // Update KPI cards
  document.getElementById('kpi-revenue').textContent  = 'AED ' + fmtK(s.total_revenue);
  document.getElementById('kpi-orders').textContent   = s.total_orders;
  document.getElementById('kpi-customers').textContent = s.new_customers;
  document.getElementById('kpi-paid').textContent     = 'AED ' + fmtK(s.paid_amount);

  // Update order status mini bar
  document.querySelector('[data-status="sale"]').textContent  = data.order_status.sale;
  document.querySelector('[data-status="draft"]').textContent = data.order_status.draft;
  // ...etc

  // Update revenue chart
  revenueChart.data.datasets[0].data = data.daily_trend.map(t => t.revenue);
  revenueChart.data.labels            = data.daily_trend.map(t => t.date.slice(5));
  revenueChart.update();
}

function fmtK(v) {
  return v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0);
}
```

### Period tab handler (owner dashboard):
```javascript
document.querySelectorAll('.p-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.p-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadOwnerDashboard(tab.dataset.period);
  });
});
```

### Delivery: assign a driver
```javascript
async function assignDriver(pickingId, driverUserId) {
  const res = await fetch(
    `${BASE_URL}/api/delivery/${pickingId}/assign?assign_to=${driverUserId}&by_AJR=1`,
    { method: 'POST', credentials: 'include' }
  );
  const data = await res.json();
  if (data.status === 'success') {
    refreshDeliveryList();  // reload table
  }
}
```

### Stock: save physical count on input blur
```javascript
document.querySelectorAll('.count-input').forEach(input => {
  input.addEventListener('change', async () => {
    const quantId   = input.dataset.quantId;
    const countedQty = input.value;
    await fetchAPI(
      `/api/stock/inventory/update-qty?quant_id=${quantId}&counted_qty=${countedQty}&by_AJR=1`,
      'POST'
    );
    calcDiff(input, parseInt(input.dataset.systemQty));
  });
});
```

### Stock: validate inventory (final submit button)
```javascript
document.getElementById('validate-btn').addEventListener('click', async () => {
  const locationId = document.getElementById('location-select').value;
  const res = await fetchAPI(`/api/stock/inventory/validate?location_id=${locationId}&by_AJR=1`, 'POST');
  if (res.status === 'success') {
    alert(res.message);
    // Show adjustments table from res.adjustments
  }
});
```

---

## ROLE-BASED VIEW SWITCHING (delivery page)

The delivery page has both Manager View and Delivery Boy View in the same HTML.
Show/hide based on the logged-in user's role:

```javascript
const roleCode = localStorage.getItem('role_code');

if (roleCode === 'delivery_manager') {
  document.getElementById('manager-view').style.display = '';
  document.getElementById('boy-view').style.display     = 'none';
} else if (roleCode === 'delivery_boy') {
  document.getElementById('manager-view').style.display = 'none';
  document.getElementById('boy-view').style.display     = '';
}
```

---

## CHART.JS — Update charts with real data

Each chart variable is declared at the bottom of each HTML file.
After loading API data, update it like this:

```javascript
// Update any chart with new data:
myChart.data.datasets[0].data = newDataArray;
myChart.data.labels            = newLabelsArray;
myChart.update();
```

---

## SUMMARY OF WHAT EACH PAGE CALLS

### Owner Dashboard (/dashboard/owner)
| Section | API |
|---|---|
| All KPI cards | `GET /api/dashboard/full?period=...` |
| Revenue trend chart | `GET /api/dashboard/daily-trend?period=...` |
| Hourly sales | `GET /api/dashboard/hourly-sales` |
| Payment methods | `GET /api/dashboard/payment-methods?period=...` |
| Category donut | `GET /api/dashboard/category-sales?period=...` |
| Top products table | `GET /api/dashboard/top-products?period=...` |
| Top customers | `GET /api/dashboard/top-customers?period=...` |
| Margin bar chart | `GET /api/dashboard/margin?period=...` |
| Returns card | `GET /api/dashboard/returns-refunds?period=...` |

### Delivery Dashboard (/dashboard/delivery)
| Section | API |
|---|---|
| Stats row | `GET /api/delivery/dashboard` |
| Deliveries table | `GET /api/delivery-management?limit=20` |
| Driver performance | `GET /api/delivery/driver-performance` |
| Assign driver | `POST /api/delivery/{id}/assign?assign_to=` |
| My deliveries | `GET /api/my-delivery?domain=[('user_id','=',UID)]` |
| Available pool | `GET /api/unassigned-delivery` |
| Accept delivery | `POST /api/delivery/{id}/accept?user_id=` |
| Send OTP | `POST /api/delivery/{id}/otp-send?user_id=` |
| Verify OTP | `POST /api/delivery/{id}/otp-verify?otp=&user_id=` |
| Confirm delivered | `POST /api/delivery/{id}/delivered?user_id=` |

### Stock Dashboard (/dashboard/stock)
| Section | API |
|---|---|
| KPI cards | `GET /api/stock/dashboard` |
| Location dropdown | `GET /api/stock-location` |
| Count sheet | `GET /api/stock-quant?domain=[('location_id','=',ID)]` |
| Save count | `POST /api/stock/inventory/update-qty?quant_id=&counted_qty=` |
| Validate | `POST /api/stock/inventory/validate?location_id=` |
| Valuation chart | `GET /api/stock/inventory-valuation` |
| Low stock | `GET /api/stock-reorder-rule` |
| Dead stock | `GET /api/stock/dead-stock?threshold_days=30` |
| Movements | `GET /api/stock-movement?limit=6` |
