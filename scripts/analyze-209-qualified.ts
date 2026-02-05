import { parse } from 'csv-parse/sync'
import fs from 'fs'

const csv = fs.readFileSync('/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List 2026 (2).csv', 'utf-8')
const records = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true })

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia','Puerto Rico']
const TARGET_SERVICE_LINES = ['Sales Outsourcing','Outbound Services','B2C Telemarketing','Collections']

function hasTargetServiceLines(sl: string): string[] {
  if (!sl) return []
  return TARGET_SERVICE_LINES.filter(s => sl.includes(s))
}

function hasUSPresence(r: any): { has: boolean, reasons: string[] } {
  const reasons: string[] = []
  const hq = (r.company_hq || '').trim()
  const onshore = r.onshore_delivery_footprint || ''
  const nearshore = r.nearshore_delivery_footprint || ''
  const offshore = r.offshore_delivery_footprint || ''
  
  if (hq === 'United States' || hq === 'US' || hq === 'USA') {
    reasons.push('US HQ')
  }
  
  const foundStates = US_STATES.filter(s => new RegExp('\\b'+s+'\\b','i').test(onshore))
  if (foundStates.length > 0) {
    reasons.push(`Onshore: ${foundStates.slice(0,3).join(', ')}${foundStates.length > 3 ? '...' : ''}`)
  }
  
  if (/\bUnited States\b/i.test(nearshore) || /\bUS\b/.test(nearshore) || /\bUSA\b/i.test(nearshore)) {
    reasons.push('Nearshore: US')
  }
  
  if (/\bUnited States\b/i.test(offshore) || /\bUS\b/.test(offshore) || /\bUSA\b/i.test(offshore)) {
    reasons.push('Offshore: US')
  }
  
  return { has: reasons.length > 0, reasons }
}

function isMidMarketOrLarger(size: string): boolean {
  if (!size) return false
  const s = size.toLowerCase()
  return s.includes('mid market') || s.includes('enterprise')
}

// Get all 209 qualified accounts
const qualified = records.filter((r: any) => r.qualified === 'Y')

console.log('=== ANALYSIS OF 209 QUALIFIED ACCOUNTS ===\n')

// Categorize each account
const meetsAll: any[] = []
const missingServiceLines: any[] = []
const missingUSPresence: any[] = []
const missingBoth: any[] = []

for (const r of qualified) {
  const serviceLines = hasTargetServiceLines(r.service_lines)
  const usPresence = hasUSPresence(r)
  const hasSize = isMidMarketOrLarger(r.size_employee_count)
  
  const hasServiceLines = serviceLines.length > 0
  const hasUS = usPresence.has
  
  if (hasServiceLines && hasUS) {
    meetsAll.push(r)
  } else if (!hasServiceLines && hasUS) {
    missingServiceLines.push({
      name: r.company_name,
      size: r.size_employee_count,
      actualServiceLines: r.service_lines,
      usPresence: usPresence.reasons.join(', ')
    })
  } else if (hasServiceLines && !hasUS) {
    missingUSPresence.push({
      name: r.company_name,
      size: r.size_employee_count,
      serviceLines: serviceLines.join(', '),
      hq: r.company_hq,
      onshore: r.onshore_delivery_footprint,
      nearshore: r.nearshore_delivery_footprint,
      offshore: r.offshore_delivery_footprint
    })
  } else {
    missingBoth.push({
      name: r.company_name,
      size: r.size_employee_count,
      actualServiceLines: r.service_lines,
      hq: r.company_hq
    })
  }
}

console.log('BREAKDOWN OF 209 QUALIFIED:\n')
console.log(`✅ Meets ALL criteria (service lines + US presence): ${meetsAll.length}`)
console.log(`❌ Missing TARGET service lines (but has US presence): ${missingServiceLines.length}`)
console.log(`❌ Missing US presence (but has target service lines): ${missingUSPresence.length}`)
console.log(`❌ Missing BOTH: ${missingBoth.length}`)
console.log(`   Total: ${meetsAll.length + missingServiceLines.length + missingUSPresence.length + missingBoth.length}`)

console.log('\n' + '='.repeat(60))
console.log('ACCOUNTS MISSING TARGET SERVICE LINES (' + missingServiceLines.length + ')')
console.log('='.repeat(60))
console.log('\nThese accounts have US presence but do NOT have:')
console.log('Sales Outsourcing, Outbound Services, B2C Telemarketing, or Collections\n')

// Group by what service lines they DO have
const serviceLineCount: Record<string, number> = {}
for (const a of missingServiceLines) {
  const lines = (a.actualServiceLines || '').split(',').map((s: string) => s.trim()).filter((s: string) => s)
  for (const line of lines) {
    serviceLineCount[line] = (serviceLineCount[line] || 0) + 1
  }
}

console.log('Service lines these accounts DO have:')
for (const [line, count] of Object.entries(serviceLineCount).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${line}: ${count}`)
}

console.log('\nSample accounts (first 10):')
for (const a of missingServiceLines.slice(0, 10)) {
  console.log(`  - ${a.name}`)
  console.log(`    Size: ${a.size}`)
  console.log(`    Service Lines: ${a.actualServiceLines?.substring(0, 80)}...`)
  console.log(`    US Presence: ${a.usPresence}`)
  console.log('')
}

console.log('\n' + '='.repeat(60))
console.log('ACCOUNTS MISSING US PRESENCE (' + missingUSPresence.length + ')')
console.log('='.repeat(60))

for (const a of missingUSPresence) {
  console.log(`  - ${a.name}`)
  console.log(`    Size: ${a.size}`)
  console.log(`    Target Service Lines: ${a.serviceLines}`)
  console.log(`    HQ: ${a.hq}`)
  console.log(`    Onshore: ${a.onshore || 'N/A'}`)
  console.log(`    Nearshore: ${a.nearshore || 'N/A'}`)
  console.log(`    Offshore: ${a.offshore || 'N/A'}`)
  console.log('')
}

if (missingBoth.length > 0) {
  console.log('\n' + '='.repeat(60))
  console.log('ACCOUNTS MISSING BOTH (' + missingBoth.length + ')')
  console.log('='.repeat(60))
  
  for (const a of missingBoth) {
    console.log(`  - ${a.name}`)
    console.log(`    Size: ${a.size}`)
    console.log(`    HQ: ${a.hq}`)
    console.log(`    Service Lines: ${a.actualServiceLines?.substring(0, 80)}...`)
    console.log('')
  }
}

console.log('\n' + '='.repeat(60))
console.log('SUMMARY')
console.log('='.repeat(60))
console.log(`
The 209 qualified accounts appear to have been selected based on:
- Size: Mid Market or Enterprise (all 209 meet this)
- BUT with broader service line criteria (not just outbound/sales/collections)
- AND some without strict US presence requirement

Gap from 209 → 131:
- ${missingServiceLines.length} accounts don't have the TARGET service lines
- ${missingUSPresence.length} accounts don't have US presence
- ${missingBoth.length} accounts missing both
`)
