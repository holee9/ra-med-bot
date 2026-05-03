// @MX:NOTE Root layout — REQ-FND-011, 012, 015, 056, REQ-ENTERPRISE-037, 041.
// Sets <html lang> dynamically from regula-locale cookie (default: 'ko').
// Loads brand fonts via next/font/google + Pretendard, applies SessionProvider,
// and forces robots.index=false at the app root (login page overrides).

import { SkipToContent } from '@/components/a11y/SkipToContent';
import { AnalyticsProvider } from '@/components/observability/AnalyticsProvider';
import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Serif_KR, Source_Serif_4 } from 'next/font/google';
import { ReactQueryProvider } from './providers';
import '@fontsource/pretendard';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
  display: 'swap',
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-noto-serif-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Regula', template: '%s | Regula' },
  description: 'Medical device regulatory affairs AI assistant',
  // REQ-FND-056: app pages are noindexed by default; /login overrides.
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  const fontVars = [
    plexSans.variable,
    plexMono.variable,
    sourceSerif.variable,
    notoSerifKr.variable,
  ].join(' ');
  return (
    <html lang={locale} suppressHydrationWarning className={fontVars}>
      <head>
        {/* REQ-ENTERPRISE-033: FOUT prevention — reads persisted theme from localStorage
            and applies 'dark' class to <html> before React hydrates. Must be first script
            in <head> to prevent flash of unstyled (wrong) theme. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional inline FOUT-prevention script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('regula_ui');var t=s?JSON.parse(s).theme:null;if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <SkipToContent />
        <AnalyticsProvider />
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ReactQueryProvider>{children}</ReactQueryProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
