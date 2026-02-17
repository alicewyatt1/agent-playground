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
  'food delivery',
  'food ordering',
  'pizza',
  'fast casual',
  'drive-thru',
  'drive thru',
]

const BROAD_KEYWORDS = ['hospitality', 'franchise']

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})
const firecrawl = app.v1

interface PageMatch {
  pageUrl: string
  keywords: string[]
  broadKeywords: string[]
  contexts: string[]
}

interface Result {
  url: string
  company: string
  pagesScraped: number
  directMatch: boolean
  broadMatch: boolean
  matchedKeywords: string[]
  broadMatchedKeywords: string[]
  pageMatches: PageMatch[]
  errors: string[]
}

function extractCompanyName(url: string): string {
  const hostname = new URL(url).hostname
    .replace(/^www\./, '')
    .replace(/\.(com|net|ai|io).*$/, '')
  return hostname
}

function extractLinksFromMarkdown(
  markdown: string,
  baseUrl: string
): string[] {
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  const links: string[] = []
  const baseOrigin = new URL(baseUrl).origin

  let match
  while ((match = linkRegex.exec(markdown)) !== null) {
    const linkText = match[1].toLowerCase()
    let href = match[2]

    // Only follow internal links
    if (href.startsWith('/')) {
      href = baseOrigin + href
    }
    if (!href.startsWith(baseOrigin)) continue

    // Check if link text or URL suggests industry/solutions content
    const relevant = [
      'industr',
      'sector',
      'solution',
      'vertical',
      'market',
      'about',
      'service',
      'food',
      'restaurant',
      'qsr',
      'hospitality',
      'beverage',
      'client',
      'case.stud',
    ]
    const combined = (linkText + ' ' + href).toLowerCase()
    if (relevant.some((r) => combined.includes(r))) {
      links.push(href)
    }
  }

  return [...new Set(links)]
}

function findMatches(
  text: string,
  keywords: string[]
): { found: string[]; contexts: string[] } {
  const lower = text.toLowerCase()
  const found: string[] = []
  const contexts: string[] = []

  for (const kw of keywords) {
    let searchFrom = 0
    while (searchFrom < lower.length) {
      const idx = lower.indexOf(kw, searchFrom)
      if (idx === -1) break
      if (!found.includes(kw)) found.push(kw)
      const start = Math.max(0, idx - 80)
      const end = Math.min(text.length, idx + kw.length + 80)
      const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim()
      contexts.push(`"...${snippet}..."`)
      searchFrom = idx + kw.length
    }
  }
  return { found: [...new Set(found)], contexts: [...new Set(contexts)] }
}

async function scrapePage(
  url: string
): Promise<{ success: boolean; markdown: string }> {
  try {
    const response = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 20000,
    })
    if (response.success && response.markdown) {
      return { success: true, markdown: response.markdown }
    }
    return { success: false, markdown: '' }
  } catch {
    return { success: false, markdown: '' }
  }
}

async function deepCheckCompany(url: string): Promise<Result> {
  const company = extractCompanyName(url)
  const result: Result = {
    url,
    company,
    pagesScraped: 0,
    directMatch: false,
    broadMatch: false,
    matchedKeywords: [],
    broadMatchedKeywords: [],
    pageMatches: [],
    errors: [],
  }

  // Step 1: Scrape homepage
  const homepage = await scrapePage(url)
  if (!homepage.success) {
    result.errors.push('homepage scrape failed')
    return result
  }
  result.pagesScraped++

  // Check homepage for keywords
  const homeDirect = findMatches(homepage.markdown, KEYWORDS)
  const homeBroad = findMatches(homepage.markdown, BROAD_KEYWORDS)

  if (homeDirect.found.length > 0 || homeBroad.found.length > 0) {
    result.pageMatches.push({
      pageUrl: url,
      keywords: homeDirect.found,
      broadKeywords: homeBroad.found,
      contexts: [...homeDirect.contexts, ...homeBroad.contexts].slice(0, 3),
    })
  }

  if (homeDirect.found.length > 0) {
    result.directMatch = true
    result.matchedKeywords.push(...homeDirect.found)
  }
  if (homeBroad.found.length > 0) {
    result.broadMatch = true
    result.broadMatchedKeywords.push(...homeBroad.found)
  }

  // Step 2: Extract links to industry/solutions pages from homepage
  const subLinks = extractLinksFromMarkdown(homepage.markdown, url)
  const linksToScrape = subLinks.slice(0, 10) // Cap at 10 subpages

  // Step 3: Scrape subpages in parallel (batches of 3)
  for (let i = 0; i < linksToScrape.length; i += 3) {
    const batch = linksToScrape.slice(i, i + 3)
    const results = await Promise.all(batch.map((link) => scrapePage(link)))

    for (let j = 0; j < results.length; j++) {
      const pageResult = results[j]
      const pageUrl = batch[j]
      if (!pageResult.success) continue
      result.pagesScraped++

      const direct = findMatches(pageResult.markdown, KEYWORDS)
      const broad = findMatches(pageResult.markdown, BROAD_KEYWORDS)

      if (direct.found.length > 0 || broad.found.length > 0) {
        result.pageMatches.push({
          pageUrl,
          keywords: direct.found,
          broadKeywords: broad.found,
          contexts: [...direct.contexts, ...broad.contexts].slice(0, 3),
        })
      }

      if (direct.found.length > 0) {
        result.directMatch = true
        result.matchedKeywords.push(...direct.found)
      }
      if (broad.found.length > 0) {
        result.broadMatch = true
        result.broadMatchedKeywords.push(...broad.found)
      }
    }
  }

  result.matchedKeywords = [...new Set(result.matchedKeywords)]
  result.broadMatchedKeywords = [...new Set(result.broadMatchedKeywords)]

  return result
}

