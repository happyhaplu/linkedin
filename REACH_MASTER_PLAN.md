# REACH — Complete Product Bible

> **Date**: 16 March 2026  
> **Purpose**: Single source of truth — current state, infrastructure, competitive analysis, module map, migration plan, and roadmap  
> **Migration Target**: Go backend + Vue 3 frontend

---

# TABLE OF CONTENTS

1. [Product Overview](#1-product-overview)
2. [Current Tech Stack & Infrastructure](#2-current-tech-stack--infrastructure)
3. [Database Schema](#3-database-schema)
4. [Competitive Analysis (vs HeyReach, Expandi, Dripify)](#4-competitive-analysis)
5. [Our Strengths (What HeyReach Doesn't Have)](#5-our-strengths)
6. [Module Status — What's Done, Partial, Missing](#6-module-status)
7. [Infrastructure Gaps](#7-infrastructure-gaps)
8. [Security Audit](#8-security-audit)
9. [LinkedIn Ban Safety Readiness](#9-linkedin-ban-safety-readiness)
10. [Go + Vue Tech Stack (Target)](#10-go--vue-tech-stack)
11. [Go Migration Plan — 50 Modules Ranked](#11-go-migration-plan)
12. [Vue Frontend Migration](#12-vue-frontend-migration)
13. [New Features Roadmap (Beat Competition)](#13-new-features-roadmap)
14. [Dead Code & Cleanup](#14-dead-code--cleanup)
15. [Timeline Summary](#15-timeline-summary)

---

# 1. PRODUCT OVERVIEW

**Reach** is a self-hosted LinkedIn outreach automation platform. It automates connection requests, messages, InMails, and multi-step campaign sequences with safety guardrails.

| Metric | Value |
|---|---|
| **Total Source Lines** | ~38,188 |
| **Core Lib Lines** | 8,897 |
| **Pages** | 18 |
| **API Routes** | 18 |
| **Server Actions** | 8 files |
| **Components** | 22 |
| **Test Files** | 19 |
| **DB Tables** | 21 |
| **DB Indexes** | 63 |
| **DB Functions** | 14 |
| **DB Triggers** | 12 |
| **Job Queues** | 7 (6 campaign + 1 message sync) |
| **Workers** | 5 (campaign, inbox-scanner, status-checker, message-sync, worker-manager) |

---

# 2. CURRENT TECH STACK & INFRASTRUCTURE

## 2.1 Application Layer

| Component | Technology | Version | Notes |
|---|---|---|---|
| **Framework** | Next.js (App Router) | 14.1.0 | SSR + Server Actions |
| **Language** | TypeScript | 5.x | Strict mode |
| **UI** | React | 18.2 | — |
| **CSS** | Tailwind CSS | 3.3 | — |
| **Package Manager** | pnpm | — | — |
| **Runtime** | Node.js | 20+ | — |

## 2.2 Database Layer

| Component | Technology | Details |
|---|---|---|
| **Database** | PostgreSQL | via `pg` driver |
| **Connection Pool** | `pg.Pool` singleton | max: 20, idle: 30s, connect timeout: 5s |
| **Query Builder** | Custom Supabase-compatible | 549 LOC — `.from().select().eq().order().single()` |
| **Migrations** | Raw SQL files | 20 migration files in `/migrations` |
| **Atomic Operations** | Stored functions (RPCs) | Race-safe counter increments for stats |
| **Auto-triggers** | 12 triggers | `updated_at`, campaign stats, conversation counters |

## 2.3 Job Queue & Workers

| Component | Technology | Details |
|---|---|---|
| **Queue Engine** | BullMQ | Redis-backed |
| **Redis** | ioredis | Retry strategy (10 attempts, 500ms→5s backoff) |
| **Queues** | 7 named queues | campaign-processor, connection-sender, message-sender, inmail-sender, status-checker, inbox-scanner, message-sync |
| **Worker Concurrency** | 2 concurrent | Lock: 3 min, stalled check: 30s |
| **Rate Limiter** | 5 jobs/60s | On campaign worker |
| **Retry Policy** | 3 attempts | Exponential backoff: 5s → 10s → 20s |
| **Job Cleanup** | Completed: 24h, Failed: 7d | Auto-removal |
| **Dashboard** | Bull Board | Queue monitoring UI at `/api/bull-board` |
| **Boot** | `instrumentation.ts` | Workers auto-start with Next.js — no separate process |
| **Shutdown** | Graceful | SIGTERM/SIGINT handlers |

## 2.4 Authentication

| Component | Details |
|---|---|
| **JWT** | Custom HMAC-SHA256 (Node `crypto`) — Edge-compatible |
| **Sessions** | HTTP-only cookies, 30-day expiry |
| **Passwords** | bcrypt, 10 salt rounds |
| **Middleware** | Next.js Edge middleware — verifies JWT, enforces auth + subscription |
| **External SSO** | Accounts Service — token verify + subscription check |
| **Cookie Name** | `reach-session` |

## 2.5 LinkedIn Automation Engine

| Component | Details |
|---|---|
| **Primary** | Playwright headless Chrome (1,006 LOC) |
| **Legacy** | Puppeteer (560 LOC) — **SHOULD BE REMOVED** |
| **Stealth** | `navigator.webdriver` removal, custom User-Agent, viewport spoofing |
| **Auth** | Cookie auth (li_at + JSESSIONID) + credential login fallback |
| **Proxy** | Native Playwright proxy support (HTTP/HTTPS/SOCKS4/SOCKS5 with auth) |
| **Error Handling** | Transient vs auth error classification (10+ network error patterns) |
| **Ban Detection** | Keywords: restricted, suspended, banned, session expired, logged out |
| **Auto-disconnect** | Only on genuine auth errors — never on transient/network failures |
| **URL Normalization** | http→https, missing www, query strings stripped |

## 2.6 Campaign Safety Engine

| Safety Feature | Implementation | Status |
|---|---|---|
| Daily action limits | 50 conn / 100 msg / 25 InMail / 150 total | ✅ Working (hardcoded) |
| Weekly connection limit | 100/week via `account_daily_counters` | ✅ Working |
| Warm-up ramp | Linear from 5 → limit over N days (default 14) | ✅ Working |
| Random jitter | 45–120 seconds between actions (configurable) | ✅ Working |
| Working hours | Timezone-aware, configurable days + hours | ✅ Working |
| Human-like typing | 50–150ms per character | ✅ Working |
| Circuit breaker | Auto-pause if acceptance rate < 15% | ✅ Working (unique advantage) |
| Sender round-robin | Distributes across active senders | ✅ Working |
| Skip already-contacted | Cross-campaign deduplication | ✅ Working |
| A/B testing | Alternating variant assignment | ✅ Working |

## 2.7 Other Infrastructure

| Component | Details |
|---|---|
| **Template Engine** | Variable replacement (`{{firstName}}`) + spintax (`{Hi\|Hey}`) + validation (306 LOC) |
| **Webhooks** | HMAC-SHA256 signed, 6 event types, 3x retry with exponential backoff, 10s timeout, delivery logging |
| **AI** | GPT-4o-mini icebreaker generation, integrated into template engine |
| **Proxy Tester** | Connectivity check via ipify.org, latency measurement, SOCKS/HTTP support |
| **Testing** | Jest (unit/integration) + Playwright (E2E), 19 test files, multi-browser |
| **External Auth** | Accounts Service integration (SSO + subscription verification) |

---

# 3. DATABASE SCHEMA

**21 tables, 63 indexes, 14 functions, 12 triggers**

| # | Table | Purpose | Key Columns |
|---|---|---|---|
| 1 | `users` | User accounts | id, email, password_hash |
| 2 | `proxies` | Proxy servers | type, host, port, username, password_encrypted |
| 3 | `linkedin_accounts` | LinkedIn accounts | email, session_cookies, proxy_id, status, sending_limits, profile fields |
| 4 | `lists` | Lead lists | name, lead_count |
| 5 | `leads` | Individual leads | linkedin_url, first_name, company, position, status |
| 6 | `custom_fields` | User-defined lead fields | name, field_type |
| 7 | `campaigns` | Campaign definitions | name, status, daily_limit, timezone, stats counters |
| 8 | `campaign_activities` | Legacy activity log | activity_type, status |
| 9 | `account_health_logs` | Health check history | session_valid, response_time |
| 10 | `campaign_senders` | Sender assignment | campaign_id, linkedin_account_id, daily counters |
| 11 | `campaign_sequences` | Sequence steps | step_number, step_type, message_template, condition_type |
| 12 | `campaign_leads` | Lead-campaign tracking | status, current_step, timestamps for each stage |
| 13 | `campaign_activity_log` | Detailed action log | activity_type, activity_status, metadata |
| 14 | `campaign_webhooks` | Webhook configs | url, secret, events, is_active |
| 15 | `campaign_webhook_logs` | Delivery log | success, status_code, error_message |
| 16 | `account_daily_counters` | Rate limiting | connections_sent, messages_sent, inmails_sent per day |
| 17 | `network_connections` | Synced LinkedIn connections | full_name, headline, company, connection_status |
| 18 | `connection_requests` | Sent/received requests | target_linkedin_url, request_type, request_status |
| 19 | `network_sync_logs` | Sync history | sync_type, sync_status, counts |
| 20 | `conversations` | Inbox threads | participant_name, last_message_at, unread_count, thread_id |
| 21 | `messages` | Individual messages | sender_name, content, is_from_me, sent_at |

**Key stored functions:**
- `increment_sender_stat()` — atomic sender counter increment
- `increment_campaign_stat()` — atomic campaign counter increment
- `increment_daily_counter()` — atomic daily limit counter
- `get_campaign_stats()` — aggregated campaign statistics
- `can_sender_send_today()` — check sender daily limit
- `get_next_campaign_sender()` — round-robin sender selection
- `reset_daily_sender_limits()` — daily reset cron
- `update_campaign_stats()` — trigger: auto-update campaign aggregates
- `update_conversation_last_message()` — trigger: inbox timestamp sync
- `update_conversation_unread_count()` — trigger: unread counter

---

# 4. COMPETITIVE ANALYSIS

## 4.1 Market Landscape

| Tool | Pricing | Type | USP |
|---|---|---|---|
| **HeyReach** | $79/sender → $1,999/unlimited | Cloud SaaS | Unlimited senders, 20+ integrations, whitelabel, MCP |
| **Expandi** | $99/seat/mo | Cloud SaaS | Auto warm-up, smart limits, dedicated IPs |
| **Dripify** | $39–$79/user/mo | Cloud SaaS | 15+ actions, email finder, drag-drop sequences |
| **Skylead** | $100/seat/mo | Cloud SaaS | Smart conditional sequences, multichannel |
| **Linked Helper** | $15–$45/mo | Desktop extension | Cheapest, simplest |
| **Zopto** | $197+/mo | Cloud SaaS | AI targeting, enterprise |
| **Our Reach** | **$0** (self-hosted) | Self-hosted | Full control, no per-seat cost, open source |

## 4.2 Feature Comparison Matrix

### Core LinkedIn Actions

| Feature | HeyReach | Expandi | Dripify | **Reach** | Status |
|---|---|---|---|---|---|
| Connection requests | ✅ | ✅ | ✅ | ✅ | Done |
| Direct messages | ✅ | ✅ | ✅ | ✅ | Done |
| InMails | ✅ | ✅ | ✅ | ✅ | Done |
| Profile views | ✅ | ✅ | ✅ | ⚠️ Stub | **Fake** |
| Follow | ✅ | ✅ | ✅ | ⚠️ Stub | **Fake** |
| Like posts | ✅ | ✅ | ✅ | ⚠️ Stub | **Fake** |
| Endorse skills | ✅ | ✅ | ❌ | ❌ | Missing |
| Comment on posts | ❌ | ✅ | ❌ | ❌ | Missing |
| Voice notes | ✅ | ❌ | ❌ | ❌ | Missing |
| Auto-accept incoming invites | ❌ | ❌ | ❌ | ✅ | **OUR ADVANTAGE** |

### Campaign Engine

| Feature | HeyReach | Expandi | Dripify | **Reach** | Status |
|---|---|---|---|---|---|
| Multi-step sequences | ✅ | ✅ | ✅ | ✅ | Done |
| If/Then conditions | ✅ | ✅ | ✅ | ✅ | Done |
| A/B testing | ✅ | ✅ | ✅ | ✅ | Done |
| Visual sequence builder | ✅ | ✅ | ✅ | ✅ | Done |
| Working hours + timezone | ✅ | ✅ | ✅ | ✅ | Done |
| Jitter delays | ✅ | ✅ | ✅ | ✅ | Done |
| Warm-up ramp | ✅ | ✅ | ✅ | ✅ | Done |
| Circuit breaker auto-pause | ❌ | ❌ | ❌ | ✅ | **OUR ADVANTAGE** |
| Campaign prioritization | ✅ | ✅ | ❌ | ❌ | Missing |

### Safety & Anti-Ban

| Feature | HeyReach | Expandi | Dripify | **Reach** | Status |
|---|---|---|---|---|---|
| Daily action limits | ✅ Smart | ✅ Smart | ✅ | ✅ Hardcoded | Basic |
| Weekly connection limit | ✅ | ✅ | ✅ | ✅ 100/week | Done |
| Warm-up ramp | ✅ | ✅ Auto | ✅ | ✅ Linear | Done |
| Dedicated proxy (built-in) | ✅ Included | ✅ | ❌ | ❌ BYO | Missing |
| Human-like delays | ✅ | ✅ | ✅ | ✅ 45-120s | Done |
| Stealth browser | ✅ | ✅ | ✅ | ✅ | Done |
| User-configurable limits | ✅ | ✅ Sliders | ✅ | ❌ Hardcoded | Missing |
| Ban/restriction detection | ✅ | ✅ | ✅ | ✅ | Done |
| Transient vs auth errors | ✅ | ✅ | ? | ✅ Excellent | Done |
| Smart adaptive limits | ✅ | ✅ Big data | ✅ | ❌ | Missing |
| Account cool-down | ✅ | ✅ | ✅ | ❌ | Missing |
| SSI monitoring | ❌ | ✅ | ❌ | ❌ | Missing |

### Integrations

| Feature | HeyReach | Expandi | Dripify | **Reach** | Status |
|---|---|---|---|---|---|
| REST API | ✅ Full docs | ✅ | ✅ | ❌ | Missing |
| Webhooks | ✅ | ✅ | ✅ | ✅ HMAC-signed | Done |
| Zapier / Make / n8n | ✅ Native | ✅ | ✅ | ❌ | Missing |
| HubSpot | ✅ Native | ✅ | ✅ | ❌ | Missing |
| Clay | ✅ Native | ❌ | ❌ | ❌ | Missing |
| Slack | ✅ | ❌ | ✅ | ❌ | Missing |
| MCP Server | ✅ | ❌ | ❌ | ❌ | Missing |
| Email multichannel | ✅ | ✅ | ❌ | ❌ | Missing |

### Agency & Enterprise

| Feature | HeyReach | Expandi | Dripify | **Reach** | Status |
|---|---|---|---|---|---|
| Whitelabel | ✅ | ✅ | ❌ | ❌ | Missing |
| Workspaces | ✅ | ✅ | ✅ | ❌ | Missing |
| Roles & permissions | ✅ | ✅ | ✅ | ❌ | Missing |
| Unlimited users/teammates | ✅ Free | ✅ | ✅ | N/A self-hosted | N/A |

---

# 5. OUR STRENGTHS (What HeyReach Doesn't Have)

| # | Strength | Detail | Why It Matters |
|---|---|---|---|
| 1 | **$0 Cost / Self-Hosted** | No per-sender pricing. Deploy once, free forever | HeyReach: $79/sender. 10 senders = $790/mo vs $0. **10x cost advantage** |
| 2 | **Full Data Ownership** | All data in your Postgres. No vendor lock-in | GDPR compliance easier. No third-party data sharing |
| 3 | **Circuit Breaker** | Auto-pause campaign if acceptance rate < 15% | No competitor has this. **Prevents bans proactively** |
| 4 | **Auto-Accept Incoming Invites** | Accepts inbound connection requests during outreach | Grows network while outbound runs. **Unique feature** |
| 5 | **AI Icebreakers (GPT-4o-mini)** | AI-generated personalized first lines per lead | Integrated into template engine with `{{aiIcebreaker}}` |
| 6 | **Excellent Error Classification** | 10+ transient error patterns distinguished from auth errors | Won't false-disconnect accounts on network glitches |
| 7 | **Atomic DB Operations** | Stored functions for all counter increments | Race-safe under concurrency. More reliable than app-level locks |
| 8 | **HMAC-SHA256 Webhooks** | Cryptographically signed payloads with 3x retry | Enterprise-grade. HeyReach doesn't sign webhooks |
| 9 | **Full Source Control** | Customize every behavior — limits, timing, stealth | Adapt faster to LinkedIn detection changes than SaaS tools |
| 10 | **Spintax Engine** | Built-in `{option1\|option2}` processing | No third-party dependency for personalization |
| 11 | **Connection Degree Detection** | Checks 1st/2nd/3rd degree before acting | Prevents wasting actions on already-connected leads |
| 12 | **Workers Inside App Process** | BullMQ boots via `instrumentation.ts` | Simpler deployment than distributed worker architecture |
| 13 | **Zero Vendor Lock-in** | Pure Postgres, no Supabase/Firebase dependency | Custom query builder migrated off Supabase |

---

# 6. MODULE STATUS

## 6.1 Summary Scorecard

| Category | ✅ Done | ⚠️ Partial | ❌ Missing | Total |
|---|---|---|---|---|
| Auth & Users | 9 | 0 | 3 | 12 |
| Dashboard | 1 | 1 | 2 | 4 |
| LinkedIn Accounts | 7 | 4 | 5 | 16 |
| Campaigns | 19 | 0 | 4 | 23 |
| Automation Actions | 7 | 4 | 4 | 15 |
| Unified Inbox | 7 | 0 | 5 | 12 |
| Lead Management | 9 | 0 | 6 | 15 |
| My Network | 5 | 0 | 0 | 5 |
| Analytics | 5 | 0 | 5 | 10 |
| Proxy Management | 5 | 0 | 2 | 7 |
| Webhooks | 3 | 1 | 1 | 5 |
| Queue & Workers | 6 | 0 | 2 | 8 |
| Database | 6 | 1 | 0 | 7 |
| Security | 3 | 1 | 2 | 6 |
| Integrations | 0 | 0 | 11 | 11 |
| Multichannel Email | 1 | 0 | 5 | 6 |
| Agency/Enterprise | 0 | 0 | 6 | 6 |
| Testing | 0 | 6 | 2 | 8 |
| **TOTALS** | **92** | **18** | **65** | **176** |

> **92 done (52%) · 18 partial (10%) · 65 missing (37%)**

## 6.2 Detailed Module Breakdown

### Auth & User Management

| Module | Status | Notes |
|---|---|---|
| Email/Password Signup & Login | ✅ | Custom JWT + HTTP-only cookie |
| JWT Token System | ✅ | HMAC-SHA256, Edge-compatible |
| Forgot / Reset Password | ✅ | Working |
| Session Management | ✅ | 30-day HTTP-only cookies |
| External SSO (Accounts Service) | ✅ | Token verify + subscription check |
| Auth Middleware | ✅ | Route protection with subscription enforcement |
| User Profile Page | ✅ | Working |
| Auth Me (session check) | ✅ | Working |
| Signout | ✅ | Working |
| Roles & Permissions | ❌ | Need Admin/Manager/VA roles |
| Team Invite System | ❌ | Need email invites |
| API Key Authentication | ❌ | Needed for public API |

### LinkedIn Account Management

| Module | Status | Notes |
|---|---|---|
| Account CRUD | ✅ | Working |
| Cookie Auth (li_at + JSESSIONID) | ✅ | Full Playwright implementation |
| Credential Login Fallback | ✅ | Auto-fallback when cookies expire |
| Proxy Assignment Per Account | ✅ | SOCKS/HTTP support |
| Profile Data Extraction & Re-sync | ✅ | Working |
| Auto-disconnect on Ban | ✅ | Keyword-based detection |
| Transient vs Auth Error Classification | ✅ | Excellent — 10+ patterns |
| 2FA / OTP Handling | ⚠️ | Session stored, user completes manually |
| Infinite Login Session | ⚠️ | Exists but non-headless |
| Account Health Monitoring | ⚠️ | **PLACEHOLDER** — just checks if cookies exist |
| User-Configurable Daily Limits | ⚠️ | UI exists but limits hardcoded in executor |
| Scheduled Health Check (Cron) | ❌ | Need every 4-6h |
| Account Cool-down System | ❌ | Need auto-reduce after errors |
| Smart Adaptive Limits | ❌ | Need account-age/SSI based |
| SSI Score Monitoring | ❌ | Need tracking |
| Built-in Proxy Provisioning | ❌ | Need provider API integration |

### Campaign Module

| Module | Status | Notes |
|---|---|---|
| Campaign List Page | ✅ | Working |
| Campaign Create/Detail/Edit | ✅ | Working |
| Campaign CRUD Actions (1,509 LOC) | ✅ | Full CRUD |
| Start/Pause/Resume/Stop | ✅ | Working |
| Visual Sequence Builder | ✅ | Drag-and-drop |
| Step Editor Modal | ✅ | All step types |
| Template Editor + Engine | ✅ | Variables + spintax |
| Multi-step Sequences | ✅ | Ordered steps with delays |
| If/Then Conditions | ✅ | accepted/not_accepted/replied/not_replied |
| A/B Message Testing | ✅ | Alternating variant assignment |
| Working Hours (timezone-aware) | ✅ | Configurable days + hours |
| Random Jitter (45-120s) | ✅ | Configurable per campaign |
| Warm-up Ramp (5→limit) | ✅ | Linear over N days |
| Daily Limits (50/100/25) | ✅ | Per action type |
| Weekly Connection Limit (100/wk) | ✅ | Rolling window |
| Circuit Breaker | ✅ | Auto-pause at <15% acceptance |
| AI Icebreakers (GPT-4o-mini) | ✅ | Working |
| Skip Already-Contacted | ✅ | Cross-campaign dedup |
| Sender Round-Robin | ✅ | Working |
| Campaign Export (CSV) | ✅ | Working |
| Campaign Prioritization | ❌ | Need priority ordering |
| Smart Sender Rotation | ❌ | Need weighted by limits remaining |
| Campaign Cloning | ❌ | Need duplication |
| Campaign Templates Library | ❌ | Need pre-built templates |

### LinkedIn Automation Actions

| Module | Status | Notes |
|---|---|---|
| Connection Request | ✅ | Full Playwright — degree detection, pending check |
| Direct Message | ✅ | Full Playwright |
| InMail | ✅ | Full Playwright |
| Delay Step | ✅ | Working |
| Connection Status Check | ✅ | Pending/accepted/not_connected |
| Auto-accept Incoming Invites | ✅ | Unique advantage |
| Browser Stealth | ✅ | webdriver removal, custom UA |
| View Profile | ⚠️ | **STUB** — returns success without visiting |
| Follow | ⚠️ | **STUB** — returns success without following |
| Like Post | ⚠️ | **STUB** — returns success without liking |
| Email Step | ⚠️ | **STUB** — no SMTP integration |
| Endorse Skills | ❌ | Need to build |
| Comment on Posts | ❌ | Need AI-assisted |
| Voice Notes | ❌ | HeyReach's unique feature |
| Browser Fingerprint Randomization | ❌ | Need per-account randomization |

### Unified Inbox

| Module | Status | Notes |
|---|---|---|
| Unibox Page | ✅ | Working |
| Message Scraping (Playwright) | ✅ | Working |
| Message Sync (LinkedIn ↔ DB) | ✅ | Working |
| Message Sync Queue + Worker | ✅ | BullMQ, every 3 min |
| Inbox Scanner Worker | ✅ | Periodic check |
| Reply Detection (auto-stop) | ✅ | Working |
| Send Reply | ✅ | Via queue |
| Conversation Tags | ❌ | Need labels |
| Voice Note Sending | ❌ | Need to build |
| Reply on Behalf of Teammates | ❌ | Agency feature |
| Message Read/Unread Status | ❌ | TODO in code |
| Attachment Handling | ❌ | TODO in code |

### Lead Management

| Module | Status | Notes |
|---|---|---|
| Leads Page + Lists Page | ✅ | Working |
| Lead CRUD Actions | ✅ | Working |
| CSV Import with Field Mapping | ✅ | Full parser |
| Custom Fields | ✅ | Working |
| Lead Deduplication | ✅ | Cross-campaign |
| Add Lead from Connection | ✅ | Working |
| Create/Edit List | ✅ | Working |
| Lead Detail Modal | ✅ | Working |
| Assign Campaigns Modal | ✅ | Working |
| Import from Sales Navigator | ❌ | #1 most requested |
| Import from LinkedIn Search URL | ❌ | Need scraping |
| Lead Tags (hot/cold/custom) | ❌ | Need to build |
| Blacklist / Blocklist | ❌ | Need to build |
| Email Finder / Enrichment | ❌ | Need API integration |
| Lead Activity Timeline | ❌ | Need to build |
| Lead Scoring | ❌ | Need to build |

### My Network — ✅ COMPLETE

| Module | Status |
|---|---|
| My Network Page | ✅ |
| Network Sync Engine | ✅ |
| Network Actions (676 LOC) | ✅ |
| Sync Network Modal | ✅ |
| Connection Detail Modal | ✅ |

### Analytics

| Module | Status | Notes |
|---|---|---|
| Analytics Page | ✅ | Working |
| Funnel Chart Component | ✅ | Working |
| Trend Chart Component | ✅ | Working |
| Campaign Stats | ✅ | Working |
| Per-sender Performance | ✅ | Working |
| A/B Test Reporting UI | ❌ | Backend works, no UI |
| Step-by-step Funnel | ❌ | Need to build |
| Team Analytics | ❌ | Need to build |
| Sender Comparison Report | ❌ | Need to build |
| ROI / Meetings Booked | ❌ | Need to build |

### Proxy Management

| Module | Status | Notes |
|---|---|---|
| Proxy CRUD | ✅ | Working |
| Proxy Testing | ✅ | Latency check via ipify.org |
| Proxy Assignment Modal | ✅ | Working |
| SOCKS5 + HTTP Support | ✅ | Working |
| Proxy Helpers / URL Builder | ✅ | Working |
| Auto-provision Proxies | ❌ | Need provider API |
| Proxy Health Dashboard | ❌ | Need latency/uptime view |

### Webhooks

| Module | Status | Notes |
|---|---|---|
| Outbound Engine (176 LOC) | ✅ | HMAC-SHA256, 3x retry |
| 6 Event Types | ✅ | Full coverage |
| Delivery Logging | ✅ | Success/failure in DB |
| Management UI | ⚠️ | Needs dedicated settings page |
| Inbound Webhooks | ❌ | Need to accept triggers from external tools |

### Queue & Workers

| Module | Status | Notes |
|---|---|---|
| Campaign Queue | ✅ | BullMQ with delayed jobs |
| Message Sync Queue | ✅ | Repeating every 3 min |
| Campaign Worker | ✅ | With working hours + jitter |
| Inbox Scanner Worker | ✅ | Periodic |
| Status Checker Worker | ✅ | Monitors delivery |
| Worker Manager | ✅ | Lifecycle management |
| Bull Board Dashboard | ✅ | Monitoring UI |
| Dead Letter Queue | ❌ | Need handling for permanently failed |
| Queue Metrics | ❌ | Need observability |

### Database Layer

| Module | Status | Notes |
|---|---|---|
| Connection Pool (singleton) | ✅ | max 20 |
| Query Builder (549 LOC) | ✅ | Supabase-compatible |
| Server Client | ✅ | Server-side with auth |
| Browser Client | ✅ | Client-side wrapper |
| Migration Files (20) | ✅ | Full schema |
| Atomic Counter RPCs | ✅ | Race-safe |
| SQL Injection Audit | ⚠️ | Need parameterization verification |

### Integrations — ❌ ALL MISSING

| Module | Status |
|---|---|
| Public REST API | ❌ |
| Zapier | ❌ |
| Make (Integromat) | ❌ |
| n8n | ❌ |
| HubSpot CRM | ❌ |
| Salesforce | ❌ |
| Pipedrive | ❌ |
| Clay | ❌ |
| Instantly / Smartlead | ❌ |
| Slack | ❌ |
| MCP Server | ❌ |

> **This is the #1 biggest gap vs HeyReach**

### Multichannel Email — ❌ MOSTLY MISSING

| Module | Status | Notes |
|---|---|---|
| Email Step Type (schema) | ⚠️ | Schema supports it |
| Email Sending (SMTP) | ❌ | Need to build |
| Email Tracking | ❌ | Need open/click pixels |
| Email Template Builder | ❌ | Need rich text editor |
| Email Warmup | ❌ | Need to build |
| Domain Health | ❌ | Need SPF/DKIM checks |

### Agency & Enterprise — ❌ ALL MISSING

| Module | Status |
|---|---|
| Workspaces (multi-tenant) | ❌ |
| Whitelabel | ❌ |
| Roles & Permissions | ❌ |
| Client Management Dashboard | ❌ |
| Team Invite System | ❌ |
| Audit Log | ❌ |

---

# 7. INFRASTRUCTURE GAPS

| Gap | HeyReach Has | We Have | Impact |
|---|---|---|---|
| **Dockerfile / docker-compose** | ✅ Cloud-hosted | ❌ Nothing | Can't deploy reliably |
| **CI/CD Pipeline** | ✅ Automated | ❌ No GitHub Actions | No automated testing/deploy |
| **Monitoring / APM** | ✅ | ❌ Zero | Blind to production errors |
| **Structured Logging** | ✅ | ❌ 594 `console.log`s | Can't search/filter/alert |
| **API Rate Limiting** | ✅ | ❌ None on API routes | DDoS/abuse vulnerable |
| **CORS Configuration** | ✅ | ❌ None | Cross-origin risk |
| **WebSocket / SSE** | ✅ Real-time | ❌ Polling only | Stale UI |
| **Redis Caching** | ✅ | ❌ Redis = queues only | Every read hits Postgres |
| **Real Encryption** | ✅ AES | ⚠️ Base64 (fake) | Passwords exposed in DB |
| **CDN / Static Assets** | ✅ | ❌ Next.js serves all | Slow globally |
| **Health Check Endpoint** | ✅ `/health` | ❌ Nothing | LB can't verify app |
| **Dedicated Proxies** | ✅ Built-in | ❌ BYO only | Worse UX |
| **CSRF Protection** | ✅ | ❌ None | Security vulnerability |
| **API Documentation** | ✅ Postman docs | ❌ Nothing | No public API |

---

# 8. SECURITY AUDIT

| Issue | Severity | File | Detail |
|---|---|---|---|
| **Fake encryption (base64)** | 🔴 CRITICAL | `lib/utils/encryption.ts` | LinkedIn passwords stored as base64 — NOT encrypted |
| **Hardcoded JWT secret** | 🔴 CRITICAL | `lib/db/jwt.ts` | Fallback: `reach-local-jwt-secret-change-in-production` |
| **PII leak file** | 🔴 CRITICAL | `ource .env.local` | Typo filename with real email/credentials |
| **No API rate limiting** | 🟠 HIGH | All API routes | Brute force vulnerable |
| **No CSRF protection** | 🟠 HIGH | All mutation routes | Cross-site request forgery possible |
| **594 console.log statements** | 🟡 MEDIUM | All source files | May leak sensitive data in logs |
| **Hardcoded secrets in scripts** | 🟡 MEDIUM | Multiple scripts | Need rotation + git scrub |
| **Duplicate bcrypt module** | 🟡 LOW | `lib/utils/encryption.ts` vs `lib/db/auth.ts` | Consolidate to one |

---

# 9. LINKEDIN BAN SAFETY READINESS

## 9.1 Safety Verdict: **~70% Ready**

### ✅ What Works

| Safety Layer | Implementation | Quality |
|---|---|---|
| Daily action limits | 50 conn / 100 msg / 25 InMail / 150 total | ✅ Solid |
| Weekly connection limit | 100/week rolling window | ✅ Solid |
| Warm-up ramp | Linear 5 → limit over N days | ✅ Solid |
| Random jitter | 45-120s configurable | ✅ Solid |
| Working hours | Timezone-aware, configurable | ✅ Solid |
| Human-like typing | 50-150ms per char | ✅ Solid |
| Stealth browser | Playwright + webdriver removal | ✅ Good |
| Error classification | 10+ transient patterns recognized | ✅ Excellent |
| Auto-disconnect on ban | Keyword-based detection | ✅ Good |
| Circuit breaker | Auto-pause at <15% acceptance | ✅ Unique |
| Proxy support | SOCKS5/HTTP with Playwright native | ✅ Good |

### ❌ What's Missing (Ban Risks)

| Missing Feature | Risk | Impact |
|---|---|---|
| No built-in proxy provisioning | 🔴 HIGH | Users may use datacenter IPs = instant ban |
| Hardcoded limits (not configurable) | 🔴 HIGH | New accounts need lower limits |
| No account cool-down after errors | 🟠 HIGH | Retries next day instead of backing off |
| Stub actions (view_profile/follow/like_post) | 🟠 HIGH | Warming engagement steps don't actually work |
| No scheduled health check | 🟠 HIGH | Only validates during campaign execution |
| No smart adaptive limits | 🟡 MEDIUM | Fixed limits regardless of account age/SSI |
| No browser fingerprint randomization | 🟡 MEDIUM | Same fingerprint across sessions |
| No forced profile view before connection | 🟡 MEDIUM | Connecting without viewing = suspicious |

---

# 10. GO + VUE TECH STACK (TARGET)

## 10.1 Go Backend

| Layer | Library | Why |
|---|---|---|
| **HTTP Framework** | [Fiber](https://gofiber.io/) or [Chi](https://github.com/go-chi/chi) | Fiber = fast, Express-like / Chi = stdlib-compatible |
| **Database** | [pgx](https://github.com/jackc/pgx) + [sqlc](https://sqlc.dev/) | Type-safe SQL, zero ORM overhead |
| **Migrations** | [golang-migrate](https://github.com/golang-migrate/migrate) | Same SQL files, Go runner |
| **Job Queue** | [Asynq](https://github.com/hibiken/asynq) or [River](https://github.com/riverqueue/river) | Asynq = Redis / River = Postgres |
| **Browser Automation** | [Rod](https://github.com/go-rod/rod) or [Chromedp](https://github.com/chromedp/chromedp) | Go-native headless Chrome |
| **JWT** | [golang-jwt](https://github.com/golang-jwt/jwt) | Standard |
| **Encryption** | `crypto/aes` + GCM (stdlib) | Replace base64 with real AES-256-GCM |
| **Logger** | [Zerolog](https://github.com/rs/zerolog) or [Zap](https://github.com/uber-go/zap) | Structured JSON logging |
| **Config** | [Viper](https://github.com/spf13/viper) | Env + config files |
| **Validation** | [Validator](https://github.com/go-playground/validator) | Request validation |
| **Redis** | [go-redis](https://github.com/redis/go-redis) | Cache + queue backend |
| **WebSocket** | Fiber WS or [Gorilla](https://github.com/gorilla/websocket) | Real-time updates |
| **API Docs** | [Swaggo](https://github.com/swaggo/swag) | Auto-generate OpenAPI |
| **Testing** | [Testify](https://github.com/stretchr/testify) + [GoMock](https://github.com/uber-go/mock) | Standard Go testing |
| **Rate Limiting** | [limiter](https://github.com/ulule/limiter) or Fiber built-in | API protection |
| **CORS** | Fiber/Chi built-in middleware | Security headers |

## 10.2 Vue Frontend

| Layer | Library | Why |
|---|---|---|
| **Framework** | Vue 3 + Composition API | Modern, fast |
| **Build** | Vite | Fast dev + build |
| **Router** | Vue Router 4 | Standard |
| **State** | Pinia | Official store |
| **UI Library** | Tailwind + [Headless UI](https://headlessui.com/) or [Naive UI](https://www.naiveui.com/) or [PrimeVue](https://primevue.org/) | Components |
| **CSS** | Tailwind CSS | Already used |
| **Charts** | [vue-echarts](https://github.com/ecomfe/vue-echarts) | Analytics |
| **Forms** | [VeeValidate](https://vee-validate.logaretm.com/) | Validation |
| **HTTP** | Axios or ofetch | API calls |
| **Drag & Drop** | [VueDraggable](https://github.com/SortableJS/vue.draggable.next) | Sequence builder |
| **Rich Text** | [Tiptap](https://tiptap.dev/) | Email template editor |
| **WebSocket** | Native or Socket.io-client | Real-time |

---

# 11. GO MIGRATION PLAN — 50 Modules Ranked by Priority

## Phase 1 — FOUNDATION (Weeks 1-2)

*Everything depends on these. Build first.*

| Rank | Module | Depends On | Current LOC | Go Effort |
|---|---|---|---|---|
| **#1** | Config & Environment | Nothing | ~50 | 1 day |
| **#2** | Structured Logger (Zerolog) | #1 | New | 1 day |
| **#3** | Database Layer (pgx + sqlc + pool + migrations) | #1, #2 | 630 | 3-4 days |
| **#4** | Auth & JWT (sign/verify + bcrypt + cookies) | #1, #2, #3 | 380 | 2-3 days |
| **#5** | Middleware (route protection + subscription) | #4 | 80 | 1 day |
| **#6** | Health Check Endpoint (NEW) | #3 | New | 0.5 day |

**Phase 1 Total: ~8-10 days**  
*After: Go server boots, authenticates, protects routes, logs properly.*

## Phase 2 — CORE DATA (Weeks 3-4)

*CRUD that everything else depends on.*

| Rank | Module | Depends On | Current LOC | Go Effort |
|---|---|---|---|---|
| **#7** | User Management (signup/login/forgot/reset) | #3, #4 | 220 | 2 days |
| **#8** | Encryption (AES-256-GCM — fix base64 problem) | #1 | 25→rewrite | 1 day |
| **#9** | Proxy Management (CRUD + test) | #3, #7, #8 | 180 | 2 days |
| **#10** | LinkedIn Account Management (CRUD + cookies + storage) | #3, #7, #8, #9 | 520 | 3 days |
| **#11** | Lead Lists CRUD | #3, #7 | 150 | 1 day |
| **#12** | Leads CRUD + CSV Import | #3, #7, #11 | 400 | 3 days |
| **#13** | Custom Fields | #3, #7 | 120 | 1 day |

**Phase 2 Total: ~13 days**  
*After: Users, accounts (real encryption), proxies, leads all working.*

## Phase 3 — AUTOMATION ENGINE (Weeks 5-9)

*The heart of the product.*

| Rank | Module | Depends On | Current LOC | Go Effort |
|---|---|---|---|---|
| **#14** | Redis Connection Manager | #1, #2 | 50 | 0.5 day |
| **#15** | Job Queue System (Asynq/River) | #14 | 268 | 3 days |
| **#16** | Template Engine (variables + spintax) | None | 306 | 2 days |
| **#17** | Browser Automation (Rod/Chromedp — replace Playwright) | #8, #9, #10 | 1,006 | 7-8 days |
| **#18** | Campaign CRUD (sequences, senders) | #3, #7, #10, #11, #12 | 350 | 3 days |
| **#19** | Campaign Executor (THE BIG ONE — safety + A/B + circuit breaker) | #15, #16, #17, #18 | 1,321 | 8-10 days |
| **#20** | Campaign Worker (queue processor) | #15, #19 | 235 | 2 days |
| **#21** | Implement Real Actions (view_profile/follow/like_post/email) | #17, #19 | New | 4 days |
| **#22** | Status Checker Worker | #15, #17 | 130 | 2 days |

**Phase 3 Total: ~32-35 days**  
*After: Full campaign automation with all safety rails + fixed stubs.*

## Phase 4 — COMMUNICATION (Weeks 10-11)

| Rank | Module | Depends On | Current LOC | Go Effort |
|---|---|---|---|---|
| **#23** | LinkedIn Message Scraper | #17 | 350 | 3 days |
| **#24** | Message Sync Engine | #15, #23 | 380 | 3 days |
| **#25** | Message Sync Worker (every 3 min) | #15, #24 | 180 | 1.5 days |
| **#26** | Inbox Scanner Worker (reply → stop sequence) | #15, #24, #19 | 150 | 2 days |
| **#27** | Webhooks Outbound (HMAC + retry) | #3 | 176 | 2 days |

**Phase 4 Total: ~11-12 days**  
*After: Inbox sync, reply detection, webhooks — full communication pipeline.*

## Phase 5 — NETWORK & ANALYTICS (Weeks 12-13)

| Rank | Module | Depends On | Current LOC | Go Effort |
|---|---|---|---|---|
| **#28** | Network Sync (My Network) | #17 | 450 | 3 days |
| **#29** | Account Health Check (real cron, not placeholder) | #10, #17 | 122→rewrite | 2 days |
| **#30** | Analytics Engine (stats + funnels) | #3, #18 | 200 | 3 days |
| **#31** | Accounts Service Integration (SSO) | #4 | 135 | 1 day |

**Phase 5 Total: ~9 days**  
*After: **100% current feature parity in Go.***

## Phase 6 — NEW FEATURES (Weeks 14-19)

*Beat HeyReach — none of these exist in current codebase.*

| Rank | Module | Depends On | Go Effort |
|---|---|---|---|
| **#32** | Public REST API + API Keys | #4 | 5 days |
| **#33** | API Rate Limiting | #14, #32 | 2 days |
| **#34** | WebSocket / SSE Server | #14 | 3 days |
| **#35** | Zapier / Make / n8n Triggers | #27, #32 | 4 days |
| **#36** | HubSpot CRM Sync | #12, #32 | 5 days |
| **#37** | Slack Notifications | #27 | 2 days |
| **#38** | AI Engine (reply suggestions, optimizer, scoring) | #16 | 4 days |
| **#39** | Email Sending (SMTP/SES/Resend) | #16, #19 | 4 days |
| **#40** | Email Tracking (opens/clicks) | #39 | 3 days |
| **#41** | Lead Tags + Blacklist | #12 | 2 days |
| **#42** | Sales Navigator Import | #12, #17 | 5 days |
| **#43** | Inbound Webhooks | #32 | 3 days |

**Phase 6 Total: ~42 days**  
*After: Public API, integrations, email, AI — features HeyReach charges $79-$1,999/mo for.*

## Phase 7 — ENTERPRISE (Weeks 20-24)

| Rank | Module | Depends On | Go Effort |
|---|---|---|---|
| **#44** | Multi-Tenancy / Workspaces | Everything | 8-10 days |
| **#45** | Roles & Permissions (RBAC) | #44 | 4 days |
| **#46** | Team Invite System | #44, #45 | 3 days |
| **#47** | Whitelabel (domain/logo/colors) | #44 | 4 days |
| **#48** | Audit Log | #44 | 3 days |
| **#49** | Dedicated Proxy Provisioning | #9, #32 | 4 days |
| **#50** | MCP Server | #32 | 3 days |

**Phase 7 Total: ~29-31 days**

## DevOps (Parallel Track — Start Day 1)

| # | Module | When | Effort |
|---|---|---|---|
| D1 | Dockerfile + docker-compose | Day 1 | 1 day |
| D2 | CI/CD (GitHub Actions) | After Phase 1 | 2 days |
| D3 | DB Migration CLI | With #3 | 1 day |
| D4 | CORS + CSRF + Security Headers | With #5 | 1 day |
| D5 | Prometheus + Grafana | After Phase 3 | 2 days |
| D6 | Error Tracking (Sentry) | After Phase 1 | 0.5 day |
| D7 | CDN for Static Assets | Before Vue frontend | 1 day |

**DevOps Total: ~8 days (parallel)**

---

# 12. VUE FRONTEND MIGRATION

*Do this AFTER Go backend is at Phase 5 (full parity).*

## 12.1 Pages to Migrate

| Page | Exists | New | Effort |
|---|---|---|---|
| Login | ✅ | — | 1 day |
| Signup | ✅ | — | 1 day |
| Forgot / Reset Password | ✅ | — | 1 day |
| Dashboard | ✅ | Enhance KPIs | 2 days |
| LinkedIn Accounts | ✅ | — | 2 days |
| Campaigns List | ✅ | — | 2 days |
| Campaign Detail | ✅ | — | 3 days |
| Campaign Builder (New) | ✅ | — | 4 days |
| Leads | ✅ | — | 2 days |
| Lead Lists | ✅ | — | 1 day |
| My Network | ✅ | — | 2 days |
| Unified Inbox | ✅ | — | 4 days |
| Analytics | ✅ | Enhance | 3 days |
| Profile / Settings | ✅ | — | 1 day |
| Workspace Settings | ❌ | New | 2 days |
| Team Management | ❌ | New | 2 days |
| Integrations Settings | ❌ | New | 2 days |
| API Keys Management | ❌ | New | 1 day |
| Billing / Subscription | ❌ | New | 2 days |
| Proxy Dashboard | ❌ | New | 2 days |
| Whitelabel Settings | ❌ | New | 2 days |

## 12.2 Components to Migrate

| Component | Exists | New | Effort |
|---|---|---|---|
| Sidebar Navigation | ✅ | — | 1 day |
| Connect Account Modal | ✅ | — | 1 day |
| Import Leads Modal (502 LOC) | ✅ | — | 2 days |
| Visual Sequence Builder | ✅ | — | 3 days |
| Step Editor Modal | ✅ | — | 1 day |
| Template Editor | ✅ | — | 2 days |
| OTP / Pin Verification Modals | ✅ | — | 1 day |
| Assign Proxy Modal | ✅ | — | 0.5 day |
| Lead Detail Modal | ✅ | — | 1 day |
| Connection Detail Modal | ✅ | — | 1 day |
| Funnel Chart | ✅ | — | 1 day |
| Trend Chart | ✅ | — | 1 day |
| Configure Limits Modal | ✅ | — | 0.5 day |
| Blacklist Manager | ❌ | New | 1 day |
| Tag Manager | ❌ | New | 1 day |
| API Key Generator | ❌ | New | 1 day |
| Workspace Switcher | ❌ | New | 1 day |
| Role Permission Matrix | ❌ | New | 2 days |
| Email Template Editor | ❌ | New | 3 days |
| A/B Test Results View | ❌ | New | 2 days |
| Activity Timeline | ❌ | New | 2 days |
| Real-time Notification Bell | ❌ | New | 1 day |

**Vue Frontend Total: ~40-50 days**

---

# 13. NEW FEATURES ROADMAP (Beat Competition)

## Priority Tier 1 — CRITICAL (During Go migration)

| Feature | Why | Against |
|---|---|---|
| Real view_profile action | #1 warming signal for LinkedIn | All competitors |
| Real follow action | Soft engagement reduces ban risk | All competitors |
| Real like_post action | Engagement signal | All competitors |
| AES-256-GCM encryption | LinkedIn passwords currently exposed | Security |
| User-configurable limits | New accounts need lower limits | HeyReach, Expandi |
| Scheduled health check | Currently only checks during campaigns | All competitors |
| Account cool-down | No grace period after errors | HeyReach, Expandi |

## Priority Tier 2 — COMPETITIVE PARITY

| Feature | Why | Against |
|---|---|---|
| Public REST API | Foundation for all integrations | HeyReach (full Postman docs) |
| Sales Navigator import | #1 requested feature in LinkedIn automation | All competitors |
| Lead tags + blacklist | Pipeline management essentials | All competitors |
| Step funnel analytics | Show conversion per step | HeyReach, Dripify |
| A/B test reporting UI | Backend works, need visualization | HeyReach |

## Priority Tier 3 — BEAT HEYREACH

| Feature | Why | Against |
|---|---|---|
| Zapier / Make / n8n | Automation ecosystem | HeyReach (20+ integrations) |
| HubSpot CRM sync | Enterprise sales teams | HeyReach, Expandi |
| Email multichannel | LinkedIn + email sequences | HeyReach, Skylead |
| AI reply suggestions | Smarter inbox | Nobody has this well |
| Smart adaptive limits | Account-age-based safety | Expandi |
| Slack notifications | Team awareness | HeyReach |

## Priority Tier 4 — ENTERPRISE/AGENCY

| Feature | Why | Against |
|---|---|---|
| Workspaces (multi-tenant) | Serve agencies | HeyReach core feature |
| Whitelabel | Custom branding for resellers | HeyReach Agency plan |
| Roles & permissions | Admin/Manager/VA | All enterprise tools |
| MCP Server | AI agent integration | HeyReach (new) |
| Proxy provisioning | Built-in residential proxies | HeyReach Starter plan |

---

# 14. DEAD CODE & CLEANUP

| Item | Action | File |
|---|---|---|
| Old Puppeteer automation (560 LOC) | 🗑️ DELETE | `lib/linkedin-automation.ts` |
| Backup sync file (606 LOC) | 🗑️ DELETE | `lib/linkedin-network-sync-old-backup.ts` |
| PII leak file | 🗑️ DELETE + git scrub | `ource .env.local` |
| Backup page | 🗑️ DELETE | `page.tsx.backup2` |
| Debug page | 🗑️ DELETE | `app/debug-import/` |
| Test page | 🗑️ DELETE | `app/test-infinite-login/` |
| Test API routes | 🗑️ DELETE | `app/api/test-cookie-auth/`, `app/api/test-supabase/` |
| Test file in root | 🗑️ DELETE | `simple-test.tsx` |
| Old session manager | ⚠️ REVIEW | `lib/linkedin-session-manager.ts` (462 LOC) |
| 79 loose scripts | ⚠️ TRIAGE | `scripts/` — keep operational, delete rest |
| 33 loose root files | ⚠️ MOVE | Root JS/TS/SH → `scripts/` or DELETE |
| 44 markdown docs | ⚠️ MOVE | Root MD files → `docs/` folder |
| 594 console.log statements | ⚠️ REPLACE | With structured logger |
| 494 `supabase` variable names | ⚠️ RENAME | To `db` / `client` |

---

# 15. TIMELINE SUMMARY

## Go Backend Migration

| Phase | Modules | Duration | Milestone |
|---|---|---|---|
| Phase 1 — Foundation | #1-#6 | ~10 days | Go server boots, auth works |
| Phase 2 — Core Data | #7-#13 | ~13 days | Users, accounts, leads, proxies |
| Phase 3 — Automation | #14-#22 | ~33 days | Full campaign execution |
| Phase 4 — Communication | #23-#27 | ~12 days | Inbox, reply detection, webhooks |
| Phase 5 — Network/Analytics | #28-#31 | ~9 days | **100% current parity** |
| Phase 6 — New Features | #32-#43 | ~42 days | API, integrations, email, AI |
| Phase 7 — Enterprise | #44-#50 | ~30 days | Multi-tenant, whitelabel, RBAC |
| DevOps | D1-D7 | ~8 days | Docker, CI/CD, monitoring |
| **TOTAL BACKEND** | **50 modules** | **~150-160 days** | |

## Vue Frontend Migration

| Phase | Duration | Milestone |
|---|---|---|
| Core pages (15 existing) | ~25 days | All current pages in Vue |
| New pages (7 new) | ~13 days | Workspace, team, integrations, etc. |
| Components (13 + 9 new) | ~12 days | All modals, builders, charts |
| **TOTAL FRONTEND** | **~40-50 days** | |

## Grand Total

| | Duration |
|---|---|
| Go Backend (full feature parity) | ~77 days (Phases 1-5) |
| Go Backend (beat HeyReach) | ~150 days (Phases 1-7) |
| Vue Frontend | ~45 days |
| **Everything** | **~200 days** |

## Progress Tracker

```
Current State:
  Feature parity with HeyReach:  ████████████░░░░░░░░  65%
  LinkedIn ban safety:           ██████████████░░░░░░  70%
  Infrastructure maturity:       ████████░░░░░░░░░░░░  40%

After Go Phase 5 (parity):
  Feature parity:                ██████████████████░░  90%
  Ban safety:                    ██████████████████░░  90%
  Infrastructure:                ████████████████████  100%

After Go Phase 7 + Vue:
  Feature parity:                ████████████████████  100%+
  Ban safety:                    ████████████████████  95%
  Infrastructure:                ████████████████████  100%
```

---

> **Bottom Line**: The core automation engine is solid. The migration to Go + Vue will fix all infrastructure weaknesses (encryption, logging, Docker, monitoring) while adding the 65 missing modules needed to beat HeyReach. Self-hosted + $0 cost + full source control = unbeatable competitive moat.
