// @MX:NOTE [AUTO] Project Memory view — RA Lead decision-context management (Issue #51).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-006, REQ-013, REQ-014, AC-04)
// @MX:REASON Charter [지양-4]: server wrapper resolves the viewer role once at
//   request time and passes a boolean-ish prop (viewerRole string) to the
//   client island. The interactive list / pending-suggestion approve / create
//   / edit / invalidate state lives in <ProjectMemoryClient>. RBAC view =
//   ra-member+ (projectmemory.view). The API re-checks via withPermission, so
//   a spoofed prop only yields 403s. Matches LibraryClient (#50) pattern.

import { notFound } from 'next/navigation';
import { use } from 'react';
import ProjectMemoryClient, { type ProjectMemoryClientProps } from './ProjectMemoryClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectMemoryPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { id: projectId } = use(params);

  // Resolve role server-side so the create/edit/approve affordance decision
  // never reaches the client as a credential — only a role string. The
  // memory API still re-checks via withPermission('projectmemory.manage').
  let viewerRole: string | undefined;
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const session = await auth();
    viewerRole = (session?.user as { role?: string } | undefined)?.role;
  } catch {
    // Test/build env fallback — read-only (no manage affordances).
  }

  // Validate UUID shape (cheap client-arg guard; API does real IDOR).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(projectId)) {
    notFound();
  }

  const props: ProjectMemoryClientProps = { projectId, viewerRole };
  return <ProjectMemoryClient {...props} />;
}
