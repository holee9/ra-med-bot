import { KnowledgeSourcesClient } from '@/components/settings/KnowledgeSourcesClient';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { LocaleToggle } from '@/components/shell/LocaleToggle';
import ThemeToggle from '@/components/shell/ThemeToggle';
import { auth } from '@/lib/kernel/auth';
import { type Role, hasRole } from '@/lib/kernel/auth/rbac';

// @MX:NOTE [AUTO] SettingsPage — server-rendered settings sections.
// Knowledge Sources section is gated server-side to ra-lead/admin only via hasRole.
// @MX:SPEC Issue #307 D-2 Phase 2 (Knowledge Sources Settings UI)

export default async function SettingsPage() {
  // Resolve role server-side. auth() throws in test/build env — fall through safely.
  let canManageKnowledgeSources = false;
  try {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    const role = user?.role as Role | undefined;
    // knowledgesources.manage = ra-lead+ (lib/kernel/auth/permissions.ts).
    canManageKnowledgeSources = role ? hasRole(role, 'ra-lead') : false;
  } catch {
    // No session context available — section stays hidden.
  }

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">설정</h1>
        <p className="mt-2 text-sm text-ink-600">표시 언어, 테마, 알림을 조정합니다.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-ink-150 bg-surface p-4">
          <h2 className="font-serif text-lg text-ink-900">테마</h2>
          <div className="mt-3">
            <ThemeToggle />
          </div>
        </section>
        <section className="rounded-lg border border-ink-150 bg-surface p-4">
          <h2 className="font-serif text-lg text-ink-900">언어</h2>
          <div className="mt-3">
            <LocaleToggle />
          </div>
        </section>
      </div>

      {/* REQ-NOTIFY-002: per-user notification preferences */}
      <section
        data-testid="notification-settings-section"
        className="rounded-lg border border-ink-150 bg-surface p-6"
      >
        <h2 className="mb-4 font-serif text-lg text-ink-900">알림 설정</h2>
        <NotificationSettings />
      </section>

      {/* Issue 307 D-2 Phase 2: knowledge sources management (ra-lead/admin only). */}
      {canManageKnowledgeSources && (
        <section
          data-testid="knowledge-sources-settings-section"
          className="rounded-lg border border-ink-150 bg-surface p-6"
        >
          <h2 className="mb-1 font-serif text-lg text-ink-900">지식베이스 연결</h2>
          <p className="mb-4 text-sm text-ink-500">
            규제 문서를 동기화할 Git 저장소를 연결합니다. 동기화된 문서는 RAG 검색에 사용됩니다.
          </p>
          <KnowledgeSourcesClient />
        </section>
      )}
    </section>
  );
}
