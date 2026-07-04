// @MX:NOTE [AUTO] ViewerTicketSummary — viewer own-ticket 최소 보기.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-034, AC-UI-009, Issue 320)
// viewer(전사 직원)가 자신이 소유한 질문의 상태/승인 답변을 최소하게 보는 컴포넌트.
// RA 전용 필드(raAssignee, escalateTo, audit timeline)는 게이트 — 이 컴포넌트에 표시 안 함.
'use client';

import type { TriageState } from '@/lib/domains/inbox/types';

interface ViewerTicketSummaryProps {
  ticket: {
    id: string;
    question: string;
    triageState: TriageState;
    finalAnswer?: string | null;
  };
}

export function ViewerTicketSummary({ ticket }: ViewerTicketSummaryProps) {
  return (
    <div data-testid="viewer-ticket-summary" className="space-y-2 rounded border p-4">
      <h3 className="font-semibold">{ticket.question}</h3>
      <p className="text-sm text-gray-600">상태: {ticket.triageState}</p>
      {ticket.finalAnswer && (
        <div className="mt-2 border-t pt-2">
          <p className="text-xs text-gray-500">승인된 답변</p>
          <p className="text-sm" data-testid="viewer-final-answer">
            {ticket.finalAnswer}
          </p>
        </div>
      )}
    </div>
  );
}
