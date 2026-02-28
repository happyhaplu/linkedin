// lib/linkedin-network-sync.ts
// @ts-nocheck
/* eslint-disable */
import { chromium } from 'playwright'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface NetworkSyncResult {
  total_connections_synced: number
  new_connections_added: number
  connections_updated: number
  total_requests_synced?: number
  pending_requests?: number
  accepted_requests?: number
}

/**
 * Auto-disconnect account if LinkedIn session is invalid
 */
async function handleAccountDisconnection(accountId: string, errorMessage: string): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Check if error indicates account restriction/logout
    const errorLower = errorMessage.toLowerCase()
    const shouldDisconnect = 
      errorLower.includes('restricted') ||
      errorLower.includes('suspended') ||
      errorLower.includes('banned') ||
      errorLower.includes('logged out') ||
      errorLower.includes('session expired') ||
      errorLower.includes('unauthorized') ||
      errorLower.includes('login required') ||
      errorLower.includes('cookies expired') ||
      errorLower.includes('too many redirects') ||
      errorLower.includes('authwall') ||
      errorLower.includes('err_too_many_redirects')
    
    if (shouldDisconnect) {
      console.log(`🔴 Auto-disconnecting account ${accountId}: ${errorMessage}`)
      
      await supabase
        .from('linkedin_accounts')
        .update({
          status: 'disconnected',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
      
      console.log('✅ Account marked as disconnected')
      
      // Refresh the frontend
      try {
        revalidatePath('/linkedin-account')
        revalidatePath('/my-network')
      } catch (e) {
        console.log('⚠️ Revalidation skipped')
      }
    }
  } catch (error) {
    console.error('Failed to auto-disconnect account:', error)
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function parseCookiesInput(cookies: any): Record<string, string> {
  if (!cookies) return {}
  if (typeof cookies === 'string') {
    try {
      const parsed = JSON.parse(cookies)
      if (Array.isArray(parsed)) {
        const obj: Record<string, string> = {}
        parsed.forEach((c: any) => {
          if (c.name && c.value) obj[c.name] = c.value
        })
        return obj
      }
      return parsed as Record<string, string>
    } catch {
      return { li_at: cookies }
    }
  }
  if (typeof cookies === 'object' && !Array.isArray(cookies)) return cookies
  return {}
}

function buildCookieArray(obj: Record<string, string>): any[] {
  const arr: any[] = []
  if (obj.li_at) arr.push({ name: 'li_at', value: obj.li_at, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'None' as const })
  if (obj.JSESSIONID) {
    const val = obj.JSESSIONID.startsWith('"') ? obj.JSESSIONID : `"${obj.JSESSIONID}"`
    arr.push({ name: 'JSESSIONID', value: val, domain: '.www.linkedin.com', path: '/', httpOnly: false, secure: true, sameSite: 'None' as const })
  }
  if (obj.bcookie) arr.push({ name: 'bcookie', value: obj.bcookie, domain: '.linkedin.com', path: '/', httpOnly: false, secure: true, sameSite: 'None' as const })
  if (obj.bscookie) arr.push({ name: 'bscookie', value: obj.bscookie, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'None' as const })
  if (obj.lidc) arr.push({ name: 'lidc', value: obj.lidc, domain: '.linkedin.com', path: '/', httpOnly: false, secure: true, sameSite: 'None' as const })
  return arr
}

// ─── Voyager API strategy ─────────────────────────────────────────────────────
/**
 * Fetch ALL connections via LinkedIn Voyager API with correct response parsing.
 *
 * Response shape:
 *   { data: { '*elements': ['urn:li:fsd_connection:...', ...], paging: {count,start} },
 *     included: [ ...Profile objects..., ...Connection objects... ] }
 *
 * - data['*elements']  → URN strings (not objects)
 * - included           → Profile ($type=Profile) and Connection ($type=Connection) objects
 * - Connection.connectedMember → matches Profile.entityUrn
 * - paging has NO 'total' → stop when URNs returned < PAGE_SIZE
 */
async function fetchConnectionsViaAPI(page: any, csrfToken: string): Promise<any[]> {
  const PAGE_SIZE = 40
  let start = 0
  const all: any[] = []
  const seen = new Set<string>()

  console.log('🌐 Fetching via Voyager API...')

  while (true) {
    const batch: any = await page.evaluate(async ({ start, count, token }: any) => {
      try {
        const url = `https://www.linkedin.com/voyager/api/relationships/dash/connections?decorationId=com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-16&count=${count}&q=search&start=${start}&sortType=RECENTLY_ADDED`
        const r = await fetch(url, {
          credentials: 'include',
          headers: {
            'csrf-token': token,
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'x-restli-protocol-version': '2.0.0',
          },
        })
        if (!r.ok) return { _err: r.status + ' ' + r.statusText }
        return await r.json()
      } catch (e: any) { return { _err: e.message } }
    }, { start, count: PAGE_SIZE, token: csrfToken })

    if (batch?._err) {
      console.log(`⚠️ API error at offset ${start}: ${batch._err}`)
      if (all.length > 0) break   // return what we have
      return []                    // signal: fall back to DOM
    }

    const included: any[] = batch?.included ?? []
    const elementUrns: string[] = batch?.data?.['*elements'] ?? []

    if (elementUrns.length === 0) {
      console.log(`📭 No more URNs at offset ${start}, done.`)
      break
    }

    // Split included into profiles and connections
    const profiles = new Map<string, any>()
    const connections: any[] = []
    for (const item of included) {
      if (item.$type === 'com.linkedin.voyager.dash.identity.profile.Profile' && item.publicIdentifier) {
        profiles.set(item.entityUrn, item)
      } else if (item.$type === 'com.linkedin.voyager.dash.relationships.Connection' && item.connectedMember) {
        connections.push(item)
      }
    }

    for (const conn of connections) {
      const memberUrn = conn.connectedMember || ''
      const profile = profiles.get(memberUrn)
      const publicId = profile?.publicIdentifier || ''
      if (!publicId || seen.has(publicId)) continue
      seen.add(publicId)

      const firstName = profile?.firstName || ''
      const lastName = profile?.lastName || ''
      const headline = profile?.headline || profile?.occupation || ''

      let jobTitle = headline
      let company = ''
      if (headline.includes(' at ')) {
        const p = headline.split(' at ')
        jobTitle = p[0].trim()
        company = p.slice(1).join(' at ').trim()
      }

      let profilePicUrl = ''
      const vec = profile?.profilePicture?.displayImageReference?.vectorImage
      if (vec?.rootUrl && vec?.artifacts?.length > 0) {
        const sorted = [...vec.artifacts].sort((a: any, b: any) => (b.width || 0) - (a.width || 0))
        const best = sorted.find((a: any) => a.width <= 400) || sorted[0]
        profilePicUrl = vec.rootUrl + (best?.fileIdentifyingUrlPathSegment || '')
      }

      all.push({
        connection_profile_id: publicId,
        connection_linkedin_url: `https://www.linkedin.com/in/${publicId}/`,
        full_name: `${firstName} ${lastName}`.trim() || publicId,
        first_name: firstName,
        last_name: lastName,
        headline,
        position: jobTitle,
        company,
        profile_picture_url: profilePicUrl,
        location: '',
        connected_at: conn.createdAt ? new Date(conn.createdAt).toISOString() : null,
      })
    }

    console.log(`   📥 ${all.length} connections so far (offset ${start}, got ${elementUrns.length} URNs, ${connections.length} matched)`)
    start += PAGE_SIZE

    if (elementUrns.length < PAGE_SIZE) {
      console.log(`   ✅ Last page (${elementUrns.length} < ${PAGE_SIZE}) — all fetched.`)
      break
    }
    await delay(700 + Math.random() * 300)
  }

  console.log(`✅ Voyager API total: ${all.length} connections`)
  return all
}

// ─── DOM scroll-and-scrape strategy ─────────────────────────────────────────
async function fetchConnectionsViaDOM(page: any): Promise<any[]> {
  console.log('🖥️ Falling back to DOM extraction...')

  // Scroll until all connections are loaded
  const MAX_STABLE_ROUNDS = 4
  let stableRounds = 0
  let previousCount = 0

  while (stableRounds < MAX_STABLE_ROUNDS) {
    const currentCount = await page.evaluate(() =>
      document.querySelectorAll('a[data-view-name="connections-profile"]').length
    )
    if (currentCount === previousCount) {
      stableRounds++
    } else {
      stableRounds = 0
      previousCount = currentCount
    }
    console.log(`   📜 Scrolling... ${currentCount} links loaded (stable: ${stableRounds}/${MAX_STABLE_ROUNDS})`)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await delay(1800 + Math.random() * 500)
    // Click "Show more" button if present
    try {
      const btn = await page.$('button.scaffold-finite-scroll__load-button')
      if (btn) { await btn.click(); await delay(2000); stableRounds = 0 }
    } catch { /* no button */ }
  }

  console.log(`📊 Scroll done. Extracting...`)

  const connections = await page.evaluate(() => {
    const results: any[] = []
    const seen = new Set<string>()
    const links = document.querySelectorAll('a[data-view-name="connections-profile"]')

    for (let i = 0; i < links.length; i++) {
      const link = links[i] as HTMLAnchorElement
      const href = link.getAttribute('href') || ''
      if (!href.includes('/in/')) continue
      const m = href.match(/\/in\/([^/?]+)/)
      if (!m) continue
      const profileId = m[1]
      if (seen.has(profileId)) continue
      seen.add(profileId)

      // Walk up 6 levels to get a good container
      let container: Element | null = link
      for (let d = 0; d < 6; d++) {
        if (!container?.parentElement) break
        container = container.parentElement
      }

      const data: any = {
        connection_profile_id: profileId,
        connection_linkedin_url: href.startsWith('http') ? href.split('?')[0] : `https://www.linkedin.com${href.split('?')[0]}`,
      }

      // Name: try img alt first ("Name's profile picture")
      if (container) {
        for (const img of container.querySelectorAll('img')) {
          const alt = img.getAttribute('alt') || ''
          const nm = alt.match(/^(.+?)(?:'s|'s)?\s+profile\s+picture$/i)
          if (nm && nm[1].trim().length > 1) { data.full_name = nm[1].trim(); break }
        }
      }

      // Name fallback: first non-trivial text line of container
      if (!data.full_name && container) {
        const lines = ((container as HTMLElement).innerText || '').split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 1 && l.length < 80 &&
            !l.match(/^(Message|Connect|Follow|Connected on|\d)/i))
        if (lines[0]) data.full_name = lines[0]
        if (lines[1]) data.headline = lines[1]
      }

      // Profile picture
      if (container) {
        for (const img of container.querySelectorAll('img')) {
          const src = img.getAttribute('src') || ''
          if (src && !src.includes('data:') && !src.includes('ghost') &&
              (src.includes('licdn') || src.includes('profile'))) {
            data.profile_picture_url = src; break
          }
        }
      }

      // Parse headline
      if (data.headline?.includes(' at ')) {
        const p = data.headline.split(' at ')
        data.position = p[0].trim()
        data.company = p.slice(1).join(' at ').trim()
      } else if (data.headline) {
        data.position = data.headline
      }

      data.full_name = data.full_name || profileId
      results.push(data)
    }
    return results
  })

  console.log(`✅ DOM extracted ${connections.length} connections`)
  return connections
}

// ─── Main sync function ───────────────────────────────────────────────────────
/**
 * Sync ALL LinkedIn connections. Tries Voyager API first (handles 1000+).
 * Falls back to DOM scroll-and-scrape if API fails.
 */
export async function syncLinkedInNetwork(
  cookies: any,
  linkedinAccountId: string,
  userId: string,
  syncType: 'full' | 'incremental' | 'connection_requests' = 'full'
): Promise<NetworkSyncResult> {
  let browser

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const cookiesObj = parseCookiesInput(cookies)
    const li_at = cookiesObj.li_at || cookiesObj.LI_AT
    if (!li_at) throw new Error('Missing li_at cookie')

    console.log('🚀 Launching browser...')
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    })
    const page = await context.newPage()

    const cookiesToSet = buildCookieArray(cookiesObj)
    await context.addCookies(cookiesToSet)
    console.log(`🍪 Set ${cookiesToSet.length} cookies`)

    // Navigate — feed first to warm session, then connections
    console.log('🔗 Navigating to LinkedIn...')
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    await delay(3000)

    const currentUrl = page.url()
    if (currentUrl.includes('/login') || currentUrl.includes('authwall')) {
      throw new Error('Cookies expired or invalid — redirected to login')
    }
    console.log('✅ Loaded connections page')

    // ── Get CSRF token for Voyager API ─────────────────────
    let csrfToken: string = await page.evaluate(() => {
      const m = document.cookie.match(/JSESSIONID="?([^";]+)/)
      return m ? m[1] : ''
    }).catch(() => '')
    if (!csrfToken && cookiesObj.JSESSIONID) {
      csrfToken = cookiesObj.JSESSIONID.replace(/^"|"$/g, '')
    }
    console.log(`🔑 CSRF token: ${csrfToken ? 'found' : 'NOT found'}`)

    // ── Strategy 1: Voyager API ────────────────────────────
    let connections: any[] = []
    if (csrfToken) {
      connections = await fetchConnectionsViaAPI(page, csrfToken)
    }

    // ── Strategy 2: DOM fallback ───────────────────────────
    if (connections.length === 0) {
      console.log('⚠️ API returned 0 — using DOM fallback...')
      connections = await fetchConnectionsViaDOM(page)
    }

    await browser.close()
    browser = undefined

    console.log(`📊 Total fetched: ${connections.length} connections`)

    if (connections.length === 0) {
      return { total_connections_synced: 0, new_connections_added: 0, connections_updated: 0 }
    }

    // ── Upsert to database ─────────────────────────────────
    let newCount = 0
    let updatedCount = 0
    const now = new Date().toISOString()

    // Batch upsert using connection_profile_id as unique key
    // Skip rows without a valid profile ID
    const validConns = connections.filter(c => c.connection_profile_id && c.connection_profile_id.length > 1)

    for (const conn of validConns) {
      try {
        const row = {
          user_id: userId,
          linkedin_account_id: linkedinAccountId,
          connection_profile_id: conn.connection_profile_id,
          connection_linkedin_url: conn.connection_linkedin_url || `https://www.linkedin.com/in/${conn.connection_profile_id}/`,
          full_name: conn.full_name || conn.connection_profile_id,
          first_name: conn.first_name || '',
          last_name: conn.last_name || '',
          headline: conn.headline || conn.position || '',
          position: conn.position || '',
          company: conn.company || '',
          profile_picture_url: conn.profile_picture_url || null,
          location: conn.location || '',
          connection_status: 'connected',
          connected_at: conn.connected_at || now,
          last_synced_at: now,
          is_synced: true,
          updated_at: now,
        }

        const { error } = await supabase
          .from('network_connections')
          .upsert(row, {
            onConflict: 'linkedin_account_id,connection_profile_id',
            ignoreDuplicates: false
          })

        if (error) {
          // If upsert fails (e.g. null profile_id violates constraint), try insert ignoring conflicts
          console.error(`❌ Upsert error for ${conn.full_name}:`, error.message)
        } else {
          // We can't easily tell new vs updated with upsert, count all as new for now
          newCount++
        }
      } catch (dbError: any) {
        console.error(`❌ DB exception for ${conn.full_name}:`, dbError.message)
      }
    }

    // Count actual new vs updated by comparing with pre-existing
    updatedCount = 0  // upsert handles both
    console.log(`💾 Database: ${newCount} upserted (${connections.length} total connections)`)

    return {
      total_connections_synced: connections.length,
      new_connections_added: newCount,
      connections_updated: updatedCount
    }

  } catch (error: any) {
    console.error('❌ Sync error:', error.message)
    await handleAccountDisconnection(linkedinAccountId, error.message || 'Network sync failed')
    if (browser) await browser.close()
    throw error
  }
}

