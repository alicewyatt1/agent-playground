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

function hasUSHQ(hq: string): boolean {
  if (!hq) return false
  const normalized = hq.trim().toLowerCase()
  return normalized === 'united states' || normalized === 'us' || normalized === 'usa'
}

function hasUSDeliveryFootprint(footprint: string): boolean {
  if (!footprint) return false
  // Check if any US state name appears in the footprint
  const normalizedFootprint = footprint.toLowerCase()
  return US_STATES.some(state => normalizedFootprint.includes(state.toLowerCase()))
}

function hasTargetServiceLine(serviceLines: string): boolean {
  if (!serviceLines) return false
  const normalized = serviceLines.toLowerCase()
  return TARGET_SERVICE_LINES.some(target => normalized.includes(target.toLowerCase()))
}

async function main() {
  const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List 2026 (2).csv'
  const content = fs.readFileSync(csvPath, 'utf-8')
  
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  })

  console.log(`Total records: ${records.length}`)
  
  // Filter accounts matching criteria
  const matchingAccounts = records.filter((row: any) => {
    const hasServiceLine = hasTargetServiceLine(row.service_lines)
    const hasUSPresence = hasUSHQ(row.company_hq) || hasUSDeliveryFootprint(row.onshore_delivery_footprint)
    return hasServiceLine && hasUSPresence
  })

  console.log(`\nAccounts matching criteria: ${matchingAccounts.length}`)
  console.log(`\n--- Breakdown by Service Line ---`)
  
  // Count by service line
  const serviceLineCounts: Record<string, number> = {}
  for (const target of TARGET_SERVICE_LINES) {
    const count = matchingAccounts.filter((row: any) => 
      row.service_lines?.toLowerCase().includes(target.toLowerCase())
    ).length
    serviceLineCounts[target] = count
    console.log(`${target}: ${count}`)
  }

  console.log(`\n--- Breakdown by US Presence Type ---`)
  const usHQCount = matchingAccounts.filter((row: any) => hasUSHQ(row.company_hq)).length
  const usDeliveryCount = matchingAccounts.filter((row: any) => hasUSDeliveryFootprint(row.onshore_delivery_footprint)).length
  const bothCount = matchingAccounts.filter((row: any) => hasUSHQ(row.company_hq) && hasUSDeliveryFootprint(row.onshore_delivery_footprint)).length
  
  console.log(`US HQ: ${usHQCount}`)
  console.log(`US Delivery Footprint: ${usDeliveryCount}`)
  console.log(`Both: ${bothCount}`)

  console.log(`\n--- Sample of Matching Accounts (first 20) ---`)
  for (const row of matchingAccounts.slice(0, 20)) {
    console.log(`\n${row.company_name}`)
    console.log(`  HQ: ${row.company_hq}`)
    console.log(`  Onshore Delivery: ${row.onshore_delivery_footprint}`)
    console.log(`  Service Lines: ${row.service_lines?.substring(0, 100)}...`)
  }
}

main().catch(console.error)
