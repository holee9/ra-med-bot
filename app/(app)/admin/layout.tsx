import { auth } from '@/lib/kernel/auth';
import type { Metadata } from 'next';
// @MX:NOTE [AUTO] Admin section layout — robots noindex + admin-only role guard.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-077)
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    redirect('/403');
  }

  return <>{children}</>;
}
