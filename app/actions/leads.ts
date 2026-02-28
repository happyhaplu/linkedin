'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { List, Lead } from '@/types/linkedin'

// ============= LISTS =============

export async function getLists() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as List[]
}

export async function createList(formData: {
  name: string
  description?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('lists')
    .insert({
      user_id: user.id,
      name: formData.name,
      description: formData.description || null,
      lead_count: 0
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/leads/lists')
  return data as List
}

export async function updateList(listId: string, formData: {
  name?: string
  description?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('lists')
    .update({
      name: formData.name,
      description: formData.description,
      updated_at: new Date().toISOString()
    })
    .eq('id', listId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error

  revalidatePath('/leads/lists')
  return data as List
}

export async function deleteList(listId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/leads/lists')
  revalidatePath('/leads')
}

// ============= LEADS =============

export async function getLeads(filters?: {
  list_id?: string
  status?: string
  search?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('leads')
    .select(`
      *,
      list:lists(*)
    `, { count: 'exact' })
    .eq('user_id', user.id)

  if (filters?.list_id) {
    query = query.eq('list_id', filters.list_id)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
  }

  query = query.order('imported_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  
  // Remove duplicates based on ID (shouldn't happen but just in case)
  const uniqueLeads = data?.reduce((acc: any[], lead: any) => {
    if (!acc.find(l => l.id === lead.id)) {
      acc.push(lead)
    }
    return acc
  }, []) || []
  
  return uniqueLeads as (Lead & { list: List })[]
}

export async function importLeadsFromCSV(formData: {
  list_id: string
  leads: Array<{
    linkedin_url?: string
    first_name?: string
    last_name?: string
    full_name?: string
    headline?: string
    company?: string
    company_url?: string
    position?: string
    location?: string
    email?: string
    enriched_email?: string
    custom_address?: string
    phone?: string
    notes?: string
    tags?: string
  }>
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  console.log('📥 Importing leads...', {
    listId: formData.list_id,
    count: formData.leads.length
  })

  // Prepare leads for insertion
  const leadsToInsert = formData.leads.map(lead => ({
    list_id: formData.list_id,
    user_id: user.id,
    linkedin_url: lead.linkedin_url || null,
    first_name: lead.first_name || null,
    last_name: lead.last_name || null,
    full_name: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
    headline: lead.headline || null,
    company: lead.company || null,
    company_url: lead.company_url || null,
    position: lead.position || null,
    location: lead.location || null,
    email: lead.email || null,
    enriched_email: lead.enriched_email || null,
    custom_address: lead.custom_address || null,
    phone: lead.phone || null,
    notes: lead.notes || null,
    tags: lead.tags || null,
    status: 'new' as const
  }))

  // Insert leads
  const { data, error } = await supabase
    .from('leads')
    .insert(leadsToInsert)
    .select()

  if (error) {
    console.error('❌ Import error:', error)
    throw error
  }

  console.log('✅ Imported', data?.length, 'leads')

  // Update list lead count - simple query since RPC might not exist
  const { data: countData } = await supabase
    .from('leads')
    .select('id', { count: 'exact' })
    .eq('list_id', formData.list_id)

  if (countData) {
    await supabase
      .from('lists')
      .update({ 
        lead_count: countData.length,
        updated_at: new Date().toISOString() 
      })
      .eq('id', formData.list_id)
  }

  revalidatePath('/leads')
  revalidatePath('/leads/lists')
  
  return data as Lead[]
}

export async function updateLead(leadId: string, formData: Partial<Lead>) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('leads')
    .update({
      ...formData,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error

  revalidatePath('/leads')
  return data as Lead
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/leads')
}

export async function bulkUpdateLeadStatus(leadIds: string[], status: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('leads')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .in('id', leadIds)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/leads')
}

export async function bulkDeleteLeads(leadIds: string[]) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('leads')
    .delete()
    .in('id', leadIds)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath('/leads')
}
