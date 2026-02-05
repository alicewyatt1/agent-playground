import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface Company {
  company_name: string;
  website: string;
}

interface CaptiveResult {
  company_name: string;
  website: string;
  is_captive: boolean;
  classification: string;
  reasoning: string;
}

async function checkCaptive(company: Company): Promise<CaptiveResult> {
  const prompt = `Is "${company.company_name}" (${company.website}) a THIRD-PARTY BPO/contact center outsourcing provider that serves external clients, OR a CAPTIVE operation?

Definitions:
- THIRD-PARTY BPO: A company that provides contact center/BPO services to OTHER companies as clients (e.g. Concentrix, Teleperformance, Alorica).
- CAPTIVE BPO: A company that runs its own in-house contact center primarily for its OWN business (e.g. JPMorgan Chase's call centers serving Chase customers, not external clients). The contact center is an internal function, not an outsourcing vendor.

Respond in this exact JSON format only:
{
  "classification": "Third-party BPO" or "Captive" or "Unclear",
  "is_captive": true or false,
  "reasoning": "One sentence explanation"
}`;

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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const isCaptive = parsed.is_captive === true || (parsed.classification || '').toLowerCase().includes('captive');
      return {
        company_name: company.company_name,
        website: company.website,
        is_captive: isCaptive,
        classification: parsed.classification || 'Unclear',
        reasoning: parsed.reasoning || '',
      };
    }
    return {
      company_name: company.company_name,
      website: company.website,
      is_captive: false,
      classification: 'Unclear',
      reasoning: 'Could not parse response',
    };
  } catch (error) {
    return {
      company_name: company.company_name,
      website: company.website,
      is_captive: false,
      classification: 'Error',
      reasoning: `Error: ${error}`,
    };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RESULTS_PATH = '/Users/alicewyatt/repos/agent-playground/data/captive-bpo-results.json';
const CSV_PATH = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';

async function main() {
  const companies: Company[] = JSON.parse(
    fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/qualified-for-captive-check.json', 'utf-8')
  );

  let results: CaptiveResult[] = [];
  if (fs.existsSync(RESULTS_PATH)) {
    results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
    console.log('Resuming: already have', results.length, 'results');
  }

  const BATCH_SIZE = 5;
  const DELAY_MS = 1200;
  const startIndex = results.length;
  const endIndex = companies.length;

  for (let i = startIndex; i < endIndex; i += BATCH_SIZE) {
    const batch = companies.slice(i, Math.min(i + BATCH_SIZE, endIndex));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil((endIndex - startIndex) / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, endIndex)} of ${endIndex})...`);

    const batchResults = await Promise.all(batch.map(c => checkCaptive(c)));
    results.push(...batchResults);

    fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

    const captives = results.filter(r => r.is_captive).length;
    console.log(`  Captives flagged so far: ${captives}`);

    if (i + BATCH_SIZE < endIndex) await sleep(DELAY_MS);
  }

  const captives = results.filter(r => r.is_captive);
  console.log('\n=== CAPTIVE BPO CHECK COMPLETE ===');
  console.log('Total qualified accounts checked:', results.length);
  console.log('Captive BPOs flagged:', captives.length);

  if (captives.length > 0) {
    console.log('\n--- FLAGGED AS CAPTIVE ---');
    captives.forEach((r, i) => {
      console.log(`${i + 1}. ${r.company_name}`);
      console.log(`   Website: ${r.website}`);
      console.log(`   Reasoning: ${r.reasoning}`);
      console.log('');
    });
  }

  // Add captive flag to Master List
  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csv, { columns: true, skip_empty_lines: true });
  const captiveNames = new Set(captives.map(r => r.company_name));

  records.forEach((row: any) => {
    row.captive_bpo = captiveNames.has(row.company_name) ? 'Y' : '';
  });

  const headers = Object.keys(records[0]);
  fs.writeFileSync(CSV_PATH, stringify(records, { header: true, columns: headers }));
  console.log('\nMaster List updated: added "captive_bpo" column (Y = flagged as captive).');
}

main().catch(console.error);
