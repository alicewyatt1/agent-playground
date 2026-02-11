import { config } from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

config()

const CSV_PATH = 'data/top-contacts-enriched-with-gaps.csv'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Search Perplexity with linkedin.com domain filter.
 * Returns the citations array (real URLs found by search) + the response text.
 */
async function searchLinkedIn(
  query: string
): Promise<{ text: string; citations: string[] }> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            'Find the LinkedIn profile for the specified person. Return only their LinkedIn profile URL.',
        },
        { role: 'user', content: query },
      ],
      search_domain_filter: ['linkedin.com'],
      return_related_questions: false,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Perplexity ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await response.json()) as any
  const text = data.choices?.[0]?.message?.content || ''
  const citations: string[] = data.citations || []
  return { text, citations }
}

/**
 * Extract a linkedin.com/in/ URL from citations or response text.
 * Only trust citations (they are real URLs from search results).
 */
function extractLinkedInUrl(
  citations: string[],
  text: string,
  personName: string
): string | null {
  // First: look for linkedin.com/in/ URLs in citations (these are real)
  const linkedinCitations = citations.filter(
    (c) =>
      c.includes('linkedin.com/in/') && !c.includes('/posts/') && !c.includes('/pulse/')
  )

  if (linkedinCitations.length === 1) {
    return normalizeUrl(linkedinCitations[0])
  }

  if (linkedinCitations.length > 1) {
    // Multiple matches -- try to pick the one most likely for this person
    const nameParts = personName
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .split(' ')
      .filter(Boolean)

    // Score each URL by how many name parts appear in it
    let best: string | null = null
    let bestScore = 0
    for (const url of linkedinCitations) {
      const slug = url.toLowerCase()
      let score = 0
      for (const part of nameParts) {
        if (slug.includes(part)) score++
      }
      if (score > bestScore) {
        bestScore = score
        best = url
      }
    }

    if (best && bestScore >= 1) {
      return normalizeUrl(best)
    }

    // Fall back to first one
    return normalizeUrl(linkedinCitations[0])
  }

  // Fallback: extract from response text (but only /in/ profile URLs)
  const urlMatch = text.match(
    /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i
  )
  if (urlMatch) {
    // Only trust it if it's a clean slug (not generated hex patterns)
    const slug = urlMatch[0].split('/in/')[1]?.replace('/', '')
    if (slug && !slug.match(/[0-9a-f]{8,}/)) {
      return normalizeUrl(urlMatch[0])
    }
  }

  return null
}

function normalizeUrl(url: string): string {
  let u = url.trim()
  if (!u.startsWith('https://')) {
    u = u.replace('http://', 'https://')
  }
  if (!u.includes('www.')) {
    u = u.replace('linkedin.com', 'www.linkedin.com')
  }
  if (!u.endsWith('/')) u += '/'
  return u
}

async function main() {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const records: Record<string, string>[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
  const headers = Object.keys(records[0])

  // Clear ALL existing LinkedIn URLs for Cursor contacts (start fresh)
  for (const r of records) {
    if (r['Source'] === 'Cursor') {
      r['LinkedIn Profile'] = ''
    }
  }

  const cursorContacts = records.filter((r) => r['Source'] === 'Cursor')

  console.log(
    `\n🔍 Searching LinkedIn for ${cursorContacts.length} contacts (citation-based)...\n`
  )

  let found = 0
  let notFound = 0

  for (let i = 0; i < cursorContacts.length; i++) {
    const contact = cursorContacts[i]
    const name = contact['Full Name'].replace(/"/g, '')
    const company = contact['Company Name']
    const title = contact['Job Title']

    process.stdout.write(
      `  [${i + 1}/${cursorContacts.length}] ${name} (${company})... `
    )

    try {
      const { text, citations } = await searchLinkedIn(
        `${name} ${title} ${company} LinkedIn profile`
      )

      const url = extractLinkedInUrl(citations, text, name)

      if (url) {
        contact['LinkedIn Profile'] = url
        found++
        console.log(`✅ ${url}`)
      } else {
        notFound++
        const citationInfo =
          citations.length > 0
            ? `(${citations.length} citations, none matched)`
            : '(no citations)'
        console.log(`❌ not found ${citationInfo}`)
      }

      await sleep(800)
    } catch (err: any) {
      notFound++
      console.log(`❌ error: ${err?.message?.slice(0, 80) || err}`)
      await sleep(2000)
    }
  }

  // Write updated CSV
  const output = stringify(records, { header: true, columns: headers })
  fs.writeFileSync(CSV_PATH, output)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`LINKEDIN PROFILE RESULTS (citation-based)`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Found:          ${found}`)
  console.log(`Not found:      ${notFound}`)
  console.log(`Total:          ${cursorContacts.length}`)
  console.log(`\nCSV updated: ${CSV_PATH}`)
}

main().catch(console.error)
