/* Coop Discounts Layout v6 — Mobile nav with cart, session-aware header */
document.addEventListener('DOMContentLoaded',async()=>{
  const h=document.getElementById('site-header');
  const f=document.getElementById('site-footer');
  if(h){
    h.innerHTML=buildHeader();
    if(typeof updateHeaderUser === 'function') updateHeaderUser();
  }
  if(f)f.innerHTML=buildFooter();
  loadLogo();
  loadNavCats();
});

// Logo slider ID — change this if the Odoo slider record is recreated.
const LOGO_SLIDER_ID = 12;

async function loadLogo(){
  try{
    let d = null;
    try {
      const r = await API.getDealById(LOGO_SLIDER_ID);
      d = r.data?.[0];
    } catch(_) {
      // Primary ID failed — search all sliders for one with a banner_image
      console.warn(`Logo slider ID ${LOGO_SLIDER_ID} not found, searching all sliders…`);
      try {
        const all = await API.getAllDeals();
        const sliders = all.data || [];
        d = sliders.find(s => s.banner_image);
      } catch(_) {}
    }
    // Logo is at banner_image field → PATH → prepend /proxy
    if(d?.banner_image){
      const src=API.img(d.banner_image);
      document.querySelectorAll('.co-logo').forEach(img=>{
        img.src=src;img.style.display='block';
        img.onload=()=>{document.querySelectorAll('.logo-fb').forEach(e=>e.style.display='none');};
        img.onerror=()=>img.style.display='none';
      });
    }
  }catch(_){}
}

async function loadNavCats(){
  try{
    const r=await API.getCats();
    const cats=r.data||[];
    if(!cats.length)return;
    // Category modal
    const g=document.getElementById('catGrid');
    if(g){
      g.innerHTML='';
      cats.forEach(c=>{
        // image_1024 is a PATH — must proxy
        const imgSrc=c.image_1024?API.img(c.image_1024):API.catImg(c.id);
        const a=document.createElement('a');
        a.href=`shop.html?cat_id=${c.id}&cat_name=${encodeURIComponent(c.name)}`;
        a.onclick=()=>closeModal('catMo');
        a.style.cssText='display:flex;align-items:center;gap:10px;padding:11px;background:#f9fafb;border-radius:12px;border:1.5px solid #e5e7eb;text-decoration:none;color:#111;transition:all .2s';
        a.onmouseover=function(){this.style.background='#fef2f2';this.style.borderColor='#e41e26';};
        a.onmouseout=function(){this.style.background='#f9fafb';this.style.borderColor='#e5e7eb';};
        a.innerHTML=`<div style="width:36px;height:36px;border-radius:8px;overflow:hidden;background:#fee2e2;flex-shrink:0;display:flex;align-items:center;justify-content:center">
          <img src="${imgSrc}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentElement.innerHTML='🏷️'">
        </div>
        <div>
          <div style="font-size:12px;font-weight:700">${c.name}</div>
          ${c.product_tmpl_ids?.length?`<div style="font-size:10px;color:#9ca3af">${c.product_tmpl_ids.length} items</div>`:''}
        </div>`;
        g.appendChild(a);
      });
    }
    // Search dropdown
    const sel=document.getElementById('srchSel');
    if(sel)cats.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;sel.appendChild(o);});
    // Shop sidebar
    const sb=document.getElementById('shopSidebar');
    if(sb){
      sb.innerHTML='';
      cats.forEach(c=>{
        const imgSrc=c.image_1024?API.img(c.image_1024):API.catImg(c.id);
        const d=document.createElement('div');
        d.className='sb-item';d.id=`sbc-${c.id}`;
        d.innerHTML=`<div class="sb-img"><img src="${imgSrc}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none'"></div>
          <span style="flex:1">${c.name}</span>
          ${c.product_tmpl_ids?.length?`<span style="background:#f3f4f6;font-size:9px;font-weight:700;padding:2px 6px;border-radius:8px;color:#6b7280;flex-shrink:0">${c.product_tmpl_ids.length}</span>`:''}`;
        d.onclick=()=>filterCat(c.id,c.name);
        sb.appendChild(d);
      });
    }
  }catch(e){console.warn('loadNavCats:',e);}
}

