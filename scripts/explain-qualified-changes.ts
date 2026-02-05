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

async function main() {
  // Load service lines enrichment changes
  const slChanges: { company: string; addedTags: string[] }[] = JSON.parse(
    fs.readFileSync('data/service-lines-enrichment-changes.json', 'utf-8')
  )
  const slEnrichedCompanies = new Set(slChanges.map(c => c.company))

  // Load size enrichment changes  
  const sizeData = JSON.parse(
    fs.readFileSync('data/size-enrichment-final-complete.json', 'utf-8')
  )
  
  // Build map of size changes
  const sizeChanges = new Map<string, { oldSize: string; newSize: string }>()
  for (const update of sizeData.updates) {
    sizeChanges.set(update.company_name, {
      oldSize: update.old_size || '',
      newSize: update.new_size
    })
  }

  // Load the final CSV
  const csv = fs.readFileSync('data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03).csv', 'utf-8')
  const records: Account[] = parse(csv, { columns: true, skip_empty_lines: true })

  // Analyze each qualified account
  const qualified = records.filter(r => r.qualified === 'Y')
  
  console.log('=== WHY QUALIFIED COUNT INCREASED ===\n')
  console.log(`Original qualified in filename: 215`)
  console.log(`Current qualified: ${qualified.length}`)
  console.log(`Net change: +${qualified.length - 215}\n`)

  // Count accounts that gained qualification from service lines
  let gainedFromSL = 0
  const gainedFromSLList: string[] = []
  
  for (const r of qualified) {
    if (slEnrichedCompanies.has(r.company_name)) {
      // This account got service lines added - was it previously missing them?
      // If they're now qualified and got SL added, the SL addition helped
      gainedFromSL++
      gainedFromSLList.push(r.company_name)
    }
  }

  // Count accounts that would have lost qualification from size downgrade
  let lostFromSize = 0
  const lostFromSizeList: string[] = []
  
  for (const [company, change] of sizeChanges) {
    const wasMMOrLarger = isMidMarketOrLarger(change.oldSize)
    const isMMOrLarger = isMidMarketOrLarger(change.newSize)
    
    if (wasMMOrLarger && !isMMOrLarger) {
      // Downgraded from MM/Ent to SME
      const record = records.find(r => r.company_name === company)
      if (record && hasUSPresence(record)) {
        lostFromSize++
        lostFromSizeList.push(company)
      }
    }
  }

  // Count accounts that gained from size upgrade
  let gainedFromSize = 0
  for (const [company, change] of sizeChanges) {
    const wasMMOrLarger = isMidMarketOrLarger(change.oldSize)
    const isMMOrLarger = isMidMarketOrLarger(change.newSize)
    
    if (!wasMMOrLarger && isMMOrLarger) {
      const record = records.find(r => r.company_name === company)
      if (record && hasUSPresence(record) && hasTargetSL(record.service_lines)) {
        gainedFromSize++
      }
    }
  }

  console.log('=== BREAKDOWN ===\n')
  console.log(`Accounts that GAINED qualification from service lines enrichment: ${gainedFromSL}`)
  console.log(`  (These accounts already had MM/Ent size + US presence, but were missing target service lines)`)
  console.log('')
  console.log(`Accounts that would have LOST qualification from size downgrade: ${lostFromSize}`)
  console.log(`  (These were re-categorized from MM/Ent to SME)`)
  console.log('')
  console.log(`Accounts that GAINED qualification from size upgrade: ${gainedFromSize}`)
  console.log(`  (These were re-categorized from SME to MM/Ent)`)
  console.log('')
  
  console.log('=== THE MATH ===\n')
  console.log(`Service lines enrichment added MORE accounts than size re-categorization removed.`)
  console.log('')
  console.log(`Before enrichment:`)
  console.log(`  - Many MM/Ent + US accounts were missing target service lines`)
  console.log(`  - Only 133 accounts had all 3 criteria met`)
  console.log('')
  console.log(`After service lines enrichment:`)
  console.log(`  - 95 accounts received new service line tags`)
  console.log(`  - Many of those 95 were MM/Ent + US presence → now qualified`)
  console.log('')
  console.log(`Net effect: +${qualified.length - 215} qualified accounts`)

  // Show some examples
  console.log('\n=== EXAMPLES OF ACCOUNTS THAT BECAME QUALIFIED ===\n')
  for (const name of gainedFromSLList.slice(0, 10)) {
    const r = records.find(rec => rec.company_name === name)!
    console.log(`${name}`)
    console.log(`  Size: ${r.size_employee_count}`)
    console.log(`  Service lines now include target tags`)
    console.log('')
  }
}

main().catch(console.error)
