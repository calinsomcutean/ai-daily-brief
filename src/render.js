// Genereaza HTML-ul newsletter-ului zilnic. Foloseste STILURI INLINE (nu <style> in head)
// pentru compatibilitate maxima cu clientii de email (Gmail, Outlook etc. taie <style>).
// Acelasi HTML e folosit si pentru pagina de arhiva.

import { tipById, domeniuById, TIPURI } from './config/taxonomy.js';

const esc = (s = '') =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function formatDateRo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const zile = ['Duminica', 'Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata'];
  const luni = [
    'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
    'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
  ];
  return `${zile[d.getDay()]}, ${d.getDate()} ${luni[d.getMonth()]} ${d.getFullYear()}`;
}

function domainChips(domenii) {
  return domenii
    .map((id) => {
      const d = domeniuById(id);
      return `<span style="display:inline-block;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;margin:0 6px 6px 0;white-space:nowrap;">${d.emoji} ${esc(d.label)}</span>`;
    })
    .join('');
}

function storyCard(story) {
  const tip = tipById(story.tip);
  return `
  <tr>
    <td style="padding:0 0 16px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 22px;">
            <div style="margin:0 0 10px 0;">
              <span style="display:inline-block;background:${tip.culoare}1a;color:${tip.culoare};font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:.2px;">${tip.emoji} ${esc(tip.label)}</span>
              <span style="display:inline-block;color:#9ca3af;font-size:12px;font-weight:600;margin-left:8px;">${esc(story.sursa)}</span>
              <span style="display:inline-block;color:#d1d5db;font-size:12px;margin-left:6px;">·</span>
              <span style="display:inline-block;color:#9ca3af;font-size:12px;margin-left:6px;">Scor ${story.scor_importanta}/10</span>
            </div>
            <h3 style="margin:0 0 6px 0;font-size:17px;line-height:1.4;color:#111827;font-family:Georgia,'Times New Roman',serif;">
              <a href="${esc(story.url)}" style="color:#111827;text-decoration:none;">${esc(story.titlu_ro)}</a>
            </h3>
            ${story.titlu_original && story.titlu_original !== story.titlu_ro ? `<p style="margin:0 0 10px 0;font-size:12.5px;color:#9ca3af;font-style:italic;">${esc(story.titlu_original)}</p>` : ''}
            <p style="margin:0 0 10px 0;font-size:14.5px;line-height:1.6;color:#374151;">${esc(story.rezumat)}</p>
            <p style="margin:0 0 12px 0;font-size:13.5px;line-height:1.5;color:#4b5563;background:#f9fafb;border-left:3px solid ${tip.culoare};padding:8px 12px;border-radius:4px;">
              <strong style="color:#111827;">De ce conteaza:</strong> ${esc(story.de_ce_conteaza)}
            </p>
            <div>${domainChips(story.domenii)}</div>
            <a href="${esc(story.url)}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:#4f46e5;text-decoration:none;">Citeste articolul original →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function sectionHeader(tip, count) {
  return `
  <tr>
    <td style="padding:28px 0 10px 0;">
      <h2 style="margin:0;font-size:14px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">
        ${tip.emoji} ${esc(tip.label)} <span style="color:#c7cad1;font-weight:600;">(${count})</span>
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
  const dataRo = formatDateRo(dateStr);

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
    ? `<p style="margin:24px 0 0 0;text-align:center;font-size:13px;color:#9ca3af;">
        <a href="${esc(opts.archiveUrl)}" style="color:#6366f1;text-decoration:none;">Vezi arhiva completa a briefing-urilor →</a>
      </p>`
    : '';

  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Daily Brief — ${esc(dataRo)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">

  <tr>
    <td style="background:linear-gradient(135deg,#4338ca 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:32px 28px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c7d2fe;margin-bottom:6px;">AI Daily Brief</div>
      <h1 style="margin:0;font-size:26px;line-height:1.3;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">${esc(dataRo)}</h1>
      <p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;color:#e0e7ff;">${esc(rezumat_zilei)}</p>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${sections}
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;border-radius:0 0 16px 16px;padding:20px 28px 28px 28px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">
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
      <a href="./${esc(d.date)}.html" style="display:block;text-decoration:none;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:10px;transition:none;">
        <div style="font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.4px;">${esc(dataRo)}</div>
        <div style="font-size:14px;color:#374151;margin-top:4px;">${esc(d.title ?? '')}</div>
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
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">
  <tr>
    <td style="background:linear-gradient(135deg,#4338ca 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:32px 28px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c7d2fe;margin-bottom:6px;">AI Daily Brief</div>
      <h1 style="margin:0;font-size:26px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">Arhiva zilnica</h1>
      <p style="margin:14px 0 0 0;font-size:14px;color:#e0e7ff;">${days.length} briefing-uri publicate</p>
    </td>
  </tr>
  <tr>
    <td style="background:#f3f4f6;padding:20px 20px 4px 20px;">
      ${rows || '<p style="color:#9ca3af;font-size:14px;">Inca niciun briefing publicat.</p>'}
    </td>
  </tr>
  <tr>
    <td style="background:#f3f4f6;border-radius:0 0 16px 16px;padding:20px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">AI Daily Brief · generat automat</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
