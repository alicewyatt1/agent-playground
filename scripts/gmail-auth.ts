import { config } from 'dotenv'
import { google } from 'googleapis'
import http from 'http'
import { parse } from 'url'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CLIENT_ID = process.env.GMAIL_CLIENT_ID!
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!
const PORT = 4242
const REDIRECT_URI = `http://localhost:${PORT}`
const TOKENS_PATH = path.join(__dirname, '../gmail-tokens.json')

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
]

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
})

console.log('\nStarting Gmail OAuth flow...')
console.log('Opening browser for authorization. If it does not open automatically, visit:')
console.log('\n' + authUrl + '\n')

exec(`open "${authUrl}"`)

const server = http.createServer(async (req, res) => {
  const queryString = parse(req.url!, true).query
  const code = queryString.code as string | undefined

  if (!code) {
    res.writeHead(400)
    res.end('No authorization code found.')
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>✅ Gmail Authorization Successful!</h2>
        <p>You can close this tab and return to the terminal.</p>
      </body></html>
    `)

    console.log('✅ Authorization successful!')
    console.log(`Tokens saved to: ${TOKENS_PATH}`)
    console.log('\nAuthorized scopes: Gmail (readonly) + Google Calendar (readonly)\n')

    server.close()
  } catch (err) {
    console.error('Error exchanging code for tokens:', err)
    res.writeHead(500)
    res.end('Error during authorization. Check the terminal for details.')
    server.close()
  }
})

server.listen(PORT, () => {
  console.log(`Waiting for authorization callback on http://localhost:${PORT} ...`)
})
