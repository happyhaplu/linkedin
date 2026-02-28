import { NextRequest, NextResponse } from 'next/server'
import { loginWithCookie } from '@/lib/linkedin-cookie-auth'

export async function POST(request: NextRequest) {
  try {
    const { email, secretKey } = await request.json()

    if (!email || !secretKey) {
      return NextResponse.json(
        { error: 'Email and secret key are required' },
        { status: 400 }
      )
    }

    console.log('🧪 API: Testing cookie authentication')
    console.log('Email:', email)
    console.log('Secret Key length:', secretKey.length)

    const result = await loginWithCookie(email, secretKey)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || result.error },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      cookies: result.cookies,
      profileData: result.profileData,
      message: 'Cookie authentication successful!'
    })

  } catch (error: any) {
    console.error('❌ API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
