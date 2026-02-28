'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'

export default function Test() {
  const [loading, setLoading] = useState(true)

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1">
        <h1>Test Page</h1>
      </div>
    </div>
  )
}
