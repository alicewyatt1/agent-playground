import { config } from 'dotenv'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import fs from 'fs'

config()

// Load enrichment data
const qualifiedEnrichment = JSON.parse(fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/size-enrichment-final-complete.json', 'utf-8'))
const nonQualifiedEnrichment = JSON.parse(fs.readFileSync('/Users/alicewyatt/repos/agent-playground/data/non-qualified-enrichment-results.json', 'utf-8'))

// Build a map of company name to new size
const sizeMap = new Map<string, { newSize: string, researched: string, source: string }>()

// From qualified enrichment
for (const update of qualifiedEnrichment.updates) {
  if (update.new_size && update.new_size !== 'N/A') {
    // Convert to the format used in CSV
    let formattedSize = ''
    switch (update.new_size) {
      case 'SME':
        formattedSize = 'SME (1–1,000 employees)'
        break
      case 'Mid Market':
        formattedSize = 'Mid Market (1,000–5,000 employees)'
        break
      case 'Enterprise':
        formattedSize = 'Enterprise (5,000+ employees)'
        break
      case 'Super Enterprise':
        formattedSize = 'Super Enterprise (50,000+ employees)'
        break
      default:
        formattedSize = update.new_size
    }
    
    sizeMap.set(update.company_name, {
      newSize: formattedSize,
      researched: update.researched_count,
      source: update.source
    })
  }
}

// From non-qualified: category changes
for (const change of nonQualifiedEnrichment.category_changes) {
  if (change.new_size) {
    let formattedSize = ''
    switch (change.new_size) {
      case 'SME':
        formattedSize = 'SME (1–1,000 employees)'
        break
      case 'Mid Market':
        formattedSize = 'Mid Market (1,000–5,000 employees)'
        break
      case 'Enterprise':
        formattedSize = 'Enterprise (5,000+ employees)'
        break
      case 'Super Enterprise':
        formattedSize = 'Super Enterprise (50,000+ employees)'
        break
      default:
        formattedSize = change.new_size
    }
    
    sizeMap.set(change.company_name, {
      newSize: formattedSize,
      researched: change.researched_count,
      source: change.source
    })
  }
}

// From non-qualified: mid_market_confirmed (keep their current size)
for (const item of nonQualifiedEnrichment.mid_market_confirmed) {
  if (item.new_size) {
    let formattedSize = ''
    switch (item.new_size) {
      case 'SME':
        formattedSize = 'SME (1–1,000 employees)'
        break
      case 'Mid Market':
        formattedSize = 'Mid Market (1,000–5,000 employees)'
        break
      case 'Enterprise':
        formattedSize = 'Enterprise (5,000+ employees)'
        break
      case 'Super Enterprise':
        formattedSize = 'Super Enterprise (50,000+ employees)'
        break
      default:
        formattedSize = item.new_size
    }
    
    sizeMap.set(item.company_name, {
      newSize: formattedSize,
      researched: item.researched_count || 'N/A',
      source: item.source || 'N/A'
    })
  }
}

// From non-qualified: unknown_to_sme
for (const item of nonQualifiedEnrichment.unknown_to_sme) {
  sizeMap.set(item.company_name, {
    newSize: 'SME (1–1,000 employees)',
    researched: 'Estimated',
    source: item.source
  })
}

console.log(`Loaded ${sizeMap.size} size updates from enrichment data`)

// Read the source CSV
const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List 2026 (2).csv'
const csvContent = fs.readFileSync(csvPath, 'utf-8')

const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true
})

console.log(`Read ${records.length} records from CSV`)

// Track changes
let changesApplied = 0
const changeLog: Array<{ company: string, oldSize: string, newSize: string }> = []

// Apply updates
for (const record of records) {
  const update = sizeMap.get(record.company_name)
  if (update) {
    const oldSize = record.size_employee_count
    if (oldSize !== update.newSize) {
      changeLog.push({
        company: record.company_name,
        oldSize: oldSize,
        newSize: update.newSize
      })
      record.size_employee_count = update.newSize
      changesApplied++
    }
  }
}

console.log(`\nApplied ${changesApplied} size changes`)

// Get headers from first record
const headers = Object.keys(records[0])

// Write to new file
const outputPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List 2026 (ENRICHED).csv'
const output = stringify(records, { header: true, columns: headers })
fs.writeFileSync(outputPath, output)

console.log(`\nWrote enriched data to: ${outputPath}`)

// Show sample of changes
console.log('\n=== SAMPLE OF CHANGES APPLIED ===\n')
for (const change of changeLog.slice(0, 20)) {
  console.log(`${change.company}`)
  console.log(`  ${change.oldSize} → ${change.newSize}`)
  console.log('')
}

if (changeLog.length > 20) {
  console.log(`... and ${changeLog.length - 20} more changes`)
}

// Summary by change type
const changeSummary: Record<string, number> = {}
for (const change of changeLog) {
  const key = `${change.oldSize} → ${change.newSize}`
  changeSummary[key] = (changeSummary[key] || 0) + 1
}

console.log('\n=== CHANGE SUMMARY ===\n')
for (const [change, count] of Object.entries(changeSummary).sort((a, b) => b[1] - a[1])) {
  console.log(`${change}: ${count}`)
}
