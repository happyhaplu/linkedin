import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test connection
    const { data, error } = await supabase.auth.getSession()
    
    return NextResponse.json({
      status: 'testing',
      envVars: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'missing',
      },
      connectionTest: {
        error: error ? error.message : null,
        hasSession: !!data.session
      }
    })
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err.message,
      envVars: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 50) + '...' : 'missing',
      }
    }, { status: 500 })
  }
}
