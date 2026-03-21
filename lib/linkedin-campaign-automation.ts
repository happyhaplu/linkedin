/**
 * LinkedIn Campaign Automation
 * 
 * Handles actual LinkedIn interactions using Playwright
 * - Connection requests with personalized notes
 * - Direct messages
 * - InMails
 * - Error handling and retry logic
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { DbClient } from '@/lib/db/query-builder';

import { sessionCookiesToPlaywright } from './linkedin-cookie-auth'

// Service-role client — safe to use in workers (no cookies() dependency)
function getServiceSupabase() {
  return new DbClient()
}

interface LinkedInAccount {
  id: string;
  email: string;
  password: string;
  cookies?: any[];
  session_cookies?: Record<string, string>;
  proxy_url?: string;
  proxy_config?: { server: string; username?: string; password?: string };
}

interface Lead {
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company?: string;
  position?: string;
}

interface AutomationResult {
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Auto-disconnect account if LinkedIn session is truly invalid.
 * Only disconnects for genuine auth/session errors — NOT for transient
 * network issues (proxy tunnel failures, DNS timeouts, etc.)
 */
async function handleAccountDisconnection(accountId: string, errorMessage: string): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    
    const errorLower = errorMessage.toLowerCase();

    // Transient / network errors — NEVER disconnect for these
    const isTransient =
      errorLower.includes('err_tunnel_connection_failed') ||
      errorLower.includes('err_connection_refused') ||
      errorLower.includes('err_connection_reset') ||
      errorLower.includes('err_connection_timed_out') ||
      errorLower.includes('err_name_not_resolved') ||
      errorLower.includes('err_network_changed') ||
      errorLower.includes('err_internet_disconnected') ||
      errorLower.includes('econnrefused') ||
      errorLower.includes('econnreset') ||
      errorLower.includes('etimedout') ||
      errorLower.includes('timeout') ||
      errorLower.includes('net::err_')
    
    if (isTransient) {
      console.log(`⚠️ [handleAccountDisconnection] Transient network error for ${accountId} — NOT disconnecting: ${errorMessage.split('\n')[0]}`);
      return;
    }

    const shouldDisconnect = 
      errorLower.includes('restricted') ||
      errorLower.includes('suspended') ||
      errorLower.includes('banned') ||
      errorLower.includes('logged out') ||
      errorLower.includes('session expired') ||
      errorLower.includes('unauthorized') ||
      errorLower.includes('login required') ||
      errorLower.includes('err_too_many_redirects');
    
    if (shouldDisconnect) {
      console.log(`🔴 Auto-disconnecting account ${accountId}: ${errorMessage}`);
      
      await supabase
        .from('linkedin_accounts')
        .update({
          status: 'disconnected',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId);
    }
  } catch (error) {
    console.error('Failed to auto-disconnect account:', error);
  }
}

/**
 * Normalize a LinkedIn profile URL to canonical https://www.linkedin.com/in/... form.
 * Handles: http → https, missing www, trailing slashes, query strings.
 */
