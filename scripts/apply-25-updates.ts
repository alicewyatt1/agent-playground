import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';
const csv = fs.readFileSync(csvPath, 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

// The 25 clean companies with their tags
const updates: Record<string, string[]> = {
  'Firstsource Solutions Limited': ['Outbound Services', 'Sales Outsourcing'],
  'Direct Interactions': ['Outbound Services'],
  'eClerx Services': ['Sales Outsourcing', 'Outbound Services'],
  'Harte Hanks': ['Sales Outsourcing', 'Outbound Services', 'B2C Telemarketing & Telesales'],
  'Tata Business Support Services': ['Collections Recovery Services'],
  'Bluechip Call Center': ['Outbound Services'],
  'Answer Carolina': ['Outbound Services'],
  'CGI': ['Collections Recovery Services'],
  'Gebbs': ['Collections Recovery Services', 'Outbound Services'],
  'HGS': ['Sales Outsourcing', 'Outbound Services'],
  'Itel International': ['Sales Outsourcing', 'Outbound Services', 'B2C Telemarketing & Telesales'],
  'Movate': ['Sales Outsourcing', 'Outbound Services'],
  'VEE Healthek': ['Outbound Services'],
  'Toptal': ['Sales Outsourcing'],
  'Clearsource Bpo': ['Outbound Services'],
  'Imagenet Llc': ['Outbound Services'],
  'Medusind Solutions India Pvt Ltd': ['Outbound Services'],
  'Neusoft Corporation': ['B2C Telemarketing & Telesales'],
  'Global Healthcare Resource': ['Outbound Services'],
  'Netsmartz Llc': ['Outbound Services'],
  'Magic': ['Sales Outsourcing', 'Outbound Services', 'B2C Telemarketing & Telesales'],
  'Ohio Digital': ['Sales Outsourcing', 'Outbound Services'],
  'Csg Inbound Communication': ['Outbound Services'],
  'Personiv': ['Sales Outsourcing', 'Outbound Services'],
  'Aptara': ['Sales Outsourcing', 'Outbound Services', 'Collections Recovery Services'],
};

console.log('=== APPLYING 25 UPDATES ===\n');

let updatedCount = 0;
let contactCenterAdded = 0;

records.forEach((row: any) => {
  const companyName = row.company_name;
  if (updates[companyName]) {
    const tagsToAdd = updates[companyName];
    
    console.log(`Updating: ${companyName}`);
    
    // Add service line tags
    const currentLines = row.service_lines || '';
    const newTags = tagsToAdd.filter(tag => 
      !currentLines.toLowerCase().includes(tag.toLowerCase())
    );
    
    if (newTags.length > 0) {
      row.service_lines = currentLines ? `${currentLines}, ${newTags.join(', ')}` : newTags.join(', ');
      console.log(`  + Service lines: ${newTags.join(', ')}`);
    }
    
    // Add contact center to other_services if not already present
    const coreOffering = (row.core_offering || '').toLowerCase();
    const otherServices = (row.other_services || '').toLowerCase();
    
    if (!coreOffering.includes('contact center') && !otherServices.includes('contact center')) {
      row.other_services = row.other_services ? `${row.other_services}, contact center` : 'contact center';
      console.log(`  + Secondary offering: contact center`);
      contactCenterAdded++;
    }
    
    updatedCount++;
    console.log('');
  }
});

// Write back
const headers = Object.keys(records[0]);
const csvOutput = stringify(records, { header: true, columns: headers });
fs.writeFileSync(csvPath, csvOutput);

console.log('=== UPDATE COMPLETE ===');
console.log(`Companies updated: ${updatedCount}`);
console.log(`Contact center added to secondary: ${contactCenterAdded}`);
console.log('Master spreadsheet saved!\n');

// Now recount final totals
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
  const combined = [row.company_hq, row.onshore_delivery_footprint, row.nearshore_delivery_footprint, row.offshore_delivery_footprint].join(' | ');
  const lower = combined.toLowerCase();
  if (lower.includes('united states') || lower.includes(' usa') || / us[,|\s|$]/.test(lower)) return true;
  return US_STATES.some(state => new RegExp(`\\b${state}\\b`, 'i').test(combined));
}

function isMidMarketOrEnterprise(row: any): boolean {
  const size = (row.size_employee_count || '').toLowerCase();
  return size.includes('mid market') || size.includes('enterprise');
}

function hasOutboundTags(row: any): boolean {
  const sl = (row.service_lines || '').toLowerCase();
  return sl.includes('sales outsourcing') || sl.includes('outbound services') || 
         sl.includes('b2c telemarketing') || sl.includes('telesales') || sl.includes('collections recovery');
}

const usMMEnterprise = records.filter((r: any) => hasUSPresence(r) && isMidMarketOrEnterprise(r));
const withOutbound = usMMEnterprise.filter((r: any) => hasOutboundTags(r));
const withoutOutbound = usMMEnterprise.filter((r: any) => !hasOutboundTags(r));

console.log('=== FINAL COUNT ===');
console.log(`US + MM/Enterprise total: ${usMMEnterprise.length}`);
console.log(`With outbound tags: ${withOutbound.length}`);
console.log(`Without outbound tags: ${withoutOutbound.length}`);

console.log('\nBreakdown by size (with outbound):');
const bySize: Record<string, number> = {};
withOutbound.forEach((r: any) => { bySize[r.size_employee_count] = (bySize[r.size_employee_count] || 0) + 1; });
Object.entries(bySize).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

const tagCounts: Record<string, number> = {
  'Sales Outsourcing': 0,
  'Outbound Services': 0,
  'B2C Telemarketing & Telesales': 0,
  'Collections Recovery Services': 0,
};

withOutbound.forEach((r: any) => {
  const sl = (r.service_lines || '').toLowerCase();
  if (sl.includes('sales outsourcing')) tagCounts['Sales Outsourcing']++;
  if (sl.includes('outbound services')) tagCounts['Outbound Services']++;
  if (sl.includes('b2c telemarketing') || sl.includes('telesales')) tagCounts['B2C Telemarketing & Telesales']++;
  if (sl.includes('collections recovery')) tagCounts['Collections Recovery Services']++;
});

console.log('\nBreakdown by tag:');
Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
