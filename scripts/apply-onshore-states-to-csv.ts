/**
 * Apply onshore-state-results.json to the Master List (repo data/).
 * Replaces "United States" (or USA/US) in onshore_delivery_footprint with researched state names.
 * Matches by normalized website so merged/renamed rows are still updated.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
const RESULTS_PATH = path.join(DATA_DIR, 'onshore-state-results.json')
const MASTER_CSV = path.join(DATA_DIR, 'Global Contact Center Market Map (Final) - Master List.csv')
const FINAL_CSV = path.join(DATA_DIR, 'Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03).csv')

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

/** True if onshore contains United States / USA / US (so we should replace with state list when we have research). */
function onshoreContainsUS(onshore: string): boolean {
  if (!onshore?.trim()) return false
  return /United States|\bUSA\b|\bUS\b/i.test(onshore)
}

function applyToCsv(csvPath: string, byWebsite: Map<string, string>): number {
  const csv = fs.readFileSync(csvPath, 'utf-8')
  const rows = parse(csv, { relax_column_count: true })
  const header = rows[0]
  const dataRows = rows.slice(1).filter((r: string[]) => (r[0] ?? '') !== 'company_name')
  const websiteIdx = header.indexOf('website')
  const onshoreIdx = header.indexOf('onshore_delivery_footprint')
  let updated = 0
  for (const row of dataRows) {
    const key = normalizeWebsite(row[websiteIdx] ?? '')
    const newOnshore = key ? byWebsite.get(key) : null
    const current = (row[onshoreIdx] ?? '').trim()
    if (!newOnshore) continue
    if (current === newOnshore) continue
    if (!onshoreContainsUS(current)) continue
    row[onshoreIdx] = newOnshore
    updated++
  }
  const records = dataRows.map((row: string[]) => {
    const rec: Record<string, string> = {}
    header.forEach((h: string, i: number) => {
      rec[h] = row[i] ?? ''
    })
    return rec
  })
  fs.writeFileSync(csvPath, stringify(records, { header: true, quoted: true }))
  return updated
}

function main() {
  const results: { company_name: string; website: string; states: string[] }[] = JSON.parse(
    fs.readFileSync(RESULTS_PATH, 'utf-8')
  )
  const toUpdate = results.filter((r) => r.states && r.states.length > 0)
  const byWebsite = new Map<string, string>()
  for (const r of toUpdate) {
    const key = normalizeWebsite(r.website)
    if (key) byWebsite.set(key, r.states.join(' | '))
  }
  console.log('Onshore state results:', toUpdate.length, 'with states;', byWebsite.size, 'unique websites.')

  const masterUpdated = applyToCsv(MASTER_CSV, byWebsite)
  console.log('Master List: updated', masterUpdated, 'rows.')

  if (fs.existsSync(FINAL_CSV)) {
    const finalUpdated = applyToCsv(FINAL_CSV, byWebsite)
    console.log('Final CSV: updated', finalUpdated, 'rows.')
  }
}

main()