function normalizeLinkedInUrl(url: string): string {
  if (!url) return url
  let u = url.trim()
  // Force https
  u = u.replace(/^http:\/\//i, 'https://')
  // Ensure www.linkedin.com (LinkedIn works with www, avoids extra redirects)
  u = u.replace(/^https:\/\/linkedin\.com\//i, 'https://www.linkedin.com/')
  // Remove query strings and trailing slashes for clean navigation
  u = u.split('?')[0].replace(/\/+$/, '')
  return u
}

/**
 * Create browser instance with authentication
 */
async function createAuthenticatedBrowser(account: LinkedInAccount): Promise<{ browser: Browser; context: BrowserContext }> {
  const baseArgs = [
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
  ]

  const browser = await chromium.launch({
    headless: true,
    args: baseArgs,
  });

  // Build context options — use Playwright's native proxy support (handles auth properly)
  const contextOptions: any = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  }
  if (account.proxy_config) {
    contextOptions.proxy = account.proxy_config
    console.log(`[Auth] Using proxy: ${account.proxy_config.server} (user: ${account.proxy_config.username || 'none'})`)
  }

  const context = await browser.newContext(contextOptions);

  // Remove navigator.webdriver flag to avoid bot detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    delete window.__playwright;
    // @ts-ignore
    delete window.__pwInitScripts;
  });

  // Load cookies if available — support both Playwright array and flat session_cookies object
  if (account.cookies && Array.isArray(account.cookies) && account.cookies.length > 0) {
    await context.addCookies(account.cookies);
  } else if (account.session_cookies && typeof account.session_cookies === 'object' && account.session_cookies.li_at) {
    const pwCookies = sessionCookiesToPlaywright(account.session_cookies);
    console.log(`[Auth] Converted ${Object.keys(account.session_cookies).length} session_cookies → ${pwCookies.length} Playwright cookies`);
    await context.addCookies(pwCookies);
  }

  // Validate session — navigate to feed with a small random delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
  const testPage = await context.newPage();
  try {
    await testPage.goto('https://www.linkedin.com/feed', {
      waitUntil: 'load',
      timeout: 30000,
    });
    const finalUrl = testPage.url();
    const sessionOk = finalUrl.includes('/feed') || finalUrl.includes('/in/');

    if (!sessionOk) {
      console.log('[Auth] Cookies invalid/expired, falling back to credential login...');
      if (!account.password) {
        await testPage.close();
        await browser.close();
        throw new Error('LinkedIn authentication failed — cookies expired and no password set for credential fallback');
      }
      await testPage.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testPage.fill('input[name="session_key"]', account.email);
      await testPage.fill('input[name="session_password"]', account.password);
      await testPage.click('button[type="submit"]');
      try {
        await testPage.waitForURL('**/feed**', { timeout: 30000 });
        console.log('[Auth] Credential login successful');
      } catch {
        const loginUrl = testPage.url();
        await testPage.close();
        await browser.close();
        throw new Error(`LinkedIn authentication failed — credential login redirected to: ${loginUrl} (wrong password or 2FA required)`);
      }
    } else {
      console.log('[Auth] Cookie session valid ✅');
    }
  } catch (err: any) {
    // ALWAYS re-throw — do NOT silently proceed with an unverified session.
    try { await testPage.close() } catch {}
    try { await browser.close() } catch {}
    
    const errMsg = err.message?.split('\n')[0] || err.message || 'Unknown error'
    
    // Distinguish transient network errors from actual auth failures.
    // Network errors (proxy down, DNS, tunnel failed) should be retried by BullMQ
    // without marking the account as disconnected.
    const isNetworkError =
      errMsg.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
      errMsg.includes('ERR_CONNECTION_REFUSED') ||
      errMsg.includes('ERR_CONNECTION_RESET') ||
      errMsg.includes('ERR_CONNECTION_TIMED_OUT') ||
      errMsg.includes('ERR_NAME_NOT_RESOLVED') ||
      errMsg.includes('ECONNREFUSED') ||
      errMsg.includes('ECONNRESET') ||
      errMsg.includes('ETIMEDOUT') ||
      errMsg.includes('net::ERR_')
    
    if (isNetworkError) {
      throw new Error(`Network error during session validation: ${errMsg}`)
    }

    // For auth-related errors, include the "session validation failed" prefix
    // so handleAccountDisconnection can identify them properly
    if (errMsg.includes('LinkedIn authentication failed')) {
      throw err  // Already has the right prefix
    }
    throw new Error(`LinkedIn session validation failed: ${errMsg}`);
  } finally {
    try { await testPage.close() } catch {}
  }

  return { browser, context };
}

/**
 * Login to LinkedIn using credentials
 */
