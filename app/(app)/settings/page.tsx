import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { LocaleToggle } from '@/components/shell/LocaleToggle';
import ThemeToggle from '@/components/shell/ThemeToggle';

export default function SettingsPage() {
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
    </section>
  );
}
