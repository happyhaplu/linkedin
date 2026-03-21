# 📋 Reach — Module Status Tracker

> **Generated**: 16 March 2026  
> **Purpose**: Every module in the project — what's done, what's partial, what's missing to beat competition

---

## Status Legend

| Icon | Meaning |
|---|---|
| ✅ | **Complete** — Production-ready, on par with or better than competitors |
| ⚠️ | **Partial** — Exists but incomplete, stub, or needs major improvement |
| ❌ | **Missing** — Does not exist yet, needed to match/beat competition |
| 🗑️ | **Remove** — Dead code, debug/test artifacts that should be deleted |

---

## 1. 🔐 Authentication & User Management

| Module | Files | Status | Notes |
|---|---|---|---|
| User signup | `app/signup/`, `app/api/auth/signup/` | ✅ | Working |
| User login | `app/login/`, `app/api/auth/login/` | ✅ | Custom JWT + HTTP-only cookie |
| User signout | `app/api/auth/signout/` | ✅ | Working |
| Forgot password | `app/forgot-password/`, `app/api/auth/forgot-password/` | ✅ | Working |
| Reset password | `app/reset-password/`, `app/api/auth/update/` | ✅ | Working |
| Auth me (session check) | `app/api/auth/me/` | ✅ | Working |
| External accounts SSO | `app/api/auth/accounts/callback/`, `lib/accounts.ts` | ✅ | External service integration |
| JWT auth system | `lib/db/jwt.ts`, `lib/db/auth.ts` | ✅ | HMAC-SHA256 |
| Auth middleware | `lib/db/middleware.ts`, `middleware.ts` | ✅ | Route protection |
| User profile page | `app/profile/` | ✅ | Working |
| Roles & permissions | — | ❌ | **NEEDED**: Admin / Manager / VA role system |
| Team management | — | ❌ | **NEEDED**: Invite team members, manage access |
| API key authentication | — | ❌ | **NEEDED**: For public REST API |

---

## 2. 📊 Dashboard

| Module | Files | Status | Notes |
|---|---|---|---|
| Main dashboard | `app/dashboard/` | ✅ | Overview page |
| Campaign summary widgets | `app/dashboard/` | ⚠️ | Basic — needs more KPIs |
| Account health overview | — | ❌ | **NEEDED**: At-a-glance health of all LinkedIn accounts |
| Activity feed / timeline | — | ❌ | **NEEDED**: Real-time log of actions performed |

---

## 3. 🔗 LinkedIn Account Management

| Module | Files | Status | Notes |
|---|---|---|---|
| Account list page | `app/linkedin-account/` | ✅ | Working |
| Cookie-based auth (li_at) | `lib/linkedin-cookie-auth.ts` | ✅ | Full Playwright implementation |
| Credential login fallback | `lib/linkedin-campaign-automation.ts` | ✅ | Auto-fallback when cookies expire |
| Connect account modal | `components/ConnectAccountModal.tsx` | ✅ | Working |
| 2FA / OTP handling | `components/OTPVerificationModal.tsx`, `components/PinVerificationModal.tsx` | ⚠️ | Session stored, user completes manually |
| Proxy assignment per account | `components/AssignProxyModal.tsx`, `app/actions/proxies.ts` | ✅ | SOCKS/HTTP support |
| Account re-sync (profile data) | `app/actions/resync-profile.ts` | ✅ | Re-extracts profile from LinkedIn |
| Auto-disconnect on ban | `lib/linkedin-campaign-automation.ts` `handleAccountDisconnection()` | ✅ | Detects restricted/suspended/banned |
| Transient vs auth error distinction | `lib/linkedin-campaign-automation.ts` | ✅ | Excellent — won't disconnect on network errors |
| Infinite login session | `lib/linkedin-session-manager.ts`, `components/InfiniteLoginModal.tsx` | ⚠️ | Exists but uses non-headless browser |
| Account health monitoring | `app/actions/account-health.ts`, `lib/utils/linkedin-auth.ts` | ⚠️ | **PLACEHOLDER** — doesn't actually validate against LinkedIn |
| Scheduled health check (cron) | — | ❌ | **NEEDED**: Cron job every 4–6h to validate all sessions |
| User-configurable daily limits per account | `components/ConfigureLimitsModal.tsx` | ⚠️ | UI exists but limits are hardcoded in `campaign-executor.ts` |
| Account cool-down system | — | ❌ | **NEEDED**: Auto-reduce limits after errors/warnings |
| Built-in residential proxy provisioning | — | ❌ | **NEEDED**: Integrate proxy provider API (IPRoyal/BrightData) |
| SSI score monitoring | — | ❌ | **NEEDED**: Track LinkedIn SSI score trends |
| Smart/adaptive limits | — | ❌ | **NEEDED**: Adjust limits based on account age/activity/SSI |

