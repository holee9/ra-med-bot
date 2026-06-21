// @MX:NOTE [AUTO] Library view — personal bookmark list with search and tag filter.
// @MX:SPEC SPEC-REGULA-PERSONAL-LIB-001 (REQ-PERSONAL-003, 004, Issue #86)
//
// Client component. Reads bookmarks via /api/ra/personal/bookmarks and tags via
// /api/ra/personal/tags. Search and tag filter are reflected in the query string.

'use client';

import { useCallback, useEffect, useState } from 'react';

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

export default function LibraryPage() {
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

  // Refresh tag list whenever bookmarks change (create/delete/tag-edit affects the tag set).
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
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">내 라이브러리</h1>
        <p className="mt-2 text-sm text-ink-600">
          북마크한 답변을 태그와 메모로 정리하고 빠르게 다시 찾습니다.
        </p>
      </header>

      <div className="flex flex-col gap-3">
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
      </div>

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
    </section>
  );
}
