import axios from 'axios'

// Separate axios instance hitting /admin (no /api prefix, uses admin cookie)
const adminApi = axios.create({
  baseURL: '/admin',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

export interface AdminUser {
  id: string
  workspace_id: string
  user_email: string
  plan_id: string
  plan?: {
    id: string
    name: string
    type: string
    max_linkedin_senders: number
  }
  status: string
  stripe_customer_id: string
  stripe_subscription_id: string
  max_linkedin_senders: number
  is_active: boolean
  assigned_by_admin: boolean
  notes: string
  created_at: string
  updated_at: string
}

export interface AdminPlan {
  id: string
  name: string
  type: 'stripe' | 'custom'
  description: string
  price_monthly: number
  stripe_price_id: string
  stripe_product_id: string
  max_linkedin_senders: number
  max_campaigns: number
  max_leads: number
  features: string
  is_active: boolean
  created_at: string
}

export const admin = {
  login(email: string, password: string) {
    return adminApi.post('/login', { email, password })
  },
  logout() {
    return adminApi.post('/logout')
  },
  me() {
    return adminApi.get('/me')
  },

  // Users
  listUsers(): Promise<{ data: { users: AdminUser[] } }> {
    return adminApi.get('/users')
  },
  getUser(workspaceId: string): Promise<{ data: { user: AdminUser } }> {
    return adminApi.get(`/users/${workspaceId}`)
  },
  updateUser(workspaceId: string, payload: Partial<AdminUser>): Promise<{ data: { user: AdminUser } }> {
    return adminApi.put(`/users/${workspaceId}`, payload)
  },
  assignPlan(workspaceId: string, payload: { plan_id: string; max_linkedin_senders?: number; notes?: string }): Promise<{ data: { user: AdminUser } }> {
    return adminApi.post(`/users/${workspaceId}/assign-plan`, payload)
  },

  // Plans
  listPlans(): Promise<{ data: { plans: AdminPlan[] } }> {
    return adminApi.get('/plans')
  },
  createPlan(payload: Partial<AdminPlan>): Promise<{ data: { plan: AdminPlan } }> {
    return adminApi.post('/plans', payload)
  },
  updatePlan(id: string, payload: Partial<AdminPlan>): Promise<{ data: { plan: AdminPlan } }> {
    return adminApi.put(`/plans/${id}`, payload)
  },
}
