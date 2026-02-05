import { config } from 'dotenv'
import { parse } from 'csv-parse/sync'
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

function hasTargetServiceLine(serviceLines: string): string[] {
  if (!serviceLines) return []
  
  const matched: string[] = []
  for (const target of TARGET_SERVICE_LINES) {
    // Check for exact match or match with variations (e.g., "B2C Telemarketing & Telesales")
    if (target === 'B2C Telemarketing') {
      if (serviceLines.includes('B2C Telemarketing')) {
        matched.push('B2C Telemarketing')
      }
    } else if (target === 'Collections') {
      if (serviceLines.includes('Collections')) {
        matched.push('Collections')
      }
    } else {
      if (serviceLines.includes(target)) {
        matched.push(target)
      }
    }
  }
  return matched
}

function hasUSPresence(account: Account): { hasPresence: boolean; reasons: string[] } {
  const reasons: string[] = []
  
  const hq = (account.company_hq || '').trim()
  const onshore = (account.onshore_delivery_footprint || '').trim()
  const nearshore = (account.nearshore_delivery_footprint || '').trim()
  const offshore = (account.offshore_delivery_footprint || '').trim()
  
  // Check HQ for US
  if (hq === 'United States' || hq === 'US' || hq === 'USA') {
    reasons.push(`HQ: ${hq}`)
  }
  
  // Check onshore for US state names
  if (onshore) {
    const foundStates: string[] = []
    for (const state of US_STATES) {
      // Match whole word to avoid partial matches
      const regex = new RegExp(`\\b${state}\\b`, 'i')
      if (regex.test(onshore)) {
        foundStates.push(state)
      }
    }
    if (foundStates.length > 0) {
      reasons.push(`Onshore US: ${foundStates.join(', ')}`)
    }
  }
  
  // Check nearshore for United States
  if (nearshore) {
    if (/\bUnited States\b/i.test(nearshore) || /\bUS\b/.test(nearshore) || /\bUSA\b/i.test(nearshore)) {
      reasons.push(`Nearshore: ${nearshore}`)
    }
  }
  
  // Check offshore for United States
  if (offshore) {
    if (/\bUnited States\b/i.test(offshore) || /\bUS\b/.test(offshore) || /\bUSA\b/i.test(offshore)) {
      reasons.push(`Offshore: ${offshore}`)
    }
  }
  
  return { hasPresence: reasons.length > 0, reasons }
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
  
  const matchingAccounts: Array<{
    account: Account
    matchedServiceLines: string[]
    usPresenceReasons: string[]
  }> = []
  
  for (const account of records) {
    const matchedServiceLines = hasTargetServiceLine(account.service_lines)
    const usPresence = hasUSPresence(account)
    
    if (matchedServiceLines.length > 0 && usPresence.hasPresence) {
      matchingAccounts.push({
        account,
        matchedServiceLines,
        usPresenceReasons: usPresence.reasons
      })
    }
  }
  
  console.log(`\n=== MATCHING ACCOUNTS ===`)
  console.log(`Found ${matchingAccounts.length} accounts with target service lines AND US presence\n`)
  
  // Group by qualified status
  const qualified = matchingAccounts.filter(m => m.account.qualified === 'Y')
  const notQualified = matchingAccounts.filter(m => m.account.qualified !== 'Y')
  
  console.log(`Qualified (Y): ${qualified.length}`)
  console.log(`Not Qualified: ${notQualified.length}\n`)
  
  console.log('--- All Matching Accounts ---\n')
  
  for (const match of matchingAccounts) {
    console.log(`Company: ${match.account.company_name}`)
    console.log(`  Website: ${match.account.website}`)
    console.log(`  HQ: ${match.account.company_hq}`)
    console.log(`  Size: ${match.account.size_employee_count}`)
    console.log(`  Qualified: ${match.account.qualified}`)
    console.log(`  Matched Service Lines: ${match.matchedServiceLines.join(', ')}`)
    console.log(`  US Presence: ${match.usPresenceReasons.join(' | ')}`)
    console.log('')
  }
  
  // Summary by service line
  console.log('\n=== SUMMARY BY SERVICE LINE ===')
  for (const serviceLine of TARGET_SERVICE_LINES) {
    const count = matchingAccounts.filter(m => m.matchedServiceLines.includes(serviceLine)).length
    console.log(`${serviceLine}: ${count} accounts`)
  }
}

main().catch(console.error)
