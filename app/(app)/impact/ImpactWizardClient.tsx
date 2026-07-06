'use client';

import { ImpactWizard } from '@/components/impact/ImpactWizard';

interface ImpactWizardClientProps {
  orgId: string;
}

/**
 * Impact Wizard Client Component Wrapper
 *
 * Receives orgId from server component and passes to wizard.
 * REQ-IMP-UI-006a: orgId provenance from session.user.orgId
 */
export default function ImpactWizardClient({ orgId }: ImpactWizardClientProps) {
  return <ImpactWizard orgId={orgId} />;
}
