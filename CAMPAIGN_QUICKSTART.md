# Campaign Module - Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install bullmq ioredis @bull-board/api @bull-board/express date-fns
```

### 2. Set Up Redis
**Option A: Docker (Recommended)**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Option B: Redis Cloud**
- Sign up at https://redis.com/try-free/
- Get connection URL
- Add to `.env.local`

### 3. Add Environment Variables
```env
# Add to .env.local
REDIS_URL=redis://localhost:6379
BULL_BOARD_USER=admin
BULL_BOARD_PASSWORD=your-secure-password
```

### 4. Start the Campaign Worker
```bash
npm run campaign-worker
```

You should see:
```
🚀 Starting Campaign Worker...
✅ Campaign Worker is ready and waiting for jobs...
   Queue: campaign-processor
   Concurrency: 5
   Rate limit: 10 jobs/minute
```

## 📊 Monitor Jobs (Bull Board Dashboard)

Create `app/api/bull-board/route.ts`:
```typescript
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { campaignProcessorQueue, connectionSenderQueue, messageSenderQueue } from '@/lib/queue/campaign-queue'

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/api/bull-board')

createBullBoard({
  queues: [
    new BullMQAdapter(campaignProcessorQueue),
    new BullMQAdapter(connectionSenderQueue),
    new BullMQAdapter(messageSenderQueue)
  ],
  serverAdapter
})

export const GET = serverAdapter.registerPlugin()
```

Access dashboard at: `http://localhost:3000/api/bull-board`

## 🧪 Testing the Template Engine

```bash
npm run test-template
```

Or test in code:
```typescript
import { processTemplate, previewTemplate } from '@/lib/template-engine'

const template = "Hi {{firstName}}, I saw you work at {{company}}. {Let's connect!|Would love to connect!}"

const lead = {
  first_name: 'John',
  last_name: 'Doe',
  company: 'Acme Corp'
}

const result = processTemplate(template, lead)
console.log(result)
// Output: "Hi John, I saw you work at Acme Corp. Let's connect!"
// or: "Hi John, I saw you work at Acme Corp. Would love to connect!"
```

## 🎯 Start a Campaign

### Via API:
```typescript
// app/api/campaigns/[id]/start/route.ts
import { startCampaign } from '@/lib/campaign-executor'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await startCampaign(params.id)
    return Response.json(result)
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

### Via UI:
```typescript
async function handleStartCampaign() {
  const response = await fetch(`/api/campaigns/${campaignId}/start`, {
    method: 'POST'
  })
  const result = await response.json()
  console.log(result.message)
}
```

## 📋 Campaign Flow Example

```
1. User creates campaign with steps:
   - Step 1: Send connection request (delay: 0 days)
   - Step 2: Send message after accepted (delay: 1 day)
   - Step 3: Follow-up message (delay: 3 days)

2. User adds 100 leads to campaign

3. User clicks "Start Campaign"

4. System queues 100 jobs:
   - All get Step 1 (connection request) immediately
   
5. Worker processes jobs:
   - Sends connection requests with personalized notes
   - Updates campaign_leads status
   - Queues Step 2 with 1-day delay

6. After 1 day (if connection accepted):
   - Step 2 jobs trigger
   - Sends messages
   - Queues Step 3 with 3-day delay

7. After 3 more days:
   - Step 3 jobs trigger
   - Sends follow-up
   - Marks lead as completed
```

## 🛠️ Troubleshooting

### Worker Not Starting
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check connection
echo $REDIS_URL

# Check logs
npm run campaign-worker
```

### Jobs Not Processing
```bash
# Check queue stats
node -e "
const { campaignProcessorQueue } = require('./lib/queue/campaign-queue');
campaignProcessorQueue.getJobCounts().then(console.log);
"
```

### Template Not Replacing Variables
```typescript
// Check lead data has required fields
console.log(lead)

// Test template
import { previewTemplate } from '@/lib/template-engine'
const { preview, warnings } = previewTemplate(template, lead)
console.log({ preview, warnings })
```

## 📚 Next Steps

1. **Implement Playwright Automation**: Edit `lib/campaign-executor.ts` functions:
   - `sendConnectionRequest()`
   - `sendMessage()`
   - `sendInMail()`

2. **Add Status Polling**: Create worker to check connection acceptance

3. **Build Reply Detection**: Scan inbox for replies

4. **Create Analytics Dashboard**: Real-time campaign stats

5. **Add Safety Features**: Rate limiting, account health monitoring

## 📖 Documentation

- [Full Implementation Plan](./CAMPAIGN_EXECUTION_PLAN.md)
- [Campaign Module Audit](./CAMPAIGN_MODULE_AUDIT.md)
- [Template Engine API](./lib/template-engine.ts)
- [Queue Configuration](./lib/queue/campaign-queue.ts)

## 🆘 Support

Check worker logs:
```bash
npm run campaign-worker
```

Monitor queue:
```
http://localhost:3000/api/bull-board
```

Debug mode:
```env
DEBUG=bullmq:*
npm run campaign-worker
```
