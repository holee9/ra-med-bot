// @MX:NOTE [AUTO] CloseGateBadge — REQ-011 vigilance gate visual indicator.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-011, AC-07)
//
// Server component (no 'use client'). Renders the close-readiness state so
// users see WHY close is blocked before clicking. The server gate
// (lib/capa/close-gate.ts canCloseCapa) is the source of truth; this badge is
// advisory. Mirrors the labeling export-gate badge pattern.

import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

export type CloseGateState = 'allowed' | 'blocked_vigilance' | 'insufficient_role';

interface CloseGateBadgeProps {
  state: CloseGateState;
  /** Optional human-readable reason from the server gate. */
  reason?: string;
}

const LABELS: Record<CloseGateState, string> = {
  allowed: '종료 가능',
  blocked_vigilance: 'Vigilance 연결 누락',
  insufficient_role: '권한 부족',
} as const;

const DESCRIPTIONS: Record<CloseGateState, string> = {
  allowed: '모든 종료 조건이 충족되었습니다. 서명 후 종료할 수 있습니다.',
  blocked_vigilance:
    'reportable 불만이 Vigilance에 연결되지 않았습니다. 먼저 reportability 평가를 수행하세요.',
  insufficient_role: 'CAPA 종료는 RA Lead 권한 이상 필요합니다 (capa.close).',
} as const;

const STYLES: Record<CloseGateState, string> = {
  allowed: 'border-success/30 bg-success-bg text-success',
  blocked_vigilance: 'border-danger/30 bg-danger-bg text-danger',
  insufficient_role: 'border-ink-200 bg-ink-50 text-ink-600',
} as const;

export function CloseGateBadge({ state, reason }: CloseGateBadgeProps) {
  const Icon =
    state === 'allowed' ? CheckCircle2 : state === 'blocked_vigilance' ? AlertTriangle : Lock;
  return (
    <output
      className={`flex items-start gap-2 rounded-xs border px-3 py-2 text-sm ${STYLES[state]}`}
      aria-live="polite"
      data-testid={`close-gate-badge-${state}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">
          {LABELS[state]}
          {state !== 'allowed' && (
            <span className="ml-2 text-xs font-normal text-ink-500">REQ-011</span>
          )}
        </p>
        <p className="text-xs">{reason ?? DESCRIPTIONS[state]}</p>
      </div>
    </output>
  );
}
