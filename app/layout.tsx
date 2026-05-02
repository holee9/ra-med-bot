// @MX:NOTE Root layout — REQ-FND-011, 012, 015, 056. Sets <html lang="ko">,
// loads brand fonts via next/font/google + Pretendard, applies SessionProvider,
// and forces robots.index=false at the app root (login page overrides).

import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    plexSans.variable,
    plexMono.variable,
    sourceSerif.variable,
    notoSerifKr.variable,
  ].join(' ');
  return (
    <html lang="ko" suppressHydrationWarning className={fontVars}>
      <body>
        <SessionProvider>
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
