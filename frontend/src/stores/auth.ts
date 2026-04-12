import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, type AuthUser } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(true)
  const checked = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const userEmail = computed(() => user.value?.email || '')
  const hasPlan = computed(() => !!user.value?.plan_active)
  const planStatus = computed(() => user.value?.plan_status || 'inactive')
  const senderLimit = computed(() => user.value?.sender_limit ?? 0)

  /**
   * Fetch the current session from the Go backend.
   * The backend reads the `reach-session` HttpOnly cookie and returns the user.
   * If not authenticated, the API returns 401 — we catch it and set user to null.
   */
  async function fetchUser() {
    loading.value = true
    try {
      const data = await authApi.me()
      user.value = data.user
    } catch {
      user.value = null
    } finally {
      loading.value = false
      checked.value = true
    }
  }

  /**
   * Sign out: call Go backend to clear cookies, then redirect to Accounts logout.
   */
  async function signOut() {
    try {
      const data = await authApi.signout()
      user.value = null
      // Navigate to Accounts service logout (clears Accounts session, redirects back)
      window.location.href = data.logout_url
    } catch {
      // Fallback: just go to login
      window.location.href = '/login'
    }
  }

  return {
    user,
    loading,
    checked,
    isAuthenticated,
    userEmail,
    hasPlan,
    planStatus,
    senderLimit,
    fetchUser,
    signOut,
  }
})
