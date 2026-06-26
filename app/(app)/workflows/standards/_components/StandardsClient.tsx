'use client';

// @MX:NOTE [AUTO] StandardsClient — harmonized-standards tracker island.
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-001/015/016/019/021/022, AC-03/05/06)
// @MX:REASON Charter [지양-2] citation provenance: every rendered standard
//   carries its catalog source + version — no provenance-less assertion.
//   Charter [지양-4]: results are framed as "RA Lead review required" proposals.
//   AC-06: FDA recognition check per-standard; withdrawn → amber warning + alt.
//   AC-05: transition D-12/D-6/D-3 tier badge when a standards_updates row exists.
//   Matches promote-button (#50) / project-memory (#51) RBAC + testid patterns.

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';

// --- DeviceProfile (mirrors backend Zod in app/api/standards/applicability/route.ts) ---

type DeviceTypeKey =
  | 'general_device'
  | 'electrical_medical_device'
  | 'software_only'
  | 'in_vitro_diagnostic'
  | 'sterile_device'
  | 'active_implantable';

type RegulatoryPathway =
  | 'fda_510k'
  | 'fda_pma'
  | 'eu_mdr_class_i'
  | 'eu_mdr_class_ii'
  | 'eu_mdr_class_iii'
  | 'all';

const DEVICE_TYPE_OPTIONS: ReadonlyArray<{ value: DeviceTypeKey; label: string }> = [
  { value: 'general_device', label: '일반 기기' },
  { value: 'electrical_medical_device', label: '전기 의료기기' },
  { value: 'software_only', label: '소프트웨어 단독 (SaMD)' },
  { value: 'in_vitro_diagnostic', label: '체외진단의료기기 (IVD)' },
  { value: 'sterile_device', label: '멸균 기기' },
  { value: 'active_implantable', label: '능동 이식형' },
];

const PATHWAY_OPTIONS: ReadonlyArray<{ value: RegulatoryPathway; label: string }> = [
  { value: 'fda_510k', label: 'FDA 510(k)' },
  { value: 'fda_pma', label: 'FDA PMA' },
  { value: 'eu_mdr_class_i', label: 'EU MDR Class I' },
  { value: 'eu_mdr_class_ii', label: 'EU MDR Class II' },
  { value: 'eu_mdr_class_iii', label: 'EU MDR Class III' },
  { value: 'all', label: '전체 경로' },
];

// --- API response shapes (mirrors frozen backend contracts) ---

interface ApplicableStandardResult {
  standardNumber: string;
  title: string;
  body: string;
  version: string;
  isMandatory: boolean;
  applicabilityReason: string;
  fdaRecognized: boolean;
  euHarmonized: boolean;
  /** Charter [지양-2] citation provenance — standards_catalog PK (nullable for seed-only). */
  catalogRowId: string | null;
  /** Where the citation was resolved from: 'seed' (fallback) or 'catalog' (DB row). */
  source: 'seed' | 'catalog';
  catalogVersion: string | null;
  catalogBody: string | null;
}

interface ApplicabilityResponse {
  results: ApplicableStandardResult[];
  deviceProfileKey: string;
  durationMs: number;
}

type RecognitionStatus = 'recognized' | 'not_recognized' | 'withdrawn' | 'unknown';

interface RecognitionResult {
  standardId: string;
  status: RecognitionStatus;
  /** True when the live FDA API was NOT called (env unset or fetch failed). */
  degraded: boolean;
  alternativeStandardId?: string | null;
  alternativeStandardNumber?: string | null;
  note: string;
}

interface GapResponse {
  standardId: string;
  standardNumber: string | null;
  affectedCount: number;
  pendingReviewCount: number;
  summary: string;
}

interface StandardsUpdatesRow {
  id: string;
  revisionLabel: string;
  ojPublicationDate: string | null;
  dateOfWithdrawal: string | null;
  transitionEndDate: string | null;
  alertTier: 'info' | 'warn' | 'critical';
}

interface FormState {
  deviceTypeKey: DeviceTypeKey;
  regulatoryPathway: RegulatoryPathway;
  hasSoftware: boolean;
  isElectrical: boolean;
  isSterile: boolean;
  usesAnimalTissue: boolean;
}

const INITIAL_FORM: FormState = {
  deviceTypeKey: 'electrical_medical_device',
  regulatoryPathway: 'fda_510k',
  hasSoftware: false,
  isElectrical: true,
  isSterile: false,
  usesAnimalTissue: false,
};