/**
 * Get connection count from LinkedIn via Voyager API.
 * Note: paging.total is NOT available in the connections API —
 * we count the stored rows or fall back to DOM scraping.
 */
export async function getLinkedInConnectionCount(li_at_cookie: string, sessionCookies?: Record<string, any>): Promise<number> {
  let browser

  try {
    const cookiesObj: Record<string, string> = sessionCookies?.li_at
      ? (sessionCookies as Record<string, string>)
      : { li_at: li_at_cookie }

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const context = await browser.newContext()
    const page = await context.newPage()
    await context.addCookies(buildCookieArray(cookiesObj))

    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    await delay(2000)

    if (page.url().includes('/login') || page.url().includes('authwall')) {
      await browser.close()
      return 0
    }

    // Try to read count from the page header
    const count = await page.evaluate(() => {
      // LinkedIn shows "X Connections" in a heading
      const all = document.querySelectorAll('h1, h2, h3, header, [aria-label]')
      for (const el of all) {
        const m = (el.textContent || el.getAttribute('aria-label') || '').match(/(\d[\d,]+)\s+Connection/i)
        if (m) return parseInt(m[1].replace(/,/g, ''), 10)
      }
      // Fallback: count profile links visible
      return document.querySelectorAll('a[data-view-name="connections-profile"]').length
    })

    await browser.close()
    return count
  } catch {
    if (browser) await browser.close()
    return 0
  }
}
