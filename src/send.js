// Trimite HTML-ul zilei prin Resend catre destinatarii configurati.

import { Resend } from 'resend';

const RECIPIENTS = (process.env.EMAIL_TO || 'calinsomcutean@gmail.com,calin.somcutean@leadder.ro')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const FROM = process.env.EMAIL_FROM || 'AI Daily Brief <onboarding@resend.dev>';

export async function sendDailyEmail({ html, subject }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  RESEND_API_KEY lipseste — sar peste trimiterea emailului (doar generare locala).');
    return { skipped: true };
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: RECIPIENTS,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend a esuat: ${error.message ?? JSON.stringify(error)}`);
  }

  console.log(`📧 Email trimis (id: ${data?.id}) catre: ${RECIPIENTS.join(', ')}`);
  return data;
}
