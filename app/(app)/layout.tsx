// @MX:NOTE App shell layout — REQ-FND-013, 014. Hosts Sidebar (260px) on the
// left and Topbar (56px) over the main content area. The robots metadata
// here is a redundant safety belt; root layout already forces noindex.

import Sidebar from '@/components/shell/Sidebar';
import Topbar from '@/components/shell/Topbar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface text-ink-700">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
