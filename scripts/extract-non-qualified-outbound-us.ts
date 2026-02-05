import { config } from 'dotenv'
import { parse } from 'csv-parse/sync'
import fs from 'fs'

config()

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
    if (serviceLines.includes(target)) return true
  }
  return false
}

function hasUSPresence(account: Account): boolean {
  const hq = (account.company_hq || '').trim()
  const onshore = (account.onshore_delivery_footprint || '').trim()
  const nearshore = (account.nearshore_delivery_footprint || '').trim()
  const offshore = (account.offshore_delivery_footprint || '').trim()
  
  if (hq === 'United States' || hq === 'US' || hq === 'USA') {
    return true
  }
  
  if (onshore) {
    for (const state of US_STATES) {
      const regex = new RegExp(`\\b${state}\\b`, 'i')
      if (regex.test(onshore)) return true
    }
  }
  
  if (nearshore) {
    if (/\bUnited States\b/i.test(nearshore) || /\bUS\b/.test(nearshore) || /\bUSA\b/i.test(nearshore)) {
      return true
    }
  }
  
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
  
  const nonQualifiedAccounts: Array<{
    company_name: string
    website: string
    company_hq: string
    current_size: string
    service_lines: string
  }> = []
  
  for (const account of records) {
    if (account.qualified !== 'Y' && hasTargetServiceLine(account.service_lines) && hasUSPresence(account)) {
      nonQualifiedAccounts.push({
        company_name: account.company_name,
        website: account.website,
        company_hq: account.company_hq,
        current_size: account.size_employee_count,
        service_lines: account.service_lines
      })
    }
  }
  
  console.log(`\nNon-qualified accounts with target service lines + US presence: ${nonQualifiedAccounts.length}`)
  
  // Group by current size
  const sizeGroups: Record<string, number> = {}
  for (const account of nonQualifiedAccounts) {
    const size = account.current_size || 'Unknown'
    sizeGroups[size] = (sizeGroups[size] || 0) + 1
  }
  
  console.log('\n=== CURRENT SIZE DISTRIBUTION ===')
  for (const [size, count] of Object.entries(sizeGroups).sort((a, b) => b[1] - a[1])) {
    console.log(`${size}: ${count}`)
  }
  
  // Save to JSON
  fs.writeFileSync(
    '/Users/alicewyatt/repos/agent-playground/data/non-qualified-outbound-us-to-enrich.json',
    JSON.stringify(nonQualifiedAccounts, null, 2)
  )
  
  console.log(`\nSaved ${nonQualifiedAccounts.length} accounts to data/non-qualified-outbound-us-to-enrich.json`)
  
  // Print first 50 company names for quick reference
  console.log('\n=== FIRST 50 COMPANIES ===')
  for (let i = 0; i < Math.min(50, nonQualifiedAccounts.length); i++) {
    console.log(`${i + 1}. ${nonQualifiedAccounts[i].company_name} (${nonQualifiedAccounts[i].current_size})`)
  }
}

main().catch(console.error)
