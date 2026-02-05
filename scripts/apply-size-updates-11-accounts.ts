/**
 * Apply size corrections for the 6 accounts we researched as Mid Market.
 * Set size_employee_count to Mid Market and qualified to Y; add back to qualified list.
 */
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
const FINAL_CSV = path.join(DATA_DIR, 'Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03).csv')
const QUALIFIED_JSON = path.join(DATA_DIR, 'qualified-for-captive-check.json')

const MID_MARKET_SIZE = 'Mid Market (1,000–5,000 employees)'

const WEBSITES_TO_UPGRADE = [
  'gcsagents.com',
  'answernet.com',
  'arise.com',
  'five9.com',
  'focusservices.com',
  'openaccessbpo.com',
]

function normalizeWebsite(url: string): string {
  if (!url || url.trim() === '/') return ''
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('/')[0] ?? ''
}

function processCsv(csvPath: string, upgradeSet: Set<string>) {
  const csvText = fs.readFileSync(csvPath, 'utf-8')
  const parsed: string[][] = parse(csvText, { relax_column_count: true })
  const header = parsed[0]
  const dataRows = parsed.slice(1).filter((row) => (row[0] ?? '') !== 'company_name')
  const sizeIdx = header.indexOf('size_employee_count')
  const qualifiedIdx = header.indexOf('qualified')
  const websiteIdx = header.indexOf('website')
  const nameIdx = header.indexOf('company_name')
  let updated = 0
  const addedToQualified: { company_name: string; website: string }[] = []
  for (const row of dataRows) {
    const key = normalizeWebsite(row[websiteIdx] ?? '')
    if (!upgradeSet.has(key)) continue
    row[sizeIdx] = MID_MARKET_SIZE
    row[qualifiedIdx] = 'Y'
    updated++
    addedToQualified.push({
      company_name: (row[nameIdx] ?? '').replace(/^"|"$/g, ''),
      website: (row[websiteIdx] ?? '').replace(/^"|"$/g, ''),
    })
  }
  const records = dataRows.map((row) => {
    const rec: Record<string, string> = {}
    header.forEach((h, i) => {
      rec[h] = row[i] ?? ''
    })
    return rec
  })
  fs.writeFileSync(csvPath, stringify(records, { header: true, quoted: true }))
  return { updated, addedToQualified }
}

async function main() {
  const upgradeSet = new Set(WEBSITES_TO_UPGRADE)

  const masterResult = processCsv(MASTER_CSV, upgradeSet)
  console.log(`Master List: updated ${masterResult.updated} rows to Mid Market and qualified=Y.`)

  if (fs.existsSync(FINAL_CSV)) {
    const finalResult = processCsv(FINAL_CSV, upgradeSet)
    console.log(`Final CSV: updated ${finalResult.updated} rows.`)
  }

  const qualified: { company_name: string; website: string }[] = JSON.parse(
    fs.readFileSync(QUALIFIED_JSON, 'utf-8')
  )
  const before = qualified.length
  const existingWebsites = new Set(qualified.map((q) => normalizeWebsite(q.website)))
  for (const e of masterResult.addedToQualified) {
    const key = normalizeWebsite(e.website)
    if (key && !existingWebsites.has(key)) {
      existingWebsites.add(key)
      qualified.push(e)
    }
  }
  fs.writeFileSync(QUALIFIED_JSON, JSON.stringify(qualified, null, 2))
  console.log(`Qualified list: ${before} → ${qualified.length} entries (added back ${qualified.length - before}).`)
}

main().catch(console.error)
