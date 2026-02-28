import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import UniboxContent from './UniboxContent'
import { getConversations, getLinkedInAccounts } from './actions'

export default async function UniboxPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Fetch initial data
  let conversations: any[] = []
  let linkedinAccounts: any[] = []
  
  try {
    conversations = await getConversations()
    linkedinAccounts = await getLinkedInAccounts()
  } catch (error) {
    console.error('Error loading unibox data:', error)
    // Tables might not exist yet - show empty state
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">Unibox</h1>
            <ProfileDropdown userEmail={user.email || ''} />
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <UniboxContent 
            initialConversations={conversations} 
            linkedinAccounts={linkedinAccounts}
          />
        </main>
      </div>
    </div>
  )
}