---

## 4. 📢 Campaign Module

| Module | Files | Status | Notes |
|---|---|---|---|
| Campaign list page | `app/campaigns/` | ✅ | Working |
| Create new campaign | `app/campaigns/new/` | ✅ | Working |
| Campaign detail page | `app/campaigns/[id]/` | ✅ | Working |
| Campaign CRUD actions | `app/actions/campaigns.ts` (1,509 LOC) | ✅ | Full create/read/update/delete |
| Campaign start/pause/resume/stop | `lib/campaign-executor.ts`, API routes | ✅ | Working with stale-job cleanup |
| Visual sequence builder | `components/VisualSequenceBuilder.tsx` | ✅ | Drag-and-drop steps |
| Step editor modal | `components/StepEditorModal.tsx` | ✅ | All step types configurable |
| Template editor | `components/TemplateEditor.tsx` | ✅ | Variable substitution preview |
| Template engine | `lib/template-engine.ts` | ✅ | Personalization variables + fallbacks |
| Multi-step sequences | `campaign_sequences` table | ✅ | Ordered steps with delays |
| If/Then conditions | `campaign-executor.ts` `queueNextStep()` | ✅ | accepted / not_accepted / replied / not_replied |
| A/B message testing | `campaign-executor.ts` `assignVariant()` | ✅ | Alternating A/B assignment |
| Working hours scheduling | `campaign-executor.ts` `calculateDelay()` | ✅ | Timezone-aware, configurable |
| Working days selection | `campaign-executor.ts` | ✅ | Mon–Fri default, configurable |
| Random jitter delays | `campaign-executor.ts` | ✅ | 45–120 seconds (configurable) |
| Warm-up / ramp-up | `campaign-executor.ts` `checkDailyLimit()` | ✅ | Linear 5→limit over N days |
| Daily action limits | `campaign-executor.ts` `fullDailyLimit()` | ✅ | 50 conn / 100 msg / 25 InMail |
| Weekly connection limit | `campaign-executor.ts` `checkDailyLimit()` | ✅ | 100/week rolling window |
| Circuit breaker (auto-pause on low acceptance) | `campaign-executor.ts` `checkAcceptanceRateCircuitBreaker()` | ✅ | Unique — competitors don't have this |
| AI icebreaker generation | `campaign-executor.ts` `generateAIIcebreakers()` | ✅ | GPT-4o-mini |
| Skip already-contacted leads | `campaign-executor.ts` `skipAlreadyContactedCheck()` | ✅ | Cross-campaign dedup |
| Sender round-robin distribution | `campaign-executor.ts` | ✅ | Round-robin across active senders |
| Campaign export (CSV) | `app/api/campaigns/[id]/export/` | ✅ | Working |
| Campaign stats API | `app/api/campaigns/[id]/stats/` | ✅ | Working |
| Auto-pause cron | `app/api/cron/auto-pause/` | ✅ | Working |
| Campaign prioritization | — | ❌ | **NEEDED**: Priority ordering when running multiple campaigns |
| Smart sender rotation (weighted) | — | ❌ | **NEEDED**: Rotate based on limits remaining, not just round-robin |
| Campaign cloning/duplication | — | ❌ | **NEEDED**: Clone existing campaign as template |
| Campaign templates library | — | ❌ | **NEEDED**: Pre-built sequence templates for common use cases |

---

## 5. ⚡ LinkedIn Automation Actions

