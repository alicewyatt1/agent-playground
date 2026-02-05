import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

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

// Get the 252 without outbound tags
const withoutOutbound = records.filter((r: any) => 
  hasUSPresence(r) && isMidMarketOrEnterprise(r) && !hasOutboundTags(r)
);

console.log(`Found ${withoutOutbound.length} companies to research\n`);

interface ResearchResult {
  company_name: string;
  website: string;
  offers_outbound: boolean;
  tags_to_add: string[];
  evidence: string;
}

async function researchCompany(company: any): Promise<ResearchResult> {
  const prompt = `Research "${company.company_name}" (${company.website}) for EXPLICIT evidence of these services:

1. Sales Outsourcing - Do they explicitly offer outsourced sales teams or B2B/B2C sales services?
2. Outbound Services - Do they explicitly offer outbound calling or proactive customer contact?
3. B2C Telemarketing & Telesales - Do they explicitly offer telemarketing or telesales campaigns?
4. Collections Recovery Services - Do they explicitly offer debt collection or accounts receivable recovery?

STRICT RULES:
- Only include a tag if there is EXPLICIT mention on their website or official sources
- Do NOT infer or assume - require direct evidence
- "Customer service" or "call center" alone is NOT enough
- Words like "sales support" or "customer acquisition" need explicit outbound/calling context

Respond ONLY with this JSON (no other text):
{
  "offers_outbound": true/false,
  "tags": ["only tags with EXPLICIT evidence"],
  "evidence": "quote the exact phrase or service name that proves it"
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
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        company_name: company.company_name,
        website: company.website,
        offers_outbound: parsed.offers_outbound || false,
        tags_to_add: parsed.tags || [],
        evidence: parsed.evidence || '',
      };
    }
    
    return {
      company_name: company.company_name,
      website: company.website,
      offers_outbound: false,
      tags_to_add: [],
      evidence: 'Could not parse response',
    };
  } catch (error) {
    return {
      company_name: company.company_name,
      website: company.website,
      offers_outbound: false,
      tags_to_add: [],
      evidence: `Error: ${error}`,
    };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`=== RESEARCHING ${withoutOutbound.length} COMPANIES (STRICT CRITERIA) ===\n`);
  
  const results: ResearchResult[] = [];
  const BATCH_SIZE = 5;
  const DELAY_MS = 1000;
  
  for (let i = 0; i < withoutOutbound.length; i += BATCH_SIZE) {
    const batch = withoutOutbound.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(withoutOutbound.length / BATCH_SIZE);
    
    console.log(`Processing batch ${batchNum}/${totalBatches}...`);
    
    const batchResults = await Promise.all(batch.map((c: any) => researchCompany(c)));
    results.push(...batchResults);
    
    const outboundCount = results.filter(r => r.offers_outbound && r.tags_to_add.length > 0).length;
    console.log(`  Found ${outboundCount} with explicit outbound evidence so far`);
    
    // Save intermediate results
    fs.writeFileSync(
      '/Users/alicewyatt/repos/agent-playground/data/research-remaining-results.json',
      JSON.stringify(results, null, 2)
    );
    
    if (i + BATCH_SIZE < withoutOutbound.length) {
      await sleep(DELAY_MS);
    }
  }
  
  // Final results - only those with explicit evidence
  const withOutbound = results.filter(r => r.offers_outbound && r.tags_to_add.length > 0);
  
  console.log('\n=== RESEARCH COMPLETE ===\n');
  console.log(`Total companies researched: ${results.length}`);
  console.log(`Companies with EXPLICIT outbound evidence: ${withOutbound.length}`);
  
  if (withOutbound.length > 0) {
    console.log('\n=== PROPOSED UPDATES (PENDING APPROVAL) ===\n');
    
    withOutbound.forEach((r, i) => {
      console.log(`${i + 1}. ${r.company_name}`);
      console.log(`   Website: ${r.website}`);
      console.log(`   Tags to add: ${r.tags_to_add.join(', ')}`);
      console.log(`   Evidence: ${r.evidence}`);
      console.log(`   + Add "contact center" to other_services`);
      console.log('');
    });
    
    // Tag breakdown
    const tagCounts: Record<string, number> = {};
    withOutbound.forEach(r => {
      r.tags_to_add.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    console.log('Tag breakdown:');
    Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });
  }
  
  console.log('\n*** NOT YET APPLIED - Awaiting approval ***');
}

main().catch(console.error);
