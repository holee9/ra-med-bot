// @MX:NOTE [AUTO] LocaleToggle — T-009 (REQ-ENTERPRISE-040).
// Cookie-based locale switching (ko/en) without next-intl routing.
// Stores locale in localStorage key 'regula-locale' and sets cookie on toggle.
// Dropdown variant: locale-toggle opens locale-dropdown with locale-option-ko / locale-option-en.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-040)

'use client';

import { useEffect, useRef, useState } from 'react';

export function LocaleToggle() {
  const [locale, setLocale] = useState<string>('ko');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('regula-locale');
      if (stored) setLocale(stored);
    }
  }, []);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLocale = (next: string) => {
    localStorage.setItem('regula-locale', next);
    document.cookie = `regula-locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(next);
    setIsOpen(false);
    window.location.reload();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="locale-toggle"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="언어 변경"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="rounded-md border border-ink-200 px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
      >
        {locale === 'ko' ? 'KO' : 'EN'}
      </button>

      {isOpen && (
        <div
          data-testid="locale-dropdown"
          role="listbox"
          aria-label="언어 선택"
          className="absolute right-0 top-full z-50 mt-1 min-w-[80px] rounded-md border border-ink-200 bg-white py-1 shadow-md"
        >
          <button
            type="button"
            data-testid="locale-option-ko"
            role="option"
            aria-selected={locale === 'ko'}
            onClick={() => selectLocale('ko')}
            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-ink-50 ${locale === 'ko' ? 'font-semibold text-brand-700' : 'text-ink-700'}`}
          >
            한국어
          </button>
          <button
            type="button"
            data-testid="locale-option-en"
            role="option"
            aria-selected={locale === 'en'}
            onClick={() => selectLocale('en')}
            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-ink-50 ${locale === 'en' ? 'font-semibold text-brand-700' : 'text-ink-700'}`}
          >
            English
          </button>
        </div>
      )}
    </div>
  );
}
