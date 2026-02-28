'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Proxy } from '@/types/linkedin'
import { encryptData, decryptData } from '@/lib/utils/encryption'
import { testProxyConnection, validateProxyConfig } from '@/lib/utils/proxy-tester'

export async function getProxies() {
  const supabase = await createClient()
  
  const { data: proxies, error } = await supabase
    .from('proxies')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return proxies as Proxy[]
}

export async function createProxy(formData: {
  name: string
  type: string
  host: string
  port: number
  username?: string
  password?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Validate proxy configuration
  const validation = validateProxyConfig(formData.host, formData.port)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid proxy configuration')
  }

  // Encrypt password if provided (reversible encryption so we can build proxy URL later)
  let encryptedPassword = null
  if (formData.password) {
    encryptedPassword = encryptData(formData.password)
  }
  
  const { data, error } = await supabase
    .from('proxies')
    .insert({
      user_id: user.id,
      name: formData.name,
      type: formData.type,
      host: formData.host,
      port: formData.port,
      username: formData.username || null,
      password_encrypted: encryptedPassword,
      is_active: true,
      test_status: 'not_tested'
    })
    .select()
    .single()
  
  if (error) throw error
  try { revalidatePath('/linkedin-account') } catch (e) { /* skip */ }
  return data
}

export async function updateProxy(id: string, updates: Partial<Proxy>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('proxies')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  try { revalidatePath('/linkedin-account') } catch (e) { /* skip */ }
  return data
}

export async function deleteProxy(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('proxies')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  try { revalidatePath('/linkedin-account') } catch (e) { /* skip */ }
}

export async function testProxy(id: string) {
  const supabase = await createClient()
  
  // Get proxy details
  const { data: proxy, error: fetchError } = await supabase
    .from('proxies')
    .select('*')
    .eq('id', id)
    .single()
  
  if (fetchError || !proxy) throw new Error('Proxy not found')

  // Actually test the proxy connection (decrypt password from storage)
  const rawPassword = proxy.password_encrypted
    ? decryptData(proxy.password_encrypted)
    : undefined

  const testResult = await testProxyConnection(
    proxy.type,
    proxy.host,
    proxy.port,
    proxy.username || undefined,
    rawPassword
  )

  // Update proxy with test results
  const { data, error } = await supabase
    .from('proxies')
    .update({
      last_tested_at: new Date().toISOString(),
      test_status: testResult.success ? 'success' : 'failed',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  try { revalidatePath('/linkedin-account') } catch (e) { /* skip */ }
  
  if (!testResult.success) {
    throw new Error(testResult.error || 'Proxy test failed')
  }
  
  return data
}
