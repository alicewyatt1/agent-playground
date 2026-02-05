import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const CSV_PATH = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';

// Countries that appear in the dataset (and common variants). Long names first for matching.
const COUNTRY_LIST = [
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Dominican Republic',
  'South Africa',
  'South Korea',
  'New Zealand',
  'Costa Rica',
  'El Salvador',
  'Sri Lanka',
  'Czech Republic',
  'Puerto Rico',
  'Argentina',
  'Australia',
  'Bulgaria',
  'Canada',
  'China',
  'Colombia',
  'Croatia',
  'Egypt',
  'England', // → United Kingdom
  'France',
  'Germany',
  'India',
  'Indonesia',
  'Ireland',
  'Jamaica',
  'Malta',
  'Mexico',
  'Nepal',
  'Pakistan',
  'Philippines',
  'Poland',
  'Romania',
  'Singapore',
  'Spain',
  'Tunisia',
  'Ukraine',
  'Vietnam',
  'UK', // → United Kingdom
];

const COUNTRY_ALIASES: Record<string, string> = {
  US: 'United States',
  USA: 'United States',
  UK: 'United Kingdom',
  England: 'United Kingdom',
};

function normalizeHQ(hq: string): string {
  if (!hq || !hq.trim()) return hq;
  let val = hq.trim();

  // 1. Normalize US variants
  val = val.replace(/\bUSA\b/gi, 'United States');
  val = val.replace(/\bUS\b/g, 'United States');

  // 2. If it's already just a known country, return it
  const valLower = val.toLowerCase();
  for (const country of COUNTRY_LIST) {
    if (country.toLowerCase() === valLower) {
      return COUNTRY_ALIASES[country] || country;
    }
  }
  if (COUNTRY_ALIASES[val]) return COUNTRY_ALIASES[val];

  // 3. Find a country in the string (prefer longer matches first)
  const sortedCountries = [...COUNTRY_LIST].sort((a, b) => b.length - a.length);
  for (const country of sortedCountries) {
    const regex = new RegExp('\\b' + country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (regex.test(val)) {
      return COUNTRY_ALIASES[country] || country;
    }
  }

  // 4. Try last segment after comma (e.g. "City, Country")
  const parts = val.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    for (const country of sortedCountries) {
      if (country.toLowerCase() === last.toLowerCase()) {
        return COUNTRY_ALIASES[country] || country;
      }
    }
    if (COUNTRY_ALIASES[last]) return COUNTRY_ALIASES[last];
    if (/\b(United States|USA|US)\b/i.test(last)) return 'United States';
    if (/\b(United Kingdom|UK|England)\b/i.test(last)) return 'United Kingdom';
    // Last part might be state abbreviation (e.g. IL) - check for United States elsewhere
    if (/\bUnited States\b/i.test(val)) return 'United States';
    if (/\bUSA\b/i.test(val)) return 'United States';
    if (/\bUnited Kingdom\b/i.test(val)) return 'United Kingdom';
    if (/\bEngland\b/i.test(val)) return 'United Kingdom';
    if (/\bGermany\b/i.test(val)) return 'Germany';
    if (/\bPhilippines\b/i.test(val)) return 'Philippines';
    if (/\bIndia\b/i.test(val)) return 'India';
    if (/\bMexico\b/i.test(val)) return 'Mexico';
    if (/\bCanada\b/i.test(val)) return 'Canada';
    if (/\bJamaica\b/i.test(val)) return 'Jamaica';
    if (/\bSingapore\b/i.test(val)) return 'Singapore';
    if (/\bIreland\b/i.test(val)) return 'Ireland';
    if (/\bColombia\b/i.test(val)) return 'Colombia';
    if (/\bSouth Africa\b/i.test(val)) return 'South Africa';
    if (/\bArgentina\b/i.test(val)) return 'Argentina';
    if (/\bSpain\b/i.test(val)) return 'Spain';
    if (/\bFrance\b/i.test(val)) return 'France';
    if (/\bPoland\b/i.test(val)) return 'Poland';
    if (/\bUkraine\b/i.test(val)) return 'Ukraine';
    if (/\bRomania\b/i.test(val)) return 'Romania';
    if (/\bCroatia\b/i.test(val)) return 'Croatia';
    if (/\bMalta\b/i.test(val)) return 'Malta';
    if (/\bPakistan\b/i.test(val)) return 'Pakistan';
    if (/\bVietnam\b/i.test(val)) return 'Vietnam';
    if (/\bNepal\b/i.test(val)) return 'Nepal';
    if (/\bEgypt\b/i.test(val)) return 'Egypt';
    if (/\bChina\b/i.test(val)) return 'China';
    if (/\bIndonesia\b/i.test(val)) return 'Indonesia';
    if (/\bDominican Republic\b/i.test(val)) return 'Dominican Republic';
    if (/\bUnited Arab Emirates\b/i.test(val)) return 'United Arab Emirates';
    if (/\bTunisia\b/i.test(val)) return 'Tunisia';
    if (/\bBulgaria\b/i.test(val)) return 'Bulgaria';
    if (/\bCosta Rica\b/i.test(val)) return 'Costa Rica';
    if (/\bEl Salvador\b/i.test(val)) return 'El Salvador';
  }

  // 5. Fallback: return as-is if we can't determine country
  return val;
}

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
  if (lower.includes('united states') || lower.includes('usa')) return true;
  return US_STATES.some(s => new RegExp('\\b' + s + '\\b', 'i').test(combined));
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

const csv = fs.readFileSync(CSV_PATH, 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

const qualifiedSet = new Set(
  records
    .filter((r: any) => hasUSPresence(r) && isMidMarketOrEnterprise(r) && hasOutboundTags(r))
    .map((r: any) => r.company_name)
);

let updated = 0;
const changes: [string, string, string][] = [];

records.forEach((row: any) => {
  if (!qualifiedSet.has(row.company_name)) return;
  const before = row.company_hq || '';
  const after = normalizeHQ(before);
  if (after !== before) {
    row.company_hq = after;
    updated++;
    changes.push([row.company_name, before, after]);
  }
});

const headers = Object.keys(records[0]);
fs.writeFileSync(CSV_PATH, stringify(records, { header: true, columns: headers }));

console.log('=== HQ NORMALIZATION (Qualified accounts only) ===\n');
console.log('Rules: USA/US → United States; only country kept (no city/state)\n');
console.log('Updated', updated, 'rows.\n');
if (changes.length > 0) {
  console.log('Changes:');
  changes.forEach(([name, before, after]) => console.log(`  ${name}: "${before}" → "${after}"`));
}
console.log('\nMaster List saved.');
