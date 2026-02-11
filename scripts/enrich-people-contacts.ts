import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT_PATH = path.resolve(
  '/Users/alicewyatt/Downloads/Find-people-Table-Default-view-export-1770826419870.csv'
)
const OUTPUT_PATH = path.resolve(__dirname, '../data/people-contacts-enriched.csv')

// ─── Name corrections (resolved from LinkedIn URLs or existing emails) ───
const NAME_CORRECTIONS: Record<
  string,
  { firstName?: string; lastName: string; fullName: string }
> = {
  // LinkedIn URL: jeff-nocero-2026075b
  'https://www.linkedin.com/in/jeff-nocero-2026075b/': {
    firstName: 'Jeff',
    lastName: 'Nocero',
    fullName: 'Jeff Nocero',
  },
  // LinkedIn URL: cameronsymonds
  'https://www.linkedin.com/in/cameronsymonds/': {
    lastName: 'Symonds',
    fullName: 'Cameron Symonds',
  },
  // Email reveals: liliana.lopez@liveops.com
  'https://www.linkedin.com/in/liliana-l-92035441/': {
    lastName: 'Lopez',
    fullName: 'Liliana Lopez',
  },
  // Email reveals: ali.karim@datamark.net; LinkedIn URL: mohammadalikarim
  'https://www.linkedin.com/in/mohammadalikarim/': {
    lastName: 'Karim',
    fullName: 'Ali Karim',
  },
}

// ─── Company email patterns derived from existing contacts ───
// Format: domain -> pattern function(firstName, lastName) -> email
type PatternFn = (firstName: string, lastName: string) => string

