# COOP Delivery Dashboard — Integration Guide for Developers
## Files in this package

| File | Purpose |
|---|---|
| `skytec_delivery_dashboard.zip` | Odoo v19 module — install on server |
| `web_store_manager_delivery.html` | Web dashboard — deploy alongside existing web files |
| `store_manager_screen.dart` | Flutter screen — add to mobile app |
| `COOP_Delivery_Dashboard_Developer_Handover.md` | Full technical reference |

---

## Quick Start

### 1. Deploy the Odoo Module
```bash
# Copy to custom addons
cp -r skytec_delivery_dashboard /opt/odoo19/custom_addons/

# Restart Odoo
sudo systemctl restart odoo
```
Then: **Apps → Search "skytec_delivery_dashboard" → Install**

### 2. Configure (Delivery → Settings)
- **Store Keeper** — user who prepares material (required)
- **Store Manager** — user who approves (only needed if Delivery Automation = ON)
- **Delivery Automation** — OFF by default (no approval, straight to Store Keeper)
- **Firebase Server Key** — from Firebase Console → Project Settings → Cloud Messaging

### 3. Delivery Members — How they are set
Delivery drivers (people who receive "Ready for Pickup" notifications) are
identified via **Mobile App Roles** from `skytec_independent_support`:
- Role code `delivery_boy` → receives notifications
- Role code `delivery_manager` → receives notifications

You **do not** need to manually list drivers anywhere — the system reads
all active users with these role codes automatically.

The Store Manager and Store Keeper are set per-company in **Delivery → Settings**.

---

## Web Dashboard Setup

Copy these files to your web server:
```
cd_dashboard.css               (existing — from your web package)
cd_web_api.js                  (existing — from your web package)
login.html                     (existing)
web_store_manager_delivery.html  ← NEW
```

Update the BASE URL in `web_store_manager_delivery.html` line 1:
```javascript
const BASE = 'http://cooperp.freeddns.org:8077';  // ← change this
```

Login flow: uses existing `cd_web_api.js` session (same `session_id` cookie).

---

## Flutter Setup

### 1. Add the screen file
```
lib/screens/store_manager_screen.dart  ← copy here
```

### 2. pubspec.yaml dependencies needed
```yaml
dependencies:
  http: ^1.2.1
  shared_preferences: ^2.2.3
```

### 3. Update the BASE URL
In `store_manager_screen.dart` line 1 of `_Api`:
```dart
static const base = 'http://cooperp.freeddns.org:8077';  // ← change this
```

### 4. Navigate to screen after login
```dart
// In your login success handler:
final roleCode = prefs.getString('role_code') ?? '';
if (roleCode == 'store_manager') {
  Navigator.pushReplacement(context,
    MaterialPageRoute(builder: (_) => const StoreManagerScreen()));
}
```

### 5. Login response must save session
The existing `skytec_independent_support` login saves `session_id`,
`user_name`, `role_code` to SharedPreferences. The delivery screen
reads `session_id` and `user_name` automatically.

---

## API Reference Summary

All endpoints: `GET /api/skytec-delivery/{endpoint}`
Authentication: Odoo session cookie (`session_id`)

### Dashboard (with date and dropdown filters)
```
GET /api/skytec-delivery/dashboard
    ?period=today|yesterday|this_week|this_month|last_6_months|all|custom
    &status=all|new|approved|ready|pickup|delivered
    &source=all|coopplus_web|coopplus_mobile|coopdiscount_web|coopdiscount_mobile|talabat|noon|instashop|other
    &date_from=YYYY-MM-DD   (for custom period)
    &date_to=YYYY-MM-DD     (for custom period)

Response:
{
  "success": 1,
  "data": {
    "totals": { "total":5, "pending":2, "approved":1, "ready":0,
                "accepted":0, "dispatched":1, "delivered":1, "cancelled":0 },
    "by_source": { "coopplus_web":3, "talabat":1, "pos":1, ... },
    "by_state":  { "new":2, "approved":1, ... },
    "recent":    [ { "id":1, "name":"WH/OUT/001", "source":"talabat",
                     "state":"new", "partner":"Ahmed Ali", "date":"..." } ]
  }
}
```

### Orders list
```
GET /api/skytec-delivery/orders
    ?state=new|approved|ready|accepted|dispatched|delivered|cancelled
    &source=coopplus_web|coopplus_app|talabat|noon|instashop|...
    &limit=25  &offset=0
```

### Actions
```
POST /api/skytec-delivery/orders/{id}/approve    → Store Keeper notified
POST /api/skytec-delivery/orders/{id}/ready      → All drivers notified
POST /api/skytec-delivery/orders/{id}/accept     → Customer notified
POST /api/skytec-delivery/orders/{id}/dispatch
POST /api/skytec-delivery/orders/{id}/delivered  → Customer notified
POST /api/skytec-delivery/orders/{id}/cancel
```

---

## Delivery Workflow (both modes)

### Delivery Automation = DISABLED (default)
```
New order (Talabat / Noon / COOPPLUS etc.)
  → Store Keeper gets Firebase + Email
  → Taps "Mark Ready" in mobile
  → ALL delivery_boy + delivery_manager users get Firebase + Email
  → Driver taps "Accept"
  → Customer gets Firebase + Email
  → Driver dispatches → delivers
  → Customer gets Firebase + Email

POS / Internal → shown as Delivered immediately (walk-in)
```

### Delivery Automation = ENABLED
```
New order
  → Store Manager gets Firebase + Email (must approve first)
  → Store Manager taps "Approve"
  → Store Keeper gets Firebase + Email → (rest same as above)
```

---

## Firebase Device Tokens
Each user's Firebase device token is stored on `res.partner.firebase_id`
field — this is set automatically by `skytec_independent_support` when
a user logs in from the mobile app with their `firebase_id` in the payload.

No manual setup needed — as long as users log in via the mobile app,
their tokens are registered automatically.

---

## Date Filter Periods (used in both web and Flutter)

| Value | Description |
|---|---|
| `today` | From midnight today |
| `yesterday` | Previous calendar day |
| `this_week` | From Monday of current week |
| `this_month` | From 1st of current month |
| `last_6_months` | Last 180 days |
| `all` | No date filter — all time |
| `custom` | Requires `date_from` and `date_to` parameters |

