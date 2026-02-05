import { config } from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface Company {
  company_name: string;
  website: string;
  notes: string;
  current_service_lines: string;
}

interface ResearchResult {
  company_name: string;
  website: string;
  offers_outbound: boolean;
  tags_to_add: string[];
  reasoning: string;
}

async function researchCompany(company: Company): Promise<ResearchResult> {
  const prompt = `Research if "${company.company_name}" (${company.website}) offers any of these specific services:

1. Sales Outsourcing - outsourced sales teams, B2B/B2C sales
2. Outbound Services - outbound calling, proactive customer contact
3. B2C Telemarketing & Telesales - telemarketing campaigns, telesales
4. Collections Recovery Services - debt collection, accounts receivable recovery

Based on their website and public information, which of these 4 services do they offer?

Respond in this exact JSON format:
{
  "offers_outbound": true/false,
  "tags": ["list", "of", "applicable", "tags"],
  "reasoning": "brief explanation"
}

Only include tags from: "Sales Outsourcing", "Outbound Services", "B2C Telemarketing & Telesales", "Collections Recovery Services"`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        company_name: company.company_name,
        website: company.website,
        offers_outbound: parsed.offers_outbound || false,
        tags_to_add: parsed.tags || [],
        reasoning: parsed.reasoning || '',
      };
    }
    
    return {
      company_name: company.company_name,
      website: company.website,
      offers_outbound: false,
      tags_to_add: [],
      reasoning: 'Could not parse response',
    };
  } catch (error) {
    console.error(`Error researching ${company.company_name}:`, error);
    return {
      company_name: company.company_name,
      website: company.website,
      offers_outbound: false,
      tags_to_add: [],
      reasoning: `Error: ${error}`,
    };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Load companies to research
  const companiesJson = fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/companies-to-research.json', 'utf-8');
  const companies: Company[] = JSON.parse(companiesJson);
  
  console.log(`\n=== RESEARCHING ${companies.length} COMPANIES FOR OUTBOUND SERVICES ===\n`);
  
  const results: ResearchResult[] = [];
  const BATCH_SIZE = 5;
  const DELAY_MS = 1000; // 1 second between batches to respect rate limits
  
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(companies.length / BATCH_SIZE);
    
    console.log(`Processing batch ${batchNum}/${totalBatches} (companies ${i + 1}-${Math.min(i + BATCH_SIZE, companies.length)})...`);
    
    // Process batch in parallel
    const batchResults = await Promise.all(batch.map(c => researchCompany(c)));
    results.push(...batchResults);
    
    // Log progress
    const outboundCount = results.filter(r => r.offers_outbound).length;
    console.log(`  Found ${outboundCount} companies with outbound services so far`);
    
    // Save intermediate results
    fs.writeFileSync(
      '/Users/alicewyatt/repos/agent-playground/data/research-results.json',
      JSON.stringify(results, null, 2)
    );
    
    // Delay between batches
    if (i + BATCH_SIZE < companies.length) {
      await sleep(DELAY_MS);
    }
  }
  
  // Summary
  console.log('\n=== RESEARCH COMPLETE ===\n');
  
  const withOutbound = results.filter(r => r.offers_outbound);
  console.log(`Total companies researched: ${results.length}`);
  console.log(`Companies offering outbound services: ${withOutbound.length}`);
  
  // Tag breakdown
  const tagCounts: Record<string, number> = {};
  withOutbound.forEach(r => {
    r.tags_to_add.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  console.log('\nTag breakdown:');
  Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count}`);
  });
  
  // List companies with outbound
  console.log('\nCompanies with outbound services:');
  withOutbound.forEach((r, i) => {
    console.log(`${i + 1}. ${r.company_name} - ${r.tags_to_add.join(', ')}`);
  });
  
  // Now update the master spreadsheet
  console.log('\n=== UPDATING MASTER SPREADSHEET ===\n');
  
  const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });
  
  let updatedCount = 0;
  
  records.forEach((row: any) => {
    const result = withOutbound.find(r => r.company_name === row.company_name);
    if (result && result.tags_to_add.length > 0) {
      const currentLines = row.service_lines || '';
      const newTags = result.tags_to_add.filter(tag => 
        !currentLines.toLowerCase().includes(tag.toLowerCase())
      );
      
      if (newTags.length > 0) {
        row.service_lines = currentLines ? `${currentLines}, ${newTags.join(', ')}` : newTags.join(', ');
        console.log(`Updated: ${row.company_name} + ${newTags.join(', ')}`);
        updatedCount++;
      }
    }
  });
  
  // Write back
  const headers = Object.keys(records[0]);
  const csvOutput = stringify(records, { header: true, columns: headers });
  fs.writeFileSync(csvPath, csvOutput);
  
  console.log(`\nTotal records updated: ${updatedCount}`);
  console.log('Master spreadsheet saved!');
}

main().catch(console.error);
