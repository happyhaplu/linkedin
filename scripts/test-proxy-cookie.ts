/**
 * Test cookie validation through proxy
 * This tests the FULL flow: proxy resolution → Playwright through proxy → LinkedIn
 * 
 * Usage: npx tsx scripts/test-proxy-cookie.ts
 */
import { createClient } from '@supabase/supabase-js'
import { buildPlaywrightProxyConfig, buildProxyUrl } from '../lib/utils/proxy-helpers'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'
import { chromium } from 'playwright'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlsyvgjcxxoregwrwuzf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== Test: Cookie Auth Through Proxy (Playwright Native) ===\n')

  // 1. Fetch LinkedIn account with proxy
  const { data: account } = await supabase
    .from('linkedin_accounts')
    .select('*, proxy:proxies(*)')
    .eq('id', 'b4884875-d423-402f-b717-2e339bc34223')
    .single()

  if (!account) { console.error('Account not found'); process.exit(1) }
  console.log(`📧 Account: ${account.email}`)
  console.log(`📊 Status: ${account.status}`)
  console.log(`🍪 Has cookies: ${!!account.session_cookies?.li_at}`)
  
  // 2. Resolve proxy config (Playwright native format)
  let proxyConfig: { server: string; username?: string; password?: string } | undefined
  if (account.proxy) {
    const proxyRecord = Array.isArray(account.proxy) ? account.proxy[0] : account.proxy
    if (proxyRecord) {
      proxyConfig = buildPlaywrightProxyConfig(proxyRecord)
      console.log(`🌐 Proxy server: ${proxyConfig.server}`)
      console.log(`🔑 Proxy auth: ${proxyConfig.username || 'none'}`)
    }
  }

  if (!proxyConfig) {
    console.error('❌ No proxy assigned to this account!')
    process.exit(1)
  }

  // 3. Launch browser and create context WITH proxy
  console.log('\n--- Step 1: Verify proxy IP ---')
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  })

  // Use Playwright's native proxy support (handles auth natively!)
  const ctx = await browser.newContext({
    proxy: proxyConfig,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  })
  
  const page = await ctx.newPage()
  
  try {
    await page.goto('https://ipv4.webshare.io/', { timeout: 15000 })
    const ip = await page.textContent('body')
    console.log(`✅ Browser IP through proxy: ${ip?.trim()}`)
  } catch (e: any) {
    console.error('❌ Proxy IP check failed:', e.message?.split('\n')[0])
    await browser.close()
    process.exit(1)
  }
  
  // 4. Test LinkedIn with cookies through proxy
  console.log('\n--- Step 2: Test LinkedIn cookies through proxy ---')
  
  if (!account.session_cookies?.li_at) {
    console.log('⚠️ No cookies stored — need to reconnect account with cookies first')
    await browser.close()
    process.exit(0)
  }

  const cookies = sessionCookiesToPlaywright(account.session_cookies)
  console.log(`🍪 Setting ${cookies.length} cookies...`)
  await ctx.addCookies(cookies)

  // Remove webdriver flag
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  try {
    const linkedInPage = await ctx.newPage()
    console.log('🔄 Navigating to LinkedIn feed...')
    await linkedInPage.goto('https://www.linkedin.com/feed', { 
      waitUntil: 'load', 
      timeout: 30000 
    })
    
    const finalUrl = linkedInPage.url()
    console.log(`📍 Final URL: ${finalUrl}`)
    
    const isValid = finalUrl.includes('/feed') || finalUrl.includes('/in/')
    
    if (isValid) {
      console.log('✅ SUCCESS! LinkedIn accepted the cookies through the proxy!')
      console.log('🎉 The proxy integration is working correctly!')
      
      const title = await linkedInPage.title()
      console.log(`📄 Page title: ${title}`)
    } else {
      console.log('❌ LinkedIn rejected the session')
      console.log(`   Redirected to: ${finalUrl}`)
      
      if (finalUrl.includes('/login') || finalUrl.includes('authwall')) {
        console.log('\n⚠️ Cookies are expired or were created on a different IP.')
        console.log('💡 You need to get FRESH cookies while browsing THROUGH this proxy.')
        console.log('   1. Configure your browser to use proxy: http://xfkfrbeb:8jpnmtlggdcn@31.59.20.176:6754')
        console.log('   2. Login to LinkedIn through the proxy')
        console.log('   3. Copy cookies and reconnect the account in our UI')
      }
    }
  } catch (e: any) {
    console.error('❌ Navigation error:', e.message?.split('\n')[0])
    
    if (e.message.includes('ERR_TOO_MANY_REDIRECTS')) {
      console.log('\n⚠️ Same redirect loop — cookies are bound to a different IP')
      console.log('💡 SOLUTION: Get fresh cookies while using proxy 31.59.20.176')
    }
  }

  await browser.close()
  console.log('\n=== Test Complete ===')
}

main().catch(console.error)
