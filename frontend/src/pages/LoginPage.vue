<script setup lang="ts">
/**
 * LoginPage — redirects to accounts.gour.io for authentication.
 *
 * Auth flow:
 * 1. User visits /login
 * 2. We redirect to: accounts.gour.io/products/reach/launch?redirect_uri=<backend>/auth/callback
 * 3. Accounts authenticates the user, signs a launch JWT
 * 4. Accounts redirects to Go backend: /auth/callback?token=<jwt>
 * 5. Go backend verifies JWT, sets session cookies, redirects to frontend /dashboard
 * 6. Vue router guard sees the cookie, allows access
 */
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

onMounted(async () => {
  // If already authenticated, go straight to dashboard
  if (!authStore.checked) {
    await authStore.fetchUser()
  }
  if (authStore.isAuthenticated) {
    router.replace('/linkedin-account')
    return
  }

  // Redirect to Accounts service for authentication
  // The Go backend's AppURL is the same origin (proxied via Vite in dev)
  // Accounts will redirect back to: <APP_URL>/auth/callback?token=<jwt>
  // Then the Go backend redirects to: <FRONTEND_URL>/dashboard
  const backendUrl = window.location.origin
  const accountsUrl = 'https://accounts.gour.io'
  const callbackUrl = `${backendUrl}/auth/callback`
  const loginUrl = `${accountsUrl}/products/reach/launch?redirect_uri=${encodeURIComponent(callbackUrl)}`

  window.location.href = loginUrl
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <img src="/brand/icon.svg" alt="Reach" class="w-16 h-16 mx-auto mb-6" />
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Reach</h1>
      <p class="text-gray-500 mb-6">Redirecting to login...</p>
      <div class="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
    </div>
  </div>
</template>
