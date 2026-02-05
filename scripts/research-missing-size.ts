import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map - With Qualified.csv';
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

function hasOutboundTags(row: any): boolean {
  const sl = (row.service_lines || '').toLowerCase();
  return sl.includes('sales outsourcing') || sl.includes('outbound services') || 
         sl.includes('b2c telemarketing') || sl.includes('telesales') || sl.includes('collections recovery');
}

// Get US accounts with missing size
const missingSizeUS = records.filter((r: any) => 
  (!r.size_employee_count || r.size_employee_count.trim() === '') && hasUSPresence(r)
);

console.log(`Found ${missingSizeUS.length} US accounts with missing size\n`);

interface SizeResult {
  company_name: string;
  website: string;
  employee_count: string;
  size_category: string;
  evidence: string;
}

async function researchCompanySize(company: any): Promise<SizeResult> {
  const prompt = `How many employees does "${company.company_name}" (${company.website}) have?

I need to categorize them as:
- SME: 1-1,000 employees
- Mid Market: 1,000-5,000 employees  
- Enterprise: 5,000+ employees

Respond ONLY with this JSON (no other text):
{
  "employee_count": "approximate number or range",
  "size_category": "SME (1–1,000 employees)" or "Mid Market (1,000–5,000 employees)" or "Enterprise (5,000+ employees)" or "Unknown",
  "evidence": "source of the employee count info"
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
        max_tokens: 300,
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
        employee_count: parsed.employee_count || 'Unknown',
        size_category: parsed.size_category || 'Unknown',
        evidence: parsed.evidence || '',
      };
    }
    
    return {
      company_name: company.company_name,
      website: company.website,
      employee_count: 'Unknown',
      size_category: 'Unknown',
      evidence: 'Could not parse response',
    };
  } catch (error) {
    return {
      company_name: company.company_name,
      website: company.website,
      employee_count: 'Unknown',
      size_category: 'Unknown',
      evidence: `Error: ${error}`,
    };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`=== RESEARCHING ${missingSizeUS.length} US COMPANIES FOR SIZE ===\n`);
  
  const results: SizeResult[] = [];
  const BATCH_SIZE = 5;
  const DELAY_MS = 1000;
  
  for (let i = 0; i < missingSizeUS.length; i += BATCH_SIZE) {
    const batch = missingSizeUS.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(missingSizeUS.length / BATCH_SIZE);
    
    console.log(`Processing batch ${batchNum}/${totalBatches}...`);
    
    const batchResults = await Promise.all(batch.map((c: any) => researchCompanySize(c)));
    results.push(...batchResults);
    
    if (i + BATCH_SIZE < missingSizeUS.length) {
      await sleep(DELAY_MS);
    }
  }
  
  // Save results
  fs.writeFileSync(
    '/Users/alicewyatt/repos/agent-playground/data/size-research-results.json',
    JSON.stringify(results, null, 2)
  );
  
  // Count by category
  const midMarket = results.filter(r => r.size_category.includes('Mid Market'));
  const enterprise = results.filter(r => r.size_category.includes('Enterprise'));
  const sme = results.filter(r => r.size_category.includes('SME'));
  const unknown = results.filter(r => r.size_category === 'Unknown');
  
  console.log('\n=== RESULTS ===\n');
  console.log(`Mid Market (1,000-5,000): ${midMarket.length}`);
  console.log(`Enterprise (5,000+): ${enterprise.length}`);
  console.log(`SME (1-1,000): ${sme.length}`);
  console.log(`Unknown: ${unknown.length}`);
  
  // Show Mid Market and Enterprise companies
  const mmOrEnterprise = [...midMarket, ...enterprise];
  
  if (mmOrEnterprise.length > 0) {
    console.log('\n=== MID MARKET / ENTERPRISE COMPANIES ===\n');
    mmOrEnterprise.forEach((r, i) => {
      console.log(`${i+1}. ${r.company_name}`);
      console.log(`   Size: ${r.size_category}`);
      console.log(`   Employees: ${r.employee_count}`);
      console.log(`   Evidence: ${r.evidence}`);
      console.log('');
    });
  }
  
  // Update the master spreadsheet
  console.log('\n=== UPDATING SPREADSHEET ===\n');
  
  let updatedCount = 0;
  let newQualifiedCount = 0;
  
  records.forEach((row: any) => {
    const result = results.find(r => r.company_name === row.company_name);
    if (result && result.size_category !== 'Unknown') {
      row.size_employee_count = result.size_category;
      updatedCount++;
      
      // Check if now qualified
      const isMMOrEnt = result.size_category.includes('Mid Market') || result.size_category.includes('Enterprise');
      const hasUS = hasUSPresence(row);
      const hasOutbound = hasOutboundTags(row);
      
      if (isMMOrEnt && hasUS && hasOutbound) {
        row.qualified = 'Y';
        newQualifiedCount++;
        console.log(`NEW QUALIFIED: ${row.company_name} (${result.size_category})`);
      }
    }
  });
  
  // Write back
  const headers = Object.keys(records[0]);
  const csvOutput = stringify(records, { header: true, columns: headers });
  fs.writeFileSync(csvPath, csvOutput);
  
  // Also update the master list
  fs.writeFileSync('/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv', csvOutput);
  
  console.log(`\nSize updated for: ${updatedCount} companies`);
  console.log(`New qualified accounts: ${newQualifiedCount}`);
  
  // Final qualified count
  const totalQualified = records.filter((r: any) => r.qualified === 'Y').length;
  console.log(`\nTotal qualified accounts now: ${totalQualified}`);
}

main().catch(console.error);
