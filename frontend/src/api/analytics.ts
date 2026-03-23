import api from './client'
import type { AnalyticsData } from '@/types/analytics'

// GET /api/analytics — single endpoint returns entire dashboard payload
export async function getAnalyticsData(): Promise<AnalyticsData> {
  const { data } = await api.get<AnalyticsData>('/analytics')
  return data
}
