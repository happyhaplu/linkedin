<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCampaignStore } from '@/stores/campaigns'
import type { CreateCampaignInput, CreateSequenceInput, SequenceStepType } from '@/types/campaign'

const route = useRoute()
const router = useRouter()
const store = useCampaignStore()

const currentStep = ref(1)
const loading = ref(false)
const showSafetySettings = ref(false)

const steps = [
  { id: 1, label: 'Basic Info', icon: '📝' },
  { id: 2, label: 'Senders', icon: '👤' },
  { id: 3, label: 'Sequence', icon: '⚡' },
  { id: 4, label: 'Review', icon: '✅' },
]

const formData = ref<CreateCampaignInput>({
  name: '',
  description: '',
  lead_list_id: '',
  daily_limit: 25,
  timezone: 'UTC',
  working_hours_start: '09:00',
  working_hours_end: '18:00',
  working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  delay_min_seconds: 30,
  delay_max_seconds: 120,
  warm_up_enabled: false,
  warm_up_days: 14,
  auto_pause_below_acceptance: 10,
  skip_already_contacted: true,
  stop_on_reply: true,
  sender_ids: [],
  sequences: [],
})

const sequences = ref<CreateSequenceInput[]>([
  {
    step_number: 1,
    step_type: 'connection_request',
    message_template: 'Hi {first_name}, I came across your profile and was impressed by your work at {company}. Would love to connect!',
    delay_days: 0,
    delay_hours: 0,
    ab_test_enabled: false,
    message_template_b: '',
    condition_type: '',
  },
])

const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const selectedSenders = computed({
  get: () => new Set(formData.value.sender_ids || []),
  set: (val: Set<string>) => { formData.value.sender_ids = Array.from(val) },
})

onMounted(async () => {
  await Promise.all([store.fetchLinkedInAccounts(), store.fetchLists()])
  const templateParam = route.query.template as string
  if (templateParam) {
    await store.fetchTemplates()
    const template = store.templates.find((t) => t.id === templateParam)
    if (template) {
      formData.value.name = `${template.name} — Copy`
      formData.value.description = template.description || ''
      if (template.steps?.length) {
        sequences.value = template.steps.map((s, i) => ({
          step_number: i + 1,
          step_type: s.step_type as SequenceStepType,
          message_template: s.message_template || '',
          delay_days: s.delay_days || 0,
          delay_hours: s.delay_hours || 0,
          ab_test_enabled: s.ab_test_enabled || false,
          message_template_b: s.message_template_b || '',
          condition_type: s.condition_type || '',
        }))
      }
    }
  }
})

function toggleDay(day: string) {
  const days = formData.value.working_days || []
  if (days.includes(day)) {
    formData.value.working_days = days.filter((d) => d !== day)
  } else {
    formData.value.working_days = [...days, day]
  }
}

function toggleSender(accountId: string) {
  const set = new Set(formData.value.sender_ids || [])
  if (set.has(accountId)) set.delete(accountId)
  else set.add(accountId)
  formData.value.sender_ids = Array.from(set)
}

function addSequenceStep() {
  const lastStep = sequences.value[sequences.value.length - 1]
  sequences.value.push({
    step_number: sequences.value.length + 1,
    step_type: 'message',
    message_template: '',
    delay_days: 2,
    delay_hours: 0,
    ab_test_enabled: false,
    message_template_b: '',
    condition_type: lastStep?.step_type === 'connection_request' ? 'accepted' : '',
  })
}

function removeSequenceStep(idx: number) {
  sequences.value.splice(idx, 1)
  sequences.value.forEach((s, i) => (s.step_number = i + 1))
}

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return formData.value.name.trim().length > 0
  }
  if (currentStep.value === 2) {
    return (formData.value.sender_ids?.length || 0) > 0
  }
  if (currentStep.value === 3) {
    return sequences.value.length > 0 && sequences.value.every((s) => s.step_type)
  }
  return true
})

async function handleSubmit() {
  loading.value = true
  try {
    const campaign = await store.createCampaign({
      ...formData.value,
      sequences: sequences.value,
    })
    if (campaign) {
      router.push(`/campaigns/${campaign.id}`)
    }
  } catch (e: unknown) {
    alert('Failed to create campaign: ' + ((e as Error).message || 'Unknown error'))
  } finally {
    loading.value = false
  }
}

function goNext() {
  if (canProceed.value && currentStep.value < 4) {
    currentStep.value++
  } else if (currentStep.value === 4) {
    handleSubmit()
  }
}

function goBack() {
  if (currentStep.value > 1) currentStep.value--
  else router.push('/campaigns')
}

