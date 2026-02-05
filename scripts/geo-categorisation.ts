import { config } from 'dotenv'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import fs from 'fs'

config()

// US States list for matching onshore delivery footprint
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia', 'Puerto Rico'
]

interface Account {
  company_name: string
  company_hq: string
  size_employee_count: string
  onshore_delivery_footprint: string
  nearshore_delivery_footprint: string
  offshore_delivery_footprint: string
  [key: string]: string
}

function isUSHQ(hq: string): boolean {
  if (!hq) return false
  const normalized = hq.trim().toLowerCase()
  // Check for "United States" or variations, including "City, United States" format
  return normalized === 'united states' || 
         normalized === 'us' || 
         normalized === 'usa' ||
         normalized.endsWith(', united states') ||
         normalized.endsWith(' united states')
}

function hasUSOnshoreDelivery(onshore: string): boolean {
  if (!onshore) return false
  
  // Check for explicit "United States"
  if (/\bUnited States\b/i.test(onshore)) return true
  
  // Check for any US state name
  for (const state of US_STATES) {
    const regex = new RegExp(`\\b${state}\\b`, 'i')
    if (regex.test(onshore)) return true
  }
  return false
}

function hasUSInDelivery(onshore: string, nearshore: string, offshore: string): boolean {
  // Check onshore for US states or "United States"
  if (hasUSOnshoreDelivery(onshore)) return true
  
  // Check nearshore for "United States"
  if (nearshore && /\bUnited States\b/i.test(nearshore)) return true
  
  // Check offshore for "United States"
  if (offshore && /\bUnited States\b/i.test(offshore)) return true
  
  return false
}

function hasCountryPresence(country: string, hq: string, onshore: string, nearshore: string, offshore: string): boolean {
  const regex = new RegExp(`\\b${country}\\b`, 'i')
  
  return regex.test(hq || '') || 
         regex.test(onshore || '') || 
         regex.test(nearshore || '') || 
         regex.test(offshore || '')
}

function getGeoSegments(account: Account): string[] {
  const segments: string[] = []
  
  const hq = account.company_hq || ''
  const onshore = account.onshore_delivery_footprint || ''
  const nearshore = account.nearshore_delivery_footprint || ''
  const offshore = account.offshore_delivery_footprint || ''
  
  const usHQ = isUSHQ(hq)
  const usOnshore = hasUSOnshoreDelivery(onshore)
  const usDeliveryAnywhere = hasUSInDelivery(onshore, nearshore, offshore)
  
  // Segment 1: HQ is US, but NO US onshore delivery
  // Segment 2: HQ is US AND has US onshore delivery
  if (usHQ) {
    if (usOnshore) {
      segments.push('Segment 2')
    } else {
      segments.push('Segment 1')
    }
  }
  
  // Segment 3: HQ is NOT US but has US delivery (onshore, nearshore, or offshore)
  if (!usHQ && usDeliveryAnywhere) {
    segments.push('Segment 3')
  }
  
  // Segment 4: Mexico in any of HQ, onshore, nearshore, offshore
  if (hasCountryPresence('Mexico', hq, onshore, nearshore, offshore)) {
    segments.push('Segment 4')
  }
  
  // Segment 5: Philippines in any of HQ, onshore, nearshore, offshore
  if (hasCountryPresence('Philippines', hq, onshore, nearshore, offshore)) {
    segments.push('Segment 5')
  }
  
  return segments
}

async function main() {
  const csvPath = '/Users/alicewyatt/Downloads/Qualified list - Full qualified list.csv'
  
  console.log('Reading CSV...')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  
  const records: Account[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  })
  
  console.log(`Total accounts in CSV: ${records.length}`)
  
  // Filter to Mid Market only
  const midMarketAccounts = records.filter(r => 
    r.size_employee_count?.includes('Mid Market')
  )
  
  console.log(`Mid Market accounts: ${midMarketAccounts.length}`)
  
  // Process each account and add geo categorisation
  const results: Array<Account & { geo_categorisation: string }> = []
  
  // Stats tracking
  const segmentCounts: Record<string, number> = {
    'Segment 1': 0,
    'Segment 2': 0,
    'Segment 3': 0,
    'Segment 4': 0,
    'Segment 5': 0,
    'No Segments': 0
  }
  
  for (const account of midMarketAccounts) {
    const segments = getGeoSegments(account)
    const geoCategorisation = segments.length > 0 ? segments.join(', ') : ''
    
    results.push({
      ...account,
      geo_categorisation: geoCategorisation
    })
    
    // Track stats
    if (segments.length === 0) {
      segmentCounts['No Segments']++
    } else {
      for (const seg of segments) {
        segmentCounts[seg]++
      }
    }
  }
  
  // Print summary
  console.log('\n=== SEGMENT DISTRIBUTION ===')
  console.log(`Segment 1 (US HQ, no US onshore): ${segmentCounts['Segment 1']}`)
  console.log(`Segment 2 (US HQ + US onshore): ${segmentCounts['Segment 2']}`)
  console.log(`Segment 3 (Non-US HQ, US delivery): ${segmentCounts['Segment 3']}`)
  console.log(`Segment 4 (Mexico presence): ${segmentCounts['Segment 4']}`)
  console.log(`Segment 5 (Philippines presence): ${segmentCounts['Segment 5']}`)
  console.log(`No Segments: ${segmentCounts['No Segments']}`)
  
  // Show sample of each segment
  console.log('\n=== SAMPLE ACCOUNTS BY SEGMENT ===\n')
  
  for (const segmentName of ['Segment 1', 'Segment 2', 'Segment 3', 'Segment 4', 'Segment 5']) {
    const samples = results.filter(r => r.geo_categorisation.includes(segmentName)).slice(0, 3)
    console.log(`--- ${segmentName} (showing up to 3 samples) ---`)
    for (const sample of samples) {
      console.log(`  ${sample.company_name}`)
      console.log(`    HQ: ${sample.company_hq}`)
      console.log(`    Onshore: ${sample.onshore_delivery_footprint || '(none)'}`)
      console.log(`    Nearshore: ${sample.nearshore_delivery_footprint || '(none)'}`)
      console.log(`    Offshore: ${sample.offshore_delivery_footprint || '(none)'}`)
      console.log(`    Geo: ${sample.geo_categorisation}`)
      console.log('')
    }
  }
  
  // Write output CSV
  const outputPath = '/Users/alicewyatt/Downloads/Qualified list - Mid Market with Geo Categorisation.csv'
  
  // Get all columns from first record, then add geo_categorisation at the end
  const columns = Object.keys(records[0]).concat(['geo_categorisation'])
  
  const csvOutput = stringify(results, {
    header: true,
    columns: columns
  })
  
  fs.writeFileSync(outputPath, csvOutput)
  console.log(`\nOutput written to: ${outputPath}`)
  console.log(`Total rows: ${results.length}`)
}

main().catch(console.error)