function buildHeader(){
  return `
<div class="topbar"><div class="ctr">
  <div class="tb-l">
    <span>📍 <span class="en">Al Ghandi Complex, Showroom 03, Nadd Al Hamar, Dubai</span><span class="ar" style="display:none">مجمع الغندي، شورم٠٣، ند الحمر، دبي</span></span>
    <span>🕐 <span class="en">Daily 8AM – 12AM</span><span class="ar" style="display:none">يومياً ٨ص – ١٢م</span></span>
  </div>
  <div class="tb-r">
    <a href="tel:+971555944719">📞 055 594 4719</a>
    <a href="mailto:info@coop-discounts.com" style="display:none" class="en">✉️ info@coop-discounts.com</a>
    <div class="tb-lang" onclick="toggleLang()">🌐 <span class="lang-lbl">العربية</span></div>
  </div>
</div></div>

<header class="hdr"><div class="ctr"><div class="hdr-in">
  <a href="index.html" class="logo">
    <div class="logo-img-w">
      <img class="co-logo" src="" alt="Coop Discounts" style="display:none">
      <div class="logo-fb">🛒</div>
    </div>
    <div class="logo-txt">
      <h1>Coop Discounts</h1>
      <span>Hyper Market</span>
    </div>
  </a>
  <div class="srch-wrap">
    <select class="srch-sel" id="srchSel"><option value="">All</option></select>
    <input class="srch-inp" type="text" placeholder="Search products, brands, barcodes..." aria-label="Search">
    <button class="srch-btn" onclick="doSearch()" aria-label="Search">🔍</button>
  </div>
  <div class="h-acts">
    <!-- User button — changes after login to show name -->
    <a class="hbtn u-link" href="login.html" id="userBtn" aria-label="My Account">
      <span class="ic" style="position:relative">
        <span class="u-avatar" style="font-size:20px">👤</span>
      </span>
      <span class="lbl u-name">Sign In</span>
    </a>
    <button class="hbtn logout-btn" style="display:none" title="Sign out" aria-label="Sign out">
      <span class="ic">🚪</span><span class="lbl">Logout</span>
    </button>
    <a class="hbtn" href="wishlist.html" aria-label="Wishlist">
      <span class="ic">❤️</span><span class="lbl">Wishlist</span>
    </a>
    <button class="hbtn" onclick="openDrw()" aria-label="Cart" style="position:relative">
      <span class="ic">🛒</span>
      <span class="cart-badge" id="hCartBadge" aria-live="polite">0</span>
      <span class="lbl">Cart</span>
    </button>
  </div>
</div></div></header>

<nav class="nav" aria-label="Main navigation"><div class="ctr"><div class="nav-in">
  <button class="nav-cats-btn" onclick="openModal('catMo')" aria-label="All categories">
    ☰ <span class="en">All Categories</span><span class="ar" style="display:none">جميع الأقسام</span>
  </button>
  <a href="index.html" class="nav-a">🏠 <span class="en">Home</span><span class="ar" style="display:none">الرئيسية</span></a>
  <a href="offers.html" class="nav-a">🔥 <span class="en">Hot Deals</span><span class="ar" style="display:none">أحدث العروض</span> <span class="n-badge">SALE</span></a>
  <a href="shop.html" class="nav-a">🛍️ <span class="en">All Products</span><span class="ar" style="display:none">جميع المنتجات</span></a>
  <a href="account.html" class="nav-a">👤 <span class="en">My Account</span><span class="ar" style="display:none">حسابي</span></a>
  <a href="track-order.html" class="nav-a">📦 <span class="en">Track Order</span><span class="ar" style="display:none">تتبع الطلب</span></a>
  <a href="contact.html" class="nav-a">📞 <span class="en">Contact</span><span class="ar" style="display:none">اتصل بنا</span></a>
</div></div></nav>

<!-- Cart Drawer -->
<div class="cart-drw" id="cDrw" role="dialog" aria-label="Shopping cart">
  <div class="drw-hdr">
    <h3>🛒 <span class="en">My Cart</span><span class="ar" style="display:none">سلة التسوق</span></h3>
    <button onclick="closeDrw()" style="font-size:20px;background:none;border:none;cursor:pointer;color:#6b7280;padding:4px" aria-label="Close cart">✕</button>
  </div>
  <div class="drw-body" id="cDrwBody"></div>
  <div class="drw-ftr" id="cDrwFtr"></div>
</div>

<!-- Category Modal -->
<div class="mo" id="catMo" role="dialog" aria-label="All categories">
  <div class="mo-box" style="max-width:640px">
    <button class="mo-x" onclick="closeModal('catMo')" aria-label="Close">✕</button>
    <h2 style="font-size:18px;font-weight:900;margin-bottom:16px">
      <span class="en">All Categories</span><span class="ar" style="display:none">جميع الأقسام</span>
    </h2>
    <div id="catGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px"></div>
  </div>
</div>`;
}

