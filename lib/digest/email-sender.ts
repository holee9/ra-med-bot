// @MX:SPEC: SPEC-REGULA-DIGEST-001
import DOMPurify from 'dompurify';
import { logger } from '../observability/logger';
import type { DigestPayload } from './digest-generator';

function buildHtmlEmail(payload: DigestPayload, appUrl: string): string {
  const digestUrl = `${appUrl}/updates/digest/${payload.week_id}?token=${encodeURIComponent(payload.share_token)}`;
  const severityColor: Record<string, string> = {
    critical: 'crimson',
    high: 'darkorange',
    medium: 'royalblue',
    low: 'seagreen',
  };
  const severityBg: Record<string, string> = {
    critical: 'mistyrose',
    high: 'papayawhip',
    medium: 'aliceblue',
    low: 'honeydew',
  };
  const updateCards = payload.updates
    .slice(0, 20)
    .map(
      (u) => {
        const sanitizedTitle = DOMPurify.sanitize(u.title, { USE_PROFILES: { html: true } });
        const sanitizedRegion = DOMPurify.sanitize(u.region, { USE_PROFILES: { html: true } });
        const sanitizedImpact = DOMPurify.sanitize(u.impact_summary, { USE_PROFILES: { html: true } });
        const sanitizedSourceUrl = u.source_url ? DOMPurify.sanitize(u.source_url, { USE_PROFILES: { html: true } }) : '';

        return `
    <div style="border:1px solid gainsboro;border-left:4px solid ${severityColor[u.severity_classification]};border-radius:4px;padding:12px;margin-bottom:10px;">
      <div style="font-weight:600;font-size:14px;color:black;">${sanitizedTitle}</div>
      <div style="font-size:12px;color:dimgray;margin:4px 0;">${sanitizedRegion} · ${u.severity_classification.toUpperCase()} · ${new Date(u.published_at).toLocaleDateString()}</div>
      <div style="font-size:13px;color:darkslategray;margin-top:6px;">${sanitizedImpact}</div>
      ${sanitizedSourceUrl ? `<a href="${sanitizedSourceUrl}" style="font-size:12px;color:royalblue;">원문 보기 →</a>` : ''}
    </div>`;
      },
    )
    .join('');

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:20px;color:black;">
    <div style="background:midnightblue;color:white;padding:16px 20px;border-radius:6px 6px 0 0;">
      <h1 style="margin:0;font-size:18px;">Regula 규제 인텔리전스 다이제스트</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">${payload.week_id} · ${payload.update_count}개 업데이트</p>
    </div>
    <div style="background:ghostwhite;padding:16px;border-radius:0 0 6px 6px;">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        ${payload.critical_count ? `<span style="background:${severityBg.critical};color:${severityColor.critical};padding:2px 8px;border-radius:999px;font-size:12px;">긴급 ${payload.critical_count}</span>` : ''}
        ${payload.high_count ? `<span style="background:${severityBg.high};color:${severityColor.high};padding:2px 8px;border-radius:999px;font-size:12px;">중요 ${payload.high_count}</span>` : ''}
        ${payload.medium_count ? `<span style="background:${severityBg.medium};color:${severityColor.medium};padding:2px 8px;border-radius:999px;font-size:12px;">주의 ${payload.medium_count}</span>` : ''}
      </div>
      ${updateCards}
      <div style="text-align:center;margin-top:20px;">
        <a href="${digestUrl}" style="background:midnightblue;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:14px;">웹에서 전체 보기</a>
      </div>
      <p style="font-size:11px;color:darkgray;margin-top:16px;text-align:center;">
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
    logger.info(
      `[digest/email] Sent digest to ${recipientEmails.length} recipients for org ${orgId}`,
    );
    return true;
  } catch (err) {
    logger.error('[digest/email] Send failed:', err);
    return false;
  }
}
