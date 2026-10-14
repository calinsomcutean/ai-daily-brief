// Trimite candidatii colectati catre Gemini pentru: scoring de importanta,
// selectie top N, clasificare (tip + domeniu), rezumat in romana.
// Foloseste responseSchema (JSON mode) ca sa garantam JSON valid.
// Gemini are un nivel gratuit generos (aistudio.google.com/apikey) — de asta e ales
// in locul unui API platit; vezi README pentru cum obtii cheia.

import { TIP_IDS, DOMENIU_IDS, LIMITE } from './config/taxonomy.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Gemini raspunde ocazional cu 503 ("high demand") sau 429 (rate limit) — sunt
// erori tranzitorii de supraincarcare, nu probleme reale cu cererea, asa ca
// reincercam cu backoff in loc sa pierdem brief-ul zilei.
const RETRYABLE_STATUS = new Set([429, 500, 503]);
const RETRY_DELAYS_MS = [3000, 8000, 20000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;

    const bodyText = await res.text();
    const isLastAttempt = attempt >= RETRY_DELAYS_MS.length;
    if (!RETRYABLE_STATUS.has(res.status) || isLastAttempt) {
      throw new Error(`Gemini API ${res.status}: ${bodyText}`);
    }

    const delay = RETRY_DELAYS_MS[attempt];
    console.warn(`  [retry] Gemini ${res.status} (supraincarcare temporara) — reincerc peste ${delay / 1000}s...`);
    await sleep(delay);
  }
}

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
    recomandari_practice: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          titlu: { type: 'STRING', description: 'Titlu scurt, in romana' },
          url: { type: 'STRING', description: 'URL-ul exact al articolului sursa din lista primita' },
          ce_este: { type: 'STRING', description: '1-2 fraze: ce e unealta/tehnica/studiul de caz, pe scurt' },
          cum_folosesti: {
            type: 'STRING',
            description: '2-3 fraze concrete: cum poate folosi cititorul asta chiar el, ca si consultant si trainer AI, sau cum poate ajuta un client de-al lui sa automatizeze ori sa accelereze cu asta. Actionabil, nu generic.',
          },
        },
        required: ['titlu', 'url', 'ce_este', 'cum_folosesti'],
      },
      description: '2-4 recomandari practice, aplicabile direct de cititor sau de clientii lui',
    },
  },
  required: ['stiri', 'rezumat_zilei', 'recomandari_practice'],
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

  const system = `Esti editorul unui newsletter zilnic despre AI, in limba romana, pentru un consultant de business si trainer AI care isi ajuta clientii (companii, echipe de management, salarizare/HR) sa adopte, sa automatizeze si sa accelereze cu AI.
Primesti o lista de articole brute din surse RSS, Hacker News, Reddit si arXiv din ultimele ~30 de ore.

Cititorul NU e programator si NU e specialist software — evita complet stirile utile doar developerilor/inginerilor
(librarii sau framework-uri noi, schimbari de API/SDK pentru dezvoltatori, comparatii intre unelte de coding,
tutoriale tehnice, actualizari de repo-uri open-source de nisa). Daca o stire tehnica are si un impact clar de
business/strategie (ex: un model nou schimba fundamental costurile sau capabilitatile pe care le poate folosi o
companie), poate fi inclusa, dar rezumatul si "de ce conteaza" trebuie sa fie despre impactul de business, nu despre
detalii de implementare.

Exclude complet stirile despre cipuri, GPU-uri/TPU-uri, servere, centre de date, capacitate de calcul sau
specificatii hardware — chiar daca vin din surse cu autoritate (NVIDIA, AWS etc.). Cititorul nu are nevoie de asta,
indiferent cat de "importanta" pare stirea in industrie. Singura exceptie: un impact de cost/acces DIRECT si usor de
explicat pentru un business obisnuit (ex: "modelele devin cu X% mai ieftine de folosit"), scris fara specificatii
tehnice.

Sarcina ta:
1. Selecteaza cele mai importante ${LIMITE.minStiri}-${LIMITE.maxStiri} stiri din lista — cele cu impact real, nu zgomot. Prioritizeaza: lansari de modele majore, cercetare cu rezultate notabile, miscari de business mari (finantari, achizitii), schimbari de reglementare, incidente relevante, si mai ales adoptie/studii de caz — cum folosesc alte companii AI-ul concret.
2. Evita duplicate tematice — daca 3 articole acopera aceeasi stire, alege-l pe cel mai complet si ignora restul.
3. Pentru fiecare stire aleasa, clasific-o pe tip (o singura valoare) si domenii (1-3 valori, cele mai relevante).
4. Scrie un rezumat de 2-3 fraze in romana, clar, fara jargon inutil, fara superlative goale ("revolutionar", "uimitor"). Pastreaza termenii tehnici originali cand nu au traducere buna (ex: "fine-tuning", "agent", "benchmark").
5. Scrie o fraza "de ce conteaza" — impactul practic pentru cineva din business/consultanta.
6. Da un scor de importanta, un numar intreg de la 1 la 10.
7. Scrie un rezumat_zilei: 3-4 fraze care sintetizeaza tema dominanta a zilei.
8. Separat de lista principala, alege 2-4 candidati (pot sa se suprapuna cu stirile alese mai sus, sau pot fi altele
   din lista) care sunt cel mai direct utile ca unelte sau tehnici — un model/produs nou pe care il poate folosi
   chiar el, o automatizare aplicabila la un client, un studiu de caz cu pasi replicabili. Pentru fiecare, scrie
   titlu, ce_este (ce s-a lansat/schimbat, pe scurt) si cum_folosesti — concret, la persoana a doua, fie "cum poti
   folosi asta tu insuti", fie "cum poti ajuta un client sa automatizeze/accelereze cu asta". Evita platitudini de
   tip "poate fi util" — spune exact ce pas ar face cineva.

Foloseste EXACT URL-ul si numele sursei din lista primita — nu inventa, nu modifica.
Daca lista are mai putin de ${LIMITE.minStiri} stiri cu adevarat relevante, selecteaza doar atatea cate merita, dar niciodata sub ${Math.min(8, LIMITE.minStiri)}.
Daca niciun candidat nu se preteaza la o recomandare practica autentica, e ok sa dai mai putine de 2 — nu forta.
Raspunde DOAR cu obiectul JSON cerut de schema, fara text suplimentar.`;

  const userContent = `Iata ${candidates.length} articole candidate:\n\n${buildCandidatesBlock(candidates)}`;

  console.log(`\n🧠 Trimit ${candidates.length} candidati catre ${MODEL} pentru triaj...`);

  const res = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  const payload = await res.json();
  const candidate = payload.candidates?.[0];

  if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
    throw new Error(`Gemini nu a returnat un rezultat utilizabil (finishReason: ${candidate?.finishReason ?? 'necunoscut'}).`);
  }

  const text = candidate.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Raspunsul Gemini nu contine text.');

  const parsed = JSON.parse(text);
  parsed.recomandari_practice = parsed.recomandari_practice ?? [];
  console.log(`✅ ${parsed.stiri.length} stiri selectate si clasificate, ${parsed.recomandari_practice.length} recomandari practice.`);
  if (payload.usageMetadata) {
    console.log(`   Tokens: ${payload.usageMetadata.promptTokenCount} in / ${payload.usageMetadata.candidatesTokenCount} out`);
  }

  return parsed;
}
