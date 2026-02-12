import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Persona mapping by job title keywords ──

function classifyPersona(title: string): string {
  const t = title.toLowerCase()

  // Executive Sponsor — the decision makers
  const execPatterns = [
    /\bceo\b/,
    /\bchief executive/,
    /\bfounder\b/,
    /\bco-founder\b/,
    /\bowner\b/,
    /\bchairman\b/,
    /\bpresident\b(?!.*operations)/,
    /\bmanaging partner\b/,
    /\bsenior partner\b/,
    /\bchief financial officer\b/,
    /\bcfo\b/,
    /\bchief corporate development\b/,
    /\bchief strategic partnership\b/,
    /\bchief business officer\b/,
  ]

  // Technology Leader — the technical gatekeepers
  const techPatterns = [
    /\bcto\b/,
    /\bcio\b/,
    /\bciso\b/,
    /\bchief technology/,
    /\bchief technical/,
    /\bchief information/,
    /\bchief security officer/,
    /\bvp.*technology/,
    /\bvice president.*technology/,
    /\bvp.*engineering/,
    /\bvice president.*engineering/,
    /\bvp.*software/,
    /\bvice president.*software/,
    /\bvp.*it\b/,
    /\bvice president.*information technology/,
    /\bvp.*digital innovation/,
    /\bvice president.*digital innovation/,
    /\bvp.*product management/,
    /\bvice president.*application development/,
    /\bavp.*technology/,
    /\bavp.*enterprise technology/,
    /\bassistant vice president.*information technology/,
    /\bvp.*call center technologies/,
    /\bproduct owner\b/,
    /\bvp hugo labs\b/,
    /\bglobal cio\b/,
    /\bchief data officer\b/,
    /\bchief customer officer.*chief data/,
  ]

  // Operations Leader — the operational champions (checked last as catch-all for VP+)
  const opsPatterns = [
    /\bcoo\b/,
    /\bchief operating/,
    /\bchief experience officer/,
    /\bchief customer officer\b/,
    /\bvp.*operations/,
    /\bvice president.*operations/,
    /\bsvp.*operations/,
    /\bsenior vice president.*operations/,
    /\bevp.*operations/,
    /\bexecutive vice president.*operations/,
    /\bvp.*client/,
    /\bvice president.*client/,
    /\bsenior vice president.*client/,
    /\bsvp.*client/,
    /\bvp.*customer/,
    /\bvice president.*customer/,
    /\bvp.*business operations/,
    /\bvice president.*business operations/,
    /\bvp.*continuous improvement/,
    /\bsenior vice president.*continuous improvement/,
    /\bavp.*operational excellence/,
    /\bassistant director.*operations/,
    /\bvice president.*strategic/,
    /\bvp.*strategic/,
    /\bvice president.*corporate support/,
    /\bregional vice president/,
    /\bvp.*organizational development/,
    /\bvice president.*professional services/,
    /\bvice president.*project management/,
    /\bvice president.*marketing/,
    /\bvp.*global client development/,
    /\bvp.*enterprise solutions/,
    /\bsenior vice president.*bpo/,
    /\bglobal vice president.*cx/,
    /\bsr\.?\s*vice president/,
    /\bsr\.?\s*vp/,
    /\bsenior vice president\b(?!.*technology)/,
    /\bexecutive vice president\b(?!.*operations)/,
    /\bvice president\b(?!.*(?:technology|engineering|software|it\b|information|digital innovation|application|call center tech|product management))/,
    /\bvp\b(?!.*(?:technology|engineering|software|it\b|information|digital innovation|application|call center tech|product management|hugo labs))/,
    /\bvp solutions services/,
    /\bvice president.*general counsel/,
  ]

  // Check in order: exec first, then tech, then ops
  for (const pattern of execPatterns) {
    if (pattern.test(t)) return 'Executive Sponsor'
  }
  for (const pattern of techPatterns) {
    if (pattern.test(t)) return 'Technology Leader'
  }
  for (const pattern of opsPatterns) {
    if (pattern.test(t)) return 'Operations Leader'
  }

  // Fallback — some titles that contain "president" + "operations" go to Operations
  if (/president.*(?:coo|operating|operations)/i.test(t)) return 'Operations Leader'
  if (/president/i.test(t)) return 'Executive Sponsor'

  return 'Unclassified'
}

// ── Southeast US states for CBAND Atlanta cohort ──

const SOUTHEAST_STATES = [
  'georgia',
  'florida',
  'alabama',
  'tennessee',
  'south carolina',
  'north carolina',
  'virginia',
  'mississippi',
  'louisiana',
  'arkansas',
  'kentucky',
]

