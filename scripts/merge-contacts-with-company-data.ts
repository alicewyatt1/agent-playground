import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

config()

const PRIORITY_LIST_PATH = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Priority list (MM) (1).csv'
const TOP_CONTACTS_PATH = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Top Contacts (1).csv'
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'contacts-with-company-data.csv')

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\.]/g, '')
    .replace(/\binc\b|\bcorp\b|\bllc\b|\bltd\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const priorityRaw = fs.readFileSync(PRIORITY_LIST_PATH, 'utf-8')
  const contactsRaw = fs.readFileSync(TOP_CONTACTS_PATH, 'utf-8')

  const priorityList = parse(priorityRaw, { columns: true, skip_empty_lines: true }) as Record<string, string>[]
  const contacts = parse(contactsRaw, { columns: true, skip_empty_lines: true }) as Record<string, string>[]

  // Build lookup map: normalized name -> company row
  const companyMap = new Map<string, Record<string, string>>()
  for (const company of priorityList) {
    companyMap.set(normalize(company.company_name), company)
  }

  // Prefix company columns to avoid clashing with contact columns
  const companyColumns = Object.keys(priorityList[0]).map(col => `company_${col}`)

  const merged: Record<string, string>[] = []
  const unmatched = new Set<string>()

  for (const contact of contacts) {
    const key = normalize(contact['Company Name'])
    const companyData = companyMap.get(key)

    if (!companyData) {
      unmatched.add(contact['Company Name'])
    }

    const mergedRow: Record<string, string> = { ...contact }
    for (const col of Object.keys(priorityList[0])) {
      mergedRow[`company_${col}`] = companyData ? companyData[col] : ''
    }

    merged.push(mergedRow)
    console.log(`✓ ${contact['Full Name']} (${contact['Company Name']}) → ${companyData ? 'matched' : 'NO MATCH'}`)
  }

  const csv = stringify(merged, { header: true, columns: [...Object.keys(contacts[0]), ...companyColumns] })
  fs.writeFileSync(OUTPUT_PATH, csv, 'utf-8')

  console.log(`\n✅ Done! ${merged.length} contacts written to ${OUTPUT_PATH}`)
  if (unmatched.size > 0) {
    console.log(`\n⚠️  No company data found for these ${unmatched.size} company name(s):`)
    for (const name of unmatched) console.log(`   - ${name}`)
  }
}

main().catch(console.error)
