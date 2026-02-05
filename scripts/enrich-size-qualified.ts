import { config } from 'dotenv'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import fs from 'fs'

config()

// US States list for matching onshore delivery footprint
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia', 'Puerto Rico'
]

// Target service line tags
const TARGET_SERVICE_LINES = [
  'Sales Outsourcing',
  'Outbound Services',
  'B2C Telemarketing',
  'Collections'
]

interface Account {
  company_name: string
  website: string
  company_hq: string
  service_lines: string
  onshore_delivery_footprint: string
  nearshore_delivery_footprint: string
  offshore_delivery_footprint: string
  qualified: string
  size_employee_count: string
  [key: string]: string
}

function hasTargetServiceLine(serviceLines: string): boolean {
  if (!serviceLines) return false
  
  for (const target of TARGET_SERVICE_LINES) {
    if (target === 'B2C Telemarketing') {
      if (serviceLines.includes('B2C Telemarketing')) return true
    } else if (target === 'Collections') {
      if (serviceLines.includes('Collections')) return true
    } else {
      if (serviceLines.includes(target)) return true
    }
  }
  return false
}

function hasUSPresence(account: Account): boolean {
  const hq = (account.company_hq || '').trim()
  const onshore = (account.onshore_delivery_footprint || '').trim()
  const nearshore = (account.nearshore_delivery_footprint || '').trim()
  const offshore = (account.offshore_delivery_footprint || '').trim()
  
  // Check HQ for US
  if (hq === 'United States' || hq === 'US' || hq === 'USA') {
    return true
  }
  
  // Check onshore for US state names
  if (onshore) {
    for (const state of US_STATES) {
      const regex = new RegExp(`\\b${state}\\b`, 'i')
      if (regex.test(onshore)) return true
    }
  }
  
  // Check nearshore for United States
  if (nearshore) {
    if (/\bUnited States\b/i.test(nearshore) || /\bUS\b/.test(nearshore) || /\bUSA\b/i.test(nearshore)) {
      return true
    }
  }
  
  // Check offshore for United States
  if (offshore) {
    if (/\bUnited States\b/i.test(offshore) || /\bUS\b/.test(offshore) || /\bUSA\b/i.test(offshore)) {
      return true
    }
  }
  
  return false
}

async function main() {
  const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List 2026 (2).csv'
  
  console.log('Reading CSV...')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  })
  
  console.log(`Total accounts in CSV: ${records.length}`)
  
  // Filter to qualified accounts with target service lines and US presence
  const qualifiedAccounts: Account[] = []
  
  for (const account of records) {
    if (account.qualified === 'Y' && hasTargetServiceLine(account.service_lines) && hasUSPresence(account)) {
      qualifiedAccounts.push(account)
    }
  }
  
  console.log(`\nQualified accounts with target service lines + US presence: ${qualifiedAccounts.length}`)
  
  // Output as a simple list for enrichment
  console.log('\n=== ACCOUNTS TO ENRICH ===\n')
  
  const outputData: Array<{
    company_name: string
    website: string
    current_size: string
    company_hq: string
  }> = []
  
  for (const account of qualifiedAccounts) {
    outputData.push({
      company_name: account.company_name,
      website: account.website,
      current_size: account.size_employee_count,
      company_hq: account.company_hq
    })
    
    console.log(`${account.company_name}`)
    console.log(`  Website: ${account.website}`)
    console.log(`  Current Size: ${account.size_employee_count}`)
    console.log(`  HQ: ${account.company_hq}`)
    console.log('')
  }
  
  // Save to JSON for processing
  fs.writeFileSync(
    '/Users/alicewyatt/repos/agent-playground/data/qualified-outbound-us-to-enrich.json',
    JSON.stringify(qualifiedAccounts, null, 2)
  )
  
  console.log(`\nSaved ${qualifiedAccounts.length} accounts to data/qualified-outbound-us-to-enrich.json`)
}

main().catch(console.error)
