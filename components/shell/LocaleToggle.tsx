// @MX:NOTE [AUTO] LocaleToggle — T-009 (REQ-ENTERPRISE-040).
// Cookie-based locale switching (ko/en) without next-intl routing.
// Stores locale in localStorage key 'regula-locale' and sets cookie on toggle.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-040)

'use client';

import { useState } from 'react';

export function LocaleToggle() {
  const [locale, setLocale] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('regula-locale') ?? 'ko';
    }
    return 'ko';
  });

  const toggle = () => {
    const next = locale === 'ko' ? 'en' : 'ko';
    localStorage.setItem('regula-locale', next);
    // Set cookie for server-side locale detection (next-intl/server reads cookie)
    document.cookie = `regula-locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(next);
    window.location.reload();
  };

  return (
    <button
      type="button"
      data-testid="locale-toggle"
      onClick={toggle}
      aria-label="언어 변경"
      className="rounded-md border border-ink-200 px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
    >
      {locale === 'ko' ? 'KO' : 'EN'}
    </button>
  );
}
