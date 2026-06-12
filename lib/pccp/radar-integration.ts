// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-007)
// RADAR integration stub — detects FDA AI/ML guidance updates and surfaces a banner.
// Full crawler wired in RADAR-001 (#41). This module exposes the query interface.

export interface RadarAlertLevel {
  level: 'info' | 'warning' | 'critical';
  message: string;
  guidanceUrl: string | null;
  publishedAt: string | null;
}

export interface PccpRadarStatus {
  hasUpdates: boolean;
  alerts: RadarAlertLevel[];
  lastCheckedAt: string | null;
}

/**
 * Returns RADAR alert status for PCCP-relevant FDA guidance documents.
 * In PCCP-001 scope this is a stub; RADAR-001 (#41) wires the live crawler.
 */
export async function getPccpRadarStatus(): Promise<PccpRadarStatus> {
  // Stub: no live crawler yet — returns empty status.
  // RADAR-001 will replace this with a DB query against the radar_alerts table.
  return {
    hasUpdates: false,
    alerts: [],
    lastCheckedAt: null,
  };
}

/**
 * Returns whether any critical RADAR alert is active for PCCP guidance.
 * Used to gate UI banner display.
 */
export async function hasCriticalPccpAlert(): Promise<boolean> {
  const status = await getPccpRadarStatus();
  return status.alerts.some((a) => a.level === 'critical');
}
