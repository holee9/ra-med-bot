import { eq } from 'drizzle-orm';
// @MX:SPEC SPEC-REGULA-DIGEST-001
// Digest preferences settings page — authenticated.
import { redirect } from 'next/navigation';
import { auth } from '../../../../lib/auth';
import { db } from '../../../../lib/db/client';
import { orgDigestPreferences } from '../../../../lib/db/schema';
import DigestPreferencesForm from './digest-preferences-form';

export const metadata = { title: 'Regula — 다이제스트 설정' };

export default async function DigestSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const orgId = (session.user as { organizationId?: string }).organizationId;
  if (!orgId) redirect('/dashboard');

  const prefs = await db
    .select()
    .from(orgDigestPreferences)
    .where(eq(orgDigestPreferences.orgId, orgId))
    .limit(1);

  const currentPrefs = prefs[0] ?? {
    frequency: 'weekly',
    timezone: 'UTC',
    sendDayOfWeek: 1,
    sendHour: 9,
    minSeverity: 'medium',
    includeImmediateAlerts: true,
    recipientEmails: [] as string[],
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">규제 다이제스트 설정</h1>
      <p className="text-sm text-gray-500 mb-6">
        포트폴리오 맞춤 주간 규제 인텔리전스 다이제스트 수신 방식을 설정합니다.
      </p>
      <DigestPreferencesForm orgId={orgId} initialPrefs={currentPrefs} />
    </div>
  );
}
