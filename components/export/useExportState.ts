'use client';

/**
 * Export state management hook
 * REQ-EXP-001: Export state management (loading, success, error)
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001)
 */

import { useState } from 'react';

export type ExportState = 'idle' | 'loading' | 'success' | 'error';

interface ExportResult {
  filename: string;
  size: number;
}

interface UseExportStateReturn {
  state: ExportState;
  error: Error | null;
  result: ExportResult | null;
  setLoading: () => void;
  setSuccess: (result: ExportResult) => void;
  setError: (error: Error) => void;
  reset: () => void;
}

export function useExportState(): UseExportStateReturn {
  const [state, setState] = useState<ExportState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const setLoading = () => {
    setState('loading');
    setError(null);
    setResult(null);
  };

  const setSuccess = (exportResult: ExportResult) => {
    setState('success');
    setResult(exportResult);
    setError(null);
  };

  const setErrorState = (error: Error) => {
    setState('error');
    setError(error);
    setResult(null);
  };

  const reset = () => {
    setState('idle');
    setError(null);
    setResult(null);
  };

  return {
    state,
    error,
    result,
    setLoading,
    setSuccess,
    setError: setErrorState,
    reset,
  };
}
