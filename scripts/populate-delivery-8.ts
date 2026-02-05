import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const CSV_PATH = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';

interface Company {
  company_name: string;
  website: string;
  company_hq: string;
  delivery_model: string;
  onshore_delivery_footprint: string;
  nearshore_delivery_footprint: string;
  offshore_delivery_footprint: string;
}

interface DeliveryResult {
  company_name: string;
  delivery_model: string;
  onshore: string;
  nearshore: string;
  offshore: string;
  raw: string;
}

async function researchDelivery(company: Company): Promise<DeliveryResult> {
  const prompt = `For "${company.company_name}" (${company.website}), a contact center/BPO company:

1. Where do they deliver contact center services from? (onshore = same country as client/US, nearshore = nearby countries e.g. Mexico/Canada, offshore = e.g. Philippines/India)
2. List specific countries or regions for each: onshore locations, nearshore locations, offshore locations.

Respond in this JSON only:
{
  "delivery_model": "onshore" or "nearshore" or "offshore" or "onshore, nearshore" or "onshore, offshore" or "onshore, nearshore, offshore" etc.,
  "onshore_locations": "country or US states, pipe-separated if multiple",
  "nearshore_locations": "countries or empty",
  "offshore_locations": "countries or empty"
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
        max_tokens: 350,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const p = JSON.parse(jsonMatch[0]);
      return {
        company_name: company.company_name,
        delivery_model: p.delivery_model || 'onshore',
        onshore: p.onshore_locations || '',
        nearshore: p.nearshore_locations || '',
        offshore: p.offshore_locations || '',
        raw: content,
      };
    }
    return {
      company_name: company.company_name,
      delivery_model: 'onshore',
      onshore: company.onshore_delivery_footprint || '',
      nearshore: '',
      offshore: '',
      raw: content,
    };
  } catch (error) {
    return {
      company_name: company.company_name,
      delivery_model: 'onshore',
      onshore: company.onshore_delivery_footprint || '',
      nearshore: '',
      offshore: '',
      raw: `Error: ${error}`,
    };
  }
}

async function main() {
  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
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

  function hasUSPresence(r: any) {
    const c = [r.company_hq, r.onshore_delivery_footprint, r.nearshore_delivery_footprint, r.offshore_delivery_footprint].join(' ');
    return /united states|usa/i.test(c) || US_STATES.some(s => new RegExp('\\b' + s + '\\b', 'i').test(c));
  }
  function isMMEnt(r: any) {
    const s = (r.size_employee_count || '').toLowerCase();
    return s.includes('mid market') || s.includes('enterprise');
  }
  function hasOutbound(r: any) {
    const s = (r.service_lines || '').toLowerCase();
    return s.includes('sales outsourcing') || s.includes('outbound services') || s.includes('b2c telemarketing') || s.includes('telesales') || s.includes('collections recovery');
  }
  function isEmpty(v: any) {
    return v === undefined || v === null || String(v).trim() === '';
  }

  const qualified = records.filter((r: any) => hasUSPresence(r) && isMMEnt(r) && hasOutbound(r));
  const missing = qualified.filter((r: any) => isEmpty(r.delivery_model));

  console.log('Researching', missing.length, 'accounts for delivery model and footprint...\n');

  const results: DeliveryResult[] = [];
  for (const row of missing) {
    const res = await researchDelivery(row);
    results.push(res);
    console.log(res.company_name, '-> delivery_model:', res.delivery_model);
  }

  fs.writeFileSync('/Users/alicewyatt/repos/agent-playground/data/delivery-8-results.json', JSON.stringify(results, null, 2));

  // Update Master List
  const byName = new Map(results.map(r => [r.company_name, r]));
  let updated = 0;
  records.forEach((row: any) => {
    const r = byName.get(row.company_name);
    if (!r) return;
    if (!row.delivery_model || row.delivery_model.trim() === '') {
      row.delivery_model = r.delivery_model;
      updated++;
    }
    if (r.onshore && (!row.onshore_delivery_footprint || row.onshore_delivery_footprint.trim() === '')) {
      row.onshore_delivery_footprint = r.onshore;
    }
    if (r.nearshore && (!row.nearshore_delivery_footprint || row.nearshore_delivery_footprint.trim() === '')) {
      row.nearshore_delivery_footprint = r.nearshore;
    }
    if (r.offshore && (!row.offshore_delivery_footprint || row.offshore_delivery_footprint.trim() === '')) {
      row.offshore_delivery_footprint = r.offshore;
    }
  });

  const headers = Object.keys(records[0]);
  fs.writeFileSync(CSV_PATH, stringify(records, { header: true, columns: headers }));

  console.log('\n=== DONE ===');
  console.log('Updated delivery_model for', updated, 'rows.');
  console.log('Results saved to data/delivery-8-results.json');
  console.log('\nPer-company:');
  results.forEach(r => {
    console.log(r.company_name + ':');
    console.log('  delivery_model:', r.delivery_model);
    console.log('  onshore:', r.onshore || '(unchanged)');
    console.log('  nearshore:', r.nearshore || '(unchanged)');
    console.log('  offshore:', r.offshore || '(unchanged)');
  });
}

main().catch(console.error);
