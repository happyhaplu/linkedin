# 🏆 Reach vs HeyReach — Full Competitive Analysis & LinkedIn Ban Safety Audit

> **Generated**: 16 March 2026  
> **Scope**: Feature comparison with HeyReach, Expandi, Dripify + LinkedIn ban safety readiness audit of Reach codebase

---

## 1. Competitor Landscape Overview

| Tool | Pricing | USP | Type |
|---|---|---|---|
| **HeyReach** | $79/sender/mo (Growth), $999/50 senders (Agency), $1999/unlimited | Unlimited senders, sender rotation, unified inbox, 20+ integrations | Cloud SaaS |
| **Expandi** | $99/seat/mo | Auto warm-up, smart limit algorithms, dedicated IPs, Mobile Connector bypass | Cloud SaaS |
| **Dripify** | $39–$79/user/mo | 15+ actions, drag-and-drop sequences, email finder, built-in LinkedIn protection | Cloud SaaS |
| **Skylead** | $100/seat/mo | Smart sequences with conditional branches, multichannel (LinkedIn+email) | Cloud SaaS |
| **Linked Helper** | $15–$45/mo | Chrome extension, lowest price, simple use-case | Desktop extension |
| **Zopto** | $197+/mo | AI-powered targeting, enterprise-grade | Cloud SaaS |
| **Our Reach** | Self-hosted (free) | Full control, no per-seat cost, open codebase | Self-hosted |

---

## 2. Feature-by-Feature Comparison Matrix

### 2.1 Core LinkedIn Actions

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| Connection requests | ✅ | ✅ | ✅ | ✅ | **Done** |
| Direct messages | ✅ | ✅ | ✅ | ✅ | **Done** |
| InMails | ✅ | ✅ | ✅ | ✅ | **Done** |
| Profile views | ✅ | ✅ | ✅ | ⚠️ No-op stub | **Stub only** |
| Follow | ✅ | ✅ | ✅ | ⚠️ No-op stub | **Stub only** |
| Like posts | ✅ | ✅ | ✅ | ⚠️ No-op stub | **Stub only** |
| Endorse skills | ✅ | ✅ | ❌ | ❌ | **Missing** |
| Comment on posts | ❌ | ✅ | ❌ | ❌ | **Missing** |
| Voice notes | ✅ | ❌ | ❌ | ❌ | **Missing** |
| Auto-accept incoming invites | ❌ | ❌ | ❌ | ✅ | **Our advantage** |

> ⚠️ **Critical Gap**: `view_profile`, `follow`, and `like_post` step types in `lib/campaign-executor.ts` (lines 834–848) return `{ success: true }` without actually performing the LinkedIn action. These are **fake completions**.

### 2.2 Campaign & Sequence Engine

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| Multi-step sequences | ✅ | ✅ | ✅ | ✅ | **Done** |
| If/Then conditions (accepted/not accepted) | ✅ | ✅ | ✅ | ✅ | **Done** |
| A/B message testing | ✅ | ✅ | ✅ | ✅ | **Done** |
| Drag-and-drop visual builder | ✅ | ✅ | ✅ | ✅ | **Done** |
| Campaign prioritization | ✅ | ✅ | ❌ | ❌ | **Missing** |
| Skip already-contacted leads | ✅ | ✅ | ✅ | ✅ | **Done** |
| Auto-pause on low acceptance rate | ❌ | ❌ | ❌ | ✅ Circuit breaker | **Our advantage** |
| Delay + jitter between steps | ✅ | ✅ | ✅ | ✅ (45–120s random) | **Done** |
| Working hours scheduling | ✅ | ✅ | ✅ | ✅ (timezone-aware) | **Done** |
| Working days selection | ✅ | ✅ | ✅ | ✅ Mon–Fri default | **Done** |

