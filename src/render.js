// Genereaza HTML-ul newsletter-ului zilnic. Foloseste STILURI INLINE (nu <style> in head)
// pentru compatibilitate maxima cu clientii de email (Gmail, Outlook etc. taie <style>).
// Acelasi HTML e folosit si pentru pagina de arhiva.
//
// Paleta si tipografia sunt aliniate cu site-ul personal (calinsomcutean.ro): fundal
// crem cald, accent navy inchis, titluri serif editoriale, butoane tip pill.

import { tipById, domeniuById, TIPURI } from './config/taxonomy.js';

const NAVY = '#1B3A5C';
const NAVY_LINK = '#2F5FA6';
const CREAM = '#F6F3EC';
const BORDER = '#E5E0D3';
const TEXT_DARK = '#1A1A18';
const TEXT_BODY = '#33302A';
const TEXT_MUTED = '#6B6458';
const TEXT_MUTED_LIGHT = '#8C8574';

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const esc = (s = '') =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function formatDateParts(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const zile = ['Duminica', 'Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata'];
  const luni = [
    'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
    'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
  ];
  return { zi: zile[d.getDay()], rest: `${d.getDate()} ${luni[d.getMonth()]} ${d.getFullYear()}` };
}

function formatDateRo(dateStr) {
  const { zi, rest } = formatDateParts(dateStr);
  return `${zi}, ${rest}`;
}

function domainChips(domenii) {
  return domenii
    .map((id) => {
      const d = domeniuById(id);
      return `<span style="display:inline-block;background:#EAEFF5;color:${NAVY};font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;margin:0 6px 6px 0;white-space:nowrap;">${d.emoji} ${esc(d.label)}</span>`;
    })
    .join('');
}