async function main() {
  console.log(
    `Deep-crawling ${urls.length} companies for restaurant/QSR industry mentions...\n`
  )
  console.log(
    `Strategy: scrape homepage → extract industry/solutions links → scrape subpages\n`
  )

  const results: Result[] = []

  // Process companies 2 at a time (each does multiple scrapes)
  const batchSize = 2
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    console.log(
      `[${i + 1}-${Math.min(i + batchSize, urls.length)}/${urls.length}] ${batch.map((u) => extractCompanyName(u)).join(', ')}...`
    )
    const batchResults = await Promise.all(
      batch.map((url) => deepCheckCompany(url))
    )
    results.push(...batchResults)

    for (const r of batchResults) {
      const icon = r.directMatch ? '✅' : r.broadMatch ? '🔶' : '❌'
      const kws = [
        ...r.matchedKeywords,
        ...r.broadMatchedKeywords.map((k) => `(${k})`),
      ]
      console.log(
        `  ${icon} ${r.company} [${r.pagesScraped} pages] ${kws.length > 0 ? `[${kws.join(', ')}]` : ''}`
      )
    }
  }

  // Summary
  const directMatches = results.filter((r) => r.directMatch)
  const broadOnly = results.filter((r) => !r.directMatch && r.broadMatch)
  const noMatches = results.filter((r) => !r.directMatch && !r.broadMatch)

  console.log('\n' + '='.repeat(90))
  console.log('DEEP CRAWL RESULTS')
  console.log('='.repeat(90))

  console.log(
    `\n✅ DIRECT RESTAURANT / QSR / FOOD SERVICE MENTIONS (${directMatches.length}):\n`
  )
  for (const r of directMatches) {
    console.log(`  ${r.company} (${r.url})`)
    console.log(`    Direct keywords: ${r.matchedKeywords.join(', ')}`)
    if (r.broadMatchedKeywords.length > 0)
      console.log(`    Broad keywords: ${r.broadMatchedKeywords.join(', ')}`)
    console.log(`    Pages scraped: ${r.pagesScraped}`)
    for (const pm of r.pageMatches) {
      if (pm.keywords.length > 0) {
        console.log(`    📄 ${pm.pageUrl}`)
        for (const ctx of pm.contexts.slice(0, 2)) {
          console.log(`       ${ctx}`)
        }
      }
    }
    console.log()
  }

  console.log(
    `\n🔶 BROAD "HOSPITALITY/FRANCHISE" ONLY — May be travel/hotels (${broadOnly.length}):\n`
  )
  for (const r of broadOnly) {
    console.log(`  ${r.company} (${r.url})`)
    console.log(`    Keywords: ${r.broadMatchedKeywords.join(', ')}`)
    console.log(`    Pages scraped: ${r.pagesScraped}`)
    for (const pm of r.pageMatches) {
      console.log(`    📄 ${pm.pageUrl}`)
      for (const ctx of pm.contexts.slice(0, 2)) {
        console.log(`       ${ctx}`)
      }
    }
    console.log()
  }

  console.log(`\n❌ NO MATCHES FOUND (${noMatches.length}):\n`)
  for (const r of noMatches) {
    console.log(
      `  • ${r.company} (${r.url}) — ${r.pagesScraped} pages scraped${r.errors.length > 0 ? ' ⚠️ ' + r.errors[0] : ''}`
    )
  }
}

main().catch(console.error)
