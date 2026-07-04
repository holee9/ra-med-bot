// @MX:NOTE [AUTO] state-tokens — triageState별 디자인 토큰 매핑 (일관 색상 적용).
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-041, AC-UI-010, Issue 320)
// 단일 진실원: TicketCard border, KanbanColumn accent, badge 색상이 모두 이 매핑을 참조.

import type { TriageState } from '@/lib/domains/inbox/types';

export interface StateToken {
  /** Card left border + column accent border */
  border: string;
  /** Badge background + text */
  badge: string;
  /** Column header accent bar */
  accent: string;
  /** Human-readable label key (i18n) */
  label: string;
}

export const STATE_TOKENS: Record<TriageState, StateToken> = {
  auto: {
    border: 'border-brand-300',
    badge: 'bg-brand-100 text-brand-800',
    accent: 'bg-brand-300',
    label: 'Auto',
  },
  'needs-review': {
    border: 'border-amber-500',
    badge: 'bg-amber-100 text-amber-800',
    accent: 'bg-amber-500',
    label: 'Needs Review',
  },
  escalated: {
    border: 'border-orange-500',
    badge: 'bg-orange-100 text-orange-800',
    accent: 'bg-orange-500',
    label: 'Escalated',
  },
  waiting: {
    border: 'border-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    accent: 'bg-blue-500',
    label: 'Waiting',
  },
  closed: {
    border: 'border-gray-400',
    badge: 'bg-gray-100 text-gray-800',
    accent: 'bg-gray-400',
    label: 'Closed',
  },
  rejected: {
    border: 'border-red-500',
    badge: 'bg-red-100 text-red-800',
    accent: 'bg-red-500',
    label: 'Rejected',
  },
};
