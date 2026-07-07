
// @MX:LEGACY archived from app
'use client';
// @MX:SPEC SPEC-REGULA-DHF-001
// Tabbed detail view: Overview | Design Inputs | V&V | Design Reviews

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DHF {
  id: string;
  deviceName: string;
  deviceModel: string | null;
  intendedUse: string;
  jurisdiction: string;
  regulatoryFramework: string;
  status: string;
  completenessScore: number;
  designFreezeDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DesignInput {
  id: string;
  inputType: string;
  requirementId: string | null;
  description: string;
  source: string | null;
  priority: string;
  verificationStatus: string;
  createdAt: string;
}

interface Verification {
  id: string;
  designInputId: string | null;
  verificationType: string;
  protocolTitle: string;
  result: string | null;
  testDate: string | null;
  performedBy: string | null;
  notes: string | null;
  createdAt: string;
}

interface DesignReview {
  id: string;
  reviewStage: string;
  reviewDate: string;
  attendees: string[];
  decisions: string | null;
  openActions: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const VERIFICATION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-ink-100 text-ink-600',
  verified: 'bg-green-100 text-green-700',
  not_applicable: 'bg-ink-50 text-ink-400',
};

const RESULT_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-600',
  pending: 'bg-amber-100 text-amber-700',
  not_started: 'bg-ink-100 text-ink-500',
};

const INPUT_TYPE_LABELS: Record<string, string> = {
  user_need: 'User Need',
  regulatory: 'Regulatory',
  standards: 'Standards',
  risk: 'Risk',
};

const REVIEW_STAGE_LABELS: Record<string, string> = {
  concept: 'Concept',
  preliminary: 'Preliminary',
  critical: 'Critical',
  final: 'Final',
  design_freeze: 'Design Freeze',
};

function CompletenessBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  const textColor =
    score >= 80 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-600';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-ink-100 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-semibold w-12 text-right ${textColor}`}>{score}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Input Form (inline)
// ---------------------------------------------------------------------------

