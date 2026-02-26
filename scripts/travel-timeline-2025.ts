import { config } from 'dotenv'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import ExcelJS from 'exceljs'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TOKENS_PATH = path.join(__dirname, '../gmail-tokens.json')
const RAW_DATA_PATH = path.join(__dirname, '../data/travel-raw-2025.json')
const OUTPUT_PATH = path.join(__dirname, '../data/travel-timeline-2025.xlsx')

if (!fs.existsSync(TOKENS_PATH)) {
  console.error('No tokens found. Run: pnpm start scripts/gmail-auth.ts')
  process.exit(1)
}

const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'))
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'http://localhost:4242',
)
oauth2Client.setCredentials(tokens)

const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

// ────────────────────────────────────────────────────────────────────────────
// CALENDAR
// ────────────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  calendar: string
  summary: string
  start: string
  end: string
  location: string
  description: string
  allDay: boolean
}

const TRAVEL_KEYWORDS =
  /flight|airport|hotel|airbnb|hostel|travel|trip|holiday|vacation|train|eurostar|taxi|uber|depart|arriv|boarding|check.?in|check.?out|visa|passport|transfer|layover|transit|cruise|ferry/i

async function fetchCalendarData(): Promise<CalendarEvent[]> {
  console.log('\n📅 Fetching Google Calendar data for 2025...')

  const calListRes = await calendar.calendarList.list({ maxResults: 50 })
  const calendars = calListRes.data.items ?? []
  console.log(`   Found ${calendars.length} calendar(s): ${calendars.map((c) => c.summary).join(', ')}`)

  const allEvents: CalendarEvent[] = []

  for (const cal of calendars) {
    if (!cal.id) continue

    let pageToken: string | undefined
    let calEventCount = 0

    do {
      const res = await calendar.events.list({
        calendarId: cal.id,
        timeMin: '2025-01-01T00:00:00Z',
        timeMax: '2025-12-31T23:59:59Z',
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken,
      })

      for (const event of res.data.items ?? []) {
        const start = event.start?.date ?? event.start?.dateTime ?? ''
        const end = event.end?.date ?? event.end?.dateTime ?? ''
        const summary = event.summary ?? ''
        const location = event.location ?? ''
        const description = (event.description ?? '').substring(0, 300)
        const isAllDay = !!event.start?.date

        // Multi-day all-day events (end date is exclusive in Google Calendar API)
        const isMultiDay =
          isAllDay && start && end
            ? new Date(end).getTime() - new Date(start).getTime() > 24 * 60 * 60 * 1000
            : false

        const isRelevant =
          location.length > 0 ||
          isMultiDay ||
          TRAVEL_KEYWORDS.test(summary) ||
          TRAVEL_KEYWORDS.test(description)

        if (isRelevant) {
          allEvents.push({
            calendar: cal.summary ?? cal.id,
            summary,
            start,
            end,
            location,
            description,
            allDay: isAllDay,
          })
          calEventCount++
        }
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)

    if (calEventCount > 0) {
      console.log(`   ✓ ${cal.summary}: ${calEventCount} relevant events`)
    }
  }

  console.log(`   Total relevant calendar events: ${allEvents.length}`)
  return allEvents
}

// ────────────────────────────────────────────────────────────────────────────
// GMAIL
// ────────────────────────────────────────────────────────────────────────────

interface TravelEmail {
  subject: string
  from: string
  date: string
  snippet: string
  body: string
}

function decodeBodyData(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8')
}

function extractTextFromPayload(payload: {
  mimeType?: string | null
  body?: { data?: string | null } | null
  parts?: unknown[] | null
} | null | undefined): string {
  if (!payload) return ''

  if (payload.body?.data) {
    const text = decodeBodyData(payload.body.data)
    if (payload.mimeType === 'text/html') {
      return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    return text
  }

  if (payload.parts) {
    // Prefer plain text
    for (const part of payload.parts as typeof payload[]) {
      if (part?.mimeType === 'text/plain' && part.body?.data) {
        return decodeBodyData(part.body.data)
      }
    }
    // Fall back to HTML
    for (const part of payload.parts as typeof payload[]) {
      if (part?.mimeType === 'text/html' && part.body?.data) {
        return decodeBodyData(part.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
      // Recurse into nested parts (multipart/alternative inside multipart/mixed)
      const nested = extractTextFromPayload(part as typeof payload)
      if (nested) return nested
    }
  }

  return ''
}

async function fetchGmailData(): Promise<TravelEmail[]> {
  console.log('\n📧 Fetching Gmail travel data for 2025...')

  const queries = [
    // Airlines - major carriers
    'from:(britishairways.com OR aa.com OR delta.com OR united.com OR ryanair.com OR easyjet.com OR lufthansa.com OR airfrance.com OR emirates.com OR klm.com OR qatarairways.com OR virginatlantic.com OR jetblue.com OR southwest.com OR norwegian.com OR wizzair.com OR iberia.com OR swiss.com OR finnair.com OR flybe.com OR tui.com OR thomascook.com OR flightcentre.com) after:2024/12/31 before:2026/01/01',
    // Travel booking platforms
    'from:(expedia.com OR hotels.com OR booking.com OR airbnb.com OR kayak.com OR skyscanner.com OR priceline.com OR tripadvisor.com OR agoda.com OR marriott.com OR hilton.com OR ihg.com OR hyatt.com OR accor.com OR radisson.com) after:2024/12/31 before:2026/01/01',
    // Rail
    'from:(eurostar.com OR amtrak.com OR thetrainline.com OR nationalrail.co.uk OR avanti.co.uk OR gwr.com OR thalys.com OR sncf.com OR db.com OR renfe.com) after:2024/12/31 before:2026/01/01',
    // Boarding pass / itinerary keywords
    '"boarding pass" after:2024/12/31 before:2026/01/01',
    'subject:("flight confirmation" OR "booking confirmation" OR "your itinerary" OR "travel itinerary" OR "trip confirmation" OR "e-ticket" OR "eticket" OR "your flight") after:2024/12/31 before:2026/01/01',
    'subject:("hotel confirmation" OR "reservation confirmed" OR "check-in details" OR "your stay" OR "your reservation") after:2024/12/31 before:2026/01/01',
    // Visa / immigration
    'subject:(visa OR ESTA OR "travel authorization" OR immigration OR "entry permit") after:2024/12/31 before:2026/01/01',
  ]

  const seen = new Set<string>()
  const emails: TravelEmail[] = []

  for (const query of queries) {
    const label = query.substring(0, 70) + '...'
    process.stdout.write(`   Searching: ${label}\n`)

    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      })

      const messages = res.data.messages ?? []

      for (const msg of messages) {
        if (!msg.id || seen.has(msg.id)) continue
        seen.add(msg.id)

        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        })

        const headers = fullMsg.data.payload?.headers ?? []
        const get = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

        const body = extractTextFromPayload(fullMsg.data.payload)

        emails.push({
          subject: get('Subject'),
          from: get('From'),
          date: get('Date'),
          snippet: fullMsg.data.snippet ?? '',
          body: body.substring(0, 1500),
        })
      }
    } catch (err) {
      console.error(`   Error on query: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`   Total travel emails found: ${emails.length}`)
  return emails
}

// ────────────────────────────────────────────────────────────────────────────
// AI SYNTHESIS
// ────────────────────────────────────────────────────────────────────────────

interface TimelinePeriod {
  startDate: string
  endDate: string
  country: string
  city?: string
  confidence: 'high' | 'medium' | 'low'
  evidence: string
  notes?: string
}

interface SynthesisResult {
  timeline: TimelinePeriod[]
  totalUsDays: number
  summary: string
}

const VIRTUAL_LOCATION =
  /zoom\.us|meet\.google|teams\.microsoft|webex|virtual|conference.?call|phone|skype|whereby|luma\.events|lu\.ma/i

/** Strip down calendar events to only the meaningful travel signals.
 *  IMPORTANT: Only uses Alice's own calendar (alicewyatt1@gmail.com) to
 *  avoid contaminating the timeline with Alex's travel. */
function filterCalendarForAI(calEvents: CalendarEvent[]): object[] {
  // Filter to Alice's own calendar only
  const aliceOnly = calEvents.filter((e) => e.calendar === 'alicewyatt1@gmail.com')

  const filtered: object[] = []

  for (const e of aliceOnly) {
    const loc = e.location ?? ''
    const isVirtual = VIRTUAL_LOCATION.test(loc)
    const hasPhysicalLoc = loc.length > 3 && !isVirtual

    if (hasPhysicalLoc) {
      filtered.push({
        date: e.start.substring(0, 10),
        summary: e.summary,
        location: loc.substring(0, 120).replace(/\n/g, ', '),
        allDay: e.allDay,
      })
    } else if (TRAVEL_KEYWORDS.test(e.summary) || TRAVEL_KEYWORDS.test(e.description)) {
      filtered.push({
        date: e.start.substring(0, 10),
        summary: e.summary,
        description: e.description?.substring(0, 80) ?? '',
        allDay: e.allDay,
      })
    }
  }

  // De-duplicate by date+summary
  const seen = new Set<string>()
  return filtered.filter((ev) => {
    const key = JSON.stringify(ev)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const FLIGHT_EMAIL_PATTERN =
  /itinerary|e.?ticket|boarding.?pass|booking.?confirm|flight.?confirm|trip.?confirm|reservation.?confirm|your.?flight|your.?trip/i
const NEWSLETTER_PATTERN =
  /newsletter|statement|miles|points|mileage.?plus|trueblue|aadvantage|skymiles|account.?updated|updates.?for|rewards|earn|status/i

/** Filter emails to only actual bookings / itineraries */
function filterEmailsForAI(emails: TravelEmail[]): object[] {
  return emails
    .filter((e) => {
      if (NEWSLETTER_PATTERN.test(e.subject)) return false
      return FLIGHT_EMAIL_PATTERN.test(e.subject) || FLIGHT_EMAIL_PATTERN.test(e.snippet)
    })
    .map((e) => ({
      date: e.date?.substring(0, 16) ?? '',
      from: e.from?.replace(/<.*>/, '').trim() ?? '',
      subject: e.subject,
      snippet: e.snippet?.substring(0, 200) ?? '',
      body: e.body?.substring(0, 600) ?? '',
    }))
}

async function synthesizeTimeline(calEvents: CalendarEvent[], emails: TravelEmail[]): Promise<SynthesisResult> {
  console.log('\n🤖 Synthesising travel timeline with AI...')

  const filteredCal = filterCalendarForAI(calEvents)
  const filteredEmails = filterEmailsForAI(emails)

  console.log(`   Filtered to ${filteredCal.length} calendar signals, ${filteredEmails.length} booking emails`)

  const calJson = JSON.stringify(filteredCal, null, 0)
  const emailJson = JSON.stringify(filteredEmails, null, 0)

  const prompt = `You are a meticulous tax analyst helping Alice Wyatt determine which country she was physically present in on each day of calendar year 2025 (Jan 1 – Dec 31 inclusive). This is for the US Substantial Presence Test.

IMPORTANT RULES:
- For the US SPT, if Alice was physically in the US at any time during a day, that day counts as a US day.
- Cover every single day of 2025 with no gaps or overlaps.
- Where evidence is ambiguous, assign confidence "low" and note what's missing.
- Do NOT assume — only assign a country if there is actual evidence.
- If no evidence exists for a period, use country "Unknown" and confidence "low".

KNOWN FACTS (use these to anchor the timeline):
1. Alice splits time primarily between Austin TX / New York (US) and London (UK).
2. Late Dec 2024 she was in Costa Rica; she likely returned to the US in early January 2025. First confirmed US event is NYC on Jan 8.
3. Jan 20: "JFK->Zurich Flight" — she flew from NYC to Switzerland that evening. Jan 20 = US day (departed JFK).
4. Jan 21 – Feb 7: Switzerland (Zermatt then Verbier skiing).
5. Feb 8: Flew Geneva → London Gatwick (easyJet U2 8500). Feb 8 = UK.
6. Feb 14: Flew London → Tokyo (KLM, check-in email Feb 13). Feb 14 = UK travel day.
7. Feb 15 – Feb 27: Japan. Confirmed Tokyo reservations Feb 25-27 (Shirokane Alternative, Four Seasons Otemachi, THE LOUNGE, CAPPINESS).
8. Feb 27: "Flight to Montréal (AC 6)" departing Tokyo NRT. Feb 27 = Japan.
9. Feb 28: "Flight to New York (AC 8946)" departing Montreal YUL → arrived NYC. Feb 28 = US day.
10. Mar 8: "Flight to Austin (UA 2350)" from Newark EWR → Austin. Mar 8 = US day (travel within US).
11. Mar 19: "Alice Flight to NY (9:22am)" — flew Austin → NYC. Mar 19 = US.
12. Apr 3: "Flight JFK -> Cape Town (8:40pm)" — departed NYC evening. Apr 3 = US day.
13. Apr 4–13: South Africa (Cape Town, Stellenbosch, Franschhoek). Last SA event Apr 12 (Babylonstoren).
14. Apr 14: "South Africa flight home" — returned to US (NYC). Apr 14 = US day (arrived).
15. Apr 15–24: New York City (confirmed events at 394 Broadway Apr 15, HSS Hospital Apr 17, Fintech Meetup 71 5th Ave Apr 22). NOTE: Colombia trip was Alex's, NOT Alice's.
16. Apr 25 – May 1: Austin TX.
17. May 2: Travel to Austin airport (Austin-Bergstrom). "Flight: Austin to London Heathrow | BA 1xx" — flew to UK. May 2 = US day.
18. May 3–25: UK. Includes London (Hotel Café Royal, Raffles, Emory, Raffles OWO), Oxfordshire (Estelle Manor, Soho Farmhouse), Somerset (The Newt), Hampshire (Lime Wood), Surrey (Star Inn Lingfield). Also sub-trip May 6-8 to Amsterdam, Netherlands.
19. May 25: "Alice's Flight: London Heathrow to Austin | Heathrow Airport" — flew back to Austin. May 25 = UK travel day.
20. May 26 – May 30: Austin TX.
21. May 31 – Jun 8: United States — California road trip. "TRAVEL: California | May 31 - June 7". AUS→SFO (AS 1369 May 31), Sonoma/Healdsburg (Jun 3-4 SingleThread), Santa Barbara (Hotel Californian Jun 5-7), LAX→AUS (DL 622 Jun 8).
22. Jun 10: Flew Austin → Paris (via Amsterdam AMS). Jun 10 = US day.
23. Jun 11–16: France (Paris: Place Vendôme, Château du Feÿ near Sens, then Saint James Paris).
24. Jun 17: Flew Paris CDG → Milan LIN (AF1012). Jun 17 = France/Italy travel.
25. Jun 17–27: Italy (Milan → Lake Garda Sirmione Jun 19-21, Torri del Benaco Jun 21-23, Dolomites/Forestis Jun 23-27).
26. Jun 27: Flew Verona → London Gatwick. Jun 27 = Italy→UK.
27. Jun 27 – Jul 1: UK (Kent: Hever Castle, Gravetye Manor Sussex, Bingham Riverhouse Richmond).
28. Jul 2: Flew London Heathrow → Austin. Jul 2 = UK travel day / arrive US.
29. Jul 3–8: Austin TX.
30. Jul 9: Flew Austin → Montreal (AC 1050). Jul 9 = US day (departed Austin).
31. Jul 9–12: Canada (Montreal — wedding events for Sasha & Robyn).
32. Jul 13: Flew Montreal → San Jose Costa Rica. Jul 13 = Canada.
33. Jul 14–20: Costa Rica (Santa Teresa, Puntarenas — Vida Nova Casa Resort).
34. Jul 21: Flew Cobano → SJO → Houston IAH → Austin AUS. Jul 21 = US day (arrived US via IAH).
35. Jul 22–29: Austin TX.
36. Jul 30: Flew Austin → Newark EWR (UA 249). Jul 30 = US day.
37. Jul 31 – Aug 3: New York City (Weill Cornell tests Jul 31, Comedy Club Aug 1, dinner RH Guesthouse Aug 3).
38. Aug 4: Flew back to Austin (confirmed by Aug 4 Austin lunch at Quince Lakehouse). Aug 4 = US.
39. Aug 5–7: Austin TX (Aug 7 = fly to London).
40. Aug 8: Arrived London (The Guardsman Hotel). Aug 8 = UK.
41. Aug 8–20: UK (London, Winchester/Lainston House, Norwich day trip, Corinthia London).
42. Aug 21: Flew London Gatwick → Naples (easyJet EJU8351). Aug 21 = UK→Italy.
43. Aug 21–23: Italy — Amalfi (Anantara Convento di Amalfi Grand Hotel).
44. Aug 24: Flew Naples → Rome (AZ1274). Aug 24 = Italy.
45. Aug 24–25: Rome (Six Senses Rome); also day trip to Pantheon area.
46. Aug 25–27: Italy — Umbria (Villa di Piazzano, Tuoro sul Trasimeno).
47. Aug 27–29: Italy — Umbria (Hotel Castello di Reschio, Lisciano Niccone).
48. Aug 29–31: Italy — Florence (Four Seasons Firenze), Aug 30 Uffizi/Giotto's Bell Tower.
49. Aug 31: Train Florence → Rome (Italo 8907); then flew Rome → Geneva (Sep 1 transfer from Geneva Airport). Aug 31 = Italy.
50. Sep 1: "Private Transfer From Geneva Airport to Hôtel Hameau Albert 1er, Chamonix" — Sep 1 = France.
51. Sep 1–4: France (Chamonix-Mont-Blanc, then Les Houches, Les Contamines, Bourg-Saint-Maurice / Les Arcs).
52. Sep 5–6: Italy (Courmayeur, Aosta Valley — Grand Hotel Courmayeur Mont Blanc).
53. Sep 7–8: Switzerland (Bourg-Saint-Pierre, Champex-Lac — Alpine hiking tour).
54. Sep 9–10: France (Chamonix — Hameau Albert 1er).
55. Sep 11: Drove Chamonix → Geneva Airport, flew Geneva → London (LX348 Swiss). Sep 11 = UK.
56. Sep 11–21: UK (London: May Fair King hotel, Passport office Sep 12 & 15, Sondheim Theatre, trip to Harrogate Sep 19-21).
57. Sep 22: "Flight: Heathrow to Austin | BA 191" — flew London → Austin. Sep 22 = UK travel day.
58. Sep 23 – Oct 1: Austin TX.
59. Oct 2–5: New York City (18 W 18th St Oct 2, HairSpot NYC Oct 3, dinner Chelsea Oct 4).
60. Oct 6–18: Austin TX (returned from NYC around Oct 5-6).
61. Oct 19: Flew Austin → JFK (DL 2323). Oct 19 = US day.
62. Oct 19–26: New York City (Frontline CEOs Oct 20, Twenty Two hotel Oct 23-26, Prenuvo MRI Oct 24, Konban Oct 26).
63. Oct 26: Flew JFK → Austin (DL 1233). Oct 26 = US day.
64. Oct 27 – Nov 20: Austin TX.
65. Nov 21: Flew Austin → Montreal (UA 8305). Nov 21 = US day (departed Austin).
66. Nov 22–23: Canada (Montreal — Bota Bota, dinners).
67. Nov 23: Flew Montreal → Newark (UA 3580) — arrived NYC. Nov 23 = US day.
68. Nov 24–30: New York City (Suited NYC Nov 25, Equinox Hotel Nov 26, ATLA Noho Nov 29).
69. Nov 30: Flew Newark → Austin (UA 676). Nov 30 = US day.
70. Dec 1–7: Austin TX.
71. Dec 8: Flew Austin → San Francisco (UA 1668). Dec 8 = US day.
72. Dec 8–12: United States — San Francisco/California.
73. Dec 12: Flew San Francisco → Austin (Southwest WN 833). Dec 12 = US day.
74. Dec 12–17: Austin TX (baby shower Dec 13, dental Dec 16, dinner Dec 17).
75. Dec 17: Flew Austin → London Heathrow (BA 190 overnight). Dec 17 = US day.
76. Dec 18: Arrived London (The Chancery Rosewood, Grosvenor Sq). Dec 18 = UK.
77. Dec 18–25: UK (London — Chancery Rosewood Dec 18-20, Broadwick Soho Dec 20-25; Chichester day trip Dec 23; Royal Albert Hall Dec 22).
78. Dec 26: Flew London Heathrow → Hong Kong (CX 238). Dec 26 = UK travel day.
79. Dec 27: Hong Kong (Four Seasons Hotel Hong Kong).
80. Dec 28: Flew Hong Kong → Nadi, Fiji (FJ 392); helicopter to Namotu Island. Dec 28 = transit/Fiji.
81. Dec 29–31: Fiji (Namotu Island Resort).

GOOGLE CALENDAR EVENTS (Alice's calendar only — physical locations and travel keywords):
${calJson}

GMAIL FLIGHT & HOTEL BOOKING EMAILS (2025):
${emailJson}

Based on the KNOWN FACTS above (which are highly reliable) and the supporting calendar/email data, output ONLY a valid JSON object (no markdown, no explanation):
{
  "timeline": [
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "country": "United States",
      "city": "Austin",
      "confidence": "high",
      "evidence": "brief description of what data supports this",
      "notes": "optional notes e.g. travel day, arrived in evening"
    }
  ],
  "totalUsDays": 0,
  "summary": "one paragraph summary"
}

The timeline array must cover Jan 1 2025 through Dec 31 2025 with no gaps and no overlaps. startDate and endDate are both inclusive.`

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt,
    maxTokens: 8000,
  })

  // Extract JSON - handle cases where model wraps in markdown
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Raw AI response:\n', text.substring(0, 500))
    throw new Error('Could not extract JSON from AI response')
  }

  const result = JSON.parse(jsonMatch[0]) as SynthesisResult
  console.log(`   Timeline generated: ${result.timeline.length} periods`)
  console.log(`   Estimated US days: ${result.totalUsDays}`)
  return result
}

// ────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ────────────────────────────────────────────────────────────────────────────

const COUNTRY_COLORS: Record<string, string> = {
  'United States': 'FFD9EAD3',
  'United Kingdom': 'FFCFE2F3',
  France: 'FFFFF2CC',
  Germany: 'FFFCE5CD',
  Italy: 'FFEAD1DC',
  Spain: 'FFFFFDE7',
  Portugal: 'FFE6F4EA',
  Netherlands: 'FFFCE5CD',
  Switzerland: 'FFFE2729',
  Australia: 'FFFFE599',
  Unknown: 'FFFCE4D6',
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

async function exportToExcel(result: SynthesisResult): Promise<void> {
  console.log('\n📊 Exporting to Excel...')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Alice Wyatt Travel Timeline Script'
  wb.created = new Date()

  // ── Sheet 1: Timeline ──────────────────────────────────────────────────────
  const ws = wb.addWorksheet('2025 Country Timeline', {
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  // Title row
  ws.mergeCells('A1:H1')
  const titleCell = ws.getCell('A1')
  titleCell.value = '2025 Travel Timeline — Substantial Presence Test'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F497D' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 28

  // Header row
  ws.getRow(2).values = ['Start Date', 'End Date', 'Country', 'City', 'Days', 'Confidence', 'Evidence', 'Notes']
  ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F497D' },
  }
  ws.getRow(2).height = 20
  ws.getRow(2).alignment = { vertical: 'middle' }

  ws.columns = [
    { key: 'startDate', width: 14 },
    { key: 'endDate', width: 14 },
    { key: 'country', width: 22 },
    { key: 'city', width: 18 },
    { key: 'days', width: 8 },
    { key: 'confidence', width: 13 },
    { key: 'evidence', width: 55 },
    { key: 'notes', width: 35 },
  ]

  // Data rows
  for (const period of result.timeline) {
    const days = daysBetween(period.startDate, period.endDate)
    const row = ws.addRow({
      startDate: period.startDate,
      endDate: period.endDate,
      country: period.country,
      city: period.city ?? '',
      days,
      confidence: period.confidence,
      evidence: period.evidence,
      notes: period.notes ?? '',
    })

    const bgColor = COUNTRY_COLORS[period.country] ?? 'FFFFFFFF'
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.alignment = { wrapText: colNum >= 7, vertical: 'middle' }
      if (period.confidence === 'low') {
        cell.font = { italic: true, color: { argb: 'FF7F7F7F' } }
      }
    })
    row.height = 18
  }

  // Totals section
  ws.addRow([])
  const countByCountry: Record<string, number> = {}
  for (const p of result.timeline) {
    const days = daysBetween(p.startDate, p.endDate)
    countByCountry[p.country] = (countByCountry[p.country] ?? 0) + days
  }

  const summaryStartRow = ws.rowCount + 1
  ws.getCell(`A${summaryStartRow}`).value = 'SUMMARY'
  ws.getCell(`A${summaryStartRow}`).font = { bold: true, size: 12 }

  let r = summaryStartRow + 1
  for (const [country, days] of Object.entries(countByCountry).sort((a, b) => b[1] - a[1])) {
    ws.getCell(`A${r}`).value = country
    ws.getCell(`B${r}`).value = `${days} days`
    ws.getCell(`A${r}`).font = { bold: true }
    r++
  }

  ws.addRow([])
  const noteRow = ws.addRow([
    '⚠ SPT Note:',
    'A person is a US resident if present 31+ days in the current year AND 183+ days over the current + 2 prior years (current = 1x, prior year = 1/3x, year before = 1/6x).',
  ])
  noteRow.getCell(1).font = { bold: true, color: { argb: 'FFC00000' } }
  noteRow.getCell(2).alignment = { wrapText: true }
  ws.mergeCells(`B${noteRow.number}:H${noteRow.number}`)

  const aiRow = ws.addRow([
    '⚠ Accuracy:',
    'This timeline was generated by AI from Google Calendar & Gmail data. Review each period and correct any errors before relying on it for tax purposes.',
  ])
  aiRow.getCell(1).font = { bold: true, color: { argb: 'FFBF5700' } }
  aiRow.getCell(2).alignment = { wrapText: true }
  ws.mergeCells(`B${aiRow.number}:H${aiRow.number}`)

  // ── Sheet 2: Summary per country ──────────────────────────────────────────
  const ws2 = wb.addWorksheet('Country Summary')
  ws2.columns = [
    { header: 'Country', key: 'country', width: 25 },
    { header: 'Total Days (2025)', key: 'days', width: 20 },
  ]
  ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }

  for (const [country, days] of Object.entries(countByCountry).sort((a, b) => b[1] - a[1])) {
    ws2.addRow({ country, days })
  }

  ws2.addRow([])
  ws2.addRow({ country: 'AI Summary:', days: result.summary })

  await wb.xlsx.writeFile(OUTPUT_PATH)
  console.log(`   ✓ Saved to: data/travel-timeline-2025.xlsx`)
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(65))
  console.log('  2025 Travel Timeline — Substantial Presence Test')
  console.log('='.repeat(65))

  // Check for cached raw data (skip refetch if re-running analysis only)
  let calEvents: CalendarEvent[]
  let emails: TravelEmail[]

  const useCache = process.argv.includes('--use-cache') && fs.existsSync(RAW_DATA_PATH)
  if (useCache) {
    console.log('\n♻️  Using cached raw data from data/travel-raw-2025.json')
    const raw = JSON.parse(fs.readFileSync(RAW_DATA_PATH, 'utf-8'))
    calEvents = raw.calEvents
    emails = raw.emails
  } else {
    calEvents = await fetchCalendarData()
    emails = await fetchGmailData()

    // Cache for potential re-runs
    fs.writeFileSync(RAW_DATA_PATH, JSON.stringify({ calEvents, emails }, null, 2))
    console.log(`\n💾 Raw data cached to: data/travel-raw-2025.json`)
  }

  const result = await synthesizeTimeline(calEvents, emails)

  await exportToExcel(result)

  console.log('\n' + '='.repeat(65))
  console.log(`  Done! US days in 2025 (estimated): ${result.totalUsDays}`)
  console.log('='.repeat(65))
  console.log('\nSummary:', result.summary)
  console.log('\n⚠️  Please review the Excel file carefully before using for tax purposes.')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