| Module | Files | Status | Notes |
|---|---|---|---|
| Connection request | `lib/linkedin-campaign-automation.ts` `sendConnectionRequest()` | ✅ | Full Playwright — handles degree detection, pending check, incoming accept |
| Direct message | `lib/linkedin-campaign-automation.ts` `sendMessage()` | ✅ | Full Playwright implementation |
| InMail | `lib/linkedin-campaign-automation.ts` `sendInMail()` | ✅ | Full Playwright implementation |
| View profile | `lib/campaign-executor.ts` case `view_profile` | ⚠️ | **STUB** — returns success without visiting profile |
| Follow | `lib/campaign-executor.ts` case `follow` | ⚠️ | **STUB** — returns success without following |
| Like post | `lib/campaign-executor.ts` case `like_post` | ⚠️ | **STUB** — returns success without liking |
| Email step | `lib/campaign-executor.ts` case `email` | ⚠️ | **STUB** — returns success, no SMTP/email integration |
| Delay step | `lib/campaign-executor.ts` case `delay` | ✅ | Working |
| Endorse skills | — | ❌ | **NEEDED**: Soft engagement action |
| Comment on posts | — | ❌ | **NEEDED**: AI-assisted post commenting |
| Voice notes | — | ❌ | **NEEDED**: HeyReach's unique feature |
| Browser stealth | `lib/linkedin-campaign-automation.ts` `createAuthenticatedBrowser()` | ✅ | webdriver removal, custom UA, viewport |
| Browser fingerprint randomization | — | ❌ | **NEEDED**: Random viewport/UA/WebGL/timezone per account |
| Connection status checker | `lib/linkedin-campaign-automation.ts` `checkConnectionStatus()` | ✅ | Pending/accepted/not_connected detection |

---

## 6. 📥 Unified Inbox (Unibox)

| Module | Files | Status | Notes |
|---|---|---|---|
| Unibox page | `app/unibox/` | ✅ | Working |
| Message scraping | `lib/linkedin-message-scraper.ts` | ✅ | Playwright-based |
| Message sync | `lib/linkedin-message-sync.ts` | ✅ | Syncs LinkedIn ↔ local DB |
| Message sync queue | `lib/queue/message-sync-queue.ts` | ✅ | BullMQ job |
| Message sync worker | `lib/workers/message-sync-worker.ts` | ✅ | Background processing |
| Inbox scanner worker | `lib/queue/workers/inbox-scanner-worker.ts` | ✅ | Periodic inbox scanning |
| Reply detection (auto-stop sequence) | `campaign-executor.ts` condition_type=replied | ✅ | Working |
| Conversation tags | — | ❌ | **NEEDED**: Label conversations (hot/cold/custom) |
| Voice note sending | — | ❌ | **NEEDED**: Send voice notes from desktop |
| Reply on behalf of teammates | — | ❌ | **NEEDED**: Agency feature |
| Inbox privacy settings per account | — | ❌ | **NEEDED**: Control which accounts' messages to show |
| Message read/unread status | — | ❌ | **NEEDED**: TODO in code (lib/linkedin-message-sync.ts) |
| Attachment handling | — | ❌ | **NEEDED**: TODO in code |

---

## 7. 👥 Lead Management

| Module | Files | Status | Notes |
|---|---|---|---|
| Leads list page | `app/leads/` | ✅ | Working |
| Lead lists page | `app/leads/lists/` | ✅ | Working |
| Import from CSV | `components/ImportLeadsModal.tsx` (502 LOC) | ✅ | Full CSV parsing + field mapping |
| Lead CRUD actions | `app/actions/leads.ts` | ✅ | Working |
| Create list modal | `components/CreateListModal.tsx` | ✅ | Working |
| Lead detail modal | `components/LeadDetailModal.tsx` | ✅ | Working |
| Add leads to list modal | `components/AddLeadsToListModal.tsx` (referenced) | ✅ | Working |
| Assign campaigns modal | `components/AssignCampaignsModal.tsx` | ✅ | Working |
| Custom fields | `app/actions/custom-fields.ts`, `components/CustomFieldsModal.tsx` | ✅ | Working |
| Lead deduplication | `campaign-executor.ts` `skipAlreadyContactedCheck()` | ✅ | Cross-campaign |
| Add lead from connection | `app/api/leads/add-from-connection/` | ✅ | Working |
| Import from Sales Navigator | — | ❌ | **NEEDED**: #1 most requested feature |
| Import from LinkedIn search URL | — | ❌ | **NEEDED**: Paste search URL → auto-scrape leads |
| Lead tags | — | ❌ | **NEEDED**: Tag leads (hot/cold/replied/custom) |
| Lead scoring | — | ❌ | **NEEDED**: Score based on engagement signals |
| Blacklist / blocklist | — | ❌ | **NEEDED**: Block domains, companies, specific profiles |
| Email finder / enrichment | — | ❌ | **NEEDED**: Integrate Hunter/Prospeo/Apollo API |
| Lead activity timeline | — | ❌ | **NEEDED**: Show all actions taken on a lead |

