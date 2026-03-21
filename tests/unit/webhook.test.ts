/**
 * Unit Tests — Webhook module
 *
 * Covers: deliverWebhook (via triggerWebhook), HMAC signing, retry logic
 */

// ─── Mocks (must be before imports) ─────────────────────────────────────────

const mockFrom = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'wh-1',
            url: 'https://hooks.example.com/test',
            secret: 'test-secret',
            events: [],
          },
        ],
      }),
    }),
  }),
  insert: jest.fn().mockReturnValue({
    then: jest.fn((cb: any) => cb()),
  }),
})

jest.mock('@/lib/db/query-builder', () => ({
  DbClient: jest.fn().mockImplementation(() => ({ from: mockFrom })),
}))

jest.mock('@/lib/db/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    }),
}))

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

import { triggerWebhook } from '@/lib/webhook'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('triggerWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
  })

  it('calls fetch with correct URL and payload', async () => {
    await triggerWebhook('message_sent', 'c1', 'Test Campaign', {
      id: 'lead-1',
      full_name: 'John',
      linkedin_url: 'https://linkedin.com/in/john',
    })

    // Give fire-and-forget time to resolve
    await new Promise(r => setTimeout(r, 100))

    expect(mockFetch).toHaveBeenCalled()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://hooks.example.com/test')
    expect(options.method).toBe('POST')

    const body = JSON.parse(options.body)
    expect(body.event).toBe('message_sent')
    expect(body.campaign_id).toBe('c1')
    expect(body.campaign_name).toBe('Test Campaign')
    expect(body.lead.full_name).toBe('John')
  })

  it('includes HMAC signature header when secret is provided', async () => {
    await triggerWebhook('connection_sent', 'c1', 'Campaign')
    await new Promise(r => setTimeout(r, 100))

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['X-Webhook-Event']).toBe('connection_sent')
    expect(options.headers['X-Webhook-Signature']).toMatch(/^sha256=/)
  })

  it('includes custom event and timestamp headers', async () => {
    await triggerWebhook('replied', 'c1', 'Campaign')
    await new Promise(r => setTimeout(r, 100))

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['X-Webhook-Event']).toBe('replied')
    expect(options.headers['X-Webhook-Timestamp']).toBeDefined()
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers['User-Agent']).toContain('LinkedIn-Automation')
  })

  it('does not throw on network error (fire-and-forget)', async () => {
    mockFetch.mockRejectedValue(new Error('Network down'))
    // Should not throw
    await expect(
      triggerWebhook('campaign_paused', 'c1', 'Campaign'),
    ).resolves.toBeUndefined()
  })

  it('does not fetch when no webhooks are configured', async () => {
    // Override mock to return empty webhooks
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    })

    await triggerWebhook('message_sent', 'c1', 'Campaign')
    await new Promise(r => setTimeout(r, 100))

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
