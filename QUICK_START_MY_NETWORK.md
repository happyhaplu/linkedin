# Quick Setup Guide - My Network Module

## 🚀 Quick Start (3 Steps)

### Step 1: Create Database Tables (5 minutes)

Choose **ONE** method:

#### Method A: Supabase Dashboard (Easiest)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Open `migrations/create-network-tables.sql` in your project
6. Copy ALL the SQL code
7. Paste into Supabase SQL Editor
8. Click **Run** button
9. ✅ You should see "Success. No rows returned"

#### Method B: Command Line (If you have Supabase CLI)
```bash
cd /home/harekrishna/Projects/Linkedin
./scripts/create-network-tables.sh
```

### Step 2: Verify Tables Created

In Supabase Dashboard:
1. Go to **Table Editor**
2. You should see 3 new tables:
   - ✅ `network_connections`
   - ✅ `connection_requests`
   - ✅ `network_sync_logs`

### Step 3: Test the Module

1. Start your dev server:
```bash
npm run dev
```

2. Navigate to http://localhost:3000/my-network

3. You should see:
   - If you have LinkedIn accounts: Stats cards and tabs
   - If no accounts: Message to connect a LinkedIn account

## 📋 What Was Built

### Files Created
- ✅ `migrations/create-network-tables.sql` - Database schema
- ✅ `app/actions/network.ts` - All server actions (750+ lines)
- ✅ `app/my-network/page.tsx` - Main UI (700+ lines)
- ✅ `components/ConnectionDetailModal.tsx` - Connection details
- ✅ `components/SyncNetworkModal.tsx` - Sync configuration
- ✅ `types/linkedin.ts` - Updated with network types
- ✅ `scripts/create-network-tables.sh` - Migration runner
- ✅ `MY_NETWORK_MODULE_COMPLETE.md` - Full documentation

### Features Available
1. ✅ Network statistics dashboard
2. ✅ Connection management (view, edit, delete)
3. ✅ Connection requests tracking (sent & received)
4. ✅ Favorites system
5. ✅ Tags and notes for connections
6. ✅ Advanced filtering and search
7. ✅ Bulk operations
8. ✅ Sync logging with metrics
9. ✅ Multiple LinkedIn account support
10. ✅ Responsive design

## 🔧 Common Issues

### Issue: Tables not showing in Supabase
**Solution**: Run the migration SQL again. Make sure you copied ALL the SQL code.

### Issue: Permission denied errors
**Solution**: Check RLS is enabled. The migration SQL includes RLS policies.

### Issue: Module shows "Not authenticated"
**Solution**: Make sure you're logged in. Go to /login first.

### Issue: "No LinkedIn accounts" message
**Solution**: This is normal if you haven't connected any accounts yet. Go to /linkedin-account and connect an account.

## 📝 Next Steps

After setup:

1. **Connect a LinkedIn Account**
   - Go to `/linkedin-account`
   - Click "Connect Account"
   - Enter credentials
   - Wait for "active" status

2. **Sync Your Network**
   - Go to `/my-network`
   - Click "Sync Network"
   - Select account
   - Choose sync type (Incremental recommended)
   - Click "Start Sync"

3. **Explore Features**
   - View connections in the main tab
   - Filter and search
   - Add favorites
   - Add tags and notes
   - View connection details
   - Check sync logs

## 💡 Tips

- **First Sync**: Use "Full Sync" for your first sync
- **Regular Syncs**: Use "Incremental Sync" to save time
- **Tags**: Use tags like "prospect", "client", "partner" to organize
- **Notes**: Add context about how you know the person
- **Favorites**: Mark important connections for quick access

## 📚 Full Documentation

For complete documentation, see:
- `MY_NETWORK_MODULE_COMPLETE.md` - Full feature list and API
- `migrations/create-network-tables.sql` - Database schema details

## ✅ Verification Checklist

Before using the module, verify:
- [ ] All 3 tables created in Supabase
- [ ] RLS enabled on all tables
- [ ] No TypeScript errors in your IDE
- [ ] Dev server starts without errors
- [ ] `/my-network` page loads successfully
- [ ] Can see the UI (even if it says "no accounts")

## 🎉 You're Done!

The My Network module is now fully integrated and ready to use!

Key URLs:
- Network Management: http://localhost:3000/my-network
- LinkedIn Accounts: http://localhost:3000/linkedin-account
- Full Documentation: MY_NETWORK_MODULE_COMPLETE.md
