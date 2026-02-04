import fs from 'fs';
import { parse } from 'csv-parse/sync';

const csv = fs.readFileSync('/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv', 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
];

// Outbound-related keywords to search in notes
const OUTBOUND_KEYWORDS = [
  'outbound',
  'sales outsourcing',
  'telemarketing',
  'telesales',
  'collection',
  'cold call',
  'lead generation',
  'appointment setting',
  'b2c',
  'outreach'
];

// Service line tags that indicate outbound services
const OUTBOUND_SERVICE_TAGS = [
  'sales outsourcing',
  'outbound services',
  'b2c telemarketing',
  'telesales',
  'collections recovery'
];

function hasUSPresence(row: any): boolean {
  const fieldsToCheck = [
    row.company_hq || '',
    row.onshore_delivery_footprint || '',
    row.nearshore_delivery_footprint || '',
    row.offshore_delivery_footprint || ''
  ];
  
  const combined = fieldsToCheck.join(' | ');
  const lowerCombined = combined.toLowerCase();
  
  if (lowerCombined.includes('united states') || 
      lowerCombined.includes(' usa') || 
      lowerCombined === 'usa' ||
      / us[,|\s|$]/.test(lowerCombined)) {
    return true;
  }
  
  for (const state of US_STATES) {
    const regex = new RegExp(`\\b${state}\\b`, 'i');
    if (regex.test(combined)) {
      return true;
    }
  }
  return false;
}

function isMidMarketOrEnterprise(row: any): boolean {
  const size = (row.size_employee_count || '').toLowerCase();
  return size.includes('mid market') || size.includes('enterprise');
}

function notesIndicateOutbound(notes: string): string[] {
  const lowerNotes = notes.toLowerCase();
  const foundKeywords: string[] = [];
  
  for (const keyword of OUTBOUND_KEYWORDS) {
    if (lowerNotes.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }
  return foundKeywords;
}

function hasOutboundServiceTags(serviceLines: string): boolean {
  const lowerServiceLines = serviceLines.toLowerCase();
  
  for (const tag of OUTBOUND_SERVICE_TAGS) {
    if (lowerServiceLines.includes(tag)) {
      return true;
    }
  }
  return false;
}

// Filter to Mid Market/Enterprise with US presence
const filtered = records.filter((row: any) => isMidMarketOrEnterprise(row) && hasUSPresence(row));

// Find accounts where notes mention outbound but service_lines don't have outbound tags
const discrepancies = filtered.filter((row: any) => {
  const notes = row.notes || '';
  const serviceLines = row.service_lines || '';
  
  const outboundInNotes = notesIndicateOutbound(notes);
  const hasOutboundTags = hasOutboundServiceTags(serviceLines);
  
  // Notes mention outbound-related services, but no outbound tags in service_lines
  return outboundInNotes.length > 0 && !hasOutboundTags;
});

// Count companies with: US presence + outbound service tags + MM/Enterprise
console.log('=== US + OUTBOUND + MM/ENTERPRISE COUNT ===\n');

// Filter: Mid Market or Enterprise + US presence + has outbound service tags
const outboundUSCompanies = filtered.filter((row: any) => {
  return hasOutboundServiceTags(row.service_lines || '');
});

console.log('Criteria:');
console.log('  - US presence (HQ, onshore, nearshore, or offshore)');
console.log('  - Mid Market or Enterprise size');
console.log('  - Has at least one outbound service tag:');
console.log('    • Sales Outsourcing');
console.log('    • Outbound Services');
console.log('    • B2C Telemarketing & Telesales');
console.log('    • Collections Recovery Services');
console.log('');
console.log(`Total matching companies: ${outboundUSCompanies.length}`);

// Breakdown by size
console.log('\n--- Breakdown by Size ---');
const bySize: Record<string, number> = {};
outboundUSCompanies.forEach((r: any) => {
  const size = r.size_employee_count || 'Unknown';
  bySize[size] = (bySize[size] || 0) + 1;
});
Object.entries(bySize).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Breakdown by which outbound tags they have
console.log('\n--- Breakdown by Outbound Tag ---');
const tagCounts: Record<string, number> = {
  'Sales Outsourcing': 0,
  'Outbound Services': 0,
  'B2C Telemarketing & Telesales': 0,
  'Collections Recovery Services': 0,
};

outboundUSCompanies.forEach((r: any) => {
  const sl = (r.service_lines || '').toLowerCase();
  if (sl.includes('sales outsourcing')) tagCounts['Sales Outsourcing']++;
  if (sl.includes('outbound services')) tagCounts['Outbound Services']++;
  if (sl.includes('b2c telemarketing') || sl.includes('telesales')) tagCounts['B2C Telemarketing & Telesales']++;
  if (sl.includes('collections recovery')) tagCounts['Collections Recovery Services']++;
});

Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Sample companies
console.log('\n--- Sample Companies (first 20) ---');
outboundUSCompanies.slice(0, 20).forEach((r: any, i: number) => {
  console.log(`${i + 1}. ${r.company_name} (${r.size_employee_count?.split(' ')[0]} ${r.size_employee_count?.split(' ')[1] || ''})`);
});
