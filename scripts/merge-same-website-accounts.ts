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

function normalizeWebsite(url: string): string {
  if (!url || url === '/') return ''
  let u = url.trim().toLowerCase()
  u = u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').split('/')[0] ?? ''
  return u
}

function pickBestName(rows: string[][], nameIdx: number): string {
  const names = rows.map((r) => (r[nameIdx] ?? '').trim()).filter(Boolean)
  if (names.length === 0) return ''
  // Prefer name without " 2" or " 2" suffix (duplicate entry marker)
  const without2 = names.filter((n) => !/\s+2\s*$/.test(n) && !/^[^,]+ 2,/.test(n))
  if (without2.length > 0) names.splice(0, names.length, ...without2)
  // Prefer canonical spellings (e.g. TaskUs not Taskeu, Teleperformance not TP)
  const preferred: Record<string, string> = {
    taskeu: 'TaskUs',
    tp: 'Teleperformance',
    teletech: 'TTEC',
    'ttec agility': 'TTEC',
    gebbs: 'GeBBS Healthcare Solutions',
    firstsource: 'Firstsource Solutions Limited',
    'computer generated solutions': 'CGS',
    itel: 'Itel International',
    'km2 solutions': 'KM² Solutions',
    mplus: 'Mplus Group',
    'erc global cx': 'Erc',
    erc: 'Erc',
    'global healthcare resource': 'Global Healthcare Resource Philippines Inc',
    'answer all 2': 'Answer All',
    intellegentia: 'Intelegencia',
    intelegencia: 'Intelegencia',
    'outsourced staff': 'Staff Outsourcing Solutions',
    'ohio digital': 'RDI Corporation',
    'voxpro powered by telus international': 'TELUS Digital',
    'telus digital': 'TELUS Digital',
  }
  for (const n of names) {
    const key = n.toLowerCase().replace(/\s+/g, ' ')
    if (preferred[key]) return preferred[key]
  }
  // Prefer longer/more formal name (more words, no trailing " 2")
  names.sort((a, b) => b.length - a.length)
  return names[0] ?? ''
}

function coalesce(rows: string[][], colIdx: number): string {
  for (const row of rows) {
    const v = (row[colIdx] ?? '').trim()
    if (v) return v
  }
  return ''
}

async function main() {
  const csvText = fs.readFileSync(MASTER_CSV, 'utf-8')
  const parsed: string[][] = parse(csvText, { relax_column_count: true })
  const header = parsed[0]
  if (!header || header[0] !== 'company_name') {
    throw new Error('Expected header row first')
  }
  const dataRows = parsed.slice(1).filter((row) => row[0] !== 'company_name') as string[][]
  const nameIdx = header.indexOf('company_name')
  const websiteIdx = header.indexOf('website')

  const byWebsite = new Map<string, string[][]>()
  for (const row of dataRows) {
    const url = (row[websiteIdx] ?? '').trim()
    const key = normalizeWebsite(url)
    if (!key) {
      byWebsite.set(`__empty_${row[nameIdx] ?? ''}_${Math.random()}`, [row])
      continue
    }
    if (!byWebsite.has(key)) byWebsite.set(key, [])
    byWebsite.get(key)!.push(row)
  }

  const mergedRows: string[][] = []
  for (const [_site, rows] of byWebsite) {
    if (rows.length === 1) {
      mergedRows.push(rows[0])
      continue
    }
    const merged = header.map((_h, colIdx) => {
      if (colIdx === nameIdx) return pickBestName(rows, nameIdx)
      if (colIdx === websiteIdx) return coalesce(rows, websiteIdx)
      return coalesce(rows, colIdx)
    })
    mergedRows.push(merged)
  }

  const records = mergedRows.map((row) => {
    const rec: Record<string, string> = {}
    header.forEach((h, i) => {
      rec[h] = row[i] ?? ''
    })
    return rec
  })
  const out = stringify(records, { header: true, quoted: true })
  fs.writeFileSync(MASTER_CSV, out)
  const removed = dataRows.length - mergedRows.length
  console.log(`Master List: ${dataRows.length} → ${mergedRows.length} rows (merged ${removed} duplicate-by-website rows).`)

  const qualifiedRaw = fs.readFileSync(QUALIFIED_JSON, 'utf-8')
  const qualified: { company_name: string; website: string }[] = JSON.parse(qualifiedRaw)
  const nameByWebsite = new Map<string, string>()
  const urlByWebsite = new Map<string, string>()
  for (const [_site, rows] of byWebsite) {
    const key = normalizeWebsite(rows[0][websiteIdx] ?? '')
    if (!key) continue
    nameByWebsite.set(key, pickBestName(rows, nameIdx))
    urlByWebsite.set(key, coalesce(rows, websiteIdx))
  }
  const seen = new Set<string>()
  const finalQualified: { company_name: string; website: string }[] = []
  for (const q of qualified) {
    const key = normalizeWebsite(q.website)
    if (!key) {
      finalQualified.push(q)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    const name = nameByWebsite.get(key) ?? q.company_name
    const url = urlByWebsite.get(key) ?? q.website
    finalQualified.push({ company_name: name, website: url })
  }
  fs.writeFileSync(QUALIFIED_JSON, JSON.stringify(finalQualified, null, 2))
  console.log(`Qualified list: ${qualified.length} → ${finalQualified.length} entries (one per website).`)
}

main().catch(console.error)