### 2.3 Sender & Account Management

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| Multiple LinkedIn accounts | ✅ Unlimited | ✅ Per-seat | ✅ Per-seat | ✅ Unlimited | **Done** |
| Auto sender rotation | ✅ Core feature | ❌ | ❌ | ⚠️ Round-robin only | **Basic** |
| Cookie-based auth (li_at) | ✅ | ✅ | ✅ | ✅ | **Done** |
| Credential login fallback | ❌ | ✅ | ✅ | ✅ | **Done** |
| 2FA handling | ✅ | ✅ | ✅ | ⚠️ Session stored, user completes | **Partial** |
| Account health monitoring | ✅ | ✅ | ✅ | ⚠️ Placeholder only | **Stub** |
| Auto-disconnect on ban | ✅ | ✅ | ✅ | ✅ | **Done** |
| Re-sync profile data | ✅ | ✅ | ✅ | ✅ | **Done** |

> ⚠️ **Critical Gap**: `checkAccountHealth()` in `lib/utils/linkedin-auth.ts` (lines 81–100) is a **placeholder** that just checks if `session_cookies` exists — it does NOT actually validate the session against LinkedIn. The real auth validation in `lib/linkedin-campaign-automation.ts` works but is only triggered during campaign execution, NOT as a scheduled health check.

### 2.4 LinkedIn Account Safety & Anti-Ban

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| **Daily action limits** | ✅ Smart | ✅ Smart algorithms | ✅ Built-in | ✅ Hardcoded | **Basic** |
| **Weekly connection limit** (~100/week) | ✅ | ✅ | ✅ | ✅ 100/week enforced | **Done** |
| **Warm-up / ramp-up** | ✅ Gradual | ✅ Auto warm-up | ✅ | ✅ Linear ramp (5→limit over N days) | **Done** |
| **Dedicated residential proxy per account** | ✅ Included (Starter) | ✅ Dedicated IP | ❌ | ❌ BYOP only | **Missing** |
| **Proxy support (BYOP)** | ✅ | ✅ | ❌ | ✅ SOCKS/HTTP | **Done** |
| **Human-like typing delays** | ✅ | ✅ | ✅ | ✅ (50–150ms per char) | **Done** |
| **Random delays between actions** | ✅ | ✅ | ✅ | ✅ (45–120s jitter) | **Done** |
| **Stealth browser fingerprint** | ✅ | ✅ | ✅ | ✅ Playwright + webdriver removal | **Done** |
| **User-configurable daily limits per account** | ✅ | ✅ Per-action sliders | ✅ | ❌ Hardcoded in code | **Missing** |
| **Per-action-type limits** | ✅ | ✅ | ✅ | ✅ (50 conn/100 msg/25 inmail/day) | **Done** |
| **LinkedIn restriction/ban detection** | ✅ | ✅ | ✅ | ✅ keyword-based (restricted/suspended/banned) | **Done** |
| **Auto-pause campaign on ban** | ✅ | ✅ | ✅ | ✅ `pauseCampaign()` on disconnect | **Done** |
| **Transient error vs auth error distinction** | ✅ | ✅ | ? | ✅ Excellent implementation | **Done** |
| **Session refresh / keep-alive** | ✅ | ✅ | ✅ | ⚠️ Infinite login exists but non-headless | **Partial** |
| **Smart limit ranges (adaptive)** | ✅ | ✅ Big data analysis | ✅ | ❌ Fixed limits | **Missing** |
| **Account cool-down periods** | ✅ | ✅ | ✅ | ❌ | **Missing** |
| **SSI score monitoring** | ❌ | ✅ | ❌ | ❌ | **Missing** |

### 2.5 Inbox & Messaging

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| Unified Inbox | ✅ Full | ✅ | ✅ Dedicated inbox | ✅ | **Done** |
| Reply detection (auto-stop sequence) | ✅ | ✅ | ✅ | ✅ condition_type=replied | **Done** |
| Voice notes from desktop | ✅ | ❌ | ❌ | ❌ | **Missing** |
| Conversation tags | ✅ | ✅ | ✅ | ❌ | **Missing** |
| Reply on behalf of teammates | ✅ | ❌ | ❌ | ❌ | **Missing** |

