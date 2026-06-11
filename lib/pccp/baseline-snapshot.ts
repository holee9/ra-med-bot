// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-005)
// 510(k) clearance baseline snapshot — captures the device state at clearance time
// for downstream SPS/ACP comparison when algorithm changes occur.

export interface BaselineSnapshot {
  capturedAt: string;
  deviceId: string;
  deviceName: string;
  manufacturer: string;
  indication: string | null;
  // Performance metrics at time of clearance
  baselineMetrics: Array<{
    metricId: string;
    metricName: string;
    value: number;
    unit: string;
    threshold: number;
    referenceStandard: string;
  }>;
  // Data characteristics
  trainingDataset: {
    size: number;
    description: string;
    patientPopulation: string;
    imagingModality: string | null;
  } | null;
  softwareVersion: string;
  clearanceNumber: string | null;
}

/**
 * Builds a baseline snapshot object for the given device info.
 * The snapshot is stored as JSONB in pccp_versions.baseline_snapshot_jsonb.
 */
export function buildBaselineSnapshot(params: {
  deviceId: string;
  deviceName: string;
  manufacturer: string;
  indication: string | null;
  softwareVersion?: string;
  clearanceNumber?: string | null;
}): BaselineSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    deviceId: params.deviceId,
    deviceName: params.deviceName,
    manufacturer: params.manufacturer,
    indication: params.indication ?? null,
    baselineMetrics: [],
    trainingDataset: null,
    softwareVersion: params.softwareVersion ?? '1.0',
    clearanceNumber: params.clearanceNumber ?? null,
  };
}

/**
 * Validates that the snapshot has the minimum fields required before
 * a PCCP version can transition to 'cleared'.
 */
export function validateBaselineSnapshot(snapshot: unknown): snapshot is BaselineSnapshot {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const s = snapshot as Record<string, unknown>;
  return (
    typeof s.capturedAt === 'string' &&
    typeof s.deviceId === 'string' &&
    typeof s.deviceName === 'string' &&
    typeof s.manufacturer === 'string'
  );
}
