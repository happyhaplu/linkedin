# Reach — Product Module Map

> **Purpose**: High-level module overview for Go + Vue rewrite  
> **Date**: 16 March 2026  
> **Legend**: ✅ Exists in current codebase | ⚠️ Partially done | ❌ Need to build (for competition)

---

## BACKEND MODULES (Migrate to Go)

---

### 1. Auth & User Management

| Module | Current | Needed |
|---|---|---|
| Email/Password Signup & Login | ✅ | — |
| JWT Token System | ✅ | — |
| Forgot / Reset Password | ✅ | — |
| Session Management (HTTP-only cookie) | ✅ | — |
| External SSO (Accounts Service) | ✅ | — |
| Roles & Permissions (Admin/Manager/VA) | ❌ | Yes |
| Team Invite System | ❌ | Yes |
| API Key Authentication | ❌ | Yes |
| Rate Limiting (Auth endpoints) | ❌ | Yes |
| CSRF Protection | ❌ | Yes |

---

### 2. LinkedIn Account Management

| Module | Current | Needed |
|---|---|---|
| Account CRUD (add/edit/remove accounts) | ✅ | — |
| Cookie Auth (li_at + JSESSIONID) | ✅ | — |
| Credential Login (email + password fallback) | ✅ | — |
| 2FA / OTP Handling | ⚠️ | Improve — auto-complete |
| Proxy Assignment Per Account | ✅ | — |
| Profile Data Extraction & Re-sync | ✅ | — |
| Auto-disconnect on Ban/Restriction | ✅ | — |
| Transient vs Auth Error Classification | ✅ | — |
| Scheduled Session Health Check (Cron) | ❌ | Yes — every 4-6h |
| User-Configurable Daily Limits Per Account | ❌ | Yes |
| Account Cool-down System | ❌ | Yes |
| Smart Adaptive Limits (account age/SSI based) | ❌ | Yes |
| SSI Score Monitoring | ❌ | Yes |
| Built-in Residential Proxy Provisioning | ❌ | Yes |
| Account Warmup Mode (standalone, not campaign) | ❌ | Yes |

---

### 3. Campaign Engine

| Module | Current | Needed |
|---|---|---|
| Campaign CRUD | ✅ | — |
| Campaign Start / Pause / Resume / Stop | ✅ | — |
| Multi-step Sequence Execution | ✅ | — |
| If/Then Conditional Logic (accepted/replied) | ✅ | — |
| A/B Message Testing (variant assignment) | ✅ | — |
| Template Engine (variable substitution) | ✅ | — |
| Working Hours Scheduling (timezone-aware) | ✅ | — |
| Working Days Selection | ✅ | — |
| Random Jitter Delays (45-120s) | ✅ | — |
| Warm-up Ramp (linear 5→limit) | ✅ | — |
| Daily Action Limits (per action type) | ✅ | — |
| Weekly Connection Limit (100/week) | ✅ | — |
| Circuit Breaker (auto-pause on low acceptance) | ✅ | — |
| Sender Round-Robin Distribution | ✅ | — |
| Skip Already-Contacted Leads | ✅ | — |
| Campaign Export (CSV) | ✅ | — |
| Campaign Prioritization | ❌ | Yes |
| Smart Sender Rotation (weighted by limit remaining) | ❌ | Yes |
| Campaign Cloning / Duplication | ❌ | Yes |
| Campaign Templates Library | ❌ | Yes |

---

### 4. LinkedIn Automation Actions

| Module | Current | Needed |
|---|---|---|
| Send Connection Request | ✅ | — |
| Send Direct Message | ✅ | — |
| Send InMail | ✅ | — |
| Delay Step | ✅ | — |
| Check Connection Status | ✅ | — |
| Auto-accept Incoming Invites | ✅ | — |
| View Profile | ⚠️ Stub | Yes — implement real action |
| Follow Profile | ⚠️ Stub | Yes — implement real action |
| Like Post | ⚠️ Stub | Yes — implement real action |
| Send Email (in sequence) | ⚠️ Stub | Yes — wire up SMTP |
| Endorse Skills | ❌ | Yes |
| Comment on Post | ❌ | Yes |
| Send Voice Note | ❌ | Yes |
| Browser Fingerprint Randomization | ❌ | Yes |

---

### 5. AI Engine

| Module | Current | Needed |
|---|---|---|
| AI Icebreaker Generation (GPT-4o-mini) | ✅ | — |
| AI Message Rewriter / Optimizer | ❌ | Yes |
| AI Post Comment Generator | ❌ | Yes |
| AI Lead Scoring | ❌ | Yes |
| AI Reply Suggestions (in Unibox) | ❌ | Yes |