function AddInputForm({
  dhfId,
  onAdded,
}: { dhfId: string; onAdded: (input: DesignInput) => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    input_type: 'user_need',
    requirement_id: '',
    description: '',
    source: '',
    priority: 'must',
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
      >
        + Add Input
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ra/dhf/${dhfId}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_type: form.input_type,
          requirement_id: form.requirement_id || undefined,
          description: form.description,
          source: form.source || undefined,
          priority: form.priority,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { input: DesignInput };
        onAdded(data.input);
        setOpen(false);
        setForm({
          input_type: 'user_need',
          requirement_id: '',
          description: '',
          source: '',
          priority: 'must',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-brand-200 bg-brand-50 p-4 flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.input_type}
          onChange={(e) => setForm((f) => ({ ...f, input_type: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs bg-white"
        >
          <option value="user_need">User Need</option>
          <option value="regulatory">Regulatory</option>
          <option value="standards">Standards</option>
          <option value="risk">Risk</option>
        </select>
        <input
          type="text"
          placeholder="Req ID (e.g. REQ-001)"
          value={form.requirement_id}
          onChange={(e) => setForm((f) => ({ ...f, requirement_id: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs"
        />
      </div>
      <textarea
        required
        placeholder="Requirement description..."
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        rows={2}
        className="rounded border border-ink-300 px-2 py-1.5 text-xs resize-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Source (optional)"
          value={form.source}
          onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs"
        />
        <select
          value={form.priority}
          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs bg-white"
        >
          <option value="must">Must</option>
          <option value="should">Should</option>
          <option value="nice_to_have">Nice to have</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-500 hover:text-ink-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Add Verification Form (inline)
// ---------------------------------------------------------------------------

function AddVerificationForm({
  dhfId,
  inputs,
  onAdded,
}: { dhfId: string; inputs: DesignInput[]; onAdded: (v: Verification) => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    design_input_id: '',
    verification_type: 'test',
    protocol_title: '',
    result: '',
    performed_by: '',
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
      >
        + Add Verification
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ra/dhf/${dhfId}/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          design_input_id: form.design_input_id || undefined,
          verification_type: form.verification_type,
          protocol_title: form.protocol_title,
          result: form.result || undefined,
          performed_by: form.performed_by || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { verification: Verification };
        onAdded(data.verification);
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-brand-200 bg-brand-50 p-4 flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.verification_type}
          onChange={(e) => setForm((f) => ({ ...f, verification_type: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs bg-white"
        >
          <option value="test">Test</option>
          <option value="analysis">Analysis</option>
          <option value="inspection">Inspection</option>
          <option value="demonstration">Demonstration</option>
        </select>
        <select
          value={form.design_input_id}
          onChange={(e) => setForm((f) => ({ ...f, design_input_id: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs bg-white"
        >
          <option value="">No linked input</option>
          {inputs.map((i) => (
            <option key={i.id} value={i.id}>
              {i.requirementId ? `${i.requirementId}: ` : ''}
              {i.description.slice(0, 40)}
            </option>
          ))}
        </select>
      </div>
      <input
        required
        type="text"
        placeholder="Protocol title..."
        value={form.protocol_title}
        onChange={(e) => setForm((f) => ({ ...f, protocol_title: e.target.value }))}
        className="rounded border border-ink-300 px-2 py-1.5 text-xs"
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.result}
          onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs bg-white"
        >
          <option value="">No result yet</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="pending">Pending</option>
          <option value="not_started">Not Started</option>
        </select>
        <input
          type="text"
          placeholder="Performed by"
          value={form.performed_by}
          onChange={(e) => setForm((f) => ({ ...f, performed_by: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-500 hover:text-ink-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Add Review Form (inline)
// ---------------------------------------------------------------------------

function AddReviewForm({ dhfId, onAdded }: { dhfId: string; onAdded: (r: DesignReview) => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    review_stage: 'preliminary',
    review_date: new Date().toISOString().split('T')[0],
    attendees_raw: '',
    decisions: '',
    approved_by: '',
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
      >
        + Add Review
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ra/dhf/${dhfId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_stage: form.review_stage,
          review_date: form.review_date,
          attendees: form.attendees_raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          decisions: form.decisions || undefined,
          approved_by: form.approved_by || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { review: DesignReview };
        onAdded(data.review);
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-brand-200 bg-brand-50 p-4 flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.review_stage}
          onChange={(e) => setForm((f) => ({ ...f, review_stage: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs bg-white"
        >
          <option value="concept">Concept</option>
          <option value="preliminary">Preliminary</option>
          <option value="critical">Critical</option>
          <option value="final">Final</option>
          <option value="design_freeze">Design Freeze</option>
        </select>
        <input
          type="date"
          required
          value={form.review_date}
          onChange={(e) => setForm((f) => ({ ...f, review_date: e.target.value }))}
          className="rounded border border-ink-300 px-2 py-1.5 text-xs"
        />
      </div>
      <input
        type="text"
        placeholder="Attendees (comma-separated)"
        value={form.attendees_raw}
        onChange={(e) => setForm((f) => ({ ...f, attendees_raw: e.target.value }))}
        className="rounded border border-ink-300 px-2 py-1.5 text-xs"
      />
      <textarea
        placeholder="Decisions / conclusions..."
        value={form.decisions}
        onChange={(e) => setForm((f) => ({ ...f, decisions: e.target.value }))}
        rows={2}
        className="rounded border border-ink-300 px-2 py-1.5 text-xs resize-none"
      />
      <input
        type="text"
        placeholder="Approved by (leave blank if not approved)"
        value={form.approved_by}
        onChange={(e) => setForm((f) => ({ ...f, approved_by: e.target.value }))}
        className="rounded border border-ink-300 px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-500 hover:text-ink-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add Review'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main DHFDetail component
// ---------------------------------------------------------------------------

interface Props {
  dhfId: string;
  onBack: () => void;
}

type Tab = 'overview' | 'inputs' | 'vv' | 'reviews';

export function DHFDetail({ dhfId, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [dhf, setDhf] = useState<DHF | null>(null);
  const [inputs, setInputs] = useState<DesignInput[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [reviews, setReviews] = useState<DesignReview[]>([]);
  const [freezing, setFreezing] = useState(false);

  useEffect(() => {
    fetch(`/api/ra/dhf/${dhfId}`)
      .then((r) => r.json())
      .then(
        (data: {
          dhf: DHF;
          inputs: DesignInput[];
          verifications: Verification[];
          reviews: DesignReview[];
        }) => {
          setDhf(data.dhf);
          setInputs(data.inputs);
          setVerifications(data.verifications);
          setReviews(data.reviews);
        },
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dhfId]);

  const handleDesignFreeze = async () => {
    if (!dhf) return;
    setFreezing(true);
    try {
      const res = await fetch(`/api/ra/dhf/${dhfId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_freeze: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as { dhf: DHF };
        setDhf(data.dhf);
      }
    } finally {
      setFreezing(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-ink-500">Loading...</div>;
  }

  if (!dhf) {
    return <div className="py-8 text-center text-sm text-red-500">DHF not found.</div>;
  }

  const verifiedCount = inputs.filter((i) => i.verificationStatus === 'verified').length;
  const totalInputs = inputs.length;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'inputs', label: `Design Inputs (${inputs.length})` },
    { id: 'vv', label: `V&V (${verifications.length})` },
    { id: 'reviews', label: `Design Reviews (${reviews.length})` },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-ink-500 hover:text-ink-700 transition-colors"
        >
          ← Back
        </button>
        <h2 className="font-serif text-xl text-brand-800">{dhf.deviceName}</h2>
        {dhf.status !== 'design_freeze' && dhf.status !== 'archived' && (
          <button
            type="button"
            onClick={handleDesignFreeze}
            disabled={freezing}
            className="ml-auto rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {freezing ? 'Freezing...' : 'Design Freeze'}
          </button>
        )}
        {dhf.status === 'design_freeze' && (
          <span className="ml-auto rounded bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
            Frozen {dhf.designFreezeDate ?? ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-ink-200 bg-white p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-ink-500">Device Model</p>
                <p className="text-ink-800">{dhf.deviceModel ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-500">Jurisdiction</p>
                <p className="text-ink-800">{dhf.jurisdiction}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-500">Regulatory Framework</p>
                <p className="text-ink-800">{dhf.regulatoryFramework.replace('_', '/')}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-500">Status</p>
                <p className="capitalize text-ink-800">{dhf.status.replace('_', ' ')}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500 mb-1">Intended Use</p>
              <p className="text-sm text-ink-700">{dhf.intendedUse}</p>
            </div>
          </div>

          {/* Completeness */}
          <div className="rounded-lg border border-ink-200 bg-white p-4">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide mb-3">
              DHF Completeness
            </p>
            <CompletenessBar score={dhf.completenessScore} />
            <p className="mt-2 text-xs text-ink-400">
              V&V coverage: {verifiedCount}/{totalInputs} requirements verified
            </p>
          </div>
        </div>
      )}

      {tab === 'inputs' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <AddInputForm
              dhfId={dhfId}
              onAdded={(input) => setInputs((prev) => [...prev, input])}
            />
          </div>
          {inputs.length === 0 ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-6 text-center text-sm text-ink-500">
              No design inputs yet. Add the first requirement above.
            </div>
          ) : (
            inputs.map((input) => (
              <div key={input.id} className="rounded-lg border border-ink-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {input.requirementId && (
                        <span className="font-mono text-xs font-semibold text-ink-600">
                          {input.requirementId}
                        </span>
                      )}
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">
                        {INPUT_TYPE_LABELS[input.inputType] ?? input.inputType}
                      </span>
                      <span className="text-xs text-ink-400 capitalize">{input.priority}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-800">{input.description}</p>
                    {input.source && (
                      <p className="mt-0.5 text-xs text-ink-400">Source: {input.source}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      VERIFICATION_STATUS_STYLES[input.verificationStatus] ??
                      'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {input.verificationStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'vv' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-500">
              V&V coverage: {verifiedCount}/{totalInputs} requirements verified
            </p>
            <AddVerificationForm
              dhfId={dhfId}
              inputs={inputs}
              onAdded={(v) => setVerifications((prev) => [...prev, v])}
            />
          </div>
          {verifications.length === 0 ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-6 text-center text-sm text-ink-500">
              No V&V protocols yet. Add the first verification above.
            </div>
          ) : (
            verifications.map((v) => {
              const linkedInput = v.designInputId
                ? inputs.find((i) => i.id === v.designInputId)
                : null;
              return (
                <div key={v.id} className="rounded-lg border border-ink-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-ink-800">{v.protocolTitle}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                        <span className="capitalize">{v.verificationType}</span>
                        {v.testDate && <span>{v.testDate}</span>}
                        {v.performedBy && <span>by {v.performedBy}</span>}
                        {linkedInput && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">
                            {linkedInput.requirementId ?? linkedInput.description.slice(0, 30)}
                          </span>
                        )}
                      </div>
                    </div>
                    {v.result && (
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium capitalize ${
                          RESULT_STYLES[v.result] ?? 'bg-ink-100 text-ink-600'
                        }`}
                      >
                        {v.result.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <AddReviewForm dhfId={dhfId} onAdded={(r) => setReviews((prev) => [...prev, r])} />
          </div>
          {reviews.length === 0 ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-6 text-center text-sm text-ink-500">
              No design reviews recorded yet.
            </div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-ink-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-ink-800">
                        {REVIEW_STAGE_LABELS[r.reviewStage] ?? r.reviewStage}
                      </span>
                      <span className="text-xs text-ink-400">{r.reviewDate}</span>
                    </div>
                    {r.attendees.length > 0 && (
                      <p className="mt-1 text-xs text-ink-500">
                        Attendees: {r.attendees.join(', ')}
                      </p>
                    )}
                    {r.decisions && <p className="mt-1 text-sm text-ink-700">{r.decisions}</p>}
                    {r.openActions && (
                      <p className="mt-1 text-xs text-amber-700">Open actions: {r.openActions}</p>
                    )}
                  </div>
                  {r.approvedBy && (
                    <div className="shrink-0 text-right">
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Approved
                      </span>
                      <p className="mt-0.5 text-xs text-ink-400">by {r.approvedBy}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
