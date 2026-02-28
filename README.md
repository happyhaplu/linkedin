# LinkedIn Automation & Management Platform

A comprehensive LinkedIn automation and management platform built with Next.js 14 and Supabase, featuring multi-account management, campaigns, unified inbox, and more.

## 🎯 Core Features

### ✅ **Authentication & User Management**
- Email/Password Sign Up & Login
- Password Reset & Forgot Password
- Email Verification
- Secure Session Management
- User Profile Management

### ✅ **LinkedIn Account Management**
- Multi-account support
- Cookie-based authentication (99% success rate)
- Mandatory proxy configuration
- Account status monitoring
- Connection tracking

### ✅ **Unified Inbox (Unibox)** 🆕
- **All messages from all LinkedIn accounts in one place**
- HeyReach-style beautiful interface
- Real-time message threading
- Search & filter conversations
- Archive & unread management
- Send replies directly from inbox
- Auto-mark as read
- **[Full Documentation →](./UNIBOX_COMPLETE.md)**

### ✅ **Campaign Management**
- Create and manage LinkedIn outreach campaigns
- Grid and list view toggle
- Campaign statistics dashboard
- Lead tracking and management
- Sequence builder
- Launch/Pause/Resume controls

### ✅ **My Network Module**
- View and manage LinkedIn connections
- Filter by connection degree
- Search functionality
- Bulk actions
- Connection insights

### ✅ **Leads Management**
- Import leads from CSV (HeyReach format)
- Custom fields support
- List management
- Lead enrichment
- Campaign assignment

### ✅ **Analytics Dashboard**
- Account performance metrics
- Campaign analytics
- Engagement tracking
- Response rates

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Authentication:** Supabase Auth
- **Styling:** Tailwind CSS
- **Database:** Supabase PostgreSQL

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### Installation

1. Clone the repository or navigate to the project directory:
```bash
cd /home/harekrishna/Projects/Linkedin
```

2. Install dependencies:
```bash
npm install
```

3. The environment variables are already configured in `.env.local`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── auth/                  # Authentication routes
│   ├── dashboard/             # Main dashboard
│   ├── profile/               # User profile
│   ├── linkedin-account/      # LinkedIn account management
│   ├── unibox/               # 🆕 Unified inbox
│   ├── campaigns/             # Campaign management
│   ├── leads/                 # Lead management
│   ├── my-network/            # Network management
│   ├── analytics/             # Analytics dashboard
│   ├── login/                 # Login page
│   ├── signup/                # Sign up page
│   └── ...
├── components/
│   ├── Sidebar.tsx            # Main navigation
│   ├── ConnectAccountModal.tsx
│   ├── InfiniteLoginModal.tsx
│   └── ...
├── lib/
│   ├── supabase/              # Supabase clients
│   ├── linkedin-automation.ts
│   ├── linkedin-cookie-auth.ts
│   └── linkedin-message-sync.ts  # 🆕 Message sync
├── migrations/
│   ├── create-messages-tables.sql  # 🆕 Unibox tables
│   └── ...
└── ...
```

## Quick Start Guides

### 📧 Unified Inbox Setup
See **[QUICK_START_UNIBOX.md](./QUICK_START_UNIBOX.md)** for:
- Database setup (one command)
- Adding test data
- Using the interface
- LinkedIn integration

### 🚀 LinkedIn Accounts
See **[LINKEDIN_MODULE_COMPLETE.md](./LINKEDIN_MODULE_COMPLETE.md)**

### 📊 Campaigns
See **[CAMPAIGNS_MODULE_COMPLETE.md](./CAMPAIGNS_MODULE_COMPLETE.md)**

### 👥 My Network
See **[MY_NETWORK_MODULE_COMPLETE.md](./MY_NETWORK_MODULE_COMPLETE.md)**

### 📋 Leads
See **[LEADS_COMPLETE.md](./LEADS_COMPLETE.md)**

## Available Routes

### Core Application
- `/` - Home page
- `/login` - Sign in
- `/signup` - Create account
- `/dashboard` - Main dashboard
- `/profile` - User profile & settings

### LinkedIn Management
- `/linkedin-account` - Manage LinkedIn accounts
- `/unibox` - 🆕 **Unified inbox for all messages**
- `/campaigns` - Campaign management
- `/campaigns/new` - Create campaign
- `/leads` - Lead management
- `/my-network` - Network management
- `/analytics` - Analytics & insights

### Profile Management
- View account details
- Update password
- See account creation date
- Email verification status

### Dashboard
- User welcome screen
- Account information display
- Quick access to profile
- Security status
- Activity tracking (coming soon)

## Supabase Configuration

The app is pre-configured with your Supabase credentials:

- **Project URL:** https://rlsyvgjcxxoregwrwuzf.supabase.co
- **Auth:** Email/Password enabled
- **Database:** PostgreSQL with Row Level Security

### Important Notes

1. **Email Verification:** Make sure email verification is configured in your Supabase project settings
2. **Email Templates:** Customize email templates in Supabase Dashboard > Authentication > Email Templates
3. **Redirect URLs:** Add your deployment URL to Supabase Dashboard > Authentication > URL Configuration

## Customization

### Color Theme

The blue color theme can be customized in [tailwind.config.ts](tailwind.config.ts):

```typescript
colors: {
  primary: {
    // Modify these values to change the theme
    500: '#3b82f6',
    600: '#2563eb',
    // ...
  }
}
```

### Gradients

Custom gradient classes are defined in [app/globals.css](app/globals.css):

```css
.gradient-blue {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.gradient-blue-light {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
}
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

### Update Supabase Redirect URLs

After deployment, add your production URL to Supabase:
1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your production URL to "Site URL"
3. Add `https://your-domain.com/auth/callback` to "Redirect URLs"

## Security Best Practices

✅ Environment variables are properly configured
✅ Server-side authentication checks
✅ Protected routes with middleware
✅ Secure session management
✅ CSRF protection via Supabase
✅ SQL injection protection via Supabase RLS

## Troubleshooting

### "Invalid credentials" error
- Check email and password are correct
- Verify email is confirmed in Supabase Dashboard

### Email not received
- Check spam folder
- Verify SMTP settings in Supabase
- Check email rate limits

### Redirect issues
- Verify callback URL in Supabase settings
- Check middleware configuration
- Clear browser cookies

## Support

For issues related to:
- **Supabase:** [Supabase Documentation](https://supabase.com/docs)
- **Next.js:** [Next.js Documentation](https://nextjs.org/docs)
- **Tailwind CSS:** [Tailwind Documentation](https://tailwindcss.com/docs)

## License

This project is open source and available under the MIT License.
