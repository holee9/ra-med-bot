'use client';
// @MX:ANCHOR [AUTO] RiskApprovalGate — UI-level ra-lead enforcement gate.
// @MX:REASON Mirrors server-side risk.approve RBAC. Only renders approve button for ra-lead role.
// @MX:SPEC SPEC-REGULA-RISK-001 (T4.4, T2.10, REQ-RISK-037~038)

import { useState } from 'react';

interface RiskApprovalGateProps {
  runId: string;
  isApproved: boolean;
  approvedBy: string | null;
  /** Current user's role — only 'ra-lead' can trigger approval */
  currentUserRole: string;
  onApprove?: (runId: string, comment: string) => Promise<void>;
}

/**
 * RA-lead approval gate for risk management reports.
 *
 * Visibility rules per ISO 14971 §10 + project RBAC:
 * - ra-lead: sees approval form + submit button
 * - ra-member / other: sees read-only pending banner
 *
 * NOTE: The server-side withPermission('risk.approve') enforces the same check.
 * This component is a UX gate, NOT a security gate — never bypass server auth.
 */
export function RiskApprovalGate({
  runId,
  isApproved,
  approvedBy,
  currentUserRole,
  onApprove,
}: RiskApprovalGateProps) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRaLead = currentUserRole === 'ra-lead';

  async function handleApprove() {
    if (!onApprove) return;
    setLoading(true);
    setError(null);
    try {
      await onApprove(runId, comment);
    } catch (e) {
      setError((e as Error).message ?? 'Approval failed');
    } finally {
      setLoading(false);
    }
  }

  if (isApproved) {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 p-4">
        <p className="text-sm text-green-800 font-semibold">Report Approved</p>
        <p className="text-xs text-green-600 mt-1">
          Approved by RA-Lead (ID: {approvedBy}) per ISO 14971 §10
        </p>
      </div>
    );
  }

  if (!isRaLead) {
    return (
      <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
        <p className="text-sm text-yellow-800 font-semibold">Pending RA-Lead Approval</p>
        <p className="text-xs text-yellow-600 mt-1">
          This risk management report requires sign-off from an RA-Lead before distribution. Only
          users with the ra-lead role can approve.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">RA-Lead Approval</p>
      <p className="text-xs text-gray-500">
        By approving, you confirm this risk management report complies with ISO 14971:2019 §10 and
        all identified risks have been evaluated, controlled, and accepted (ALARP where applicable).
      </p>

      <div>
        <label
          htmlFor="risk-approval-comment"
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          Approval comment (optional)
        </label>
        <textarea
          id="risk-approval-comment"
          className="w-full border rounded p-2 text-sm min-h-[64px] focus:ring-1 focus:ring-blue-400"
          placeholder="Add any approval notes or conditions..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleApprove}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Approving...' : 'Approve Risk Management Report'}
      </button>
    </div>
  );
}

export default RiskApprovalGate;
