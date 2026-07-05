'use client';

// @MX:NOTE ConsultSessionList — REQ-V3-UI-050/051. Session list with empty state (E12) + NewSession button.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-050, REQ-V3-UI-051)
import { useConsultSessions } from '@/lib/queries/useConsult';
import { useTranslations } from 'next-intl';
import ConsultSessionCard from './ConsultSessionCard';
import { NewSessionDialog } from './NewSessionDialog';

interface ConsultSessionListProps {
  limit?: number;
}

export default function ConsultSessionList({ limit = 50 }: ConsultSessionListProps) {
  const { data: sessions, isLoading, error } = useConsultSessions({ limit });
  const t = useTranslations('consult');

  if (isLoading) {
    return (
      <div data-testid="loading" className="flex items-center justify-center py-8">
        <div className="text-sm text-ink-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="error" className="flex items-center justify-center py-8">
        <div className="text-sm text-red-600">세션을 불러오지 못했습니다.</div>
      </div>
    );
  }

  // E12: 빈 세션 목록 (consult.empty i18n)
  if (!sessions || sessions.length === 0) {
    return (
      <div
        data-testid="empty"
        className="flex flex-col items-center justify-center py-12 space-y-4"
      >
        <div className="text-6xl">💬</div>
        <div className="text-sm text-ink-500">{t('empty')}</div>
        <NewSessionDialog />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Session Button */}
      <div className="flex justify-end">
        <NewSessionDialog />
      </div>

      {/* Session Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <ConsultSessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
