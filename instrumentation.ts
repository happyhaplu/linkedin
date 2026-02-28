/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Runs once when the Next.js server starts (both `next dev` and `next start`).
 * We use it to boot BullMQ workers inside the same Node.js process so no
 * separate terminal or process manager is needed.
 */

export async function register() {
  // Only run in Node.js runtime — not in Edge runtime or during static generation
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip if Redis is not configured (e.g. CI environments without Redis)
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    try {
      const { startWorkers } = await import('./lib/workers/worker-manager')
      await startWorkers()
      console.log(`[Instrumentation] Workers booted (Redis: ${redisUrl})`)
    } catch (err: any) {
      // Non-fatal: app still works, campaigns just won't process
      console.error('[Instrumentation] Failed to start workers:', err.message)
    }
  }
}
