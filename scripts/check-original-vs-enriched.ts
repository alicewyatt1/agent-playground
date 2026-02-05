import { parse } from 'csv-parse/sync'
import fs from 'fs'

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

function isMidMarketOrLarger(size: string): boolean {
  if (!size) return false
  const s = size.toLowerCase()
  return s.includes('mid market') || s.includes('enterprise') || s.includes('super enterprise')
}

// Count using ORIGINAL sizes in the CSV
const matchingAccounts = records.filter((r: any) => hasServiceLines(r.service_lines) && hasUSPresence(r))

console.log('=== ORIGINAL DATA (before enrichment) ===\n')
console.log('Total accounts with service lines + US presence:', matchingAccounts.length)

const originalMidMarketPlus = matchingAccounts.filter((r: any) => isMidMarketOrLarger(r.size_employee_count))
console.log('Of those, Mid Market or larger (ORIGINAL sizes):', originalMidMarketPlus.length)

// Size distribution of matching accounts
const sizeDist: Record<string, number> = {}
for (const r of matchingAccounts) {
  const size = r.size_employee_count || 'Unknown'
  sizeDist[size] = (sizeDist[size] || 0) + 1
}

console.log('\nOriginal size distribution:')
for (const [size, count] of Object.entries(sizeDist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${size}: ${count}`)
}

// Check all 209 qualified accounts
const allQualified = records.filter((r: any) => r.qualified === 'Y')
console.log('\n=== ALL 209 QUALIFIED ACCOUNTS ===')
console.log('Total Qualified:', allQualified.length)

const qualSizeDist: Record<string, number> = {}
for (const r of allQualified) {
  const size = r.size_employee_count || 'Unknown'
  qualSizeDist[size] = (qualSizeDist[size] || 0) + 1
}

console.log('\nQualified accounts size distribution:')
for (const [size, count] of Object.entries(qualSizeDist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${size}: ${count}`)
}

// How many of the 209 qualified meet ALL 3 criteria with ORIGINAL sizes?
const qualifiedMeetsAll = allQualified.filter((r: any) => 
  hasServiceLines(r.service_lines) && 
  hasUSPresence(r) && 
  isMidMarketOrLarger(r.size_employee_count)
)
console.log('\nQualified accounts meeting ALL criteria (with ORIGINAL sizes):', qualifiedMeetsAll.length)
