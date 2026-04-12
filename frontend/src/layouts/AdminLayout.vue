<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { admin } from '@/api/admin'

const router = useRouter()
const route = useRoute()
const adminEmail = ref('')
const checking = ref(true)

onMounted(async () => {
  try {
    const res = await admin.me()
    adminEmail.value = res.data.email
  } catch {
    router.replace('/admin/login')
  } finally {
    checking.value = false
  }
})

async function handleLogout() {
  await admin.logout()
  router.push('/admin/login')
}

const navItems = [
  { label: 'Users', path: '/admin/users', icon: 'users' },
  { label: 'Plans', path: '/admin/plans', icon: 'plans' },
]

function isActive(path: string) {
  return route.path.startsWith(path)
}
</script>

<template>
  <div v-if="checking" class="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
    <div class="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
  </div>

  <div v-else class="flex h-screen bg-gray-100">
    <!-- Sidebar -->
    <aside class="w-56 bg-[#1a1a2e] text-white flex flex-col min-h-screen">
      <!-- Brand -->
      <div class="p-5 border-b border-white/10">
        <div class="flex items-center gap-2">
          <img src="/brand/icon.svg" alt="Reach" class="h-7 w-7" />
          <div>
            <div class="text-sm font-bold leading-none">Reach Admin</div>
            <div class="text-xs text-gray-400 mt-0.5">Control Panel</div>
          </div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 py-4 px-3 space-y-1">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="isActive(item.path)
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          <!-- Users icon -->
          <svg v-if="item.icon === 'users'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <!-- Plans icon -->
          <svg v-else-if="item.icon === 'plans'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          {{ item.label }}
        </router-link>
      </nav>

      <!-- Footer -->
      <div class="p-4 border-t border-white/10">
        <div class="text-xs text-gray-400 mb-2 truncate">{{ adminEmail }}</div>
        <button
          @click="handleLogout"
          class="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
        <router-link
          to="/linkedin-account"
          class="mt-1 w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to App
        </router-link>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
