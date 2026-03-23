<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAnalyticsStore } from '@/stores/analytics'
import { ACTIVITY_META, STATUS_BADGE } from '@/types/analytics'
import type { DailyActivity } from '@/types/analytics'

const store = useAnalyticsStore()
const router = useRouter()

onMounted(() => {
  store.fetchAnalytics()
})

const hasData = computed(() => {
  if (!store.data) return false
  return store.data.overview.totalLeads > 0 || store.data.campaigns.length > 0
})

// ─── Score Ring Helpers ────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function scoreTextClass(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs Work'
}

const SCORE_R = 44
const SCORE_CIRC = 2 * Math.PI * SCORE_R

function scoreOffset(score: number): number {
  return SCORE_CIRC - (score / 100) * SCORE_CIRC
}

// ─── Metric Card Config ────────────────────────────────────────────────────

const borderMap: Record<string, string> = {
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  purple: 'border-l-purple-500',
  amber: 'border-l-amber-500',
}

// ─── Daily Chart Helper ────────────────────────────────────────────────────

function maxTotal(days: DailyActivity[]): number {
  return Math.max(...days.map(d => d.total), 1)
}

// ─── Rate Badge ────────────────────────────────────────────────────────────

function rateBadgeClass(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[0]) return 'text-emerald-700 bg-emerald-50'
  if (value >= thresholds[1]) return 'text-amber-700 bg-amber-50'
  return 'text-gray-500 bg-gray-50'
}

