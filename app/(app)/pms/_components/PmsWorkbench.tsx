'use client';
// @MX:NOTE [AUTO] PmsWorkbench — tab-based workbench client island.
// @MX:SPEC SPEC-REGULA-PMS-001 (Issue #53, Phase 3)
//
// Manages tab switching between the 5 PMS workbench views:
//   - PMS Report (MDCG 2022-21) — REQ-PMS-002
//   - PMCF Plan (Annex XIV Part B) — REQ-PMS-003
//   - Inputs (complaint/vigilance) — REQ-PMS-005/006
//   - Compliance (Article 83-86) — REQ-PMS-007
//
// CER linkage indicator is shown globally (REQ-PMS-004).

import { useEffect, useState } from 'react';
import { CERLinkageIndicator } from './CERLinkageIndicator';
import { CompliancePanel, type ComplianceResult } from './CompliancePanel';
import { PmcfPlanBuilder } from './PmcfPlanBuilder';
import { PmsInputsUploader } from './PmsInputsUploader';
import { PmsReportWizard } from './PmsReportWizard';

type TabId = 'pms-report' | 'pmcf-plan' | 'inputs' | 'compliance';

interface TabConfig {
  id: TabId;
  label: string;
  testId: string;
}

const TABS: readonly TabConfig[] = [
  { id: 'pms-report', label: 'PMS 보고서', testId: 'pms-tab-pms-report' },
  { id: 'pmcf-plan', label: 'PMCF 계획', testId: 'pms-tab-pmcf-plan' },
  { id: 'inputs', label: '데이터 입력', testId: 'pms-tab-inputs' },
  { id: 'compliance', label: '컴플라이언스', testId: 'pms-tab-compliance' },
] as const;

interface PmsWorkbenchProps {
  projectId: string;
  canManage: boolean;
  cerRefId: string | null;
  cerDeviceName: string | null;
}

export function PmsWorkbench({ projectId, canManage, cerRefId, cerDeviceName }: PmsWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<TabId>('pms-report');

  return (
    <div className="flex flex-col gap-4" data-testid="pms-workbench">
      {/* CER linkage — global indicator (REQ-PMS-004) */}
      <div data-testid="pms-workbench-cer-linkage">
        <CERLinkageIndicator cerRefId={cerRefId} cerDeviceName={cerDeviceName} />
      </div>

      {/* Tab navigation */}
      <nav aria-label="PMS 워크벤치 탭" data-testid="pms-workbench-tabs">
        <ul role="tablist" className="flex gap-1 border-b border-ink-200">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`pms-tabpanel-${tab.id}`}
                  id={`pms-tabbtn-${tab.id}`}
                  data-testid={tab.testId}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'rounded-t border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                    active
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-800',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tab panels */}
      <div
        role="tabpanel"
        id="pms-tabpanel-pms-report"
        aria-labelledby="pms-tabbtn-pms-report"
        hidden={activeTab !== 'pms-report'}
        data-testid="pms-tabpanel-pms-report"
      >
        {activeTab === 'pms-report' && (
          <PmsReportWizard
            projectId={projectId}
            canManage={canManage}
            cerRefId={cerRefId}
            cerDeviceName={cerDeviceName}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="pms-tabpanel-pmcf-plan"
        aria-labelledby="pms-tabbtn-pmcf-plan"
        hidden={activeTab !== 'pmcf-plan'}
        data-testid="pms-tabpanel-pmcf-plan"
      >
        {activeTab === 'pmcf-plan' && (
          <PmcfPlanBuilder projectId={projectId} canManage={canManage} />
        )}
      </div>

      <div
        role="tabpanel"
        id="pms-tabpanel-inputs"
        aria-labelledby="pms-tabbtn-inputs"
        hidden={activeTab !== 'inputs'}
        data-testid="pms-tabpanel-inputs"
      >
        {activeTab === 'inputs' && <PmsInputsUploader projectId={projectId} />}
      </div>

      <div
        role="tabpanel"
        id="pms-tabpanel-compliance"
        aria-labelledby="pms-tabbtn-compliance"
        hidden={activeTab !== 'compliance'}
        data-testid="pms-tabpanel-compliance"
      >
        {/* CompliancePanel fetches its own data on mount (read-only, audit logged). */}
        {activeTab === 'compliance' && <CompliancePanelFetcher projectId={projectId} />}
      </div>
    </div>
  );
}

// --- Compliance fetcher wrapper ---
// The CompliancePanel takes a pre-fetched result. This wrapper handles the fetch
// so the panel stays a pure display component (easier to test).

function CompliancePanelFetcher({ projectId }: { projectId: string }) {
  const [result, setResult] = useState<ComplianceResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/pms/${projectId}/compliance`, { method: 'GET' });
        if (!res.ok) return;
        const json = (await res.json()) as ComplianceResult;
        if (!cancelled) setResult(json);
      } catch {
        // Network error — leave loading state.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return <CompliancePanel result={result} />;
}
