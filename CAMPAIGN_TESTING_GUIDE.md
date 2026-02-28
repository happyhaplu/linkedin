# 🧪 Campaign Module Testing Guide

## Quick Test (5 minutes)

### 1. Start Redis
```bash
# Option A: Local Redis
redis-server --daemonize yes

# Option B: Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### 2. Install Dependencies
```bash
npm install dotenv
```

### 3. Start Workers
```bash
# Terminal 1: Start all workers
npm run workers

# OR start individually
# Terminal 1: Campaign processor
npm run campaign-worker

# Terminal 2: Status checker
npm run status-checker

# Terminal 3: Inbox scanner
npm run inbox-scanner
```

### 4. Test Template Engine
```bash
npm run test-template
```

Expected output:
```
✓ Variable replacement works
✓ Spintax processing works
✓ Character limits enforced
✓ Missing data detected
```

### 5. Create Test Campaign (via UI or Database)

**Option A: Via Database (Quick)**
```sql
-- Insert test campaign
INSERT INTO campaigns (user_id, name, status)
VALUES ('YOUR_USER_ID', 'Test Campaign', 'draft')
RETURNING id;

-- Insert test step
INSERT INTO campaign_steps (campaign_id, step_type, step_order, template_content)
VALUES ('CAMPAIGN_ID', 'connection_request', 1, 'Hi {{firstName}}, would love to connect!');

-- Insert test lead
INSERT INTO campaign_leads (campaign_id, lead_id, status)
SELECT 'CAMPAIGN_ID', id, 'queued'
FROM leads LIMIT 1;

-- Add sender account
INSERT INTO campaign_senders (campaign_id, sender_account_id, is_active)
SELECT 'CAMPAIGN_ID', id, true
FROM linkedin_accounts LIMIT 1;
```

**Option B: Via UI**
1. Go to /campaigns
2. Click "Create Campaign"
3. Add campaign name
4. Add steps (connection request, message, etc.)
5. Add leads from your lead lists
6. Assign LinkedIn account(s)

### 6. Start Campaign via API

```bash
curl -X POST http://localhost:3000/api/campaigns/YOUR_CAMPAIGN_ID/start \
  -H "Cookie: YOUR_AUTH_COOKIE"
```

Or use the UI "Start Campaign" button.

### 7. Monitor Progress

**Check Worker Logs:**
```bash
# Watch the terminal where workers are running
# You should see logs like:
# [Campaign Executor] Processing step for lead...
# [Automation] Sending connection request to John Doe
# ✓ Job completed successfully
```

**Check Database:**
```sql
-- Check campaign lead statuses
SELECT status, COUNT(*) 
FROM campaign_leads 
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
GROUP BY status;

-- Check sender stats
SELECT 
  sender_account_id,
  connections_sent,
  connections_sent_today,
  messages_sent
FROM campaign_senders
WHERE campaign_id = 'YOUR_CAMPAIGN_ID';
```

**Check Queue Stats via API:**
```bash
curl http://localhost:3000/api/campaigns/YOUR_CAMPAIGN_ID/stats \
  -H "Cookie: YOUR_AUTH_COOKIE"
```

Expected response:
```json
{
  "campaign": {
    "id": "...",
    "name": "Test Campaign",
    "status": "active"
  },
  "leads": {
    "total": 10,
    "queued": 0,
    "in_progress": 3,
    "connection_sent": 5,
    "connected": 2,
    "messaged": 0,
    "replied": 0,
    "completed": 0,
    "stopped": 0,
    "failed": 0
  },
  "queue": {
    "waiting": 5,
    "active": 2,
    "completed": 3,
    "failed": 0
  }
}
```

---

## Full End-to-End Test (15-30 minutes)

### Test Scenario: 3-Step Campaign
1. Send connection request with personalized note
2. Wait 1 day (simulated with 1 minute delay)
3. Send follow-up message after connection accepted

### Setup

```sql
-- Create campaign
INSERT INTO campaigns (user_id, name, status, stop_on_reply)
VALUES ('YOUR_USER_ID', 'E2E Test Campaign', 'draft', true)
RETURNING id; -- Save this as CAMPAIGN_ID

