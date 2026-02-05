/**
 * Remove from the qualified list any account that has size SME in the Master List.
 * Sets qualified=N for those rows and removes them from qualified-for-captive-check.json.
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

function isSME(size: string): boolean {
  const s = (size ?? '').toLowerCase()
  return s.includes('sme')
}

async function main() {
  const csvText = fs.readFileSync(MASTER_CSV, 'utf-8')
  const parsed: string[][] = parse(csvText, { relax_column_count: true })
  const header = parsed[0]
  const dataRows = parsed.slice(1).filter((row) => (row[0] ?? '') !== 'company_name')

  const websiteIdx = header.indexOf('website')
  const sizeIdx = header.indexOf('size_employee_count')
  const qualifiedIdx = header.indexOf('qualified')
  if (qualifiedIdx === -1) throw new Error('No qualified column')

  const smeWebsites = new Set<string>()
  for (const row of dataRows) {
    const qual = (row[qualifiedIdx] ?? '').trim()
    if (qual !== 'Y') continue
    if (isSME(row[sizeIdx] ?? '')) {
      smeWebsites.add(normalizeWebsite(row[websiteIdx] ?? ''))
    }
  }

  console.log(`Found ${smeWebsites.size} qualified accounts with SME size. Removing from qualified list.`)

  const qualified: { company_name: string; website: string }[] = JSON.parse(
    fs.readFileSync(QUALIFIED_JSON, 'utf-8')
  )
  const filtered = qualified.filter((q) => !smeWebsites.has(normalizeWebsite(q.website)))
  fs.writeFileSync(QUALIFIED_JSON, JSON.stringify(filtered, null, 2))
  console.log(`Qualified list: ${qualified.length} → ${filtered.length} entries.`)

  for (const row of dataRows) {
    const key = normalizeWebsite(row[websiteIdx] ?? '')
    if (smeWebsites.has(key)) row[qualifiedIdx] = 'N'
  }

  const records = dataRows.map((row) => {
    const rec: Record<string, string> = {}
    header.forEach((h, i) => {
      rec[h] = row[i] ?? ''
    })
    return rec
  })
  fs.writeFileSync(MASTER_CSV, stringify(records, { header: true, quoted: true }))
  console.log(`Master List: set qualified=N for ${smeWebsites.size} SME rows.`)

  if (fs.existsSync(FINAL_CSV)) {
    const finalText = fs.readFileSync(FINAL_CSV, 'utf-8')
    const finalParsed: string[][] = parse(finalText, { relax_column_count: true })
    const finalHeader = finalParsed[0]
    const finalRows = finalParsed.slice(1).filter((r) => (r[0] ?? '') !== 'company_name')
    const fWebsiteIdx = finalHeader.indexOf('website')
    const fQualIdx = finalHeader.indexOf('qualified')
    for (const row of finalRows) {
      if (smeWebsites.has(normalizeWebsite(row[fWebsiteIdx] ?? ''))) row[fQualIdx] = 'N'
    }
    const finalRecs = finalRows.map((row) => {
      const rec: Record<string, string> = {}
      finalHeader.forEach((h, i) => {
        rec[h] = row[i] ?? ''
      })
      return rec
    })
    fs.writeFileSync(FINAL_CSV, stringify(finalRecs, { header: true, quoted: true }))
    console.log(`Updated Final CSV as well.`)
  }
}

main().catch(console.error)
