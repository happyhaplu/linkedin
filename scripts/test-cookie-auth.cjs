// Test script to verify cookie authentication
// Run with: node scripts/test-cookie-auth.cjs

const puppeteer = require('puppeteer');

async function testCookieAuth() {
  console.log('🧪 Testing cookie authentication...\n');
  
  // Example li_at cookie value (user needs to replace this)
  const TEST_COOKIE = 'YOUR_LI_AT_COOKIE_HERE';
  
  if (TEST_COOKIE === 'YOUR_LI_AT_COOKIE_HERE') {
    console.log('❌ Please edit this script and add your LinkedIn li_at cookie value');
    console.log('\nHow to get your li_at cookie:');
    console.log('1. Go to linkedin.com and log in');
    console.log('2. Press F12 to open DevTools');
    console.log('3. Go to Application tab → Cookies → https://www.linkedin.com');
    console.log('4. Find the "li_at" cookie and copy its value');
    console.log('5. Replace YOUR_LI_AT_COOKIE_HERE in this script\n');
    process.exit(1);
  }

  let browser;
  
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    console.log('🍪 Setting li_at cookie...');
    await page.setCookie({
      name: 'li_at',
      value: TEST_COOKIE,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true
    });

    console.log('🌐 Navigating to LinkedIn feed...');
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);

    if (currentUrl.includes('/login') || currentUrl.includes('authwall')) {
      console.log('\n❌ FAILED: Cookie is invalid or expired');
      console.log('The cookie redirected to login page.');
      console.log('Please get a fresh li_at cookie and try again.\n');
    } else {
      console.log('\n✅ SUCCESS: Cookie is valid!');
      
      // Try to extract profile info
      try {
        const name = await page.$eval('.global-nav__me-photo', 
          (el) => el.getAttribute('alt')
        ).catch(() => null);
        
        const profilePic = await page.$eval('.global-nav__me-photo', 
          (el) => el.src
        ).catch(() => null);
        
        if (name) {
          console.log('👤 Profile Name:', name);
        }
        if (profilePic) {
          console.log('🖼️  Profile Picture: Found');
        }
      } catch (e) {
        console.log('ℹ️  Could not extract profile data (but cookie is valid)');
      }
      
      console.log('\n🎉 Your cookie authentication is working correctly!');
      console.log('You can now use this li_at cookie for infinite login.\n');
    }

    await browser.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

testCookieAuth();
