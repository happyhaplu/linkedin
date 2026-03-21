import React from 'react'
import { render, screen } from '@testing-library/react'
import Sidebar from '../../components/Sidebar'
import { usePathname } from 'next/navigation'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('next/link', () => {
  const MockLink = ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => {
    return <a href={href} className={className}>{children}</a>
  }
  MockLink.displayName = 'MockLink'
  return MockLink
})

jest.mock('next/image', () => {
  const MockImage = ({ src, alt, width, height, className }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} className={className} />
  }
  MockImage.displayName = 'MockImage'
  return MockImage
})

// Mock Supabase client
jest.mock('../../lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signOut: jest.fn(),
    },
  })),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue('/analytics')
    ;(require('next/navigation').useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    })
  })

  it('renders all menu items', () => {
    render(<Sidebar />)

    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Linkedin Account')).toBeInTheDocument()
    expect(screen.getByText('Leads')).toBeInTheDocument()
    expect(screen.getByText('Campaigns')).toBeInTheDocument()
    expect(screen.getByText('My Network')).toBeInTheDocument()
    expect(screen.getByText('Unibox')).toBeInTheDocument()
  })

  it('highlights active menu item', () => {
    render(<Sidebar />)

    const analyticsLink = screen.getByText('Analytics').closest('a')
    expect(analyticsLink).toHaveClass('bg-blue-50')
    expect(analyticsLink).toHaveClass('text-blue-600')
  })

  it('renders logo and branding', () => {
    render(<Sidebar />)

    expect(screen.getByAltText('Reach Logo')).toBeInTheDocument()
    expect(screen.getByText('Linkedin')).toBeInTheDocument()
    expect(screen.getByText('Automation')).toBeInTheDocument()
  })

  it('renders My Account section', () => {
    render(<Sidebar />)

    expect(screen.getByText('My Account')).toBeInTheDocument()
  })
})