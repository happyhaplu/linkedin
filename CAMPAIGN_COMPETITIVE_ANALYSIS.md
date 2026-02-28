# Campaign Module — Competitive Analysis & 10x Design Blueprint
> Last updated: 19 February 2026

---

## Table of Contents
1. [Competitor Campaign Module Breakdown](#1-competitor-campaign-module-breakdown)
2. [Our Campaign Engine Audit](#2-our-campaign-engine-audit)
3. [Architecture Gap Analysis](#3-architecture-gap-analysis)
4. [10x Campaign Module Design](#4-10x-campaign-module-design)
5. [UX Design Principles](#5-ux-design-principles)
6. [Priority Roadmap](#6-priority-roadmap)
7. [Positioning Statement](#7-positioning-statement)

---

## 1. Competitor Campaign Module Breakdown

### 🟡 HeyReach — Agency-Grade Multi-Sender

| Dimension | Detail |
|-----------|--------|
| **Builder Style** | Linear step list — ordered cards, modal editor per step, no drag-and-drop |
| **Step Types** | Connection request (with/without note), message, InMail, profile view, follow, like post, wait/delay |
| **Safety Controls** | Per-sender daily limits, global account-level caps. No working-hours scheduling. No warm-up mode |
| **Personalization** | `{{firstName}}`, `{{lastName}}`, `{{company}}`, `{{position}}` — no spintax, no AI |
| **A/B Testing** | None natively. Workaround: duplicate campaign manually |
| **Inbox Integration** | Unified inbox across all senders. Auto-pause on reply (stop-on-reply toggle per campaign) |
| **Analytics** | Per-campaign funnel: sent → accepted → messaged → replied. Per-sender breakdown. Acceptance rate %, reply rate % |
| **Team/Agency** | Multi-sender per campaign (up to 1000 accounts), workspaces, role-based access (admin/user), white-label |
| **UX Simplicity** | Clean UI. Minimal onboarding wizard. Assumes technical knowledge |

**Strengths:** Unmatched multi-sender scale, API-first (Clay/Apollo/n8n), most trusted agency brand  
**Weaknesses:** $79/seat (agencies spend $1000+/mo), no proxy management, no AI personalization, no email fallback, no A/B testing

---

### 🟠 SalesRobot — AI-First Sales Outreach

| Dimension | Detail |
|-----------|--------|
| **Builder Style** | Visual linear flow with drag handles. Step cards show previews. Conditional branches as split paths |
| **Step Types** | Connection request, follow-up messages (×3), profile view, InMail, email (multi-channel in one flow) |
| **Safety Controls** | Smart delay ranges (min/max randomization), working-hours window per campaign. No warm-up |
| **Personalization** | `{{firstName}}` variables + **GPT-powered AI icebreaker per lead** (pulls from headline/company). "Magic write" button |
| **A/B Testing** | Message variant A vs B per step. 50/50 split. Win condition: reply rate after 7 days |
| **Inbox Integration** | Unified inbox, reply detection, auto-pause. Reply classification: Interested / Not Interested / Out of office |
| **Analytics** | Funnel chart, per-step conversion rates, reply sentiment breakdown, A/B test winner card |
| **Team/Agency** | Shared inbox, team campaign assignment. No white-label |
| **UX Simplicity** | Best-in-class onboarding wizard. Guided "Create your first campaign" modal. Rich empty states |

**Strengths:** GPT personalization at scale, multi-channel (email + LinkedIn in one flow), strong CRM integrations  
**Weaknesses:** Shallower automation (fewer step types), no proxy management, cluttered UI, no agency/white-label

---

### 🔵 Aimfox — Safety-First with Dedicated IPs

| Dimension | Detail |
|-----------|--------|
| **Builder Style** | **Visual drag-and-drop flow builder** — nodes connected by arrows, branch paths drawn visually |
| **Step Types** | Connection request, message, InMail, profile view, like post, wait node, end node |
| **Safety Controls** | Per-account daily limit, **dedicated residential IP per account** (bundled — their #1 differentiator), randomized send window. No warm-up |
| **Personalization** | `{{firstName}}`, `{{company}}` variables. No spintax. No AI |
| **A/B Testing** | A/B on connection note and first message. Shows acceptance/reply rate per variant |
| **Inbox Integration** | No unified inbox (major gap). Reply detection exists but no inbox view |
| **Analytics** | Conversion funnel, per-step breakdown, A/B test report, acceptance/reply rate trends |
| **Team/Agency** | Team member invite, campaign sharing. No white-label |
| **UX Simplicity** | Good onboarding. Visual builder significantly reduces learning curve |

**Strengths:** Dedicated IP per account (key safety moat), visual builder is genuinely easy, competitive pricing, A/B testing  
**Weaknesses:** No unified inbox, fewer step types, weak warm-up, API only on higher tiers, no email channel

---

### 🟢 Dripify — Mass-Market Best UX

| Dimension | Detail |
|-----------|--------|
| **Builder Style** | **Linear visual drip builder** — step cards with `+` between them, type picker modal, delays shown inline |
| **Step Types** | Connection request, message, InMail, profile view, follow, like/comment post, withdraw request, email (via integration) |
| **Safety Controls** | Smart random delays (user-defined min/max), **profile warm-up mode** (ramp over N days), **working-hours scheduler** (set active hours per day) |
| **Personalization** | `{{firstName}}`, `{{lastName}}`, `{{company}}`, `{{position}}`, custom variables. No AI. Spintax-like syntax |
| **A/B Testing** | A/B per message step. Automatic winner after statistical significance. Per-variant funnel |
| **Inbox Integration** | Shared team inbox, reply detection, auto-pause. Conversation thread view per lead |
| **Analytics** | **Best in market**: per-campaign funnel, daily chart, acceptance rate trend, reply rate by step, team leaderboard |
| **Team/Agency** | Shared workspace, team inbox, campaign templates, basic role management |
| **UX Simplicity** | **Best UX in market** — tooltips on hover, empty states with CTAs, template library for quick start |

**Strengths:** Best onboarding + UX, built-in email finder, smart random delays, affordable starter tier ($39/mo)  
**Weaknesses:** **Browser extension = must keep Chrome open** (biggest user complaint), no API on base plan, no proxy management, limited multi-sender

---

## 2. Our Campaign Engine Audit

### ✅ What We Have (Strengths)

#### Infrastructure — Ahead of All Competitors
- **BullMQ + Redis with 6 dedicated queues**: `campaign-processor`, `connection-sender`, `message-sender`, `inmail-sender`, `status-checker`, `inbox-scanner` — more granular than any competitor
- **3 independent workers**: campaign worker (concurrency: 5), status checker (concurrency: 3), inbox scanner — all with graceful SIGTERM shutdown
- **Job retry with exponential backoff**: 3 attempts, 5s → 10s → 20s
- **Job ID deduplication**: `campaign-${campaign_id}-lead-${lead_id}-step-${step_id}` prevents duplicate sends
- **Job retention**: completed 24h/1000 jobs, failed 7 days
- **Real Playwright automation**: `sendConnectionRequestViaLinkedIn`, `sendMessageViaLinkedIn`, `sendInMailViaLinkedIn` all wired

#### Logic — Solid
- **Stop-on-reply**: checks `replied_at` before every step execution
- **Campaign status guard**: verifies `status === 'active'` before processing
- **Daily limit check**: `checkDailyLimit()` per sender account
- **Re-queue on limit**: reschedules to tomorrow when daily limit hit
- **Full step type set** (7 types): `follow`, `like_post`, `connection_request`, `message`, `inmail`, `view_profile`, `email` — most complete in class
- **Conditional branching**: `condition_type` (`accepted`, `not_accepted`, `replied`, `not_replied`) with `parent_step_id` tree structure — more conditions than most competitors
- **4-step creation wizard**: basic → senders → workflow → review already exists
- **Template engine**: spintax `{A|B|C}` + `{{firstName}}` variable replacement with character limit validation

### ❌ What's Missing (Gaps)

| Gap | Current State | What's Needed |
|-----|--------------|---------------|
| **Randomized delays** | `calculateDelay()` returns exact fixed ms | Gaussian-distributed random jitter ±20–40% |
| **Working-hours scheduling** | None — jobs fire at any time of day/night | `working_hours_start`, `working_hours_end` per campaign, check before queuing |
| **Account warm-up** | No concept of ramp mode | New accounts capped at 5/day, linear ramp to full limit over 14 days |
| **Per-action inter-delay** | No gap between individual Playwright actions | 45–120s random sleep between each action for same sender |
| **Analytics UI** | All data exists in DB — zero frontend | Campaign funnel, rates, charts |
| **A/B testing** | No variant field, no split logic | `variant` on `campaign_leads`, 50/50 split at assignment, per-variant analytics |
| **AI icebreaker** | No GPT call | One GPT-4o-mini call per lead on campaign start, cache in `ai_icebreaker` column |
| **Spintax UI helper** | Engine exists, no UI | Inline `{Option1|Option2}` helper button in template editor |
| **Variable picker UI** | No UI helper for `{{firstName}}` | Clickable token chips above template textarea |
| **Visual step builder** | Numbered form cards. No drag handles | Step cards with `+` buttons, drag-to-reorder |
| **Template preview** | No live preview | Render template with sample lead data |
| **Empty state** | Blank table on no campaigns | Illustrated empty state with "Create Campaign" CTA |
| **Onboarding wizard** | No guided flow for new users | First-time wizard with pre-built templates |
| **Auto-pause on low acceptance** | No safety circuit breaker | Daily cron: if acceptance rate < 15%, auto-pause campaign |
| **Skip already-contacted leads** | No deduplication across campaigns | Flag to skip leads already in other active campaigns |

---

## 3. Architecture Gap Analysis

| Area | Our Architecture | vs Competitors |
|------|-----------------|----------------|
| **Queue reliability** | BullMQ + Redis (enterprise-grade, jobs survive restart) | ✅ **We win** — Dripify loses jobs when browser closes |
| **Worker isolation** | 3 dedicated workers, graceful shutdown | ✅ **We win** — HeyReach comparable, others weaker |
| **Step type breadth** | 7 types including `email` | ✅ **We win** — Aimfox 7, Dripify 8, SalesRobot 6 |
| **Conditional branching** | 4 conditions with `parent_step_id` tree | ✅ **We win** — Dripify has 2, HeyReach has 3 |
| **Smart delays** | Fixed ms calculation only | ❌ **We lose** — Dripify has randomized min/max, SalesRobot has working hours |
| **Analytics** | Zero UI (data exists in DB) | ❌ **We lose badly** — all competitors have full funnel analytics |
| **A/B testing** | Not implemented | ❌ **We lose** — Dripify and Aimfox both have this |
| **AI personalization** | Not implemented | ❌ **We lose** — SalesRobot's core feature |
| **Visual builder** | Form-based step cards | ❌ **We lose** — Aimfox has drag-and-drop, Dripify has visual linear |
| **Warm-up mode** | Not implemented | ❌ **We lose** — Dripify has this, critical for new account safety |

---

## 4. 10x Campaign Module Design

### Feature I — Smart Campaign Builder (Visual Linear with Drag-to-Reorder)

```
┌─────────────────────────────────────────────────────────────────┐
│  Campaign: "Q1 SaaS Founders Outreach"                          │
│  ● Active   Leads: 142   Acceptance: 38%   Replies: 12%         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────┐            │
│  │ ⋮⋮  Step 1 — 👋 Connection Request   [Edit] [×] │            │
│  │     Message: "Hi {{firstName}}, I noticed..."   │            │
│  │     🤖 AI Icebreaker: ON    [A/B: 2 variants]   │            │
│  └─────────────────────────────────────────────────┘            │
│                         │                                       │
│              ┌──────────┴──────────┐                            │
│         [✅ Accepted]         [⏳ Not accepted]                   │
│              │                     │                            │
│  ┌───────────────────┐   ┌───────────────────────┐              │
│  │ ⋮⋮  Step 2A       │   │ ⋮⋮  Step 2B           │              │
│  │  💬 Message       │   │  📨 InMail (fallback)  │              │
│  │  Wait: 2 days     │   │  Wait: 3 days          │              │
│  └───────────────────┘   └───────────────────────┘              │
│              │                                                   │
│           [+ Add Step]                                          │
└─────────────────────────────────────────────────────────────────┘
```

**Key UX elements:**
- Drag handle (`⋮⋮`) on each card — drag to reorder
- `+` button between every step, not just at the bottom
- Branching drawn visually inline, not hidden in a `parent_step_id` field
- Delay shown on the card: "Wait 2 days after previous step"
- Live lead count badge on each step in active campaigns: "14 leads at this step"

---

### Feature II — Inline Template Editor with Variable Picker + Spintax + AI

```
┌─────────────────────────────────────────────────────────────────┐
│  Message Template                              [A/B] [Preview]  │
│                                                                 │
│  Variables: [{{firstName}}] [{{company}}] [{{position}}]        │
│             [{{location}}] [{{aiIcebreaker}}] [+ Custom]        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Hi {{firstName}},                                         │  │
│  │                                                           │  │
│  │ {{aiIcebreaker}}                                          │  │
│  │                                                           │  │
│  │ I help {SaaS founders|B2B sales teams|growth teams} at    │  │
│  │ companies like yours...                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  Characters: 284/300  ⚡ Spintax: 3 variants detected           │
│                                                                 │
│  [✨ Generate AI Icebreaker]  [Preview with Sample Lead]        │
└─────────────────────────────────────────────────────────────────┘
```

**AI Icebreaker Implementation:**
- One GPT-4o-mini call per lead on campaign start
- Prompt: `"Generate a 1-sentence personalized icebreaker for {{fullName}}, {{position}} at {{company}} in {{location}}."`
- Cache result in `leads.ai_icebreaker` column
- Expose as `{{aiIcebreaker}}` variable in any template
- Cost: ~$0.0001 per lead (100,000 leads = $10)

---

### Feature III — Safety Controls Panel (per Campaign)

```
┌─── Safety & Scheduling ────────────────────────────────────────┐
│                                                                 │
│  📅 Working Hours                                               │
│  Mon–Fri  [08:00] to [18:00]  Timezone: [Asia/Kolkata ▼]       │
│                                                                 │
│  ⏱️  Delay Between Actions                                       │
│  Min: [45] seconds   Max: [120] seconds  (randomized)          │
│                                                                 │
│  📈 Account Warm-up Mode                                        │
│  [✅ Enable]  Ramp from 5/day to full limit over [14] days      │
│                                                                 │
│  🔴 Account Safety Circuit Breakers                             │
│  [✅ Auto-pause if acceptance rate drops below] [15] %          │
│  [✅ Stop sequence on reply]                                     │
│  [✅ Skip leads already contacted in other campaigns]            │
└─────────────────────────────────────────────────────────────────┘
```

**Backend changes required:**
- Add `working_hours_start`, `working_hours_end`, `working_days` to `campaigns` table
- Add `delay_min_seconds`, `delay_max_seconds` to `campaigns` table (replaces fixed delay)
- Add `warm_up_enabled`, `warm_up_days` to `campaigns` table
- In `campaign-executor.ts`: before queuing job, check if current time is within working hours
- In `campaign-worker.ts`: add `Math.random()` jitter to inter-action sleep

---

### Feature IV — A/B Testing

**Schema change:**
```sql
ALTER TABLE campaign_leads ADD COLUMN variant TEXT DEFAULT 'A'; -- 'A' or 'B'
ALTER TABLE campaign_sequences ADD COLUMN message_template_b TEXT;
ALTER TABLE campaign_sequences ADD COLUMN ab_test_enabled BOOLEAN DEFAULT FALSE;
```

**Logic:**
1. On campaign start, assign leads alternately: even index → Variant A, odd index → Variant B
2. Executor reads `campaign_lead.variant` to pick `message_template` vs `message_template_b`
3. Analytics aggregate per variant: acceptance rate A vs B, reply rate A vs B
4. "Declare Winner" button sets `ab_test_winner = 'A'|'B'`, pauses losing variant routing

**UI:**
```
Step 2 — Message
  [A/B Test: ON]
  
  Variant A (71 leads)              Variant B (71 leads)
  ┌──────────────────────┐          ┌──────────────────────┐
  │ Hi {{firstName}},    │          │ Hey {{firstName}},   │
  │ I saw your work at   │          │ Loved your post on   │
  │ {{company}}...       │          │ {{company}}...       │
  └──────────────────────┘          └──────────────────────┘
  Reply rate: 14%                   Reply rate: 9%
                    [🏆 Declare A Winner]
```

---

### Feature V — Analytics Dashboard (per Campaign)

```
Campaign: Q1 SaaS Founders Outreach

 Funnel (All Time)          Today's Activity        7-Day Trend
 ─────────────────           ────────────────        ─────────────
 Total Leads   142           Connections Sent  12    ▂▄▆▇█▇▅
 Sent           98  69%      Messages Sent      6    Acceptance
 Accepted       37  38%      Replies Received   2    rate trend
 Messaged       31  84%
 Replied        12  12%      Daily Limit: 12/50

 Per-Step Breakdown:
 ┌──────────────────┬────────┬──────────┬──────────┐
 │ Step             │ Sent   │ Converted│ Rate     │
 ├──────────────────┼────────┼──────────┼──────────┤
 │ 1. Connect       │    98  │    37    │   38%    │
 │ 2A. Message      │    31  │    12    │   39%    │
 │ 2B. InMail       │    19  │     4    │   21%    │
 └──────────────────┴────────┴──────────┴──────────┘
```

**Data sources (all already in DB):**
- `campaign_leads` → status, timestamps → funnel
- `campaign_activity_logs` → per-step counts → step breakdown
- `campaign_senders` → per-sender stats → sender leaderboard

---

### Feature VI — Onboarding & Empty State

**Zero campaigns state:**
```
        [Illustration: rocket launching]
        
        No campaigns yet
        Create your first outreach campaign
        and start connecting with leads automatically.
        
        [🚀 Create Campaign]  [📋 Use a Template]
```

**Quick-start templates (pre-built):**
1. **Cold Outreach** — Connect → (if accepted) Message Day 2 → Follow-up Day 5
2. **Warm Follow-up** — View Profile → Connect with note → Message Day 3
3. **Recruiter Sequence** — Connect → InMail Day 1 → Message Day 4 → Follow-up Day 7

**First-campaign guided tooltips (after launch):**
- Tooltip 1: "Your campaign is running 24/7 in the cloud — no need to keep your browser open"
- Tooltip 2: "This is your funnel — track how many leads converted at each step"
- Tooltip 3: "Set working hours so messages send during business hours in your target timezone"

---

## 5. UX Design Principles

1. **One decision per screen** — The 4-step wizard follows this. Each step has one primary action and one optional secondary. No overwhelming forms.

2. **Show don't tell for safety** — Instead of a bare "Daily limit" input, show: *"12 actions sent today / 50 limit — LinkedIn recommends staying under 50 to avoid restrictions."* The constraint becomes a helpful feature.

3. **Data at a glance** — Campaign cards show 3-number funnel inline: `98 sent → 37 accepted → 12 replied`. No drilling required to know if a campaign is working.

4. **Progressive disclosure** — Basic settings visible, advanced safety controls behind `▼ Advanced Settings`. Expert users find everything; beginners aren't overwhelmed.

5. **Inline validation, not submit-then-fail** — Character counter updates live. Warn before saving if template would exceed limit after variable substitution (using sample lead data).

6. **Reversible actions** — Pause = one click, no confirmation. Delete = confirmation dialog (destructive only).

7. **State feedback everywhere** — Every queued action shows its progress: `pending → processing → sent → accepted`. No black boxes.

8. **Delight in the details** — Acceptance rate badge goes green when above 30%, yellow 15–30%, red below 15%. Color = instant signal, no reading required.

---

## 6. Priority Roadmap

### 🔴 Must-Have for Parity (Weeks 1–3)

| Feature | Effort | What It Fixes |
|---------|--------|---------------|
| Randomized action delays (jitter on `calculateDelay`) | 0.5 days | Account safety — most critical risk |
| Working-hours scheduler (add to campaign schema, check in executor) | 1 day | Safety + professionalism |
| Account warm-up mode (Redis daily counter, linear ramp) | 2 days | New account safety, reduces bans |
| Auto-pause on low acceptance rate (daily cron) | 1 day | Silent account restriction prevention |
| Per-action random inter-delay (45–120s sleep in Playwright worker) | 0.5 days | Undetectable automation pattern |
| Analytics dashboard UI (reads existing DB tables) | 5 days | #1 evaluated feature in demos |
| Variable picker UI chips (clickable `{{firstName}}` tokens) | 0.5 days | UX parity with every competitor |
| Character counter with overflow warning on template editor | 0.5 days | Prevents silently truncated messages |
| Empty state + "Create Campaign" CTA on campaigns list | 0.5 days | Free-to-paid conversion |
| Campaign quick-start templates (3 pre-built sequences) | 1 day | Time-to-first-campaign: 20min → 2min |

**Total: ~12 days**

---

### 🟡 Differentiators for Competitive Edge (Weeks 4–7)

| Feature | Effort | Competitive Impact |
|---------|--------|-------------------|
| AI icebreaker (GPT-4o-mini per lead, cache in DB, `{{aiIcebreaker}}` variable) | 3 days | Beats SalesRobot at their own game |
| Spintax inline helper (modal: "Enter variants separated by \|") | 1 day | Unique: no competitor has both spintax + AI |
| A/B testing (variant field on leads, 50/50 split, per-variant analytics) | 4 days | Parity with Dripify + Aimfox, beats HeyReach |
| Live template preview (render with first lead as sample) | 1 day | Confidence before launching |
| Outbound webhooks on campaign events | 3 days | Unlocks every CRM without building native integrations |
| Drag-to-reorder step builder (dnd-kit) | 2 days | Visual parity with Aimfox builder |
| Visual conditional branching UI (show branch paths inline) | 2 days | Makes branching logic visible and trustworthy |
| "Skip if already contacted" deduplication flag | 1 day | Prevents embarrassing double-contacts |
| Per-step analytics in campaign detail view | 2 days | Shows which step is the funnel bottleneck |

**Total: ~19 days**

---

### 🟢 Nice-to-Have for Roadmap (Weeks 8+)

| Feature | Effort | Strategic Value |
|---------|--------|----------------|
| AI reply classification (Interested / Not Interested / OOO / Wrong person) | 1 week | Premium feature — no competitor does it well |
| A/B test auto-winner (statistical significance, auto-routes remaining leads) | 3 days | Full A/B parity with Dripify |
| Email fallback in sequence (complete `email` step type, SMTP/Resend) | 2 weeks | Expands TAM beyond LinkedIn-only |
| Campaign template library (shareable templates, community library) | 1 week | Growth/referral lever |
| Agency multi-workspace (sub-workspaces per client, aggregate dashboard) | 2 weeks | 5–10× revenue per agency customer |
| LinkedIn Sales Nav search sync (import saved searches as lead list) | 2 weeks | Enterprise feature — HeyReach's core moat |
| Sequence performance benchmarks ("Your 38% acceptance is above 29% avg") | 1 week | Delight — makes users feel successful |

---

## 7. Positioning Statement

> **"The campaign builder that runs while you sleep — with AI-powered personalization, built-in account safety, and conditional branching that actually works. No Chrome extensions, no browser tabs to babysit."**

---

### Head-to-Head vs Each Competitor

| vs | Our Angle |
|----|-----------|
| **Dripify** | *"Dripify requires your browser to stay open. Our campaigns run 24/7 on cloud workers — close your laptop and wake up to replies. We add AI-generated icebreakers and randomized human-like delays that Dripify can't match."* |
| **HeyReach** | *"HeyReach charges $400/month for multi-sender and has no AI personalization. We give you multi-sender at half the price, GPT icebreakers per lead, built-in proxy safety, and conditional branching — in one platform."* |
| **Aimfox** | *"Aimfox has a pretty visual builder but no inbox, no AI, and no spintax. We combine their visual builder style with AI personalization, spintax rotation, inbox integration, and proxy assignment — everything in one price tier."* |
| **SalesRobot** | *"SalesRobot's AI writes the same generic icebreaker for everyone. Ours combines GPT personalization with spintax variation and working-hours scheduling — every message looks hand-crafted, at the right time of day for your prospect's timezone."* |

---

### Core Brand Equation

```
10x Campaign Module =
  Dripify's UX (simplicity + visual builder)
+ HeyReach's reliability (cloud workers, 24/7)
+ Aimfox's safety (proxy per account + randomized delays)
+ SalesRobot's AI (GPT icebreakers per lead)
+ Our unique architecture (BullMQ + 4-condition branching + spintax)
```

---

## 8. Backend Changes Summary

### Schema Additions Required

```sql
-- Safety controls on campaigns
ALTER TABLE campaigns ADD COLUMN working_hours_start TIME DEFAULT '08:00';
ALTER TABLE campaigns ADD COLUMN working_hours_end TIME DEFAULT '18:00';
ALTER TABLE campaigns ADD COLUMN working_days TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'];
ALTER TABLE campaigns ADD COLUMN delay_min_seconds INTEGER DEFAULT 45;
ALTER TABLE campaigns ADD COLUMN delay_max_seconds INTEGER DEFAULT 120;
ALTER TABLE campaigns ADD COLUMN warm_up_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN warm_up_days INTEGER DEFAULT 14;
ALTER TABLE campaigns ADD COLUMN auto_pause_below_acceptance NUMERIC DEFAULT 0.15;
ALTER TABLE campaigns ADD COLUMN skip_already_contacted BOOLEAN DEFAULT TRUE;

-- A/B testing
ALTER TABLE campaign_leads ADD COLUMN variant TEXT DEFAULT 'A';
ALTER TABLE campaign_sequences ADD COLUMN message_template_b TEXT;
ALTER TABLE campaign_sequences ADD COLUMN ab_test_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE campaign_sequences ADD COLUMN ab_test_winner TEXT;

-- AI icebreaker
ALTER TABLE leads ADD COLUMN ai_icebreaker TEXT;
ALTER TABLE leads ADD COLUMN ai_icebreaker_generated_at TIMESTAMPTZ;
```

### Key Files to Modify

| File | Change |
|------|--------|
| `lib/campaign-executor.ts` | Add working-hours check before job queuing. Add random jitter to `calculateDelay()`. Add warm-up ramp logic |
| `lib/queue/workers/campaign-worker.ts` | Add random inter-action sleep (45–120s) |
| `lib/template-engine.ts` | Add `aiIcebreaker` to variable map |
| `app/actions/campaigns.ts` | Add `generateAIIcebreakers()` function called on campaign start |
| `app/campaigns/new/page.tsx` | Add visual builder, variable picker chips, spintax helper, safety panel |
| `app/campaigns/[id]/page.tsx` | Add analytics dashboard, per-step stats, A/B test results |
| `app/campaigns/page.tsx` | Add empty state with templates CTA, funnel stats on campaign cards |