### 2.6 Lead Management

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| Import from CSV | ✅ | ✅ | ✅ | ✅ | **Done** |
| Import from Sales Navigator | ✅ | ✅ | ✅ | ❌ | **Missing** |
| Lead lists | ✅ | ✅ | ✅ | ✅ | **Done** |
| Lead deduplication | ✅ | ✅ | ✅ | ✅ (via skip check) | **Done** |
| Custom fields | ✅ | ✅ | ✅ | ✅ | **Done** |
| Lead tags | ✅ | ✅ | ✅ | ❌ | **Missing** |
| Email finder / enrichment | ✅ 100 credits/sender | ✅ | ✅ | ❌ | **Missing** |
| Blacklist/blocklist | ❌ | ✅ | ✅ | ❌ | **Missing** |
| Lead scoring | ❌ | ❌ | ❌ | ❌ | Neither has it |

### 2.7 Integrations & API

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| REST API | ✅ Full Postman docs | ✅ | ✅ | ⚠️ Internal API routes only | **No public API** |
| Webhooks (outbound) | ✅ | ✅ | ✅ | ✅ HMAC-signed, 3x retry | **Done, well-built** |
| Zapier / Make / n8n | ✅ Native | ✅ | ✅ | ❌ | **Missing** |
| HubSpot | ✅ Native | ✅ | ✅ | ❌ | **Missing** |
| Salesforce | ❌ | ✅ | ✅ | ❌ | **Missing** |
| Clay integration | ✅ Native | ❌ | ❌ | ❌ | **Missing** |
| Instantly / Smartlead | ✅ Native multichannel | ❌ | ❌ | ❌ | **Missing** |
| Slack notifications | ✅ | ❌ | ✅ | ❌ | **Missing** |
| MCP Server | ✅ | ❌ | ❌ | ❌ | **Missing** |

### 2.8 Analytics & Reporting

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| Campaign stats (sent/accepted/replied) | ✅ | ✅ | ✅ | ✅ | **Done** |
| Sender performance analytics | ✅ | ✅ | ✅ | ✅ (per-sender stats) | **Done** |
| A/B test results | ✅ | ✅ | ✅ | ⚠️ Variant assigned but no reporting UI | **Backend only** |
| Team analytics | ✅ | ✅ | ✅ | ❌ | **Missing** |
| CSV export | ✅ | ✅ | ✅ | ✅ (campaign export route) | **Done** |
| Step-by-step funnel analytics | ✅ | ✅ | ✅ | ❌ | **Missing** |

### 2.9 Agency & Enterprise Features

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| Whitelabel | ✅ Full | ✅ | ❌ | ❌ | **Missing** |
| Workspaces | ✅ | ✅ | ✅ | ❌ (single-tenant) | **Missing** |
| Roles & permissions | ✅ | ✅ | ✅ | ❌ | **Missing** |
| Multi-tenant client management | ✅ | ✅ | ❌ | ❌ | **Missing** |

### 2.10 AI Features

| Feature | HeyReach | Expandi | Dripify | **Our Reach** | Status |
|---|---|---|---|---|---|
| AI icebreaker generation | ❌ | ❌ | ✅ AI-powered icebreaker | ✅ GPT-4o-mini | **Done** |
| AI message rewriting | ❌ | ❌ | ❌ | ❌ | **Neither** |
| Image/GIF personalization | ❌ | ✅ Paid add-on | ❌ | ❌ | **Missing** |

---

## 3. 🛡️ LinkedIn Ban Safety — Is Reach Ready?

### 3.1 What Reach DOES Have (Working Safety Features)

