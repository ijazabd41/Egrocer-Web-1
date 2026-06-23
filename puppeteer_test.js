const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/shop/address/submit') || url.includes('/shop/payment')) {
       console.log(`[RESP] ${url} - ${res.status()}`);
       if (url.includes('/shop/address/submit')) {
          try {
            const text = await res.text();
            console.log(`[RESP BODY] ${text}`);
          } catch(e) {}
       }
       if (url.includes('/shop/payment') && res.status() >= 300 && res.status() < 400) {
          console.log(`[REDIRECT] ${res.headers().location}`);
       }
    }
  });

  console.log('Navigating to checkout...');
  await page.goto('http://127.0.0.1:3001/checkout.html', { waitUntil: 'networkidle2' });
  
  // Fake cart by executing script in page context to bypass actual UI clicks
  console.log('Faking cart item...');
  await page.evaluate(async () => {
     await API.updateGuestCartQty(28003, 1);
  });
  
  console.log('Running address submission logic from checkout.html...');
  await page.evaluate(async () => {
     try {
       await API.submitGuestAddress({
         name: "Test User",
         email: "test@example.com",
         phone: "0555944719",
         street: "Street 1",
         street2: "Apt 2",
         city: "Dubai",
         zip: "00000",
         country_id: 228,
         state_id: false
       });
       console.log("Address submitted successfully");
     } catch (e) {
       console.log("Address submission failed:", e.message);
     }
  });

  console.log('Getting payment HTML...');
  const payStatus = await page.evaluate(async () => {
     try {
       await API.getShopHtml('/shop/payment');
       return "Success";
     } catch (e) {
       return e.message;
     }
  });
  console.log("Payment HTML result:", payStatus);
  
  const consoleLogs = await page.evaluate(() => window.consoleLogs || []);
  console.log("Browser console:", consoleLogs);

  await browser.close();
})();
