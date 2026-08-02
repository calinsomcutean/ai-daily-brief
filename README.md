# AI Daily Brief

Automatizare care în fiecare zi:

1. **07:00** — citește cele mai importante știri despre AI din surse gratuite (bloguri oficiale, presă tech, Hacker News, Reddit, arXiv), le clasifică cu Claude (Opus 5) pe **tip** și **domeniu**, generează un newsletter HTML modern și îl salvează în arhivă (pagină web, câte un fișier per zi).
2. **08:00** — trimite HTML-ul zilei pe email către `calinsomcutean@gmail.com` și `calin.somcutean@leadder.ro`.

Rulează gratuit pe GitHub Actions (surse gratuite + arhivă pe GitHub Pages); singurul cost e API-ul Claude (~2-5 USD/lună) și, dacă depășești planul gratuit Resend (3.000 emailuri/lună), nimic — o adresă pe zi e mult sub limită.

## Structură

```
src/
  config/sources.js    — lista de feed-uri RSS, Hacker News, Reddit, arXiv
  config/taxonomy.js   — clasificarea pe tip și domeniu
  collect.js           — colectează articolele brute din toate sursele
  classify.js          — trimite candidații către Claude pentru triaj + rezumat
  render.js            — generează HTML-ul (newsletter + pagina de arhivă)
  build-index.js        — reconstruiește docs/index.html din arhivă
  send.js               — trimite emailul prin Resend
  index.js              — orchestrator (leagă totul)
docs/                   — publicat ca site (GitHub Pages): arhiva zilnică
data/                   — JSON brut per zi (istoric structurat)
.github/workflows/      — cele două job-uri programate (generare + trimitere)
```

## Setup — pas cu pas

### 1. Cheia API Anthropic

Mergi pe [platform.claude.com](https://platform.claude.com) → API Keys → creează o cheie nouă. O vei folosi mai jos ca secret `ANTHROPIC_API_KEY`.

### 2. Cont Resend (trimitere email)

Mergi pe [resend.com](https://resend.com) → creează cont gratuit → API Keys → creează o cheie. Plan gratuit: 3.000 emailuri/lună, suficient pentru 1 email/zi.

Fără domeniu propriu, poți trimite imediat folosind adresa implicită `onboarding@resend.dev` — **dar cu o restricție**: Resend permite trimiterea doar către adresa cu care te-ai înregistrat (`calinsomcutean@gmail.com`), nu și către alte adrese. De-asta, deocamdată, `EMAIL_TO` e setat doar pe adresa de gmail.

Ca să trimiți și către `calin.somcutean@leadder.ro`, ai nevoie de un domeniu verificat în Resend:
1. Resend → Domains → adaugă `leadder.ro` (sau alt domeniu al tău)
2. Adaugă înregistrările DNS indicate (SPF/DKIM) la registrarul domeniului
3. După verificare, actualizează `EMAIL_FROM` (mai jos) cu o adresă de pe domeniul respectiv (ex. `AI Daily Brief <brief@leadder.ro>`)
4. Actualizează variabila `EMAIL_TO` din GitHub (Settings → Secrets and variables → Actions → Variables) să includă și adresa a doua: `calinsomcutean@gmail.com,calin.somcutean@leadder.ro`

### 3. Creează repo-ul pe GitHub

```bash
git init
git add .
git commit -m "init: AI Daily Brief"
gh repo create ai-daily-brief --private --source=. --push
```

(Sau creează manual pe github.com și adaugă `git remote add origin ...`.)

### 4. Activează GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder: `/docs` → Save.

După primul run, arhiva va fi vizibilă la `https://<user-github>.github.io/<repo>/`.

### 5. Adaugă secretele și variabilele în repo

Settings → Secrets and variables → Actions:

**Secrets** (criptate, nu apar în loguri):
| Nume | Valoare |
|---|---|
| `ANTHROPIC_API_KEY` | cheia de la pasul 1 |
| `RESEND_API_KEY` | cheia de la pasul 2 |

**Variables** (necriptate, ok pentru configurare):
| Nume | Valoare |
|---|---|
| `EMAIL_TO` | `calinsomcutean@gmail.com` (fără domeniu verificat în Resend, doar aceasta poate primi; vezi pasul 2 mai sus pentru a adăuga și a doua adresă) |
| `EMAIL_FROM` | `AI Daily Brief <onboarding@resend.dev>` (sau adresa ta, dacă ai domeniu configurat în Resend) |
| `ARCHIVE_BASE_URL` | `https://<user-github>.github.io/<repo>` |

### 6. Testează manual

Actions tab → "AI Daily Brief" → Run workflow → alege `generate-and-send` → Run.

Verifică: (a) au apărut fișiere noi în `docs/emails/` și `data/`, (b) a venit emailul, (c) arhiva de pe GitHub Pages arată bine.

### 7. Programarea automată

E deja configurată în `.github/workflows/daily-brief.yml` — nu trebuie să faci nimic. Rulează în fiecare zi:
- **04:00 UTC** (= 07:00 România vara / 06:00 iarna) → generează + arhivează
- **05:00 UTC** (= 08:00 România vara / 07:00 iarna) → trimite emailul

> ⚠️ GitHub Actions folosește UTC fix, iar România schimbă ora (DST). Orele de mai sus sunt calibrate pentru **ora de vară** (martie–octombrie, majoritatea anului) — în cele ~5 luni de iarnă, totul se va întâmpla cu o oră mai devreme (06:00 / 07:00 România). Dacă vrei precizie perfectă tot anul, ajustează manual cron-ul de două ori pe an în `daily-brief.yml`, sau spune-mi și pot adăuga o verificare de fus orar în cod.

## Testare locală

```bash
cp .env.example .env
# editează .env cu cheile tale
npm install
npm run brief:dry     # genereaza + salveaza, FARA sa trimita email
npm run brief         # genereaza + salveaza + trimite email
```

Deschide `docs/emails/<data-de-azi>.html` direct în browser ca să vezi cum arată.

## Modificarea surselor și clasificării

- **Adaugi/scoți surse RSS**: editează `src/config/sources.js`. Fiecare sursă are un `weight` (0.5–1.5) — cu cât mai mare, cu atât e favorizată la triaj.
- **Schimbi clasificarea (tip/domeniu)**: editează `src/config/taxonomy.js`. Adaugă/modifică array-urile `TIPURI` și `DOMENII` — culorile și emoji-urile se propagă automat în HTML.
- **Câte știri intră în newsletter**: `LIMITE.minStiri` / `LIMITE.maxStiri` în `taxonomy.js` (implicit 12–20).
- **Cât de departe în timp caută**: `HOURS_LOOKBACK` (implicit 30 ore, ca să acopere și weekendurile/întârzierile de feed).

## Extinderea cu X (Twitter)

Nu e inclus by design — API-ul X costă ~200 USD/lună pentru citire. Lista de conturi relevante e deja pregătită în `src/config/sources.js` → `X_ACCOUNTS_WATCHLIST`, ca punct de plecare când/dacă vrei să adaugi acest modul.

## Costuri estimate

| Serviciu | Cost |
|---|---|
| Claude API (triaj + rezumate, ~1 apel/zi) | ~1-3 USD/lună |
| Resend (1 email/zi către 2 adrese) | 0 USD (plan gratuit) |
| GitHub Actions (2 job-uri scurte/zi) | 0 USD (planul gratuit acoperă larg) |
| GitHub Pages (arhiva) | 0 USD |
| **Total** | **~1-3 USD/lună** |