| Safety Layer | Implementation | Quality |
|---|---|---|
| **Daily action limits** | 50 conn / 100 msg / 25 InMail / 150 total per day | ✅ Solid |
| **Weekly connection limit** | 100/week rolling window via `account_daily_counters` | ✅ Solid |
| **Warm-up ramp** | Linear from 5 → full limit over configurable N days (default 14) | ✅ Solid |
| **Random jitter** | 45–120 seconds between actions (configurable per campaign) | ✅ Solid |
| **Working hours** | Timezone-aware, configurable days + hours | ✅ Solid |
| **Human-like typing** | 50–150ms per character on inputs | ✅ Solid |
| **Stealth browser** | Playwright with `webdriver` removal, custom user-agent, realistic viewport | ✅ Good |
| **Transient vs auth error handling** | Distinguishes proxy/network errors from bans — doesn't disconnect on transient failures | ✅ Excellent |
| **Auto-disconnect on ban** | Detects "restricted", "suspended", "banned", "session expired" keywords | ✅ Good |
| **Auto-pause campaign on disconnect** | `pauseCampaign()` called when sender is disconnected | ✅ Good |
| **Circuit breaker** | Auto-pauses campaign if acceptance rate drops below threshold (default 15%) | ✅ Unique advantage |
| **Proxy support** | Full SOCKS5 / HTTP proxy with Playwright native proxy auth | ✅ Good |
| **Permanent vs retryable failure classification** | "Profile not found", "Not connected" = permanent; auth errors = retryable by BullMQ | ✅ Excellent |

### 3.2 What Reach is MISSING (Critical for Anti-Ban)

| Missing Safety Feature | Competitor Has It | Risk Level | Impact |
|---|---|---|---|
| **User-configurable daily limits** | Expandi, HeyReach, Dripify | 🔴 HIGH | Users can't tune limits to their account age/SSI/warmth |
| **Dedicated residential proxy (built-in)** | HeyReach (Starter), Expandi | 🔴 HIGH | Datacenter IPs = instant ban risk |
| **Smart/adaptive limits** (based on account age, SSI, activity) | Expandi ("big data analysis") | 🟠 HIGH | Fixed limits don't account for new vs established accounts |
| **Account cool-down periods** | HeyReach, Expandi, Dripify | 🟠 HIGH | No grace period after errors/restrictions |
| **Real account health check** (scheduled, not just on-demand) | All competitors | 🟠 HIGH | Only checks during campaign execution, not proactively |
| **Profile view before connection request** (forced pre-step) | Expandi, Dripify | 🟡 MEDIUM | Visiting profile first mimics human behavior |
| **Variable action pacing** (randomize order of leads, not just delay) | HeyReach, Expandi | 🟡 MEDIUM | Sequential lead processing is detectable |
| **Browser fingerprint randomization** (viewport, fonts, WebGL) | Expandi, HeyReach | 🟡 MEDIUM | Same fingerprint across all sessions |
| **SSI score monitoring** | Expandi | 🟡 LOW | Can't adjust behavior based on SSI trends |
| **Daily limit reached → gradual backoff** (not instant re-queue for tomorrow) | HeyReach | 🟡 LOW | Abrupt stop at limit looks robotic |

### 3.3 Safety Verdict

> **Reach is ~70% ready for safe production use.**
>
> The core safety rails are solid (limits, warmup, jitter, working hours, circuit breaker), but it's missing the **user-facing configurability** and **proactive health monitoring** that HeyReach/Expandi have.

**Biggest ban risks right now:**

1. **No built-in proxy provisioning** — users must bring their own or risk datacenter IPs
2. **Hardcoded limits can't be tuned** — a brand new LinkedIn account needs much lower limits than a 5-year old one
3. **No cool-down after errors** — if LinkedIn throws a soft warning, Reach just retries next day instead of backing off
4. **Stub actions** — `view_profile`, `follow`, `like_post` complete without doing anything, which means the warming engagement steps that make sequences look human **don't actually work**

---

## 4. 🎯 What to Build to Beat HeyReach — Prioritized Roadmap

### 🔴 Phase 1: Critical Gaps (Weeks 1–3)

