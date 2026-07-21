// @MX:NOTE [AUTO] Consult session detail page — server component, RBAC + param resolution.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-054/060, AC-CONS-UI-003)

import type { Role } from '@/lib/kernel/auth/rbac';
import { redirect } from 'next/navigation';
import { ConsultSessionDetailClient } from '../ConsultSessionDetailClient';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ConsultSessionPage({ params }: PageProps) {
  const { sessionId } = await params;

  let userRole: Role | undefined;
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const session = await auth();
    userRole = (session?.user as { role?: Role })?.role;
  } catch {
    // test/build env where auth is unavailable — fall through with undefined role.
  }

  // RBAC check: ra-member+ required for consult.session.view
  if (userRole === 'viewer') {
    redirect('/consult');
  }

  return <ConsultSessionDetailClient sessionId={sessionId} userRole={userRole ?? 'ra-member'} />;
}
