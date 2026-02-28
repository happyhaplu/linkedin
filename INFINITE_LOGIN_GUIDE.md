# Infinite Login Testing Guide

## Quick Start

### Method 1: Test Page (Recommended for Debugging)
1. Open: http://localhost:3001/test-infinite-login
2. Get your li_at cookie:
   - Go to linkedin.com and log in
   - Press F12 to open DevTools
   - Go to Application tab → Cookies → https://www.linkedin.com
   - Find "li_at" cookie and copy its VALUE
3. Paste email and li_at value in the test page
4. Click "Test Cookie Authentication"
5. Check browser console (F12) for detailed logs

### Method 2: Main Feature
1. Open: http://localhost:3001/linkedin-account
2. Click "+ Connect Account"
3. Select "Infinite Login with 2FA" (already selected by default)
4. Enter your LinkedIn email
5. Get li_at cookie (same steps as above)
6. Paste li_at value in "Secret Key" field
7. Click "Connect with Infinite Login"

## How to Get li_at Cookie

### Chrome/Edge:
1. Go to https://linkedin.com and log in
2. Press F12
3. Click "Application" tab (if you don't see it, click >> and find it)
4. Left sidebar: Cookies → https://www.linkedin.com
5. Find "li_at" in the list
6. Copy the VALUE (long string starting with AQ...)

### Firefox:
1. Go to https://linkedin.com and log in
2. Press F12
3. Click "Storage" tab
4. Left sidebar: Cookies → https://www.linkedin.com
5. Find "li_at"
6. Copy the Value

## Troubleshooting

### Common Issues:

**1. "Invalid secret key"**
- Make sure you copied the li_at VALUE, not the name
- Don't include any spaces or quotes
- The value should be ~160 characters long starting with "AQ"

**2. "Cookie is expired"**
- LinkedIn cookies expire after some time
- Get a fresh li_at cookie and try again

**3. "Not authenticated"**
- Make sure you're logged in to the app
- Try logging out and back in

**4. Server logs not showing**
- Open browser DevTools console (F12 → Console)
- Check terminal where `pnpm dev` is running
- Look for emoji indicators: 🔑 🔍 ✅ ❌

### Detailed Debugging:

1. **Use the Test Page** (http://localhost:3001/test-infinite-login)
   - Shows detailed errors
   - Tests cookie validation only (no database)
   - Faster iteration

2. **Check Browser Console**
   - F12 → Console tab
   - Look for errors in red
   - Check for network errors (Network tab)

3. **Check Server Logs**
   - Terminal running `pnpm dev`
   - Look for:
     ```
     🔑 Starting infinite login with cookie for: your@email.com
     📝 Secret key length: 164
     🔍 Validating cookie...
     ✅ Cookie validated successfully
     💾 Creating account in database...
     ✅ Infinite login account connected successfully!
     ```

4. **Verify Cookie Works**
   - Use the test script:
     ```bash
     cd /home/harekrishna/Projects/Linkedin
     node scripts/test-cookie-auth.cjs
     ```
   - Edit the script to add your li_at cookie first

## Expected Flow

### Test Page:
1. Enter email + li_at cookie
2. Click "Test"
3. See "✅ Success!" with profile data
4. If it works here, it should work in main feature

### Main Feature:
1. Select infinite login
2. Enter email + li_at
3. Click connect
4. Account added with "INFINITE" badge
5. Shows profile name and picture

## What's Happening Behind the Scenes

1. **Cookie Validation** (3-5 seconds)
   - Launches headless browser
   - Sets your li_at cookie
   - Tries to access LinkedIn feed
   - If successful → valid cookie
   - Extracts profile name and picture
   - Closes browser

2. **Account Creation**
   - Saves cookies to database
   - Sets connection_method = 'cookie'
   - Status = 'active'
   - Stores profile data

3. **Display**
   - Shows "INFINITE" badge
   - Shows profile picture
   - Shows profile name
   - Ready to use!

## Still Not Working?

1. Share the exact error message you see
2. Check both browser console AND server terminal
3. Try the test page first
4. Make sure your li_at cookie is fresh (logged in recently)

## Test Account

If you want to test with a fresh account:
- Email: aadarsh.supabase@gmail.com
- Password: System@123321
- Get li_at from this account
