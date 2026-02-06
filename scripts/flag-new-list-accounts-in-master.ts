import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Target accounts from the "new list" to find in the master list. */
const TARGET_ACCOUNTS: Array<{
  label: string;
  namePatterns: RegExp[] | string[];
  websitePatterns: string[];
}> = [
  {
    label: 'Contact Point 360',
    namePatterns: [/contactpoint\s*360/i, 'Contact Point 360'],
    websitePatterns: ['contactpoint360.com'],
  },
  {
    label: 'Eastwest BPO Inc.',
    namePatterns: [/eastwest\s*enterprises/i, /eastwest\s*bpo/i],
    websitePatterns: ['eastwestbpo.com'],
  },
  {
    label: 'Global Integrated Contact Facilities Inc. (GICF)',
    namePatterns: [/gicf/i, /global integrated contact facilities/i],
    websitePatterns: ['gicf.ph'],
  },
  {
    label: 'Infinit Outsourcing Inc.',
    namePatterns: [/infinit-o/i, /infinit outsourcing/i],
    websitePatterns: ['infinit-o.com'],
  },
  {
    label: 'Nearsol Philippines Inc.',
    namePatterns: [/nearsol/i],
    websitePatterns: ['nearsol.com', 'nearsol.us'],
  },
  {
    label: 'OAMPI Inc. (Open Access BPO)',
    namePatterns: [/expanding teams/i, /open access bpo/i, /oampi/i],
    websitePatterns: ['openaccessbpo.com'],
  },
  {
    label: 'Pilipinas Teleserv Inc.',
    namePatterns: [/pilipinas teleserv/i, /teleserv\.ph/i],
    websitePatterns: ['teleserv.ph'],
  },
  {
    label: 'Sourcefit Philippines Inc.',
    namePatterns: [/sourcefit/i],
    websitePatterns: ['sourcefit.com'],
  },
  {
    label: 'Global Strategic',
    namePatterns: [/global strategic/i],
    websitePatterns: ['globalstrategic.com'],
  },
  {
    label: 'Intelogix',
    namePatterns: [/intelogix/i],
    websitePatterns: ['intelogix.com'],
  },
  {
    label: 'ISSI Corp',
    namePatterns: [/issi corp/i],
    websitePatterns: ['issicorp.com'],
  },
];

function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return u.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchTarget(row: Record<string, string>): string {
  const name = (row.company_name || '').trim();
  const website = normalizeUrl(row.website || '');
  const profileUrl = normalizeUrl(row.company_profile_url || '');

  for (const target of TARGET_ACCOUNTS) {
    const nameMatch = target.namePatterns.some((p) =>
      typeof p === 'string' ? name.toLowerCase() === p.toLowerCase() : (p as RegExp).test(name)
    );
    const urlMatch = target.websitePatterns.some(
      (domain) =>
        website.includes(domain) ||
        profileUrl.includes(domain)
    );
    if (nameMatch || urlMatch) return target.label;
  }
  return '';
}

async function main() {
  const masterPath = path.join(
    process.env.HOME || '',
    'Downloads',
    'Global Contact Center Market Map (Final) - NEW Master List.csv'
  );
  if (!fs.existsSync(masterPath)) {
    console.error('Master list not found:', masterPath);
    process.exit(1);
  }

  const csv = fs.readFileSync(masterPath, 'utf-8');
  const records = parse(csv, { columns: true, skip_empty_lines: true });

  const flagged: Array<{ label: string; company_name: string; rowIndex: number }> = [];
  records.forEach((row: Record<string, string>, i: number) => {
    const label = matchTarget(row);
    (row as Record<string, string>).in_new_list = label || '';
    if (label) flagged.push({ label, company_name: row.company_name, rowIndex: i + 2 });
  });

  const headers = Object.keys(records[0] as Record<string, string>);
  const outPath = path.join(__dirname, '..', 'data', 'Global Contact Center Market Map (Final) - NEW Master List-FLAGGED.csv');
  const csvOutput = stringify(records, { header: true, columns: headers });
  fs.writeFileSync(outPath, csvOutput);

  console.log(`Master list: ${records.length} rows`);
  console.log(`Flagged (in new list): ${flagged.length} accounts\n`);
  if (flagged.length) {
    console.log('Matches:');
    flagged.forEach(({ label, company_name, rowIndex }) => {
      console.log(`  ${label} → "${company_name}" (row ${rowIndex})`);
    });
  }
  console.log(`\nSaved: ${outPath}`);
}

main().catch(console.error);