const EMAIL_PATTERNS: Record<string, PatternFn> = {
  // firstname.lastname@hartehanks.com (sharona.sankar-king, cindy.stein, peter.detrempe, etc.)
  'hartehanks.com': (f, l) => `${f.toLowerCase()}.${l.toLowerCase()}@hartehanks.com`,

  // first_initial+lastname (abyrne, pgrant) BUT also firstname.lastname (heather.barnes)
  // Most common: first_initial+lastname
  'marketstar.com': (f, l) =>
    `${f[0].toLowerCase()}${l.toLowerCase()}@marketstar.com`,

  // Mixed: first_initial+lastname (mmoore, jbrown) and firstname.lastname (michelle.winnett, bill.trocano)
  // Use firstname.lastname as safer default
  'liveops.com': (f, l) => `${f.toLowerCase()}.${l.toLowerCase()}@liveops.com`,

  // firstname.lastname (yvonne.anderson, julie.white, aaron.brooks, etc.)
  'infocision.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@infocision.com`,

  // firstname.lastname (mario.baddour, david.sokolitz, etc.)
  'intelogix.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@intelogix.com`,

  // firstname.lastname (john.porter, jan.santafede, etc.)
  'focusservices.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@focusservices.com`,

  // firstname@unity-connect.com (ron, patrick)
  'unity-connect.com': (f, _l) => `${f.toLowerCase()}@unity-connect.com`,

  // firstname.lastname (john.hyde, tim.lawson)
  'officebeacon.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@officebeacon.com`,

  // first_initial+lastname (cmolloy, mshea)
  'americancustomercare.com': (f, l) =>
    `${f[0].toLowerCase()}${l.toLowerCase()}@americancustomercare.com`,

  // firstname.lastname (bryan.overcash, frank.camp)
  'gcsagents.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@gcsagents.com`,

  // firstname@supportyourapp.com (daria) or first_initial+lastname (egordienko)
  'supportyourapp.com': (f, _l) => `${f.toLowerCase()}@supportyourapp.com`,

  // first_initial+lastname (balpert, jgluck, jbell)
  'theofficegurus.com': (f, l) =>
    `${f[0].toLowerCase()}${l.toLowerCase()}@theofficegurus.com`,

  // firstname.lastname (brenden.faber, chris.lawless)
  'adec-innovations.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@adec-innovations.com`,

  // first_initial+lastname (dsudolsky, mparker)
  'boldrimpact.com': (f, l) =>
    `${f[0].toLowerCase()}${l.toLowerCase()}@boldrimpact.com`,

  // firstname.lastname (elizabeth.sadler, kristen.rowles, etc.)
  'cbecompanies.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@cbecompanies.com`,

  // firstname@directinteractions.com (jonas)
  'directinteractions.com': (f, _l) =>
    `${f.toLowerCase()}@directinteractions.com`,

  // firstname@openaccessbpo.com (ben)
  'openaccessbpo.com': (f, _l) => `${f.toLowerCase()}@openaccessbpo.com`,

  // firstname@thefunctionary.com (sam, david)
  'thefunctionary.com': (f, _l) => `${f.toLowerCase()}@thefunctionary.com`,

  // firstname@azpired.com (almira)
  'azpired.com': (f, _l) => `${f.toLowerCase()}@azpired.com`,

  // firstname.lastname (victor.pereda)
  'nearsol.com': (f, l) => `${f.toLowerCase()}.${l.toLowerCase()}@nearsol.com`,

  // firstname.lastname (gabriel.grover)
  'quantanite.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@quantanite.com`,

  // firstname@sourcefit.com (Andy)
  'sourcefit.com': (f, _l) => `${f.toLowerCase()}@sourcefit.com`,

  // firstname@supportzebra.com (nathan)
  'supportzebra.com': (f, _l) => `${f.toLowerCase()}@supportzebra.com`,

  // firstname@myvirtudesk.com (pavel)
  'myvirtudesk.com': (f, _l) => `${f.toLowerCase()}@myvirtudesk.com`,

  // first_initial+lastname (jvalenzuela)
  'visayakpo.com': (f, l) =>
    `${f[0].toLowerCase()}${l.toLowerCase()}@visayakpo.com`,

  // firstname.lastname (ali.karim, matt.lochausen, victor.saenz, etc.)
  'datamark.net': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@datamark.net`,

  // firstname.lastname@etechgs.com (matt.rocco, gurudatt.medtia, ronnie.mize, etc.)
  'etechgs.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@etechgs.com`,

  // firstnamelastname@buwelo.com (brianbeckstead, robertshiner, markdangola, kevincharles)
  'buwelo.com': (f, l) =>
    `${f.toLowerCase()}${l.toLowerCase()}@buwelo.com`,

  // firstname.lastname (john.craine, tino.davila, sharen.hammond, mike.ramirez)
  'valorglobal.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@valorglobal.com`,

  // first_initial+lastname (cgunn, mwichser, santhony, swichser, ihunter) except CEO
  'nexrep.com': (f, l) =>
    `${f[0].toLowerCase()}${l.toLowerCase()}@nexrep.com`,

  // firstname.lastname (brian.flaherty, erika.garcia, faye.rucker)
  'globalstrategic.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@globalstrategic.com`,

  // mixed: c.crisler, jacob.moelter, brantley.peers, ken@, jmilocco
  // Default to firstname.lastname
  'supportninja.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@supportninja.com`,

  // firstname.lastname (rob.goeller, jen.hanel, austin.credaroli, doug.debolt)
  'clearsourcebpo.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@clearsourcebpo.com`,

  // firstname@hugotech.co (different domain from hugoinc.com!)
  'hugoinc.com': (f, _l) => `${f.toLowerCase()}@hugotech.co`,

  // mixed: r.nash, angella.kakumirizi, dylan@, marcus@, donny.jackson, etc.
  // Default to firstname.lastname
  'helpware.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@helpware.com`,

  // firstname.lastname or first_initial+lastname (dkreiss)
  // Default to firstname.lastname
  'km2solutions.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@km2solutions.com`,

  // firstname.lastname (satish.varanasi, tina.hammons, wen.yu, patrick.daly, etc.)
  'unifycx.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@unifycx.com`,

  // firstname.lastname (merideth.evans, ivy.field, darren.smith, etc.)
  'percepta.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@percepta.com`,

  // RK@contactpoint360.com (initials)
  'contactpoint360.com': (f, l) =>
    `${f[0].toLowerCase()}${l[0].toLowerCase()}@contactpoint360.com`,

  // firstname@firstcontactbpo.com (pablo)
  'firstcontactbpo.com': (f, _l) =>
    `${f.toLowerCase()}@firstcontactbpo.com`,

  // firstname.lastname (ron.howe, rob.porges, nitesh.kumar, ofir.nir)
  'flatworldsolutions.com': (f, l) =>
    `${f.toLowerCase()}.${l.toLowerCase()}@flatworldsolutions.com`,
}

