# 🚀 CAMPAIGN EXECUTION ENGINE - IMPLEMENTATION PLAN

**Status**: In Progress  
**Started**: February 12, 2026  
**Estimated Completion**: 4-6 weeks

---

## 📋 Implementation Phases

### ✅ PHASE 1: FOUNDATION (Week 1-2)
**Goal**: Set up core infrastructure for campaign execution

#### 1.1 Template Engine
- [x] Variable replacement system ({{firstName}}, {{company}}, etc.)
- [x] Spintax support ({Option1|Option2|Option3})
- [ ] Validation and error handling
- [ ] Preview functionality
- [ ] Fallback values for missing data

#### 1.2 Job Queue Setup
- [ ] Install and configure BullMQ
- [ ] Create Redis connection
- [ ] Set up queue definitions
- [ ] Add job monitoring dashboard

#### 1.3 Campaign Executor Service
- [ ] Core executor logic
- [ ] Lead processor
- [ ] Step execution handlers
- [ ] Error handling and retries

---

### 🔄 PHASE 2: AUTOMATION (Week 3-4)
**Goal**: Implement LinkedIn automation flows

#### 2.1 Connection Request Flow
- [ ] Send connection request via Playwright
- [ ] Add personalized note (300 char limit)
- [ ] Handle errors (already connected, limit reached)
- [ ] Update campaign_leads status

#### 2.2 Message Flow
- [ ] Send direct message
- [ ] Handle character limits (8000 chars)
- [ ] Detect conversation threads
- [ ] Update message_sent_at timestamp

#### 2.3 InMail Flow
- [ ] Check Premium account status
- [ ] Verify InMail credits
- [ ] Send InMail with subject + body
- [ ] Fallback to connection request if unavailable

---

### 🔍 PHASE 3: DETECTION & POLLING (Week 5)
**Goal**: Add status detection and reply monitoring

#### 3.1 Connection Status Polling
- [ ] Detect connection accepted
- [ ] Detect connection declined/ignored
- [ ] Update campaign_leads timestamps
- [ ] Trigger next step in sequence

#### 3.2 Reply Detection
- [ ] Scan LinkedIn inbox
- [ ] Match replies to campaign leads
- [ ] Set replied_at timestamp
- [ ] Stop campaign sequence (stop-on-reply)

#### 3.3 Timeout Handling
- [ ] Check for pending connections > 7 days
- [ ] Mark as "Not Connected"
- [ ] Trigger alternative flows

---

### 📊 PHASE 4: ANALYTICS & UI (Week 6)
**Goal**: Real-time dashboards and reporting

#### 4.1 Real-time Updates
- [ ] WebSocket/SSE for live stats
- [ ] Queue size counter
- [ ] Next execution time display
- [ ] Progress bar visualization

#### 4.2 Analytics Dashboard
- [ ] Conversion funnel chart
- [ ] Reply rate trends
- [ ] Account performance comparison
- [ ] Time-series graphs

#### 4.3 Export & Reporting
- [ ] CSV export of campaign results
- [ ] Lead-level activity log
- [ ] Performance summary report

---

### ✨ PHASE 5: ADVANCED FEATURES (Week 7-8)
**Goal**: A/B testing, safety, and optimization

#### 5.1 A/B Testing
- [ ] Variant flow creation
- [ ] Audience split logic (50/50, 70/30)
- [ ] Separate performance tracking
- [ ] Winner declaration

#### 5.2 Safety & Compliance
- [ ] Weekly limit enforcement (100/week)
- [ ] Duplicate detection
- [ ] Account health monitoring
- [ ] Auto-pause on errors

