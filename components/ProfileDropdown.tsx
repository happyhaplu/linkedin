'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import SignOutButton from './SignOutButton'

interface ProfileDropdownProps {
  userEmail?: string
}

export default function ProfileDropdown({ userEmail }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getInitial = () => {
    return userEmail?.charAt(0).toUpperCase() || 'U'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold hover:bg-blue-200 transition-colors"
      >
        {getInitial()}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-900">My Account</p>
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          </div>
          
          <div className="py-2">
            <Link
              href="/profile"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile Settings
            </Link>
          </div>

          <div className="border-t border-gray-200 pt-2 px-4 pb-2">
            <SignOutButton fullWidth />
          </div>
        </div>
      )}
    </div>
  )
}