function isSoutheast(location: string): boolean {
  const loc = location.toLowerCase()
  return SOUTHEAST_STATES.some((state) => loc.includes(state))
}

// ── Main ──

async function main() {
  const inputPath = '/Users/alicewyatt/Downloads/Persona Mapping - Top Contacts.csv'
  const outputPath = path.join(__dirname, '..', 'data', 'outreach-cohort-1.csv')

  const raw = fs.readFileSync(inputPath, 'utf-8')
  const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true })

  console.log(`\nLoaded ${records.length} contacts from Top Contacts CSV\n`)

  // Classify each contact
  interface Contact {
    'Company Name': string
    'First Name': string
    'Last Name': string
    'Full Name': string
    'Job Title': string
    Location: string
    'LinkedIn Profile': string
    'Active on LinkedIn (last 90 days)': string
    'Icebreaker Insight': string
    'Work Email': string
    Persona: string
    'Southeast Region': string
    Cohort: string
    'Event Hook': string
    [key: string]: string
  }

  const enriched: Contact[] = records.map((r: Contact) => {
    const persona = classifyPersona(r['Job Title'] || '')
    const southeast = isSoutheast(r['Location'] || '')
    const activeLinkedIn = (r['Active on LinkedIn (last 90 days)'] || '').trim().toLowerCase() === 'yes'

    let cohort = 'Cohort 2 — Later'
    if (activeLinkedIn || southeast) {
      cohort = 'Cohort 1 — Priority'
    }

    let eventHook = 'Enterprise Connect (Mar 10-12, Las Vegas)'
    if (southeast) {
      eventHook = 'CBAND Atlanta (Feb 26)'
    }

    return {
      ...r,
      Persona: persona,
      'Southeast Region': southeast ? 'Yes' : 'No',
      Cohort: cohort,
      'Event Hook': eventHook,
    }
  })

  // Stats
  const personaCounts: Record<string, number> = {}
  const cohortCounts: Record<string, number> = {}
  let activeLinkedInCount = 0
  let southeastCount = 0

  for (const c of enriched) {
    personaCounts[c.Persona] = (personaCounts[c.Persona] || 0) + 1
    cohortCounts[c.Cohort] = (cohortCounts[c.Cohort] || 0) + 1
    if (c['Southeast Region'] === 'Yes') southeastCount++
    if ((c['Active on LinkedIn (last 90 days)'] || '').trim().toLowerCase() === 'yes')
      activeLinkedInCount++
  }

  console.log('=== Persona Distribution ===')
  for (const [persona, count] of Object.entries(personaCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${persona}: ${count}`)
  }

  console.log('\n=== Cohort Distribution ===')
  for (const [cohort, count] of Object.entries(cohortCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cohort}: ${count}`)
  }

  console.log(`\n=== Breakdown ===`)
  console.log(`  Active on LinkedIn: ${activeLinkedInCount}`)
  console.log(`  Southeast region: ${southeastCount}`)
  console.log(`  Total contacts: ${enriched.length}`)

  // Filter Cohort 1 and output
  const cohort1 = enriched.filter((c) => c.Cohort === 'Cohort 1 — Priority')

  // Select the columns for the output CSV
  const outputColumns = [
    'Company Name',
    'Full Name',
    'Job Title',
    'Persona',
    'Location',
    'Southeast Region',
    'Event Hook',
    'Active on LinkedIn (last 90 days)',
    'Icebreaker Insight',
    'LinkedIn Profile',
    'Work Email',
    'Summary of Role',
  ]

  const csvOutput = stringify(cohort1, {
    header: true,
    columns: outputColumns,
  })

  fs.writeFileSync(outputPath, csvOutput)
  console.log(`\n✓ Wrote ${cohort1.length} Cohort 1 contacts to ${outputPath}`)

  // Print Cohort 1 summary
  console.log('\n=== Cohort 1 Summary ===')
  const c1Personas: Record<string, number> = {}
  for (const c of cohort1) {
    c1Personas[c.Persona] = (c1Personas[c.Persona] || 0) + 1
  }
  for (const [persona, count] of Object.entries(c1Personas).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${persona}: ${count}`)
  }

  // List Cohort 1 contacts
  console.log('\n=== Cohort 1 Contacts ===')
  for (const c of cohort1) {
    const activeTag =
      (c['Active on LinkedIn (last 90 days)'] || '').trim().toLowerCase() === 'yes' ? 'LI' : ''
    const seTag = c['Southeast Region'] === 'Yes' ? 'SE' : ''
    const tags = [activeTag, seTag].filter(Boolean).join('+')
    console.log(`  [${c.Persona.padEnd(18)}] ${c['Full Name'].padEnd(25)} @ ${c['Company Name'].padEnd(25)} (${tags})`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