#### 5.3 Smart Features
- [ ] Timezone-aware sending
- [ ] Business hours only option
- [ ] Optimal send time suggestions
- [ ] Lead scoring integration

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend UI                          │
│  (Campaign Dashboard, Templates, Analytics, Settings)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
│  /api/campaigns/* (CRUD, start, pause, stats)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Campaign Executor Service                   │
│  - Template Engine (personalization)                         │
│  - Lead Processor (status management)                        │
│  - Step Executor (flow logic)                                │
│  - Delay Scheduler (timing)                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│   BullMQ Queue   │  │  PostgreSQL DB   │
│  (Job Processor) │  │  (Campaign Data) │
└────────┬─────────┘  └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              LinkedIn Automation Workers                     │
│  - Playwright Browser Instances                             │
│  - Cookie/Credential Auth                                    │
│  - Connection Request Sender                                 │
│  - Message Sender                                            │
│  - InMail Sender                                             │
│  - Inbox Scanner (reply detection)                           │
│  - Connection Status Checker                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Dependencies to Install

```json
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.2",
    "@bull-board/api": "^5.14.0",
    "@bull-board/express": "^5.14.0",
    "cron": "^3.1.6",
    "date-fns": "^3.0.0"
  }
}
```

---

## 🗂️ File Structure

```
lib/
├── campaign-executor.ts       # Main executor service
├── template-engine.ts         # Variable replacement & spintax
├── linkedin-campaign-automation.ts  # Playwright automations
├── queue/
│   ├── campaign-queue.ts      # BullMQ queue setup
│   ├── workers/
│   │   ├── campaign-worker.ts # Main campaign processor
│   │   ├── connection-worker.ts  # Connection request handler
│   │   ├── message-worker.ts  # Message sender
│   │   └── polling-worker.ts  # Status checker
│   └── jobs/
│       ├── process-campaign-lead.ts
│       ├── check-connection-status.ts
│       └── scan-inbox-replies.ts
├── utils/
│   ├── campaign-limits.ts     # Daily/weekly limits
│   ├── lead-distributor.ts    # Round-robin logic
│   └── retry-strategy.ts      # Exponential backoff
└── monitoring/
    └── campaign-logger.ts     # Structured logging

app/
├── api/
│   └── campaigns/
│       ├── [id]/
│       │   ├── start/route.ts    # Start campaign
│       │   ├── pause/route.ts    # Pause campaign
│       │   ├── stats/route.ts    # Real-time stats
│       │   └── export/route.ts   # CSV export
│       └── templates/
│           ├── preview/route.ts  # Template preview
│           └── validate/route.ts # Validation
└── campaigns/
    └── [id]/
        ├── analytics/page.tsx    # Analytics dashboard
        └── templates/page.tsx    # Template editor

scripts/
├── start-campaign-worker.ts   # Worker startup script
└── setup-campaign-queues.ts   # Queue initialization
```

---

## 🎯 Success Criteria

### MVP Requirements (End of Phase 2)
- ✅ Can send connection requests with personalized notes
- ✅ Can send follow-up messages after connection accepted
- ✅ Delays between steps work correctly
- ✅ Template variables replaced properly
- ✅ Multi-account support with round-robin
- ✅ Daily limits enforced per account

### Full Feature Set (End of Phase 5)
- ✅ Stop-on-reply working
- ✅ Connection status detection
- ✅ A/B testing functional
- ✅ Real-time analytics dashboard
- ✅ Account health monitoring
- ✅ Weekly limit compliance

---

## 📝 Next Steps

1. **Install Dependencies**
   ```bash
   npm install bullmq ioredis @bull-board/api @bull-board/express
   ```

2. **Set up Redis**
   - Local: `docker run -d -p 6379:6379 redis:alpine`
   - Or use Redis Cloud/Upstash

3. **Create Environment Variables**
   ```env
   REDIS_URL=redis://localhost:6379
   BULL_BOARD_USER=admin
   BULL_BOARD_PASSWORD=your-secure-password
   ```

4. **Run Worker Process**
   ```bash
   npm run campaign-worker
   ```

5. **Test Campaign Flow**
   - Create campaign in UI
   - Add leads
   - Start campaign
   - Monitor in Bull Board dashboard

---

## 🔧 Development Workflow

1. **Day 1-2**: Template engine + queue setup
2. **Day 3-5**: Basic executor + connection flow
3. **Day 6-8**: Message flow + delay handling
4. **Day 9-10**: Status detection
5. **Day 11-12**: Reply detection
6. **Day 13-15**: Testing & bug fixes
7. **Day 16-20**: Analytics & UI polish
8. **Day 21-25**: A/B testing
9. **Day 26-30**: Safety features & optimization

---

## ⚠️ Important Notes

- **Rate Limits**: LinkedIn allows ~100 connection requests per week
- **Session Management**: Keep browser sessions alive, rotate proxies
- **Error Handling**: Retry failed actions 3 times with exponential backoff
- **Logging**: Log all actions for debugging and compliance
- **Testing**: Test with dummy accounts first, not production data

---

## 📊 Progress Tracking

| Phase | Status | Progress | ETA |
|-------|--------|----------|-----|
| Phase 1: Foundation | 🟡 In Progress | 50% | Week 1-2 |
| Phase 2: Automation | ⚪ Not Started | 0% | Week 3-4 |
| Phase 3: Detection | ⚪ Not Started | 0% | Week 5 |
| Phase 4: Analytics | ⚪ Not Started | 0% | Week 6 |
| Phase 5: Advanced | ⚪ Not Started | 0% | Week 7-8 |

**Last Updated**: February 12, 2026
