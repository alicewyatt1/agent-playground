import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_PATH = path.resolve(__dirname, '../data/people-contacts-enriched.csv')
const CONNECTIONS_PATH = path.resolve(__dirname, '../data/linkedin-connections.json')

// Connection data format:
// Key = LinkedIn Profile URL
// Value = { degree: "1st"|"2nd"|"3rd"|"n/a", mutualConnections: string[] }
interface ConnectionData {
  degree: string
  mutualConnections: string[]
}

async function main() {
  console.log('Reading CSV...')
  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })

  console.log('Reading connection data...')
  const connectionsRaw = fs.readFileSync(CONNECTIONS_PATH, 'utf-8')
  const connections: Record<string, ConnectionData> = JSON.parse(connectionsRaw)

  const CALANTHIA = 'Calanthia Mei'

  let firstDegreeCount = 0
  let mutualCount = 0

  for (const row of records) {
    const linkedinUrl = (row['LinkedIn Profile'] || '').trim()
    const conn = connections[linkedinUrl]

    if (!conn) {
      row['First Degree Connection'] = ''
      row['Second Degree Connections'] = ''
      continue
    }

    const isFirstDegree = conn.degree === '1st'
    const hasCalanthia = conn.mutualConnections.some(
      (name) => name.toLowerCase().includes('calanthia') && name.toLowerCase().includes('mei')
    )

    // First Degree Connection: Yes if 1st degree OR Calanthia Mei is a mutual connection
    if (isFirstDegree || hasCalanthia) {
      row['First Degree Connection'] = 'Yes'
      firstDegreeCount++
    } else {
      row['First Degree Connection'] = ''
    }

    // Second Degree Connections: list of mutual connection names
    if (conn.mutualConnections.length > 0) {
      row['Second Degree Connections'] = conn.mutualConnections.join('; ')
      mutualCount++
    } else {
      row['Second Degree Connections'] = ''
    }
  }

  // Write output
  const columns = Object.keys(records[0])
  const output = stringify(records, { header: true, columns })
  fs.writeFileSync(CSV_PATH, output)

  console.log('\n' + '═'.repeat(60))
  console.log('LINKEDIN CONNECTIONS ENRICHMENT SUMMARY')
  console.log('═'.repeat(60))
  console.log(`Total contacts: ${records.length}`)
  console.log(`Profiles with connection data: ${Object.keys(connections).length}`)
  console.log(`First degree / Calanthia mutual: ${firstDegreeCount}`)
  console.log(`Contacts with mutual connections: ${mutualCount}`)
  console.log(`\nOutput: ${CSV_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main }
