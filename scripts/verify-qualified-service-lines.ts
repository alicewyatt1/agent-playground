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

  // Check HQ for US
  if (hq.includes('united states') || hq === 'us' || hq === 'usa') return true

  // Check onshore for US states
  for (const state of US_STATES) {
    if (onshore.toLowerCase().includes(state.toLowerCase())) return true
  }

  // Check nearshore/offshore for United States
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

async function main() {
  // Load the enriched CSV
  const csvPath = 'data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03) - SERVICE-LINES-ENRICHED.csv'
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })

  console.log(`Loaded ${records.length} total accounts\n`)

  // Filter to Mid Market or larger + US presence
  const mmEnterpriseUSAccounts = records.filter(r => 
    isMidMarketOrLarger(r.size_employee_count) && hasUSPresence(r)
  )

  console.log(`Mid Market/Enterprise/Super Enterprise + US Presence: ${mmEnterpriseUSAccounts.length} accounts\n`)

  // Split by whether they have target service lines
  const withTargetServiceLines = mmEnterpriseUSAccounts.filter(r => hasTargetServiceLines(r.service_lines))
  const withoutTargetServiceLines = mmEnterpriseUSAccounts.filter(r => !hasTargetServiceLines(r.service_lines))

  console.log(`✅ With target service lines: ${withTargetServiceLines.length} accounts`)
  console.log(`❌ WITHOUT target service lines: ${withoutTargetServiceLines.length} accounts`)

  // Cross-reference with qualified column
  const qualifiedAccounts = records.filter(r => r.qualified?.toLowerCase() === 'y' || r.qualified?.toLowerCase() === 'yes')
  console.log(`\nAccounts marked as qualified='Y' in CSV: ${qualifiedAccounts.length}`)

  // Show accounts that are qualified but missing service lines
  const qualifiedWithoutSL = qualifiedAccounts.filter(r => !hasTargetServiceLines(r.service_lines))
  console.log(`Qualified accounts WITHOUT target service lines: ${qualifiedWithoutSL.length}`)

  console.log('\n=== Accounts missing target service lines ===')
  console.log('(Mid Market/Enterprise + US Presence, but no target service lines)\n')
  
  for (const account of withoutTargetServiceLines.slice(0, 50)) {
    console.log(`${account.company_name}`)
    console.log(`  Size: ${account.size_employee_count}`)
    console.log(`  Current service_lines: ${account.service_lines || '(empty)'}`)
    console.log('')
  }

  if (withoutTargetServiceLines.length > 50) {
    console.log(`... and ${withoutTargetServiceLines.length - 50} more accounts`)
  }

  // Save the list of accounts missing target service lines
  fs.writeFileSync(
    'data/accounts-missing-target-service-lines.json',
    JSON.stringify(withoutTargetServiceLines.map(a => ({
      company_name: a.company_name,
      size: a.size_employee_count,
      current_service_lines: a.service_lines,
      qualified: a.qualified,
      hq: a.company_hq,
      onshore: a.onshore_delivery_footprint
    })), null, 2)
  )
  console.log(`\nSaved full list to: data/accounts-missing-target-service-lines.json`)
}

main().catch(console.error)
