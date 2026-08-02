// Reconstruieste docs/index.html scanand fisierele docs/emails/YYYY-MM-DD.html existente
// si docs/emails/YYYY-MM-DD.json (pentru titlu/rezumat). Ruleaza dupa fiecare briefing nou.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderArchiveIndexHTML } from './render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAILS_DIR = path.join(__dirname, '..', 'docs', 'emails');
const INDEX_PATH = path.join(__dirname, '..', 'docs', 'index.html');

export async function rebuildIndex() {
  let files = [];
  try {
    files = await readdir(EMAILS_DIR);
  } catch {
    files = [];
  }

  const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f));
  const days = [];

  for (const f of dateFiles) {
    const date = f.replace('.html', '');
    let title = '';
    try {
      const jsonPath = path.join(EMAILS_DIR, `${date}.json`);
      const raw = await readFile(jsonPath, 'utf-8');
      const data = JSON.parse(raw);
      title = (data.rezumat_zilei ?? '').slice(0, 140);
    } catch {
      // fara meta, doar data
    }
    days.push({ date, title });
  }

  days.sort((a, b) => (a.date < b.date ? 1 : -1));

  const html = renderArchiveIndexHTML(days);
  await writeFile(INDEX_PATH, html, 'utf-8');
  console.log(`📇 Index arhiva actualizat: ${days.length} zile → ${INDEX_PATH}`);
  return days;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await rebuildIndex();
}
