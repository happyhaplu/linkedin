/**
 * Setup proxy and assign to LinkedIn account
 * Usage: npx tsx scripts/setup-proxy.ts
 */
import { DbClient } from '../lib/db/query-builder'

const supabase = new DbClient()
async function main() {
  // 1. Get the LinkedIn account
  const { data: accounts, error: accErr } = await supabase
    .from('linkedin_accounts')
    .select('id, user_id, email, status, proxy_id')
  
  if (accErr) { console.error('Failed to fetch accounts:', accErr); process.exit(1) }
  console.log('📋 LinkedIn Accounts:')
  accounts?.forEach(a => console.log(`  ${a.id} | ${a.email} | status=${a.status} | proxy_id=${a.proxy_id || 'none'}`))

  if (!accounts || accounts.length === 0) { console.error('No accounts found'); process.exit(1) }
  
  const account = accounts[0]
  console.log(`\n🎯 Using account: ${account.email} (${account.id})`)

  // 2. Check existing proxies
  const { data: existingProxies } = await supabase
    .from('proxies')
    .select('id, name, host, port, type')
  
  console.log('\n📋 Existing proxies:', existingProxies?.length || 0)
  existingProxies?.forEach(p => console.log(`  ${p.id} | ${p.name} | ${p.type}://${p.host}:${p.port}`))

  // 3. Insert the residential proxy (encrypted password = base64 of '8jpnmtlggdcn')
  const encryptedPassword = Buffer.from('8jpnmtlggdcn').toString('base64') // 'OGpwbm10bGdnZGNu'
  
  const { data: proxy, error: proxyErr } = await supabase
    .from('proxies')
    .insert({
      user_id: account.user_id,
      name: 'Webshare UK Residential',
      type: 'http',
      host: '31.59.20.176',
      port: 6754,
      username: 'xfkfrbeb',
      password_encrypted: encryptedPassword,
      is_active: true,
      test_status: 'not_tested'
    })
    .select()
    .single()

  if (proxyErr) {
    console.error('❌ Failed to create proxy:', proxyErr)
    process.exit(1)
  }
  console.log(`\n✅ Proxy created: ${proxy.id} (${proxy.name})`)
  console.log(`   URL will be: http://xfkfrbeb:***@31.59.20.176:6754`)

  // 4. Assign proxy to the LinkedIn account
  const { error: updateErr } = await supabase
    .from('linkedin_accounts')
    .update({ proxy_id: proxy.id })
    .eq('id', account.id)

  if (updateErr) {
    console.error('❌ Failed to assign proxy:', updateErr)
    process.exit(1)
  }
  console.log(`\n✅ Proxy assigned to account ${account.email}`)

  // 5. Verify
  const { data: updated } = await supabase
    .from('linkedin_accounts')
    .select('id, email, proxy_id, status')
    .eq('id', account.id)
    .single()
  
  console.log('\n📋 Updated account:', updated)
  console.log('\n🎉 Done! The proxy is now linked. Next step: reconnect the account with cookies through this proxy.')
}

main().catch(console.error)
