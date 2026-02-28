// Test with your actual cookies to see what LinkedIn's structure really is
const { chromium } = require('playwright');

async function testLiveExtraction() {
  console.log('🚀 Starting live LinkedIn extraction test...\n');
  
  // PASTE YOUR COOKIES HERE from the browser
  const cookies = [
    {
      "name": "li_at",
      "value": "YOUR_LI_AT_VALUE_HERE", // Get from browser DevTools
      "domain": ".linkedin.com",
      "path": "/",
      "expires": -1,
      "httpOnly": true,
      "secure": true,
      "sameSite": "None"
    }
  ];
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Set cookies
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  
  console.log('📍 Navigating to LinkedIn feed...');
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  
  console.log('⏳ Waiting 5 seconds for page to load...');
  await page.waitForTimeout(5000);
  
  console.log('\n📊 Extracting ALL images on page...\n');
  
  const allImages = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    return images.map((img, i) => ({
      index: i,
      alt: img.alt,
      src: img.src?.substring(0, 80),
      className: img.className,
      parentClass: img.parentElement?.className || ''
    }));
  });
  
  console.log(`Found ${allImages.length} images total\n`);
  
  // Show first 15 images
  allImages.slice(0, 15).forEach(img => {
    console.log(`Image ${img.index}:`);
    console.log(`  Alt: "${img.alt}"`);
    console.log(`  Src: ${img.src}`);
    console.log(`  Class: ${img.className}`);
    console.log(`  Parent: ${img.parentClass}\n`);
  });
  
  console.log('\n📊 Looking for profile-related images...\n');
  
  const profileImages = allImages.filter(img => 
    img.src?.includes('licdn.com') && 
    !img.src?.includes('company') &&
    !img.src?.includes('logo') &&
    (img.alt?.length > 2 || img.className?.includes('photo') || img.className?.includes('profile'))
  );
  
  console.log(`Found ${profileImages.length} potential profile images:\n`);
  profileImages.forEach(img => {
    console.log(`  Alt: "${img.alt}" | Class: ${img.className}`);
  });
  
  console.log('\n📋 Extracting from raw HTML...\n');
  
  const html = await page.content();
  
  // Look for name patterns
  const namePatterns = [
    /alt="([^"]{3,50})"/g,
    /"firstName":"([^"]+)"/,
    /"lastName":"([^"]+)"/,
    /"name":"([^"]{3,50})"/g
  ];
  
  console.log('Names found in HTML:');
  namePatterns.forEach((pattern, i) => {
    const matches = [...html.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`\nPattern ${i + 1}:`);
      matches.slice(0, 5).forEach(m => console.log(`  - ${m[1]}`));
    }
  });
  
  console.log('\n\n📸 Taking screenshot...');
  await page.screenshot({ path: '/tmp/linkedin-feed.png', fullPage: false });
  console.log('Saved to: /tmp/linkedin-feed.png');
  
  console.log('\n✅ Test complete! Check the output above.');
  console.log('Browser will close in 10 seconds...\n');
  
  await page.waitForTimeout(10000);
  await browser.close();
}

// Instructions
console.log('⚠️  IMPORTANT: Edit this file first!');
console.log('1. Open this file in editor');
console.log('2. Replace YOUR_LI_AT_VALUE_HERE with your actual li_at cookie');
console.log('3. Get it from: DevTools → Application → Cookies → linkedin.com → li_at');
console.log('4. Then run: node test-live-extraction.js\n');

// Uncomment this line after adding your cookie
// testLiveExtraction().catch(console.error);

console.log('❌ Blocked: Please add your cookie first, then uncomment the last line');
