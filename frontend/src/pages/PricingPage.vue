<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const STRIPE_PRICING_TABLE_ID = 'prctbl_1TL9FoHKFrC8ZGXqNGSdFK9h'
const STRIPE_PUBLISHABLE_KEY = 'pk_test_t4mp0WXS94q9ZBcAiHYJLqqJ00B2DYsxGS'

const customFeatures = [
  'Unlimited LinkedIn accounts',
  'Custom sender limits',
  'Priority support',
  'Dedicated onboarding',
  'Custom integrations',
  'SLA guarantee',
]
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="/brand/icon.svg" alt="Reach" class="h-8 w-8" />
        <span class="text-xl font-bold text-gray-900">Reach</span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="authStore.user" class="text-sm text-gray-500">{{ authStore.user.email }}</span>
        <router-link
          v-if="authStore.isAuthenticated"
          to="/linkedin-account"
          class="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to app
        </router-link>
      </div>
    </header>

    <!-- Hero -->
    <div class="text-center pt-14 pb-10 px-4">
      <h1 class="text-4xl font-bold text-gray-900 mb-3">Choose your plan</h1>
      <p class="text-lg text-gray-500 max-w-xl mx-auto">
        Power up your LinkedIn outreach. Start with a Stripe plan or contact us for a custom enterprise deal.
      </p>
    </div>

    <!-- Plans grid -->
    <div class="max-w-6xl mx-auto px-6 pb-20 flex flex-col lg:flex-row gap-10 items-start justify-center">

      <!-- Stripe Pricing Table -->
      <div class="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-6 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Subscription Plans</h2>
          <p class="text-sm text-gray-400 mt-1">Billed via Stripe. Cancel any time.</p>
        </div>
        <div class="p-6">
          <!-- Stripe pricing table web component -->
          <stripe-pricing-table
            :pricing-table-id="STRIPE_PRICING_TABLE_ID"
            :publishable-key="STRIPE_PUBLISHABLE_KEY"
            :customer-email="authStore.user?.email || ''"
          />
        </div>
      </div>

      <!-- Custom Plan Card -->
      <div class="w-full lg:w-80 flex-shrink-0 bg-[#1a1a2e] text-white rounded-2xl shadow-lg overflow-hidden">
        <!-- Badge -->
        <div class="bg-blue-600 text-center py-2 text-xs font-semibold tracking-widest uppercase">
          Enterprise / Custom
        </div>

        <div class="p-8">
          <h2 class="text-2xl font-bold mb-1">Custom Plan</h2>
          <p class="text-gray-400 text-sm mb-6">Tailored for agencies &amp; power users</p>

          <div class="text-4xl font-bold mb-1">
            Let's talk
          </div>
          <p class="text-gray-400 text-sm mb-8">Pricing based on your needs</p>

          <!-- Features -->
          <ul class="space-y-3 mb-8">
            <li
              v-for="feature in customFeatures"
              :key="feature"
              class="flex items-center gap-3 text-sm"
            >
              <span class="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center">
                <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {{ feature }}
            </li>
          </ul>

          <!-- CTA -->
          <a
            href="mailto:support@gour.io?subject=Custom Plan Inquiry"
            class="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Get in Touch
          </a>
          <p class="text-center text-xs text-gray-500 mt-3">
            Or reach out via live chat
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tell Vue that stripe-pricing-table is a custom element */
</style>
