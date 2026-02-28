/**
 * LinkedIn Cookie Extractor
 * 
 * Run this in your browser console while logged into LinkedIn
 * to get all the cookies needed for automation.
 * 
 * Usage:
 * 1. Go to https://www.linkedin.com and make sure you're logged in
 * 2. Press F12 to open Developer Tools
 * 3. Go to the "Console" tab
 * 4. Copy and paste this entire script
 * 5. Press Enter
 * 6. The cookies will be displayed and copied to clipboard
 */

(function() {
  console.log('🔍 LinkedIn Cookie Extractor v1.0');
  console.log('📍 Current domain:', window.location.hostname);
  
  if (!window.location.hostname.includes('linkedin.com')) {
    console.error('❌ Error: You must run this script on linkedin.com');
    alert('Please navigate to https://www.linkedin.com first, then run this script again.');
    return;
  }
  
  // Get all cookies
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {});
  
  // Check for required cookies
  const requiredCookies = ['li_at'];
  const recommendedCookies = ['JSESSIONID', 'bcookie', 'lidc', 'bscookie'];
  
  const found = {
    required: {},
    recommended: {},
    all: cookies
  };
  
  let allRequiredFound = true;
  
  console.log('\n📋 Checking for required cookies...');
  requiredCookies.forEach(name => {
    if (cookies[name]) {
      found.required[name] = cookies[name];
      console.log(`✅ ${name}: Found`);
    } else {
      allRequiredFound = false;
      console.log(`❌ ${name}: Missing`);
    }
  });
  
  console.log('\n📋 Checking for recommended cookies...');
  recommendedCookies.forEach(name => {
    if (cookies[name]) {
      found.recommended[name] = cookies[name];
      console.log(`✅ ${name}: Found`);
    } else {
      console.log(`⚠️  ${name}: Missing (optional)`);
    }
  });
  
  if (!allRequiredFound) {
    console.error('\n❌ Missing required cookies. Please make sure you are logged into LinkedIn.');
    alert('Error: You do not appear to be logged into LinkedIn. Please log in and try again.');
    return;
  }
  
  // Create the output
  const output = {
    li_at: found.required.li_at,
    JSESSIONID: found.recommended.JSESSIONID || '',
    bcookie: found.recommended.bcookie || '',
    lidc: found.recommended.lidc || '',
    bscookie: found.recommended.bscookie || ''
  };
  
  console.log('\n✅ Cookie extraction complete!');
  console.log('\n📦 JSON Format (Copy this for Full Cookies option):');
  console.log('━'.repeat(80));
  const jsonOutput = JSON.stringify(output, null, 2)
  console.log(jsonOutput);
  console.log('━'.repeat(80));
  
  console.log('\n📝 Simple Format (li_at only):');
  console.log('━'.repeat(80));
  console.log(output.li_at);
  console.log('━'.repeat(80));
  
  // Copy to clipboard
  try {
    // Copy the JSON format (recommended)
    navigator.clipboard.writeText(jsonOutput).then(() => {
      console.log('\n✅ Full cookie JSON copied to clipboard!');
      alert('✅ Success!\n\n' +
        'Your LinkedIn cookies have been extracted and copied to clipboard.\n\n' +
        '📋 What was copied: Full JSON with all cookies\n\n' +
        '✨ Next steps:\n' +
        '1. Go to your app\'s "Connect Account" page\n' +
        '2. Select "Login with Cookies" method\n' +
        '3. Choose "Full Cookies" format\n' +
        '4. Paste the copied JSON\n' +
        '5. Click Connect\n\n' +
        'Check the console for both JSON and simple formats.');
    }).catch(() => {
      console.log('\n⚠️  Could not copy to clipboard. Please copy manually from above.');
      alert('✅ Success!\n\n' +
        'Your LinkedIn cookies have been extracted.\n\n' +
        'Please copy the JSON from the console output.');
    });
  } catch (e) {
    console.log('\n⚠️  Could not copy to clipboard. Please copy manually from above.');
  }
  
  // Return the cookies
  return output;
})();
