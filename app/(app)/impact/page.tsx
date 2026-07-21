import { auth } from '@/lib/kernel/auth';
import { hasRole } from '@/lib/kernel/auth/rbac';
import { redirect } from 'next/navigation';
import ImpactWizardClient from './ImpactWizardClient';

interface ImpactUser {
  role?: string;
  organizationId?: string;
}

interface ImpactSession {
  user: ImpactUser | null;
}

// @MX:ANCHOR [AUTO] Impact wizard page entry point — RBAC gate + client wrapper
// @MX:REASON Fan-in ≥3: direct navigation / sidebar link / RBAC test suite
// @MX:SPEC SPEC-V3-IMPACT-UI-001 (REQ-IMP-UI-001)

/**
 * Impact Wizard Server Component
 *
 * RBAC Gate: DENIES auditor, viewer, anonymous
 * ALLOWS: ra-member, qa-lead, ra-lead, admin
 *
 * Uses hasRole(userRole, 'ra-member') for stricter gate than consult's viewer-only check.
 * Redirects to /?error=access_denied for unauthorized access.
 */
export default async function ImpactPage() {
  const session = (await auth()) as ImpactSession | null;
  const user = session?.user;
  const userRole = user?.role as
    | 'ra-member'
    | 'qa-lead'
    | 'ra-lead'
    | 'admin'
    | 'viewer'
    | 'auditor'
    | undefined;

  // RED Phase requirement: hasRole(userRole, 'ra-member') must be used
  // DENY: auditor, viewer, undefined/anonymous → redirect
  // ALLOW: ra-member, qa-lead, ra-lead, admin → render wizard
  if (!userRole || !hasRole(userRole, 'ra-member')) {
    redirect('/?error=access_denied');
  }

  // Pass orgId to client component for mutation (REQ-IMP-UI-006a)
  const orgId = user?.organizationId || '';

  return <ImpactWizardClient orgId={orgId} />;
}
