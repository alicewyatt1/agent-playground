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

const qualified = records.filter((r: any) => r.qualified === 'Y')
const withServiceLines = qualified.filter((r: any) => hasServiceLines(r.service_lines))
const withUSPresence = qualified.filter((r: any) => hasUSPresence(r))
const withBoth = qualified.filter((r: any) => hasServiceLines(r.service_lines) && hasUSPresence(r))

console.log('=== BREAKDOWN OF 209 QUALIFIED ACCOUNTS ===\n')
console.log('Total Qualified:', qualified.length)
console.log('With target service lines:', withServiceLines.length)
console.log('With US presence:', withUSPresence.length)
console.log('With BOTH (my filter):', withBoth.length)
console.log('')
console.log('--- GAP ANALYSIS ---')
console.log('Qualified WITHOUT target service lines:', qualified.length - withServiceLines.length)
console.log('Qualified WITHOUT US presence:', qualified.length - withUSPresence.length)
console.log('Qualified with service lines but NO US presence:', withServiceLines.length - withBoth.length)
console.log('Qualified with US presence but NO target service lines:', withUSPresence.length - withBoth.length)
