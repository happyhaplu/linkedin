<script setup lang="ts">
/**
 * ProfilePage — read-only user profile page.
 *
 * Shows the authenticated user's email, ID, plan, and provides links to the
 * external Accounts dashboard (accounts.gour.io) for account management
 * and billing / subscription management.
 */
import { ref, onMounted, computed } from 'vue'
import { authApi, type ProfileData } from '@/api/auth'

const loading = ref(true)
const error = ref('')
const profile = ref<ProfileData | null>(null)

const user = computed(() => profile.value?.user)
const avatar = computed(() => user.value?.email?.charAt(0).toUpperCase() || '?')

onMounted(async () => {
  try {
    profile.value = await authApi.profile()
  } catch {
    error.value = 'Failed to load profile.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="flex items-center justify-center h-full py-32">
    <div class="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
  </div>

  <!-- Error -->
  <div v-else-if="error" class="flex items-center justify-center h-full py-32">
    <div class="text-center">
      <div class="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-gray-600 text-sm">{{ error }}</p>
    </div>
  </div>

  <!-- Profile Content -->
  <div v-else class="p-6 max-w-3xl mx-auto">
    <h1 class="text-xl font-semibold text-gray-900 mb-6">Profile Settings</h1>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <!-- Header with avatar -->
      <div class="flex items-center mb-8">
        <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold shrink-0">
          {{ avatar }}
        </div>
        <div class="ml-6">
          <h2 class="text-2xl font-bold text-gray-900 mb-1">Profile Settings</h2>
          <p class="text-gray-600">{{ user?.email }}</p>
          <span class="inline-block mt-1 text-sm font-medium text-blue-600">
            {{ user?.plan || 'Free' }} plan
          </span>
        </div>
      </div>

      <!-- Account Details -->
      <div class="border-t border-gray-200 pt-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-6">Account Details</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p class="text-sm font-medium text-gray-500 mb-1">Email Address</p>
            <p class="text-gray-900">{{ user?.email }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p class="text-sm font-medium text-gray-500 mb-1">User ID</p>
            <p class="font-mono text-xs text-gray-900 break-all">{{ user?.id }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p class="text-sm font-medium text-gray-500 mb-1">Workspace ID</p>
            <p class="font-mono text-xs text-gray-900 break-all">{{ user?.workspace_id }}</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p class="text-sm font-medium text-gray-500 mb-1">Subscription</p>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="user?.subscribed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
            >
              {{ user?.subscribed ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Account Management -->
      <div class="border-t border-gray-200 mt-8 pt-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Account Management</h3>
        <p class="text-gray-600 mb-6 text-sm">
          Password changes, billing, and subscription management are handled through your Accounts dashboard.
        </p>
        <div class="flex flex-wrap gap-3">
          <a
            :href="profile?.manage_account_url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm"
          >
            <span>Manage Account</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            :href="profile?.billing_url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-6 rounded-lg transition-colors text-sm"
          >
            <span>Billing &amp; Subscription</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
