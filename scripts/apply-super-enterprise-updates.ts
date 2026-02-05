import { config } from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

config()

// Super Enterprise companies from size enrichment research
const SUPER_ENTERPRISE_COMPANIES = [
  'Atento',
  'Conduent', 
  'EXL Service',
  'Inspiro',
  'JPMorgan Chase',
  'TaskUs',
  'Teleperformance',
  'TELUS International',
  'The Bosch Group',
  'transcosmos'
]

const SUPER_ENTERPRISE_SIZE = 'Super Enterprise (50,000+ employees)'

interface Account {
  company_name: string
  size_employee_count: string
  [key: string]: string
}

async function main() {
  const csvPath = 'data/Final - Global Contact Center Market Map - Full List with 220 Qualified (2025-02-05).csv'
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })

  console.log(`Loaded ${records.length} accounts`)

  let updated = 0
  for (const record of records) {
    if (SUPER_ENTERPRISE_COMPANIES.includes(record.company_name)) {
      const oldSize = record.size_employee_count
      record.size_employee_count = SUPER_ENTERPRISE_SIZE
      console.log(`${record.company_name}: "${oldSize}" → "${SUPER_ENTERPRISE_SIZE}"`)
      updated++
    }
  }

  console.log(`\nUpdated ${updated} accounts to Super Enterprise`)

  // Write back
  const output = stringify(records, { header: true })
  fs.writeFileSync(csvPath, output)
  console.log(`\nSaved to: ${csvPath}`)

  // Verify size distribution
  const sizeCounts: Record<string, number> = {}
  for (const record of records) {
    const size = record.size_employee_count || '(empty)'
    sizeCounts[size] = (sizeCounts[size] || 0) + 1
  }
  
  console.log('\nUpdated size distribution:')
  for (const [size, count] of Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${size}: ${count}`)
  }
}

main().catch(console.error)
