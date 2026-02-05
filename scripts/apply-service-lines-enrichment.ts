import { config } from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

config()

interface ResearchResult {
  company_name: string
  website: string
  offers_outbound: boolean
  tags_to_add: string[]
  reasoning?: string
  evidence?: string
}

interface Account {
  company_name: string
  service_lines: string
  [key: string]: string
}

async function main() {
  // Load research results from both files
  const researchResults1: ResearchResult[] = JSON.parse(
    fs.readFileSync('data/research-results.json', 'utf-8')
  )
  const researchResults2: ResearchResult[] = JSON.parse(
    fs.readFileSync('data/research-remaining-results.json', 'utf-8')
  )

  // Combine and build a map of company -> tags to add
  const tagsToAddMap = new Map<string, string[]>()
  
  for (const result of [...researchResults1, ...researchResults2]) {
    if (result.tags_to_add && result.tags_to_add.length > 0) {
      const existing = tagsToAddMap.get(result.company_name) || []
      // Merge and dedupe
      const merged = [...new Set([...existing, ...result.tags_to_add])]
      tagsToAddMap.set(result.company_name, merged)
    }
  }

  console.log(`Found ${tagsToAddMap.size} companies with service lines to add`)

  // Load the master CSV
  const csvPath = 'data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03).csv'
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })

  console.log(`Loaded ${records.length} accounts from master CSV`)

  // Track changes
  const changes: { company: string; oldTags: string; addedTags: string[]; newTags: string }[] = []

  // Apply enrichment
  for (const record of records) {
    const tagsToAdd = tagsToAddMap.get(record.company_name)
    if (tagsToAdd) {
      const oldServiceLines = record.service_lines || ''
      const existingTags = oldServiceLines
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      // Find tags that are actually new
      const newTags = tagsToAdd.filter(tag => 
        !existingTags.some(existing => 
          existing.toLowerCase() === tag.toLowerCase()
        )
      )

      if (newTags.length > 0) {
        // Append new tags
        const updatedTags = [...existingTags, ...newTags]
        record.service_lines = updatedTags.join(', ')
        
        changes.push({
          company: record.company_name,
          oldTags: oldServiceLines,
          addedTags: newTags,
          newTags: record.service_lines
        })
      }
    }
  }

  console.log(`\nApplied enrichment to ${changes.length} accounts`)

  // Write updated CSV
  const outputPath = 'data/Final - Global Contact Center Market Map - Full List with 215 Qualified (2025-02-03) - SERVICE-LINES-ENRICHED.csv'
  const output = stringify(records, { header: true })
  fs.writeFileSync(outputPath, output)
  console.log(`\nWrote enriched CSV to: ${outputPath}`)

  // Print summary of changes
  console.log('\n=== Changes Applied ===')
  for (const change of changes.slice(0, 30)) {
    console.log(`\n${change.company}:`)
    console.log(`  Added: ${change.addedTags.join(', ')}`)
  }
  
  if (changes.length > 30) {
    console.log(`\n... and ${changes.length - 30} more companies`)
  }

  // Save changes log
  fs.writeFileSync(
    'data/service-lines-enrichment-changes.json',
    JSON.stringify(changes, null, 2)
  )
  console.log(`\nSaved changes log to: data/service-lines-enrichment-changes.json`)
}

main().catch(console.error)
