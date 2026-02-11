import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

const INPUT_PATH = '/Users/alicewyatt/Downloads/For Clay - Priority list (MM).csv'
const OUTPUT_PATH = '/Users/alicewyatt/repos/agent-playground/data/priority-list-with-connections.csv'

// 1st-degree connections found on LinkedIn (current employees)
const firstDegreeConnections: Record<string, { name: string; role: string; status: 'current' | 'former' }[]> = {
  'CBE Companies': [
    { name: 'Albert Smothers, MBA, Ph.D.', role: 'Chief People Officer at CBE Companies', status: 'current' },
  ],
  'Contact Point 360': [
    { name: 'Ramesh Nair', role: 'Sr. Manager, Strategic Alliances & Growth at ContactPoint 360', status: 'current' },
  ],
  'Open Access BPO': [
    { name: 'Bobby Jusayan', role: 'Head of Talent Acquisition & Development at Open Access BPO', status: 'current' },
  ],
  'Sourcefit Philippines Inc.': [
    { name: 'Harris Ochoa', role: 'Director of Recruiting at Sourcefit', status: 'current' },
  ],
  // Former employees (still 1st-degree connections)
  'Harte Hanks': [
    { name: 'DJ Winter', role: 'Former VP, Business Development at Harte Hanks', status: 'former' },
    { name: 'Ben Manashe', role: 'Former Campaign Team Manager at Harte Hanks', status: 'former' },
    { name: 'Robin Adair', role: 'Former Sales Executive at Harte Hanks', status: 'former' },
  ],
  'Quantanite': [
    { name: 'Bazil Bibikoff-Crowley', role: 'Former Senior Account Manager at Quantanite', status: 'former' },
  ],
}

const csvContent = fs.readFileSync(INPUT_PATH, 'utf-8')
const records = parse(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true })

const updatedRecords = records.map((row: Record<string, string>) => {
  const companyName = row['company_name']?.trim()
  const connections = firstDegreeConnections[companyName]

  if (connections) {
    const currentConnections = connections.filter(c => c.status === 'current')
    const formerConnections = connections.filter(c => c.status === 'former')

    const allNames = connections.map(c => c.name).join('; ')
    const allRoles = connections.map(c => c.role).join('; ')
    const hasCurrentConnection = currentConnections.length > 0 ? 'Yes' : 'Former only'

    return {
      ...row,
      'LinkedIn 1st Degree Connection?': hasCurrentConnection,
      'Connection Name(s)': allNames,
      'Connection Role(s)': allRoles,
    }
  }

  return {
    ...row,
    'LinkedIn 1st Degree Connection?': 'No',
    'Connection Name(s)': '',
    'Connection Role(s)': '',
  }
})

const columns = Object.keys(updatedRecords[0])
const output = stringify(updatedRecords, { header: true, columns })
fs.writeFileSync(OUTPUT_PATH, output)

console.log(`\nOutput written to: ${OUTPUT_PATH}`)
console.log(`Total accounts: ${updatedRecords.length}`)

const withCurrent = updatedRecords.filter((r: Record<string, string>) => r['LinkedIn 1st Degree Connection?'] === 'Yes')
const withFormer = updatedRecords.filter((r: Record<string, string>) => r['LinkedIn 1st Degree Connection?'] === 'Former only')

console.log(`\nAccounts with CURRENT 1st-degree connections: ${withCurrent.length}`)
withCurrent.forEach((r: Record<string, string>) => {
  console.log(`  ✓ ${r['company_name']} → ${r['Connection Name(s)']} (${r['Connection Role(s)']})`)
})

console.log(`\nAccounts with FORMER employee 1st-degree connections: ${withFormer.length}`)
withFormer.forEach((r: Record<string, string>) => {
  console.log(`  ~ ${r['company_name']} → ${r['Connection Name(s)']} (${r['Connection Role(s)']})`)
})

console.log(`\nAccounts with NO 1st-degree connections: ${updatedRecords.length - withCurrent.length - withFormer.length}`)
