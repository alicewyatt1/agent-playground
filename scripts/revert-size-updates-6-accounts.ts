/**
 * Revert the 6 accounts back to SME and qualified=N (undo apply-size-updates without asking).
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

const SME_SIZE = 'SME (1–1,000 employees)'

const WEBSITES_TO_REVERT = [
  'gcsagents.com',
  'answernet.com',
  'arise.com',
  'five9.com',
  'focusservices.com',
  'openaccessbpo.com',
]

function normalizeWebsite(url: string): string {
  if (!url || url.trim() === '/') return ''
  return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').split('/')[0] ?? ''
}

function processCsv(csvPath: string, revertSet: Set<string>) {
  const csvText = fs.readFileSync(csvPath, 'utf-8')
  const parsed: string[][] = parse(csvText, { relax_column_count: true })
  const header = parsed[0]
  const dataRows = parsed.slice(1).filter((row) => (row[0] ?? '') !== 'company_name')
  const sizeIdx = header.indexOf('size_employee_count')
  const qualifiedIdx = header.indexOf('qualified')
  const websiteIdx = header.indexOf('website')
  let updated = 0
  for (const row of dataRows) {
    const key = normalizeWebsite(row[websiteIdx] ?? '')
    if (!revertSet.has(key)) continue
    row[sizeIdx] = SME_SIZE
    row[qualifiedIdx] = 'N'
    updated++
  }
  const records = dataRows.map((row) => {
    const rec: Record<string, string> = {}
    header.forEach((h, i) => { rec[h] = row[i] ?? '' })
    return rec
  })
  fs.writeFileSync(csvPath, stringify(records, { header: true, quoted: true }))
  return updated
}

async function main() {
  const revertSet = new Set(WEBSITES_TO_REVERT)
  const masterUpdated = processCsv(MASTER_CSV, revertSet)
  console.log(`Master List: reverted ${masterUpdated} rows to SME and qualified=N.`)
  if (fs.existsSync(FINAL_CSV)) {
    const finalUpdated = processCsv(FINAL_CSV, revertSet)
    console.log(`Final CSV: reverted ${finalUpdated} rows.`)
  }
  const qualified: { company_name: string; website: string }[] = JSON.parse(fs.readFileSync(QUALIFIED_JSON, 'utf-8'))
  const before = qualified.length
  const filtered = qualified.filter((q) => !revertSet.has(normalizeWebsite(q.website)))
  fs.writeFileSync(QUALIFIED_JSON, JSON.stringify(filtered, null, 2))
  console.log(`Qualified list: ${before} → ${filtered.length} (removed ${before - filtered.length}).`)
}

main().catch(console.error)