// Standard body display order (matches handoff grouping convention).
const BODY_ORDER = ['ISO', 'IEC', 'EN', 'CEN', 'ASTM', 'Other'] as const;

function bodySortKey(body: string): string {
  const upper = body.toUpperCase();
  const idx = BODY_ORDER.indexOf(upper as (typeof BODY_ORDER)[number]);
  return idx === -1 ? 'Other' : upper;
}

// --- Tier badge helpers (mirrors transition-calculator tiers) ---

function tierLabel(tier: 'info' | 'warn' | 'critical'): string {
  if (tier === 'critical') return 'D-3 임박';
  if (tier === 'warn') return 'D-6 경고';
  return 'D-12 안내';
}

function tierClasses(tier: 'info' | 'warn' | 'critical'): string {
  if (tier === 'critical') return 'bg-danger-bg text-danger border-danger/30';
  if (tier === 'warn') return 'bg-warn-bg text-warn border-warn/30';
  return 'bg-brand-50 text-brand-700 border-brand-200';
}

function recognitionStatusBadge(status: RecognitionStatus, degraded: boolean) {
  const map: Record<RecognitionStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> =
    {
      recognized: {
        label: degraded ? 'FDA 인정 (로컬)' : 'FDA 인정',
        cls: 'bg-success-bg text-success border-success/30',
        icon: CheckCircle2,
      },
      not_recognized: {
        label: 'FDA 미인정',
        cls: 'bg-ink-100 text-ink-600 border-ink-200',
        icon: Info,
      },
      withdrawn: {
        label: 'FDA 인정 철회',
        cls: 'bg-warn-bg text-warn border-warn/30',
        icon: ShieldAlert,
      },
      unknown: {
        label: '인정 정보 없음',
        cls: 'bg-ink-100 text-ink-500 border-ink-200',
        icon: Info,
      },
    };
  const entry = map[status];
  return entry;
}

// --- Checkbox sub-component ---

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function CheckboxField({ id, label, checked, onChange, disabled }: CheckboxFieldProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-sm text-ink-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 rounded-xs"
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-xs border-ink-200 accent-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      />
      <span>{label}</span>
    </label>
  );
}

// --- Main island ---

