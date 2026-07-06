'use client';

// @MX:NOTE [SPEC-V3-PERSONA-001 M4] Client wrapper bridging the server-injected
// initialTier to the presentation-only PersonaBar. On tier switch it:
//   1. writes the `regula-persona` cookie (writePersonaCookie),
//   2. updates local state so PersonaBar reflects the new tier immediately,
//   3. calls router.refresh() so layout.tsx/page.tsx re-read the cookie and
//      re-render the Sidebar tier prop + tier landing (no full reload —
//      REQ-V3-PER-NFR-001).
// The server remains the canonical authority: every refresh re-derives the tier
// from session.user.role via resolveTier and rejects cookie escalation
// (REQ-V3-PER-004 / REQ-V3-PER-NFR-002).

import { type Tier, isValidTierForRole, writePersonaCookie } from '@/lib/auth/persona';
import type { Role } from '@/lib/auth/rbac';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PersonaBar } from './PersonaBar';

interface PersonaBarClientProps {
  initialTier: Tier;
  userRole: Role;
}

export function PersonaBarClient({ initialTier, userRole }: PersonaBarClientProps) {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>(initialTier);

  function handleTierChange(next: Tier) {
    // Defense in depth: PersonaBar already gates on isValidTierForRole, but we
    // re-check here so a stale cookie or buggy caller cannot escalate.
    if (!isValidTierForRole(userRole, next)) return;
    setTier(next);
    writePersonaCookie(next);
    router.refresh();
  }

  return <PersonaBar currentTier={tier} userRole={userRole} onTierChange={handleTierChange} />;
}

export default PersonaBarClient;
