// @MX:SPEC: SPEC-REGULA-DIGEST-001
import { logger } from '../observability/logger';
import type { DigestPayload } from './digest-generator';

function buildHtmlEmail(payload: DigestPayload, appUrl: string): string {
  const severityColor: Record<string, string> = {
    critical: '#dc2626',
    high: '#d97706',
    medium: '#2563eb',
    low: '#16a34a',
  };
  const updateCards = payload.updates
    .slice(0, 20)
    .map(
      (u) => `
    <div style="border:1px solid #e5e7eb;border-left:4px solid ${severityColor[u.severity_classification]};border-radius:4px;padding:12px;margin-bottom:10px;">
      <div style="font-weight:600;font-size:14px;color:#111;">${u.title}</div>
      <div style="font-size:12px;color:#6b7280;margin:4px 0;">${u.region} · ${u.severity_classification.toUpperCase()} · ${new Date(u.published_at).toLocaleDateString()}</div>
      <div style="font-size:13px;color:#374151;margin-top:6px;">${u.impact_summary}</div>
      ${u.source_url ? `<a href="${u.source_url}" style="font-size:12px;color:#2563eb;">원문 보기 →</a>` : ''}
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111;">
    <div style="background:#1e3a5f;color:white;padding:16px 20px;border-radius:6px 6px 0 0;">
      <h1 style="margin:0;font-size:18px;">Regula 규제 인텔리전스 다이제스트</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">${payload.week_id} · ${payload.update_count}개 업데이트</p>
    </div>
    <div style="background:#f9fafb;padding:16px;border-radius:0 0 6px 6px;">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        ${payload.critical_count ? `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:999px;font-size:12px;">긴급 ${payload.critical_count}</span>` : ''}
        ${payload.high_count ? `<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:999px;font-size:12px;">중요 ${payload.high_count}</span>` : ''}
        ${payload.medium_count ? `<span style="background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:999px;font-size:12px;">주의 ${payload.medium_count}</span>` : ''}
      </div>
      ${updateCards}
      <div style="text-align:center;margin-top:20px;">
        <a href="${appUrl}/updates/digest/${payload.week_id}" style="background:#1e3a5f;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:14px;">웹에서 전체 보기</a>
      </div>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px;text-align:center;">
        Regula · 다이제스트 수신 설정 변경: <a href="${appUrl}/workflows/digest">수신 설정</a>
      </p>
    </div>
  </body></html>`;
}

// @MX:ANCHOR: [AUTO] sendDigestEmail — SendGrid integration for weekly digest delivery
// @MX:REASON: Called by API route and Inngest cron stub (fan_in >= 2, will reach 3+)
// @MX:SPEC: SPEC-REGULA-DIGEST-001
export async function sendDigestEmail(
  orgId: string,
  payload: DigestPayload,
  recipientEmails: string[],
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@regula.ai';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.regula.ai';

  if (!apiKey) {
    logger.warn('[digest/email] SENDGRID_API_KEY not set — skipping email');
    return false;
  }
  if (!recipientEmails.length) return false;

  const html = buildHtmlEmail(payload, appUrl);
  const criticalPrefix = payload.critical_count > 0 ? `[긴급 ${payload.critical_count}건] ` : '';
  const subject = `${criticalPrefix}Regula 주간 다이제스트 — ${payload.week_id} (${payload.update_count}개 규제 업데이트)`;

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: recipientEmails.map((email) => ({ email })) }],
        from: { email: fromEmail, name: 'Regula Intelligence' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (!res.ok) {
      logger.error(`[digest/email] SendGrid error ${res.status} for org ${orgId}`);
      return false;
    }
    logger.info(`[digest/email] Sent digest to ${recipientEmails.length} recipients for org ${orgId}`);
    return true;
  } catch (err) {
    logger.error('[digest/email] Send failed:', err);
    return false;
  }
}