-- Step 1: Connection Request
INSERT INTO campaign_steps (
  campaign_id, 
  step_type, 
  step_order, 
  template_content,
  id
) VALUES (
  'CAMPAIGN_ID',
  'connection_request',
  1,
  'Hi {{firstName}}, I noticed you work at {{company}}. {Would love to connect!|Let''s connect!}',
  gen_random_uuid()
) RETURNING id; -- Save this as STEP_1_ID

-- Step 2: Delay (1 minute for testing, 1 day in production)
INSERT INTO campaign_steps (
  campaign_id,
  step_type,
  step_order,
  parent_step_id,
  delay_amount,
  delay_unit,
  id
) VALUES (
  'CAMPAIGN_ID',
  'delay',
  2,
  'STEP_1_ID',
  1,
  'minutes',
  gen_random_uuid()
) RETURNING id; -- Save this as STEP_2_ID

-- Step 3: Follow-up Message
INSERT INTO campaign_steps (
  campaign_id,
  step_type,
  step_order,
  parent_step_id,
  template_content
) VALUES (
  'CAMPAIGN_ID',
  'message',
  3,
  'STEP_2_ID',
  'Thanks for connecting, {{firstName}}! I''d love to learn more about your work at {{company}}.'
);

-- Add 2-3 test leads
INSERT INTO campaign_leads (campaign_id, lead_id, status)
SELECT 'CAMPAIGN_ID', id, 'queued'
FROM leads
LIMIT 3;

-- Add sender account
INSERT INTO campaign_senders (campaign_id, sender_account_id, is_active, daily_limit)
SELECT 'CAMPAIGN_ID', id, true, 50
FROM linkedin_accounts
LIMIT 1;
```

### Execute Test

```bash
# 1. Start campaign
curl -X POST http://localhost:3000/api/campaigns/CAMPAIGN_ID/start

# 2. Watch worker logs
# You should see:
# - Step 1: Connection requests being sent
# - Status updates in database
# - Step 2: Delay jobs queued
# - After delay: Step 3 triggers (if connection accepted)

# 3. Check progress every 30 seconds
watch -n 30 "curl -s http://localhost:3000/api/campaigns/CAMPAIGN_ID/stats | jq"

# 4. Manually accept connection on LinkedIn to test flow

# 5. Wait for status checker to detect acceptance (runs hourly, or trigger manually)

# 6. Verify follow-up message is sent
```

### Expected Results

**After Step 1 (Connection Requests):**
```sql
SELECT status, COUNT(*) FROM campaign_leads WHERE campaign_id = 'CAMPAIGN_ID' GROUP BY status;
```
```
status            | count
------------------+-------
connection_sent   |     3
```

**After Delay:**
```sql
-- Leads should still be connection_sent, waiting for acceptance
SELECT status, connection_sent_at FROM campaign_leads WHERE campaign_id = 'CAMPAIGN_ID';
```

**After Connection Accepted:**
```sql
SELECT status, connection_accepted_at FROM campaign_leads WHERE campaign_id = 'CAMPAIGN_ID';
```
```
status     | connection_accepted_at
-----------+------------------------
messaged   | 2026-02-12 ...
```

**After Message Sent:**
```sql
SELECT status, first_message_sent_at FROM campaign_leads WHERE campaign_id = 'CAMPAIGN_ID';
```
```
status     | first_message_sent_at
-----------+----------------------
completed  | 2026-02-12 ...
```

---

## Testing Individual Components

### Test Template Engine
```bash
npm run test-template
```

### Test Queue Connection
```bash
# In Node REPL
node

const { campaignProcessorQueue } = require('./lib/queue/campaign-queue');
campaignProcessorQueue.add('test', { message: 'Hello World' });
// Check worker logs for processing
```

### Test Playwright Automation
```javascript
// Create test file: test-automation.js
const { sendConnectionRequest } = require('./lib/linkedin-campaign-automation');

