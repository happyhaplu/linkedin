// Quick test to check what's actually being extracted
const { chromium } = require('playwright');

async function testProfileExtraction() {
  console.log('🚀 Testing profile extraction...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // You'll need to set your actual cookies here
  await context.addCookies([
    {
      name: 'li_at',
      value: 'YOUR_LI_AT_COOKIE_HERE', // Replace with your actual cookie
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    }
  ]);
  
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded'
  });
  
  await page.waitForTimeout(3000);
  
  console.log('\n📊 Testing feed page extraction...\n');
  
  const feedPageData = await page.evaluate(() => {
    const data = {};
    
    const getAttr = (selectors, attr) => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          const value = el.getAttribute(attr);
          if (value && !value.includes('data:image') && !value.includes('ghost')) {
            return value;
          }
        }
      }
      return null;
    };
    
    // Get name from navigation bar (from img alt attribute)
    data.name = getAttr([
      '.global-nav__me-photo',
      'button.global-nav__primary-link-me-menu-trigger img',
      '.global-nav__me img'
    ], 'alt');
    
    // If name not found in alt text, try aria-label
    if (!data.name) {
      const meButton = document.querySelector('.global-nav__primary-link-me-menu-trigger');
      if (meButton) {
        data.name = meButton.getAttribute('aria-label')?.replace('View profile for ', '').replace('View ', '');
      }
    }
    
    // Get profile photo from navigation bar
    data.profilePictureUrl = getAttr([
      '.global-nav__me-photo',
      'button.global-nav__primary-link-me-menu-trigger img',
      '.global-nav__me img'
    ], 'src');
    
    // Debug info
    const img = document.querySelector('.global-nav__me-photo') || 
                document.querySelector('button.global-nav__primary-link-me-menu-trigger img');
    
    if (img) {
      console.log('Found image element:');
      console.log('- Tag:', img.tagName);
      console.log('- Alt:', img.getAttribute('alt'));
      console.log('- Src:', img.getAttribute('src'));
      console.log('- Class:', img.className);
    } else {
      console.log('❌ No image found!');
      
      // Debug: show what selectors exist
      console.log('\nAvailable selectors:');
      document.querySelectorAll('[class*="nav"]').forEach((el, i) => {
        if (i < 10) console.log(`- ${el.tagName}.${el.className}`);
      });
    }
    
    return data;
  });
  
  console.log('✅ Extracted data:', feedPageData);
  console.log('\nName:', feedPageData.name || '❌ NOT FOUND');
  console.log('Photo URL:', feedPageData.profilePictureUrl ? feedPageData.profilePictureUrl.substring(0, 60) + '...' : '❌ NOT FOUND');
  
  // Try clicking dropdown
  console.log('\n🔽 Clicking Me dropdown...');
  await page.click('.global-nav__primary-link-me-menu-trigger');
  await page.waitForTimeout(2000);
  
  const dropdownData = await page.evaluate(() => {
    const getText = (selectors) => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) {
          return el.textContent.trim();
        }
      }
      return null;
    };
    
    const headline = getText([
      '.global-nav__me-content .t-14.t-black--light.t-normal',
      '.global-nav__me-content .artdeco-dropdown__content-inner p',
      '.nav-item__profile-member-photo ~ div .t-14',
      '.account-dropdown__content .ember-view p'
    ]);
    
    console.log('Dropdown headline:', headline || '❌ NOT FOUND');
    
    return { headline };
  });
  
  console.log('✅ Dropdown data:', dropdownData);
  
  console.log('\n✅ Test complete! Press Ctrl+C to close browser.');
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(30000);
  await browser.close();
}

testProfileExtraction().catch(console.error);
