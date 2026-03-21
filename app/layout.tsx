import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GourReach LinkedIn Automation',
  description: 'GourReach — LinkedIn outreach automation, campaign management, and professional networking platform',
  icons: {
    icon: '/favicon.svg',
  },
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