| # | Feature | Why It Matters | Effort |
|---|---|---|---|
| 1 | **Implement real `view_profile` action** | LinkedIn tracks profile views — this is the #1 signal of organic interest before connecting. Currently a stub. | 3 days |
| 2 | **Implement real `follow` action** | Soft engagement before connecting reduces ban risk. Currently a stub. | 2 days |
| 3 | **Implement real `like_post` action** | Engagement signal. Currently a stub. | 3 days |
| 4 | **User-configurable daily limits per account** | Add UI fields + DB columns for custom limits per LinkedIn account. Override `fullDailyLimit()` with user settings. | 3 days |
| 5 | **Scheduled account health check (cron)** | Replace placeholder `checkAccountHealth()` with real Playwright-based session validation running every 4–6 hours via cron route. | 4 days |
| 6 | **Account cool-down system** | After transient errors or LinkedIn warnings, auto-reduce limits by 50% for 24–48h. Track `consecutive_errors` + `cooldown_until` on `linkedin_accounts`. | 3 days |
| 7 | **Built-in residential proxy provisioning** (or partner integration) | Integrate with a proxy provider (IPRoyal, Bright Data, Smartproxy) API to auto-assign proxies. HeyReach includes this. | 5 days |

### 🟠 Phase 2: Competitive Parity (Weeks 4–6)

| # | Feature | Why It Matters | Effort |
|---|---|---|---|
| 8 | **Sales Navigator lead import** | #1 requested feature in LinkedIn automation. Scrape/import from Sales Nav search. | 5 days |
| 9 | **Lead tags system** | Tag leads as "hot", "cold", "replied", custom. Essential for pipeline management. | 3 days |
| 10 | **Blacklist/blocklist** | Prevent contacting competitors, existing clients, specific domains. Table + check before every action. | 2 days |
| 11 | **Conversation tags in Unibox** | Label inbox conversations. HeyReach and Dripify have this. | 2 days |
| 12 | **Step-by-step funnel analytics** | Show conversion at each step (sent → viewed → accepted → replied). Visual funnel chart. | 4 days |
| 13 | **A/B test reporting UI** | We already assign variants and use variant templates — just need the analytics dashboard to show which variant wins. | 3 days |
| 14 | **Public REST API** | Let users integrate programmatically. Start with campaigns, leads, accounts CRUD. Add API key auth. | 5 days |

### 🟡 Phase 3: Beat HeyReach (Weeks 7–10)

| # | Feature | Why It Matters | Effort |
|---|---|---|---|
| 15 | **Multichannel: Email step integration** | Schema already supports `email` step type. Wire up SMTP/Resend for actual email sending in sequences. | 5 days |
| 16 | **Email finder / enrichment** | Partner with Prospeo/Hunter/Apollo API to find verified emails from LinkedIn profiles. HeyReach offers 100 credits/sender. | 4 days |
| 17 | **Zapier/Make/n8n native integration** | Webhook + trigger system. Our outbound webhooks are already solid — add inbound webhook triggers to create leads/start campaigns. | 5 days |
| 18 | **HubSpot CRM sync** | 2-way sync: leads ↔ contacts, campaign activity → CRM timeline. | 5 days |
| 19 | **Slack notifications** | Post to Slack channel on reply, connection accepted, campaign milestones. | 2 days |
| 20 | **Smart adaptive limits** | Track account age, weekly success rate, error frequency. Auto-adjust limits. Expandi's core differentiator. | 5 days |
| 21 | **Browser fingerprint randomization** | Randomize viewport, user-agent, WebGL hash, timezone per account. Use `playwright-extra` with fingerprint plugin. | 4 days |

### 🔵 Phase 4: Enterprise & Agency (Weeks 11–14)

