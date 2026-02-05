import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';
const csv = fs.readFileSync(csvPath, 'utf-8');
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

// Add qualified column to each record
let qualifiedCount = 0;
records.forEach((row: any) => {
  const isQualified = hasUSPresence(row) && isMidMarketOrEnterprise(row) && hasOutboundTags(row);
  row.qualified = isQualified ? 'Y' : 'N';
  if (isQualified) qualifiedCount++;
});

// Get headers with qualified column at the end
const headers = Object.keys(records[0]);

// Write to new CSV file
const outputPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map - With Qualified.csv';
const csvOutput = stringify(records, { header: true, columns: headers });
fs.writeFileSync(outputPath, csvOutput);

console.log(`Total records: ${records.length}`);
console.log(`Qualified (Y): ${qualifiedCount}`);
console.log(`Not qualified (N): ${records.length - qualifiedCount}`);
console.log(`\nSaved to: ${outputPath}`);
