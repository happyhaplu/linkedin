<script setup lang="ts">
import { ref, watch } from 'vue'
import type { VerifyOTPRequest } from '@/types'

const props = defineProps<{
  show: boolean
  accountEmail: string
}>()

const emit = defineEmits<{
  close: []
  verify: [data: VerifyOTPRequest]
}>()

const otp = ref('')
const submitting = ref(false)

watch(
  () => props.show,
  (open) => {
    if (open) {
      otp.value = ''
      submitting.value = false
    }
  }
)

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  otp.value = target.value.replace(/\D/g, '').slice(0, 6)
}

async function handleSubmit() {
  if (otp.value.length !== 6) return
  submitting.value = true
  try {
    emit('verify', { otp: otp.value })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">OTP Verification</h2>
          <button class="text-gray-400 hover:text-gray-600 p-1" @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-600">
            LinkedIn has sent a verification code to <strong>{{ accountEmail }}</strong>. Please enter the 6-digit code below.
          </p>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
            <input
              :value="otp"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="000000"
              class="w-full px-3 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              @input="handleInput"
            />
          </div>
          <p class="text-xs text-gray-400 text-center">
            Check your email inbox and spam folder for the code.
          </p>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" @click="emit('close')">
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            :disabled="otp.length !== 6 || submitting"
            @click="handleSubmit"
          >
            {{ submitting ? 'Verifying...' : 'Verify OTP' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
