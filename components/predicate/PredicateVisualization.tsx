'use client';

// @MX:NOTE [AUTO] PredicateVisualization — interactive visualization for predicate comparison analysis
// @MX:SPEC SPEC-PREDICATE-VIS-001 (REQ-VIS-001, REQ-VIS-002, REQ-VIS-003, REQ-VIS-004)

import type { ComparisonDimension, PredicateComparison } from '@/lib/predicate/types';
import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface PredicateVisualizationProps {
  comparison: PredicateComparison;
}

const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  intended_use: 'Intended Use',
  indications: 'Indications for Use',
  tech_characteristics: 'Technological Characteristics',
  materials: 'Materials',
  performance: 'Performance',
};

// Color scheme for required vs optional documents
const REQUIRED_COLOR = '#3b82f6'; // Blue for required
const OPTIONAL_COLOR = '#9ca3af'; // Gray for optional
const SUBJECT_COLOR = '#10b981'; // Green for subject device

export default function PredicateVisualization({ comparison }: PredicateVisualizationProps) {
  const [viewMode, setViewMode] = useState<'table' | 'bar' | 'radar'>('bar');
  const [beforeAfterMode, setBeforeAfterMode] = useState(false);
  const [highlightedDimension, setHighlightedDimension] = useState<ComparisonDimension | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [demoMode, setDemoMode] = useState(false);

  // Animation effect for demo mode
  useEffect(() => {
    if (demoMode) {
      const phases = [0, 1, 2];
      let currentPhase = 0;

      const interval = setInterval(() => {
        setAnimationPhase(phases[currentPhase]);
        currentPhase = (currentPhase + 1) % phases.length;
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [demoMode]);

  // Transform comparison data into chart format
  const chartData = comparison.cells.map((cell, idx) => {
    const baseData: Record<string, any> = {
      dimension: DIMENSION_LABELS[cell.dimension],
      dimensionKey: cell.dimension,
      subject: cell.subject_text.length, // Text length as proxy for complexity
      isRequired: idx < 3, // First 3 dimensions are typically required
    };

    // Add each predicate's data
    comparison.selected_predicates.forEach((predicate, predIdx) => {
      baseData[`predicate_${predIdx}`] = cell.predicate_texts[predIdx]?.length || 0;
    });

    return baseData;
  });

  // Before-After comparison data
  const beforeAfterData = beforeAfterMode ? [
    {
      phase: 'Before',
      ...comparison.cells.reduce((acc, cell, idx) => ({
        ...acc,
        [DIMENSION_LABELS[cell.dimension]]: cell.subject_text.length,
      }), {}),
    },
    {
      phase: 'After',
      ...comparison.cells.reduce((acc, cell, idx) => ({
        ...acc,
        [DIMENSION_LABELS[cell.dimension]]: cell.predicate_texts[0]?.length || 0, // Compare with first predicate
      }), {}),
    },
  ] : null;

  // Generate colors for bars
  const getBarColors = (predicateIndex: number) => {
    const colors: string[] = [];
    comparison.cells.forEach((cell, cellIdx) => {
      // Alternate between required and optional based on dimension
      const isRequired = cellIdx < 3; // First 3 dimensions are typically required
      colors.push(isRequired ? REQUIRED_COLOR : OPTIONAL_COLOR);
    });
    return colors;
  };

  // Prepare radar chart data
  const radarData = DIMENSION_LABELS;

  return (
    <div className="flex flex-col gap-6">
      {/* View mode toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('bar')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'bar'
              ? 'bg-brand-700 text-white'
              : 'border border-ink-200 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Bar Chart
        </button>
        <button
          type="button"
          onClick={() => setViewMode('radar')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'radar'
              ? 'bg-brand-700 text-white'
              : 'border border-ink-200 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Radar Chart
        </button>
        <button
          type="button"
          onClick={() => setViewMode('table')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'table'
              ? 'bg-brand-700 text-white'
              : 'border border-ink-200 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Table View
        </button>

        <div className="ml-auto">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={beforeAfterMode}
              onChange={(e) => setBeforeAfterMode(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Before-After Mode
          </label>
        </div>
      </div>

      {/* Demo mode toggle */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          Demo Mode (Animation)
        </label>
      </div>
    </div>

    {/* Visualization area */}
    <div className={`rounded-lg border border-ink-200 bg-white p-6 transition-all duration-500 ${
      demoMode ? 'shadow-xl scale-105' : ''
    }`}>
      {demoMode && (
        <div className="mb-4 rounded bg-amber-50 px-4 py-2 text-sm text-amber-700">
          🎬 Demo Mode: Interactive animation for investor/customer presentation
        </div>
      )}

      {viewMode === 'bar' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink-900">
              {beforeAfterMode ? 'Before-After Comparison' : 'Dimension Comparison'}
            </h3>

            {beforeAfterMode && beforeAfterData ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={beforeAfterData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="phase" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(DIMENSION_LABELS).map((key, idx) => (
                    <Bar
                      key={key}
                      dataKey={DIMENSION_LABELS[key as ComparisonDimension]}
                      fill={idx < 3 ? REQUIRED_COLOR : OPTIONAL_COLOR}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chartData}
                  animationDuration={demoMode ? 1500 : 500}
                  animationBegin={animationPhase * 1000}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dimension"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    onClick={(data) => {
                      if (data && data.activePayload && data.activePayload.length > 0) {
                        const dimensionKey = data.activePayload[0].payload.dimensionKey;
                        setHighlightedDimension(dimensionKey as ComparisonDimension);
                      }
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
                            <p className="font-semibold text-ink-900">{data.dimension}</p>
                            <p className="text-sm text-ink-700">
                              Status: {data.isRequired ? 'Required' : 'Optional'}
                            </p>
                            {payload.map((entry: any) => (
                              <p key={entry.name} className="text-sm text-ink-600">
                                {entry.name}: {entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="subject" fill={SUBJECT_COLOR} name="Subject Device" />
                  {comparison.selected_predicates.map((predicate, idx) => (
                    <Bar
                      key={predicate.k_number}
                      dataKey={`predicate_${idx}`}
                      fill={REQUIRED_COLOR}
                      name={predicate.k_number}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {viewMode === 'radar' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink-900">Multi-Dimensional Analysis</h3>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart
                data={comparison.cells.map((cell, idx) => ({
                  dimension: DIMENSION_LABELS[cell.dimension],
                  subject: cell.subject_text.length,
                  ...comparison.selected_predicates.reduce((acc, _, predIdx) => ({
                    ...acc,
                    [`predicate_${predIdx}`]: cell.predicate_texts[predIdx]?.length || 0,
                  }), {}),
                }))}
                animationDuration={demoMode ? 1500 : 500}
                animationBegin={animationPhase * 1000}
              >
                dimension: DIMENSION_LABELS[cell.dimension],
                subject: cell.subject_text.length,
                ...comparison.selected_predicates.reduce((acc, _, predIdx) => ({
                  ...acc,
                  [`predicate_${predIdx}`]: cell.predicate_texts[predIdx]?.length || 0,
                }), {}),
              }))}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis />
                <Radar name="Subject Device" dataKey="subject" fill={SUBJECT_COLOR} fillOpacity={0.6} />
                {comparison.selected_predicates.map((predicate, idx) => (
                  <Radar
                    key={predicate.k_number}
                    name={predicate.k_number}
                    dataKey={`predicate_${idx}`}
                    fill={REQUIRED_COLOR}
                    fillOpacity={0.6}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'table' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink-900">Detailed Comparison</h3>

            {/* Dimension highlight panel */}
            {highlightedDimension && (
              <div className="rounded-lg border border-brand-300 bg-brand-50 p-4">
                <h4 className="font-semibold text-brand-900">
                  {DIMENSION_LABELS[highlightedDimension]} Analysis
                </h4>
                <p className="mt-2 text-sm text-brand-700">
                  {comparison.cells.find((c) => c.dimension === highlightedDimension)?.subject_text}
                </p>
                <button
                  type="button"
                  onClick={() => setHighlightedDimension(null)}
                  className="mt-2 rounded border border-brand-300 bg-white px-3 py-1 text-sm text-brand-700 hover:bg-brand-100"
                >
                  Close Detail
                </button>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-ink-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface border-b border-ink-200">
                    <th className="w-40 px-4 py-3 text-left font-semibold text-ink-900">
                      <div className="flex items-center gap-2">
                        Dimension
                        <span className="text-xs font-normal text-ink-500">(Status)</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-ink-900">Subject Device</th>
                    {comparison.selected_predicates.map((p, idx) => (
                      <th
                        key={p.k_number}
                        className="px-4 py-3 text-left font-mono font-semibold text-ink-900"
                      >
                        <div className="flex items-center gap-2">
                          {p.k_number}
                          <span
                            className={`text-xs font-normal ${
                              idx < 3 ? 'text-blue-600' : 'text-gray-500'
                            }`}
                          >
                            ({idx < 3 ? 'Required' : 'Optional'})
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.cells.map((cell, cellIdx) => (
                    <tr
                      key={cell.dimension}
                      className={`border-b border-ink-100 transition-colors hover:bg-ink-50 ${
                        highlightedDimension === cell.dimension ? 'bg-brand-50' : ''
                      }`}
                      onClick={() => setHighlightedDimension(cell.dimension)}
                      style={{ cursor: 'pointer' }}
                    >
                      <th
                        scope="row"
                        className={`px-4 py-3 text-left font-medium ${
                          cellIdx < 3 ? 'text-blue-700' : 'text-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {DIMENSION_LABELS[cell.dimension]}
                          <div
                            className={`h-2 w-2 rounded-full ${
                              cellIdx < 3 ? 'bg-blue-500' : 'bg-gray-400'
                            }`}
                          />
                        </div>
                      </th>
                      <td className="px-4 py-3 text-ink-800">{cell.subject_text}</td>
                      {comparison.selected_predicates.map((p, predIndex) => (
                        <td
                          key={p.k_number}
                          className={`px-4 py-3 ${
                            cell.predicate_texts[predIndex] ? 'text-ink-800' : 'text-ink-400 italic'
                          }`}
                        >
                          {cell.predicate_texts[predIndex] || (
                            <span className="text-xs">No data</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Legend for required vs optional */}
      <div className="flex items-center gap-6 rounded-md border border-ink-200 bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: REQUIRED_COLOR }} />
          <span className="text-sm text-ink-700">Required Documents</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: OPTIONAL_COLOR }} />
          <span className="text-sm text-ink-700">Optional Documents</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: SUBJECT_COLOR }} />
          <span className="text-sm text-ink-700">Subject Device</span>
        </div>
      </div>
    </div>
  );
}