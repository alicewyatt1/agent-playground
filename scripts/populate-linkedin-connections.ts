import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

const INPUT_PATH = '/Users/alicewyatt/Downloads/Gaps for Cursor - gaps-top-contacts-enriched-with-gaps-Default-view-export-1770905266585.csv'
const OUTPUT_PATH = '/Users/alicewyatt/repos/agent-playground/data/gaps-top-contacts-with-connections.csv'

// Connection data gathered by visiting LinkedIn profiles while logged in as Alice Wyatt
// Degree: '2nd' means 2nd-degree connection with mutual connections visible
//         '3rd+' means 3rd+ degree or outside network
//         'No URL' means no LinkedIn profile URL was provided
// None of these 47 contacts are 1st-degree connections of Alice Wyatt
// (verified via company-level LinkedIn search with 1st-degree filter)

type ConnectionInfo = {
  degree: '2nd' | '3rd+' | 'No URL' | 'Not checked'
  mutuals: string
}

const connectionData: Record<string, ConnectionInfo> = {
  // CBE Companies
  'Erica Parks': { degree: '2nd', mutuals: 'Albert Smothers, MBA, Ph.D.' },
  'Brian Answeeney': { degree: 'No URL', mutuals: '' },
  'LeGrand Bonnet': { degree: '2nd', mutuals: 'Lauren Ludlow; Albert Smothers, MBA, Ph.D.' },

  // ClearSource BPO
  'Pankaj Dhanuka': { degree: 'No URL', mutuals: '' },
  'Nate Spears': { degree: '2nd', mutuals: '' },

  // DATAMARK
  'Bill Randag': { degree: '2nd', mutuals: 'Brandon Pfluger, J.D.; Gabriel Pike; +1 other' },
  'Satish Kumar': { degree: '3rd+', mutuals: '' },

  // Direct Interactions
  'Matt Storey': { degree: '2nd', mutuals: 'Petrina Holoszyc; Nicholas Melillo, MBA; +4 others' },

  // Etech Global Services
  'Dilip Barot': { degree: '2nd', mutuals: 'Mark Escueta' },
  'Jim Iyoob': { degree: '2nd', mutuals: 'Mark Escueta; Alon Waks; +3 others' },
  'Kaylene Eckels': { degree: '3rd+', mutuals: '' },
  'Vishal Choudhary': { degree: '3rd+', mutuals: '' },
  'Chris Basile': { degree: '2nd', mutuals: 'Lauren Ludlow; Dave Zimmerman; +1 other' },
  'Benjamin Johnson': { degree: '3rd+', mutuals: '' },

  // Flatworld Solutions
  'Jacob William': { degree: '3rd+', mutuals: '' },

  // Focus Services
  'Bill Wiser': { degree: '3rd+', mutuals: '' },
  'Bracken Mayes': { degree: '3rd+', mutuals: '' },
  'Kenneth Loggins': { degree: '3rd+', mutuals: '' },

  // Global Contact Service International
  'Greg Alcorn': { degree: '2nd', mutuals: 'Mark Escueta' },

  // Harte Hanks (Note: Alice has 1st-degree connections who are FORMER Harte Hanks employees: DJ Winter, Ben Manashe, Robin Adair)
  'David Fisher': { degree: '3rd+', mutuals: '' },

  // Helpware
  'Nanette Harrell': { degree: '3rd+', mutuals: '' },

  // Hugo Technologies
  'Emily Slota': { degree: '3rd+', mutuals: '' },

  // Infocision
  'Craig Taylor': { degree: '3rd+', mutuals: '' },
  'Gary Taylor': { degree: '3rd+', mutuals: '' },
  'Steve Boyazis': { degree: '2nd', mutuals: 'William Uppington; John Horsley; +15 others' },
  'Michael White': { degree: '3rd+', mutuals: '' },
  'Johanna McCaskill': { degree: '3rd+', mutuals: '' },

  // KM² Solutions
  'David Kreiss': { degree: '3rd+', mutuals: '' },
  'Rodd Furlough': { degree: '3rd+', mutuals: '' },
  'Michelle Pittsenbarger': { degree: '3rd+', mutuals: '' },

  // Liveops
  'Jim Watson': { degree: '2nd', mutuals: 'Dave Boyce' },
  'Curt Cornum': { degree: '3rd+', mutuals: '' },
  'Michelle Winnett': { degree: '3rd+', mutuals: '' },

  // MarketStar
  'Justin Nalder': { degree: '3rd+', mutuals: '' },

  // NexRep
  'Matthew Fisher': { degree: '3rd+', mutuals: '' },
  'Kevin Welch': { degree: '3rd+', mutuals: '' },
  'Stephanie Anthony': { degree: '3rd+', mutuals: '' },

  // Office Beacon
  'Hemal Mewada': { degree: '2nd', mutuals: 'Pritesh Vora' },

  // Percepta
  'Thomas Monaghan': { degree: '3rd+', mutuals: '' },

  // SupportNinja
  'Omeed Jafari': { degree: '3rd+', mutuals: '' },

  // SupportYourApp
  'Petro Bondarevskyi': { degree: '3rd+', mutuals: '' },

  // The Office Gurus
  'Dominic Leide': { degree: '2nd', mutuals: 'Dave Zimmerman; Alan Bowman' },

  // UnifyCX
  'Vidya Ravichandran': { degree: '3rd+', mutuals: '' },

  // Valor Global
  'Joseph DeWoody': { degree: '3rd+', mutuals: '' },
  'Jim Radzicki': { degree: '3rd+', mutuals: '' },

  // Visaya KPO
  'Butch Valenzuela': { degree: '2nd', mutuals: 'Dave Boyce; Ali Paterson; +2 others' },
  'Maria L. Valenzuela': { degree: '3rd+', mutuals: '' },
}

