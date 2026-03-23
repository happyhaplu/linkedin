<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LinkedInAccount, UpdateLimitsRequest } from '@/types'

const props = defineProps<{
  show: boolean
  account: LinkedInAccount | null
}>()

const emit = defineEmits<{
  close: []
  submit: [data: UpdateLimitsRequest]
}>()

const connectionRequests = ref(25)
const messages = ref(50)
const inmails = ref(10)

watch(
  () => props.show,
  (open) => {
    if (open && props.account) {
      connectionRequests.value = props.account.sending_limits?.connection_requests_per_day ?? 25
      messages.value = props.account.sending_limits?.messages_per_day ?? 50
      inmails.value = props.account.sending_limits?.inmails_per_day ?? 10
    }
  }
)

function handleSubmit() {
  emit('submit', {
    connection_requests_per_day: connectionRequests.value,
    messages_per_day: messages.value,
    inmails_per_day: inmails.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Configure Daily Limits</h2>
          <button class="text-gray-400 hover:text-gray-600 p-1" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            💡 We recommend starting with conservative limits and gradually increasing them over 2-4 weeks to warm up your account.
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Connection Requests per Day
            </label>
            <input
              v-model.number="connectionRequests"
              type="number"
              min="0"
              max="100"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p class="text-xs text-gray-400 mt-1">Recommended: 15-30 per day</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Messages per Day
            </label>
            <input
              v-model.number="messages"
              type="number"
              min="0"
              max="150"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p class="text-xs text-gray-400 mt-1">Recommended: 30-70 per day</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              InMails per Day
            </label>
            <input
              v-model.number="inmails"
              type="number"
              min="0"
              max="50"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p class="text-xs text-gray-400 mt-1">Recommended: 5-15 per day</p>
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
            Save Limits
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