---

### 6. Lead Management

| Module | Current | Needed |
|---|---|---|
| Lead CRUD | ✅ | — |
| Lead Lists CRUD | ✅ | — |
| CSV Import with Field Mapping | ✅ | — |
| Custom Fields | ✅ | — |
| Lead Deduplication (cross-campaign) | ✅ | — |
| Add Lead from Connection | ✅ | — |
| Import from Sales Navigator | ❌ | Yes — #1 requested |
| Import from LinkedIn Search URL | ❌ | Yes |
| Lead Tags (hot/cold/custom) | ❌ | Yes |
| Lead Scoring | ❌ | Yes |
| Blacklist / Blocklist | ❌ | Yes |
| Email Finder / Enrichment | ❌ | Yes |
| Lead Activity Timeline | ❌ | Yes |

---

### 7. Unified Inbox (Unibox)

| Module | Current | Needed |
|---|---|---|
| Inbox Message Scraping (Playwright) | ✅ | — |
| Message Sync (LinkedIn ↔ DB) | ✅ | — |
| Reply Detection (auto-stop sequence) | ✅ | — |
| Inbox Scanner (background worker) | ✅ | — |
| Conversation Tags | ❌ | Yes |
| Message Read/Unread Status | ❌ | Yes |
| Attachment Handling | ❌ | Yes |
| Voice Note Sending | ❌ | Yes |
| Reply on Behalf of Teammates | ❌ | Yes |
| Inbox Privacy Settings Per Account | ❌ | Yes |
| AI Reply Suggestions | ❌ | Yes |

---

### 8. My Network (Connection Sync)

| Module | Current | Needed |
|---|---|---|
| Sync LinkedIn Connections to DB | ✅ | — |
| Network CRUD & Search | ✅ | — |
| Connection Detail View | ✅ | — |

> This module is **complete**. No gaps.

---

### 9. Proxy Management

| Module | Current | Needed |
|---|---|---|
| Proxy CRUD | ✅ | — |
| Proxy Testing (connectivity check) | ✅ | — |
| Proxy Assignment to Account | ✅ | — |
| SOCKS5 + HTTP Support | ✅ | — |
| Auto-provision Residential Proxies (provider API) | ❌ | Yes |
| Proxy Health Dashboard (latency/uptime) | ❌ | Yes |

---

### 10. Webhooks

| Module | Current | Needed |
|---|---|---|
| Outbound Webhooks (6 event types) | ✅ | — |
| HMAC-SHA256 Signature | ✅ | — |
| 3x Retry with Exponential Backoff | ✅ | — |
| Delivery Logging | ✅ | — |
| Webhook Management UI/API | ⚠️ | Improve |
| Inbound Webhooks (receive triggers from external tools) | ❌ | Yes |

---

### 11. Job Queue & Workers

| Module | Current | Needed |
|---|---|---|
| Campaign Job Queue | ✅ | — |
| Message Sync Job Queue | ✅ | — |
| Campaign Worker | ✅ | — |
| Inbox Scanner Worker | ✅ | — |
| Status Checker Worker | ✅ | — |
| Worker Manager (lifecycle) | ✅ | — |
| Queue Dashboard (Bull Board) | ✅ | — |
| Dead Letter Queue Handling | ❌ | Yes |
| Queue Metrics / Observability | ❌ | Yes |

