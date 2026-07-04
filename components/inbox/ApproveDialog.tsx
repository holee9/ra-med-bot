// @MX:NOTE [AUTO] ApproveDialog — ESIG approval form (21 CFR Part 11).
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-013/014/015/016, AC-UI-005/006, Issue 320)
'use client';

import { useApproveTicket } from '@/lib/queries/useInbox';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface ApproveDialogProps {
  ticketId: string;
  onSuccess?: () => void;
}

/**
 * ESIG approval dialog. Posts {password, esigSignature} to /api/inbox/[id]/approve.
 * REQ-V3-UI-014: 401 → inline password error.
 * REQ-V3-UI-015: 400 → blocking "missing final_answer" message.
 * REQ-V3-UI-016: 200 → onSuccess (caller invalidates cache + navigates + toasts).
 */
export function ApproveDialog({ ticketId, onSuccess }: ApproveDialogProps) {
  const t = useTranslations('inbox');
  const [password, setPassword] = useState('');
  const [esigSignature, setEsigSignature] = useState('');

  const approveMutation = useApproveTicket();
  const error = approveMutation.error as { status?: number; message?: string } | null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    approveMutation.mutate(
      { ticketId, password, esigSignature },
      { onSuccess: () => onSuccess?.() },
    );
  };

  return (
    <form data-testid="approve-dialog" onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-lg font-semibold">{t('actions.approve')}</h3>

      <div>
        <label htmlFor={`approve-password-${ticketId}`} className="block text-sm">
          Password (re-authentication)
        </label>
        <input
          id={`approve-password-${ticketId}`}
          type="password"
          data-testid="approve-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="block w-full rounded border px-2 py-1"
        />
      </div>

      <div>
        <label htmlFor={`approve-esig-${ticketId}`} className="block text-sm">
          ESIG signature
        </label>
        <input
          id={`approve-esig-${ticketId}`}
          type="text"
          data-testid="approve-esig"
          value={esigSignature}
          onChange={(e) => setEsigSignature(e.target.value)}
          required
          className="block w-full rounded border px-2 py-1"
        />
      </div>

      {error?.status === 401 && (
        <p data-testid="approve-error-401" className="text-sm text-red-600">
          {t('errors.passwordInvalid')}
        </p>
      )}
      {error?.status === 400 && (
        <p data-testid="approve-error-400" className="text-sm text-red-600">
          {t('errors.missingFinalAnswer')}
        </p>
      )}

      <button
        type="submit"
        data-testid="approve-submit"
        disabled={approveMutation.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {approveMutation.isPending ? '…' : t('actions.approve')}
      </button>
    </form>
  );
}