async function loginWithCredentials(page: Page, email: string, password: string): Promise<boolean> {
  try {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Fill login form
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL('https://www.linkedin.com/feed/**', { timeout: 30000 });

    return true;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

/**
 * Check if already logged in
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const url = page.url();
    return url.includes('/feed') || url.includes('/in/');
  } catch {
    return false;
  }
}

/**
 * Send connection request with personalized note
 */
export async function sendConnectionRequest(
  account: LinkedInAccount,
  lead: Lead,
  message: string
): Promise<AutomationResult> {
  let browser: Browser | null = null;

  try {
    const { browser: br, context } = await createAuthenticatedBrowser(account);
    browser = br;
    const page = await context.newPage();

    // Navigate to profile
    const profileUrl = normalizeLinkedInUrl(lead.linkedin_url)
    console.log(`Navigating to profile: ${profileUrl}`)
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Wait for React to render the profile content (LinkedIn is a SPA —
    // domcontentloaded fires before React renders buttons).
    try {
      await page.waitForSelector('main', { timeout: 10000 });
    } catch { /* fall through — some layouts don't use <main> */ }
    await page.waitForTimeout(2500);

    // Check for 404 / invalid profile
    const currentUrl = page.url();
    if (currentUrl.includes('/404') || currentUrl.includes('linkedin.com/404')) {
      console.log(`[Connect] Profile not found (404): ${profileUrl}`);
      return { success: false, error: 'Profile not found' };
    }

    // Debug: log what buttons are visible
    console.log(`[Connect] Current URL: ${currentUrl}`);
    const visibleButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button'))
        .map(b => (b.getAttribute('aria-label') || b.textContent)?.trim())
        .filter(t => t && t.length < 60)
        .slice(0, 15);
    });
    console.log(`[Connect] Visible buttons (aria-label or text): ${JSON.stringify(visibleButtons)}`);

    // ── Determine connection status via degree badge (most reliable method) ──
    // LinkedIn shows "• 1st" badge for 1st-degree connections, "• 2nd"/"• 3rd+" for others.
    // Checking the "Message" button is NOT reliable — Open Profile / Premium accounts
    // show a "Message" button even when NOT connected (e.g. Andrew Hill, open profiles).
    const degreeText = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('span, div'))
      for (const el of els) {
        const t = el.textContent?.trim() || ''
        if (t === '• 1st' || t === '·\u00a01st' || t.includes('· 1st') || t.includes('• 1st')) return '1st'
        if (t === '• 2nd' || t.includes('· 2nd') || t.includes('• 2nd')) return '2nd'
        if (t.includes('3rd') || t.includes('3rd+')) return '3rd'
      }
      return null
    })
    console.log(`[Connect] Degree badge detected: ${degreeText}`)

    if (degreeText === '1st') {
      console.log(`[Connect] Already 1st-degree connected with ${lead.full_name}`)
      await browser.close();
      return { success: false, error: 'Already connected' };
    }

    // ── Check if invitation already pending ──────────────────────────────
    // Detect Pending/Withdraw buttons AND also check for "Accept"/"Reject"
    // buttons which mean THEY sent US a connection request (treat as pending).
    const isPending = await page.locator(
      'button[aria-label*="Withdraw"], button[aria-label*="Pending"], ' +
      'button:has-text("Withdraw"), button:has-text("Pending")'
    ).count() > 0;
    if (isPending) {
      console.log(`[Connect] Invitation already pending for ${lead.full_name} — skipping`);
      await browser.close();
      return { success: false, error: 'Invitation already sent' };
    }

    // If "Accept"/"Reject" buttons are visible, THEY sent us a request.
    // Accept it automatically (they want to connect!) and treat as done.
    const hasIncomingInvite = await page.locator(
      'button[aria-label*="Accept" i]:not([aria-label*="cookie" i]), ' +
      'button:text-is("Accept")'
    ).first().count() > 0;
    if (hasIncomingInvite) {
      console.log(`[Connect] Incoming invitation detected from ${lead.full_name} — accepting`);
      const acceptBtn = page.locator(
        'button[aria-label*="Accept" i]:not([aria-label*="cookie" i]), button:text-is("Accept")'
      ).first();
      try {
        await acceptBtn.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        console.log(`[Connect] ✅ Accepted incoming invitation from ${lead.full_name}`);
        await browser.close();
        return { success: true, details: { profile: lead.linkedin_url, accepted_incoming: true } };
      } catch {
        console.log(`[Connect] Failed to accept incoming invitation — proceeding to connect`);
      }
    }

    // ── Find Connect button ──────────────────────────────────────────────
    // IMPORTANT: Use aria-label^="Invite" (starts with) to match LinkedIn's
    // "Invite {name} to connect" pattern.  Do NOT use aria-label*="connect" (i)
    // because that matches "Accept invitation to connect" / "Reject" buttons.
    // Also try exact text match :text-is("Connect") (not substring has-text).
    const connectButton = page.locator(
      'button[aria-label^="Invite"], main button:text-is("Connect")'
    ).first();
    const connectExists = await connectButton.count() > 0;

    if (connectExists) {
      console.log(`[Connect] Found direct Connect button for ${lead.full_name}`);
      await connectButton.click();
    } else {
      // Try "More actions" dropdown — for 3rd-degree connections, Connect is
      // almost always hidden behind this overflow menu.
      const moreButton = page.locator(
        'button[aria-label="More actions"]'
      ).first();
      const moreExists = await moreButton.count() > 0;

      if (moreExists) {
        console.log(`[Connect] No direct Connect button — trying More dropdown for ${lead.full_name}`);
        await moreButton.click();
        await page.waitForTimeout(1500);

        // Debug: log what's in the dropdown
        const dropdownItems = await page.evaluate(() => {
          const items = document.querySelectorAll(
            'div[role="menu"] span, ul[role="menu"] span, ' +
            '.artdeco-dropdown__content span, .artdeco-dropdown__content-inner li'
          );
          return Array.from(items).map(el => el.textContent?.trim()).filter(t => t && t.length < 50).slice(0, 15);
        });
        console.log(`[Connect] More dropdown items: ${JSON.stringify(dropdownItems)}`);

        // Look for Connect inside the dropdown — try multiple selectors
        const connectInDropdown = page.locator(
          'div[role="menu"] span:text-is("Connect"), ' +
          'ul[role="menu"] span:text-is("Connect"), ' +
          '.artdeco-dropdown__content span:text-is("Connect"), ' +
          '.artdeco-dropdown__content-inner span:text-is("Connect"), ' +
          'div[role="listitem"] span:text-is("Connect")'
        ).first();

        if (await connectInDropdown.count() > 0) {
          console.log(`[Connect] Found Connect in More dropdown for ${lead.full_name}`);
          await connectInDropdown.click();
        } else {
          // Maybe "Connect" text is inside a li/div, not a span — try broader match
          const connectBroad = page.locator(
            'div[role="menu"] li:has-text("Connect"), ' +
            '.artdeco-dropdown__content li:has-text("Connect")'
          ).first();
          if (await connectBroad.count() > 0) {
            console.log(`[Connect] Found Connect (broad match) in More dropdown for ${lead.full_name}`);
            await connectBroad.click();
          } else {
            console.log(`[Connect] Connect not in More dropdown for ${lead.full_name}`);
            await page.screenshot({ path: `/tmp/connect-fail-${lead.full_name?.replace(/\s/g, '_')}.png` });
            await browser.close();
            return { success: false, error: 'Connect button not found' };
          }
        }
      } else {
        console.log(`[Connect] Neither Connect nor More button found for ${lead.full_name}`);
        await page.screenshot({ path: `/tmp/connect-fail-${lead.full_name?.replace(/\s/g, '_')}.png` });
        await browser.close();
        return { success: false, error: 'Connect button not found' };
      }
    }

    // ── Wait for connect modal / dialog to appear ────────────────────────
    console.log(`[Connect] Waiting for connection dialog...`);
    let dialogAppeared = false;
    try {
      await page.waitForSelector(
        'div[role="dialog"], .artdeco-modal, .send-invite, [data-test-modal]',
        { timeout: 5000 }
      );
      dialogAppeared = true;
    } catch {
      console.log(`[Connect] No dialog appeared — checking page state...`);
      await page.waitForTimeout(2000);
    }

    // Check if the page now shows "Pending" (invitation was sent without dialog, e.g. Premium)
    const nowPending = await page.locator(
      'button[aria-label*="Withdraw"], button[aria-label*="Pending"], ' +
      'button:has-text("Withdraw"), button:has-text("Pending")'
    ).count() > 0;
    if (nowPending) {
      console.log(`[Connect] ✅ Connection request sent to ${lead.full_name} (no dialog — direct send)`);
      await browser.close();
      return { success: true, details: { profile: lead.linkedin_url, withNote: false } };
    }

    if (!dialogAppeared) {
      // Take a screenshot to help diagnose what happened
      await page.screenshot({ path: `/tmp/connect-no-dialog-${lead.full_name?.replace(/\s/g, '_')}.png` });
      console.log(`[Connect] Screenshot saved to /tmp/connect-no-dialog-${lead.full_name?.replace(/\s/g, '_')}.png`);
      await browser.close();
      return { success: false, error: 'Connect button not found' };
    }

    // Debug: log modal contents
    const modalButtons = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"], .artdeco-modal');
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll('button'))
        .map(b => (b.getAttribute('aria-label') || b.textContent)?.trim())
        .filter(t => t && t.length < 80);
    });
    console.log(`[Connect] Modal buttons: ${JSON.stringify(modalButtons)}`);

    // ── Handle "How do you know..." dialog ──────────────────────────────
    const howDoYouKnow = page.locator(
      'div[role="dialog"] label:has-text("Other"), .artdeco-modal label:has-text("Other")'
    ).first();
    if (await howDoYouKnow.count() > 0) {
      console.log(`[Connect] "How do you know" dialog — selecting "Other"`);
      await howDoYouKnow.click();
      await page.waitForTimeout(500);
      const connectAfterHow = page.locator(
        'div[role="dialog"] button:has-text("Connect"), div[role="dialog"] button:has-text("Send")'
      ).first();
      if (await connectAfterHow.count() > 0) {
        await connectAfterHow.click();
        await page.waitForTimeout(2000);
        console.log(`[Connect] ✅ Connection request sent to ${lead.full_name} (How do you know)`);
        await browser.close();
        return { success: true, details: { profile: lead.linkedin_url, withNote: false } };
      }
    }

    // ── Handle "Add a note" flow ─────────────────────────────────────────
    const addNoteButton = page.locator(
      'div[role="dialog"] button:has-text("Add a note"), .artdeco-modal button:has-text("Add a note")'
    ).first();
    const addNoteExists = await addNoteButton.count() > 0;

    if (addNoteExists && message && message.trim().length > 0) {
      console.log(`[Connect] Adding personal note for ${lead.full_name}`);
      await addNoteButton.click();
      await page.waitForTimeout(800);

      const noteInput = page.locator(
        'div[role="dialog"] textarea[name="message"], ' +
        'div[role="dialog"] textarea, ' +
        '.artdeco-modal textarea, ' +
        '#custom-message'
      ).first();
      if (await noteInput.count() > 0) {
        await noteInput.fill(message.slice(0, 300));
        await page.waitForTimeout(500);
      } else {
        console.log(`[Connect] Note textarea not found — sending without note`);
      }
    }

    // ── Click Send / "Send without a note" / "Send invitation" ──────────
    const sendButton = page.locator(
      'div[role="dialog"] button:has-text("Send"), ' +
      '.artdeco-modal button:has-text("Send"), ' +
      'div[role="dialog"] button[aria-label*="Send"]'
    ).first();

    if (await sendButton.count() > 0) {
      console.log(`[Connect] Clicking Send button`);
      await sendButton.click();
    } else {
      // No Send in dialog — maybe there's a "Connect" button in the dialog instead
      const connectInDialog = page.locator(
        'div[role="dialog"] button:has-text("Connect"), .artdeco-modal button:has-text("Connect")'
      ).first();
      if (await connectInDialog.count() > 0) {
        console.log(`[Connect] Clicking Connect button in dialog`);
        await connectInDialog.click();
      } else {
        console.log(`[Connect] No Send/Connect button in dialog`);
        await page.screenshot({ path: `/tmp/connect-no-send-${lead.full_name?.replace(/\s/g, '_')}.png` });
        await browser.close();
        return { success: false, error: 'Connect button not found' };
      }
    }

    // Wait for success
    await page.waitForTimeout(2000);

    console.log(`[Connect] ✅ Connection request sent to ${lead.full_name}`);
    await browser.close();

    return {
      success: true,
      details: {
        profile: lead.linkedin_url,
        withNote: !!(addNoteExists && message),
      },
    };
  } catch (error: any) {
    if (browser) {
      await browser.close();
    }

    console.error('Connection request failed:', error.message?.split('\n')[0] || error);

    // Only mark account disconnected for genuine auth/session errors — NOT for
    // Playwright timeouts, element-not-found, or navigation errors.
    const msg: string = error.message || ''
    const isAuthError = msg.includes('restricted') || msg.includes('suspended') ||
      msg.includes('banned') || msg.includes('session expired') || msg.includes('login required') ||
      msg.includes('session validation failed') || msg.includes('ERR_TOO_MANY_REDIRECTS')
    
    if (isAuthError) {
      await handleAccountDisconnection(account.id, msg);
      return { success: false, error: msg };
    }

    // Re-throw non-auth errors so BullMQ can retry the job
    throw error
  }
}

