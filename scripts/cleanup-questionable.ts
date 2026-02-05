import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

// Load research results
const resultsJson = fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/research-results.json', 'utf-8');
const results = JSON.parse(resultsJson);

// Identify questionable companies based on reasoning
const questionableCompanies: string[] = [];

results.forEach((r: any) => {
  if (!r.offers_outbound || r.tags_to_add.length === 0) return;
  
  const reasoning = (r.reasoning || '').toLowerCase();
  
  // Check for inference language (weak evidence)
  const hasWeakEvidence = 
    reasoning.includes('typically') ||
    reasoning.includes('implied') ||
    reasoning.includes('aligns with') ||
    reasoning.includes('may include') ||
    reasoning.includes('could include') ||
    reasoning.includes('assumed');
  
  // Check for misidentified companies (reasoning mentions different company)
  const companyNameLower = r.company_name.toLowerCase();
  const mentionsDifferentCompany = 
    (companyNameLower.includes('outsource workers') && reasoning.includes('alorica')) ||
    (companyNameLower.includes('outsourcing in the philippines') && reasoning.includes('concentrix'));
  
  // Check for non-sales outbound (document requests, training, etc.)
  const isNonSalesOutbound =
    (reasoning.includes('outbound document') && !reasoning.includes('outbound call')) ||
    (reasoning.includes('outbound engagement') && reasoning.includes('training')) ||
    (reasoning.includes('outbound') && reasoning.includes('sustainability'));
  
  if (hasWeakEvidence || mentionsDifferentCompany || isNonSalesOutbound) {
    questionableCompanies.push(r.company_name);
    console.log(`Removing: ${r.company_name}`);
    console.log(`  Reason: ${hasWeakEvidence ? 'weak evidence' : mentionsDifferentCompany ? 'wrong company' : 'non-sales outbound'}`);
    console.log(`  Tags were: ${r.tags_to_add.join(', ')}`);
    console.log('');
  }
});

console.log(`\nTotal questionable companies to remove: ${questionableCompanies.length}\n`);

// Now update the master spreadsheet - remove the outbound tags we added for these companies
const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

const OUTBOUND_TAGS = [
  'Sales Outsourcing',
  'Outbound Services', 
  'B2C Telemarketing & Telesales',
  'Collections Recovery Services'
];

let removedCount = 0;

records.forEach((row: any) => {
  if (questionableCompanies.includes(row.company_name)) {
    const currentLines = row.service_lines || '';
    
    // Remove the outbound tags we added
    let newLines = currentLines;
    OUTBOUND_TAGS.forEach(tag => {
      // Remove the tag with various comma patterns
      newLines = newLines.replace(new RegExp(`,\\s*${tag}`, 'gi'), '');
      newLines = newLines.replace(new RegExp(`${tag}\\s*,\\s*`, 'gi'), '');
      newLines = newLines.replace(new RegExp(`^${tag}$`, 'gi'), '');
    });
    
    // Clean up any trailing/leading commas
    newLines = newLines.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
    
    if (newLines !== currentLines) {
      console.log(`Cleaned: ${row.company_name}`);
      console.log(`  Before: ${currentLines}`);
      console.log(`  After: ${newLines}`);
      row.service_lines = newLines;
      removedCount++;
    }
  }
});

// Write back
const headers = Object.keys(records[0]);
const csvOutput = stringify(records, { header: true, columns: headers });
fs.writeFileSync(csvPath, csvOutput);

console.log(`\n=== CLEANUP COMPLETE ===`);
console.log(`Removed outbound tags from ${removedCount} questionable companies`);
console.log(`Master spreadsheet updated!`);

// Now recount
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
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

function hasOutboundServiceTags(serviceLines: string): boolean {
  const lower = serviceLines.toLowerCase();
  return lower.includes('sales outsourcing') ||
         lower.includes('outbound services') ||
         lower.includes('b2c telemarketing') ||
         lower.includes('telesales') ||
         lower.includes('collections recovery');
}

// Recount
const filtered = records.filter((row: any) => isMidMarketOrEnterprise(row) && hasUSPresence(row));
const outboundUSCompanies = filtered.filter((row: any) => hasOutboundServiceTags(row.service_lines || ''));

console.log(`\n=== FINAL COUNT ===`);
console.log(`US + Mid Market/Enterprise + Outbound: ${outboundUSCompanies.length}`);

const bySize: Record<string, number> = {};
outboundUSCompanies.forEach((r: any) => {
  const size = r.size_employee_count || 'Unknown';
  bySize[size] = (bySize[size] || 0) + 1;
});

console.log(`\nBreakdown by size:`);
Object.entries(bySize).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

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

console.log(`\nBreakdown by tag:`);
Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
