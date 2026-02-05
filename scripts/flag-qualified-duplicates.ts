import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const QUALIFIED_JSON = path.join(__dirname, '..', 'data', 'qualified-for-captive-check.json')

type QualifiedEntry = { company_name: string; website: string }

function normalizeWebsite(url: string): string {
  if (!url || url === '/') return ''
  let u = url.trim().toLowerCase()
  u = u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').split('/')[0] ?? ''
  return u
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b(inc\.?|llc|ltd\.?|co\.?|corp\.?|corporation|limited|plc|pvt\.?|sa|s\.a\.?|group|international|solutions|services|philippines|inc)\b\.?/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
  const wordsA = new Set(na.split(/\s+/).filter(Boolean))
  const wordsB = new Set(nb.split(/\s+/).filter(Boolean))
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union === 0 ? 0 : intersection / union
}

async function main() {
  const raw = fs.readFileSync(QUALIFIED_JSON, 'utf-8')
  const list: QualifiedEntry[] = JSON.parse(raw)

  const byWebsite = new Map<string, QualifiedEntry[]>()
  for (const entry of list) {
    const key = normalizeWebsite(entry.website)
    if (!key) continue
    if (!byWebsite.has(key)) byWebsite.set(key, [])
    byWebsite.get(key)!.push(entry)
  }

  const websiteDuplicates: { website: string; entries: QualifiedEntry[] }[] = []
  for (const [site, entries] of byWebsite) {
    if (entries.length > 1) websiteDuplicates.push({ website: site, entries })
  }

  const nameDuplicates: { name1: string; name2: string; website1: string; website2: string; similarity: number }[] = []
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      const sim = nameSimilarity(a.company_name, b.company_name)
      if (sim >= 0.6 && normalizeWebsite(a.website) !== normalizeWebsite(b.website)) {
        nameDuplicates.push({
          name1: a.company_name,
          name2: b.company_name,
          website1: a.website,
          website2: b.website,
          similarity: Math.round(sim * 100) / 100,
        })
      }
    }
  }

  const out: string[] = []
  out.push('# Suspected duplicate accounts – qualified list\n')
  out.push('## 1. Same website (likely duplicates)\n')
  out.push('These rows share the same normalized website and are strong candidates for merging or removing one.\n')
  for (const { website, entries } of websiteDuplicates.sort((a, b) => b.entries.length - a.entries.length)) {
    out.push(`**Website:** \`${website}\``)
    for (const e of entries) {
      out.push(`- **${e.company_name}** — ${e.website}`)
    }
    out.push('')
  }

  out.push('## 2. Similar company names, different websites\n')
  out.push('These pairs have similar names but different URLs. Review to see if they are the same company (e.g. rebrand, typo, or separate entity).\n')
  for (const d of nameDuplicates.slice(0, 40)) {
    out.push(`- **${d.name1}** (${d.website1})  \n  **${d.name2}** (${d.website2})  \n  _similarity: ${d.similarity}_`)
  }
  if (nameDuplicates.length > 40) {
    out.push(`\n_… and ${nameDuplicates.length - 40} more similar-name pairs._`)
  }

  const reportPath = path.join(__dirname, '..', 'data', 'qualified-suspected-duplicates.md')
  fs.writeFileSync(reportPath, out.join('\n'))
  console.log(`Wrote ${reportPath}`)
  console.log(`Same-website groups: ${websiteDuplicates.length} (${websiteDuplicates.reduce((s, g) => s + g.entries.length, 0)} total rows)`)
  console.log(`Similar-name pairs (different site): ${nameDuplicates.length}`)
}

main().catch(console.error)