/**
 * Send direct message to a connection
 */
export async function sendMessage(
  account: LinkedInAccount,
  lead: Lead,
  message: string
): Promise<AutomationResult> {
  let browser: Browser | null = null;

  try {
    const { browser: br, context } = await createAuthenticatedBrowser(account);
    browser = br;
    const page = await context.newPage();

    // Navigate to the person's profile and click Message from there.
    // This is far more reliable than the /messaging/ search flow which depends
    // on search results and fragile "New message" button selectors.
    const profileUrl = normalizeLinkedInUrl(lead.linkedin_url);
    console.log(`[Message] Navigating to profile: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await page.waitForSelector('main', { timeout: 10000 }); } catch {}
    await page.waitForTimeout(2500);

    // Log visible buttons (aria-label or text) for debugging
    const visibleBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .map(b => (b.getAttribute('aria-label') || b.textContent)?.trim())
        .filter(t => t && t.length < 60)
        .slice(0, 15)
    );
    console.log(`[Message] Buttons on profile (aria-label or text): ${JSON.stringify(visibleBtns)}`);

    // Look for Message button — use aria-label first (most reliable), then text match.
    // NOTE: .pv-top-card__card-action-bar no longer exists in LinkedIn's current DOM.
    const messageButton = page.locator(
      'button[aria-label*="Message"], button[aria-label*="message"], main button:has-text("Message")'
    ).first();
    const messageExists = await messageButton.count() > 0;

    if (!messageExists) {
      // Fallback: any visible Message button
      const anyMsgBtn = page.locator('button:has-text("Message")').first();
      if (await anyMsgBtn.count() === 0) {
        return { success: false, error: 'Not connected - cannot send message' };
      }
      await anyMsgBtn.click({ timeout: 10000 });
    } else {
      await messageButton.click({ timeout: 10000 });
    }
    await page.waitForTimeout(1500);

    // Type message into the contenteditable composer.
    // NOTE: .fill() does NOT trigger LinkedIn's React input events on contenteditable.
    // Must click the box first then use pressSequentially() or keyboard.type().
    const truncatedMessage = message.slice(0, 8000);
    const messageInput = page.locator('div[role="textbox"]').first();
    await messageInput.click({ timeout: 10000 });
    await page.waitForTimeout(300);
    // Clear any existing content and type
    await page.keyboard.press('Control+A');
    await page.keyboard.type(truncatedMessage, { delay: 20 });
    await page.waitForTimeout(800);

    // Send via Ctrl+Enter (most reliable on LinkedIn) or Send button
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(1500);

    // Confirm message was sent — if send button still visible, try clicking it
    const sendButton = page.locator(
      '.msg-form__send-button, button[aria-label*="Send"], button:has-text("Send")'
    ).first();
    if (await sendButton.count() > 0) {
      await sendButton.click({ timeout: 5000 }).catch(() => {/* already sent */});
      await page.waitForTimeout(1000);
    }

    await browser.close();

    return {
      success: true,
      details: {
        profile: lead.linkedin_url,
        messageLength: truncatedMessage.length,
      },
    };
  } catch (error: any) {
    if (browser) {
      await browser.close();
    }

    console.error('Message send failed:', error);

    // Mark account disconnected only for auth/session errors
    await handleAccountDisconnection(account.id, error.message || 'Message send failed');

    // Re-throw Playwright timeout/navigation errors so BullMQ can retry the job.
    const msg: string = error.message || ''
    const isAuthError = msg.includes('restricted') || msg.includes('suspended') ||
      msg.includes('banned') || msg.includes('session expired') || msg.includes('login required')
    if (!isAuthError) {
      throw error  // BullMQ will retry up to the configured attempts count
    }
    return { success: false, error: msg };
  }
}

/**
 * Send InMail (requires Premium)
 */
export async function sendInMail(
  account: LinkedInAccount,
  lead: Lead,
  subject: string,
  message: string
): Promise<AutomationResult> {
  let browser: Browser | null = null;

  try {
    const { browser: br, context } = await createAuthenticatedBrowser(account);
    browser = br;
    const page = await context.newPage();

    // Check if logged in
    await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loggedIn = await isLoggedIn(page);

    if (!loggedIn) {
      const loginSuccess = await loginWithCredentials(page, account.email, account.password);
      if (!loginSuccess) {
        throw new Error('Failed to login to LinkedIn');
      }
    }

    // Navigate to profile
    console.log(`Sending InMail to: ${lead.linkedin_url}`);
    await page.goto(normalizeLinkedInUrl(lead.linkedin_url), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for "Message" button (InMail for non-connections)
    const messageButton = page.locator('button:has-text("Message")').first();
    const messageExists = await messageButton.count() > 0;

    if (!messageExists) {
      // Try "More" dropdown
      const moreButton = page.locator('button:has-text("More")').first();
      const moreExists = await moreButton.count() > 0;

      if (moreExists) {
        await moreButton.click();
        await page.waitForTimeout(500);

        const messageInDropdown = page.locator('div[role="menu"] >> text=Message').first();
        const messageInDropdownExists = await messageInDropdown.count() > 0;

        if (messageInDropdownExists) {
          await messageInDropdown.click();
        } else {
          return {
            success: false,
            error: 'InMail not available (requires Premium)',
          };
        }
      } else {
        return {
          success: false,
          error: 'InMail button not found',
        };
      }
    } else {
      await messageButton.click();
    }

    await page.waitForTimeout(1500);

    // Check if InMail credits modal appears
    const inmailModal = page.locator('text=InMail').first();
    const hasInMailModal = await inmailModal.count() > 0;

    if (hasInMailModal) {
      // Fill subject
      const subjectInput = page.locator('input[name="subject"]').first();
      const subjectExists = await subjectInput.count() > 0;

      if (subjectExists) {
        await subjectInput.fill(subject.slice(0, 200));
        await page.waitForTimeout(500);
      }

      // Fill message (max 1900 characters for InMail)
      const messageInput = page.locator('textarea[name="message"]').first();
      const truncatedMessage = message.slice(0, 1900);
      await messageInput.fill(truncatedMessage);
      await page.waitForTimeout(500);

      // Click Send
      const sendButton = page.locator('button:has-text("Send")').first();
      await sendButton.click();

      await page.waitForTimeout(2000);

      await browser.close();

      return {
        success: true,
        details: {
          profile: lead.linkedin_url,
          subject: subject,
          messageLength: truncatedMessage.length,
        },
      };
    } else {
      // Regular message interface (already connected)
      const messageInput = page.locator('div[role="textbox"]').first();
      const inputExists = await messageInput.count() > 0;

      if (!inputExists) {
        return {
          success: false,
          error: 'Message interface not found',
        };
      }

      const truncatedMessage = message.slice(0, 8000);
      await messageInput.fill(truncatedMessage);
      await page.waitForTimeout(500);

      const sendButton = page.locator('button[type="submit"]:has-text("Send")').first();
      await sendButton.click();

      await page.waitForTimeout(2000);

      await browser.close();

      return {
        success: true,
        details: {
          profile: lead.linkedin_url,
          messageLength: truncatedMessage.length,
          type: 'regular_message',
        },
      };
    }
  } catch (error: any) {
    if (browser) {
      await browser.close();
    }

    console.error('InMail send failed:', error);
    await handleAccountDisconnection(account.id, error.message || 'InMail send failed');
    // Re-throw so BullMQ marks as failed and retries.
    // Only return {success:false} for known permanent failures — unknown errors
    // must propagate for proper retry logic.
    throw error;
  }
}

/**
 * Check connection status
 */
export async function checkConnectionStatus(
  account: LinkedInAccount,
  lead: Lead
): Promise<{ status: 'pending' | 'accepted' | 'not_connected' | 'error'; error?: string }> {
  let browser: Browser | null = null;

  try {
    const { browser: br, context } = await createAuthenticatedBrowser(account);
    browser = br;
    const page = await context.newPage();

    // Check if logged in
    await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loggedIn = await isLoggedIn(page);

    if (!loggedIn) {
      const loginSuccess = await loginWithCredentials(page, account.email, account.password);
      if (!loginSuccess) {
        throw new Error('Failed to login to LinkedIn');
      }
    }

    // Navigate to profile
    await page.goto(normalizeLinkedInUrl(lead.linkedin_url), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check for different button states
    const messageButton = await page.locator('button:has-text("Message")').count();
    const connectButton = await page.locator('button:has-text("Connect")').count();
    const pendingButton = await page.locator('button:has-text("Pending")').count();

    await browser.close();

    if (messageButton > 0) {
      return { status: 'accepted' };
    } else if (pendingButton > 0) {
      return { status: 'pending' };
    } else if (connectButton > 0) {
      return { status: 'not_connected' };
    } else {
      return { status: 'error', error: 'Unable to determine connection status' };
    }
  } catch (error: any) {
    if (browser) {
      await browser.close();
    }

    console.error('Connection status check failed:', error);
    
    // Auto-disconnect account if session invalid
    await handleAccountDisconnection(account.id, error.message || 'Connection status check failed');

    return {
      status: 'error',
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Scan inbox for new messages
 */
export async function scanInboxForReplies(
  account: LinkedInAccount,
  leadLinkedInUrls: string[]
): Promise<{ profileUrl: string; hasNewMessage: boolean; lastMessage?: string }[]> {
  let browser: Browser | null = null;

  try {
    const { browser: br, context } = await createAuthenticatedBrowser(account);
    browser = br;
    const page = await context.newPage();

    // Check if logged in
    await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loggedIn = await isLoggedIn(page);

    if (!loggedIn) {
      const loginSuccess = await loginWithCredentials(page, account.email, account.password);
      if (!loginSuccess) {
        throw new Error('Failed to login to LinkedIn');
      }
    }

    // Navigate to messaging
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const results = [];

    // Get all conversations
    const conversations = page.locator('ul.msg-conversations-container__conversations-list >> li');
    const count = await conversations.count();

    for (let i = 0; i < Math.min(count, 50); i++) {
      try {
        const conversation = conversations.nth(i);
        await conversation.click();
        await page.waitForTimeout(1000);

        // Get profile link from conversation
        const profileLink = await page.locator('a[href*="/in/"]').first().getAttribute('href');

        if (profileLink && leadLinkedInUrls.some(url => profileLink.includes(url))) {
          // Check for unread indicator
          const unreadBadge = await conversation.locator('.msg-conversation-card__unread-count').count();
          const hasNewMessage = unreadBadge > 0;

          // Get last message
          const lastMessageElement = page.locator('div.msg-s-event-listitem__body').last();
          const lastMessage = await lastMessageElement.textContent();

          results.push({
            profileUrl: profileLink,
            hasNewMessage,
            lastMessage: lastMessage?.trim() || undefined,
          });
        }
      } catch (error) {
        console.error('Error scanning conversation:', error);
      }
    }

    await browser.close();

    return results;
  } catch (error: any) {
    if (browser) {
      await browser.close();
    }

    console.error('Inbox scanning failed:', error);
    
    // Auto-disconnect account if session invalid
    await handleAccountDisconnection(account.id, error.message || 'Inbox scan failed');
    
    return [];
  }
}
