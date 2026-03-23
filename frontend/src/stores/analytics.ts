import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AnalyticsData } from '@/types/analytics'
import * as analyticsApi from '@/api/analytics'

export const useAnalyticsStore = defineStore('analytics', () => {
  const data = ref<AnalyticsData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAnalytics() {
    loading.value = true
    error.value = null
    try {
      data.value = await analyticsApi.getAnalyticsData()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, fetchAnalytics }
})