(async () => {
  const result = await sendConnectionRequest(
    {
      id: 'test',
      email: 'your@email.com',
      password: 'yourpassword',
      cookies: [],
    },
    {
      linkedin_url: 'https://www.linkedin.com/in/test-profile/',
      first_name: 'John',
      full_name: 'John Doe',
    },
    'Hi John, would love to connect!'
  );
  
  console.log('Result:', result);
})();
```

Run:
```bash
node test-automation.js
```

---

## Troubleshooting

### Workers Not Processing Jobs

**Check Redis:**
```bash
redis-cli ping
# Should return: PONG
```

**Check Queue Stats:**
```bash
redis-cli
> KEYS bull:campaign-processor:*
> HGETALL bull:campaign-processor:meta
```

**Check Worker Logs:**
- Look for connection errors
- Look for "Worker started" message
- Check for job processing logs

### Automation Failures

**Common Issues:**
1. **LinkedIn login failed:** Check credentials in `linkedin_accounts` table
2. **Button not found:** LinkedIn UI may have changed, update selectors
3. **Rate limited:** Reduce concurrent jobs or daily limits

**Debug Mode:**
```javascript
// In linkedin-campaign-automation.ts
const browser = await chromium.launch({
  headless: false, // Show browser
  slowMo: 1000, // Slow down by 1 second
});
```

### Database Issues

**Check Functions:**
```sql
\df increment_sender_*
```

**Test Function:**
```sql
SELECT increment_sender_connections('CAMPAIGN_ID'::uuid, 'SENDER_ID'::uuid);
SELECT * FROM campaign_senders WHERE campaign_id = 'CAMPAIGN_ID';
```

---

## Performance Testing

### Load Test: 100 Leads
```sql
-- Insert 100 test leads
INSERT INTO campaign_leads (campaign_id, lead_id, status)
SELECT 
  'CAMPAIGN_ID',
  id,
  'queued'
FROM leads
LIMIT 100;
```

**Monitor:**
- Worker CPU usage
- Queue processing rate
- Database query performance
- LinkedIn rate limits

**Expected Performance:**
- 5 concurrent jobs (configurable)
- 10 jobs/minute rate limit (configurable)
- ~6 jobs/minute actual throughput
- 100 leads = ~17 minutes processing

### Stress Test: Multiple Campaigns
- Create 5 campaigns with 20 leads each
- Start all campaigns simultaneously
- Monitor queue stats and worker performance

---

## Success Criteria

✅ **Foundation (Phase 1):**
- [x] Workers start without errors
- [x] Template engine processes variables and spintax
- [x] Jobs are added to queues
- [x] Jobs are processed by workers
- [x] Database updates correctly

✅ **Automation (Phase 2):**
- [ ] Connection requests sent via Playwright
- [ ] Messages sent to connections
- [ ] InMails sent (if Premium account)
- [ ] Errors handled gracefully

✅ **Detection (Phase 3):**
- [ ] Status checker detects accepted connections
- [ ] Inbox scanner detects replies
- [ ] Stop-on-reply works
- [ ] Timeouts handled (7+ days)

✅ **Production Ready:**
- [ ] All flows working end-to-end
- [ ] Error handling robust
- [ ] Daily limits enforced
- [ ] Multiple senders rotate properly
- [ ] Analytics dashboard shows real-time stats

---

## Next Steps After Testing

1. **Fix Bugs:** Address any issues found during testing
2. **Optimize:** Tune concurrency and rate limits
3. **Add Analytics:** Build real-time dashboard
4. **A/B Testing:** Implement variant testing
5. **Safety:** Add account health monitoring
6. **Scale:** Test with larger campaigns (500+ leads)

---

For more details, see:
- [CAMPAIGN_QUICKSTART.md](CAMPAIGN_QUICKSTART.md)
- [CAMPAIGN_EXECUTION_PLAN.md](CAMPAIGN_EXECUTION_PLAN.md)
- [CAMPAIGN_IMPLEMENTATION_STATUS.md](CAMPAIGN_IMPLEMENTATION_STATUS.md)
