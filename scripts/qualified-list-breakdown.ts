/**
 * Breakdown of qualified list: by HQ, and by US presence (HQ vs onshore vs nearshore/offshore).
 * Output: data/qualified-list-breakdown.md
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MASTER_CSV = path.join(__dirname, '..', 'data', 'Global Contact Center Market Map (Final) - Master List.csv')
const OUT_MD = path.join(__dirname, '..', 'data', 'qualified-list-breakdown.md')

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia',
]

function hqIsUS(hq: string): boolean {
  if (!hq?.trim()) return false
  const lower = hq.toLowerCase()
  if (lower.includes('united states') || /\busa\b/.test(lower) || /\bus\b/.test(lower)) return true
  return US_STATES.some((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hq))
}

function footprintHasUSState(footprint: string): boolean {
  if (!footprint?.trim()) return false
  return US_STATES.some((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(footprint))
}

function footprintHasUSCountry(footprint: string): boolean {
  if (!footprint?.trim()) return false
  return /united states|\busa\b|\bus\b/i.test(footprint)
}

function normalizeHQ(hq: string): string {
  if (!hq?.trim()) return '(blank)'
  const t = hq.trim()
  if (/^(United States|USA|US)$/i.test(t)) return 'United States'
  if (US_STATES.some((s) => new RegExp(`^${s}$`, 'i').test(t))) return 'United States'
  if (/\b(United States|USA|US)\b/i.test(t)) return 'United States'
  if (/\b(United Kingdom|UK|England)\b/i.test(t)) return 'United Kingdom'
  if (/, *\w+ *$/.test(t)) {
    const last = t.split(',').pop()?.trim() ?? ''
    if (/^(United States|USA|US)$/i.test(last)) return 'United States'
    if (/^(United Kingdom|UK|England)$/i.test(last)) return 'United Kingdom'
  }
  return t
}

function main() {
  const csv = fs.readFileSync(MASTER_CSV, 'utf-8')
  const rows: string[][] = parse(csv, { relax_column_count: true })
  const header = rows[0]
  const data = rows.slice(1).filter((r) => (r[0] ?? '') !== 'company_name')

  const nameIdx = header.indexOf('company_name')
  const hqIdx = header.indexOf('company_hq')
  const onIdx = header.indexOf('onshore_delivery_footprint')
  const nearIdx = header.indexOf('nearshore_delivery_footprint')
  const offIdx = header.indexOf('offshore_delivery_footprint')
  const qualIdx = header.indexOf('qualified')

  const qualified = data.filter((r) => (r[qualIdx] ?? '').trim() === 'Y')
  const n = qualified.length

  const byHQ = new Map<string, number>()
  for (const r of qualified) {
    const hq = normalizeHQ(r[hqIdx] ?? '')
    byHQ.set(hq, (byHQ.get(hq) ?? 0) + 1)
  }

  type USCategory = string
  const usCategories = new Map<USCategory, number>()

  for (const r of qualified) {
    const hq = (r[hqIdx] ?? '').trim()
    const onshore = (r[onIdx] ?? '').trim()
    const nearshore = (r[nearIdx] ?? '').trim()
    const offshore = (r[offIdx] ?? '').trim()

    const usHQ = hqIsUS(hq)
    const usOnshore = footprintHasUSState(onshore) || footprintHasUSCountry(onshore)
    const usNearshore = footprintHasUSCountry(nearshore)
    const usOffshore = footprintHasUSCountry(offshore)

    let cat: USCategory
    if (!usHQ && usOnshore && !usNearshore && !usOffshore) {
      cat = 'US in onshore only (not in HQ)'
    } else if (usHQ && !usOnshore && !usNearshore && !usOffshore) {
      cat = 'US HQ only'
    } else if (usHQ && usOnshore) {
      cat = 'US HQ + Onshore'
    } else if (!usHQ && !usOnshore && (usNearshore || usOffshore)) {
      cat = 'US in nearshore/offshore only (not HQ or onshore)'
    } else if (usHQ && (usNearshore || usOffshore) && !usOnshore) {
      cat = 'US HQ + nearshore/offshore only (no US onshore)'
    } else if (usHQ && usOnshore && (usNearshore || usOffshore)) {
      cat = 'US HQ + Onshore + nearshore/offshore'
    } else if (!usHQ && usOnshore && (usNearshore || usOffshore)) {
      cat = 'US onshore + nearshore/offshore (no US HQ)'
    } else if (usOnshore && !usHQ) {
      cat = 'US onshore only (not in HQ)' // already counted above if no near/off
    } else {
      cat = 'Other US combination'
    }
    usCategories.set(cat, (usCategories.get(cat) ?? 0) + 1)
  }

  const hqSorted = [...byHQ.entries()].sort((a, b) => b[1] - a[1])
  const usSorted = [...usCategories.entries()].sort((a, b) => b[1] - a[1])

  const lines: string[] = []
  lines.push('# Qualified list breakdown')
  lines.push('')
  lines.push(`**Total qualified accounts:** ${n}`)
  lines.push('')
  lines.push('## 1. By HQ (number and percentage)')
  lines.push('')
  lines.push('| HQ | Number | Percentage |')
  lines.push('|----|--------|------------|')
  for (const [hq, count] of hqSorted) {
    const pct = ((count / n) * 100).toFixed(1)
    lines.push(`| ${hq} | ${count} | ${pct}% |`)
  }
  lines.push('')
  lines.push('## 2. US presence (where US appears)')
  lines.push('')
  lines.push('US = United States, USA, US, or any US state. Onshore = typically US state names in onshore_delivery_footprint.')
  lines.push('')
  lines.push('| Category | Number | Percentage |')
  lines.push('|----------|--------|------------|')
  for (const [cat, count] of usSorted) {
    const pct = ((count / n) * 100).toFixed(1)
    lines.push(`| ${cat} | ${count} | ${pct}% |`)
  }
  lines.push('')

  fs.writeFileSync(OUT_MD, lines.join('\n'))
  console.log(`Wrote ${OUT_MD}`)
}

main()
