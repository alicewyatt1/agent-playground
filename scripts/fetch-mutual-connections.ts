import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONNECTIONS_PATH = path.resolve(__dirname, '../data/linkedin-connections.json')

// LinkedIn session cookies
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
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/]+)\/?/)
  return match ? match[1] : ''
}

function parseMutualText(text: string): string[] {
  // Parse "Stacy Lustgarten, Annie Dabrowski, and 1 other mutual connection"
  // or "Michael Hanson and Stephen Farndale are mutual connections"
  // Returns the named connections
  if (!text) return []

  // Remove the trailing patterns
  const cleaned = text
    .replace(/,?\s*and\s+\d+\s+other\s+mutual\s+connections?/i, '')
    .replace(/\s+are\s+mutual\s+connections?/i, '')
    .replace(/\s+is\s+a\s+mutual\s+connection/i, '')

  // Split by comma and "and"
  const names = cleaned
    .split(/,\s*|\s+and\s+/)
    .map(n => n.trim())
    .filter(n => n.length > 0 && n !== 'other')

  return names
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

    // Extract names from image attributes
    const attrs = insight.insightImage?.attributes || []
    const imageNames = attrs
      .map((a: any) => a?.detailData?.profilePicture?.profilePicture?.a11yText || '')
      .filter((n: string) => n.length > 0)

    // Also parse from text
    const textNames = parseMutualText(text)

    // Use image names if available (more reliable), fall back to text parsing
    const names = imageNames.length > 0 ? imageNames : textNames

    return { names, text }
  } catch {
    return { names: [], text: '' }
  }
}

async function main() {
  console.log('Reading existing connections data...')
  const connections: Record<string, ConnectionResult> = JSON.parse(
    fs.readFileSync(CONNECTIONS_PATH, 'utf-8')
  )

  // Find 2nd degree profiles that need mutual connection checks
  const secondDegree = Object.entries(connections).filter(
    ([_, v]) => v.degree === '2nd'
  )

  console.log(`Found ${secondDegree.length} 2nd degree profiles to check for mutual connections\n`)

  let withMutual = 0
  let processed = 0
  const BATCH_SIZE = 5
  const DELAY = 1000

  for (let i = 0; i < secondDegree.length; i += BATCH_SIZE) {
    const batch = secondDegree.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async ([url, data]) => {
      const slug = extractSlug(url)
      if (!slug) return

      const { names, text } = await getMutualConnections(slug)

      if (names.length > 0 || text) {
        data.mutualConnections = names
        withMutual++
        console.log(`  ✓ ${slug}: ${text || names.join(', ')}`)
      } else {
        console.log(`  · ${slug}: no mutual connections`)
      }
    })

    await Promise.all(promises)
    processed += batch.length

    // Save progress every 20 profiles
    if (processed % 20 === 0 || processed === secondDegree.length) {
      fs.writeFileSync(CONNECTIONS_PATH, JSON.stringify(connections, null, 2))
      console.log(`  [Saved: ${processed}/${secondDegree.length}]`)
    }

    if (i + BATCH_SIZE < secondDegree.length) {
      await new Promise(r => setTimeout(r, DELAY))
    }
  }

  // Final save
  fs.writeFileSync(CONNECTIONS_PATH, JSON.stringify(connections, null, 2))

  console.log('\n' + '═'.repeat(60))
  console.log('MUTUAL CONNECTIONS CHECK SUMMARY')
  console.log('═'.repeat(60))
  console.log(`Profiles checked: ${processed}`)
  console.log(`With mutual connections: ${withMutual}`)
  console.log(`\nResults saved to: ${CONNECTIONS_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main }
