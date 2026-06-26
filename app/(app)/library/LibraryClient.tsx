// @MX:NOTE [AUTO] LibraryClient — interactive library shell with personal/team tabs.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-008/011/012/015, Issue #50, AC-06)
//
// Client component. Personal tab reads bookmarks via /api/ra/personal/bookmarks
// (unchanged from #86). Team tab reads promoted answers via
// /api/knowledge-promo/library (status='active'). Search and tag filter are
// local-state. Source-message provenance link (REQ-011) points at the original
// chat message so promoted content is never presented as origin-less.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Bookmark {
  id: string;
  messageId: string;
  blockId: string | null;
  title: string;
  customTitle: string | null;
  note: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface TeamEntry {
  id: string;
  sourceMessageId: string;
  title: string;
  tags: string[];
  promotedBy: string;
  promotedAt: string;
}

export interface LibraryClientProps {
  /** Whether the viewer can see the Team Knowledge tab (ra-member+). */
  canViewTeam: boolean;
}

type Tab = 'personal' | 'team';

export default function LibraryClient({ canViewTeam }: LibraryClientProps) {
  // Honor ?tab=team from the sidebar deep link; fall back to personal.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'personal';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'team' && canViewTeam ? 'team' : 'personal';
  });

  // Sync the URL query when the tab changes (shareable deep links, back-button).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (tab === 'team') url.searchParams.set('tab', 'team');
    else url.searchParams.delete('tab');
    window.history.replaceState({}, '', url);
  }, [tab]);

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">내 라이브러리</h1>
        <p className="mt-2 text-sm text-ink-600">
          북마크한 답변과 조직 공유 지식을 태그로 정리하고 빠르게 다시 찾습니다.
        </p>
      </header>

      {/* Tab switcher — role-gated. */}
      <div role="tablist" aria-label="라이브러리 뷰" className="flex gap-1 border-b border-ink-150">
        <TabButton
          active={tab === 'personal'}
          onClick={() => setTab('personal')}
          testId="tab-personal"
        >
          내 북마크
        </TabButton>
        {canViewTeam && (
          <TabButton active={tab === 'team'} onClick={() => setTab('team')} testId="tab-team">
            팀 지식
          </TabButton>
        )}
      </div>

      {tab === 'personal' && <PersonalBookmarks />}
      {tab === 'team' && <TeamKnowledge />}
    </section>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}

function TabButton({ active, onClick, testId, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        active
          ? 'border-brand-700 text-brand-800'
          : 'border-transparent text-ink-500 hover:text-ink-700'
      }`}
    >
      {children}
    </button>
  );
}

// ----- Personal bookmarks (unchanged behavior from #86, refactored into a sub-component) -----

function PersonalBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async (tag: string | null, q: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (q) params.set('q', q);
    const res = await fetch(`/api/ra/personal/bookmarks?${params}`, { cache: 'no-store' });
    if (!res.ok) {
      setError('북마크를 불러오지 못했습니다.');
      setBookmarks([]);
      setLoading(false);
      return;
    }
    const body = await res.json();
    setBookmarks(body.bookmarks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookmarks(activeTag, query);
  }, [activeTag, query, fetchBookmarks]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional re-fetch on bookmark mutation
  useEffect(() => {
    fetch('/api/ra/personal/tags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body) => setTags(body.tags ?? []))
      .catch(() => setTags([]));
  }, [bookmarks]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/ra/personal/bookmarks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="personal-bookmarks-panel">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="제목·메모·태그 검색"
        className="w-full rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
        aria-label="북마크 검색"
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="태그 필터">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full px-3 py-1 text-xs ${
              activeTag === null
                ? 'bg-brand-800 text-white'
                : 'border border-ink-150 text-ink-600 hover:bg-ink-50'
            }`}
          >
            전체
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`rounded-full px-3 py-1 text-xs ${
                activeTag === tag
                  ? 'bg-brand-800 text-white'
                  : 'border border-ink-150 text-ink-600 hover:bg-ink-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-ink-500">불러오는 중…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && bookmarks.length === 0 && (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          북마크한 답변이 없습니다. 답변에서 북마크 버튼을 눌러 저장해 보세요.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {bookmarks.map((b) => (
          <article
            key={b.id}
            className="rounded-lg border border-ink-150 bg-surface p-4"
            data-testid="bookmark-card"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-medium text-ink-900">{b.customTitle || b.title}</h2>
              <button
                type="button"
                onClick={() => handleDelete(b.id)}
                className="shrink-0 text-xs text-ink-400 hover:text-danger"
                aria-label="북마크 삭제"
              >
                삭제
              </button>
            </div>
            {b.note && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{b.note}</p>}
            {b.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {b.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-ink-400">
              {new Date(b.createdAt).toLocaleString('ko-KR')}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

// ----- Team knowledge (promoted answers) — SPEC-REGULA-KNOWLEDGE-PROMO-001 -----

function TeamKnowledge() {
  const [entries, setEntries] = useState<TeamEntry[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (tag: string | null) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    const res = await fetch(`/api/knowledge-promo/library?${params}`, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 403) {
        setError('팀 지식 조회 권한이 없습니다.');
      } else {
        setError('팀 지식을 불러오지 못했습니다.');
      }
      setEntries([]);
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { entries?: TeamEntry[] };
    setEntries(body.entries ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries(activeTag);
  }, [activeTag, fetchEntries]);

  // All tags across the current result set — drives the filter chip row.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) for (const t of e.tags) set.add(t);
    return Array.from(set).sort();
  }, [entries]);

  // Local title/substring search (the API supports tag filtering; free-text
  // search is done client-side over the loaded page to keep the UX snappy).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [entries, query]);

  return (
    <div className="flex flex-col gap-3" data-testid="team-knowledge-panel">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="제목·태그 검색"
        className="w-full rounded-md border border-ink-150 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
        aria-label="팀 지식 검색"
      />

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="태그 필터">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full px-3 py-1 text-xs ${
              activeTag === null
                ? 'bg-brand-800 text-white'
                : 'border border-ink-150 text-ink-600 hover:bg-ink-50'
            }`}
          >
            전체
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`rounded-full px-3 py-1 text-xs ${
                activeTag === tag
                  ? 'bg-brand-800 text-white'
                  : 'border border-ink-150 text-ink-600 hover:bg-ink-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-ink-500">불러오는 중…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="rounded-lg border border-ink-150 bg-surface p-4 text-sm text-ink-500">
          승격된 답변이 없습니다. RA Lead 이상이 답변에서 &ldquo;팀 지식으로 승격&rdquo; 버튼을 눌러
          공유할 수 있습니다.
        </p>
      )}

      <ul className="flex flex-col gap-3" aria-label="승격된 답변 목록">
        {filtered.map((e) => (
          <li key={e.id}>
            <article
              data-testid="team-entry-card"
              className="rounded-lg border border-ink-150 bg-surface p-4"
            >
              <h2 className="text-sm font-medium text-ink-900">{e.title}</h2>

              {e.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {e.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* REQ-011 provenance: traceability to the original message.
                  Without this link, promoted content would look origin-less. */}
              <p className="mt-2 text-xs text-ink-500">
                원본 답변:{' '}
                <a
                  href={`/chat?message=${encodeURIComponent(e.sourceMessageId)}`}
                  data-testid="team-entry-source-link"
                  className="text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  메시지 {e.sourceMessageId.slice(0, 8)}…
                </a>
              </p>

              <p className="mt-1 text-xs text-ink-400">
                승격일 {new Date(e.promotedAt).toLocaleDateString('ko-KR')}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
