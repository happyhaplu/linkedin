<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

interface NavItem {
  label: string
  path: string
  icon: string
}

const navItems: NavItem[] = [
  { label: 'Analytics', path: '/analytics', icon: 'analytics' },
  { label: 'Linkedin Account', path: '/linkedin-account', icon: 'linkedin' },
  { label: 'Leads', path: '/leads', icon: 'leads' },
  { label: 'Campaigns', path: '/campaigns', icon: 'campaigns' },
  { label: 'My Network', path: '/my-network', icon: 'network' },
  { label: 'Unibox', path: '/unibox', icon: 'unibox' },
]

function isActive(path: string): boolean {
  return route.path === path
}

const currentYear = computed(() => new Date().getFullYear())

async function handleSignOut() {
  await authStore.signOut()
}
</script>

<template>
  <aside class="w-56 bg-[#1a1a2e] text-white flex flex-col min-h-screen">
    <!-- Brand -->
    <div class="p-5 border-b border-white/10">
      <router-link to="/linkedin-account" class="flex items-center gap-2">
        <img src="/brand/icon.svg" alt="Reach" class="h-7 w-7 flex-shrink-0" />
        <span class="text-lg font-semibold">Reach</span>
      </router-link>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 py-4 px-3 space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
        :class="
          isActive(item.path)
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        "
      >
        <!-- Analytics -->
        <svg v-if="item.icon === 'analytics'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <!-- LinkedIn -->
        <svg v-else-if="item.icon === 'linkedin'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <!-- Leads -->
        <svg v-else-if="item.icon === 'leads'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <!-- Campaigns -->
        <svg v-else-if="item.icon === 'campaigns'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        <!-- Network -->
        <svg v-else-if="item.icon === 'network'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        <!-- Unibox -->
        <svg v-else-if="item.icon === 'unibox'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>

        {{ item.label }}
      </router-link>
    </nav>

    <!-- Footer -->
    <div class="p-4 border-t border-white/10">
      <!-- User info -->
      <div v-if="authStore.user" class="px-3 py-2 mb-2">
        <div class="text-sm text-white font-medium truncate">{{ authStore.user.email }}</div>
        <div class="text-xs text-gray-400">{{ authStore.user.plan || 'Free' }} plan</div>
      </div>

      <router-link
        to="/profile"
        class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
        :class="
          $route.path === '/profile'
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        "
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm">My Account</span>
      </router-link>

      <!-- Sign Out -->
      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors mt-1"
        @click="handleSignOut"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span class="text-sm">Sign Out</span>
      </button>

      <p class="text-xs text-gray-500 text-center mt-2">© {{ currentYear }} Reach</p>
    </div>
  </aside>
</template>