export function StandardsClient() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [outcome, setOutcome] = useState<ApplicabilityResponse | null>(null);
  const [updates, setUpdates] = useState<Record<string, StandardsUpdatesRow[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-standard recognition check state, keyed by catalogRowId.
  const [recognition, setRecognition] = useState<Record<string, RecognitionResult>>({});
  const [recognitionLoading, setRecognitionLoading] = useState<Set<string>>(new Set());
  const [gapByStandard, setGapByStandard] = useState<Record<string, GapResponse>>({});
  const [gapLoading, setGapLoading] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'mapping' | 'gap'>('mapping');

  const formId = useId();

  // Group results by body for the mapping view.
  const grouped = useMemo(() => {
    if (!outcome) return [] as Array<{ body: string; items: ApplicableStandardResult[] }>;
    const byBody = new Map<string, ApplicableStandardResult[]>();
    for (const r of outcome.results) {
      const key = bodySortKey(r.body);
      const arr = byBody.get(key) ?? [];
      arr.push(r);
      byBody.set(key, arr);
    }
    return [...byBody.entries()]
      .sort(
        (a, b) =>
          BODY_ORDER.indexOf(a[0] as (typeof BODY_ORDER)[number]) -
          BODY_ORDER.indexOf(b[0] as (typeof BODY_ORDER)[number]),
      )
      .map(([body, items]) => ({ body, items }));
  }, [outcome]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOutcome(null);
    setUpdates({});
    setRecognition({});
    setGapByStandard({});
    try {
      const res = await fetch('/api/standards/applicability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceProfile: form }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `요청 실패 (${res.status})`);
      }
      const data = (await res.json()) as ApplicabilityResponse;
      setOutcome(data);

      // Fetch transition alerts for the catalog-row-bearing standards in
      // parallel. The backend may expose standards_updates via a future list
      // endpoint; today we query per-standard via GET /api/standards/[id]/updates
      // if available, and gracefully no-op on 404.
      const catalogIds = data.results.map((r) => r.catalogRowId).filter((id): id is string => !!id);
      const updatesMap: Record<string, StandardsUpdatesRow[]> = {};
      await Promise.all(
        catalogIds.map(async (id) => {
          try {
            const uRes = await fetch(`/api/standards/${id}/updates`, { method: 'GET' });
            if (uRes.ok) {
              const uBody = (await uRes.json()) as { items?: StandardsUpdatesRow[] };
              if (uBody.items && uBody.items.length > 0) updatesMap[id] = uBody.items;
            }
          } catch {
            // Endpoint may not exist yet — no active alerts for this standard.
          }
        }),
      );
      setUpdates(updatesMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  async function checkRecognitionFor(standard: ApplicableStandardResult) {
    if (!standard.catalogRowId) return;
    const id = standard.catalogRowId;
    setRecognitionLoading((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/standards/check?standard=${encodeURIComponent(id)}`, {
        method: 'GET',
      });
      if (!res.ok) throw new Error(`인정 확인 실패 (${res.status})`);
      const data = (await res.json()) as RecognitionResult;
      setRecognition((m) => ({ ...m, [id]: data }));
    } catch (err) {
      setRecognition((m) => ({
        ...m,
        [id]: {
          standardId: id,
          status: 'unknown',
          degraded: true,
          note: err instanceof Error ? err.message : '인정 확인 중 오류',
        },
      }));
    } finally {
      setRecognitionLoading((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function loadGapFor(standard: ApplicableStandardResult) {
    if (!standard.catalogRowId) return;
    const id = standard.catalogRowId;
    setGapLoading((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/standards/${id}/gap`, { method: 'GET' });
      if (!res.ok) throw new Error(`갭 분석 실패 (${res.status})`);
      const data = (await res.json()) as GapResponse;
      setGapByStandard((m) => ({ ...m, [id]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '갭 분석 중 오류');
    } finally {
      setGapLoading((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  const hasActiveAlerts = Object.keys(updates).length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Charter [지양-4] decision-support banner. */}
      <div
        className="flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        role="note"
        data-testid="standards-decision-support-banner"
      >
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          본 도구는 <strong>RA Lead 검토용 제안</strong>을 제공합니다. 표준 적용 여부는 규제
          전문가의 최종 판단이 필요하며, 자동 제출되지 않습니다.
        </span>
      </div>

      {/* Device profile form */}
      <form
        onSubmit={handleSubmit}
        aria-labelledby={`${formId}-heading`}
        className="flex flex-col gap-4 rounded-lg border border-ink-150 bg-surface p-5"
        data-testid="standards-form"
      >
        <h2 id={`${formId}-heading`} className="font-serif text-lg text-brand-800">
          기기 프로필 입력
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-deviceType`} className="text-sm font-medium text-ink-700">
              기기 유형
            </label>
            <select
              id={`${formId}-deviceType`}
              value={form.deviceTypeKey}
              onChange={(e) => setForm({ ...form, deviceTypeKey: e.target.value as DeviceTypeKey })}
              disabled={loading}
              className="rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {DEVICE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-pathway`} className="text-sm font-medium text-ink-700">
              규제 경로
            </label>
            <select
              id={`${formId}-pathway`}
              value={form.regulatoryPathway}
              onChange={(e) =>
                setForm({ ...form, regulatoryPathway: e.target.value as RegulatoryPathway })
              }
              disabled={loading}
              className="rounded-xs border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {PATHWAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="flex flex-wrap gap-5" disabled={loading}>
          <legend className="sr-only">기기 특성</legend>
          <CheckboxField
            id={`${formId}-software`}
            label="소프트웨어 포함"
            checked={form.hasSoftware}
            onChange={(v) => setForm({ ...form, hasSoftware: v })}
            disabled={loading}
          />
          <CheckboxField
            id={`${formId}-electrical`}
            label="전기 기기"
            checked={form.isElectrical}
            onChange={(v) => setForm({ ...form, isElectrical: v })}
            disabled={loading}
          />
          <CheckboxField
            id={`${formId}-sterile`}
            label="멸균 기기"
            checked={form.isSterile}
            onChange={(v) => setForm({ ...form, isSterile: v })}
            disabled={loading}
          />
          <CheckboxField
            id={`${formId}-animal`}
            label="동물 조직 사용"
            checked={form.usesAnimalTissue}
            onChange={(v) => setForm({ ...form, usesAnimalTissue: v })}
            disabled={loading}
          />
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-fit items-center gap-1.5 rounded-xs bg-brand-800 px-4 py-2 text-sm font-medium text-white transition-colors motion-safe:duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
          data-testid="standards-submit"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={14} aria-hidden="true" />
          )}
          <span>{loading ? '매핑 중…' : '적용 표준 매핑'}</span>
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"
          data-testid="standards-error"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {outcome && (
        <div className="flex flex-col gap-4" data-testid="standards-results">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-600" aria-live="polite">
              <strong className="text-ink-900">{outcome.results.length}</strong>개 적용 표준 · 매핑{' '}
              {outcome.durationMs}ms
            </p>
            <div
              className="flex items-center gap-1 rounded-md border border-ink-150 p-0.5"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'mapping'}
                onClick={() => setTab('mapping')}
                className="rounded-xs px-2.5 py-1 text-xs font-medium data-[active=true]:bg-brand-800 data-[active=true]:text-white text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                data-active={tab === 'mapping'}
                data-testid="standards-tab-mapping"
              >
                매핑 결과
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'gap'}
                onClick={() => setTab('gap')}
                className="rounded-xs px-2.5 py-1 text-xs font-medium data-[active=true]:bg-brand-800 data-[active=true]:text-white text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                data-active={tab === 'gap'}
                data-testid="standards-tab-gap"
              >
                갭 분석
              </button>
            </div>
          </div>

          {tab === 'mapping' ? (
            <div className="flex flex-col gap-6" data-testid="standards-mapping-view">
              {!hasActiveAlerts && (
                <p className="text-xs text-ink-500">현재 활성 전환 알림이 없습니다.</p>
              )}
              {grouped.map(({ body, items }) => (
                <section key={body} className="flex flex-col gap-2">
                  <h3
                    className="font-serif text-base text-brand-700"
                    data-testid={`standards-body-${body}`}
                  >
                    {body} · {items.length}건
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {items.map((s) => {
                      const id = s.catalogRowId ?? s.standardNumber;
                      const rec = s.catalogRowId ? recognition[s.catalogRowId] : undefined;
                      const recLoading = s.catalogRowId
                        ? recognitionLoading.has(s.catalogRowId)
                        : false;
                      const rows = s.catalogRowId ? (updates[s.catalogRowId] ?? []) : [];
                      const gap = s.catalogRowId ? gapByStandard[s.catalogRowId] : undefined;
                      const Badge = rec ? recognitionStatusBadge(rec.status, rec.degraded) : null;
                      return (
                        <li
                          key={id}
                          data-testid={`standard-card-${s.standardNumber}`}
                          className="flex flex-col gap-2 rounded-lg border border-ink-150 bg-surface p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-ink-900">
                                {s.standardNumber}
                              </p>
                              <p className="mt-0.5 text-sm text-ink-600">{s.title}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-1">
                              {s.fdaRecognized && (
                                <span className="rounded-xs border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                                  FDA 인정
                                </span>
                              )}
                              {s.euHarmonized && (
                                <span className="rounded-xs border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                                  EU 조화
                                </span>
                              )}
                              <span
                                className={`rounded-xs px-1.5 py-0.5 text-[11px] font-medium ${
                                  s.isMandatory
                                    ? 'bg-brand-100 text-brand-800'
                                    : 'bg-ink-100 text-ink-600'
                                }`}
                              >
                                {s.isMandatory ? '필수' : '권장'}
                              </span>
                            </div>
                          </div>

                          {/* Charter [지양-2] citation provenance — REQUIRED for every card. */}
                          <div
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xs bg-ink-50 px-2.5 py-1.5 text-[11px] text-ink-600"
                            data-testid={`standard-provenance-${s.standardNumber}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <BookOpen size={11} aria-hidden="true" />
                              <span>
                                출처:{' '}
                                {s.source === 'catalog' && s.catalogRowId
                                  ? '카탈로그(standards_catalog)'
                                  : '시드(로컬 기본)'}
                              </span>
                            </span>
                            <span>
                              버전: <strong className="text-ink-800">{s.version}</strong>
                              {s.catalogVersion && s.catalogVersion !== s.version && (
                                <span className="text-ink-400">
                                  {' '}
                                  (카탈로그: {s.catalogVersion})
                                </span>
                              )}
                            </span>
                            <span>표준 기관: {s.body}</span>
                          </div>

                          <p className="text-xs text-ink-500">{s.applicabilityReason}</p>

                          {/* AC-05: transition alerts (D-12/D-6/D-3 tier badge). */}
                          {rows.length > 0 && (
                            <div
                              className="flex flex-col gap-1"
                              data-testid={`standard-alerts-${s.standardNumber}`}
                            >
                              {rows.map((row) => (
                                <span
                                  key={row.id}
                                  className={`inline-flex w-fit items-center gap-1 rounded-xs border px-2 py-0.5 text-[11px] font-medium ${tierClasses(
                                    row.alertTier,
                                  )}`}
                                  data-testid={`standard-alert-${s.standardNumber}-${row.alertTier}`}
                                >
                                  <Clock size={11} aria-hidden="true" />
                                  {tierLabel(row.alertTier)}
                                  {row.dateOfWithdrawal && (
                                    <span className="font-normal opacity-80">
                                      · DoW {row.dateOfWithdrawal}
                                    </span>
                                  )}
                                  <span className="font-normal opacity-80">
                                    · {row.revisionLabel}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* AC-06: FDA recognition check result. */}
                          {rec && Badge && (
                            <div
                              className="flex flex-col gap-1"
                              data-testid={`standard-recognition-${s.standardNumber}`}
                            >
                              <span
                                className={`inline-flex w-fit items-center gap-1 rounded-xs border px-2 py-0.5 text-[11px] font-medium ${Badge.cls}`}
                              >
                                <Badge.icon size={11} aria-hidden="true" />
                                {Badge.label}
                                {rec.degraded && (
                                  <span className="font-normal opacity-70">(degraded)</span>
                                )}
                              </span>
                              <span className="text-[11px] text-ink-500">{rec.note}</span>
                              {/* Withdrawn → alternative suggestion (REQ-016). */}
                              {rec.status === 'withdrawn' && rec.alternativeStandardNumber && (
                                <span
                                  className="inline-flex w-fit items-center gap-1 rounded-xs bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                                  data-testid={`standard-alternative-${s.standardNumber}`}
                                >
                                  <ExternalLink size={11} aria-hidden="true" />
                                  대체 제안: {rec.alternativeStandardNumber}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => checkRecognitionFor(s)}
                              disabled={!s.catalogRowId || recLoading}
                              aria-label={`${s.standardNumber} FDA 인정 확인`}
                              className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors motion-safe:duration-200 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              data-testid={`standard-check-${s.standardNumber}`}
                            >
                              {recLoading ? (
                                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                              ) : (
                                <RefreshCw size={12} aria-hidden="true" />
                              )}
                              FDA 인정 확인
                            </button>
                            <button
                              type="button"
                              onClick={() => loadGapFor(s)}
                              disabled={!s.catalogRowId || gapLoading.has(s.catalogRowId ?? '')}
                              className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors motion-safe:duration-200 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              data-testid={`standard-gap-${s.standardNumber}`}
                            >
                              {(s.catalogRowId ? gapLoading.has(s.catalogRowId) : false) ? (
                                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                              ) : (
                                <ShieldAlert size={12} aria-hidden="true" />
                              )}
                              갭 분석
                            </button>
                          </div>

                          {gap && (
                            <div
                              className="rounded-xs bg-ink-50 px-2.5 py-1.5 text-[11px] text-ink-600"
                              data-testid={`standard-gap-result-${s.standardNumber}`}
                            >
                              <p>
                                영향 제품{' '}
                                <strong className="text-ink-800">{gap.affectedCount}</strong>건 ·
                                검토 필요{' '}
                                <strong className="text-ink-800">{gap.pendingReviewCount}</strong>건
                              </p>
                              <p className="text-ink-500">{gap.summary}</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3" data-testid="standards-gap-view">
              <p className="text-xs text-ink-500">
                표준 카드의 "갭 분석" 버튼으로 결과를 불러오세요. 영향받는 제품과 검토 대상 수가
                표시됩니다.
              </p>
              {outcome.results
                .filter((s) => s.catalogRowId && gapByStandard[s.catalogRowId])
                .map((s) => {
                  const gap = s.catalogRowId ? gapByStandard[s.catalogRowId] : undefined;
                  if (!gap) return null;
                  return (
                    <div
                      key={s.catalogRowId}
                      className="rounded-lg border border-ink-150 bg-surface p-4"
                      data-testid={`gap-card-${s.standardNumber}`}
                    >
                      <p className="text-sm font-semibold text-ink-900">{s.standardNumber}</p>
                      <p className="mt-1 text-xs text-ink-600">{gap.summary}</p>
                      <p className="mt-1 text-[11px] text-ink-500">
                        영향 {gap.affectedCount}건 · 검토 필요 {gap.pendingReviewCount}건
                      </p>
                    </div>
                  );
                })}
              {outcome.results.every((s) => !s.catalogRowId || !gapByStandard[s.catalogRowId]) && (
                <p className="text-xs text-ink-400" data-testid="gap-empty">
                  불러온 갭 분석 결과가 없습니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
