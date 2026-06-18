'use client';
// @MX:SPEC Issue #169
// @MX:ANCHOR: [AUTO] TraceabilityShell — central client entry point for traceability feature
// @MX:REASON: [AUTO] Orchestrates scan, graph, and impact sub-views; expected fan_in >= 3 from page, tests, and future links

import {
  useImpactAnalysis,
  useScanTraceability,
  useTraceGraph,
} from '@/lib/queries/useTraceability';
import type {
  ImpactResult,
  ImpactedNode,
  ScanResult,
  TraceGraph,
  TraceNode,
} from '@/lib/queries/useTraceability';
import { cn } from '@/lib/utils';
import { AlertCircle, GitMerge, Loader2, Network, Scan } from 'lucide-react';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type Tab = 'scan' | 'graph' | 'impact';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'scan', label: '스캔', icon: <Scan className="h-4 w-4" /> },
  { id: 'graph', label: '그래프', icon: <Network className="h-4 w-4" /> },
  { id: 'impact', label: '영향 분석', icon: <GitMerge className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// ScanPanel
// ---------------------------------------------------------------------------

interface ScanPanelProps {
  onScanComplete: (scanId: string) => void;
}

function ScanPanel({ onScanComplete }: ScanPanelProps) {
  const [scope, setScope] = useState('');
  const { mutate: scan, isPending, error, data: lastResult } = useScanTraceability();

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    scan(
      { scope: scope.trim() || undefined },
      { onSuccess: (result) => onScanComplete(result.scan_id) },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink-800">추적 그래프 스캔</h2>
        <form onSubmit={handleScan} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scan_scope" className="text-sm font-medium text-ink-700">
              스캔 범위 (선택)
            </label>
            <input
              id="scan_scope"
              type="text"
              placeholder="예: requirements, tests, documents"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={isPending}
              className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? '스캔 중...' : '스캔 실행'}
          </button>
        </form>
      </div>

      {lastResult && <ScanResultCard result={lastResult} />}
    </div>
  );
}

function ScanResultCard({ result }: { result: ScanResult }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-600',
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-700">스캔 완료</span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            statusColors[result.status] ?? 'bg-ink-100 text-ink-600',
          )}
        >
          {result.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-xs text-ink-400">Scan ID</span>
          <p className="mt-0.5 truncate font-mono text-xs text-ink-700">{result.scan_id}</p>
        </div>
        <div>
          <span className="text-xs text-ink-400">스캔 노드 수</span>
          <p className="mt-0.5 text-2xl font-semibold text-brand-700">{result.nodes_scanned}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphPanel
// ---------------------------------------------------------------------------

interface GraphPanelProps {
  scanId?: string;
}

// @MX:NOTE: [AUTO] GraphPanel renders trace nodes and edges from hybrid-ra-saas. No canvas library — text representation only.
function GraphPanel({ scanId }: GraphPanelProps) {
  const { data: graph, isLoading, error } = useTraceGraph(scanId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-2 text-sm text-ink-500">그래프 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error.message}</span>
      </div>
    );
  }

  if (!graph) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '전체 노드', value: graph.metadata.total_nodes },
          { label: '전체 엣지', value: graph.metadata.total_edges },
          {
            label: '생성 시각',
            value: new Date(graph.metadata.generated_at).toLocaleString('ko-KR'),
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-ink-200 bg-white p-3 text-center">
            <span className="block text-xs text-ink-400">{label}</span>
            <span className="mt-1 block text-base font-semibold text-ink-800">{value}</span>
          </div>
        ))}
      </div>

      {/* Node list */}
      <div className="rounded-lg border border-ink-200 bg-white">
        <div className="border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-800">노드 목록 ({graph.nodes.length})</h3>
        </div>
        <div className="divide-y divide-ink-50">
          {graph.nodes.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">
              노드가 없습니다. 먼저 스캔을 실행해 주세요.
            </p>
          ) : (
            graph.nodes.map((node) => <NodeRow key={node.id} node={node} edges={graph.edges} />)
          )}
        </div>
      </div>
    </div>
  );
}

const NODE_TYPE_COLORS: Record<string, string> = {
  requirement: 'bg-brand-100 text-brand-700',
  component: 'bg-purple-100 text-purple-700',
  test: 'bg-green-100 text-green-700',
  document: 'bg-amber-100 text-amber-700',
};

