'use client';
// @MX:SPEC SPEC-REGULA-ESUBMIT-001
// Submission package list view with create button and inline detail navigation.

import { useEffect, useState } from 'react';
import type { PackageSummary } from './ESubmitCard';
import { ESubmitCard } from './ESubmitCard';
import { ESubmitCreateForm } from './ESubmitCreateForm';
import { ESubmitDetail } from './ESubmitDetail';

export function ESubmitList() {
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ra/esubmit')
      .then((r) => r.json())
      .then((data: { packages: PackageSummary[] }) => setPackages(data.packages ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (pkg: PackageSummary) => {
    setPackages((prev) => [pkg, ...prev]);
    setShowCreate(false);
    setSelectedId(pkg.id);
  };

  // Detail view
  if (selectedId) {
    return <ESubmitDetail packageId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  // Create form
  if (showCreate) {
    return <ESubmitCreateForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />;
  }

  // List view
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + 새 제출 패키지
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">로딩 중...</p>
      ) : packages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-300 p-8 text-center">
          <p className="text-sm text-ink-500">아직 제출 패키지가 없습니다.</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-3 text-sm text-brand-600 hover:underline"
          >
            첫 번째 패키지 만들기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {packages.map((pkg) => (
            <ESubmitCard key={pkg.id} pkg={pkg} onSelect={setSelectedId} />
          ))}
        </div>
      )}
    </div>
  );
}
