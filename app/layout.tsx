import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Outcraftly Linkedin Automation - Professional Networking Platform',
  description: 'Outcraftly Linkedin Automation - Secure authentication and professional networking automation powered by Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  )
}
