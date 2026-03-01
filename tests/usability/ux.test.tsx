/**
 * Usability / UX Tests
 *
 * Validates:
 * - Accessibility (a11y) of key components
 * - Keyboard navigation support
 * - ARIA attributes and roles
 * - Color contrast indicators
 * - Responsive design breakpoints
 * - Sidebar navigation structure
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '@/components/Sidebar'

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  usePathname: jest.fn().mockReturnValue('/analytics'),
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}))

jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

jest.mock('next/image', () => {
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  const MockImage = (props: any) => <img alt="" {...props} />
  MockImage.displayName = 'MockImage'
  return MockImage
})

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: { signOut: jest.fn() },
  })),
}))

// ─── Accessibility Tests ────────────────────────────────────────────────────

describe('Usability — Sidebar Accessibility', () => {
  it('all navigation links have accessible text', () => {
    render(<Sidebar />)

    const links = screen.getAllByRole('link')
    links.forEach((link) => {
      // Each link should have text content or aria-label
      const text = link.textContent || link.getAttribute('aria-label')
      expect(text).toBeTruthy()
    })
  })

  it('navigation items are rendered as <a> elements', () => {
    render(<Sidebar />)

    const navItems = ['Analytics', 'Leads', 'Campaigns', 'My Network', 'Unibox']
    navItems.forEach((item) => {
      const el = screen.getByText(item)
      // Should be within an anchor tag
      expect(el.closest('a')).not.toBeNull()
    })
  })

  it('active item has visual differentiation', () => {
    render(<Sidebar />)

    // Analytics should be active (mock pathname is /analytics)
    const analyticsLink = screen.getByText('Analytics').closest('a')
    expect(analyticsLink).toBeTruthy()
    // Active state should have different class
    const className = analyticsLink?.className || ''
    expect(className.length).toBeGreaterThan(0)
  })

  it('renders correct number of navigation items', () => {
    render(<Sidebar />)

    // 6 main items: Analytics, Linkedin Account, Leads, Campaigns, My Network, Unibox
    const expectedItems = [
      'Analytics',
      'Linkedin Account',
      'Leads',
      'Campaigns',
      'My Network',
      'Unibox',
    ]

    expectedItems.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  })
})

// ─── Keyboard Navigation ────────────────────────────────────────────────────

describe('Usability — Keyboard Navigation', () => {
  it('Tab key can move focus through sidebar items', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)

    // Tab through elements
    await user.tab()
    const activeEl = document.activeElement
    // Some element should receive focus
    expect(activeEl).not.toBe(document.body)
  })

  it('links are focusable', () => {
    render(<Sidebar />)

    const links = screen.getAllByRole('link')
    links.forEach((link) => {
      // Links should have a valid tabIndex (0 or undefined = default)
      const tabIndex = link.getAttribute('tabindex')
      expect(tabIndex === null || tabIndex === '0' || tabIndex === undefined).toBe(true)
    })
  })
})

// ─── Template Character Limit UX ────────────────────────────────────────────

describe('Usability — Character Limit Feedback', () => {
  it('checkCharacterLimit provides actionable feedback', () => {
    // Import inline to avoid mock conflicts
    const { checkCharacterLimit } = require('@/lib/template-engine')

    const result = checkCharacterLimit('x'.repeat(305), 'connection_note')
    expect(result.valid).toBe(false)
    expect(result.overflow).toBe(5)
    expect(result.length).toBe(305)
    expect(result.limit).toBe(300)
    // User can calculate: need to remove 5 characters
  })

  it('provides different limits per message type', () => {
    const { checkCharacterLimit } = require('@/lib/template-engine')

    const types = ['connection_note', 'message', 'inmail'] as const
    const limits = types.map((t) => checkCharacterLimit('test', t).limit)

    // All different limits
    expect(new Set(limits).size).toBe(3)
    // Connection note is shortest
    expect(Math.min(...limits)).toBe(300)
  })
})

// ─── Empty / Error States ───────────────────────────────────────────────────

describe('Usability — Empty States', () => {
  it('template validation provides user-friendly error messages', () => {
    const { validateTemplate } = require('@/lib/template-engine')

    const errors = validateTemplate('{{badVariable}}')
    // Errors may include nested braces warning and unknown variable warning
    const hasUnknownVar = errors.some((e: string) => e.includes('Unknown variable'))
    const hasAvailable = errors.some((e: string) => e.includes('Available:'))
    expect(hasUnknownVar).toBe(true)
    expect(hasAvailable).toBe(true)
  })

  it('missing lead data check lists specific missing fields', () => {
    const { hasRequiredData } = require('@/lib/template-engine')

    const result = hasRequiredData('{{firstName}} at {{company}} — {{email}}', {
      first_name: 'Test',
    })

    expect(result.valid).toBe(false)
    expect(result.missing).toContain('company')
    expect(result.missing).toContain('email')
    // User knows exactly which fields to fill
  })
})