// ─── Helper to check if a last name looks abbreviated (single char optionally followed by period) ───
function isAbbreviatedName(name: string): boolean {
  const cleaned = name.replace(/[.,]/g, '').trim()
  // Single letter (e.g. "C.", "M", "N.") = abbreviated
  // Two+ letters (e.g. "Yu", "Li") = real name
  return cleaned.length === 1
}

async function main() {
  console.log('Reading input CSV...')
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8')
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })

  console.log(`Parsed ${records.length} contacts\n`)

  let namesFixed = 0
  let emailsFilled = 0
  const unfixableNames: string[] = []
  const unfixableEmails: string[] = []

  for (const row of records) {
    const linkedinUrl = (row['LinkedIn Profile'] || '').trim()
    const domain = (row['Company Domain'] || '').trim()
    const firstName = (row['First Name'] || '').trim()
    const lastName = (row['Last Name'] || '').trim()
    const fullName = (row['Full Name'] || '').trim()
    const existingEmail = (row['Work Email'] || '').trim()

    // ─── Step 1: Fix abbreviated names ───
    if (isAbbreviatedName(lastName) && linkedinUrl) {
      const correction = NAME_CORRECTIONS[linkedinUrl]
      if (correction) {
        console.log(
          `  ✓ Name fix: ${fullName} → ${correction.fullName} (from ${correction.lastName === 'Lopez' || correction.lastName === 'Karim' ? 'email pattern' : 'LinkedIn URL'})`
        )
        row['Last Name'] = correction.lastName
        row['Full Name'] = correction.fullName
        if (correction.firstName) {
          row['First Name'] = correction.firstName
        }
        namesFixed++
      } else {
        unfixableNames.push(
          `${fullName} (${row['Company Name']}) - LinkedIn last name hidden`
        )
      }
    }

    // ─── Step 2: Fill missing emails ───
    if (!existingEmail && domain) {
      const currentFirstName = (row['First Name'] || '').trim()
      const currentLastName = (row['Last Name'] || '').trim()

      // Can't derive email without both name parts
      if (isAbbreviatedName(currentLastName)) {
        unfixableEmails.push(
          `${row['Full Name']} (${row['Company Name']}) - last name unknown`
        )
        continue
      }

      if (!currentFirstName || !currentLastName) {
        unfixableEmails.push(
          `${row['Full Name']} (${row['Company Name']}) - missing name parts`
        )
        continue
      }

      const patternFn = EMAIL_PATTERNS[domain]
      if (patternFn) {
        // Clean name parts for email generation
        const cleanFirst = currentFirstName.split(' ')[0] // Take first word only
        const cleanLast = currentLastName
          .replace(/,.*$/, '') // Remove suffixes like ", MBA"
          .replace(/\s+/g, '') // Remove spaces in compound names like "Van Scyoc"
          .trim()

        const generatedEmail = patternFn(cleanFirst, cleanLast)
        row['Work Email'] = generatedEmail
        console.log(
          `  ✉ Email: ${row['Full Name']} → ${generatedEmail} (derived from ${domain} pattern)`
        )
        emailsFilled++
      } else {
        unfixableEmails.push(
          `${row['Full Name']} (${row['Company Name']}, ${domain}) - no email pattern`
        )
      }
    }
  }

  // ─── Write output ───
  const columns = Object.keys(records[0])
  const output = stringify(records, { header: true, columns })
  fs.writeFileSync(OUTPUT_PATH, output)

  // ─── Summary ───
  console.log('\n' + '═'.repeat(60))
  console.log('ENRICHMENT SUMMARY')
  console.log('═'.repeat(60))
  console.log(`Total contacts: ${records.length}`)
  console.log(`Names corrected: ${namesFixed}`)
  console.log(`Emails filled: ${emailsFilled}`)

  if (unfixableNames.length > 0) {
    console.log(`\n⚠ Could NOT resolve full names (${unfixableNames.length}):`)
    for (const n of unfixableNames) {
      console.log(`  - ${n}`)
    }
  }

  if (unfixableEmails.length > 0) {
    console.log(
      `\n⚠ Could NOT derive emails (${unfixableEmails.length}):`
    )
    for (const e of unfixableEmails) {
      console.log(`  - ${e}`)
    }
  }

  console.log(`\nOutput: ${OUTPUT_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main }
