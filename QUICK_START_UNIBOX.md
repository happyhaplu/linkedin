# 🚀 Unified Inbox - Quick Reference

## Access
**URL:** http://localhost:3000/unibox

## Database Setup (One-Time)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Run Migration
1. Open file: `migrations/create-messages-tables.sql`
2. Copy **ALL** contents
3. Paste into SQL Editor
4. Click **Run** (or Cmd/Ctrl + Enter)
5. Should see: ✅ "Success. No rows returned"

### Step 3: Verify
Run this query to verify tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'messages');
```

## Add Test Data (Optional)

```sql
-- Get your LinkedIn account ID first
SELECT id, email FROM linkedin_accounts WHERE user_id = auth.uid();

-- Insert test conversation (replace YOUR_LINKEDIN_ACCOUNT_ID)
INSERT INTO conversations (
  linkedin_account_id,
  participant_name,
  participant_headline,
  last_message_at,
  last_message_preview,
  unread_count,
  thread_id
) VALUES (
  'YOUR_LINKEDIN_ACCOUNT_ID',
  'Sarah Johnson',
  'Product Manager at Tech Corp',
  NOW() - INTERVAL '2 hours',
  'Thanks for connecting! I would love to...',
  2,
  'thread_test_001'
);
```

## Features Overview

### Conversation List (Left)
- Search by name or content
- Filter: All / Unread / Archived
- Select LinkedIn account
- Click to view messages

### Message Thread (Right)
- View full conversation
- Send replies
- Archive conversation
- View LinkedIn profile

### Keyboard Shortcuts
- **Enter** - Send message
- **Shift + Enter** - New line

## File Structure
```
app/unibox/
├── page.tsx              # Server page
├── UniboxContent.tsx     # Main UI
└── actions.ts            # Data operations

migrations/
└── create-messages-tables.sql

lib/
└── linkedin-message-sync.ts
```

## Common Actions

### Viewing Conversations
1. Navigate to `/unibox`
2. Conversations load automatically
3. Use filters to narrow down

### Sending a Message
1. Click a conversation
2. Type in the text box
3. Press Enter to send
4. Message appears instantly

### Archiving
1. Open conversation
2. Click Archive button (top right)
3. Conversation moves to Archived tab

### Searching
1. Type in search box (top left)
2. Results filter in real-time
3. Clear to see all again

## Troubleshooting

### "No conversations found"
- Check if LinkedIn accounts are connected
- Add test data (see above)
- Verify database migration ran

### Tables don't exist
- Run migration SQL in Supabase
- Check Supabase logs for errors

### Can't send messages
- Verify user is logged in
- Check browser console for errors
- Ensure conversation exists

## Next Steps

1. ✅ Run database migration
2. ✅ Add test data (optional)
3. ✅ Navigate to /unibox
4. ✅ Test the interface
5. 🔜 Integrate with LinkedIn API

## Documentation
- **Full docs:** [UNIBOX_COMPLETE.md](./UNIBOX_COMPLETE.md)
- **Setup guide:** [UNIBOX_SETUP_GUIDE.md](./UNIBOX_SETUP_GUIDE.md)
- **Summary:** [UNIBOX_IMPLEMENTATION_COMPLETE.md](./UNIBOX_IMPLEMENTATION_COMPLETE.md)

---

**Status:** ✅ Ready to use  
**Version:** 1.0.0  
**Date:** Feb 11, 2026
