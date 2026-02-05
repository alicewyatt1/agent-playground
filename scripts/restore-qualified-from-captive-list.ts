/**
 * Restore the qualified list from captive-bpo-results.json (the list that was
 * used for the captive check = our qualified accounts before update-qualified-column overwrote it).
 * Set Master List qualified column by website match only – do NOT recompute from rules.
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
const QUALIFIED_JSON = path.join(DATA_DIR, 'qualified-for-captive-check.json')
const CAPTIVE_LIST = path.join(DATA_DIR, 'captive-bpo-results.json')

function normalizeWebsite(url: string): string {
  if (!url || url.trim() === '/') return ''
  const u = url.trim().toLowerCase()
  return u
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('/')[0] ?? ''
}

async function main() {
  type CaptiveEntry = { company_name: string; website: string }
  const captive: CaptiveEntry[] = JSON.parse(fs.readFileSync(CAPTIVE_LIST, 'utf-8'))

  const byWebsite = new Map<string, { company_name: string; website: string }>()
  for (const e of captive) {
    const key = normalizeWebsite(e.website)
    if (!key) continue
    if (!byWebsite.has(key)) byWebsite.set(key, { company_name: e.company_name, website: e.website })
  }

  const qualifiedSet = new Set(byWebsite.keys())
  const restoredQualified = Array.from(byWebsite.values())
  fs.writeFileSync(QUALIFIED_JSON, JSON.stringify(restoredQualified, null, 2))
  console.log(`Restored qualified list from captive-bpo-results: ${restoredQualified.length} entries (one per website).`)

  const csvText = fs.readFileSync(MASTER_CSV, 'utf-8')
  const parsed: string[][] = parse(csvText, { relax_column_count: true })
  const headerRow = parsed[0]
  if (!headerRow || headerRow[0] !== 'company_name') throw new Error('Expected header row first')

  const dataRows = parsed.slice(1).filter((row) => (row[0] ?? '') !== 'company_name')
  const header = [...headerRow]
  const qualifiedIdx = header.indexOf('qualified')
  if (qualifiedIdx === -1) header.push('qualified')

  const websiteIdx = header.indexOf('website')
  let yCount = 0
  for (const row of dataRows) {
    const url = (row[websiteIdx] ?? '').trim()
    const key = normalizeWebsite(url)
    const isQualified = key && qualifiedSet.has(key)
    if (isQualified) yCount++
    const colIdx = qualifiedIdx >= 0 ? qualifiedIdx : row.length
    if (colIdx >= row.length) row.push(isQualified ? 'Y' : 'N')
    else row[colIdx] = isQualified ? 'Y' : 'N'
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
  console.log(`Master List: qualified column set by website match. ${yCount} rows with qualified=Y.`)
}

main().catch(console.error)
