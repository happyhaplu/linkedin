// Test CSV parsing with quoted fields
const fs = require('fs');

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Read and parse the HeyReach CSV
const csvContent = fs.readFileSync('./heyreach-sample.csv', 'utf-8');
const rows = csvContent.split('\n').filter(row => row.trim());

console.log('Total rows:', rows.length);
console.log('\n--- HEADERS ---');
const headers = parseCSVLine(rows[0]).map(h => h.trim().toLowerCase());
console.log(headers);

console.log('\n--- FIRST LEAD ---');
const firstLead = parseCSVLine(rows[1]);
console.log('Fields count:', firstLead.length);

const obj = {};
headers.forEach((header, index) => {
  const value = firstLead[index]?.trim();
  if (!value) return;
  
  // Map HeyReach-style columns (same logic as component)
  if (header === 'profile url') {
    obj.linkedin_url = value;
  } else if (header === 'first name') {
    obj.first_name = value;
  } else if (header === 'last name') {
    obj.last_name = value;
  } else if (header === 'full name') {
    obj.full_name = value;
  } else if (header === 'headline') {
    obj.headline = value.substring(0, 50) + (value.length > 50 ? '...' : '');
  } else if (header === 'enriched email') {
    obj.enriched_email = value;
  } else if (header === 'custom address') {
    obj.custom_address = value;
    // If it looks like an email and we don't have one yet, use it
    if (value.includes('@') && !obj.email && !obj.enriched_email) {
      obj.enriched_email = value;
    }
  } else if (header === 'job title') {
    obj.position = value;
  } else if (header === 'location') {
    obj.location = value;
  } else if (header === 'company') {
    obj.company = value;
  } else if (header === 'company url') {
    obj.company_url = value;
  } else if (header === 'tags') {
    obj.tags = value;
  }
});

console.log('MAPPED OBJECT:');
console.log(JSON.stringify(obj, null, 2));

console.log('\n--- SECOND LEAD (Bill Kallman with long headline) ---');
const secondLead = parseCSVLine(rows[2]);
console.log('Fields count:', secondLead.length);

const obj2 = {};
headers.forEach((header, index) => {
  const value = secondLead[index]?.trim();
  if (value) {
    obj2[header] = value.substring(0, 100) + (value.length > 100 ? '...' : '');
  }
});

console.log(JSON.stringify(obj2, null, 2));
