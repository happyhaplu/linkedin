# Unified Inbox Quick Setup Guide

## Step 1: Create Database Tables

You need to run the SQL migration to create the `conversations` and `messages` tables in your Supabase database.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `migrations/create-messages-tables.sql`
6. Paste into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

You should see: "Success. No rows returned"

### Option B: Using Command Line (if psql installed)

```bash
# Set your DATABASE_URL (get from Supabase Dashboard > Settings > Database)
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"

# Run migration
psql "$DATABASE_URL" -f migrations/create-messages-tables.sql
```

### Option C: Using Supabase CLI

```bash
supabase db push
```

## Step 2: Verify Tables Created

Run this query in Supabase SQL Editor to verify:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'messages');

-- Check conversations table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations';

-- Check messages table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages';
```

You should see both `conversations` and `messages` in the results.

## Step 3: Add Sample Data (Optional)

For testing, you can add sample conversations:

```sql
-- First, get your LinkedIn account ID
SELECT id, email FROM linkedin_accounts WHERE user_id = auth.uid();

-- Insert a test conversation (replace YOUR_LINKEDIN_ACCOUNT_ID)
INSERT INTO conversations (
  linkedin_account_id,
  participant_name,
  participant_profile_url,
  participant_headline,
  last_message_at,
  last_message_preview,
  unread_count,
  thread_id
) VALUES (
  'YOUR_LINKEDIN_ACCOUNT_ID',
  'John Smith',
  'https://linkedin.com/in/johnsmith',
  'Software Engineer at Tech Corp',
  NOW() - INTERVAL '1 hour',
  'Hey! Thanks for connecting...',
  2,
  'thread_test_001'
) RETURNING id;

-- Insert test messages (replace CONVERSATION_ID and LINKEDIN_ACCOUNT_ID)
INSERT INTO messages (
  conversation_id,
  linkedin_account_id,
  message_id,
  sender_name,
  is_from_me,
  content,
  sent_at,
  is_read
) VALUES
(
  'CONVERSATION_ID',
  'YOUR_LINKEDIN_ACCOUNT_ID',
  'msg_test_001',
  'John Smith',
  false,
  'Hey! Thanks for connecting. I saw your profile and wanted to reach out.',
  NOW() - INTERVAL '2 hours',
  true
),
(
  'CONVERSATION_ID',
  'YOUR_LINKEDIN_ACCOUNT_ID',
  'msg_test_002',
  'You',
  true,
  'Hi John! Thanks for reaching out. Happy to connect!',
  NOW() - INTERVAL '1 hour 30 minutes',
  true
),
(
  'CONVERSATION_ID',
  'YOUR_LINKEDIN_ACCOUNT_ID',
  'msg_test_003',
  'John Smith',
  false,
  'Would you be interested in a quick call next week to discuss potential collaboration?',
  NOW() - INTERVAL '1 hour',
  false
);
```

## Step 4: Set Up Row Level Security (RLS)

For production, enable RLS on these tables:

```sql
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see conversations from their own LinkedIn accounts
CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
USING (
  linkedin_account_id IN (
    SELECT id FROM linkedin_accounts WHERE user_id = auth.uid()
  )
);

-- Policy: Users can insert into own conversations
CREATE POLICY "Users can create own conversations"
ON conversations FOR INSERT
WITH CHECK (
  linkedin_account_id IN (
    SELECT id FROM linkedin_accounts WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update own conversations
CREATE POLICY "Users can update own conversations"
ON conversations FOR UPDATE
USING (
  linkedin_account_id IN (
    SELECT id FROM linkedin_accounts WHERE user_id = auth.uid()
  )
);

-- Policy: Users can view messages from their conversations
CREATE POLICY "Users can view own messages"
ON messages FOR SELECT
USING (
  linkedin_account_id IN (
    SELECT id FROM linkedin_accounts WHERE user_id = auth.uid()
  )
);

-- Policy: Users can insert messages
CREATE POLICY "Users can create messages"
ON messages FOR INSERT
WITH CHECK (
  linkedin_account_id IN (
    SELECT id FROM linkedin_accounts WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update messages (mark as read)
CREATE POLICY "Users can update own messages"
ON messages FOR UPDATE
USING (
  linkedin_account_id IN (
    SELECT id FROM linkedin_accounts WHERE user_id = auth.uid()
  )
);
```

## Step 5: Test the Unified Inbox

1. Start your dev server: `pnpm dev`
2. Navigate to http://localhost:3000/unibox
3. You should see the unified inbox interface
4. If you added sample data, you'll see test conversations
5. Try sending a message, archiving, filtering

## Troubleshooting

### "relation 'conversations' does not exist"
- Make sure you ran the migration SQL
- Check Supabase logs for errors
- Verify you're connected to the right database

### "No conversations showing"
- Make sure you have LinkedIn accounts connected
- Add test data using the SQL above
- Check browser console for errors

### "Permission denied"
- Ensure RLS policies are created
- Check that your user is authenticated
- Verify LinkedIn accounts belong to current user

## Next Steps

To populate with real LinkedIn data, you'll need to:

1. **LinkedIn API Integration:**
   - Fetch conversations from LinkedIn
   - Sync to `conversations` table

2. **Message Sync:**
   - Fetch messages for each conversation
   - Insert into `messages` table

3. **Real-time Updates:**
   - Poll LinkedIn API periodically
   - Or set up webhooks if available

4. **Send Messages:**
   - When user sends via Unibox, also send via LinkedIn API
   - Update message status based on response

## Support

- Check [UNIBOX_COMPLETE.md](./UNIBOX_COMPLETE.md) for full documentation
- Review `app/unibox/actions.ts` for server action implementations
- See `migrations/create-messages-tables.sql` for table schema

---

✅ Once completed, your unified inbox will be ready to manage all LinkedIn messages in one place!