// ─── Time Formatting ───────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <!-- Loading -->
    <div v-if="store.loading" class="flex justify-center items-center py-24">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="flex flex-col items-center justify-center py-24 text-center">
      <p class="text-sm text-red-500 mb-4">{{ store.error }}</p>
      <button class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700" @click="store.fetchAnalytics()">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasData" class="flex flex-col items-center justify-center py-24 text-center">
      <svg class="h-14 w-14 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
      </svg>
      <h2 class="text-lg font-semibold text-gray-700 mb-1">No analytics yet</h2>
      <p class="text-sm text-gray-500 mb-6 max-w-sm">
        Create a campaign and start sending connection requests — your analytics will appear here automatically.
      </p>
      <button
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        @click="router.push('/campaigns/new')"
      >
        Create Campaign
      </button>
    </div>

    <!-- Dashboard -->
    <div v-else-if="store.data" class="space-y-6">

      <!-- ═══ Row 1: Score Ring + Metric Cards ═══ -->
      <div class="grid grid-cols-12 gap-4">

        <!-- Outreach Score -->
        <div class="col-span-12 md:col-span-3 bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center">
          <div class="relative">
            <svg width="100" height="100" class="-rotate-90">
              <circle cx="50" cy="50" :r="SCORE_R" fill="none" stroke="#f3f4f6" stroke-width="7" />
              <circle
                cx="50" cy="50" :r="SCORE_R"
                fill="none"
                :stroke="scoreColor(store.data.overview.outreachScore)"
                stroke-width="7"
                :stroke-dasharray="SCORE_CIRC"
                :stroke-dashoffset="scoreOffset(store.data.overview.outreachScore)"
                stroke-linecap="round"
                class="transition-all duration-1000 ease-out"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span :class="['text-2xl font-bold', scoreTextClass(store.data.overview.outreachScore)]">
                {{ store.data.overview.outreachScore }}
              </span>
              <span class="text-[10px] text-gray-400">{{ scoreLabel(store.data.overview.outreachScore) }}</span>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2 text-center">Outreach Score</p>
        </div>

        <!-- Metric Cards -->
        <div class="col-span-12 md:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- Connections Sent -->
          <div :class="['bg-white rounded-xl border border-gray-200 border-l-[3px] p-4 flex flex-col', borderMap.blue]">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-gray-500 font-medium">Connections Sent</span>
              <span class="text-base">🔗</span>
            </div>
            <span class="text-xl font-bold text-gray-900">{{ store.data.overview.connectionsSent.toLocaleString() }}</span>
            <div
              v-if="store.data.overview.weekOverWeek.connectionsSent !== 0"
              :class="['flex items-center mt-1 text-xs', store.data.overview.weekOverWeek.connectionsSent > 0 ? 'text-emerald-600' : 'text-red-500']"
            >
              <!-- Arrow Up -->
              <svg v-if="store.data.overview.weekOverWeek.connectionsSent > 0" class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              <!-- Arrow Down -->
              <svg v-else class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 5.573 5.573l2.74 1.22m0 0-5.94 2.281m5.94-2.28 2.28-5.941" />
              </svg>
              <span>{{ store.data.overview.weekOverWeek.connectionsSent > 0 ? '+' : '' }}{{ store.data.overview.weekOverWeek.connectionsSent }}% vs last week</span>
            </div>
          </div>

          <!-- Acceptance Rate -->
          <div :class="['bg-white rounded-xl border border-gray-200 border-l-[3px] p-4 flex flex-col', borderMap.emerald]">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-gray-500 font-medium">Acceptance Rate</span>
              <span class="text-base">🤝</span>
            </div>
            <span class="text-xl font-bold text-gray-900">{{ (store.data.overview.acceptanceRate * 100).toFixed(1) }}%</span>
            <span class="text-[11px] text-gray-400 mt-1">{{ store.data.overview.connectionsAccepted.toLocaleString() }} accepted</span>
          </div>

          <!-- Messages Sent -->
          <div :class="['bg-white rounded-xl border border-gray-200 border-l-[3px] p-4 flex flex-col', borderMap.purple]">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-gray-500 font-medium">Messages Sent</span>
              <span class="text-base">💬</span>
            </div>
            <span class="text-xl font-bold text-gray-900">{{ store.data.overview.messagesSent.toLocaleString() }}</span>
            <div
              v-if="store.data.overview.weekOverWeek.messagesSent !== 0"
              :class="['flex items-center mt-1 text-xs', store.data.overview.weekOverWeek.messagesSent > 0 ? 'text-emerald-600' : 'text-red-500']"
            >
              <svg v-if="store.data.overview.weekOverWeek.messagesSent > 0" class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              <svg v-else class="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 5.573 5.573l2.74 1.22m0 0-5.94 2.281m5.94-2.28 2.28-5.941" />
              </svg>
              <span>{{ store.data.overview.weekOverWeek.messagesSent > 0 ? '+' : '' }}{{ store.data.overview.weekOverWeek.messagesSent }}% vs last week</span>
            </div>
          </div>

          <!-- Reply Rate -->
          <div :class="['bg-white rounded-xl border border-gray-200 border-l-[3px] p-4 flex flex-col', borderMap.amber]">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-gray-500 font-medium">Reply Rate</span>
              <span class="text-base">📬</span>
            </div>
            <span class="text-xl font-bold text-gray-900">{{ (store.data.overview.replyRate * 100).toFixed(1) }}%</span>
            <span class="text-[11px] text-gray-400 mt-1">{{ store.data.overview.repliesReceived.toLocaleString() }} replies</span>
          </div>
        </div>
      </div>

      <!-- ═══ Row 2: Funnel + Daily Activity ═══ -->
      <div class="grid grid-cols-12 gap-4">

        <!-- Outreach Funnel -->
        <div class="col-span-12 lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Outreach Funnel</h3>
          <div class="space-y-3">
            <div v-for="step in store.data.funnel" :key="step.label" class="flex items-center space-x-3">
              <div class="w-28 text-right">
                <p class="text-xs font-medium text-gray-700">{{ step.label }}</p>
                <p class="text-[10px] text-gray-400">{{ step.value.toLocaleString() }}</p>
              </div>
              <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  :class="['h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2', step.color]"
                  :style="{ width: `${Math.max(step.pct, step.value > 0 ? 8 : 0)}%` }"
                >
                  <span v-if="step.pct > 15" class="text-[10px] font-medium text-white">{{ step.pct }}%</span>
                </div>
              </div>
              <span v-if="step.pct <= 15 && step.value > 0" class="text-[10px] text-gray-400 w-8">{{ step.pct }}%</span>
            </div>
          </div>
        </div>

        <!-- Daily Activity Chart -->
        <div class="col-span-12 lg:col-span-7 bg-white rounded-xl border border-gray-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-900">Daily Activity</h3>
            <div class="flex items-center space-x-3 text-[10px] text-gray-400">
              <span class="flex items-center"><span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Connections</span>
              <span class="flex items-center"><span class="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1" />Messages</span>
              <span class="flex items-center"><span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Replies</span>
            </div>
          </div>
          <div class="flex items-end space-x-1" style="height: 140px">
            <div
              v-for="day in store.data.dailyActivity"
              :key="day.date"
              class="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              <!-- Tooltip -->
              <div class="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div class="bg-gray-800 text-white text-[10px] px-2 py-1.5 rounded-md shadow-lg whitespace-nowrap">
                  <p class="font-medium">{{ day.label }}</p>
                  <p v-if="day.connectionsSent > 0">🔗 {{ day.connectionsSent }} connections</p>
                  <p v-if="day.messagesSent > 0">💬 {{ day.messagesSent }} messages</p>
                  <p v-if="day.replies > 0">✅ {{ day.replies }} replies</p>
                  <p v-if="day.total === 0" class="text-gray-400">No activity</p>
                </div>
              </div>

              <!-- Stacked Bars -->
              <div
                v-if="day.total > 0"
                class="w-full flex flex-col-reverse"
                :style="{ height: `${(day.total / maxTotal(store.data.dailyActivity)) * 100}%` }"
              >
                <div
                  v-if="day.connectionsSent > 0"
                  class="w-full bg-blue-500 rounded-b-sm"
                  :style="{ height: `${(day.connectionsSent / day.total) * 100}%`, minHeight: '2px' }"
                />
                <div
                  v-if="day.messagesSent > 0"
                  class="w-full bg-purple-500"
                  :style="{ height: `${(day.messagesSent / day.total) * 100}%`, minHeight: '2px' }"
                />
                <div
                  v-if="day.replies > 0"
                  class="w-full bg-emerald-500 rounded-t-sm"
                  :style="{ height: `${(day.replies / day.total) * 100}%`, minHeight: '2px' }"
                />
              </div>

              <!-- Empty placeholder -->
              <div v-else class="w-full bg-gray-100 rounded-sm" style="height: 3px" />

              <!-- Date label -->
              <span class="text-[9px] text-gray-400 mt-1.5 truncate w-full text-center">
                {{ day.label.replace(/\s/g, '\u00A0') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Row 3: Campaign Table + Activity Feed ═══ -->
      <div class="grid grid-cols-12 gap-4">

        <!-- Campaign Performance -->
        <div class="col-span-12 lg:col-span-7 bg-white rounded-xl border border-gray-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-900">Campaign Performance</h3>
            <span class="text-xs text-gray-400">{{ store.data.campaigns.length }} campaigns</span>
          </div>

          <p v-if="store.data.campaigns.length === 0" class="text-sm text-gray-400 py-6 text-center">
            No campaigns yet
          </p>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th class="pb-2 font-medium">Campaign</th>
                  <th class="pb-2 font-medium text-center">Leads</th>
                  <th class="pb-2 font-medium text-center">Sent</th>
                  <th class="pb-2 font-medium text-center">Accept %</th>
                  <th class="pb-2 font-medium text-center">Reply %</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in store.data.campaigns.slice(0, 8)"
                  :key="c.id"
                  class="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  @click="router.push(`/campaigns/${c.id}`)"
                >
                  <td class="py-2.5">
                    <div class="flex items-center space-x-2">
                      <span class="font-medium text-gray-800 truncate max-w-[180px]">{{ c.name }}</span>
                      <span
                        :class="['px-1.5 py-0.5 text-[10px] font-medium rounded', (STATUS_BADGE[c.status] || STATUS_BADGE.draft).cls]"
                      >
                        {{ (STATUS_BADGE[c.status] || STATUS_BADGE.draft).label }}
                      </span>
                    </div>
                  </td>
                  <td class="py-2.5 text-center text-gray-600">{{ c.totalLeads }}</td>
                  <td class="py-2.5 text-center text-gray-600">{{ c.connectionsSent }}</td>
                  <td class="py-2.5 text-center">
                    <span :class="['inline-block px-1.5 py-0.5 rounded text-xs font-medium', rateBadgeClass(parseFloat((c.acceptanceRate * 100).toFixed(1)), [40, 25])]">
                      {{ (c.acceptanceRate * 100).toFixed(1) }}%
                    </span>
                  </td>
                  <td class="py-2.5 text-center">
                    <span :class="['inline-block px-1.5 py-0.5 rounded text-xs font-medium', rateBadgeClass(parseFloat((c.replyRate * 100).toFixed(1)), [15, 8])]">
                      {{ (c.replyRate * 100).toFixed(1) }}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <button
              v-if="store.data.campaigns.length > 8"
              class="block w-full text-center text-xs text-blue-600 hover:text-blue-700 mt-3"
              @click="router.push('/campaigns')"
            >
              View all {{ store.data.campaigns.length }} campaigns →
            </button>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="col-span-12 lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>

          <p v-if="store.data.recentActivity.length === 0" class="text-sm text-gray-400 py-6 text-center">
            No activity yet
          </p>

          <div v-else class="space-y-0 max-h-[360px] overflow-y-auto">
            <div
              v-for="(ev, i) in store.data.recentActivity"
              :key="ev.id"
              :class="['flex items-start space-x-2.5 py-2.5', i < store.data.recentActivity.length - 1 ? 'border-b border-gray-50' : '']"
            >
              <span class="text-sm mt-0.5">{{ (ACTIVITY_META[ev.type] || { emoji: '📌' }).emoji }}</span>
              <div class="flex-1 min-w-0">
                <p :class="['text-xs', ev.status === 'failed' ? 'text-red-500' : 'text-gray-700']">
                  <span>{{ (ACTIVITY_META[ev.type] || { label: ev.type }).label }}</span>
                  <span v-if="ev.leadName" class="font-medium"> {{ ev.leadName }}</span>
                  <span v-if="ev.status === 'failed'" class="ml-1 text-red-400">(failed)</span>
                </p>
                <p class="text-[10px] text-gray-400 mt-0.5">
                  {{ ev.campaignName }} · {{ formatRelativeTime(ev.time) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