| # | Feature | Why It Matters | Effort |
|---|---|---|---|
| 22 | **Workspaces / multi-tenant** | Separate client data for agencies. HeyReach's core agency feature. | 2 weeks |
| 23 | **Roles & permissions** | Admin, manager, VA — different access levels. | 1 week |
| 24 | **Whitelabel** | Custom domain, logo, colors. HeyReach Agency plan key feature. | 1 week |
| 25 | **Campaign prioritization** | When running multiple campaigns, set priority order. | 3 days |

---

## 5. Our Competitive Advantages (What Reach Already Does Better)

| Advantage | Details |
|---|---|
| **🆓 Self-hosted / No per-seat cost** | HeyReach = $79/sender/mo. 10 senders = $790/mo. Our Reach = $0 software cost. |
| **🤖 AI icebreakers (GPT-4o-mini)** | HeyReach doesn't have AI message generation. We do. |
| **📊 Circuit breaker auto-pause** | No competitor auto-pauses campaigns on low acceptance rates. We do (15% threshold). |
| **🔄 Auto-accept incoming invitations** | Our Playwright automation detects and accepts incoming connection requests during outreach. Unique. |
| **🔒 Excellent error classification** | Our transient vs permanent error handling in campaign automation is enterprise-grade. Better than most competitors. |
| **🌐 Full data ownership** | All data in our PostgreSQL. No vendor lock-in. No data sharing with third parties. |
| **⚡ BullMQ queue architecture** | Robust job queue with proper retry, dead-letter, stale-job cleanup. Most competitors use simpler scheduling. |
| **🔗 HMAC-signed webhooks** | Our webhook implementation with SHA-256 signatures + 3x retry is production-quality. HeyReach doesn't sign webhooks. |

---

## 6. Final Summary — The Gap Analysis

```
Our Reach today:       ████████████████████░░░░░░░░░░  65% of HeyReach feature parity

After Phase 1 (3 wk):  █████████████████████████░░░░░  80% — Safe for production

After Phase 2 (6 wk):  ███████████████████████████░░░  90% — Competitive with HeyReach

After Phase 3 (10 wk): ████████████████████████████░░  95% — BETTER than HeyReach (self-hosted + AI + more)

After Phase 4 (14 wk): ██████████████████████████████  100% — Enterprise/agency-ready
```

---

## 7. Key Code Locations for Safety-Critical Changes

| Area | File | What to Fix |
|---|---|---|
| Stub actions (view_profile/follow/like_post) | `lib/campaign-executor.ts` lines 834–848 | Implement real Playwright automation |
| Hardcoded daily limits | `lib/campaign-executor.ts` `fullDailyLimit()` line 37 | Read from `linkedin_accounts` table per-account settings |
| Placeholder health check | `lib/utils/linkedin-auth.ts` `checkAccountHealth()` line 81 | Replace with real Playwright session validation |
| Fake encryption (base64) | `lib/utils/encryption.ts` | Replace with AES-256-GCM |
| Warm-up ramp calculation | `lib/campaign-executor.ts` `checkDailyLimit()` line 957 | Add account-age-based adaptive logic |
| Browser fingerprint | `lib/linkedin-campaign-automation.ts` `createAuthenticatedBrowser()` line 126 | Randomize viewport, user-agent, WebGL per account |
| Cool-down system | `lib/campaign-executor.ts` + `linkedin_accounts` table | Add `cooldown_until` + `consecutive_errors` columns |

---

## 8. Bottom Line

**Our core automation engine is solid.** The campaign executor, queue architecture, error handling, and webhook system are enterprise-grade — in some ways better than HeyReach.

**The biggest gaps are:**
1. **Stub actions** that fake completions (view_profile / follow / like_post)
2. **No user-configurable safety limits** (hardcoded = one-size-fits-all)
3. **No proactive health monitoring** (placeholder code)
4. **No integrations ecosystem** (no CRM, no Zapier, no email channel)
5. **No agency features** (workspaces, whitelabel, roles)

**Fix Phase 1 items first** — they're the difference between "gets accounts banned" and "production-safe tool."
