// Orchestratorul principal: colectare -> triaj Claude -> generare HTML -> salvare in arhiva.
// Rulat de GitHub Actions la 07:00 (generare+arhiva) si din nou pentru trimitere la 08:00,
// sau local cu: npm run brief   /   npm run brief:dry (fara email, fara commit)

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAll } from './collect.js';
import { classifyAndSummarize } from './classify.js';
import { renderDailyHTML } from './render.js';
import { rebuildIndex } from './build-index.js';
import { sendDailyEmail } from './send.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EMAILS_DIR = path.join(ROOT, 'docs', 'emails');
const DATA_DIR = path.join(ROOT, 'data');

const DRY_RUN = process.argv.includes('--dry-run');
const SEND_ONLY = process.argv.includes('--send-only');
const ARCHIVE_BASE_URL = process.env.ARCHIVE_BASE_URL || '';

function todayISO() {
  // Data curenta in Europe/Bucharest, format YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' });
  return fmt.format(new Date());
}

async function main() {
  const dateStr = process.env.BRIEF_DATE || todayISO();
  console.log(`\n=== AI Daily Brief — ${dateStr} ${DRY_RUN ? '(DRY RUN)' : ''} ===`);

  await mkdir(EMAILS_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const jsonPath = path.join(DATA_DIR, `${dateStr}.json`);
  const htmlPath = path.join(EMAILS_DIR, `${dateStr}.html`);

  let data;

  if (SEND_ONLY) {
    // Doar retrimite emailul pentru o zi deja generata (util pentru jobul de la 08:00
    // daca vrem sa separam generarea de trimitere).
    const raw = await readFile(jsonPath, 'utf-8');
    data = JSON.parse(raw);
  } else {
    const items = await collectAll();
    if (items.length === 0) {
      throw new Error('Nicio sursa nu a returnat articole — verifica feed-urile RSS.');
    }
    data = await classifyAndSummarize(items);

    await writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Date salvate: ${jsonPath}`);
  }

  const archiveUrl = ARCHIVE_BASE_URL ? `${ARCHIVE_BASE_URL}/emails/${dateStr}.html` : undefined;
  const html = renderDailyHTML(data, dateStr, { archiveUrl });

  await writeFile(htmlPath, html, 'utf-8');
  console.log(`💾 HTML arhiva salvat: ${htmlPath}`);

  // Copiem si un json langa HTML-ul de arhiva, pentru index (titlu/rezumat rapid).
  await writeFile(path.join(EMAILS_DIR, `${dateStr}.json`), JSON.stringify(data, null, 2), 'utf-8');

  await rebuildIndex();

  if (!DRY_RUN) {
    const subject = `🤖 AI Daily Brief — ${data.stiri.length} stiri importante · ${dateStr}`;
    await sendDailyEmail({ html, subject });
  } else {
    console.log('🧪 Dry run: nu s-a trimis niciun email.');
  }

  console.log('\n✅ Gata.\n');
}

main()
  .then(() => {
    // SDK-urile (Anthropic/Resend) pot lasa conexiuni HTTP keep-alive deschise,
    // ceea ce tine procesul Node "viu" la nesfarsit desi lucrul e gata — fortam iesirea.
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Eroare:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
