import { config } from 'dotenv'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../gmail-tokens.json'), 'utf-8'))
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'http://localhost:4242'
)
oauth2Client.setCredentials(tokens)
const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

const queries = [
  'from:codat.io subject:(last day OR leaving OR farewell OR goodbye OR offboarding)',
  'subject:(last day OR farewell OR goodbye OR offboarding) codat',
  '"last day" codat',
  'subject:farewell codat',
  'subject:goodbye codat',
  'from:codat.io (last day OR offboarding OR end of employment)',
  'subject:(end of employment OR notice period OR termination) codat',
]

const seen = new Set<string>()

for (const q of queries) {
  const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 10 })
  const msgs = res.data.messages ?? []

  for (const msg of msgs) {
    if (!msg.id || seen.has(msg.id)) continue
    seen.add(msg.id)

    const m = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    })
    const h = m.data.payload?.headers ?? []
    const get = (n: string) => h.find((x) => x.name?.toLowerCase() === n)?.value ?? ''

    console.log('Subject:', get('subject'))
    console.log('From:   ', get('from'))
    console.log('Date:   ', get('date'))
    console.log('Snippet:', m.data.snippet?.substring(0, 300))
    console.log()
  }
}

if (seen.size === 0) {
  console.log('No results found across all queries.')
}
