// @MX:NOTE [AUTO] Audit log admin page — displays audit trail for admin users.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-020)

import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function AuditLogsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (
    !hasRole((session.user as { role?: string }).role as Parameters<typeof hasRole>[0], 'admin')
  ) {
    redirect('/403');
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.actorId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-ink-900">감사 로그</h1>
      <div
        data-testid="audit-log-table"
        className="overflow-x-auto rounded-lg border border-border-weak"
      >
        <table className="min-w-full text-sm">
          <thead className="bg-surface-soft">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-ink-600">시각</th>
              <th className="px-4 py-2 text-left font-semibold text-ink-600">사용자</th>
              <th className="px-4 py-2 text-left font-semibold text-ink-600">액션</th>
              <th className="px-4 py-2 text-left font-semibold text-ink-600">리소스</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border-weak hover:bg-surface-soft/50">
                <td className="px-4 py-2 font-mono text-xs text-ink-500">
                  {row.createdAt?.toISOString() ?? '—'}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-ink-500">
                  {row.userId ?? '시스템'}
                </td>
                <td className="px-4 py-2 text-ink-800">{row.action}</td>
                <td className="px-4 py-2 text-xs text-ink-500">
                  {row.resourceType}/{row.resourceId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
