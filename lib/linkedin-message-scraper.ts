/**
 * LinkedIn Message Scraper
 * 
 * Uses Playwright to scrape conversations and messages from LinkedIn's messaging page.
 * Also sends real replies through LinkedIn's messaging UI.
 * 
 * Reuses the same authenticated-browser pattern as campaign automation.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sessionCookiesToPlaywright } from './linkedin-cookie-auth'

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrapedConversation {
  threadId: string
  participantName: string
  participantHeadline?: string
  participantAvatarUrl?: string
  participantProfileUrl?: string
  lastMessagePreview?: string
  lastMessageAt: string
  unreadCount: number
}

export interface ScrapedMessage {
  senderName: string
  content: string
  sentAt: string
  isFromMe: boolean
  messageId: string
}

interface LinkedInAccount {
  id: string
  email: string
  password: string
  cookies?: any[]
  session_cookies?: Record<string, string>
  proxy_url?: string
  proxy_config?: { server: string; username?: string; password?: string }
}

// ─── Browser setup (same pattern as campaign automation) ─────────────────────

async function createMessagingBrowser(account: LinkedInAccount): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  const contextOptions: any = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  }

  if (account.proxy_config) {
    contextOptions.proxy = account.proxy_config
    console.log(`[MsgSync] Using proxy: ${account.proxy_config.server}`)
  }

  const context = await browser.newContext(contextOptions)

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    // @ts-ignore
    delete window.__playwright
    // @ts-ignore
    delete window.__pwInitScripts
  })

  // Load cookies
  if (account.cookies && Array.isArray(account.cookies) && account.cookies.length > 0) {
    await context.addCookies(account.cookies)
  } else if (account.session_cookies && typeof account.session_cookies === 'object' && account.session_cookies.li_at) {
    const pwCookies = sessionCookiesToPlaywright(account.session_cookies)
    await context.addCookies(pwCookies)
  }

  return { browser, context }
}

// ─── Scrape conversations list ───────────────────────────────────────────────

export async function scrapeConversations(account: LinkedInAccount): Promise<ScrapedConversation[]> {
  let browser: Browser | null = null

  try {
    const result = await createMessagingBrowser(account)
    browser = result.browser
    const page = await result.context.newPage()

    // Navigate to messaging
    await page.goto('https://www.linkedin.com/messaging/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Check if we're still logged in
    const url = page.url()
    if (url.includes('/login') || url.includes('/authwall')) {
      throw new Error('LinkedIn session expired — need re-authentication')
    }

    // Wait for messaging to load
    await page.waitForTimeout(3000)

    // Wait for the conversation list
    const listSelector = '.msg-conversations-container__conversations-list, .msg-conversation-listitem, ul.list-style-none'
    try {
      await page.waitForSelector(listSelector, { timeout: 15000 })
    } catch {
      // Maybe empty inbox
      console.log('[MsgSync] No conversation list found — inbox may be empty')
      return []
    }

    // Scroll to load more conversations (up to ~50)
    const listContainer = page.locator('.msg-conversations-container__conversations-list').first()
    for (let i = 0; i < 3; i++) {
      try {
        await listContainer.evaluate(el => el.scrollTop = el.scrollHeight)
        await page.waitForTimeout(1500)
      } catch { break }
    }

    // Extract conversation data
    const conversations: ScrapedConversation[] = await page.evaluate(() => {
      const items = document.querySelectorAll('li.msg-conversation-listitem, li.msg-conversations-container__pillar')
      const results: any[] = []

      items.forEach((item, index) => {
        try {
          // Name
          const nameEl = item.querySelector('.msg-conversation-card__participant-names, .msg-conversation-listitem__participant-names, h3 span')
          const name = nameEl?.textContent?.trim()
          if (!name) return

          // Thread ID from the link
          const link = item.querySelector('a[href*="/messaging/thread/"]') as HTMLAnchorElement
          let threadId = ''
          if (link) {
            const match = link.href.match(/\/messaging\/thread\/([^/?]+)/)
            threadId = match ? match[1] : `thread_${index}`
          } else {
            threadId = `thread_${index}`
          }

          // Last message preview
          const previewEl = item.querySelector('.msg-conversation-card__message-snippet, .msg-conversation-card__message-snippet-body, p.msg-conversation-listitem__message-snippet')
          const preview = previewEl?.textContent?.trim() || ''

          // Timestamp
          const timeEl = item.querySelector('.msg-conversation-card__time-stamp, .msg-conversation-listitem__time-stamp, time')
          const timeStr = timeEl?.textContent?.trim() || ''

          // Unread indicator
          const unreadEl = item.querySelector('.msg-conversation-card__unread-count, .notification-badge, .msg-conversation-listitem__unread-count')
          const unreadCount = unreadEl ? parseInt(unreadEl.textContent?.trim() || '1') || 1 : 0

          // Avatar
          const avatarEl = item.querySelector('img.msg-facepile-grid__img, img.presence-entity__image, img.EntityPhoto-circle-3') as HTMLImageElement
          const avatarUrl = avatarEl?.src || ''

          // Headline (if available in the card)
          const headlineEl = item.querySelector('.msg-conversation-card__participant-headline')
          const headline = headlineEl?.textContent?.trim() || ''

          results.push({
            threadId,
            participantName: name,
            participantHeadline: headline || undefined,
            participantAvatarUrl: avatarUrl || undefined,
            lastMessagePreview: preview || undefined,
            lastMessageAt: new Date().toISOString(), // Will be refined from messages
            unreadCount,
          })
        } catch (e) {
          // Skip broken items
        }
      })

      return results
    })

    console.log(`[MsgSync] Scraped ${conversations.length} conversations for ${account.email}`)
    return conversations

  } catch (err: any) {
    console.error(`[MsgSync] Error scraping conversations:`, err.message)
    throw err
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

// ─── Scrape messages from a single thread ────────────────────────────────────

export async function scrapeThreadMessages(
  account: LinkedInAccount,
  threadId: string,
): Promise<ScrapedMessage[]> {
  let browser: Browser | null = null

  try {
    const result = await createMessagingBrowser(account)
    browser = result.browser
    const page = await result.context.newPage()

    // Navigate directly to the thread
    await page.goto(`https://www.linkedin.com/messaging/thread/${threadId}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    const url = page.url()
    if (url.includes('/login') || url.includes('/authwall')) {
      throw new Error('LinkedIn session expired')
    }

    await page.waitForTimeout(3000)

    // Wait for messages to load
    try {
      await page.waitForSelector('.msg-s-event-listitem, .msg-s-message-list-content', { timeout: 10000 })
    } catch {
      console.log(`[MsgSync] No messages found in thread ${threadId}`)
      return []
    }

    // Scroll up to load older messages
    const msgContainer = page.locator('.msg-s-message-list-content, .msg-s-message-list').first()
    for (let i = 0; i < 2; i++) {
      try {
        await msgContainer.evaluate(el => el.scrollTop = 0)
        await page.waitForTimeout(1500)
      } catch { break }
    }

    // Extract messages
    const messages: ScrapedMessage[] = await page.evaluate(() => {
      const events = document.querySelectorAll('.msg-s-event-listitem, .msg-s-message-list__event')
      const results: any[] = []
      let currentSender = ''
      let isMeSender = false

      events.forEach((event, index) => {
        try {
          // Check for sender group header
          const senderEl = event.querySelector('.msg-s-message-group__name, .msg-s-event-listitem__name, .msg-s-message-group__profile-link')
          if (senderEl) {
            currentSender = senderEl.textContent?.trim() || 'Unknown'
          }

          // Check if sent by "You" or the account owner
          const metaEl = event.querySelector('.msg-s-message-group__meta, .msg-s-event-listitem__meta')
          const metaText = metaEl?.textContent?.trim()?.toLowerCase() || ''
          if (senderEl) {
            isMeSender = metaText.includes('you') || 
              event.classList.contains('msg-s-event-listitem--other') === false
          }

          // Message body
          const bodyEl = event.querySelector('.msg-s-event-listitem__body, .msg-s-event__content, .msg-s-message-group__message-body p')
          const content = bodyEl?.textContent?.trim()
          if (!content) return

          // Timestamp
          const timeEl = event.querySelector('.msg-s-message-group__timestamp, time, .msg-s-event-listitem__timestamp')
          const timeStr = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''

          results.push({
            senderName: currentSender || 'Unknown',
            content,
            sentAt: timeStr || new Date().toISOString(),
            isFromMe: isMeSender,
            messageId: `msg_${threadId}_${index}`,
          })
        } catch (e) {
          // Skip broken messages
        }
      })

      return results
    })

    console.log(`[MsgSync] Scraped ${messages.length} messages from thread ${threadId}`)
    return messages

  } catch (err: any) {
    console.error(`[MsgSync] Error scraping thread ${threadId}:`, err.message)
    throw err
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

// ─── Send a real message via LinkedIn ────────────────────────────────────────

export async function sendLinkedInReply(
  account: LinkedInAccount,
  threadId: string,
  messageText: string,
): Promise<{ success: boolean; error?: string }> {
  let browser: Browser | null = null

  try {
    const result = await createMessagingBrowser(account)
    browser = result.browser
    const page = await result.context.newPage()

    // Navigate to the thread
    await page.goto(`https://www.linkedin.com/messaging/thread/${threadId}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    const url = page.url()
    if (url.includes('/login') || url.includes('/authwall')) {
      throw new Error('LinkedIn session expired')
    }

    await page.waitForTimeout(2000)

    // Find the message input
    const composerSelectors = [
      'div.msg-form__contenteditable[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      '.msg-form__msg-content-container div[contenteditable]',
    ]

    let composer = null
    for (const sel of composerSelectors) {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        composer = el
        break
      }
    }

    if (!composer) {
      await page.screenshot({ path: '/tmp/msg-send-fail.png' })
      throw new Error('Could not find message composer')
    }

    // Click the composer, type the message
    await composer.click()
    await page.waitForTimeout(500)

    // Type message with human-like speed
    await composer.fill(messageText)
    await page.waitForTimeout(500)

    // Click send button
    const sendSelectors = [
      'button.msg-form__send-button',
      'button[type="submit"].msg-form__send-button',
      'button.msg-form__send-btn',
    ]

    let sent = false
    for (const sel of sendSelectors) {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isDisabled = await btn.isDisabled()
        if (!isDisabled) {
          await btn.click()
          sent = true
          break
        }
      }
    }

    if (!sent) {
      // Fallback: try pressing Enter
      await composer.press('Enter')
      sent = true
    }

    // Wait for message to appear
    await page.waitForTimeout(2000)

    console.log(`[MsgSync] ✅ Reply sent in thread ${threadId}`)
    return { success: true }

  } catch (err: any) {
    console.error(`[MsgSync] Error sending reply in thread ${threadId}:`, err.message)
    return { success: false, error: err.message }
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

// ─── Full sync: scrape and save to DB ────────────────────────────────────────

export async function syncAccountMessages(linkedinAccountId: string): Promise<{
  synced: number
  errors: number
}> {
  const supabase = getServiceSupabase()
  let synced = 0
  let errors = 0

  try {
    // Fetch the account details (need cookies + proxy)
    const { data: account, error: accErr } = await supabase
      .from('linkedin_accounts')
      .select('id, email, password, cookies, session_cookies, proxy_url, proxy_username, proxy_password')
      .eq('id', linkedinAccountId)
      .eq('status', 'active')
      .single()

    if (accErr || !account) {
      console.log(`[MsgSync] Account ${linkedinAccountId} not found or inactive`)
      return { synced: 0, errors: 0 }
    }

    // Build proxy config
    const linkedInAccount: LinkedInAccount = {
      id: account.id,
      email: account.email,
      password: account.password || '',
      cookies: account.cookies,
      session_cookies: account.session_cookies,
    }

    if (account.proxy_url) {
      const proxyUrl = new URL(account.proxy_url)
      linkedInAccount.proxy_config = {
        server: `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,
        username: account.proxy_username || proxyUrl.username || undefined,
        password: account.proxy_password || proxyUrl.password || undefined,
      }
    }

    // Step 1: Scrape conversations
    console.log(`[MsgSync] Starting sync for ${account.email}`)
    const conversations = await scrapeConversations(linkedInAccount)

    if (conversations.length === 0) {
      console.log(`[MsgSync] No conversations found for ${account.email}`)
      return { synced: 0, errors: 0 }
    }

    // Step 2: Save conversations to DB
    for (const conv of conversations) {
      try {
        // Upsert conversation
        const { data: dbConv, error: convErr } = await supabase
          .from('conversations')
          .upsert({
            linkedin_account_id: linkedinAccountId,
            thread_id: conv.threadId,
            participant_name: conv.participantName,
            participant_headline: conv.participantHeadline || null,
            participant_avatar_url: conv.participantAvatarUrl || null,
            participant_profile_url: conv.participantProfileUrl || null,
            last_message_at: conv.lastMessageAt,
            last_message_preview: conv.lastMessagePreview || null,
            unread_count: conv.unreadCount,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'linkedin_account_id,thread_id',
            ignoreDuplicates: false,
          })
          .select('id')
          .single()

        if (convErr) {
          console.error(`[MsgSync] Error upserting conversation ${conv.threadId}:`, convErr.message)
          errors++
          continue
        }

        // Step 3: Scrape messages for conversations with unread messages
        // (or all conversations on first sync)
        if (conv.unreadCount > 0 && dbConv?.id) {
          try {
            const messages = await scrapeThreadMessages(linkedInAccount, conv.threadId)

            if (messages.length > 0) {
              // Save messages to DB
              const messagesToInsert = messages.map(msg => ({
                conversation_id: dbConv.id,
                linkedin_account_id: linkedinAccountId,
                message_id: msg.messageId,
                sender_name: msg.senderName,
                is_from_me: msg.isFromMe,
                content: msg.content,
                sent_at: msg.sentAt || new Date().toISOString(),
                is_read: msg.isFromMe,
              }))

              const { error: msgErr } = await supabase
                .from('messages')
                .upsert(messagesToInsert, {
                  onConflict: 'linkedin_account_id,message_id',
                  ignoreDuplicates: true,
                })

              if (msgErr) {
                console.error(`[MsgSync] Error saving messages for thread ${conv.threadId}:`, msgErr.message)
                errors++
              }

              // Update conversation's last_message_at from actual messages
              const lastMsg = messages[messages.length - 1]
              if (lastMsg) {
                await supabase
                  .from('conversations')
                  .update({
                    last_message_at: lastMsg.sentAt || new Date().toISOString(),
                    last_message_preview: lastMsg.content?.substring(0, 200) || null,
                  })
                  .eq('id', dbConv.id)
              }
            }

            // Add human-like delay between thread scrapes
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000))
          } catch (threadErr: any) {
            console.error(`[MsgSync] Error scraping thread ${conv.threadId}:`, threadErr.message)
            errors++
          }
        }

        synced++
      } catch (e: any) {
        console.error(`[MsgSync] Error processing conversation:`, e.message)
        errors++
      }
    }

    console.log(`[MsgSync] ✅ Sync complete for ${account.email}: ${synced} conversations, ${errors} errors`)

  } catch (err: any) {
    console.error(`[MsgSync] Fatal error syncing account ${linkedinAccountId}:`, err.message)
    errors++
  }

  return { synced, errors }
}

// ─── Sync ALL active accounts ────────────────────────────────────────────────

export async function syncAllAccounts(userId?: string): Promise<void> {
  const supabase = getServiceSupabase()

  let query = supabase
    .from('linkedin_accounts')
    .select('id, email')
    .eq('status', 'active')

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: accounts, error } = await query

  if (error || !accounts || accounts.length === 0) {
    console.log('[MsgSync] No active accounts to sync')
    return
  }

  console.log(`[MsgSync] Starting sync for ${accounts.length} accounts`)

  for (const acc of accounts) {
    try {
      await syncAccountMessages(acc.id)
      // Pause between accounts to be respectful
      await new Promise(r => setTimeout(r, 5000 + Math.random() * 5000))
    } catch (err: any) {
      console.error(`[MsgSync] Error syncing account ${acc.email}:`, err.message)
    }
  }

  console.log('[MsgSync] All accounts synced')
}
