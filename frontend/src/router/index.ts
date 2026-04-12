import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Inject Stripe.js once for the pricing table web component
function ensureStripeJs() {
  if (document.querySelector('script[data-stripe]')) return
  const s = document.createElement('script')
  s.src = 'https://js.stripe.com/v3/pricing-table.js'
  s.async = true
  s.setAttribute('data-stripe', '1')
  document.head.appendChild(s)
}

const routes: RouteRecordRaw[] = [
  // ── Fully public ──────────────────────────────────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true },
  },
  // Pricing — accessible when logged in but no plan
  {
    path: '/pricing',
    name: 'pricing',
    component: () => import('@/pages/PricingPage.vue'),
    meta: { public: false, noPlanOk: true },
    beforeEnter: () => ensureStripeJs(),
  },

  // ── Admin (separate session cookie, independent from user auth) ───────
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/pages/admin/AdminLoginPage.vue'),
    meta: { public: true, admin: true },
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      { path: '', redirect: '/admin/users' },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/pages/admin/AdminUsersPage.vue'),
      },
      {
        path: 'plans',
        name: 'admin-plans',
        component: () => import('@/pages/admin/AdminPlansPage.vue'),
      },
    ],
  },

  // ── User app (requires auth + active plan) ────────────────────────────
  {
    path: '/',
    redirect: '/linkedin-account',
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: 'linkedin-account',
        name: 'linkedin-account',
        component: () => import('@/pages/LinkedInAccountsPage.vue'),
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        redirect: '/linkedin-account',
      },
      {
        path: 'leads',
        name: 'leads',
        component: () => import('@/pages/leads/LeadsPage.vue'),
        meta: { title: 'Leads' },
      },
      {
        path: 'leads/lists',
        name: 'lead-lists',
        component: () => import('@/pages/leads/LeadListsPage.vue'),
        meta: { title: 'Lead Lists' },
      },
      {
        path: 'campaigns',
        name: 'campaigns',
        component: () => import('@/pages/campaigns/CampaignListPage.vue'),
        meta: { title: 'Campaigns' },
      },
      {
        path: 'campaigns/new',
        name: 'campaign-create',
        component: () => import('@/pages/campaigns/CampaignCreatePage.vue'),
        meta: { title: 'New Campaign' },
      },
      {
        path: 'campaigns/:id',
        name: 'campaign-detail',
        component: () => import('@/pages/campaigns/CampaignDetailPage.vue'),
        meta: { title: 'Campaign Detail' },
      },
      {
        path: 'my-network',
        name: 'my-network',
        component: () => import('@/pages/network/MyNetworkPage.vue'),
        meta: { title: 'My Network' },
      },
      {
        path: 'unibox',
        name: 'unibox',
        component: () => import('@/pages/unibox/UniboxPage.vue'),
        meta: { title: 'Unibox' },
      },
      {
        path: 'analytics',
        name: 'analytics',
        component: () => import('@/pages/analytics/AnalyticsPage.vue'),
        meta: { title: 'Analytics' },
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/pages/ProfilePage.vue'),
        meta: { title: 'Profile' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── Navigation guard ─────────────────────────────────────────────────────
router.beforeEach(async (to) => {
  // Admin routes use their own cookie — skip user auth checks
  if (to.meta.admin) return true

  // Truly public (login page)
  if (to.meta.public) return true

  const authStore = useAuthStore()

  // Fetch user once per session load
  if (!authStore.checked) {
    await authStore.fetchUser()
  }

  // Not authenticated → login
  if (!authStore.isAuthenticated) {
    return { name: 'login' }
  }

  // Pricing page: always accessible for authenticated users (to let them checkout)
  if (to.meta.noPlanOk) return true

  // No active plan → /pricing
  if (!authStore.hasPlan) {
    return { name: 'pricing' }
  }

  return true
})

export default router
