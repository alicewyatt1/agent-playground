import { parse } from 'csv-parse/sync'
import fs from 'fs'

// Load the enrichment data
const qualifiedEnrichment = JSON.parse(fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/size-enrichment-final-complete.json', 'utf-8'))
const nonQualifiedEnrichment = JSON.parse(fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/non-qualified-enrichment-results.json', 'utf-8'))

// Build a map of company name to new size
const sizeMap = new Map<string, string>()

// From qualified enrichment
for (const update of qualifiedEnrichment.updates) {
  sizeMap.set(update.company_name, update.new_size)
}

// From non-qualified: category changes
for (const change of nonQualifiedEnrichment.category_changes) {
  sizeMap.set(change.company_name, change.new_size)
}

// From non-qualified: mid_market_confirmed
for (const item of nonQualifiedEnrichment.mid_market_confirmed) {
  sizeMap.set(item.company_name, item.new_size)
}

// Load original CSV
const csv = fs.readFileSync('/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List 2026 (2).csv', 'utf-8')
const records = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true })

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia','Puerto Rico']

const SERVICE_LINES = ['Sales Outsourcing','Outbound Services','B2C Telemarketing','Collections']

function hasServiceLines(sl: string) {
  if (!sl) return false
  return SERVICE_LINES.some(s => sl.includes(s))
}

function hasUSPresence(r: any) {
  const hq = (r.company_hq || '').trim()
  const onshore = r.onshore_delivery_footprint || ''
  const nearshore = r.nearshore_delivery_footprint || ''
  const offshore = r.offshore_delivery_footprint || ''
  
  if (hq === 'United States' || hq === 'US' || hq === 'USA') return true
  if (US_STATES.some(s => new RegExp('\\b'+s+'\\b','i').test(onshore))) return true
  if (/\bUnited States\b/i.test(nearshore) || /\bUS\b/.test(nearshore) || /\bUSA\b/i.test(nearshore)) return true
  if (/\bUnited States\b/i.test(offshore) || /\bUS\b/.test(offshore) || /\bUSA\b/i.test(offshore)) return true
  return false
}

function getEnrichedSize(companyName: string, originalSize: string): string {
  return sizeMap.get(companyName) || originalSize
}

function isMidMarketOrLarger(size: string): boolean {
  if (!size) return false
  const s = size.toLowerCase()
  return s.includes('mid market') || s.includes('enterprise') || s.includes('super enterprise')
}

// Find all accounts matching qualification criteria
const matchingAccounts: any[] = []
const originalQualified: any[] = []
const shouldBeQualified: any[] = []

for (const r of records) {
  const hasRequiredServiceLines = hasServiceLines(r.service_lines)
  const hasRequiredUSPresence = hasUSPresence(r)
  
  if (hasRequiredServiceLines && hasRequiredUSPresence) {
    matchingAccounts.push(r)
    
    const enrichedSize = getEnrichedSize(r.company_name, r.size_employee_count)
    const meetsSize = isMidMarketOrLarger(enrichedSize)
    
    if (r.qualified === 'Y') {
      originalQualified.push(r)
    }
    
    if (meetsSize) {
      shouldBeQualified.push({
        name: r.company_name,
        originalSize: r.size_employee_count,
        enrichedSize: enrichedSize,
        wasQualified: r.qualified === 'Y'
      })
    }
  }
}

console.log('=== QUALIFICATION CRITERIA CHECK ===\n')
console.log('Criteria:')
console.log('1. Service lines: Sales Outsourcing, Outbound, B2C Telemarketing, Collections')
console.log('2. US presence')
console.log('3. Mid Market or Enterprise (or Super Enterprise)\n')

console.log('=== RESULTS ===\n')
console.log('Accounts with service lines + US presence:', matchingAccounts.length)
console.log('Currently marked Qualified (Y):', originalQualified.length)
console.log('')
console.log('SHOULD be Qualified (after enrichment):', shouldBeQualified.length)
console.log('')

// Breakdown
const alreadyQualified = shouldBeQualified.filter(a => a.wasQualified)
const shouldAddToQualified = shouldBeQualified.filter(a => !a.wasQualified)

console.log('--- Breakdown ---')
console.log('Already Qualified AND meets size criteria:', alreadyQualified.length)
console.log('NOT Qualified but SHOULD BE (meets all criteria):', shouldAddToQualified.length)

if (shouldAddToQualified.length > 0) {
  console.log('\nAccounts to ADD to Qualified list:')
  for (const a of shouldAddToQualified) {
    console.log(`  - ${a.name} (${a.enrichedSize})`)
  }
}

// Also check: currently Qualified but should NOT be (doesn't meet size criteria after enrichment)
const qualifiedButShouldnt = originalQualified.filter(r => {
  const enrichedSize = getEnrichedSize(r.company_name, r.size_employee_count)
  return !isMidMarketOrLarger(enrichedSize)
})

console.log('\nCurrently Qualified but should NOT be (now SME):', qualifiedButShouldnt.length)
