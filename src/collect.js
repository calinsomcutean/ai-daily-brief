// Colecteaza articole brute din toate sursele gratuite: RSS, Hacker News, Reddit, arXiv.
// Fiecare sursa e izolata intr-un try/catch — daca un feed pica, restul continua.
// Rezultat: listă de obiecte { title, url, source, sourceTag, weight, publishedAt, summary }

import Parser from 'rss-parser';
import { pathToFileURL } from 'node:url';
import { RSS_FEEDS, HN_CONFIG, REDDIT_CONFIG, ARXIV_CONFIG } from './config/sources.js';

// Multe site-uri (AI News, MarkTechPost, Reddit) blocheaza user-agent-uri generice
// de tip "bot" cu 403/429 — un UA de browser real trece peste tot.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': BROWSER_UA },
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

async function fetchRss(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
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

async function fetchHackerNews() {
  if (!HN_CONFIG.enabled) return [];
  const sinceUnix = Math.floor(cutoff / 1000);
  const out = [];
  for (const query of HN_CONFIG.queries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
        query,
      )}&tags=story&numericFilters=created_at_i>${sinceUnix},points>=${HN_CONFIG.minPoints}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      for (const hit of data.hits ?? []) {
        if (!hit.title) continue;
        out.push({
          title: hit.title.trim(),
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: 'Hacker News',
          sourceTag: 'community',
          weight: HN_CONFIG.weight * Math.min(1.3, 1 + hit.points / 1000),
          publishedAt: hit.created_at,
          summary: `${hit.points} puncte, ${hit.num_comments} comentarii pe HN`,
        });
      }
    } catch (err) {
      console.warn(`  [SKIP] Hacker News (${query}) ${err.message}`);
    }
  }
  console.log(`  [ok] Hacker News                  ${out.length} articole`);
  return out;
}

async function fetchReddit() {
  if (!REDDIT_CONFIG.enabled) return [];
  const out = [];
  for (const sub of REDDIT_CONFIG.subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/top/.rss?t=day&limit=25`;
      const parsed = await redditParser.parseURL(url);
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
    await sleep(600); // evita rate-limiting-ul Reddit intre subreddit-uri
  }
  console.log(`  [ok] Reddit                       ${out.length} articole`);
  return out;
}

async function fetchArxiv() {
  if (!ARXIV_CONFIG.enabled) return [];
  const out = [];
  for (const cat of ARXIV_CONFIG.categories) {
    try {
      const url = `http://export.arxiv.org/api/query?search_query=cat:${cat}&sortBy=submittedDate&sortOrder=descending&max_results=${ARXIV_CONFIG.maxPerCategory}`;
      const parsed = await parser.parseURL(url);
      const items = (parsed.items ?? [])
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
      out.push(...items);
    } catch (err) {
      console.warn(`  [SKIP] arXiv ${cat} ${err.message}`);
    }
  }
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

export async function collectAll() {
  console.log(`\n📡 Colectare surse (ultimele ${HOURS_LOOKBACK}h)...\n`);

  console.log('RSS feeds:');
  const rssResults = await Promise.all(RSS_FEEDS.map(fetchRss));

  console.log('\nAlte surse:');
  const [hn, reddit, arxiv] = await Promise.all([fetchHackerNews(), fetchReddit(), fetchArxiv()]);

  const all = [...rssResults.flat(), ...hn, ...reddit, ...arxiv];
  const deduped = dedupe(all);

  console.log(`\n✅ Total brut: ${all.length} | Dupa deduplicare: ${deduped.length}\n`);
  return deduped;
}

// Permite rulare directa: `npm run collect`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const items = await collectAll();
  console.log(items.slice(0, 10).map((i) => `- [${i.source}] ${i.title}`).join('\n'));
}