> **Go Note**: Replace BullMQ/Redis with Go-native solution — [Asynq](https://github.com/hibiken/asynq) (Redis-based, Go) or [River](https://github.com/riverqueue/river) (Postgres-based, Go). Both are production-ready.

---

### 12. Analytics Engine

| Module | Current | Needed |
|---|---|---|
| Campaign Stats (sent/accepted/replied) | ✅ | — |
| Per-sender Performance Tracking | ✅ | — |
| Campaign Export CSV | ✅ | — |
| A/B Test Results Reporting | ❌ | Yes |
| Step-by-step Funnel Analytics | ❌ | Yes |
| Team Analytics | ❌ | Yes |
| Sender Comparison Report | ❌ | Yes |
| Meetings Booked / ROI Tracking | ❌ | Yes |

---

### 13. Integrations

| Module | Current | Needed |
|---|---|---|
| Public REST API (documented) | ❌ | Yes — top priority |
| Zapier | ❌ | Yes |
| Make (Integromat) | ❌ | Yes |
| n8n | ❌ | Yes |
| HubSpot CRM Sync | ❌ | Yes |
| Salesforce Sync | ❌ | Yes |
| Pipedrive Sync | ❌ | Yes |
| Clay | ❌ | Yes |
| Instantly / Smartlead (multichannel) | ❌ | Yes |
| Slack Notifications | ❌ | Yes |
| MCP Server | ❌ | Yes |

> **All 11 integration modules are missing.** This is the biggest gap vs HeyReach.

---

### 14. Multichannel (Email)

| Module | Current | Needed |
|---|---|---|
| Email Step Type (schema only) | ⚠️ | — |
| Email Sending (SMTP / Resend / SES) | ❌ | Yes |
| Email Tracking (opens/clicks) | ❌ | Yes |
| Email Template Builder | ❌ | Yes |
| Email Warmup | ❌ | Yes |
| Domain Health (SPF/DKIM/DMARC) | ❌ | Yes |

---

### 15. Agency & Enterprise

| Module | Current | Needed |
|---|---|---|
| Workspaces (multi-tenant) | ❌ | Yes |
| Whitelabel (domain/logo/colors) | ❌ | Yes |
| Roles & Permissions | ❌ | Yes |
| Client Management Dashboard | ❌ | Yes |
| Team Invite System | ❌ | Yes |
| Audit Log | ❌ | Yes |

---

### 16. Security

| Module | Current | Needed |
|---|---|---|
| Password Hashing (bcrypt) | ✅ | — |
| JWT System | ✅ | — |
| Webhook HMAC Signing | ✅ | — |
| LinkedIn Credential Encryption | ⚠️ | Fix — currently base64, need AES-256-GCM |
| API Rate Limiting | ❌ | Yes |
| CSRF Protection | ❌ | Yes |
| IP-based Login Alerts | ❌ | Yes |
| Audit Trail | ❌ | Yes |

---

### 17. Database

| Module | Current | Needed |
|---|---|---|
| Connection Pooling | ✅ | — |
| Query Builder | ✅ | — |
| Migrations | ✅ | — |
| Atomic Counter RPCs | ✅ | — |

> **Go Note**: Use [pgx](https://github.com/jackc/pgx) for Postgres + [golang-migrate](https://github.com/golang-migrate/migrate) for migrations. Replace custom query builder with [sqlc](https://sqlc.dev/) (type-safe SQL) or [GORM](https://gorm.io/).

---

## FRONTEND MODULES (Migrate to Vue)

---

### 18. Pages

| Page | Current | Needed |
|---|---|---|
| Login | ✅ | — |
| Signup | ✅ | — |
| Forgot Password | ✅ | — |
| Reset Password | ✅ | — |
| Dashboard | ✅ | Enhance with more KPIs |
| LinkedIn Accounts | ✅ | — |
| Campaigns List | ✅ | — |
| Campaign Detail | ✅ | — |
| Campaign Builder (New) | ✅ | — |
| Leads | ✅ | — |
| Lead Lists | ✅ | — |
| My Network | ✅ | — |
| Unified Inbox | ✅ | — |
| Analytics | ✅ | Enhance |
| Profile / Settings | ✅ | — |
| Workspace Settings | ❌ | Yes |
| Team Management | ❌ | Yes |
| Integrations Settings | ❌ | Yes |
| API Keys Management | ❌ | Yes |
| Billing / Subscription | ❌ | Yes |
| Proxy Dashboard | ❌ | Yes |
| Whitelabel Settings | ❌ | Yes |

---

### 19. UI Components

| Component | Current | Needed |
|---|---|---|
| Sidebar Navigation | ✅ | — |
| Connect Account Modal | ✅ | — |
| Import Leads Modal | ✅ | — |
| Visual Sequence Builder | ✅ | — |
| Step Editor Modal | ✅ | — |
| Template Editor | ✅ | — |
| OTP / Pin Verification Modals | ✅ | — |
| Assign Proxy Modal | ✅ | — |
| Lead Detail Modal | ✅ | — |
| Connection Detail Modal | ✅ | — |
| Funnel Chart | ✅ | — |
| Trend Chart | ✅ | — |
| Configure Limits Modal | ✅ | — |
| Blacklist Manager | ❌ | Yes |
| Tag Manager | ❌ | Yes |
| API Key Generator | ❌ | Yes |
| Workspace Switcher | ❌ | Yes |
| Role Permission Matrix | ❌ | Yes |
| Email Template Editor | ❌ | Yes |
| A/B Test Results View | ❌ | Yes |
| Activity Timeline | ❌ | Yes |
| Real-time Notification Bell | ❌ | Yes |

---

## QUICK COUNT

| | ✅ Done | ⚠️ Partial | ❌ Missing |
|---|---|---|---|
| **Backend** | 73 | 7 | 65 |
| **Frontend Pages** | 15 | 0 | 7 |
| **Frontend Components** | 13 | 0 | 9 |
| **TOTAL** | **101** | **7** | **81** |

---

## GO BACKEND — RECOMMENDED TECH STACK

| Layer | Recommended | Why |
|---|---|---|
| **HTTP Framework** | [Fiber](https://gofiber.io/) or [Chi](https://github.com/go-chi/chi) | Fiber = fast + Express-like / Chi = stdlib-compatible |
| **Database** | [pgx](https://github.com/jackc/pgx) + [sqlc](https://sqlc.dev/) | Type-safe SQL, no ORM overhead |
| **Migrations** | [golang-migrate](https://github.com/golang-migrate/migrate) | Same migration files, Go runner |
| **Job Queue** | [Asynq](https://github.com/hibiken/asynq) (Redis) or [River](https://github.com/riverqueue/river) (Postgres) | Replace BullMQ |
| **Browser Automation** | [Rod](https://github.com/go-rod/rod) or [Chromedp](https://github.com/chromedp/chromedp) | Go-native headless Chrome (replace Playwright) |
| **JWT** | [golang-jwt](https://github.com/golang-jwt/jwt) | Standard |
| **Encryption** | `crypto/aes` + GCM (stdlib) | Replace base64 fake encryption |
| **Logger** | [Zerolog](https://github.com/rs/zerolog) or [Zap](https://github.com/uber-go/zap) | Replace 594 console.logs |
| **Config** | [Viper](https://github.com/spf13/viper) | Env + config file management |
| **Validation** | [Validator](https://github.com/go-playground/validator) | Request validation |
| **Redis** | [go-redis](https://github.com/redis/go-redis) | Cache + queue backend |
| **WebSocket** | Fiber WebSocket or [Gorilla](https://github.com/gorilla/websocket) | Real-time inbox updates |
| **API Docs** | [Swaggo](https://github.com/swaggo/swag) | Auto-generate Swagger/OpenAPI docs |
| **Testing** | [Testify](https://github.com/stretchr/testify) + [GoMock](https://github.com/uber-go/mock) | Standard Go testing |

---

## VUE FRONTEND — RECOMMENDED TECH STACK

| Layer | Recommended | Why |
|---|---|---|
| **Framework** | Vue 3 + Composition API | Modern, fast |
| **Build** | Vite | Fast dev + build |
| **Router** | Vue Router 4 | Standard |
| **State** | Pinia | Official Vue store |
| **UI Library** | [Naive UI](https://www.naiveui.com/) or [PrimeVue](https://primevue.org/) or Tailwind + [Headless UI](https://headlessui.com/) | Component library |
| **CSS** | Tailwind CSS | Already used, easy migration |
| **Charts** | [Apache ECharts](https://echarts.apache.org/) via [vue-echarts](https://github.com/ecomfe/vue-echarts) | Analytics charts |
| **Forms** | [VeeValidate](https://vee-validate.logaretm.com/) | Form validation |
| **HTTP** | Axios or ofetch | API calls |
| **Drag & Drop** | [VueDraggable](https://github.com/SortableJS/vue.draggable.next) | For sequence builder |
| **Rich Text** | [Tiptap](https://tiptap.dev/) | Email template editor |
| **WebSocket** | Native or Socket.io-client | Real-time updates |

---

## MIGRATION PRIORITY ORDER

### Phase 1 — Core (Weeks 1-4)
1. Auth & User Management
2. Database Layer
3. LinkedIn Account Management
4. Campaign Engine
5. LinkedIn Automation Actions (implement real view_profile/follow/like_post)

### Phase 2 — Features (Weeks 5-8)
6. Lead Management (+ Sales Nav import, tags, blacklist)
7. Unified Inbox
8. Job Queue & Workers
9. Analytics Engine (+ A/B reporting, funnels)
10. Proxy Management

### Phase 3 — Growth (Weeks 9-12)
11. Public REST API + API Docs
12. Integrations (Zapier, HubSpot, Slack)
13. AI Engine (expand beyond icebreakers)
14. Multichannel Email
15. Webhooks (+ inbound)

### Phase 4 — Enterprise (Weeks 13-16)
16. Workspaces / Multi-tenant
17. Whitelabel
18. Roles & Permissions
19. Security Hardening
20. Audit Log
