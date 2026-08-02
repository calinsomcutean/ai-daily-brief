// Trimite candidatii colectati catre Claude pentru: scoring de importanta,
// selectie top N, clasificare (tip + domeniu), rezumat in romana.
// Foloseste output_config.format (structured outputs) ca sa garantam JSON valid.

import Anthropic from '@anthropic-ai/sdk';
import { TIP_IDS, DOMENIU_IDS, LIMITE } from './config/taxonomy.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';

const client = new Anthropic(); // citeste ANTHROPIC_API_KEY din env

const outputSchema = {
  type: 'object',
  properties: {
    // API-ul de structured outputs accepta doar minItems/maxItems 0 sau 1 pe array-uri —
    // limitele reale (LIMITE.minStiri/maxStiri) sunt impuse prin instructiuni in system prompt.
    stiri: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titlu_ro: { type: 'string', description: 'Titlu tradus/adaptat in romana, concis' },
          titlu_original: { type: 'string', description: 'Titlul original al articolului' },
          url: { type: 'string', description: 'URL-ul exact al articolului sursa din lista primita' },
          sursa: { type: 'string', description: 'Numele sursei, exact cum a fost dat' },
          tip: { type: 'string', enum: TIP_IDS },
          domenii: {
            type: 'array',
            items: { type: 'string', enum: DOMENIU_IDS },
            description: 'Domeniile de interes relevante (1-3), in ordinea relevantei',
          },
          rezumat: { type: 'string', description: '2-3 fraze in romana, clar si concret, fara clisee' },
          de_ce_conteaza: { type: 'string', description: 'O singura fraza: impactul practic' },
          scor_importanta: { type: 'integer', minimum: 1, maximum: 10 },
        },
        required: [
          'titlu_ro', 'titlu_original', 'url', 'sursa', 'tip', 'domenii',
          'rezumat', 'de_ce_conteaza', 'scor_importanta',
        ],
        additionalProperties: false,
      },
    },
    rezumat_zilei: {
      type: 'string',
      description: 'Un paragraf de 3-4 fraze in romana care sintetizeaza tema/temele dominante ale zilei in AI',
    },
  },
  required: ['stiri', 'rezumat_zilei'],
  additionalProperties: false,
};

function buildCandidatesBlock(items) {
  return items
    .map((it, i) => {
      const date = it.publishedAt ? new Date(it.publishedAt).toISOString().slice(0, 16) : 'necunoscuta';
      return `${i + 1}. [${it.source} | greutate ${it.weight.toFixed(2)} | ${date}]\nTitlu: ${it.title}\nURL: ${it.url}\nContext: ${(it.summary || '').replace(/\s+/g, ' ').slice(0, 300)}`;
    })
    .join('\n\n');
}

export async function classifyAndSummarize(items) {
  // Sortam dupa greutatea sursei ca sa favorizam labs/presa cand taiem la maxCandidati.
  const candidates = [...items]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, LIMITE.maxCandidati);

  const system = `Esti editorul unui newsletter zilnic despre AI, in limba romana, pentru un consultant de business si mentorat care lucreaza si cu salarizare/HR.
Primesti o lista de articole brute din surse RSS, Hacker News, Reddit si arXiv din ultimele ~30 de ore.

Sarcina ta:
1. Selecteaza cele mai importante ${LIMITE.minStiri}-${LIMITE.maxStiri} stiri din lista — cele cu impact real, nu zgomot. Prioritizeaza: lansari de modele majore, cercetare cu rezultate notabile, miscari de business mari (finantari, achizitii), schimbari de reglementare, unelte open-source cu tractiune, incidente relevante.
2. Evita duplicate tematice — daca 3 articole acopera aceeasi stire, alege-l pe cel mai complet si ignora restul.
3. Pentru fiecare stire aleasa, clasific-o pe tip (o singura valoare) si domenii (1-3 valori, cele mai relevante).
4. Scrie un rezumat de 2-3 fraze in romana, clar, fara jargon inutil, fara superlative goale ("revolutionar", "uimitor"). Pastreaza termenii tehnici originali cand nu au traducere buna (ex: "fine-tuning", "agent", "benchmark").
5. Scrie o fraza "de ce conteaza" — impactul practic pentru cineva din business/consultanta.
6. Da un scor de importanta 1-10.
7. Scrie un rezumat_zilei: 3-4 fraze care sintetizeaza tema dominanta a zilei.

Foloseste EXACT URL-ul si numele sursei din lista primita — nu inventa, nu modifica.
Daca lista are mai putin de ${LIMITE.minStiri} stiri cu adevarat relevante, selecteaza doar atatea cate merita, dar niciodata sub ${Math.min(8, LIMITE.minStiri)}.`;

  const userContent = `Iata ${candidates.length} articole candidate:\n\n${buildCandidatesBlock(candidates)}`;

  console.log(`\n🧠 Trimit ${candidates.length} candidati catre ${MODEL} pentru triaj...`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: userContent }],
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: outputSchema },
    },
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude a refuzat cererea (stop_reason: refusal) — verifica continutul candidatilor.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Raspunsul nu contine niciun bloc text.');

  const parsed = JSON.parse(textBlock.text);
  console.log(`✅ ${parsed.stiri.length} stiri selectate si clasificate.`);
  console.log(`   Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  return parsed;
}
