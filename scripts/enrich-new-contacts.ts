import { config } from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

config()

const CSV_PATH = 'data/top-contacts-enriched-with-gaps.csv'
const NEW_CSV_PATH = 'data/new-executive-contacts.csv'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Email inference ──────────────────────────────────────────────────

interface EmailPattern {
  format: string
  emailDomain: string
}

function detectEmailPattern(
  email: string,
  firstName: string,
  lastName: string
): EmailPattern | null {
  if (!email || !email.includes('@')) return null
  const [local, domain] = email.split('@')
  const lo = local.toLowerCase()
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '')
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '')

  if (lo === `${f}.${l}`) return { format: 'first.last', emailDomain: domain }
  if (lo === `${f[0]}${l}`) return { format: 'flast', emailDomain: domain }
  if (lo === `${f}${l}`) return { format: 'firstlast', emailDomain: domain }
  if (lo === `${f[0]}.${l}`) return { format: 'f.last', emailDomain: domain }
  if (lo === f) return { format: 'first', emailDomain: domain }
  if (lo === `${f}${l[0]}`) return { format: 'firstl', emailDomain: domain }
  return null
}

function generateEmail(
  pattern: EmailPattern,
  firstName: string,
  lastName: string
): string {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '')
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '')
  const d = pattern.emailDomain

  switch (pattern.format) {
    case 'first.last':
      return `${f}.${l}@${d}`
    case 'flast':
      return `${f[0]}${l}@${d}`
    case 'firstlast':
      return `${f}${l}@${d}`
    case 'f.last':
      return `${f[0]}.${l}@${d}`
    case 'first':
      return `${f}@${d}`
    case 'firstl':
      return `${f}${l[0]}@${d}`
    default:
      return ''
  }
}

// ── Perplexity search ────────────────────────────────────────────────

async function searchPerplexity(query: string): Promise<string> {
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
            'You are a research assistant. Provide factual, verifiable information about the person described. Include specific details like location, previous companies, and recent LinkedIn activity.',
        },
        { role: 'user', content: query },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Perplexity ${response.status}`)
  }

  const data = (await response.json()) as any
  return data.choices?.[0]?.message?.content || ''
}

// ── Main ─────────────────────────────────────────────────────────────

const enrichmentSchema = z.object({
  location: z
    .string()
    .describe(
      'City, State, Country (e.g. "Salt Lake City, Utah, United States"). Empty if unknown.'
    ),
  notablePreviousExperience: z
    .string()
    .describe(
      'Comma-separated list of notable previous companies they worked at. Empty if unknown.'
    ),
  activeOnLinkedIn: z
    .enum(['Yes', 'No', ''])
    .describe('Whether they have been active on LinkedIn in the last 90 days'),
  icebreakerInsight: z
    .string()
    .describe(
      'A recent insight from their LinkedIn activity, posts, or public statements that could serve as a conversation opener. 1-2 sentences. Empty if nothing found.'
    ),
  summaryOfRole: z
    .string()
    .describe(
      'A 3-5 sentence summary of their role, responsibilities, likely pain points, and priorities at this company. Written in third person.'
    ),
  companyTenure: z
    .string()
    .describe(
      'How long they have been at this company (e.g. "5 years, 3 months"). Empty if unknown.'
    ),
})

async function main() {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const records: Record<string, string>[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
  const headers = Object.keys(records[0])

  // Build email patterns from Clay contacts
  const emailPatterns = new Map<string, EmailPattern>()
  for (const r of records) {
    if (r['Source'] !== 'Clay' || !r['Work Email']) continue
    const domain = r['Company Domain']?.trim()
    if (!domain || emailPatterns.has(domain)) continue

    const pattern = detectEmailPattern(
      r['Work Email'].trim(),
      r['First Name']?.trim() || '',
      r['Last Name']?.trim() || ''
    )
    if (pattern) {
      emailPatterns.set(domain, pattern)
    }
  }

  console.log(`📧 Email patterns detected for ${emailPatterns.size} domains`)

  // Get only Cursor contacts to enrich
  const cursorContacts = records.filter((r) => r['Source'] === 'Cursor')
  console.log(`\n🔍 Enriching ${cursorContacts.length} new contacts...\n`)

  let enriched = 0
  let errors = 0

  for (let i = 0; i < cursorContacts.length; i++) {
    const contact = cursorContacts[i]
    const name = contact['Full Name'].replace(/"/g, '')
    const company = contact['Company Name']
    const title = contact['Job Title']
    const domain = contact['Company Domain']

    console.log(`[${i + 1}/${cursorContacts.length}] ${name} — ${title} @ ${company}`)

    // ── Infer email ──
    if (!contact['Work Email']) {
      const pattern = emailPatterns.get(domain)
      if (pattern && contact['First Name'] && contact['Last Name']) {
        const firstName = contact['First Name'].replace(/"/g, '').trim()
        const lastName = contact['Last Name'].replace(/[",]/g, '').trim().split(' ')[0] || ''
        if (firstName && lastName) {
          const email = generateEmail(pattern, firstName, lastName)
          if (email) {
            contact['Work Email'] = email
            console.log(`  📧 Inferred email: ${email} (pattern: ${pattern.format}@${pattern.emailDomain})`)
          }
        }
      }
    }

    // ── Search for profile details ──
    try {
      const searchResult = await searchPerplexity(
        `Tell me about ${name}, who is ${title} at ${company} (${domain}).
