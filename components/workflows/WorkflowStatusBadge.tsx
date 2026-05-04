// @MX:NOTE [AUTO] WorkflowStatusBadge — displays colored status badge for workflow runs.
// Color mapping: queued=gray, running=blue, paused=yellow, pending_review=orange,
// approved=green, rejected=red, failed=red.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (M6)

export type WorkflowStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'failed';

const STATUS_COLOR: Record<WorkflowStatus, string> = {
  queued: 'bg-gray-100 text-gray-700 border-gray-300',
  running: 'bg-blue-100 text-blue-700 border-blue-300',
  paused: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  pending_review: 'bg-orange-100 text-orange-700 border-orange-300',
  approved: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
  failed: 'bg-red-100 text-red-700 border-red-300',
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  paused: 'Paused',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
};

// @MX:ANCHOR [AUTO] getStatusColor — exported pure function used by WorkflowStatusBadge component and tests.
// @MX:REASON Used by component render and unit tests (fan_in >= 2, public API boundary).
export function getStatusColor(status: WorkflowStatus): string {
  return STATUS_COLOR[status];
}

interface WorkflowStatusBadgeProps {
  status: WorkflowStatus;
}

export function WorkflowStatusBadge({ status }: WorkflowStatusBadgeProps) {
  return (
    <span
      data-status={status}
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
