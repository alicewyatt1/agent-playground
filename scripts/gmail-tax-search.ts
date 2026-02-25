import { config } from 'dotenv'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CLIENT_ID = process.env.GMAIL_CLIENT_ID!
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!
const REDIRECT_URI = 'http://localhost:3000'
const TOKENS_PATH = path.join(__dirname, '../gmail-tokens.json')

if (!fs.existsSync(TOKENS_PATH)) {
  console.error('No Gmail tokens found. Please run gmail-auth.ts first:')
  console.error('  pnpm start scripts/gmail-auth.ts')
  process.exit(1)
}

const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'))
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
oauth2Client.setCredentials(tokens)

const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

// Tax year to look for (adjust as needed)
const TAX_YEAR = '2025'

interface TaxDoc {
  category: string
  subject: string
  from: string
  date: string
  snippet: string
  id: string
}

const TAX_CATEGORIES: { label: string; query: string }[] = [
  {
    label: 'W-2 (Wages)',
    query: `subject:(W-2 OR "W2" OR "wage and tax statement" OR "annual wage") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1099-NEC / 1099-MISC (Non-employee / Misc Income)',
    query: `subject:(1099-NEC OR 1099-MISC OR "non-employee compensation" OR "miscellaneous income") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1099-INT (Interest Income)',
    query: `subject:(1099-INT OR "interest income" OR "interest statement") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1099-DIV (Dividend Income)',
    query: `subject:(1099-DIV OR "dividend income" OR "dividend statement") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1099-B (Broker / Investment Sales)',
    query: `subject:(1099-B OR "consolidated tax statement" OR "proceeds from broker" OR "tax forms available" OR "tax document") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1099-G (Government Payments / Unemployment)',
    query: `subject:(1099-G OR "government payments" OR "unemployment compensation" OR "state tax refund") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1099-R (Retirement Distributions)',
    query: `subject:(1099-R OR "retirement distribution" OR "IRA distribution" OR "pension distribution") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1098 (Mortgage Interest)',
    query: `subject:(1098 OR "mortgage interest statement" OR "mortgage interest deduction") after:${TAX_YEAR}/01/01`,
  },
  {
    label: '1098-E (Student Loan Interest)',
    query: `subject:(1098-E OR "student loan interest" OR "student loan statement") after:${TAX_YEAR}/01/01`,
  },
  {
    label: 'HSA / FSA',
    query: `subject:(HSA OR FSA OR "health savings" OR "flexible spending" OR "health account" OR "5498-SA") after:${TAX_YEAR}/01/01`,
  },
  {
    label: 'Charitable Donations',
    query: `subject:("donation receipt" OR "charitable contribution" OR "tax deductible donation" OR "gift receipt" OR "acknowledgment of donation") after:${TAX_YEAR}/01/01`,
  },
  {
    label: 'Property Tax',
    query: `subject:("property tax" OR "real estate tax" OR "tax bill" OR "tax statement") after:${TAX_YEAR}/01/01`,
  },
  {
    label: 'IRA / Retirement Contributions',
    query: `subject:(5498 OR "IRA contribution" OR "retirement contribution" OR "401k" OR "annual contribution") after:${TAX_YEAR}/01/01`,
  },
  {
    label: 'Healthcare / ACA (1095)',
    query: `subject:(1095 OR "health coverage" OR "marketplace statement" OR "minimum essential coverage") after:${TAX_YEAR}/01/01`,
  },
  {
    label: 'Year-End / Tax Statements (General)',
    query: `subject:("year-end statement" OR "annual statement" OR "tax year ${TAX_YEAR}" OR "tax season" OR "important tax") after:${TAX_YEAR}/01/01`,
  },
]

async function getEmailDetails(messageId: string): Promise<{ subject: string; from: string; date: string; snippet: string }> {
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'Date'],
  })

  const headers = msg.data.payload?.headers ?? []
  const get = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

  return {
    subject: get('Subject'),
    from: get('From'),
    date: get('Date'),
    snippet: msg.data.snippet ?? '',
  }
}

async function searchTaxEmails() {
  console.log(`\n🔍 Searching Gmail for tax documents (tax year ${TAX_YEAR})...\n`)
  console.log('='.repeat(70))

  const allResults: Record<string, TaxDoc[]> = {}
  const seenIds = new Set<string>()

  for (const category of TAX_CATEGORIES) {
    process.stdout.write(`Searching: ${category.label}...`)

    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: category.query,
        maxResults: 20,
      })

      const messages = res.data.messages ?? []
      const docs: TaxDoc[] = []

      for (const msg of messages) {
        if (!msg.id || seenIds.has(msg.id)) continue
        seenIds.add(msg.id)

        const details = await getEmailDetails(msg.id)
        docs.push({
          category: category.label,
          ...details,
          id: msg.id,
        })
      }

      allResults[category.label] = docs
      console.log(` found ${docs.length}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(` error: ${message}`)
      allResults[category.label] = []
    }
  }

  // Print organized summary
  console.log('\n' + '='.repeat(70))
  console.log(`📋 TAX DOCUMENT SUMMARY — Tax Year ${TAX_YEAR}`)
  console.log('='.repeat(70))

  let totalFound = 0

  for (const [category, docs] of Object.entries(allResults)) {
    if (docs.length === 0) continue

    totalFound += docs.length
    console.log(`\n📁 ${category} (${docs.length} email${docs.length > 1 ? 's' : ''})`)
    console.log('-'.repeat(60))

    for (const doc of docs) {
      const dateStr = doc.date ? new Date(doc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date'
      console.log(`  📧 ${doc.subject || '(no subject)'}`)
      console.log(`     From: ${doc.from}`)
      console.log(`     Date: ${dateStr}`)
      if (doc.snippet) {
        console.log(`     Preview: ${doc.snippet.substring(0, 120)}...`)
      }
      console.log()
    }
  }

  if (totalFound === 0) {
    console.log('\n⚠️  No tax-related emails found for ' + TAX_YEAR)
    console.log('This could mean:')
    console.log('  - Documents are delivered as PDFs in attachments (check manually)')
    console.log('  - Subject lines vary — try adjusting TAX_YEAR at the top of the script')
    console.log('  - Your brokerage/employer uses a portal instead of email delivery')
  } else {
    console.log(`\n✅ Total: ${totalFound} tax-related email${totalFound > 1 ? 's' : ''} found`)
  }

  // Save results to a markdown file
  const outputPath = path.join(__dirname, `../data/tax-docs-${TAX_YEAR}.md`)
  const lines: string[] = [
    `# Tax Document Emails — ${TAX_YEAR}`,
    `_Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}_`,
    '',
  ]

  for (const [category, docs] of Object.entries(allResults)) {
    if (docs.length === 0) continue
    lines.push(`## ${category}`)
    lines.push('')
    for (const doc of docs) {
      const dateStr = doc.date ? new Date(doc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date'
      lines.push(`### ${doc.subject || '(no subject)'}`)
      lines.push(`- **From:** ${doc.from}`)
      lines.push(`- **Date:** ${dateStr}`)
      lines.push(`- **Preview:** ${doc.snippet?.substring(0, 200) ?? ''}`)
      lines.push(`- **Gmail link:** https://mail.google.com/mail/u/0/#inbox/${doc.id}`)
      lines.push('')
    }
  }

  fs.writeFileSync(outputPath, lines.join('\n'))
  console.log(`\n📄 Results saved to: data/tax-docs-${TAX_YEAR}.md`)
  console.log('\n💡 Tip: For each item above, open Gmail and check for PDF attachments — those are often the actual tax forms.\n')
}

searchTaxEmails().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