I need:
1. Their location (city, state, country)
2. Previous companies they worked at before ${company}
3. How long they've been at ${company}
4. Any recent LinkedIn posts or activity (last 90 days)
5. Any recent public statements, articles, or insights they've shared
6. Their key responsibilities and priorities in their role

Be specific and factual. If you can't find information for a field, say "not found".`
      )

      if (searchResult.length < 50) {
        console.log(`  ⚠️  Minimal search results`)
        errors++
        await sleep(800)
        continue
      }

      // ── Extract structured data ──
      const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: enrichmentSchema,
        prompt: `Extract enrichment data for "${name}" (${title} at ${company}) from this research:

${searchResult}

Rules:
- Location should be "City, State, Country" format
- Notable Previous Experience: list only company names, comma-separated
- Active on LinkedIn: "Yes" if there's evidence of posts/engagement in last 90 days, "No" if evidence they're inactive, empty if unknown
- Icebreaker Insight: a specific recent talking point from their activity (post, article, comment). Must be specific and actionable, not generic. Empty if nothing specific found.
- Summary of Role: Write 3-5 sentences about their role, what they're responsible for, their likely pain points and priorities. Written in third person, similar to a CRM profile note.
- Company Tenure: e.g. "5 years, 3 months". Empty if unknown.

Only fill in fields where you have actual evidence. Leave empty if uncertain.`,
      })

      // Apply enrichment
      if (object.location) contact['Location'] = object.location
      if (object.notablePreviousExperience)
        contact['Notable Previous Experience'] = object.notablePreviousExperience
      if (object.activeOnLinkedIn)
        contact['Active on LinkedIn (last 90 days)'] = object.activeOnLinkedIn
      if (object.icebreakerInsight)
        contact['Icebreaker Insight'] = object.icebreakerInsight
      if (object.summaryOfRole) contact['Summary of Role'] = object.summaryOfRole
      if (object.companyTenure) contact['Company Tenure'] = object.companyTenure

      enriched++

      // Log what we found
      const filled = [
        object.location ? 'location' : '',
        object.notablePreviousExperience ? 'prev-exp' : '',
        object.activeOnLinkedIn ? 'linkedin-active' : '',
        object.icebreakerInsight ? 'icebreaker' : '',
        object.summaryOfRole ? 'summary' : '',
        object.companyTenure ? 'tenure' : '',
      ].filter(Boolean)
      console.log(`  ✅ Enriched: ${filled.join(', ')}`)

      await sleep(1000)
    } catch (err: any) {
      errors++
      console.log(`  ❌ Error: ${err?.message?.slice(0, 80) || err}`)
      await sleep(2000)
    }
  }

  // ── Write updated main CSV ──
  const output = stringify(records, { header: true, columns: headers })
  fs.writeFileSync(CSV_PATH, output)

  // ── Write updated new-contacts CSV with full columns ──
  const newHeaders = [
    'Company Name',
    'First Name',
    'Last Name',
    'Full Name',
    'Job Title',
    'Location',
    'Company Domain',
    'LinkedIn Profile',
    'Notable Previous Experience',
    'Active on LinkedIn (last 90 days)',
    'Icebreaker Insight',
    'Work Email',
    'Summary of Role',
    'Company Tenure',
    'Source',
  ]

  const newOutput = stringify(
    cursorContacts.map((r) => {
      const row: Record<string, string> = {}
      for (const h of newHeaders) row[h] = r[h] || ''
      return row
    }),
    { header: true, columns: newHeaders }
  )
  fs.writeFileSync(NEW_CSV_PATH, newOutput)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`ENRICHMENT COMPLETE`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Enriched:   ${enriched}`)
  console.log(`Errors:     ${errors}`)
  console.log(`Total:      ${cursorContacts.length}`)
  console.log(`\nUpdated: ${CSV_PATH}`)
  console.log(`Updated: ${NEW_CSV_PATH}`)
}

main().catch(console.error)
