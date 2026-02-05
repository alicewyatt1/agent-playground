/**
 * Quick check that FIRECRAWL_API_KEY is set and valid.
 * Run from project root: pnpm start scripts/check-firecrawl-api.ts
 * Or: npx tsx scripts/check-firecrawl-api.ts
 */
import 'dotenv/config';
import Firecrawl from '@mendable/firecrawl-js';

const key = process.env.FIRECRAWL_API_KEY;

if (!key) {
  console.error('❌ FIRECRAWL_API_KEY is not set.');
  console.log('   Add it to your .env file: FIRECRAWL_API_KEY=your_key_here');
  process.exit(1);
}

// Don't log the key, just show it's present
console.log('✓ FIRECRAWL_API_KEY is set (' + key.length + ' chars)');

async function main() {
  const firecrawl = new Firecrawl({ apiKey: key });
  try {
    const result = await firecrawl.scrape('https://example.com', {
      formats: ['markdown'],
    });
    if (result?.markdown) {
      console.log('✓ API key is valid. Scraped example.com successfully.');
      console.log('  Preview:', result.markdown.slice(0, 80).replace(/\n/g, ' ') + '...');
    } else {
      console.error('❌ Unexpected response (no markdown):', typeof result, Object.keys(result ?? {}));
      process.exit(1);
    }
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; response?: { data?: unknown } };
    console.error('❌ Firecrawl API error:', e.message ?? e);
    if (e.status === 401) {
      console.log('   Your API key may be invalid or expired. Check https://firecrawl.dev or your dashboard.');
    }
    process.exit(1);
  }
}

main();
