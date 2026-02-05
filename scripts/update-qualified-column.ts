import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
const MASTER_CSV = path.join(DATA_DIR, 'Global Contact Center Market Map (Final) - Master List.csv')
const QUALIFIED_JSON = path.join(DATA_DIR, 'qualified-for-captive-check.json')

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia',
]

/** True if the string indicates US (United States, USA, US, or any US state). */
function textHasUS(val: string): boolean {
  if (!val || !val.trim()) return false
  const lower = val.toLowerCase()
  if (lower.includes('united states') || /\busa\b/.test(lower) || /\bus\b/.test(lower)) return true
  return US_STATES.some((state) => new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(val))
}

/**
 * US presence = US HQ (state or United States) OR onshore has US state OR nearshore/offshore lists United States.
 */
function hasUSPresence(row: Record<string, string>): boolean {
  const hq = (row.company_hq ?? '').trim()
  const onshore = (row.onshore_delivery_footprint ?? '').trim()
  const nearshore = (row.nearshore_delivery_footprint ?? '').trim()
  const offshore = (row.offshore_delivery_footprint ?? '').trim()

  if (textHasUS(hq)) return true
  if (textHasUS(onshore)) return true
  if (/united states|\busa\b|\bus\b/i.test(nearshore)) return true
  if (/united states|\busa\b|\bus\b/i.test(offshore)) return true
  return false
}

function isMidMarketOrEnterprise(row: Record<string, string>): boolean {
  const size = (row.size_employee_count ?? '').toLowerCase()
  return size.includes('mid market') || size.includes('enterprise')
}

function hasOutboundTags(row: Record<string, string>): boolean {
  const sl = (row.service_lines ?? '').toLowerCase()
  return (
    sl.includes('sales outsourcing') ||
    sl.includes('outbound services') ||
    sl.includes('b2c telemarketing') ||
    sl.includes('telesales') ||
    sl.includes('collections recovery')
  )
}

async function main() {
  const csvText = fs.readFileSync(MASTER_CSV, 'utf-8')
  const parsed: string[][] = parse(csvText, { relax_column_count: true })
  const headerRow = parsed[0]
  if (!headerRow || headerRow[0] !== 'company_name') {
    throw new Error('Expected header row first')
  }

  const dataRows = parsed.slice(1).filter((row) => (row[0] ?? '') !== 'company_name')
  const header = [...headerRow]
  const qualifiedIdx = header.indexOf('qualified')
  if (qualifiedIdx === -1) {
    header.push('qualified')
  }

  const nameIdx = header.indexOf('company_name')
  const websiteIdx = header.indexOf('website')
  const hqIdx = header.indexOf('company_hq')
  const sizeIdx = header.indexOf('size_employee_count')
  const serviceLinesIdx = header.indexOf('service_lines')
  const onshoreIdx = header.indexOf('onshore_delivery_footprint')
  const nearshoreIdx = header.indexOf('nearshore_delivery_footprint')
  const offshoreIdx = header.indexOf('offshore_delivery_footprint')

  const qualifiedEntries: { company_name: string; website: string }[] = []
  const seenWebsite = new Set<string>()

  for (const row of dataRows) {
    const record: Record<string, string> = {}
    header.forEach((h, i) => {
      if (i < row.length) record[h] = row[i] ?? ''
    })
    const isQualified = hasUSPresence(record) && isMidMarketOrEnterprise(record) && hasOutboundTags(record)
    record.qualified = isQualified ? 'Y' : 'N'

    if (isQualified) {
      const website = (record.website ?? '').trim()
      const norm = website.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').split('/')[0] ?? ''
      if (norm && !seenWebsite.has(norm)) {
        seenWebsite.add(norm)
        qualifiedEntries.push({ company_name: record.company_name ?? '', website })
      }
    }

    if (qualifiedIdx === -1) {
      row.push(record.qualified)
    } else {
      row[qualifiedIdx] = record.qualified
    }
  }

  const records = dataRows.map((row) => {
    const rec: Record<string, string> = {}
    header.forEach((h, i) => {
      rec[h] = row[i] ?? ''
    })
    return rec
  })

  const out = stringify(records, { header: true, quoted: true })
  fs.writeFileSync(MASTER_CSV, out)
  fs.writeFileSync(QUALIFIED_JSON, JSON.stringify(qualifiedEntries, null, 2))

  const qualifiedCount = records.filter((r) => r.qualified === 'Y').length
  console.log(`Qualified column updated.`)
  console.log(`Master List: ${qualifiedCount} qualified (Y), ${records.length - qualifiedCount} not qualified (N).`)
  console.log(`Qualified list (data/qualified-for-captive-check.json): ${qualifiedEntries.length} entries (one per website).`)
}

main().catch(console.error)