const csvContent = fs.readFileSync(INPUT_PATH, 'utf-8')
const records = parse(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true })

// Get original column names from first record
const originalColumns = Object.keys(records[0])

// Find the connection columns (they may be truncated)
const firstDegCol = originalColumns.find(c => c.startsWith('First Degree Connection'))
const secondDegCol = originalColumns.find(c => c.startsWith('Second Degree Connection'))

if (!firstDegCol || !secondDegCol) {
  console.error('Could not find connection columns!')
  console.error('Columns found:', originalColumns)
  process.exit(1)
}

console.log(`First degree column: "${firstDegCol}"`)
console.log(`Second degree column: "${secondDegCol}"`)

const updatedRecords = records.map((row: Record<string, string>) => {
  const fullName = row['Full Name']?.trim()
  const info = connectionData[fullName]

  if (info) {
    row[firstDegCol] = info.degree === '2nd' ? 'No' :
                       info.degree === '3rd+' ? 'No' :
                       info.degree === 'No URL' ? 'No URL provided' :
                       'Not checked'
    row[secondDegCol] = info.degree === '2nd' ? (info.mutuals || 'Yes (mutual connections not listed)') :
                        info.degree === '3rd+' ? 'None (3rd+ degree)' :
                        info.degree === 'No URL' ? '' :
                        'Not checked'
  }

  return row
})

const output = stringify(updatedRecords, { header: true, columns: originalColumns })
fs.writeFileSync(OUTPUT_PATH, output)

console.log(`\nOutput written to: ${OUTPUT_PATH}`)
console.log(`Total contacts: ${updatedRecords.length}`)

// Summary
const checked = Object.values(connectionData).filter(v => v.degree !== 'Not checked' && v.degree !== 'No URL')
const second = Object.entries(connectionData).filter(([_, v]) => v.degree === '2nd')
const third = Object.entries(connectionData).filter(([_, v]) => v.degree === '3rd+')
const notChecked = Object.entries(connectionData).filter(([_, v]) => v.degree === 'Not checked')
const noUrl = Object.entries(connectionData).filter(([_, v]) => v.degree === 'No URL')

console.log(`\n=== SUMMARY ===`)
console.log(`Profiles checked: ${checked.length}`)
console.log(`2nd degree connections: ${second.length}`)
second.forEach(([name, info]) => {
  console.log(`  → ${name}: mutuals = ${info.mutuals || '(none listed)'}`)
})
console.log(`\n3rd+ degree (no mutual connections): ${third.length}`)
third.forEach(([name]) => {
  console.log(`  → ${name}`)
})
console.log(`\nNo LinkedIn URL: ${noUrl.length}`)
noUrl.forEach(([name]) => {
  console.log(`  → ${name}`)
})
console.log(`\nNot yet checked: ${notChecked.length}`)
notChecked.forEach(([name]) => {
  console.log(`  → ${name}`)
})
console.log(`\nNOTE: None of the 47 contacts are 1st-degree connections of Alice Wyatt.`)
console.log(`This was verified via company-level LinkedIn search with 1st-degree network filter.`)
