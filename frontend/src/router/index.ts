import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  // ── Public routes (no auth required) ──────────────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true },
  },
  // ── Protected routes (require auth) ───────────────────────────────────
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

// ── Navigation guard: check auth before entering protected routes ────────
router.beforeEach(async (to) => {
  // Allow public routes (login)
  if (to.meta.public) return true

  const authStore = useAuthStore()

  // Fetch user if not checked yet (first load / hard refresh)
  if (!authStore.checked) {
    await authStore.fetchUser()
  }

  // Not authenticated → redirect to login
  if (!authStore.isAuthenticated) {
    return { name: 'login' }
  }

  return true
})

export default router