function buildFooter(){
  return `
<section class="nl"><div class="ctr"><div class="nl-in">
  <div>
    <h2 style="font-size:22px;font-weight:900;color:#fff;margin-bottom:5px">🎁 <span class="en">Exclusive Deals for You!</span><span class="ar" style="display:none">عروض حصرية لك!</span></h2>
    <p style="color:rgba(255,255,255,.75);font-size:13px"><span class="en">Subscribe to get the best offers in your inbox</span><span class="ar" style="display:none">اشترك للحصول على أفضل العروض</span></p>
  </div>
  <div class="nl-form">
    <input type="email" class="nl-inp" placeholder="Your email address...">
    <button class="nl-btn" onclick="toast('Subscribed! 🎉')">Subscribe</button>
  </div>
</div></div></section>

<footer><div class="ctr"><div class="ft-grid">
  <div>
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:14px">
      <div style="width:42px;height:42px;background:#e41e26;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
        <img class="co-logo" src="" style="width:100%;height:100%;object-fit:contain;display:none" alt="">
        <span class="logo-fb" style="font-size:20px;background:transparent;width:auto;height:auto;border-radius:0">🛒</span>
      </div>
      <div>
        <div style="font-size:14px;font-weight:800;color:#fff">Coop Discounts</div>
        <div style="font-size:9px;color:#f5c518;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Hyper Market</div>
      </div>
    </div>
    <p style="font-size:12px;line-height:1.8;margin-bottom:14px;color:rgba(255,255,255,.6)">Your trusted hypermarket in Dubai. Fresh products, unbeatable prices — every day.</p>
    <div style="font-size:11px;display:flex;flex-direction:column;gap:6px">
      <a href="https://maps.google.com/?q=Al+Ghandi+Complex+Nadd+Al+Hamar+Dubai" target="_blank" style="color:rgba(255,255,255,.6);display:flex;align-items:flex-start;gap:6px">📍 Al Ghandi Complex, Showroom 03, Nadd Al Hamar, Dubai UAE</a>
      <a href="tel:+971555944719" style="color:rgba(255,255,255,.6);display:flex;align-items:center;gap:6px">📞 055 594 4719</a>
      <a href="mailto:info@coop-discounts.com" style="color:rgba(255,255,255,.6);display:flex;align-items:center;gap:6px">✉️ info@coop-discounts.com</a>
      <span style="color:rgba(255,255,255,.6);display:flex;align-items:center;gap:6px">🕐 Daily 8:00 AM – 12:00 AM</span>
    </div>
  </div>
  <div><h4 style="font-size:12px;font-weight:800;color:#fff;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid rgba(255,255,255,.08)">Quick Links</h4>
    <div class="ft-links"><a href="index.html">Home</a><a href="shop.html">Shop All</a><a href="offers.html">Hot Deals</a><a href="account.html">My Account</a><a href="track-order.html">Track Order</a></div></div>
  <div><h4 style="font-size:12px;font-weight:800;color:#fff;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid rgba(255,255,255,.08)">Support</h4>
    <div class="ft-links"><a href="contact.html">Contact Us</a><a href="faq.html">FAQs</a><a href="about.html">About Us</a><a href="faq.html">Returns</a><a href="faq.html">Privacy Policy</a></div></div>
  <div><h4 style="font-size:12px;font-weight:800;color:#fff;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid rgba(255,255,255,.08)">Find Us</h4>
    <a href="https://maps.google.com/?q=Al+Ghandi+Complex+Nadd+Al+Hamar+Dubai" target="_blank" style="display:flex;align-items:center;justify-content:center;background:#1e1e1e;border-radius:12px;height:90px;color:rgba(255,255,255,.5);font-size:12px;text-decoration:none">
      <div style="text-align:center"><div style="font-size:24px;margin-bottom:4px">📍</div><div>Google Maps</div></div>
    </a>
    <div style="display:flex;gap:7px;margin-top:11px">
      <a href="#" style="width:34px;height:34px;background:rgba(255,255,255,.08);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;text-decoration:none" onmouseover="this.style.background='rgba(245,197,24,.2)'" onmouseout="this.style.background='rgba(255,255,255,.08)'">📘</a>
      <a href="#" style="width:34px;height:34px;background:rgba(255,255,255,.08);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;text-decoration:none" onmouseover="this.style.background='rgba(245,197,24,.2)'" onmouseout="this.style.background='rgba(255,255,255,.08)'">📸</a>
      <a href="https://wa.me/971555944719" target="_blank" style="width:34px;height:34px;background:rgba(255,255,255,.08);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;text-decoration:none" onmouseover="this.style.background='rgba(245,197,24,.2)'" onmouseout="this.style.background='rgba(255,255,255,.08)'">💬</a>
    </div>
  </div>
</div></div>
<div class="ctr"><div class="ft-bot">
  <span>© 2025 Coop Discounts – Best Coop Discounts L.L.C. All rights reserved.</span>
  <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
    <span style="font-size:10px;color:rgba(255,255,255,.35)">We accept:</span>
    <span class="pt">VISA</span><span class="pt">MC</span><span class="pt">AMEX</span><span class="pt">Apple Pay</span><span class="pt">COD</span>
  </div>
</div></div></footer>

<!-- Mobile Bottom Nav — includes Cart with badge -->
<nav class="mnav" aria-label="Mobile navigation">
  <div class="mnav-in">
    <a href="index.html" class="mna"><span class="ic">🏠</span><span class="en">Home</span><span class="ar" style="display:none">الرئيسية</span></a>
    <a href="shop.html" class="mna"><span class="ic">🛍️</span><span class="en">Shop</span><span class="ar" style="display:none">تسوق</span></a>
    <a href="offers.html" class="mna"><span class="ic">🔥</span><span class="en">Deals</span><span class="ar" style="display:none">عروض</span></a>
    <button class="mna" onclick="openDrw()" style="background:none;border:none;font-family:inherit;cursor:pointer">
      <span class="ic" style="position:relative">
        🛒
        <span class="cart-badge mna-badge" id="mCartBadge" aria-live="polite">0</span>
      </span>
      <span class="en">Cart</span><span class="ar" style="display:none">سلة</span>
    </button>
    <a href="account.html" class="mna"><span class="ic">👤</span><span class="en">Account</span><span class="ar" style="display:none">حسابي</span></a>
  </div>
</nav>`;
}

function doSearch(){
  const q=document.querySelector('.srch-inp')?.value?.trim();
  const cat=document.getElementById('srchSel')?.value;
  if(!q&&!cat)return;
  const p=[];if(q)p.push(`q=${encodeURIComponent(q)}`);if(cat)p.push(`cat_id=${cat}`);
  location.href=`shop.html?${p.join('&')}`;
}
