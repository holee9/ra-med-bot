
// @MX:LEGACY archived from app
'use client';
// @MX:SPEC SPEC-REGULA-DHF-001
// DHF list view with create button and inline detail navigation.

import { useEffect, useState } from 'react';
import type { DHFSummary } from './DHFCard';
import { DHFCard } from './DHFCard';
import { DHFCreateForm } from './DHFCreateForm';
import { DHFDetail } from './DHFDetail';

export function DHFList() {
  const [dhfs, setDhfs] = useState<DHFSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ra/dhf')
      .then((r) => r.json())
      .then((data: { dhfs: DHFSummary[] }) => setDhfs(data.dhfs ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (dhf: DHFSummary) => {
    setDhfs((prev) => [dhf, ...prev]);
    setShowCreate(false);
    setSelectedId(dhf.id);
  };

  // Detail view
  if (selectedId) {
    return <DHFDetail dhfId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  // Create form
  if (showCreate) {
    return <DHFCreateForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />;
  }

  // List view
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          {loading ? 'Loading...' : `${dhfs.length} DHF${dhfs.length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          New DHF
        </button>
      </div>

      {!loading && dhfs.length === 0 && (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-8 text-center">
          <p className="text-sm text-ink-500">No Design History Files yet.</p>
          <p className="mt-1 text-xs text-ink-400">
            Create a DHF to start tracking design inputs, V&V, and design reviews.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {dhfs.map((dhf) => (
          <DHFCard key={dhf.id} dhf={dhf} onSelect={setSelectedId} />
        ))}
      </div>
    </div>
  );
}
