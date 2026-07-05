// @MX:NOTE Consult sessions list page — REQ-V3-UI-050.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-050, REQ-V3-UI-051)
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ConsultSessionListClient from './ConsultSessionListClient';

export default async function ConsultPage() {
  // Server-side RBAC gate (REQ-V3-UI-050)
  const session = await auth();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  if (!userRole || userRole === 'viewer') {
    redirect('/?error=access_denied');
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">상담 히스토리</h1>
      <ConsultSessionListClient />
    </div>
  );
}
