// Debug script to find the actual LinkedIn selectors
const { chromium } = require('playwright');

async function debugLinkedInSelectors() {
  console.log('🚀 Launching browser to debug LinkedIn selectors...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('⚠️  IMPORTANT: You need to manually log into LinkedIn!');
  console.log('1. Browser will open LinkedIn login page');
  console.log('2. Log in manually');
  console.log('3. Once you see your feed, wait 5 seconds');
  console.log('4. Script will then extract and show all navigation bar elements\n');
  
  await page.goto('https://www.linkedin.com/login');
  
  // Wait for manual login
  console.log('⏳ Waiting 60 seconds for you to log in...');
  await page.waitForTimeout(60000);
  
  console.log('\n📊 Analyzing page structure...\n');
  
  const analysis = await page.evaluate(() => {
    const results = {
      navImages: [],
      navButtons: [],
      meButton: null,
      allNavElements: []
    };
    
    // Find all images in navigation
    const navImages = document.querySelectorAll('nav img, header img, [class*="global-nav"] img, [class*="nav"] img');
    navImages.forEach((img, i) => {
      results.navImages.push({
        index: i,
        tag: img.tagName,
        class: img.className,
        alt: img.getAttribute('alt'),
        src: img.src?.substring(0, 80),
        parent: img.parentElement?.tagName + '.' + img.parentElement?.className
      });
    });
    
    // Find Me button
    const meCandidates = [
      document.querySelector('.global-nav__primary-link-me-menu-trigger'),
      document.querySelector('[aria-label*="View profile"]'),
      document.querySelector('button[aria-label*="Me"]'),
      ...Array.from(document.querySelectorAll('nav button, header button'))
    ];
    
    meCandidates.forEach((btn, i) => {
      if (btn && btn.textContent?.includes('Me') || btn?.getAttribute('aria-label')?.includes('profile')) {
        results.navButtons.push({
          index: i,
          class: btn.className,
          ariaLabel: btn.getAttribute('aria-label'),
          text: btn.textContent?.trim().substring(0, 50),
          hasImage: !!btn.querySelector('img')
        });
      }
    });
    
    // Get first Me button details
    const meBtn = document.querySelector('[aria-label*="View profile"]') || 
                  document.querySelector('.global-nav__primary-link-me-menu-trigger') ||
                  Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Me');
    
    if (meBtn) {
      results.meButton = {
        class: meBtn.className,
        ariaLabel: meBtn.getAttribute('aria-label'),
        innerHTML: meBtn.innerHTML.substring(0, 200)
      };
      
      const img = meBtn.querySelector('img');
      if (img) {
        results.meButton.imageAlt = img.getAttribute('alt');
        results.meButton.imageSrc = img.src?.substring(0, 80);
        results.meButton.imageClass = img.className;
      }
    }
    
    // Get all navigation elements for overview
    document.querySelectorAll('[class*="nav"]').forEach((el, i) => {
      if (i < 20) {
        results.allNavElements.push({
          tag: el.tagName,
          class: el.className.substring(0, 60)
        });
      }
    });
    
    return results;
  });
  
  console.log('🖼️  Navigation Images Found:', analysis.navImages.length);
  analysis.navImages.forEach(img => {
    console.log(`  [${img.index}] ${img.tag}.${img.class}`);
    console.log(`      Alt: "${img.alt}"`);
    console.log(`      Src: ${img.src}`);
    console.log(`      Parent: ${img.parent}\n`);
  });
  
  console.log('\n🔘 Navigation Buttons Found:', analysis.navButtons.length);
  analysis.navButtons.forEach(btn => {
    console.log(`  [${btn.index}] Class: ${btn.class}`);
    console.log(`      Aria-Label: "${btn.ariaLabel}"`);
    console.log(`      Has Image: ${btn.hasImage}\n`);
  });
  
  console.log('\n👤 Me Button Analysis:');
  if (analysis.meButton) {
    console.log('  Class:', analysis.meButton.class);
    console.log('  Aria-Label:', analysis.meButton.ariaLabel);
    console.log('  Image Alt:', analysis.meButton.imageAlt);
    console.log('  Image Src:', analysis.meButton.imageSrc);
    console.log('  Image Class:', analysis.meButton.imageClass);
  } else {
    console.log('  ❌ NOT FOUND');
  }
  
  console.log('\n📋 Clicking Me dropdown to analyze...');
  
  try {
    await page.click('[aria-label*="View profile"]');
    await page.waitForTimeout(2000);
    
    const dropdownAnalysis = await page.evaluate(() => {
      const results = [];
      
      // Find dropdown content
      const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="artdeco-dropdown"]');
      dropdowns.forEach((dropdown, i) => {
        const text = dropdown.textContent?.trim().substring(0, 100);
        if (text) {
          results.push({
            index: i,
            class: dropdown.className,
            text: text,
            visible: dropdown.offsetParent !== null
          });
        }
      });
      
      return results.filter(r => r.visible);
    });
    
    console.log('\n📋 Dropdown Content Found:', dropdownAnalysis.length);
    dropdownAnalysis.forEach(dd => {
      console.log(`  [${dd.index}] ${dd.class}`);
      console.log(`      Text: "${dd.text}"\n`);
    });
    
  } catch (e) {
    console.log('  ⚠️  Could not click dropdown:', e.message);
  }
  
  console.log('\n✅ Analysis complete!');
  console.log('\n📝 Based on this, update the selectors in linkedin-cookie-auth.ts');
  console.log('   Look for image alt attributes and button aria-labels that contain your name\n');
  
  console.log('⏸️  Browser will stay open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  console.log('\n✅ Done!');
}

debugLinkedInSelectors().catch(console.error);
