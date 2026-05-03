// i18n/request.ts — REQ-ENTERPRISE-037
// next-intl "without i18n routing" mode.
// Locale is read from the regula-locale cookie (set by LocaleToggle).

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('regula-locale')?.value ?? 'ko';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
