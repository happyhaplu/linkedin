import { DbClient } from '../lib/db/query-builder'
import dotenv from 'dotenv';
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' });

const sb = new DbClient();
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe';

async function reset() {
  const { error: e1 } = await sb.from('campaigns').update({
    status: 'draft',
    connection_sent: 0, connection_accepted: 0,
    messages_sent: 0, replies_received: 0,
    total_sent: 0, total_accepted: 0, total_replied: 0,
    pending_leads: 5, completed_leads: 0, replied_leads: 0,
  }).eq('id', CID);
  console.log('Campaign reset:', e1 ? e1.message : 'OK');

  const { error: e2 } = await sb.from('campaign_senders').update({
    connection_sent: 0, connection_accepted: 0,
    messages_sent: 0, replies_received: 0,
  }).eq('campaign_id', CID);
  console.log('Sender reset:', e2 ? e2.message : 'OK');

  const { error: e3 } = await sb.from('campaign_leads').update({
    status: 'pending', current_step_number: 1,
    connection_sent_at: null, connection_accepted_at: null,
    first_message_sent_at: null, first_reply_at: null,
    replied_at: null, total_messages_sent: 0, total_replies_received: 0,
    started_at: null, completed_at: null, next_action_at: null,
  }).eq('campaign_id', CID);
  console.log('Leads reset:', e3 ? e3.message : 'OK');
}
reset();
