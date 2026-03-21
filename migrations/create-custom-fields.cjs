const { Pool } = require('pg');

const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
async function createCustomFieldsTable() {
  try {
    console.log('Creating custom_fields table...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create custom_fields table
        CREATE TABLE IF NOT EXISTS custom_fields (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          name TEXT NOT NULL,
          field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'email', 'phone', 'url', 'date', 'textarea')),
          is_required BOOLEAN DEFAULT false,
          options JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Add custom_field_values column to leads table
        ALTER TABLE leads 
        ADD COLUMN IF NOT EXISTS custom_field_values JSONB DEFAULT '{}';

        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_custom_fields_user_id ON custom_fields(user_id);
        CREATE INDEX IF NOT EXISTS idx_leads_custom_field_values ON leads USING GIN(custom_field_values);
      `
    });

    if (error) throw error;

    console.log('✅ Custom fields table created successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createCustomFieldsTable();
