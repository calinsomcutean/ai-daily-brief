// Colecteaza articole brute din toate sursele gratuite: RSS, Hacker News, Reddit, arXiv.
// Fiecare sursa e izolata intr-un try/catch — daca un feed pica, restul continua.
// Rezultat: listă de obiecte { title, url, source, sourceTag, weight, publishedAt, summary }

import Parser from 'rss-parser';
import { pathToFileURL } from 'node:url';
import { RSS_FEEDS, HN_CONFIG, REDDIT_CONFIG, ARXIV_CONFIG } from './config/sources.js';

// Multe site-uri (AI News, MarkTechPost, Reddit) blocheaza user-agent-uri generice
// de tip "bot" cu 403/429 — un UA de browser real trece peste tot. Unele WAF-uri
// (inclusiv cele care blocheaza in bloc IP-urile runnerelor GitHub Actions) mai
// verifica si Accept / Accept-Language, asa ca le trimitem pe amandoua.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent': BROWSER_UA,
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Timeout scurt per sursa + 1 retry cu backoff: pe runnerele GitHub Actions unele
// surse pot bloca/incetini cererea, dar de obicei o a doua incercare dupa o mica
// pauza trece. Tinem timpul mic ca sa nu depasim bugetul jobului (timeout-minutes: 10).
const FETCH_TIMEOUT_MS = 8000;
const RETRY_BACKOFF_MS = 1500;

// RSS-urile ruleaza in loturi mici (nu toate deodata) cu o pauza intre loturi,
// ca sa nu arate ca un burst suspect catre WAF-urile care numara cereri simultane.
const RSS_BATCH_SIZE = 6;
const RSS_BATCH_PAUSE_MS = 400;

// Daca prima trecere completa nu aduce niciun articol (semn de blocaj temporar),
// mai incercam o singura data dupa o pauza mai lunga.
const EMPTY_PASS_RETRY_WAIT_MS = 20000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: BROWSER_HEADERS,
});

// Reddit ramane sensibil chiar si cu UA de browser daca cererile vin prea rapid,
// asa ca mai punem si o mica pauza intre subreddit-uri (vezi fetchReddit).
const redditParser = parser;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HOURS_LOOKBACK = Number(process.env.HOURS_LOOKBACK ?? 36);
const cutoff = Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000;

function withinWindow(dateStr) {
  if (!dateStr) return true; // pastram daca nu stim data — mai bine safe
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return true;
  return t >= cutoff;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// O incercare + un retry cu backoff, inainte sa renuntam definitiv la o sursa.
async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    await sleep(RETRY_BACKOFF_MS);
    return fn();
  }
}

async function fetchRss(feed) {
  try {
    const parsed = await withRetry(() => parser.parseURL(feed.url));
    const items = (parsed.items ?? [])
      .filter((it) => withinWindow(it.isoDate ?? it.pubDate))
      .map((it) => ({
        title: (it.title ?? '').trim(),
        url: it.link ?? it.guid ?? '',
        source: feed.name,
        sourceTag: feed.tag,
        weight: feed.weight,
        publishedAt: it.isoDate ?? it.pubDate ?? null,
        summary: (it.contentSnippet ?? it.content ?? '').slice(0, 600),
      }))
      .filter((it) => it.title && it.url);
    console.log(`  [ok] ${feed.name.padEnd(28)} ${items.length} articole`);
    return items;
  } catch (err) {
    console.warn(`  [SKIP] ${feed.name.padEnd(28)} ${err.message}`);
    return [];
  }
}

// Ruleaza toate feed-urile RSS in loturi mici, in paralel in cadrul unui lot,
// cu o pauza intre loturi (vezi RSS_BATCH_SIZE / RSS_BATCH_PAUSE_MS).
async function fetchAllRss() {
  const batches = chunk(RSS_FEEDS, RSS_BATCH_SIZE);
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    const batchResults = await Promise.all(batches[i].map(fetchRss));
    results.push(...batchResults);
    if (i < batches.length - 1) await sleep(RSS_BATCH_PAUSE_MS);
  }
  return results.flat();
}

