// @MX:NOTE [AUTO] Calendar view — regulatory deadline list with filters.
// @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-003, Issue #44)

'use client';

import { useProjects } from '@/lib/queries/useProjects';
import { useUIStore } from '@/stores/ui';
import { useCallback, useEffect, useState } from 'react';

interface Deadline {
  id: string;
  projectId: string;
  title: string;
  deadlineType: string;
  jurisdiction: string;
  dueDate: string;
  status: string;
  reference: string | null;
  notes: string;
}

const TYPE_LABELS: Record<string, string> = {
  fda_510k_clock: 'FDA 510(k) 클락',
  eu_mdr_cert_expiry: 'EU MDR 인증서 만료',
  iso13485_surveillance: 'ISO 13485 감시심사',
  pmda_reexam: 'PMDA 재심사',
  custom: '사용자 정의',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'text-ink-600',
  due_soon: 'text-warning',
  overdue: 'text-danger',
  completed: 'text-success',
  cancelled: 'text-ink-400',
};

export default function CalendarPage() {
  const { data: projectsData = [] } = useProjects();
  const currentProjectId = useUIStore((s) => s.currentProjectId);
  const projects = projectsData as { id: string; name: string }[];
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    currentProjectId ?? projects[0]?.id ?? '',
  );
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jurisdiction, setJurisdiction] = useState('');
  const [status, setStatus] = useState('');

  const fetchDeadlines = useCallback(async () => {
    if (!selectedProjectId) {
      setDeadlines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ projectId: selectedProjectId });
    if (jurisdiction) params.set('jurisdiction', jurisdiction);
    if (status) params.set('status', status);
    const res = await fetch(`/api/ra/deadlines?${params}`, { cache: 'no-store' });
    if (!res.ok) {
      setError('데드라인을 불러오지 못했습니다.');
      setDeadlines([]);
      setLoading(false);
      return;
    }
    const body = await res.json();
    setDeadlines(body.deadlines ?? []);
    setLoading(false);
  }, [selectedProjectId, jurisdiction, status]);

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">규제 캘린더</h1>
        <p className="mt-2 text-sm text-ink-600">
          프로젝트별 규제 데드라인을 추적합니다. FDA 클락, EU MDR 갱신, ISO 감시심사 등.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900"
          aria-label="프로젝트 선택"
        >
          <option value="">프로젝트 선택</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className="rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900"
          aria-label="관할권 필터"
        >
          <option value="">전체 관할권</option>
          {['FDA', 'EU_MDR', 'MFDS', 'PMDA', 'NMPA', 'GLOBAL'].map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900"
          aria-label="상태 필터"
        >
          <option value="">전체 상태</option>
          {['upcoming', 'due_soon', 'overdue', 'completed', 'cancelled'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-ink-500">불러오는 중…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && deadlines.length === 0 && (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          이 프로젝트에 등록된 규제 데드라인이 없습니다.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {deadlines.map((d) => (
          <article
            key={d.id}
            className="rounded-lg border border-ink-150 bg-surface p-4"
            data-testid="deadline-card"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-medium text-ink-900">{d.title}</h2>
              <span
                className={`shrink-0 rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[d.status] ?? 'text-ink-600'
                }`}
              >
                {d.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {TYPE_LABELS[d.deadlineType] ?? d.deadlineType} · {d.jurisdiction}
            </p>
            <p className="mt-2 text-sm font-medium text-brand-700">
              마감: {new Date(d.dueDate).toLocaleDateString('ko-KR')}
            </p>
            {d.reference && <p className="mt-1 text-xs text-ink-500">참조: {d.reference}</p>}
            {d.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{d.notes}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
