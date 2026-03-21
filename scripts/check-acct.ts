import { DbClient } from '../lib/db/query-builder'

async function main() {
  const sb = new DbClient()
  const { data, error } = await sb.from('linkedin_accounts').select('*').limit(10)
  console.log('error:', error?.message)
  if (data?.[0]) {
    console.log('columns:', Object.keys(data[0]).join(', '))
    data.forEach((a: any) => {
      const sc = a.session_cookies
      console.log(JSON.stringify({ 
        id: a.id?.slice(0,8), 
        email: a.email, 
        username: a.username,
        status: a.status,
        session_cookies_type: typeof sc,
        session_cookies_null: sc === null,
        session_cookies_len: Array.isArray(sc) ? sc.length : (typeof sc === 'string' ? sc.length : 'N/A'),
        li_at_present: Array.isArray(sc) ? sc.some((c: any) => c.name === 'li_at') : 
                        (typeof sc === 'string' ? (()=>{ try { return JSON.parse(sc).some((c: any) => c.name==='li_at') } catch { return false } })() : false)
      }))
    })
  } else {
    console.log('No accounts found')
  }
}

main().catch(console.error)
