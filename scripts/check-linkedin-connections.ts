import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_PATH = path.resolve(__dirname, '../data/people-contacts-enriched.csv')
const OUTPUT_PATH = path.resolve(__dirname, '../data/linkedin-connections.json')

// LinkedIn session cookies from browser
const LI_AT = 'AQEDARK1uxsBno8VAAABnEg59RIAAAGcbEZ5Ek0AXopoLgZYHvq-GD5DXsiC0aCaC79cpP-cLsw7gQvpdpaWHHuZhtveH5BeYKo6JdWwpZxe77W24WZ2hcGO6bZDsQK6z7H1-3f7FBfjagEOOQORJuby'
const JSESSIONID = 'ajax:8482393182245311582'

const HEADERS = {
  'cookie': `li_at=${LI_AT}; JSESSIONID="${JSESSIONID}"`,
  'csrf-token': JSESSIONID,
  'x-restli-protocol-version': '2.0.0',
  'x-li-lang': 'en_US',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

interface ConnectionResult {
  degree: string
  mutualConnections: string[]
}

function extractSlug(linkedinUrl: string): string {
  // Extract the profile slug from a LinkedIn URL
  // e.g., https://www.linkedin.com/in/josh-gordon-863631/ -> josh-gordon-863631
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/]+)\/?/)
  return match ? match[1] : ''
}

function distanceToLabel(distance: string): string {
  switch (distance) {
    case 'DISTANCE_1': return '1st'
    case 'DISTANCE_2': return '2nd'
    case 'DISTANCE_3': return '3rd+'
    default: return distance
  }
}

async function getProfileDegree(slug: string): Promise<{ degree: string; firstName: string; lastName: string }> {
  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${slug}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-19`
  
  const resp = await fetch(url, { headers: HEADERS })
  if (!resp.ok) {
    return { degree: 'error', firstName: '', lastName: '' }
  }
  
  const data = await resp.json() as any
  const elem = data?.elements?.[0]
  if (!elem) return { degree: 'unknown', firstName: '', lastName: '' }
  
  const firstName = elem.firstName || ''
  const lastName = elem.lastName || ''
  
  const rel = elem.memberRelationship?.memberRelationshipUnion
  if (!rel) return { degree: 'unknown', firstName, lastName }
  
  // Check if 1st degree connection
  if (rel.connection) {
    return { degree: '1st', firstName, lastName }
  }
  
  // Check noConnection for distance
  if (rel.noConnection) {
    const dist = rel.noConnection.memberDistance || 'unknown'
    return { degree: distanceToLabel(dist), firstName, lastName }
  }
  
  return { degree: 'unknown', firstName, lastName }
}

async function getMutualConnections(slug: string): Promise<string[]> {
  // Try to get mutual connections from the profile's shared connections
  // Using the v2 API endpoint
  const url = `https://www.linkedin.com/voyager/api/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-174&origin=SHARED_CONNECTIONS&q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:network,value:List(F,S)),(key:connectionOf,value:List(${slug})),(key:resultType,value:List(PEOPLE))))&start=0&count=10`
  
  try {
    const resp = await fetch(url, { headers: HEADERS })
    if (!resp.ok) return []
    
    const data = await resp.json() as any
    // Parse mutual connections from search results
    // This is a fallback - may not work with all API versions
    return []
  } catch {
    return []
  }
}

async function getSharedConnectionsViaProfile(slug: string): Promise<string[]> {
  // Alternative: use the relationship endpoint
  const url = `https://www.linkedin.com/voyager/api/identity/profiles/${slug}/sharedConnections?count=20`
  
  try {
    const resp = await fetch(url, { headers: HEADERS })
    if (!resp.ok) return []
    
    const data = await resp.json() as any
    const elements = data?.elements || []
    return elements.map((e: any) => {
      const fn = e.miniProfile?.firstName || ''
      const ln = e.miniProfile?.lastName || ''
      return `${fn} ${ln}`.trim()
    }).filter((n: string) => n.length > 0)
  } catch {
    return []
  }
}

async function main() {
  console.log('Reading CSV...')
  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
  
  console.log(`Processing ${records.length} profiles...\n`)
  
  const results: Record<string, ConnectionResult> = {}
  let processed = 0
  let firstDegreeCount = 0
  let withMutualCount = 0
  
  // Process in batches to avoid rate limiting
  const BATCH_SIZE = 5
  const DELAY_BETWEEN_BATCHES = 1000 // 1 second
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    
    const batchPromises = batch.map(async (row) => {
      const linkedinUrl = (row['LinkedIn Profile'] || '').trim()
      const slug = extractSlug(linkedinUrl)
      const name = (row['Full Name'] || '').trim()
      
      if (!slug) {
        console.log(`  ⚠ No LinkedIn URL for ${name}`)
        results[linkedinUrl] = { degree: 'n/a', mutualConnections: [] }
        return
      }
      
      try {
        // Get connection degree
        const { degree } = await getProfileDegree(slug)
        
        // Get mutual connections for 2nd degree contacts
        let mutualConnections: string[] = []
        if (degree === '2nd') {
          mutualConnections = await getSharedConnectionsViaProfile(slug)
        }
        
        results[linkedinUrl] = { degree, mutualConnections }
        
        const mutualStr = mutualConnections.length > 0
          ? ` | Mutual: ${mutualConnections.join(', ')}`
          : ''
        
        if (degree === '1st') firstDegreeCount++
        if (mutualConnections.length > 0) withMutualCount++
        
        const icon = degree === '1st' ? '⭐' : degree === '2nd' ? '🔗' : '·'
        console.log(`  ${icon} ${name} → ${degree}${mutualStr}`)
      } catch (err) {
        console.log(`  ✗ Error for ${name}: ${err}`)
        results[linkedinUrl] = { degree: 'error', mutualConnections: [] }
      }
    })
    
    await Promise.all(batchPromises)
    processed += batch.length
    
    // Save progress every 20 profiles
    if (processed % 20 === 0 || processed === records.length) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))
      console.log(`  [Saved progress: ${processed}/${records.length}]`)
    }
    
    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < records.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES))
    }
  }
  
  // Final save
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))
  
  console.log('\n' + '═'.repeat(60))
  console.log('LINKEDIN CONNECTIONS CHECK SUMMARY')
  console.log('═'.repeat(60))
  console.log(`Total profiles checked: ${processed}`)
  console.log(`1st degree connections: ${firstDegreeCount}`)
  console.log(`Profiles with mutual connections: ${withMutualCount}`)
  console.log(`\nResults saved to: ${OUTPUT_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main }