---

## 8. 🌐 My Network (LinkedIn Connections Sync)

| Module | Files | Status | Notes |
|---|---|---|---|
| My Network page | `app/my-network/` | ✅ | Working |
| Network sync engine | `lib/linkedin-network-sync.ts` | ✅ | Syncs LinkedIn connections to DB |
| Sync network modal | `components/SyncNetworkModal.tsx` | ✅ | Working |
| Network actions | `app/actions/network.ts` (676 LOC) | ✅ | Full CRUD + sync |
| Connection detail modal | `components/ConnectionDetailModal.tsx` | ✅ | Working |

---

## 9. 📈 Analytics & Reporting

| Module | Files | Status | Notes |
|---|---|---|---|
| Analytics page | `app/analytics/` | ✅ | Working |
| Funnel chart component | `components/AnalyticsFunnelChart.tsx` | ✅ | Working |
| Trend chart component | `components/AnalyticsTrendChart.tsx` | ✅ | Working |
| Campaign stats (sent/accepted/replied) | API routes + actions | ✅ | Working |
| Per-sender performance stats | `campaign-executor.ts` `updateSenderStats()` | ✅ | Working |
| A/B test reporting UI | — | ❌ | **NEEDED**: Backend assigns variants, but no UI shows results |
| Step-by-step funnel analytics | — | ❌ | **NEEDED**: Conversion at each step |
| Team analytics | — | ❌ | **NEEDED**: Performance across team members |
| Sender comparison report | — | ❌ | **NEEDED**: Which sender account performs best |
| Campaign ROI / meetings booked tracking | — | ❌ | **NEEDED**: Track outcomes beyond replies |

---

## 10. 🔗 Proxy Management

| Module | Files | Status | Notes |
|---|---|---|---|
| Proxy CRUD actions | `app/actions/proxies.ts` | ✅ | Working |
| Proxy modal | `components/ProxyModal.tsx` | ✅ | Working |
| Assign proxy modal | `components/AssignProxyModal.tsx` | ✅ | Working |
| Proxy tester | `lib/utils/proxy-tester.ts` | ✅ | Tests SOCKS/HTTP connectivity |
| Proxy helpers | `lib/utils/proxy-helpers.ts`, `lib/utils/proxy-url.ts` | ✅ | URL building utilities |
| Built-in proxy provisioning | — | ❌ | **NEEDED**: Auto-provision residential proxies via provider API |
| Proxy health dashboard | — | ❌ | **NEEDED**: Show latency, uptime per proxy |

---

## 11. 🔔 Webhooks

| Module | Files | Status | Notes |
|---|---|---|---|
| Outbound webhook engine | `lib/webhook.ts` (176 LOC) | ✅ | HMAC-SHA256 signed, 3x retry, exponential backoff |
| Webhook events | connection_sent, connection_accepted, message_sent, replied, campaign_paused, campaign_completed | ✅ | 6 event types |
| Webhook delivery logging | `campaign_webhook_logs` table | ✅ | Success/failure tracking |
| Webhook management UI | — | ⚠️ | Needs dedicated settings page |
| Inbound webhooks (triggers) | — | ❌ | **NEEDED**: Accept events FROM external tools to create leads/start campaigns |

---

## 12. ⚙️ Job Queue & Workers

| Module | Files | Status | Notes |
|---|---|---|---|
| Campaign queue | `lib/queue/campaign-queue.ts` | ✅ | BullMQ with delayed jobs |
| Message sync queue | `lib/queue/message-sync-queue.ts` | ✅ | Working |
| Campaign worker | `lib/queue/workers/campaign-worker.ts` | ✅ | Processes campaign steps |
| Inbox scanner worker | `lib/queue/workers/inbox-scanner-worker.ts` | ✅ | Periodic inbox check |
| Status checker worker | `lib/queue/workers/status-checker-worker.ts` | ✅ | Monitors step delivery status |
| Worker manager | `lib/workers/worker-manager.ts` | ✅ | Lifecycle management |
| Bull Board dashboard | `app/api/bull-board/` | ✅ | Queue monitoring UI |
| Dead letter queue handling | — | ❌ | **NEEDED**: Handle permanently failed jobs |
| Queue metrics / observability | — | ❌ | **NEEDED**: Queue depth, processing time metrics |

