import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
];

interface Company {
  company_name: string;
  website: string;
  company_hq: string;
  onshore_delivery_footprint: string;
}

interface StateResult {
  company_name: string;
  website: string;
  states: string[];
  raw_response: string;
}

function normalizeStates(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const state of US_STATES) {
    if (new RegExp('\\b' + state.replace(/\s/g, '\\s') + '\\b', 'i').test(text)) {
      found.push(state);
    }
  }
  if (lower.includes('d.c.') || lower.includes('district of columbia') || lower.includes('washington d.c')) {
    if (!found.includes('District of Columbia')) found.push('District of Columbia');
  }
  return found;
}

async function researchOnshoreState(company: Company): Promise<StateResult> {
  const prompt = `Where in the United States does "${company.company_name}" (${company.website}) have contact center, call center, or customer service delivery locations or offices? 

Reply with ONLY a comma-separated list of US state names (e.g. "California, Texas, Florida"). If HQ is in a state, you can include that. If you cannot find specific states, reply with exactly: Unknown`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();

    const states = content.toLowerCase() === 'unknown' ? [] : normalizeStates(content);

    return {
      company_name: company.company_name,
      website: company.website,
      states,
      raw_response: content,
    };
  } catch (error) {
    return {
      company_name: company.company_name,
      website: company.website,
      states: [],
      raw_response: `Error: ${error}`,
    };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RESULTS_PATH = '/Users/alicewyatt/repos/agent-playground/data/onshore-state-results.json';
const CSV_PATH = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';

async function main() {
  const companies: Company[] = JSON.parse(
    fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/onshore-us-only-to-research.json', 'utf-8')
  );

  let results: StateResult[] = [];
  if (fs.existsSync(RESULTS_PATH)) {
    results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
    console.log('Resuming: already have', results.length, 'results');
  }

  const BATCH_SIZE = 5;
  const DELAY_MS = 1200;
  const startIndex = results.length;
  const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : companies.length;
  const endIndex = Math.min(startIndex + LIMIT, companies.length);

  for (let i = startIndex; i < endIndex; i += BATCH_SIZE) {
    const batch = companies.slice(i, Math.min(i + BATCH_SIZE, endIndex));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil((endIndex - startIndex) / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, endIndex)} of ${endIndex})...`);

    const batchResults = await Promise.all(batch.map(c => researchOnshoreState(c)));
    results.push(...batchResults);

    fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

    const withState = results.filter(r => r.states.length > 0).length;
    const unknown = results.filter(r => r.states.length === 0 && !r.raw_response.includes('Error')).length;
    console.log(`  Found state(s) for: ${withState}, Unknown: ${unknown}`);

    if (i + BATCH_SIZE < endIndex) await sleep(DELAY_MS);
  }

  console.log('\n=== RESEARCH COMPLETE ===');
  console.log('Total:', results.length);
  console.log('With state(s) found:', results.filter(r => r.states.length > 0).length);
  console.log('Unknown/error:', results.filter(r => r.states.length === 0).length);

  const toUpdate = results.filter(r => r.states.length > 0);
  if (toUpdate.length === 0) {
    console.log('No onshore footprint updates to apply.');
    return;
  }

  console.log('\n=== UPDATING MASTER LIST ===');
  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csv, { columns: true, skip_empty_lines: true });
  let updated = 0;

  records.forEach((row: any) => {
    const r = toUpdate.find(x => x.company_name === row.company_name);
    if (r && r.states.length > 0) {
      const newOnshore = r.states.join(' | ');
      if (row.onshore_delivery_footprint !== newOnshore) {
        row.onshore_delivery_footprint = newOnshore;
        updated++;
      }
    }
  });

  const headers = Object.keys(records[0]);
  fs.writeFileSync(CSV_PATH, stringify(records, { header: true, columns: headers }));
  console.log('Updated onshore_delivery_footprint for', updated, 'rows. Master List saved.');
}

main().catch(console.error);
