import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
];

/** Normalize a single value: replace US or USA (as standalone) with United States */
function normalizeValue(val: string): string {
  if (!val || !val.trim()) return val;
  const out: string[] = [];
  for (const segment of val.split('|')) {
    const parts = segment.split(',').map(p => {
      const t = p.trim();
      if (t === 'US' || t === 'USA') return 'United States';
      return t;
    });
    out.push(parts.join(', '));
  }
  return out.join(' | ').trim();
}

function hasUSInField(field: string): boolean {
  if (!field || !field.trim()) return false;
  const lower = field.toLowerCase();
  if (lower.includes('united states') || lower.includes('usa')) return true;
  return US_STATES.some(state => new RegExp(`\\b${state}\\b`, 'i').test(field));
}

function hasUSHQ(row: any): boolean {
  return hasUSInField(row.company_hq || '');
}

function hasUSInAnyFootprint(row: any): boolean {
  return (
    hasUSInField(row.onshore_delivery_footprint || '') ||
    hasUSInField(row.nearshore_delivery_footprint || '') ||
    hasUSInField(row.offshore_delivery_footprint || '')
  );
}

const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';
const csv = fs.readFileSync(csvPath, 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

const colsToNormalize = ['company_hq', 'onshore_delivery_footprint', 'nearshore_delivery_footprint', 'offshore_delivery_footprint'];

let normalizedCount = 0;
let footprintAddedCount = 0;

records.forEach((row: any) => {
  colsToNormalize.forEach(col => {
    const before = row[col];
    if (!before) return;
    const after = normalizeValue(before);
    if (after !== before) {
      row[col] = after;
      normalizedCount++;
    }
  });

  // If US HQ but no US in any footprint, add United States to onshore (US HQ = US delivery)
  if (hasUSHQ(row) && !hasUSInAnyFootprint(row)) {
    const current = row.onshore_delivery_footprint || '';
    row.onshore_delivery_footprint = current ? `${current} | United States` : 'United States';
    footprintAddedCount++;
  }
});

// Write back Master List
const headers = Object.keys(records[0]);
const csvOutput = stringify(records, { header: true, columns: headers });
fs.writeFileSync(csvPath, csvOutput);

console.log('=== NORMALIZATION COMPLETE ===');
console.log('Values normalized (US/USA -> United States):', normalizedCount);
console.log('Rows with United States added to onshore (had US HQ, no US in footprint):', footprintAddedCount);
console.log('Master List saved.');
