const puppeteer = require('puppeteer');

async function exploreHeyReach2FA() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    console.log('🔍 Navigating to HeyReach...');
    await page.goto('https://app.heyreach.io/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('📧 Entering credentials...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'happy.haplu@gmail.com');
    await page.type('input[type="password"]', 'System@123321');
    
    await page.click('button[type="submit"]');
    console.log('⏳ Waiting for login...');
    
    await page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: 30000 
    }).catch(() => console.log('Navigation complete'));

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔍 Looking for LinkedIn accounts page...');
    
    // Try to find LinkedIn accounts section
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Navigate to LinkedIn accounts if not there
    if (!currentUrl.includes('linkedin-accounts')) {
      console.log('🔍 Searching for LinkedIn accounts navigation...');
      
      // Look for navigation menu
      const navLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button'));
        return links.map(l => ({
          text: l.textContent.trim(),
          href: l.href || '',
          class: l.className
        })).filter(l => l.text);
      });
      
      console.log('Available navigation:', navLinks.slice(0, 20));
      
      // Try to click on LinkedIn accounts
      const linkedinLink = navLinks.find(l => 
        l.text.toLowerCase().includes('linkedin') || 
        l.text.toLowerCase().includes('account')
      );
      
      if (linkedinLink && linkedinLink.href) {
        console.log('📍 Navigating to:', linkedinLink.href);
        await page.goto(linkedinLink.href, { waitUntil: 'networkidle2' });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔍 Looking for "Add Account" or similar button...');
    
    // Find all buttons and clickable elements
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a[role="button"], div[role="button"]'));
      return btns.map(b => ({
        text: b.textContent.trim(),
        class: b.className,
        id: b.id
      })).filter(b => b.text);
    });
    
    console.log('Available buttons:', buttons);
    
    // Look for add account button
    const addAccountBtn = buttons.find(b => 
      b.text.toLowerCase().includes('add') || 
      b.text.toLowerCase().includes('connect') ||
      b.text.toLowerCase().includes('new')
    );
    
    if (addAccountBtn) {
      console.log('🎯 Found add button:', addAccountBtn.text);
      
      // Click the add account button
      await page.evaluate((text) => {
        const btns = Array.from(document.querySelectorAll('button, a[role="button"], div[role="button"]'));
        const btn = btns.find(b => b.textContent.trim() === text);
        if (btn) btn.click();
      }, addAccountBtn.text);
      
      console.log('⏳ Waiting for modal/form...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Take screenshot of the form
      await page.screenshot({ path: 'heyreach-add-account-modal.png', fullPage: true });
      console.log('📸 Screenshot saved: heyreach-add-account-modal.png');
      
      // Analyze the form
      const formStructure = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        const labels = Array.from(document.querySelectorAll('label'));
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        
        return {
          inputs: inputs.map(i => ({
            type: i.type,
            name: i.name,
            placeholder: i.placeholder,
            id: i.id,
            value: i.value
          })),
          labels: labels.map(l => ({
            text: l.textContent.trim(),
            for: l.getAttribute('for')
          })),
          checkboxes: checkboxes.map(c => ({
            name: c.name,
            id: c.id,
            checked: c.checked,
            label: c.nextElementSibling?.textContent.trim() || c.previousElementSibling?.textContent.trim()
          }))
        };
      });
      
      console.log('\n📋 FORM STRUCTURE:');
      console.log('Inputs:', JSON.stringify(formStructure.inputs, null, 2));
      console.log('Labels:', JSON.stringify(formStructure.labels, null, 2));
      console.log('Checkboxes:', JSON.stringify(formStructure.checkboxes, null, 2));
      
      // Look for 2FA or infinite login options
      const pageText = await page.evaluate(() => document.body.textContent);
      
      console.log('\n🔍 Looking for 2FA/Infinite Login keywords...');
      const keywords = ['2fa', 'two factor', 'infinite', 'session', 'cookie', 'remember', 'keep logged'];
      keywords.forEach(keyword => {
        if (pageText.toLowerCase().includes(keyword)) {
          console.log(`✅ Found keyword: "${keyword}"`);
        }
      });
      
      // Get all HTML of the modal/form
      const modalHTML = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"], .modal, [class*="modal"]');
        return modal ? modal.outerHTML : document.body.innerHTML;
      });
      
      console.log('\n📄 Modal HTML (first 2000 chars):');
      console.log(modalHTML.substring(0, 2000));
    }

    console.log('\n⏳ Keeping browser open for 120 seconds for manual exploration...');
    console.log('💡 You can manually click around to explore the 2FA/infinite login feature');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.screenshot({ path: 'heyreach-error.png' });
  } finally {
    await browser.close();
    console.log('✅ Done!');
  }
}

exploreHeyReach2FA();
