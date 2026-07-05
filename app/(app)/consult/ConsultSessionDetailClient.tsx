// @MX:NOTE [AUTO] ConsultSessionDetailClient — session detail view (client-side data fetch).
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-054/060, AC-CONS-UI-003)
'use client';

import { ConsultSessionDetail } from '@/components/consult/ConsultSessionDetail';
import type { Role } from '@/lib/auth/rbac';
import { useConsultSession } from '@/lib/queries/useConsult';
import { useRouter } from 'next/navigation';

interface ConsultSessionDetailClientProps {
  sessionId: string;
  userRole: Role;
}

export function ConsultSessionDetailClient({
  sessionId,
  userRole,
}: ConsultSessionDetailClientProps) {
  const router = useRouter();
  const { data, isLoading, error } = useConsultSession(sessionId);

  if (isLoading) {
    return <div data-testid="consult-detail-loading">Loading…</div>;
  }

  // 404 handling: redirect to /consult with no information leak (REQ-V3-UI-060)
  if (error || !data) {
    router.push('/consult');
    return (
      <div data-testid="consult-detail-notfound" className="p-4">
        세션을 찾을 수 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <ConsultSessionDetail session={data.session} turns={data.turns} userRole={userRole} />
    </div>
  );
}
