const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://db.rlsyvgjcxxoregwrwuzf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyOTczNTgsImV4cCI6MjA1Mjg3MzM1OH0.k5wVvh7kVp3E5Qjg7xLmSv2mSBWKhQ6KExWZuRTwX2Y'
);

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
