# Leads Management - CSV Import Guide

## 🎯 Overview

Complete lead management system built like HeyReach with CSV import functionality, list organization, and lead tracking.

## ✅ Features Implemented

### 1. **Lists Management** (`/leads/lists`)
- Create and organize leads into lists
- View lead count per list
- Delete lists (cascades to leads)
- Navigate to leads filtered by list

### 2. **Leads Database** (`/leads`)
- View all leads in a table
- Filter by list, status, or search
- Bulk actions (change status, delete)
- Individual lead management
- Click LinkedIn URLs to view profiles

### 3. **CSV Import**
- Upload CSV files with lead data
- Automatic column mapping (smart detection)
- Select existing list or create new list during import
- Preview data before importing
- Batch import (no limit on number of leads)

## 📊 Database Schema

### Lists Table
```sql
- id (UUID)
- user_id (UUID) - links to auth.users
- name (TEXT)
- description (TEXT, optional)
- lead_count (INTEGER)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Leads Table
```sql
- id (UUID)
- list_id (UUID) - links to lists table
- user_id (UUID) - links to auth.users
- linkedin_url (TEXT, optional)
- first_name (TEXT, optional)
- last_name (TEXT, optional)
- full_name (TEXT, optional)
- company (TEXT, optional)
- position (TEXT, optional)
- location (TEXT, optional)
- email (TEXT, optional)
- phone (TEXT, optional)
- notes (TEXT, optional)
- status (TEXT) - new, contacted, replied, qualified, unqualified, do_not_contact
- imported_at (TIMESTAMPTZ)
- last_contacted_at (TIMESTAMPTZ, optional)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

## 🚀 How to Use

### Step 1: Create a List

1. Go to http://localhost:3001/leads/lists
2. Click "Create List"
3. Enter list name (e.g., "Software Engineers at YC Companies")
4. Add optional description
5. Click "Create List"

### Step 2: Prepare Your CSV

Your CSV file should have headers. Supported column names (case-insensitive):

**Automatically Mapped Columns:**
- `first_name` or `first name`
- `last_name` or `last name`
- `full_name` or `name`
- `email`
- `company`
- `position`, `title`, or `job`
- `location` or `city`
- `linkedin_url` or `linkedin` or `url`
- `phone`
- `notes` or `note`

**Example CSV:**
```csv
first_name,last_name,email,company,position,linkedin_url,location
John,Doe,john@example.com,TechCorp,CEO,https://linkedin.com/in/johndoe,SF
Jane,Smith,jane@startup.io,StartupXYZ,CTO,https://linkedin.com/in/janesmith,NYC
```

A sample CSV file is included: `sample-leads.csv`

### Step 3: Import Leads

1. Go to http://localhost:3001/leads
2. Click "Import CSV" button
3. Upload your CSV file
4. Review the preview (shows first 10 rows)
5. Select an existing list OR create a new list
6. Click "Import X Leads"
7. Wait for confirmation

### Step 4: Manage Leads

**Filtering:**
- Filter by List (dropdown)
- Filter by Status (dropdown)
- Search by name, email, or company

**Bulk Actions:**
- Select multiple leads (checkboxes)
- Change status for selected leads
- Delete selected leads

**Individual Actions:**
- Click LinkedIn URL to view profile
- Delete individual leads
- View lead details

**Status Management:**
- **New**: Freshly imported, not contacted yet
- **Contacted**: Outreach sent
- **Replied**: Lead responded
- **Qualified**: Potential customer/connection
- **Unqualified**: Not a good fit
- **Do Not Contact**: Blacklisted

## 📝 CSV Import Options

### Option 1: Select Existing List
1. Click "Import CSV"
2. Upload file
3. Select from "Select an existing list..." dropdown
4. Import

### Option 2: Create New List During Import
1. Click "Import CSV"
2. Upload file
3. Click "+ Create new list"
4. Enter new list name
5. Import (list will be created automatically)

## 🎨 Features like HeyReach

✅ **List Organization**: Just like HeyReach's list management  
✅ **CSV Import**: Upload and map columns automatically  
✅ **Create List During Import**: No need to pre-create lists  
✅ **Smart Column Mapping**: Detects common variations  
✅ **Preview Before Import**: See what will be imported  
✅ **Bulk Actions**: Manage multiple leads at once  
✅ **Status Tracking**: Track lead progression  
✅ **Search & Filter**: Find leads quickly  
✅ **Lead Count**: Shows count per list  

## 🔧 Testing

### Test with Sample CSV:
```bash
# Sample CSV is already created at: sample-leads.csv
# Contains 10 sample leads with all fields populated
```

### Quick Test Flow:
1. Open http://localhost:3001/leads
2. Click "Import CSV"
3. Upload `sample-leads.csv`
4. Create new list: "Test Leads"
5. Import
6. Verify 10 leads appear
7. Test filtering by status
8. Test search functionality
9. Test bulk status update
10. Go to /leads/lists to see the list

## 📍 Navigation

- **Leads**: `/leads` - Main leads table
- **Lists**: `/leads/lists` - List management
- **Sidebar**: "Leads" menu item (already added)

## 🎯 Next Steps (Future Enhancements)

- [ ] Export leads to CSV
- [ ] LinkedIn profile enrichment
- [ ] Duplicate detection
- [ ] Custom fields
- [ ] Lead scoring
- [ ] Integration with campaigns
- [ ] Email validation
- [ ] Activity tracking
- [ ] Lead notes with timestamps
- [ ] Tags/labels system

## 💡 Tips

1. **Column Names**: CSV parser is smart - it will detect variations like "first name", "firstname", "First_Name"
2. **Optional Fields**: Only first/last name OR full_name is recommended, everything else is optional
3. **Bulk Import**: Can import thousands of leads at once
4. **List Organization**: Create lists before importing for better organization
5. **Status Updates**: Use bulk actions to update multiple leads at once

## ⚠️ Important Notes

- Deleting a list will delete all leads in that list (cascade delete)
- Leads are tied to the user who imported them (multi-tenancy)
- All data is stored in Supabase PostgreSQL
- Full-text search works on name, email, and company fields

## 🚀 Ready to Use!

Your leads management system is fully functional and ready to use. Start by:

1. Creating your first list
2. Importing the sample CSV
3. Exploring the filtering and bulk actions
4. Building your lead database!
