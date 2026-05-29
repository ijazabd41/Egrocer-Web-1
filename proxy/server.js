// Coop Discounts CORS Proxy v2.1 — Handles binary images + session cookies
// Fixed: CORS origin allowlist, path allowlist, deprecated url.parse → WHATWG URL
const http = require('http'), https = require('https');
const ODOO = process.env.ODOO_BASE || 'http://cooperp.freeddns.org:8076';
const PORT = parseInt(process.env.PORT || '3001');

// ── CORS ORIGIN ALLOWLIST ──────────────────────────────────────────
// Only these origins may make credentialed requests.
// Add production domains here. Supports exact match and localhost with any port.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
function isAllowedOrigin(origin) {
  if (!origin) return false;
  // file:// pages send the literal string "null" as their origin
  if (origin === 'null') return true;
  // Always allow localhost (any port) for development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  // Check explicit allowlist from env
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return false;
}

// ── API PATH ALLOWLIST ─────────────────────────────────────────────
// Only forward requests whose Odoo path starts with one of these prefixes.
const ALLOWED_PATH_PREFIXES = [
  '/api/',
  '/web/session/',
  '/web/image/',
  '/web/binary/',
  '/my/invoices/',
];
function isAllowedPath(odooPath) {
  return ALLOWED_PATH_PREFIXES.some(prefix => odooPath.startsWith(prefix));
}

console.log(`\n🚀 CD Proxy v2.1  |  Odoo: ${ODOO}  |  Port: ${PORT}\n`);

function cors(res, origin) {
  // Only reflect the origin if it's in the allowlist; otherwise omit the header
  // so the browser blocks the response for credentialed requests.
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Cookie,Authorization,X-Session-Token');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie,Content-Type,Content-Disposition,X-Set-Session-Token');
  res.setHeader('Vary', 'Origin');
}

function isImage(path) {
  return path.includes('/web/image/') || path.includes('/web/binary/');
}

function fwd(res, odooPath, method, body, cookie, sessionToken) {
  // Use WHATWG URL API instead of deprecated url.parse
  const odooUrl = new URL(ODOO);
  const isS = odooUrl.protocol === 'https:';
  const T = isS ? https : http;
  const hdrs = {
    'Accept': '*/*',
    'User-Agent': 'CoopDiscountsProxy/2.1'
  };
  if (!isImage(odooPath)) hdrs['Content-Type'] = 'application/json';
  if (cookie) hdrs['Cookie'] = cookie;
  if (sessionToken) hdrs['Cookie'] = (hdrs['Cookie'] ? hdrs['Cookie'] + '; ' : '') + `session_id=${sessionToken}`;
  if (body) hdrs['Content-Length'] = Buffer.byteLength(body);

  const defaultPort = isS ? 443 : 80;
  const opts = { hostname: odooUrl.hostname, port: odooUrl.port || defaultPort, path: odooPath, method, headers: hdrs };
  const r = T.request(opts, or => {
    // Forward Set-Cookie with SameSite fix
    const sc = or.headers['set-cookie'];
    if (sc) {
        res.setHeader('Set-Cookie', sc.map(c => c.replace(/;\s*Secure/gi,'').replace(/;\s*SameSite=[^;]*/gi,'')+'; SameSite=Lax'));
        // Expose session_id to frontend since cross-origin document.cookie can't read it
        for (const c of sc) {
            const match = c.match(/session_id=([^;]+)/);
            if (match) res.setHeader('X-Set-Session-Token', match[1]);
        }
    }
    res.statusCode = or.statusCode;
    // Forward Content-Type exactly as Odoo returns it
    const ct = or.headers['content-type'] || (isImage(odooPath) ? 'image/jpeg' : 'application/json');
    res.setHeader('Content-Type', ct);
    if (or.headers['content-length']) res.setHeader('Content-Length', or.headers['content-length']);
    // For images: stream binary data as buffers
    const chunks = [];
    or.on('data', chunk => chunks.push(Buffer.from(chunk)));
    or.on('end', () => {
      const data = Buffer.concat(chunks);
      res.end(data);
    });
  });
  r.on('error', e => {
    res.statusCode = 502;
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({success:0,error:'Backend unreachable',detail:e.message}));
  });
  if (body) r.write(body);
  r.end();
}

http.createServer((req, res) => {
  cors(res, req.headers['origin']);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  // Use WHATWG URL API instead of deprecated url.parse
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = reqUrl.pathname;

  // Health check
  if (path === '/health' || path === '/proxy/health') {
    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({status:'ok',odoo:ODOO,port:PORT,ts:new Date().toISOString()}));
  }

  if (!path.startsWith('/proxy/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({error:'Use /proxy/ prefix'}));
  }

  const odooPath = path.replace(/^\/proxy/, '');

  // ── PATH ALLOWLIST CHECK ─────────────────────────────────────────
  if (!isAllowedPath(odooPath)) {
    res.statusCode = 403;
    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({error:'Forbidden: path not allowed', path: odooPath}));
  }

  // Build query params from the parsed URL
  const qs = {};
  reqUrl.searchParams.forEach((v, k) => { qs[k] = v; });

  // CRITICAL: Only add by_AJR to API calls, NOT to image/binary paths
  if (!isImage(odooPath) && !qs.by_AJR) qs.by_AJR = '1';

  // Odoo list params must keep literal brackets: args=[22] not args=%5B22%5D
  const ODOO_LITERAL_KEYS = new Set(['args', 'domain', 'line_ids']);
  const qstr = Object.entries(qs).map(([k, v]) => {
    const val = String(v);
    if (ODOO_LITERAL_KEYS.has(k)) return `${encodeURIComponent(k)}=${val}`;
    return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
  }).join('&');
  const full = qstr ? `${odooPath}?${qstr}` : odooPath;

  const sessionToken = req.headers['x-session-token'] || '';
  const cookie = req.headers['cookie'] || '';

  const tag = isImage(odooPath) ? '🖼️' : '📡';
  console.log(`[${new Date().toISOString().substr(11,8)}] ${tag} ${req.method} ${odooPath}`);

  if (req.method === 'POST') {
    let b = '';
    req.on('data', d => b += d);
    req.on('end', () => fwd(res, full, 'POST', b, cookie, sessionToken));
  } else if (req.method === 'PUT') {
    let b = '';
    req.on('data', d => b += d);
    req.on('end', () => fwd(res, full, 'PUT', b, cookie, sessionToken));
  } else {
    fwd(res, full, req.method, null, cookie, sessionToken);
  }
}).listen(PORT, '0.0.0.0', () => console.log(`✅ http://localhost:${PORT}/health\n`));
