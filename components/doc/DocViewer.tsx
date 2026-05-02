'use client';

// @MX:NOTE DocViewer — full-screen modal overlay with source document navigation.
// Navy backdrop (bg-navy-900/80), 260px left nav, amber section highlight.
// Lazy-loaded via next/dynamic from AnswerBlock (REQ-CHAT-058 code-splitting).
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-044, REQ-CHAT-056, REQ-CHAT-057, REQ-CHAT-058)

import { ExternalLink, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useDocViewer } from '../../hooks/useDocViewer';

export function DocViewer() {
  const { isOpen, sourceDetail, isLoading, error, targetOffset, sourceIndex, close } =
    useDocViewer();

  const targetSectionRef = useRef<HTMLElement | null>(null);

  // Scroll to target section once content is loaded.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sourceDetail triggers scroll but ref is not a dep
  useEffect(() => {
    if (!isLoading && targetSectionRef.current) {
      targetSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isLoading, sourceDetail]);

  // Close on Escape key.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    },
    [close],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: <dialog> open/close API conflicts with controlled state; div+role="dialog" is used intentionally
      className="fixed inset-0 z-50 flex items-stretch bg-[#0a1628]/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={sourceDetail?.title ?? '문서 보기'}
    >
      {/* Backdrop click to close */}
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-default"
        aria-label="Close document viewer"
        onClick={close}
        tabIndex={-1}
      />

      {/* Modal panel — stopPropagation prevents backdrop-click from closing when clicking inside */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: click-only handler stops propagation, no keyboard action needed */}
      <div
        className="relative z-10 m-auto flex h-[90vh] w-full max-w-5xl rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left nav — 260px, source index + section list */}
        <aside className="w-[260px] shrink-0 flex flex-col border-r border-border-weak bg-surface-soft">
          {/* Source header */}
          <div className="flex items-center gap-2 border-b border-border-weak px-4 py-3">
            {sourceIndex !== null && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-100 font-mono text-xs font-semibold text-brand-700">
                {sourceIndex}
              </span>
            )}
            <span className="truncate text-xs font-semibold text-ink-600">
              {sourceDetail?.orgLabel ?? '출처'}
            </span>
          </div>

          {/* Section nav list */}
          <nav className="flex-1 overflow-y-auto p-2" aria-label="Document sections">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-brand-500" />
              </div>
            )}
            {!isLoading &&
              sourceDetail?.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#section-${section.id}`}
                  className="block rounded px-3 py-2 text-xs text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                >
                  {section.heading ?? section.anchor}
                </a>
              ))}
          </nav>
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-3 border-b border-border-weak px-6 py-3">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-ink-800">
                {isLoading ? '불러오는 중...' : (sourceDetail?.title ?? '문서')}
              </p>
              {sourceDetail?.year && (
                <p className="font-mono text-xs text-ink-400">{sourceDetail.year}</p>
              )}
            </div>

            {/* External link */}
            {sourceDetail?.url && (
              <a
                href={sourceDetail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded p-1.5 text-ink-400 hover:text-brand-600 transition-colors"
                aria-label="Open source in new tab"
              >
                <ExternalLink size={16} />
              </a>
            )}

            {/* Close button */}
            <button
              type="button"
              className="shrink-0 rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
              aria-label="Close"
              onClick={close}
            >
              <X size={16} />
            </button>
          </div>

          {/* Document body */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
                <Loader2 size={28} className="animate-spin text-brand-400" />
                <span className="text-sm">문서를 불러오는 중...</span>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!isLoading && !error && sourceDetail && (
              <article className="prose prose-sm max-w-none text-ink-800">
                {sourceDetail.sections.map((section) => {
                  const isTarget = section.offset === targetOffset;
                  return (
                    <section
                      key={section.id}
                      id={`section-${section.id}`}
                      ref={
                        isTarget
                          ? (el) => {
                              targetSectionRef.current = el;
                            }
                          : undefined
                      }
                      className={
                        isTarget
                          ? 'rounded-lg bg-amber-50 ring-2 ring-amber-300 px-4 py-3 mb-4'
                          : 'mb-4'
                      }
                      aria-current={isTarget ? 'location' : undefined}
                    >
                      {section.heading && (
                        <h3 className="mb-2 font-semibold text-ink-900">{section.heading}</h3>
                      )}
                      <p className="leading-relaxed text-ink-700 whitespace-pre-wrap">
                        {section.text}
                      </p>
                    </section>
                  );
                })}
              </article>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