async function fetchHnQuery(query, sinceUnix) {
  try {
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
      query,
    )}&tags=story&numericFilters=created_at_i>${sinceUnix},points>=${HN_CONFIG.minPoints}`;
    const data = await withRetry(async () => {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: BROWSER_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    return (data.hits ?? [])
      .filter((hit) => hit.title)
      .map((hit) => ({
        title: hit.title.trim(),
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        source: 'Hacker News',
        sourceTag: 'community',
        weight: HN_CONFIG.weight * Math.min(1.3, 1 + hit.points / 1000),
        publishedAt: hit.created_at,
        summary: `${hit.points} puncte, ${hit.num_comments} comentarii pe HN`,
      }));
  } catch (err) {
    console.warn(`  [SKIP] Hacker News (${query}) ${err.message}`);
    return [];
  }
}

// Cele 8 query-uri sunt independente (API public Algolia, fara risc de rate-limit
// real), asa ca le paralelizam in loc sa le rulam pe rand.
async function fetchHackerNews() {
  if (!HN_CONFIG.enabled) return [];
  const sinceUnix = Math.floor(cutoff / 1000);
  const results = await Promise.all(HN_CONFIG.queries.map((query) => fetchHnQuery(query, sinceUnix)));
  const out = results.flat();
  console.log(`  [ok] Hacker News                  ${out.length} articole`);
  return out;
}

async function fetchReddit() {
  if (!REDDIT_CONFIG.enabled) return [];
  const out = [];
  for (const sub of REDDIT_CONFIG.subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/top/.rss?t=day&limit=25`;
      const parsed = await withRetry(() => redditParser.parseURL(url));
      const items = (parsed.items ?? [])
        .filter((it) => withinWindow(it.isoDate ?? it.pubDate))
        .map((it) => ({
          title: (it.title ?? '').trim(),
          url: it.link ?? '',
          source: `r/${sub}`,
          sourceTag: 'community',
          weight: REDDIT_CONFIG.weight,
          publishedAt: it.isoDate ?? it.pubDate ?? null,
          summary: (it.contentSnippet ?? '').slice(0, 400),
        }))
        .filter((it) => it.title && it.url);
      out.push(...items);
    } catch (err) {
      console.warn(`  [SKIP] r/${sub} ${err.message}`);
    }
    await sleep(600); // evita rate-limiting-ul Reddit intre subreddit-uri (ramane secvential — rate-limit real cunoscut)
  }
  console.log(`  [ok] Reddit                       ${out.length} articole`);
  return out;
}

async function fetchArxivCategory(cat) {
  try {
    const url = `http://export.arxiv.org/api/query?search_query=cat:${cat}&sortBy=submittedDate&sortOrder=descending&max_results=${ARXIV_CONFIG.maxPerCategory}`;
    const parsed = await withRetry(() => parser.parseURL(url));
    return (parsed.items ?? [])
      .filter((it) => withinWindow(it.isoDate ?? it.pubDate))
      .map((it) => ({
        title: (it.title ?? '').replace(/\s+/g, ' ').trim(),
        url: it.link ?? '',
        source: `arXiv ${cat}`,
        sourceTag: 'cercetare',
        weight: ARXIV_CONFIG.weight,
        publishedAt: it.isoDate ?? it.pubDate ?? null,
        summary: (it.contentSnippet ?? it.summary ?? '').replace(/\s+/g, ' ').slice(0, 500),
      }))
      .filter((it) => it.title && it.url);
  } catch (err) {
    console.warn(`  [SKIP] arXiv ${cat} ${err.message}`);
    return [];
  }
}

// Cele 3 categorii sunt independente, fara risc de rate-limit gen Reddit,
// asa ca le paralelizam in loc sa le rulam pe rand.
async function fetchArxiv() {
  if (!ARXIV_CONFIG.enabled) return [];
  const results = await Promise.all(ARXIV_CONFIG.categories.map(fetchArxivCategory));
  const out = results.flat();
  console.log(`  [ok] arXiv                        ${out.length} articole`);
  return out;
}

function dedupe(items) {
  const seen = new Map(); // normalized title -> item (pastram pe cel cu weight mai mare)
  const norm = (t) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 12)
      .join(' ');

  for (const item of items) {
    const key = norm(item.title);
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing || item.weight > existing.weight) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

async function runCollectionPass() {
  console.log(`\n📡 Colectare surse (ultimele ${HOURS_LOOKBACK}h)...\n`);

  console.log('RSS feeds:');
  const rssItems = await fetchAllRss();

  console.log('\nAlte surse:');
  const [hn, reddit, arxiv] = await Promise.all([fetchHackerNews(), fetchReddit(), fetchArxiv()]);

  const all = [...rssItems, ...hn, ...reddit, ...arxiv];
  const deduped = dedupe(all);

  console.log(`\n✅ Total brut: ${all.length} | Dupa deduplicare: ${deduped.length}\n`);
  return deduped;
}

export async function collectAll() {
  let items = await runCollectionPass();

  if (items.length === 0) {
    console.warn(
      `\n⚠️ Nicio sursa nu a returnat articole la prima trecere (posibil blocaj temporar) — reincerc peste ${
        EMPTY_PASS_RETRY_WAIT_MS / 1000
      }s...\n`,
    );
    await sleep(EMPTY_PASS_RETRY_WAIT_MS);
    items = await runCollectionPass();
  }

  return items;
}

// Permite rulare directa: `npm run collect`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const items = await collectAll();
  console.log(items.slice(0, 10).map((i) => `- [${i.source}] ${i.title}`).join('\n'));
}