---

## 13. 🗄️ Database Layer

| Module | Files | Status | Notes |
|---|---|---|---|
| PostgreSQL connection pool | `lib/db/pool.ts` | ✅ | Singleton, max 20 connections |
| Supabase-compatible query builder | `lib/db/query-builder.ts` (548 LOC) | ✅ | .from().select().eq().order().limit() |
| Server client | `lib/db/server.ts` | ✅ | Server-side DB access |
| Browser client | `lib/db/client.ts` | ✅ | Client-side wrapper |
| DB index / re-exports | `lib/db/index.ts` | ✅ | Working |
| Migration files | `migrations/` (20 files) | ✅ | Full schema including RPCs |
| Atomic counter RPCs | `migrations/atomic-counter-rpcs.sql` | ✅ | Race-condition-safe increments |
| Query parameterization audit | — | ⚠️ | **NEEDED**: Verify all queries are parameterized (SQL injection surface) |

---

## 14. 🔒 Security & Encryption

| Module | Files | Status | Notes |
|---|---|---|---|
| Password hashing (bcryptjs) | `lib/db/auth.ts` | ✅ | Working |
| JWT sign/verify | `lib/db/jwt.ts` | ✅ | HMAC-SHA256 |
| LinkedIn credential encryption | `lib/utils/encryption.ts` | ⚠️ | **CRITICAL**: Uses base64, NOT real encryption. Must replace with AES-256-GCM |
| Duplicate password hashing | `lib/utils/encryption.ts` | 🗑️ | **REMOVE**: Duplicate of `lib/db/auth.ts` — consolidate |
| Hardcoded secrets in scripts | Multiple scripts | 🗑️ | **REMOVE**: Rotate + scrub from git history |
| PII leak file | `ource .env.local` | 🗑️ | **REMOVE**: Typo file with real email data |
| Webhook HMAC signatures | `lib/webhook.ts` | ✅ | SHA-256 signed |
| Rate limiting on API routes | — | ❌ | **NEEDED**: Prevent brute force on auth endpoints |
| CSRF protection | — | ❌ | **NEEDED**: Token-based CSRF for mutation routes |

---

## 15. 🔌 Integrations (External Tools)

| Module | Files | Status | Notes |
|---|---|---|---|
| Public REST API | — | ❌ | **NEEDED**: Documented API for campaigns, leads, accounts |
| Zapier integration | — | ❌ | **NEEDED**: Triggers + actions via Zapier |
| Make (Integromat) | — | ❌ | **NEEDED**: Native integration |
| n8n integration | — | ❌ | **NEEDED**: Native integration |
| HubSpot CRM sync | — | ❌ | **NEEDED**: 2-way lead/contact + activity sync |
| Salesforce sync | — | ❌ | **NEEDED**: Enterprise CRM |
| Pipedrive sync | — | ❌ | **NEEDED**: SMB CRM |
| Clay integration | — | ❌ | **NEEDED**: HeyReach's top integration |
| Instantly / Smartlead | — | ❌ | **NEEDED**: Multichannel email tools |
| Slack notifications | — | ❌ | **NEEDED**: Reply/milestone alerts |
| MCP Server | — | ❌ | **NEEDED**: HeyReach has this |

---

## 16. 📧 Multichannel (Email)

| Module | Files | Status | Notes |
|---|---|---|---|
| Email step type (schema) | `campaign_sequences` table | ✅ | Schema supports `email` step |
| Email sending (SMTP/Resend) | — | ❌ | **NEEDED**: Wire up actual email sending |
| Email tracking (opens/clicks) | — | ❌ | **NEEDED**: Pixel tracking + link wrapping |
| Email template builder | — | ❌ | **NEEDED**: Rich text email editor |
| Email warmup | — | ❌ | **NEEDED**: Warm up sending domains |
| Domain health monitoring | — | ❌ | **NEEDED**: SPF/DKIM/DMARC checks |

---

## 17. 🏢 Agency & Enterprise Features

| Module | Files | Status | Notes |
|---|---|---|---|
| Workspaces / multi-tenant | — | ❌ | **NEEDED**: Separate client data for agencies |
| Whitelabel | — | ❌ | **NEEDED**: Custom domain, logo, colors |
| Roles & permissions | — | ❌ | **NEEDED**: Admin / Manager / VA |
| Client management dashboard | — | ❌ | **NEEDED**: Overview of all clients |
| Team invite system | — | ❌ | **NEEDED**: Email invites, pending invitations |
| Audit log | — | ❌ | **NEEDED**: Track who did what |

