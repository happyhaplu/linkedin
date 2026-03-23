<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Campaign, AssignCampaignsRequest } from '@/types'

const props = defineProps<{
  show: boolean
  accountId: string
  accountEmail: string
  currentCampaigns: string[]
  availableCampaigns: Campaign[]
}>()

const emit = defineEmits<{
  close: []
  assign: [data: AssignCampaignsRequest]
}>()

const selectedIds = ref<string[]>([])

watch(
  () => props.show,
  (open) => {
    if (open) {
      selectedIds.value = [...(props.currentCampaigns || [])]
    }
  }
)

function toggleCampaign(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx === -1) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value.splice(idx, 1)
  }
}

function handleSubmit() {
  emit('assign', { campaign_ids: selectedIds.value })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Assign Campaigns</h2>
          <button class="text-gray-400 hover:text-gray-600 p-1" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-600">
            Select campaigns for <strong>{{ accountEmail }}</strong>
          </p>

          <div v-if="availableCampaigns.length === 0" class="p-4 text-center text-gray-500 text-sm">
            No campaigns available. Create a campaign first.
          </div>

          <div v-else class="space-y-2 max-h-60 overflow-y-auto">
            <label
              v-for="campaign in availableCampaigns"
              :key="campaign.id"
              class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              :class="selectedIds.includes(campaign.id) ? 'border-blue-300 bg-blue-50' : ''"
            >
              <input
                type="checkbox"
                :checked="selectedIds.includes(campaign.id)"
                class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                @change="toggleCampaign(campaign.id)"
              />
              <div>
                <div class="text-sm font-medium text-gray-900">{{ campaign.name }}</div>
                <div class="text-xs text-gray-500">{{ campaign.status }}</div>
              </div>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" @click="emit('close')">
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            @click="handleSubmit"
          >
            Save ({{ selectedIds.length }} selected)
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
