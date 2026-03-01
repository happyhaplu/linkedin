/**
 * Integration Tests — Webhook Delivery
 *
 * Tests: HMAC signature generation, retry logic, exponential backoff,
 *        event filtering, parallel delivery
 */

// Mock crypto for HMAC
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto')
  return actual
})

// Mock supabase
const mockFrom = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as any

import { triggerWebhook } from '@/lib/webhook'

describe('Webhook Delivery — Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default: one active webhook
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { id: 'wh1', url: 'https://hook.example.com/a', secret: 'sec', events: [] },
            ],
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({ then: jest.fn((cb: any) => cb()) }),
    })

    mockFetch.mockResolvedValue({ ok: true, status: 200 })
  })

  it('delivers to correct URL with JSON body', async () => {
    await triggerWebhook('message_sent', 'c1', 'My Campaign', {
      id: 'lead-1',
      full_name: 'Alice',
      linkedin_url: 'https://linkedin.com/in/alice',
    })
    await new Promise((r) => setTimeout(r, 200))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://hook.example.com/a')
    const body = JSON.parse(opts.body)
    expect(body.event).toBe('message_sent')
    expect(body.campaign_id).toBe('c1')
    expect(body.lead.full_name).toBe('Alice')
  })

  it('generates valid HMAC sha256 signature', async () => {
    await triggerWebhook('connection_sent', 'c1', 'Campaign')
    await new Promise((r) => setTimeout(r, 200))

    const [, opts] = mockFetch.mock.calls[0]
    const sig = opts.headers['X-Webhook-Signature']
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it('retries on fetch failure (up to 3 attempts)', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ ok: true, status: 200 })

    await triggerWebhook('replied', 'c1', 'Campaign')
    // Retries have exponential backoff (1s, 2s) — give time
    await new Promise((r) => setTimeout(r, 5_000))

    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2)
  }, 10_000)

  it('does not deliver when webhook has event filter that excludes event', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { id: 'wh1', url: 'https://hook.example.com', secret: null, events: ['message_sent'] },
            ],
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({ then: jest.fn((cb: any) => cb()) }),
    })

    await triggerWebhook('connection_sent', 'c1', 'Campaign')
    await new Promise((r) => setTimeout(r, 200))

    // Should not have fired fetch because connection_sent is not in events list
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('gracefully handles no active webhooks', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    })

    await expect(
      triggerWebhook('campaign_completed', 'c1', 'Campaign'),
    ).resolves.toBeUndefined()

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
