import { createClient } from '@/lib/db/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import AnalyticsDashboard from './AnalyticsDashboard'
import { getAnalyticsData } from './actions'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const data = await getAnalyticsData()

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
            <ProfileDropdown userEmail={user.email} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <AnalyticsDashboard data={data} />
        </main>
      </div>
    </div>
  )
}
