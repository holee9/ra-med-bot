'use client';

// @MX:NOTE [AUTO] LocaleToggle — T-009 (REQ-ENTERPRISE-040).
// Cookie-based locale switching (ko/en) via /api/locale route.
// Options are plain <a> tags pointing to /api/locale — they always navigate
// server-side to set the cookie and redirect, regardless of React hydration.
// Issue #158 Group C: Preserves current pathname + query in returnTo parameter.
// Dropdown uses CSS group-focus-within: visible when any descendant has focus.
// This eliminates snap Chromium race conditions and React hydration timing issues.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-040), Issue #158 (Group C)

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function LocaleToggle() {
  const [locale, setLocale] = useState<string>('ko');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const match = document.cookie.split('; ').find((row) => row.startsWith('regula-locale='));
    const cookieLocale = match?.split('=')[1];
    if (cookieLocale) setLocale(cookieLocale);
  }, []);

  // Preserve current pathname + query in returnTo
  const query = searchParams.toString();
  const currentPath = query ? `${pathname}?${query}` : pathname;

  return (
    <div
      className="group relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape') (document.activeElement as HTMLElement)?.blur();
      }}
    >
      <button
        type="button"
        data-testid="locale-toggle"
        aria-label="언어 변경"
        aria-haspopup="menu"
        className="cursor-pointer rounded-md border border-ink-200 px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
      >
        {locale === 'ko' ? 'KO' : 'EN'}
      </button>

      <div
        data-testid="locale-dropdown"
        role="menu"
        aria-label="언어 선택"
        tabIndex={-1}
        className="invisible absolute right-0 top-full z-50 mt-1 min-w-[80px] rounded-md border border-ink-200 bg-white py-1 shadow-md group-focus-within:visible"
      >
        <a
          href={`/api/locale?locale=ko&returnTo=${encodeURIComponent(currentPath)}`}
          data-testid="locale-option-ko"
          role="menuitem"
          aria-current={locale === 'ko' ? 'true' : undefined}
          className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-ink-50 ${locale === 'ko' ? 'font-semibold text-brand-700' : 'text-ink-700'}`}
        >
          한국어
        </a>
        <a
          href={`/api/locale?locale=en&returnTo=${encodeURIComponent(currentPath)}`}
          data-testid="locale-option-en"
          role="menuitem"
          aria-current={locale === 'en' ? 'true' : undefined}
          className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-ink-50 ${locale === 'en' ? 'font-semibold text-brand-700' : 'text-ink-700'}`}
        >
          English
        </a>
      </div>
    </div>
  );
}
