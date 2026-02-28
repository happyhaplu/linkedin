# LinkedIn Account Connection - HeyReach Method

## How It Works (Same as HeyReach)

This LinkedIn account connection system uses the **cookie-based authentication method**, which is the exact same approach used by professional tools like HeyReach, Expandi, and other LinkedIn automation platforms.

### Why Cookies Instead of Passwords?

1. **Security**: Your LinkedIn password is never stored on our servers
2. **No Direct Login**: We don't need to automate the LinkedIn login process
3. **2FA Compatible**: Works even if you have 2FA enabled on your LinkedIn account
4. **Reliable**: More stable than trying to automate LinkedIn's login flow

## Step-by-Step Guide

### Method 1: Quick Setup (Recommended)

1. **Open the Connection Modal**
   - Go to LinkedIn Accounts page
   - Click "Connect Account"
   - Click "Click here for step-by-step guide →"

2. **Follow the Visual Guide**
   - The guide will open in a new tab
   - Follow all 6 steps carefully
   - Copy your `li_at` cookie

3. **Connect Your Account**
   - Paste the cookie in the connection form
   - Enter your LinkedIn email (for identification)
   - Click "Connect Account"
   - ✅ Done! Account connected instantly

### Method 2: Manual Cookie Extraction

#### Step 1: Login to LinkedIn
- Go to https://www.linkedin.com
- Log in with your credentials
- Complete any 2FA if required

#### Step 2: Open Browser DevTools
- **Chrome/Edge**: Press `F12` or `Ctrl + Shift + I` (Windows/Linux) / `Cmd + Option + I` (Mac)
- **Firefox**: Press `F12` or `Ctrl + Shift + I`

#### Step 3: Navigate to Cookies
1. Click on the **"Application"** tab (Chrome) or **"Storage"** tab (Firefox)
2. In the left sidebar, expand **"Cookies"**
3. Click on `https://www.linkedin.com`

#### Step 4: Find the li_at Cookie
1. Look for a cookie named **`li_at`**
2. Click on it to see the full value
3. The value is a long string (150+ characters)

#### Step 5: Copy the Cookie
1. Double-click the value to select it all
2. Copy it (`Ctrl+C` or `Cmd+C`)
3. Paste it in the connection form

#### Step 6: Optional - Get JSESSIONID
- For better stability, also copy the `JSESSIONID` cookie
- Paste it in the optional field

## Technical Details

### What Cookies We Use

- **`li_at`** (Required): LinkedIn authentication token
  - This is your main session cookie
  - Allows API requests on your behalf
  - Usually valid for 1 year

- **`JSESSIONID`** (Optional): Session identifier
  - Provides additional session stability
  - Recommended for long-running campaigns

### How We Store Cookies

- Cookies are stored encrypted in PostgreSQL database
- Only accessible by your account (Row Level Security)
- Never logged or transmitted to third parties
- Used only for LinkedIn automation requests

### Cookie Validation

When you connect an account:
1. We validate the cookie format (must be 50+ characters)
2. Store it in the `session_cookies` JSONB field
3. Mark account as `active` immediately
4. In production, would make a test API call to verify validity

## Comparison with Other Methods

### ❌ Email/Password Method (Not Used)
- Requires storing passwords
- Can't bypass 2FA
- Risk of account lockout
- Complicated login automation

### ✅ Cookie Method (We Use This)
- No password storage
- Works with 2FA
- Same method as HeyReach, Expandi
- Simple and reliable
- Industry standard

## Security & Privacy

### Is This Safe?
✅ **Yes!** This is the industry-standard method used by:
- HeyReach
- Expandi
- Dux-Soup
- PhantomBuster
- All major LinkedIn automation tools

### What Can You Do With Cookies?
- Send connection requests
- Send messages
- View profiles
- Like/comment on posts
- Everything LinkedIn allows via their API

### What We DON'T Do
- ❌ We don't store your password
- ❌ We don't login to your account
- ❌ We don't modify your LinkedIn settings
- ❌ We don't access personal data beyond what's needed

## Troubleshooting

### Cookie Not Working
1. Make sure you copied the complete cookie value
2. Check you're logged into LinkedIn when copying
3. Try logging out and back into LinkedIn
4. Clear LinkedIn cookies and login fresh

### Account Shows "Error" Status
1. Cookie may have expired
2. LinkedIn may have logged you out
3. Reconnect the account with fresh cookies

### Cookie Expired
- LinkedIn cookies usually last 1 year
- You'll need to reconnect if they expire
- We'll notify you when cookies need refreshing

## For Developers

### Database Schema
```sql
session_cookies JSONB
-- Stores: { "li_at": "cookie_value", "JSESSIONID": "session_id" }
```

### Connection Method
```typescript
connection_method: 'cookie' // HeyReach-style cookie auth
```

### Server Action
```typescript
createLinkedInAccount({
  email: 'user@example.com',
  li_at_cookie: 'AQEDATg4MTk3NjAwAAABj...',
  jsessionid_cookie: 'ajax:1234567...',
  connection_method: 'cookie'
})
```

## References

- [HeyReach](https://heyreach.io) - Uses cookie method
- [Expandi](https://expandi.io) - Uses cookie method
- [LinkedIn Cookie Guide](../public/extension-guide.html) - Our visual guide

## Support

Need help? Common issues:

1. **"Invalid cookie format"**: Make sure you copied the entire `li_at` cookie value
2. **"Connection failed"**: Try logging out of LinkedIn and back in, then get fresh cookies
3. **"Account disconnected"**: Cookies expired, reconnect with new ones

---

**Last Updated**: January 2026
**Method**: Cookie-based authentication (HeyReach-compatible)
