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

const TARGET_SERVICE_LINES = [
  'sales outsourcing',
  'outbound services', 
  'b2c telemarketing',
  'collections'
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

interface SizeEnrichmentUpdate {
  company_name: string
  new_size: string
  researched_count?: string
}

interface ServiceLineResearch {
  company_name: string
  tags_to_add: string[]
}

// Size category mapping from enrichment to CSV format
function formatSize(size: string): string {
  const s = size.toLowerCase()
  if (s.includes('super enterprise') || s === 'super enterprise') {
    return 'Super Enterprise (50,000+ employees)'
  }
  if (s.includes('enterprise') || s === 'enterprise') {
    return 'Enterprise (5,000+ employees)'
  }
  if (s.includes('mid market') || s === 'mid market') {
    return 'Mid Market (1,000–5,000 employees)'
  }
  if (s.includes('sme') || s === 'sme') {
    return 'SME (1–1,000 employees)'
  }
  return size // Return as-is if doesn't match
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

function hasTargetServiceLines(sl: string): boolean {
  const s = (sl || '').toLowerCase()
  return TARGET_SERVICE_LINES.some(t => s.includes(t))
}

function isMidMarketOrLarger(size: string): boolean {
  const s = (size || '').toLowerCase()
  return s.includes('mid market') || s.includes('enterprise') || s.includes('super enterprise')
}

function isQualified(r: Account): boolean {
  return isMidMarketOrLarger(r.size_employee_count) && hasUSPresence(r) && hasTargetServiceLines(r.service_lines)
}

async function main() {
  console.log('=== RECONCILING ALL ENRICHMENTS ===\n')

  // 1. Load the original CSV (the one with 215 qualified before any of our changes)
  // We'll use the current file and rebuild from enrichment data
  const csvPath = 'data/Final - Global Contact Center Market Map - Full List with 220 Qualified (2025-02-05).csv'
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })
  console.log(`Loaded ${records.length} accounts from CSV`)

  // 2. Load SIZE enrichment data
  const sizeEnrichment1 = JSON.parse(fs.readFileSync('data/size-enrichment-final-complete.json', 'utf-8'))
  const sizeEnrichment2 = JSON.parse(fs.readFileSync('data/non-qualified-enrichment-results.json', 'utf-8'))
  
  // Build size update map
  const sizeUpdates = new Map<string, string>()
  
  // From qualified enrichment
  for (const update of sizeEnrichment1.updates || []) {
    if (update.company_name && update.new_size) {
      sizeUpdates.set(update.company_name, formatSize(update.new_size))
    }
  }
  
  // From non-qualified enrichment (category_changes)
  for (const change of sizeEnrichment2.category_changes || []) {
    if (change.company_name && change.new_size) {
      sizeUpdates.set(change.company_name, formatSize(change.new_size))
    }
  }
  
  console.log(`Loaded ${sizeUpdates.size} size updates from enrichment files`)

  // 3. Load SERVICE LINES enrichment data
  const slEnrichment1: ServiceLineResearch[] = JSON.parse(fs.readFileSync('data/research-results.json', 'utf-8'))
  const slEnrichment2: ServiceLineResearch[] = JSON.parse(fs.readFileSync('data/research-remaining-results.json', 'utf-8'))
  
  // Build service lines update map
  const slUpdates = new Map<string, string[]>()
  
  for (const result of [...slEnrichment1, ...slEnrichment2]) {
    if (result.company_name && result.tags_to_add && result.tags_to_add.length > 0) {
      const existing = slUpdates.get(result.company_name) || []
      const merged = [...new Set([...existing, ...result.tags_to_add])]
      slUpdates.set(result.company_name, merged)
    }
  }
  
  console.log(`Loaded ${slUpdates.size} service line updates from enrichment files`)

  // 4. Apply all updates to records
  let sizeChangesApplied = 0
  let slChangesApplied = 0
  
  for (const record of records) {
    // Apply size update
    const newSize = sizeUpdates.get(record.company_name)
    if (newSize && record.size_employee_count !== newSize) {
      record.size_employee_count = newSize
      sizeChangesApplied++
    }
    
    // Apply service lines update
    const tagsToAdd = slUpdates.get(record.company_name)
    if (tagsToAdd && tagsToAdd.length > 0) {
      const existingTags = (record.service_lines || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
      
      // Find tags that are actually new
      const newTags = tagsToAdd.filter(tag => 
        !existingTags.some(existing => 
          existing.toLowerCase() === tag.toLowerCase()
        )
      )
      
      if (newTags.length > 0) {
        record.service_lines = [...existingTags, ...newTags].join(', ')
        slChangesApplied++
      }
    }
  }

  console.log(`\nApplied ${sizeChangesApplied} size changes`)
  console.log(`Applied ${slChangesApplied} service line changes`)

  // 5. Recalculate qualified column
  let qualifiedCount = 0
  for (const record of records) {
    record.qualified = isQualified(record) ? 'Y' : 'N'
    if (record.qualified === 'Y') qualifiedCount++
  }

  console.log(`\nRecalculated qualified column: ${qualifiedCount} accounts qualified`)

  // 6. Generate size distribution
  const sizeDist: Record<string, number> = {}
  for (const record of records) {
    const size = record.size_employee_count || '(empty)'
    sizeDist[size] = (sizeDist[size] || 0) + 1
  }

  console.log('\nSize distribution:')
  for (const [size, count] of Object.entries(sizeDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${size}: ${count}`)
  }

  // 7. Write final CSV
  const outputPath = `data/Final - Global Contact Center Market Map - Full List with ${qualifiedCount} Qualified (2025-02-05).csv`
  const output = stringify(records, { header: true })
  fs.writeFileSync(outputPath, output)
  
  console.log(`\n✅ Saved final CSV to: ${outputPath}`)

  // 8. Cleanup - remove old file if name changed
  if (outputPath !== csvPath) {
    fs.unlinkSync(csvPath)
    console.log(`Removed old file: ${csvPath}`)
  }
}

main().catch(console.error)
