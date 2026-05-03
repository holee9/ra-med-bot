// @MX:NOTE App shell layout — REQ-FND-013, 014. Hosts Sidebar (260px) on the
// left and Topbar (56px) over the main content area. The robots metadata
// here is a redundant safety belt; root layout already forces noindex.
// T-007: auth() called here to pass showExpertReview prop to Sidebar (REQ-ENTERPRISE-029).
// auth is dynamically imported to avoid next-auth module resolution issues in test env.

import Sidebar from '@/components/shell/Sidebar';
import Topbar from '@/components/shell/Topbar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // T-007: Dynamic import avoids pulling next-auth into test bundles at module init time.
  let showExpertReview = false;
  try {
    const { auth } = await import('@/lib/auth');
    const { hasRole } = await import('@/lib/auth/rbac');
    const session = await auth();
    const userRole = (session?.user as { role?: string } | undefined)?.role;
    if (userRole) {
      showExpertReview = hasRole(userRole as Parameters<typeof hasRole>[0], 'ra-lead');
    }
  } catch {
    // In test/build environments where auth is unavailable, default to false.
  }

  return (
    <div className="flex min-h-screen bg-surface text-ink-700">
      <Sidebar showExpertReview={showExpertReview} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