const stepTypes = [
  { value: 'connection_request', label: 'Connection Request', emoji: '🤝' },
  { value: 'message', label: 'Message', emoji: '💬' },
  { value: 'inmail', label: 'InMail', emoji: '📨' },
  { value: 'view_profile', label: 'View Profile', emoji: '👁️' },
  { value: 'like_post', label: 'Like Post', emoji: '❤️' },
  { value: 'follow', label: 'Follow', emoji: '➕' },
  { value: 'delay', label: 'Delay', emoji: '⏱️' },
]

const conditionTypes = [
  { value: '', label: 'No condition (always run)' },
  { value: 'accepted', label: 'If connection accepted' },
  { value: 'not_accepted', label: 'If connection NOT accepted' },
  { value: 'replied', label: 'If replied' },
  { value: 'not_replied', label: 'If NOT replied' },
  { value: 'open_inmail', label: 'If InMail opened' },
]
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between max-w-4xl mx-auto w-full">
        <div class="flex items-center gap-4">
          <button class="text-gray-400 hover:text-gray-600" @click="goBack">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-xl font-bold text-gray-900">New Campaign</h1>
        </div>
        <span class="text-sm text-gray-500">Step {{ currentStep }} of 4</span>
      </div>
    </header>

    <!-- Step Progress -->
    <div class="bg-white border-b border-gray-200 px-6 py-3">
      <div class="max-w-4xl mx-auto flex items-center gap-2">
        <template v-for="(step, idx) in steps" :key="step.id">
          <div
            class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
            :class="
              step.id === currentStep
                ? 'bg-blue-100 text-blue-700'
                : step.id < currentStep
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-50 text-gray-400'
            "
            @click="step.id < currentStep ? (currentStep = step.id) : undefined"
          >
            <span>{{ step.icon }}</span>
            <span class="hidden sm:inline">{{ step.label }}</span>
          </div>
          <div v-if="idx < steps.length - 1" class="flex-1 h-0.5" :class="step.id < currentStep ? 'bg-green-300' : 'bg-gray-200'" />
        </template>
      </div>
    </div>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <div class="max-w-4xl mx-auto p-6">
        <!-- ═══ Step 1: Basic Info ═══ -->
        <div v-if="currentStep === 1" class="space-y-6">
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
            <h2 class="text-base font-semibold text-gray-900">📝 Basic Information</h2>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name *</label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="e.g. Q1 SaaS Founder Outreach"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                v-model="formData.description"
                rows="3"
                placeholder="Optional notes about this campaign..."
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Lead List</label>
              <select v-model="formData.lead_list_id" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">No list (add leads later)</option>
                <option v-for="list in store.availableLists" :key="list.id" :value="list.id">
                  {{ list.name }} ({{ list.lead_count ?? list.leads_count ?? '?' }} leads)
                </option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Daily Limit</label>
                <input v-model.number="formData.daily_limit" type="number" min="1" max="200" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
                <p class="text-xs text-gray-400 mt-1">Max actions per day per sender. LinkedIn safe range: 15-40.</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                <select v-model="formData.timezone" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern (New York)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Berlin">Berlin</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Advanced Safety Settings -->
          <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <button
              class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              @click="showSafetySettings = !showSafetySettings"
            >
              <div class="flex items-center gap-2">
                <span>🛡️</span>
                <span class="text-base font-semibold text-gray-900">Advanced Safety Settings</span>
              </div>
              <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-180': showSafetySettings }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="showSafetySettings" class="px-6 pb-6 space-y-5 border-t border-gray-100 pt-5">
              <!-- Working hours -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Working Hours Start</label>
                  <input v-model="formData.working_hours_start" type="time" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Working Hours End</label>
                  <input v-model="formData.working_hours_end" type="time" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <!-- Working days -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Working Days</label>
                <div class="flex gap-2">
                  <button
                    v-for="day in allDays"
                    :key="day"
                    class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold transition-all border"
                    :class="formData.working_days?.includes(day) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'"
                    @click="toggleDay(day)"
                  >
                    {{ day[0] }}
                  </button>
                </div>
              </div>
              <!-- Delays -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Min Delay Between Actions (sec)</label>
                  <input v-model.number="formData.delay_min_seconds" type="number" min="5" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Max Delay Between Actions (sec)</label>
                  <input v-model.number="formData.delay_max_seconds" type="number" min="5" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <!-- Warm-up -->
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="formData.warm_up_enabled" type="checkbox" class="w-4 h-4 text-blue-600" />
                  <span class="text-sm text-gray-700">Enable warm-up</span>
                </label>
                <div v-if="formData.warm_up_enabled" class="flex items-center gap-2">
                  <input v-model.number="formData.warm_up_days" type="number" min="1" max="60" class="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  <span class="text-sm text-gray-500">days</span>
                </div>
              </div>
              <!-- Auto-pause -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Auto-pause if acceptance rate drops below (%)</label>
                <input v-model.number="formData.auto_pause_below_acceptance" type="number" min="0" max="100" class="w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <!-- Checkboxes -->
              <div class="flex flex-col gap-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="formData.skip_already_contacted" type="checkbox" class="w-4 h-4 text-blue-600" />
                  <span class="text-sm text-gray-700">Skip leads already contacted (across all campaigns)</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="formData.stop_on_reply" type="checkbox" class="w-4 h-4 text-blue-600" />
                  <span class="text-sm text-gray-700">Stop sequence when lead replies</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ Step 2: Senders ═══ -->
        <div v-if="currentStep === 2" class="space-y-6">
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 class="text-base font-semibold text-gray-900 mb-2">👤 Select Sender Accounts</h2>
            <p class="text-sm text-gray-500 mb-5">Choose which LinkedIn accounts will send outreach for this campaign. Multiple senders distribute the workload.</p>

            <div v-if="store.linkedInAccounts.length === 0" class="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-lg">
              <p class="text-3xl mb-2">🔗</p>
              <p class="font-medium">No LinkedIn accounts connected</p>
              <router-link to="/linkedin-account" class="text-blue-600 text-sm hover:underline mt-1 inline-block">Connect an account →</router-link>
            </div>
            <div v-else class="space-y-3">
              <label
                v-for="acct in store.linkedInAccounts"
                :key="acct.id"
                class="flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all"
                :class="selectedSenders.has(acct.id) ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-blue-300'"
              >
                <input type="checkbox" :checked="selectedSenders.has(acct.id)" class="w-5 h-5 text-blue-600" @change="toggleSender(acct.id)" />
                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  {{ (acct.profile_name || acct.email || '?')[0].toUpperCase() }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900">{{ acct.profile_name || acct.email }}</p>
                  <p class="text-xs text-gray-500">{{ acct.email }}</p>
                </div>
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-semibold"
                  :class="acct.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ acct.status }}
                </span>
              </label>
            </div>
            <p v-if="selectedSenders.size > 0" class="text-xs text-gray-500 mt-4 bg-blue-50 px-4 py-2 rounded-lg">
              ℹ️ {{ selectedSenders.size }} account{{ selectedSenders.size > 1 ? 's' : '' }} selected.
              Daily limit will be {{ formData.daily_limit }} actions per sender = {{ (formData.daily_limit || 0) * selectedSenders.size }} total/day.
            </p>
          </div>
        </div>

        <!-- ═══ Step 3: Sequence Builder ═══ -->
        <div v-if="currentStep === 3" class="space-y-6">
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div class="flex items-center justify-between mb-5">
              <div>
                <h2 class="text-base font-semibold text-gray-900">⚡ Build Your Sequence</h2>
                <p class="text-sm text-gray-500 mt-1">Define the steps the campaign will execute for each lead.</p>
              </div>
              <button
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                @click="addSequenceStep"
              >
                ➕ Add Step
              </button>
            </div>

            <div class="space-y-5">
              <div v-for="(step, idx) in sequences" :key="idx" class="border border-gray-200 rounded-xl p-5 relative">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">{{ idx + 1 }}</div>
                    <select
                      v-model="step.step_type"
                      class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option v-for="st in stepTypes" :key="st.value" :value="st.value">{{ st.emoji }} {{ st.label }}</option>
                    </select>
                  </div>
                  <button
                    v-if="sequences.length > 1"
                    class="text-gray-400 hover:text-red-500 transition-colors p-1"
                    @click="removeSequenceStep(idx)"
                    title="Remove step"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <!-- Delay -->
                <div v-if="idx > 0" class="flex items-center gap-3 mb-4">
                  <span class="text-xs text-gray-500 font-medium">Wait</span>
                  <input v-model.number="step.delay_days" type="number" min="0" class="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  <span class="text-xs text-gray-500">days</span>
                  <input v-model.number="step.delay_hours" type="number" min="0" max="23" class="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  <span class="text-xs text-gray-500">hours</span>
                </div>

                <!-- Condition -->
                <div v-if="idx > 0" class="mb-4">
                  <label class="block text-xs font-medium text-gray-500 mb-1">Condition</label>
                  <select v-model="step.condition_type" class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500">
                    <option v-for="ct in conditionTypes" :key="ct.value" :value="ct.value">{{ ct.label }}</option>
                  </select>
                </div>

                <!-- Message Template -->
                <div v-if="['connection_request', 'message', 'inmail'].includes(step.step_type)" class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Message Template</label>
                    <textarea
                      v-model="step.message_template"
                      rows="4"
                      :placeholder="'Hi {first_name}, ...'"
                      class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <p class="text-xs text-gray-400 mt-1">Variables: <code class="bg-gray-100 px-1 rounded" v-pre>{first_name}</code>, <code class="bg-gray-100 px-1 rounded" v-pre>{last_name}</code>, <code class="bg-gray-100 px-1 rounded" v-pre>{company}</code>, <code class="bg-gray-100 px-1 rounded" v-pre>{title}</code></p>
                  </div>
                  <!-- A/B Testing -->
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input v-model="step.ab_test_enabled" type="checkbox" class="w-4 h-4 text-purple-600" />
                    <span class="text-sm text-gray-700">Enable A/B testing for this step</span>
                  </label>
                  <div v-if="step.ab_test_enabled">
                    <label class="block text-xs font-medium text-purple-600 mb-1">Variant B Message</label>
                    <textarea
                      v-model="step.message_template_b"
                      rows="4"
                      placeholder="Alternative message..."
                      class="w-full px-4 py-2.5 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ Step 4: Review ═══ -->
        <div v-if="currentStep === 4" class="space-y-6">
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 class="text-base font-semibold text-gray-900 mb-5">✅ Review Your Campaign</h2>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-gray-500 font-medium">Name</dt>
                <dd class="text-gray-900 font-semibold mt-0.5">{{ formData.name }}</dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium">Daily Limit</dt>
                <dd class="text-gray-900 font-semibold mt-0.5">{{ formData.daily_limit }} per sender</dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium">Senders</dt>
                <dd class="text-gray-900 font-semibold mt-0.5">{{ formData.sender_ids?.length || 0 }} account(s)</dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium">Sequence Steps</dt>
                <dd class="text-gray-900 font-semibold mt-0.5">{{ sequences.length }}</dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium">Timezone</dt>
                <dd class="text-gray-900 font-semibold mt-0.5">{{ formData.timezone }}</dd>
              </div>
              <div>
                <dt class="text-gray-500 font-medium">Working Hours</dt>
                <dd class="text-gray-900 font-semibold mt-0.5">{{ formData.working_hours_start }} – {{ formData.working_hours_end }}</dd>
              </div>
            </dl>
          </div>

          <!-- Safety Summary -->
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">🛡️ Safety Configuration</h3>
            <div class="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div>Action delay: {{ formData.delay_min_seconds }}s – {{ formData.delay_max_seconds }}s</div>
              <div>Working days: {{ (formData.working_days || []).join(', ') }}</div>
              <div>Warm-up: {{ formData.warm_up_enabled ? `${formData.warm_up_days} days` : 'Off' }}</div>
              <div>Auto-pause below: {{ formData.auto_pause_below_acceptance }}% acceptance</div>
              <div>Skip contacted: {{ formData.skip_already_contacted ? '✓' : '✗' }}</div>
              <div>Stop on reply: {{ formData.stop_on_reply ? '✓' : '✗' }}</div>
            </div>
          </div>

          <!-- Sequence Summary -->
          <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">⚡ Sequence Preview</h3>
            <div class="space-y-2">
              <div v-for="(s, i) in sequences" :key="i" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <div class="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{{ i + 1 }}</div>
                <span class="capitalize font-medium text-gray-700">{{ s.step_type.replace(/_/g, ' ') }}</span>
                <span v-if="(s.delay_days ?? 0) > 0 || (s.delay_hours ?? 0) > 0" class="text-xs text-gray-400">
                  after {{ s.delay_days ?? 0 }}d {{ s.delay_hours ?? 0 }}h
                </span>
                <span v-if="s.condition_type" class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">if {{ s.condition_type.replace(/_/g, ' ') }}</span>
                <span v-if="s.ab_test_enabled" class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">A/B</span>
              </div>
            </div>
          </div>

          <!-- Info note -->
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <span class="text-xl">ℹ️</span>
            <div>
              <p class="text-sm font-medium text-blue-800">Campaign will be created as Draft</p>
              <p class="text-xs text-blue-600 mt-0.5">You can review everything, add leads, then launch when ready.</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer Navigation -->
    <footer class="bg-white border-t border-gray-200 px-6 py-4">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <button
          class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          @click="goBack"
        >
          {{ currentStep === 1 ? 'Cancel' : '← Back' }}
        </button>
        <button
          :disabled="!canProceed || loading"
          class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          @click="goNext"
        >
          <span v-if="loading" class="animate-spin">⏳</span>
          {{ currentStep === 4 ? (loading ? 'Creating...' : '🚀 Create Campaign') : 'Next →' }}
        </button>
      </div>
    </footer>
  </div>
</template>
