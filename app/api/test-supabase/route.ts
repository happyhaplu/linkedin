import { createClient } from '@/lib/db/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test connection
    const { data, error } = await supabase.auth.getUser()
    
    return NextResponse.json({
      status: 'testing',
      envVars: {
        databaseUrl: process.env.DATABASE_URL ? 'present' : 'missing',
      },
      connectionTest: {
        error: error ? error.message : null,
        hasUser: !!data?.user
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
