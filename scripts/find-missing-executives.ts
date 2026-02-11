import { config } from 'dotenv'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import OpenAI from 'openai'

config()

const INPUT_CSV =
  '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Top Contacts.csv'
const OUTPUT_CSV = 'data/top-contacts-enriched-with-gaps.csv'

const HEADERS = [
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
  'First Degree Connection [Alice or Calanthia]',
  'Second Degree Connections [Alice only]',
  'Source',
]

// ── helpers ──────────────────────────────────────────────────────────

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Rough duplicate check: shares a last-name token AND first-name initial */
function isDuplicate(candidate: string, existingNames: string[]): boolean {
  const norm = normalize(candidate)
  const parts = norm.split(' ')
  if (parts.length < 2) return false
  const firstInitial = parts[0][0]
  const lastToken = parts[parts.length - 1]

  return existingNames.some((existing) => {
    const ep = normalize(existing).split(' ')
    if (ep.length < 2) return false
    const eFirst = ep[0][0]
    const eLast = ep[ep.length - 1]
    return eLast === lastToken && eFirst === firstInitial
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  // 1. Parse the Clay CSV
  const csvContent = fs.readFileSync(INPUT_CSV, 'utf-8')
  const records: Record<string, string>[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })

  // 2. Group contacts by company
  const companies = new Map<string, { domain: string; contacts: Record<string, string>[] }>()
  for (const row of records) {
    const name = row['Company Name']?.trim()
    if (!name) continue
    if (!companies.has(name)) {
      companies.set(name, { domain: row['Company Domain']?.trim() || '', contacts: [] })
    }
    companies.get(name)!.contacts.push(row)
  }

  console.log(`\n📋 Loaded ${records.length} existing contacts across ${companies.size} companies\n`)

  // 3. Perplexity client for web search
  const perplexity = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
  })

  // Schema for AI extraction
  const executiveSchema = z.object({
    executives: z.array(
      z.object({
        fullName: z.string().describe('Full name of the executive'),
        jobTitle: z.string().describe('Exact job title'),
        isTargetRole: z
          .boolean()
          .describe(
            'True ONLY if this person is a Founder, CEO, President, COO, CTO, or VP/SVP/EVP in Technology/IT/Engineering or Operations'
          ),
      })
    ),
  })

  const allNewContacts: {
    companyName: string
    firstName: string
    lastName: string
    fullName: string
    jobTitle: string
    companyDomain: string
  }[] = []

  let companyIndex = 0
  const totalCompanies = companies.size

  for (const [companyName, { domain, contacts }] of companies) {
    companyIndex++
    const existingNames = contacts.map((c) => c['Full Name']?.trim()).filter(Boolean)
    const existingRoles = contacts.map((c) => c['Job Title']?.trim().toLowerCase()).filter(Boolean)

    console.log(
      `[${companyIndex}/${totalCompanies}] ${companyName} (${domain}) — ${contacts.length} existing contacts`
    )
    console.log(`  Existing: ${existingNames.join(', ')}`)

    try {
      // Search via Perplexity
      const response = await perplexity.chat.completions.create({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'You are a factual research assistant. Only return information you can verify from web sources. Do not fabricate names or titles.',
          },
          {
            role: 'user',
            content: `Who are the current executives at "${companyName}" (website: ${domain})? I specifically need anyone in these roles:

1. Founder(s) / Co-Founder(s)
2. CEO / Chief Executive Officer
3. President
4. COO / Chief Operating Officer
5. CTO / Chief Technology Officer
6. VP or above (VP, SVP, EVP) in Technology, IT, Engineering, or Information Systems
7. VP or above (VP, SVP, EVP) in Operations

For each person, give their full name and exact current job title. Only include people currently at this company as of 2025-2026.`,
          },
        ],
      })

      const searchResult = response.choices[0]?.message?.content || ''

      if (searchResult.length < 30) {
        console.log(`  ⚠️  No meaningful results found`)
        continue
      }

      // Extract structured data via OpenAI
      const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: executiveSchema,
        prompt: `Extract executives from this research about "${companyName}".

ONLY include people whose role is one of: Founder, CEO, President, COO, CTO, or VP/SVP/EVP in Technology/IT/Engineering or Operations.
Do NOT include VP of Sales, VP of Marketing, VP of HR, VP of Client Services, VP of Finance, CFO, General Counsel, or similar non-target roles.

Here are the people ALREADY in our database for this company (do NOT include any of them):
${existingNames.map((n, i) => `- ${n} (${contacts[i]['Job Title']})`).join('\n')}

Research text:
${searchResult}

Return ONLY genuinely new people not already listed above. If no new people are found, return an empty array.
Match names loosely — "Bill" = "William", "Bob" = "Robert", "Mike" = "Michael", etc.`,
      })

      let newCount = 0
      for (const exec of object.executives) {
        if (!exec.isTargetRole) continue
        if (isDuplicate(exec.fullName, existingNames)) {
          console.log(`  ⏭️  Already exists: ${exec.fullName} — ${exec.jobTitle}`)
          continue
        }

        const nameParts = exec.fullName.trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        allNewContacts.push({
          companyName,
          firstName,
          lastName,
          fullName: exec.fullName.trim(),
          jobTitle: exec.jobTitle.trim(),
          companyDomain: domain,
        })

        newCount++
        console.log(`  ✅ NEW: ${exec.fullName} — ${exec.jobTitle}`)
      }

      if (newCount === 0) {
        console.log(`  ✔️  No missing executives found`)
      }

      // Rate limit: wait between requests
      await sleep(1200)
    } catch (err: any) {
      console.error(`  ❌ Error: ${err?.message || err}`)
      await sleep(2000)
    }
  }

  // 4. Build combined output CSV
  const outputRows: Record<string, string>[] = []

  // Add existing contacts with Source = Clay
  for (const row of records) {
    const newRow: Record<string, string> = {}
    for (const h of HEADERS) newRow[h] = row[h] || ''
    newRow['Source'] = 'Clay'
    outputRows.push(newRow)
  }

  // Add new contacts with Source = Cursor
  for (const contact of allNewContacts) {
    const newRow: Record<string, string> = {}
    for (const h of HEADERS) newRow[h] = ''
    newRow['Company Name'] = contact.companyName
    newRow['First Name'] = contact.firstName
    newRow['Last Name'] = contact.lastName
    newRow['Full Name'] = contact.fullName
    newRow['Job Title'] = contact.jobTitle
    newRow['Company Domain'] = contact.companyDomain
    newRow['Source'] = 'Cursor'
    outputRows.push(newRow)
  }

  // Sort by company name then source (Clay first)
  outputRows.sort((a, b) => {
    const cmp = a['Company Name'].localeCompare(b['Company Name'])
    if (cmp !== 0) return cmp
    return a['Source'].localeCompare(b['Source']) // Clay before Cursor
  })

  const output = stringify(outputRows, { header: true, columns: HEADERS })
  fs.writeFileSync(OUTPUT_CSV, output)

  // 5. Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log(`SUMMARY`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Existing contacts (Clay):     ${records.length}`)
  console.log(`New contacts found (Cursor):  ${allNewContacts.length}`)
  console.log(`Total in output:              ${records.length + allNewContacts.length}`)
  console.log(`Output written to:            ${OUTPUT_CSV}`)
  console.log()

  // Print new contacts grouped by company
  if (allNewContacts.length > 0) {
    console.log(`\nNEW CONTACTS BY COMPANY:`)
    console.log(`${'─'.repeat(60)}`)
    const grouped = new Map<string, typeof allNewContacts>()
    for (const c of allNewContacts) {
      if (!grouped.has(c.companyName)) grouped.set(c.companyName, [])
      grouped.get(c.companyName)!.push(c)
    }
    for (const [company, people] of grouped) {
      console.log(`\n${company}:`)
      for (const p of people) {
        console.log(`  • ${p.fullName} — ${p.jobTitle}`)
      }
    }
  }
}

main().catch(console.error)
