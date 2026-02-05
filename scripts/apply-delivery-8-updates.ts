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
const DELIVERY_8_JSON = path.join(DATA_DIR, 'delivery-8-results.json')

type DeliveryRow = {
  company_name: string
  delivery_model: string
  onshore: string
  nearshore: string
  offshore: string
}

function toFootprint(s: string): string {
  if (!s || !s.trim()) return ''
  return s.split('|').map((x) => x.trim()).filter(Boolean).join(' | ')
}

function buildUpdates(): Map<string, { delivery_model: string; onshore: string; nearshore: string; offshore: string }> {
  const raw = fs.readFileSync(DELIVERY_8_JSON, 'utf-8')
  const rows: DeliveryRow[] = JSON.parse(raw)
  const map = new Map<string, { delivery_model: string; onshore: string; nearshore: string; offshore: string }>()
  for (const r of rows) {
    if (!r.delivery_model?.trim() && !r.onshore?.trim() && !r.nearshore?.trim() && !r.offshore?.trim()) continue
    const key = r.company_name.trim()
    map.set(key, {
      delivery_model: r.delivery_model?.trim() ?? '',
      onshore: toFootprint(r.onshore ?? ''),
      nearshore: toFootprint(r.nearshore ?? ''),
      offshore: toFootprint(r.offshore ?? ''),
    })
  }
  return map
}

async function main() {
  const updates = buildUpdates()
  const csvText = fs.readFileSync(MASTER_CSV, 'utf-8')
  const rows: string[][] = parse(csvText, { relax_column_count: true })
  const header = rows[0]
  const nameIdx = header.indexOf('company_name')
  const deliveryModelIdx = header.indexOf('delivery_model')
  const onshoreIdx = header.indexOf('onshore_delivery_footprint')
  const nearshoreIdx = header.indexOf('nearshore_delivery_footprint')
  const offshoreIdx = header.indexOf('offshore_delivery_footprint')

  if ([nameIdx, deliveryModelIdx, onshoreIdx, nearshoreIdx, offshoreIdx].some((i) => i === -1)) {
    throw new Error('Missing required columns')
  }

  let applied = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const name = (row[nameIdx] ?? '').trim()
    const upd = updates.get(name)
    if (!upd) continue
    row[deliveryModelIdx] = upd.delivery_model || row[deliveryModelIdx]
    row[onshoreIdx] = upd.onshore || row[onshoreIdx]
    row[nearshoreIdx] = upd.nearshore || row[nearshoreIdx]
    row[offshoreIdx] = upd.offshore || row[offshoreIdx]
    applied++
  }

  const records = rows.map((row) => {
    const rec: Record<string, string> = {}
    header.forEach((h, i) => {
      rec[h] = row[i] ?? ''
    })
    return rec
  })
  const out = stringify(records, { header: true, quoted: true })
  fs.writeFileSync(MASTER_CSV, out)
  console.log(`Applied delivery updates for ${applied} accounts.`)
}

main().catch(console.error)
