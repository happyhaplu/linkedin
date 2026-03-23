<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useLeadsStore } from '@/stores/leads'

const store = useLeadsStore()

// ── Create List Modal ────────────────────────────────
const showCreateModal = ref(false)
const newListName = ref('')
const newListDescription = ref('')
const creating = ref(false)

function openCreateModal() {
  newListName.value = ''
  newListDescription.value = ''
  showCreateModal.value = true
}

async function handleCreateList() {
  if (!newListName.value.trim()) return
  creating.value = true
  try {
    await store.createList({
      name: newListName.value.trim(),
      description: newListDescription.value.trim() || undefined,
    })
    showCreateModal.value = false
  } finally {
    creating.value = false
  }
}

async function handleDeleteList(id: string, name: string) {
  if (!confirm(`Delete list "${name}"? Leads in this list will NOT be deleted.`)) return
  await store.deleteList(id)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(() => {
  store.fetchLists()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Lead Lists</h1>
        <p class="text-sm text-gray-500 mt-1">Organize your leads into targeted lists</p>
      </div>
    </header>

    <main class="flex-1 overflow-auto p-6">
      <div class="max-w-7xl mx-auto">
        <!-- Header actions -->
        <div class="flex justify-between items-center mb-6">
          <router-link
            to="/leads"
            class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Leads
          </router-link>
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
            @click="openCreateModal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Create List
          </button>
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="text-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          <p class="text-gray-500 mt-4">Loading lists...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="store.lists.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
          <div class="text-5xl mb-4">📋</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">No Lists Yet</h3>
          <p class="text-gray-500 mb-6">Create your first list to organize your leads</p>
          <button
            class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 font-medium"
            @click="openCreateModal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Your First List
          </button>
        </div>

        <!-- Lists Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="list in store.lists"
            :key="list.id"
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow group"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="text-base font-semibold text-gray-900 truncate">{{ list.name }}</h3>
                <p v-if="list.description" class="text-sm text-gray-500 mt-1 line-clamp-2">{{ list.description }}</p>
              </div>
              <button
                class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Delete list"
                @click.stop="handleDeleteList(list.id, list.name)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div class="flex items-center gap-3 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {{ list.lead_count || 0 }} leads
                </span>
                <span>Created {{ formatDate(list.created_at) }}</span>
              </div>
              <router-link
                :to="{ path: '/leads', query: { list_id: list.id } }"
                class="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
              >
                View Leads →
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ═══ Create List Modal ═══ -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showCreateModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">Create New List</h2>
          <button class="p-2 hover:bg-gray-100 rounded-lg" @click="showCreateModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">List Name *</label>
            <input
              v-model="newListName"
              type="text"
              placeholder="e.g. Tech Founders, Marketing Leads..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @keyup.enter="handleCreateList"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              v-model="newListDescription"
              rows="3"
              placeholder="Optional description..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
        <div class="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="showCreateModal = false"
          >
            Cancel
          </button>
          <button
            :disabled="!newListName.trim() || creating"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            @click="handleCreateList"
          >
            {{ creating ? 'Creating...' : 'Create List' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
