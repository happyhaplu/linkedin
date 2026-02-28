/**
 * Restore working hours on the campaign after force-test
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { error } = await sb
    .from('campaigns')
    .update({
      working_hours_start: '09:00:00',
      working_hours_end: '23:00:00',
      timezone: 'Asia/Kolkata',
    })
    .eq('id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')

  if (error) console.error('Error:', error)
  else console.log('✅ Working hours restored: 09:00 - 23:00 Asia/Kolkata')
}
main().catch(console.error)
