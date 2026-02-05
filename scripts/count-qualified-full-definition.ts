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

const TARGET_SL = ['sales outsourcing', 'outbound services', 'b2c telemarketing', 'collections']

interface Account {
  company_name: string
  company_hq: string
  onshore_delivery_footprint: string
  nearshore_delivery_footprint: string
  offshore_delivery_footprint: string
  service_lines: string
  size_employee_count: string
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

function getSize(size: string): string | null {
  const s = (size || '').toLowerCase()
  if (s.includes('super enterprise')) return 'Super Enterprise'
  if (s.includes('enterprise')) return 'Enterprise'
  if (s.includes('mid market')) return 'Mid Market'
  return null
}

async function main() {
  const csv = fs.readFileSync('data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03) - SERVICE-LINES-ENRICHED.csv', 'utf-8')
  const records: Account[] = parse(csv, { columns: true, skip_empty_lines: true })

  const qualified = records.filter(r => {
    const size = getSize(r.size_employee_count)
    return size && hasUSPresence(r) && hasTargetSL(r.service_lines)
  })

  const bySize: Record<string, number> = { 'Mid Market': 0, 'Enterprise': 0, 'Super Enterprise': 0 }
  qualified.forEach(r => {
    const size = getSize(r.size_employee_count)
    if (size) bySize[size]++
  })

  console.log('=== QUALIFIED ACCOUNTS (Full Definition) ===')
  console.log('Criteria: MM/Ent/Super Ent + US Presence + Target Service Lines\n')
  console.log(`TOTAL: ${qualified.length}\n`)
  console.log('By Size:')
  console.log(`  Mid Market:       ${bySize['Mid Market']}`)
  console.log(`  Enterprise:       ${bySize['Enterprise']}`)
  console.log(`  Super Enterprise: ${bySize['Super Enterprise']}`)
}

main().catch(console.error)