function NodeRow({
  node,
  edges,
}: { node: TraceNode; edges: { source: string; target: string; relationship: string }[] }) {
  const outEdges = edges.filter((e) => e.source === node.id);
  const inEdges = edges.filter((e) => e.target === node.id);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            NODE_TYPE_COLORS[node.type] ?? 'bg-ink-100 text-ink-600',
          )}
        >
          {node.type}
        </span>
        <span className="text-sm font-medium text-ink-800">{node.label}</span>
        <span className="ml-auto font-mono text-xs text-ink-400">{node.id}</span>
      </div>
      {(outEdges.length > 0 || inEdges.length > 0) && (
        <div className="mt-1.5 flex gap-3 text-xs text-ink-400">
          {inEdges.length > 0 && <span>← {inEdges.length}개 입력</span>}
          {outEdges.length > 0 && <span>{outEdges.length}개 출력 →</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImpactPanel
// ---------------------------------------------------------------------------

function ImpactPanel() {
  const [nodeId, setNodeId] = useState('');
  const [description, setDescription] = useState('');
  const { mutate: analyze, isPending, error, data: result } = useImpactAnalysis();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze({
      changed_node_id: nodeId.trim(),
      change_description: description.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink-800">변경 영향 분석</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="node_id" className="text-sm font-medium text-ink-700">
              변경 노드 ID <span className="text-red-500">*</span>
            </label>
            <input
              id="node_id"
              type="text"
              required
              placeholder="예: REQ-001, COMP-SENSOR"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              disabled={isPending}
              className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="change_desc" className="text-sm font-medium text-ink-700">
              변경 설명 (선택)
            </label>
            <textarea
              id="change_desc"
              rows={3}
              placeholder="변경 내용을 간략히 설명해 주세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !nodeId.trim()}
            className="flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? '분석 중...' : '영향 분석 실행'}
          </button>
        </form>
      </div>

      {result && <ImpactResultCard result={result} />}
    </div>
  );
}

const RISK_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

const RISK_LABELS: Record<string, string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
};

function ImpactResultCard({ result }: { result: ImpactResult }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <span className="text-sm font-semibold text-ink-800">영향 분석 결과</span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            RISK_COLORS[result.risk_level] ?? 'bg-ink-100 text-ink-600',
          )}
        >
          리스크 {RISK_LABELS[result.risk_level] ?? result.risk_level}
        </span>
      </div>

      {/* Impacted nodes */}
      <div className="p-4">
        <h3 className="mb-3 text-xs font-semibold text-ink-600">
          영향받는 노드 ({result.impacted_nodes.length}개)
        </h3>
        {result.impacted_nodes.length === 0 ? (
          <p className="text-sm text-ink-400">영향받는 노드가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {result.impacted_nodes.map((node) => (
              <ImpactedNodeRow key={node.node_id} node={node} />
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="border-t border-ink-100 p-4">
          <h3 className="mb-2 text-xs font-semibold text-ink-600">권고사항</h3>
          <ul className="flex flex-col gap-1">
            {result.recommendations.map((rec, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: recommendations have no stable ID
              <li key={idx} className="flex items-start gap-1.5 text-xs text-ink-600">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImpactedNodeRow({ node }: { node: ImpactedNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-ink-100 p-3">
      <span
        className={cn(
          'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
          RISK_COLORS[node.risk] ?? 'bg-ink-100 text-ink-600',
        )}
      >
        {RISK_LABELS[node.risk] ?? node.risk}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-ink-800">{node.label}</span>
          <span className="text-xs text-ink-400">({node.type})</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-500">{node.reason}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TraceabilityShell (main export)
// ---------------------------------------------------------------------------

// @MX:ANCHOR: [AUTO] TraceabilityShell — top-level state controller for traceability page
// @MX:REASON: [AUTO] Manages tab state and last scan ID; consumed by page and future deep links
export function TraceabilityShell() {
  const [activeTab, setActiveTab] = useState<Tab>('scan');
  const [lastScanId, setLastScanId] = useState<string | undefined>();

  const handleScanComplete = (scanId: string) => {
    setLastScanId(scanId);
    setActiveTab('graph');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-ink-500 hover:text-ink-700',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {activeTab === 'scan' && <ScanPanel onScanComplete={handleScanComplete} />}
      {activeTab === 'graph' && <GraphPanel scanId={lastScanId} />}
      {activeTab === 'impact' && <ImpactPanel />}
    </div>
  );
}
