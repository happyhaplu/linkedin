'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CustomField } from '@/types/linkedin'

export async function getCustomFields() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as CustomField[]
}

export async function createCustomField(formData: {
  name: string
  field_type: string
  is_required?: boolean
  options?: any
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('custom_fields')
    .insert({
      user_id: user.id,
      name: formData.name,
      field_type: formData.field_type,
      is_required: formData.is_required || false,
      options: formData.options || null
    })
    .select()
    .single()

  if (error) throw error

  try { revalidatePath('/leads') } catch (e) { /* skip */ }
  return data as CustomField
}

export async function updateCustomField(id: string, formData: {
  name?: string
  field_type?: string
  is_required?: boolean
  options?: any
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('custom_fields')
    .update({
      ...formData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error

  try { revalidatePath('/leads') } catch (e) { /* skip */ }
  return data as CustomField
}

export async function deleteCustomField(id: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('custom_fields')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error

  try { revalidatePath('/leads') } catch (e) { /* skip */ }
}
