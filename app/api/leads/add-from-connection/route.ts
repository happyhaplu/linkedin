import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { connection_id, full_name, linkedin_url, position, company, profile_picture, list_id } = body
    
    if (!full_name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    // Use provided list_id or get/create a default list for network connections
    let targetListId = list_id
    
    if (!targetListId) {
      let { data: defaultList } = await supabase
        .from('lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'My Network')
        .single()
      
      if (!defaultList) {
        const { data: newList } = await supabase
          .from('lists')
          .insert({
            user_id: user.id,
            name: 'My Network',
            description: 'Leads from LinkedIn connections'
          })
          .select()
          .single()
        
        defaultList = newList
      }
      
      if (!defaultList) {
        return NextResponse.json({ error: 'Failed to create lead list' }, { status: 500 })
      }
      
      targetListId = defaultList.id
    }
    
    // Check if lead already exists - check both linkedin_url and full_name in the same list
    let existingLead = null
    
    if (linkedin_url) {
      const { data } = await supabase
        .from('leads')
        .select('id, full_name')
        .eq('user_id', user.id)
        .eq('list_id', targetListId)
        .eq('linkedin_url', linkedin_url)
        .maybeSingle()
      
      existingLead = data
    }
    
    // Also check by full name in the same list if no linkedin_url match
    if (!existingLead) {
      const { data } = await supabase
        .from('leads')
        .select('id, full_name')
        .eq('user_id', user.id)
        .eq('list_id', targetListId)
        .eq('full_name', full_name)
        .maybeSingle()
      
      existingLead = data
    }
    
    if (existingLead) {
      return NextResponse.json({ 
        error: `${full_name} is already in this list`,
        message: 'Already exists',
        existing: true
      }, { status: 409 })
    }
    
    // Parse name into first and last name
    const nameParts = full_name.trim().split(' ')
    const first_name = nameParts[0]
    const last_name = nameParts.slice(1).join(' ')
    
    // Insert lead
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        user_id: user.id,
        list_id: targetListId,
        first_name,
        last_name,
        full_name,
        position,
        company: company,
        linkedin_url: linkedin_url,
        profile_picture: profile_picture,
        headline: position,
        status: 'new',
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Error inserting lead:', insertError)
      return NextResponse.json({ error: 'Failed to add lead' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      lead,
      message: 'Successfully added to leads' 
    })
    
  } catch (error) {
    console.error('Error in add-from-connection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