---

## 18. 🧪 Testing

| Module | Files | Status | Notes |
|---|---|---|---|
| Unit tests | `tests/unit/` (3 files) | ⚠️ | Template engine, encryption, auth — shallow coverage |
| Integration tests | `tests/integration/` (3 files) | ⚠️ | Campaign flow, LinkedIn auth, message sync |
| E2E tests | `tests/e2e/` (2 files) | ⚠️ | Login flow, campaign creation |
| Security tests | `tests/security/` (2 files) | ⚠️ | Auth security, input validation |
| Performance tests | `tests/performance/` (2 files) | ⚠️ | DB queries, API response times |
| Load tests | `tests/load/` (2 files) | ⚠️ | Concurrent users, queue throughput |
| CI/CD pipeline | — | ❌ | **NEEDED**: GitHub Actions for automated testing |
| Test coverage ≥60% | — | ❌ | **NEEDED**: Currently ~10% meaningful coverage |

---

## 19. 🗑️ Dead Code / Cleanup Needed

| Item | Files | Action |
|---|---|---|
| Backup file (606 LOC) | `lib/linkedin-network-sync-old-backup.ts` | 🗑️ DELETE |
| Backup page | `page.tsx.backup2` | 🗑️ DELETE |
| Test file in root | `simple-test.tsx` | 🗑️ DELETE |
| PII leak file | `ource .env.local` | 🗑️ DELETE + scrub git |
| Debug page | `app/debug-import/` | 🗑️ DELETE |
| Test page | `app/test-infinite-login/` | 🗑️ DELETE |
| Test API routes | `app/api/test-cookie-auth/`, `app/api/test-supabase/` | 🗑️ DELETE |
| Old Puppeteer automation | `lib/linkedin-automation.ts` (560 LOC) | 🗑️ DELETE — replaced by Playwright version |
| Old session manager | `lib/linkedin-session-manager.ts` (462 LOC) | ⚠️ REVIEW — may be replaceable |
| 79 loose scripts | `scripts/` | ⚠️ TRIAGE — keep operational, delete rest |
| 33 loose root files | Root JS/TS/SH files | ⚠️ MOVE to `scripts/` or DELETE |
| 44 markdown docs | Root MD files | ⚠️ MOVE to `docs/` folder |
| 594 console.log statements | Across all source | ⚠️ REPLACE with structured logger |
| 494 `supabase` variable names | Across all source | ⚠️ RENAME to `db` / `client` |

---

## 📊 Summary Scorecard

| Category | Done | Partial | Missing | Total |
|---|---|---|---|---|
| **Auth & Users** | 9 | 0 | 3 | 12 |
| **Dashboard** | 1 | 1 | 2 | 4 |
| **LinkedIn Accounts** | 7 | 4 | 5 | 16 |
| **Campaigns** | 19 | 0 | 4 | 23 |
| **Automation Actions** | 7 | 4 | 4 | 15 |
| **Unified Inbox** | 7 | 0 | 5 | 12 |
| **Lead Management** | 9 | 0 | 6 | 15 |
| **My Network** | 5 | 0 | 0 | 5 |
| **Analytics** | 5 | 0 | 5 | 10 |
| **Proxy Management** | 5 | 0 | 2 | 7 |
| **Webhooks** | 3 | 1 | 1 | 5 |
| **Queue & Workers** | 6 | 0 | 2 | 8 |
| **Database** | 6 | 1 | 0 | 7 |
| **Security** | 3 | 1 | 2 | 6 |
| **Integrations** | 0 | 0 | 11 | 11 |
| **Multichannel Email** | 1 | 0 | 5 | 6 |
| **Agency/Enterprise** | 0 | 0 | 6 | 6 |
| **Testing** | 0 | 6 | 2 | 8 |
| **TOTALS** | **92** | **18** | **65** | **176** |

> **92 modules done (52%) · 18 partial (10%) · 65 missing (37%)**
>
> Focus on the 18 partial items first (quick wins), then the 65 missing modules prioritized by the Phase 1→4 roadmap in `COMPETITIVE_ANALYSIS.md`.
