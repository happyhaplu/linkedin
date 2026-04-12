<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { admin } from '@/api/admin'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await admin.login(email.value, password.value)
    router.push('/admin/users')
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Invalid credentials'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0f0f1a] flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img src="/brand/icon.svg" alt="Reach" class="h-10 w-10 mx-auto mb-3" />
        <h1 class="text-2xl font-bold text-white">Admin Panel</h1>
        <p class="text-gray-400 text-sm mt-1">Sign in with admin credentials</p>
      </div>

      <!-- Card -->
      <div class="bg-[#1a1a2e] border border-white/10 rounded-2xl p-8">
        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Error -->
          <div v-if="error" class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
            {{ error }}
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm text-gray-300 mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="admin@example.com"
              class="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm text-gray-300 mb-1.5">Password</label>
            <input
              v-model="password"
              type="password"
              required
              placeholder="••••••••"
              class="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-2"
          >
            <span v-if="loading">Signing in…</span>
            <span v-else>Sign In</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
