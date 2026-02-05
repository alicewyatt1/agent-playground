import { config } from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

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

const TARGET_SL = ['sales outsourcing', 'outbound services', 'b2c telemarketing', 'collections']

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

function hasUSPresence(r: Account): boolean {
  const hq = (r.company_hq || '').toLowerCase()
  const onshore = (r.onshore_delivery_footprint || '').toLowerCase()
  const nearshore = (r.nearshore_delivery_footprint || '').toLowerCase()
  const offshore = (r.offshore_delivery_footprint || '').toLowerCase()
  
  if (hq.includes('united states') || hq === 'us' || hq === 'usa') return true
  for (const state of US_STATES) {
    if (onshore.includes(state.toLowerCase())) return true
  }
  if (nearshore.includes('united states') || offshore.includes('united states')) return true
  return false
}

function hasTargetSL(sl: string): boolean {
  const s = (sl || '').toLowerCase()
  return TARGET_SL.some(t => s.includes(t))
}

function isMidMarketOrLarger(size: string): boolean {
  const s = (size || '').toLowerCase()
  return s.includes('mid market') || s.includes('enterprise') || s.includes('super enterprise')
}

function isQualified(r: Account): boolean {
  return isMidMarketOrLarger(r.size_employee_count) && hasUSPresence(r) && hasTargetSL(r.service_lines)
}

async function main() {
  // Load the service-lines-enriched CSV
  const inputPath = 'data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03) - SERVICE-LINES-ENRICHED.csv'
  const csvContent = fs.readFileSync(inputPath, 'utf-8')
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })

  console.log(`Loaded ${records.length} accounts`)

  // Track changes
  let qualifiedCount = 0
  let changedToY = 0
  let changedToN = 0
  let unchanged = 0

  // Update qualified column
  for (const record of records) {
    const oldValue = record.qualified || ''
    const newValue = isQualified(record) ? 'Y' : 'N'
    
    record.qualified = newValue
    
    if (newValue === 'Y') qualifiedCount++
    
    if (oldValue.toUpperCase() !== newValue) {
      if (newValue === 'Y') changedToY++
      else changedToN++
    } else {
      unchanged++
    }
  }

  console.log(`\n=== Qualified Column Updated ===`)
  console.log(`Total qualified (Y): ${qualifiedCount}`)
  console.log(`Total not qualified (N): ${records.length - qualifiedCount}`)
  console.log(`\nChanges:`)
  console.log(`  Changed to Y: ${changedToY}`)
  console.log(`  Changed to N: ${changedToN}`)
  console.log(`  Unchanged: ${unchanged}`)

  // Write output - overwrite the original Feb 3 file
  const outputPath = 'data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03).csv'
  const output = stringify(records, { header: true })
  fs.writeFileSync(outputPath, output)
  console.log(`\nWrote updated CSV to: ${outputPath}`)
}

main().catch(console.error)
