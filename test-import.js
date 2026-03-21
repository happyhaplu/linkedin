const { Pool } = require('pg');

const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
async function testImport() {
  try {
    // Check if we have any lists
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select('*');
    
    if (listsError) {
      console.error('❌ Error fetching lists:', listsError);
      return;
    }
    
    console.log('📋 Existing lists:', lists?.length || 0);
    if (lists && lists.length > 0) {
      console.log(lists.map(l => `  - ${l.name} (${l.lead_count} leads)`).join('\n'));
    }
    
    // Check existing leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*');
    
    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError);
      return;
    }
    
    console.log('\n👤 Existing leads:', leads?.length || 0);
    
    // Check table structure
    const { data: columns, error: columnsError } = await supabase
      .from('leads')
      .select('*')
      .limit(1);
    
    if (!columnsError && columns && columns[0]) {
      console.log('\n📊 Lead table columns:', Object.keys(columns[0]));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testImport();