function storyCard(story) {
  const tip = tipById(story.tip);
  return `
  <tr>
    <td style="padding:0 0 14px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:20px 22px;">
            <div style="margin:0 0 10px 0;">
              <span style="display:inline-block;background:${tip.culoare}14;color:${tip.culoare};font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:.3px;">${tip.emoji} ${esc(tip.label)}</span>
              <span style="display:inline-block;color:${TEXT_MUTED_LIGHT};font-size:12px;font-weight:600;margin-left:8px;">${esc(story.sursa)}</span>
              <span style="display:inline-block;color:${BORDER};font-size:12px;margin-left:6px;">·</span>
              <span style="display:inline-block;color:${TEXT_MUTED_LIGHT};font-size:12px;margin-left:6px;">Scor ${story.scor_importanta}/10</span>
            </div>
            <h3 style="margin:0 0 6px 0;font-size:18px;line-height:1.4;color:${TEXT_DARK};font-family:${SERIF};font-weight:700;">
              <a href="${esc(story.url)}" style="color:${TEXT_DARK};text-decoration:none;">${esc(story.titlu_ro)}</a>
            </h3>
            ${story.titlu_original && story.titlu_original !== story.titlu_ro ? `<p style="margin:0 0 10px 0;font-size:12.5px;color:${TEXT_MUTED_LIGHT};font-style:italic;font-family:${SERIF};">${esc(story.titlu_original)}</p>` : ''}
            <p style="margin:0 0 10px 0;font-size:14.5px;line-height:1.65;color:${TEXT_BODY};font-family:${SANS};">${esc(story.rezumat)}</p>
            <p style="margin:0 0 12px 0;font-size:13.5px;line-height:1.55;color:${TEXT_BODY};font-family:${SANS};background:${CREAM};border-left:3px solid ${tip.culoare};padding:9px 13px;border-radius:0 4px 4px 0;">
              <strong style="color:${TEXT_DARK};">De ce conteaza:</strong> ${esc(story.de_ce_conteaza)}
            </p>
            <div>${domainChips(story.domenii)}</div>
            <a href="${esc(story.url)}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:${NAVY_LINK};text-decoration:none;font-family:${SANS};">Citeste articolul original →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function sectionHeader(tip, count) {
  return `
  <tr>
    <td style="padding:26px 0 10px 0;">
      <h2 style="margin:0;font-size:12.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${NAVY};border-bottom:1px solid ${BORDER};padding-bottom:9px;font-family:${SANS};">
        ${tip.emoji} ${esc(tip.label)} <span style="color:${TEXT_MUTED_LIGHT};font-weight:600;letter-spacing:normal;text-transform:none;">(${count})</span>
      </h2>
    </td>
  </tr>`;
}

/**
 * @param {object} data - { stiri, rezumat_zilei }
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {{archiveUrl?: string, isArchivePage?: boolean}} opts
 */
export function renderDailyHTML(data, dateStr, opts = {}) {
  const { stiri, rezumat_zilei } = data;
  const { zi, rest } = formatDateParts(dateStr);

  const byTip = new Map();
  for (const t of TIPURI) byTip.set(t.id, []);
  for (const s of stiri) {
    if (!byTip.has(s.tip)) byTip.set(s.tip, []);
    byTip.get(s.tip).push(s);
  }

  const sections = TIPURI.filter((t) => (byTip.get(t.id) ?? []).length > 0)
    .map((t) => {
      const list = byTip.get(t.id).sort((a, b) => b.scor_importanta - a.scor_importanta);
      return sectionHeader(t, list.length) + list.map(storyCard).join('');
    })
    .join('');

  const archiveLink = opts.archiveUrl
    ? `<p style="margin:22px 0 0 0;text-align:center;">
        <a href="${esc(opts.archiveUrl)}" style="display:inline-block;border:1px solid ${NAVY};color:${NAVY};font-size:13px;font-weight:600;text-decoration:none;padding:10px 22px;border-radius:999px;font-family:${SANS};">Vezi arhiva completa →</a>
      </p>`
    : '';

  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Daily Brief — ${esc(formatDateRo(dateStr))}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:${SANS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:36px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;">

  <tr>
    <td style="padding:0 8px 24px 8px;">
      <div style="font-size:12.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${NAVY_LINK};margin-bottom:14px;">AI Daily Brief</div>
      <h1 style="margin:0;font-size:32px;line-height:1.25;color:${TEXT_DARK};font-family:${SERIF};font-weight:700;">
        <span style="color:${NAVY};font-style:italic;">${esc(zi)}</span>, ${esc(rest)}
      </h1>
      <div style="height:1px;background:${BORDER};margin:18px 0;line-height:1px;font-size:1px;">&nbsp;</div>
      <p style="margin:0;font-size:15px;line-height:1.7;color:${TEXT_MUTED};font-family:${SANS};">${esc(rezumat_zilei)}</p>
    </td>
  </tr>

  <tr>
    <td style="padding:0 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${sections}
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:26px 8px 4px 8px;border-top:1px solid ${BORDER};margin-top:8px;">
      <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:${TEXT_MUTED_LIGHT};text-align:center;font-family:${SANS};">
        Generat automat din surse RSS, Hacker News, Reddit si arXiv · ${stiri.length} stiri selectate din surse gratuite
      </p>
      ${archiveLink}
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Pagina index a arhivei — lista de zile cu link catre fiecare brief.
 * @param {{date: string, title: string}[]} days - sortate descrescator dupa data
 */
export function renderArchiveIndexHTML(days) {
  const rows = days
    .map((d) => {
      const dataRo = formatDateRo(d.date);
      return `
      <a href="./${esc(d.date)}.html" style="display:block;text-decoration:none;background:#ffffff;border:1px solid ${BORDER};border-radius:10px;padding:16px 20px;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:700;color:${NAVY_LINK};text-transform:uppercase;letter-spacing:.5px;font-family:${SANS};">${esc(dataRo)}</div>
        <div style="font-size:14px;color:${TEXT_BODY};margin-top:5px;font-family:${SANS};line-height:1.5;">${esc(d.title ?? '')}</div>
      </a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arhiva AI Daily Brief</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:${SANS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:36px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;">
  <tr>
    <td style="padding:0 8px 28px 8px;">
      <div style="font-size:12.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${NAVY_LINK};margin-bottom:14px;">AI Daily Brief</div>
      <h1 style="margin:0;font-size:32px;color:${TEXT_DARK};font-family:${SERIF};font-weight:700;">Arhiva <span style="color:${NAVY};font-style:italic;">zilnica</span></h1>
      <div style="height:1px;background:${BORDER};margin:18px 0;line-height:1px;font-size:1px;">&nbsp;</div>
      <p style="margin:0;font-size:14px;color:${TEXT_MUTED};font-family:${SANS};">${days.length} briefing-uri publicate</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 8px;">
      ${rows || `<p style="color:${TEXT_MUTED_LIGHT};font-size:14px;font-family:${SANS};">Inca niciun briefing publicat.</p>`}
    </td>
  </tr>
  <tr>
    <td style="padding:24px 8px 4px 8px;border-top:1px solid ${BORDER};margin-top:8px;">
      <p style="margin:20px 0 0 0;font-size:12px;color:${TEXT_MUTED_LIGHT};text-align:center;font-family:${SANS};">AI Daily Brief · generat automat</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
