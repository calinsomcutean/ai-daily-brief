// Trimite candidatii colectati catre Gemini pentru: scoring de importanta,
// selectie top N, clasificare (tip + domeniu), rezumat in romana.
// Foloseste responseSchema (JSON mode) ca sa garantam JSON valid.
// Gemini are un nivel gratuit generos (aistudio.google.com/apikey) — de asta e ales
// in locul unui API platit; vezi README pentru cum obtii cheia.

import { TIP_IDS, DOMENIU_IDS, LIMITE } from './config/taxonomy.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    stiri: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          titlu_ro: { type: 'STRING', description: 'Titlu tradus/adaptat in romana, concis' },
          titlu_original: { type: 'STRING', description: 'Titlul original al articolului' },
          url: { type: 'STRING', description: 'URL-ul exact al articolului sursa din lista primita' },
          sursa: { type: 'STRING', description: 'Numele sursei, exact cum a fost dat' },
          tip: { type: 'STRING', enum: TIP_IDS },
          domenii: {
            type: 'ARRAY',
            items: { type: 'STRING', enum: DOMENIU_IDS },
            description: 'Domeniile de interes relevante (1-3), in ordinea relevantei',
          },
          rezumat: { type: 'STRING', description: '2-3 fraze in romana, clar si concret, fara clisee' },
          de_ce_conteaza: { type: 'STRING', description: 'O singura fraza: impactul practic' },
          scor_importanta: { type: 'INTEGER', description: 'Scor de importanta, intreg de la 1 la 10' },
        },
        required: [
          'titlu_ro', 'titlu_original', 'url', 'sursa', 'tip', 'domenii',
          'rezumat', 'de_ce_conteaza', 'scor_importanta',
        ],
      },
    },
    rezumat_zilei: {
      type: 'STRING',
      description: 'Un paragraf de 3-4 fraze in romana care sintetizeaza tema/temele dominante ale zilei in AI',
    },
  },
  required: ['stiri', 'rezumat_zilei'],
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
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY lipseste din environment — vezi README pentru cum obtii o cheie gratuita.');
  }

  // Sortam dupa greutatea sursei ca sa favorizam labs/presa cand taiem la maxCandidati.
  const candidates = [...items]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, LIMITE.maxCandidati);

  const system = `Esti editorul unui newsletter zilnic despre AI, in limba romana, pentru un consultant de business si mentorat care lucreaza si cu salarizare/HR.
Primesti o lista de articole brute din surse RSS, Hacker News, Reddit si arXiv din ultimele ~30 de ore.

Cititorul NU e programator si NU e specialist software — evita complet stirile utile doar developerilor/inginerilor
(librarii sau framework-uri noi, schimbari de API/SDK pentru dezvoltatori, comparatii intre unelte de coding,
tutoriale tehnice, actualizari de repo-uri open-source de nisa). Daca o stire tehnica are si un impact clar de
business/strategie (ex: un model nou schimba fundamental costurile sau capabilitatile pe care le poate folosi o
companie), poate fi inclusa, dar rezumatul si "de ce conteaza" trebuie sa fie despre impactul de business, nu despre
detalii de implementare.

Sarcina ta:
1. Selecteaza cele mai importante ${LIMITE.minStiri}-${LIMITE.maxStiri} stiri din lista — cele cu impact real, nu zgomot. Prioritizeaza: lansari de modele majore, cercetare cu rezultate notabile, miscari de business mari (finantari, achizitii), schimbari de reglementare, incidente relevante.
2. Evita duplicate tematice — daca 3 articole acopera aceeasi stire, alege-l pe cel mai complet si ignora restul.
3. Pentru fiecare stire aleasa, clasific-o pe tip (o singura valoare) si domenii (1-3 valori, cele mai relevante).
4. Scrie un rezumat de 2-3 fraze in romana, clar, fara jargon inutil, fara superlative goale ("revolutionar", "uimitor"). Pastreaza termenii tehnici originali cand nu au traducere buna (ex: "fine-tuning", "agent", "benchmark").
5. Scrie o fraza "de ce conteaza" — impactul practic pentru cineva din business/consultanta.
6. Da un scor de importanta, un numar intreg de la 1 la 10.
7. Scrie un rezumat_zilei: 3-4 fraze care sintetizeaza tema dominanta a zilei.

Foloseste EXACT URL-ul si numele sursei din lista primita — nu inventa, nu modifica.
Daca lista are mai putin de ${LIMITE.minStiri} stiri cu adevarat relevante, selecteaza doar atatea cate merita, dar niciodata sub ${Math.min(8, LIMITE.minStiri)}.
Raspunde DOAR cu obiectul JSON cerut de schema, fara text suplimentar.`;

  const userContent = `Iata ${candidates.length} articole candidate:\n\n${buildCandidatesBlock(candidates)}`;

  console.log(`\n🧠 Trimit ${candidates.length} candidati catre ${MODEL} pentru triaj...`);

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status}: ${body}`);
  }

  const payload = await res.json();
  const candidate = payload.candidates?.[0];

  if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
    throw new Error(`Gemini nu a returnat un rezultat utilizabil (finishReason: ${candidate?.finishReason ?? 'necunoscut'}).`);
  }

  const text = candidate.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Raspunsul Gemini nu contine text.');

  const parsed = JSON.parse(text);
  console.log(`✅ ${parsed.stiri.length} stiri selectate si clasificate.`);
  if (payload.usageMetadata) {
    console.log(`   Tokens: ${payload.usageMetadata.promptTokenCount} in / ${payload.usageMetadata.candidatesTokenCount} out`);
  }

  return parsed;
}
