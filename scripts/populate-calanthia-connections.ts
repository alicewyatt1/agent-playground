import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

const INPUT_PATH = '/Users/alicewyatt/Downloads/Top Contacts 2026 - Top Contacts.csv'
const OUTPUT_PATH = '/Users/alicewyatt/repos/agent-playground/data/top-contacts-with-calanthia-connections.csv'

// Calanthia's 2nd-degree connections found via LinkedIn search (logged in as Calanthia Mei Fuchs)
// Searched all 41 companies with 2nd-degree network filter
// Only contacts that appeared in 2nd-degree search results are listed here
const calanthia2ndDegree: Record<string, string> = {
  // Boldr
  'David Sudolsky': 'Meredith Sweeney; Casey Lawlor; +12 others',
  'Mari Parker': 'Erica Wenger; Karen Batungbacal, FICD; +1 other',

  // ClearSource BPO
  'Rob Goeller': 'Sterling Snow; Brandon Delgrosso; +5 others',

  // Direct Interactions
  'Chris Fong': 'Leslie Padrick; Jeremy Jonker; +7 others',

  // Etech Global Services
  'Matt Rocco': 'Ian Harriman; Tzvika Agassi',
  'Jim Iyoob': 'Ian Harriman; Tzvika Agassi; +2 others',

  // Global Contact Service International
  'Bryan Overcash': 'Ian Harriman',

  // NexRep
  'Teddy Liaw': 'Bob Wu; Jake Gibson; +7 others',
}

const csvContent = fs.readFileSync(INPUT_PATH, 'utf-8')
const records = parse(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true })

const originalColumns = Object.keys(records[0])

// Find Calanthia columns
const calFirstDegCol = originalColumns.find(c => c.startsWith('Calanthia First'))
const calSecondDegCol = originalColumns.find(c => c.startsWith('Calanthia Second'))

if (!calFirstDegCol || !calSecondDegCol) {
  console.error('Could not find Calanthia columns!')
  console.error('Columns found:', originalColumns)
  process.exit(1)
}

console.log(`Calanthia 1st degree column: "${calFirstDegCol}"`)
console.log(`Calanthia 2nd degree column: "${calSecondDegCol}"`)

let enrichedCount = 0
let totalClayOrBlank = 0

const updatedRecords = records.map((row: Record<string, string>) => {
  const fullName = row['Full Name']?.trim()
  const source = row['Source']?.trim()

  // Only process Clay or blank source contacts
  if (source === 'Clay' || source === '' || !source) {
    totalClayOrBlank++

    const mutuals = calanthia2ndDegree[fullName]
    if (mutuals) {
      row[calFirstDegCol] = 'No'
      row[calSecondDegCol] = mutuals
      enrichedCount++
    } else if (fullName) {
      row[calFirstDegCol] = 'No'
      row[calSecondDegCol] = ''
    }
  }

  return row
})

const output = stringify(updatedRecords, { header: true, columns: originalColumns })
fs.writeFileSync(OUTPUT_PATH, output)

console.log(`\nOutput written to: ${OUTPUT_PATH}`)
console.log(`Total records: ${updatedRecords.length}`)
console.log(`Clay/blank source contacts checked: ${totalClayOrBlank}`)
console.log(`Contacts with Calanthia 2nd-degree connections: ${enrichedCount}`)

console.log(`\n=== CALANTHIA'S 2ND-DEGREE CONNECTIONS ===`)
Object.entries(calanthia2ndDegree).forEach(([name, mutuals]) => {
  const row = records.find((r: Record<string, string>) => r['Full Name']?.trim() === name)
  const company = row?.['Company Name'] || 'Unknown'
  console.log(`  ✓ ${name} (${company}) → mutuals: ${mutuals}`)
})

console.log(`\nAll other Clay/blank contacts: No 2nd-degree connection found for Calanthia`)
