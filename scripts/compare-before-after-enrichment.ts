import { config } from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'

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
  'B2C Telemarketing & Telesales',
  'Collections',
  'Collections Recovery Services'
]

interface Account {
  company_name: string
  company_hq: string
  onshore_delivery_footprint: string
  nearshore_delivery_footprint: string
  offshore_delivery_footprint: string
  service_lines: string
  size_employee_count: string
  qualified: string
  [key: string]: string
}

function hasUSPresence(account: Account): boolean {
  const hq = (account.company_hq || '').toLowerCase()
  const onshore = (account.onshore_delivery_footprint || '')
  const nearshore = (account.nearshore_delivery_footprint || '').toLowerCase()
  const offshore = (account.offshore_delivery_footprint || '').toLowerCase()

  if (hq.includes('united states') || hq === 'us' || hq === 'usa') return true

  for (const state of US_STATES) {
    if (onshore.toLowerCase().includes(state.toLowerCase())) return true
  }

  if (nearshore.includes('united states') || nearshore === 'us' || nearshore.includes('usa')) return true
  if (offshore.includes('united states') || offshore === 'us' || offshore.includes('usa')) return true

  return false
}

function hasTargetServiceLines(serviceLines: string): boolean {
  const sl = (serviceLines || '').toLowerCase()
  for (const target of TARGET_SERVICE_LINES) {
    if (sl.includes(target.toLowerCase())) return true
  }
  return false
}

function isMidMarketOrLarger(size: string): boolean {
  const s = (size || '').toLowerCase()
  return s.includes('mid market') || s.includes('enterprise') || s.includes('super enterprise')
}

async function analyzeFile(label: string, csvPath: string) {
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })

  console.log(`\n=== ${label} ===`)
  console.log(`File: ${csvPath}`)
  console.log(`Total accounts: ${records.length}`)

  const mmEnterpriseUS = records.filter(r => 
    isMidMarketOrLarger(r.size_employee_count) && hasUSPresence(r)
  )
  console.log(`Mid Market/Enterprise + US Presence: ${mmEnterpriseUS.length}`)

  const withSL = mmEnterpriseUS.filter(r => hasTargetServiceLines(r.service_lines))
  const withoutSL = mmEnterpriseUS.filter(r => !hasTargetServiceLines(r.service_lines))
  
  console.log(`  ✅ With target service lines: ${withSL.length}`)
  console.log(`  ❌ WITHOUT target service lines: ${withoutSL.length}`)

  const qualified = records.filter(r => r.qualified?.toLowerCase() === 'y' || r.qualified?.toLowerCase() === 'yes')
  const qualifiedWithSL = qualified.filter(r => hasTargetServiceLines(r.service_lines))
  const qualifiedWithoutSL = qualified.filter(r => !hasTargetServiceLines(r.service_lines))
  
  console.log(`\nQualified accounts (qualified='Y'): ${qualified.length}`)
  console.log(`  ✅ With target service lines: ${qualifiedWithSL.length}`)
  console.log(`  ❌ WITHOUT target service lines: ${qualifiedWithoutSL.length}`)

  return { withoutSL, qualifiedWithoutSL }
}

async function main() {
  // Before enrichment
  const before = await analyzeFile(
    'BEFORE Service Lines Enrichment',
    'data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03).csv'
  )

  // After enrichment
  const after = await analyzeFile(
    'AFTER Service Lines Enrichment',
    'data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03) - SERVICE-LINES-ENRICHED.csv'
  )

  console.log('\n=== COMPARISON ===')
  console.log(`Accounts fixed by enrichment: ${before.withoutSL.length - after.withoutSL.length}`)
  console.log(`Qualified accounts fixed by enrichment: ${before.qualifiedWithoutSL.length - after.qualifiedWithoutSL.length}`)
}

main().catch(console.error)
