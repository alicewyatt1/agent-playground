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
const CALANTHIA_JSON = path.resolve(__dirname, '../data/calanthia-connections.json')

// Calanthia's LinkedIn session cookies (fresh)
const LI_AT = 'AQEDAQUEEQsDYZSSAAABnE7JRe8AAAGcctXJ704AizgkP5aBWcYaYVD75V_XkPxa1MGyDQvPjme2goGfHZdTlCVdh7IjDfbrTn13uSV-kDO-0Hyla4eCRoNDEPoDrJk14_fnNXY8Z1eRN6PUp_hAzAGm'
const JSESSIONID = 'ajax:7462629405712052681'

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

// Same approach as Alice's working script
async function getProfileDegree(slug: string): Promise<{ degree: string }> {
  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${slug}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-19`
  try {
    const resp = await fetch(url, { headers: HEADERS })
    if (!resp.ok) return { degree: 'error' }
    const data = await resp.json() as any
    const elem = data?.elements?.[0]
    if (!elem) return { degree: 'unknown' }
    const rel = elem.memberRelationship?.memberRelationshipUnion
    if (!rel) return { degree: 'unknown' }
    if (rel.connection) return { degree: '1st' }
    if (rel.noConnection) return { degree: distanceToLabel(rel.noConnection.memberDistance || 'unknown') }
    return { degree: 'unknown' }
  } catch {
    return { degree: 'error' }
  }
}

async function getMutualConnections(slug: string): Promise<{ names: string[], text: string }> {
  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${slug}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-135`
  try {
    const resp = await fetch(url, { headers: HEADERS })
    if (!resp.ok) return { names: [], text: '' }
    const data = await resp.json() as any
    const elem = data?.elements?.[0]
    if (!elem) return { names: [], text: '' }
    const insight = elem.profileInsight?.elements?.[0]
    if (!insight) return { names: [], text: '' }
    const text = insight.text?.text || ''
    if (!text.includes('mutual connection')) return { names: [], text: '' }
    const attrs = insight.insightImage?.attributes || []
    const names = attrs
      .map((a: any) => a?.detailData?.profilePicture?.profilePicture?.a11yText || '')
      .filter((n: string) => n.length > 0)
    return { names, text }
  } catch {
    return { names: [], text: '' }
  }
}

async function main() {
  console.log('=== Checking connections from Calanthia\'s account ===\n')

  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })

  console.log(`Processing ${records.length} profiles...\n`)

  // ─── Phase 1: Connection degrees (same settings as Alice's working script) ───
  console.log('--- Phase 1: Connection degrees ---\n')
  const results: Record<string, ConnectionResult> = {}
  let firstDegreeCount = 0
  // Load existing results so we can resume from where we left off
  if (fs.existsSync(CALANTHIA_JSON)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CALANTHIA_JSON, 'utf-8'))
      Object.assign(results, existing)
    } catch { /* start fresh */ }
  }

  // Sequential, 1 at a time with 2s delay to avoid rate limiting
  const DELAY = 2000

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const linkedinUrl = (row['LinkedIn Profile'] || '').trim()
    const slug = extractSlug(linkedinUrl)
    const name = (row['Full Name'] || '').trim()

    if (!slug) {
      results[linkedinUrl] = { degree: 'n/a', mutualConnections: [] }
      continue
    }

    // Skip if we already have valid (non-error) data
    const existing = results[linkedinUrl]
    if (existing && existing.degree !== 'error') {
      if (existing.degree === '1st') firstDegreeCount++
      continue
    }

    const { degree } = await getProfileDegree(slug)
    results[linkedinUrl] = { degree, mutualConnections: [] }
    if (degree === '1st') firstDegreeCount++
    const icon = degree === '1st' ? '⭐' : degree === '2nd' ? '🔗' : '·'
    console.log(`  ${icon} ${name} → ${degree}`)

    // Save every 20 profiles
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(CALANTHIA_JSON, JSON.stringify(results, null, 2))
      console.log(`  [Saved: ${i + 1}/${records.length}]`)
    }

    await new Promise(r => setTimeout(r, DELAY))
  }

  fs.writeFileSync(CALANTHIA_JSON, JSON.stringify(results, null, 2))
  console.log(`\n1st degree: ${firstDegreeCount}`)

  // ─── Phase 2: Mutual connections for 2nd degree profiles ───
  const secondDegree = Object.entries(results).filter(([_, v]) => v.degree === '2nd')
  console.log(`\n--- Phase 2: Mutual connections for ${secondDegree.length} 2nd-degree profiles ---\n`)

  let withMutual = 0
  for (let i = 0; i < secondDegree.length; i++) {
    const [url, data] = secondDegree[i]
    // Skip if already has mutual connections data
    if (data.mutualConnections.length > 0) { withMutual++; continue }
    const slug = extractSlug(url)
    if (!slug) continue
    const { names, text } = await getMutualConnections(slug)
    if (names.length > 0) {
      data.mutualConnections = names
      withMutual++
      console.log(`  ✓ ${slug}: ${text}`)
    }
    await new Promise(r => setTimeout(r, DELAY))
  }

  fs.writeFileSync(CALANTHIA_JSON, JSON.stringify(results, null, 2))

  // ─── Phase 3: Apply to CSV ───
  console.log('\n--- Phase 3: Applying to CSV ---\n')
  for (const row of records) {
    const linkedinUrl = (row['LinkedIn Profile'] || '').trim()
    const conn = results[linkedinUrl]
    if (conn && conn.degree === '1st') {
      row['Calanthia First Degree Connection'] = 'Yes'
    } else {
      row['Calanthia First Degree Connection'] = ''
    }
    if (conn && conn.mutualConnections.length > 0) {
      row['Calanthia Second Degree Connections'] = conn.mutualConnections.join('; ')
    } else {
      row['Calanthia Second Degree Connections'] = ''
    }
  }

  const columns = Object.keys(records[0])
  const output = stringify(records, { header: true, columns })
  fs.writeFileSync(CSV_PATH, output)

  const firstDeg = Object.values(results).filter(v => v.degree === '1st').length
  const errors = Object.values(results).filter(v => v.degree === 'error').length
  console.log('═'.repeat(60))
  console.log('CALANTHIA CONNECTIONS SUMMARY')
  console.log('═'.repeat(60))
  console.log(`Total profiles: ${records.length}`)
  console.log(`Calanthia 1st degree: ${firstDeg}`)
  console.log(`With mutual connections: ${withMutual}`)
  console.log(`Errors: ${errors}`)
  console.log(`\nCSV updated: ${CSV_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main }
