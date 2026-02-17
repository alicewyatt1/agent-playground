import { config } from 'dotenv'
import FirecrawlApp from '@mendable/firecrawl-js'

config()

const urls = [
  'https://www.adec-innovations.com',
  'http://www.americancustomercare.com',
  'https://www.azpired.com',
  'https://www.boldrimpact.com',
  'https://www.buwelo.com',
  'https://cbecompanies.com',
  'https://clarkoutsourcing.com/',
  'https://www.clearsourcebpo.com',
  'https://contactpoint360.com',
  'https://datamark.net',
  'https://directinteractions.com',
  'https://www.etechgs.com',
  'https://www.firstcontactbpo.com/',
  'https://www.flatworldsolutions.com',
  'https://focusservices.com',
  'https://gcsagents.com/',
  'https://www.globalstrategic.com',
  'https://www.goanswer.ai',
  'https://hartehanks.com',
  'https://helpware.com/',
  'https://hugoinc.com',
  'https://www.infocision.com',
  'https://intelogix.com',
  'https://km2solutions.com',
  'https://liveops.com',
  'https://www.marketstar.com',
  'https://nearsol.com',
  'https://nexrep.com',
  'https://www.openaccessbpo.com',
  'https://www.officebeacon.com',
  'https://www.percepta.com',
  'https://quantanite.com',
  'https://sourcefit.com',
  'https://supportninja.com',
  'https://supportyourapp.com',
  'https://supportzebra.com',
  'https://thefunctionary.com',
  'https://www.theofficegurus.com',
  'https://www.unifycx.com',
  'https://unity-connect.com',
  'https://valorglobal.com',
  'https://www.myvirtudesk.com',
  'https://visayakpo.com',
  'https://www.altaresources.com',
  'https://www.integraglobalsolutions.com/',
]

const KEYWORDS = [
  'restaurant',
  'qsr',
  'quick service restaurant',
  'food service',
  'foodservice',
  'food & beverage',
  'food and beverage',
  'fast food',
  'dining',
  'hospitality',
  'food delivery',
  'pizza',
  'franchise',
]

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})
const firecrawl = app.v1

interface Result {
  url: string
  company: string
  hasRestaurantQSR: boolean
  matchedKeywords: string[]
  context: string[]
}

function extractCompanyName(url: string): string {
  const hostname = new URL(url).hostname
    .replace(/^www\./, '')
    .replace(/\.(com|net|ai|io).*$/, '')
  return hostname
}

function findKeywordMatches(
  text: string
): { keywords: string[]; contexts: string[] } {
  const lower = text.toLowerCase()
  const keywords: string[] = []
  const contexts: string[] = []

  for (const kw of KEYWORDS) {
    const idx = lower.indexOf(kw)
    if (idx !== -1) {
      keywords.push(kw)
      const start = Math.max(0, idx - 80)
      const end = Math.min(text.length, idx + kw.length + 80)
      const snippet = text.slice(start, end).replace(/\n/g, ' ').trim()
      contexts.push(`...${snippet}...`)
    }
  }

  return { keywords: [...new Set(keywords)], contexts: [...new Set(contexts)] }
}

async function scrapeUrl(url: string): Promise<Result> {
  const company = extractCompanyName(url)
  try {
    const response = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 30000,
    })

    if (!response.success || !response.markdown) {
      return {
        url,
        company,
        hasRestaurantQSR: false,
        matchedKeywords: [],
        context: ['(scrape failed or no content)'],
      }
    }

    const { keywords, contexts } = findKeywordMatches(response.markdown)

    return {
      url,
      company,
      hasRestaurantQSR: keywords.length > 0,
      matchedKeywords: keywords,
      context: contexts.length > 0 ? contexts : ['(no matches found)'],
    }
  } catch (err) {
    return {
      url,
      company,
      hasRestaurantQSR: false,
      matchedKeywords: [],
      context: [`(error: ${(err as Error).message})`],
    }
  }
}

async function main() {
  console.log(
    `Checking ${urls.length} companies for restaurant/QSR industry mentions...\n`
  )

  const results: Result[] = []

  // Process in batches of 5 to respect rate limits
  const batchSize = 5
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(urls.length / batchSize)}...`
    )
    const batchResults = await Promise.all(batch.map((url) => scrapeUrl(url)))
    results.push(...batchResults)

    for (const r of batchResults) {
      const status = r.hasRestaurantQSR ? '✅' : '❌'
      console.log(`  ${status} ${r.company} ${r.hasRestaurantQSR ? `[${r.matchedKeywords.join(', ')}]` : ''}`)
    }
  }

  // Summary
  const matches = results.filter((r) => r.hasRestaurantQSR)
  const noMatches = results.filter((r) => !r.hasRestaurantQSR)

  console.log('\n' + '='.repeat(80))
  console.log('RESULTS SUMMARY')
  console.log('='.repeat(80))

  console.log(
    `\n✅ COMPANIES WITH RESTAURANT/QSR MENTIONS (${matches.length}):\n`
  )
  for (const r of matches) {
    console.log(`  • ${r.company} (${r.url})`)
    console.log(`    Keywords: ${r.matchedKeywords.join(', ')}`)
    for (const ctx of r.context.slice(0, 2)) {
      console.log(`    Context: ${ctx}`)
    }
    console.log()
  }

  console.log(`\n❌ NO RESTAURANT/QSR MENTIONS FOUND (${noMatches.length}):\n`)
  for (const r of noMatches) {
    console.log(`  • ${r.company} (${r.url})`)
    if (r.context[0]?.includes('error') || r.context[0]?.includes('failed')) {
      console.log(`    Note: ${r.context[0]}`)
    }
  }
}

main().catch(console.error)
