// @MX:NOTE [AUTO] Threat model generator — deterministic STRIDE-style rules.
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-001)

// @MX:LEGACY archived from lib
//
// Tier1: deterministic rules map architecture input (connectivity, data flows,
// assets, trust boundaries) to STRIDE-category threats. LLM-assisted threat
// modeling is deferred to tier2 (@MX:TODO). Deterministic output keeps the
// evidence reproducible — a regulator re-running the generator gets the same
// threat list, which matters for 21 CFR Part 11 traceability.

import type { ArchitectureInput, ThreatItem } from './types';

export interface GeneratedThreatModel {
  threats: ThreatItem[];
}

/**
 * REQ-001: generate a threat model from architecture input. Each architectural
 * element contributes threats per STRIDE category. The mapping is intentionally
 * conservative — it surfaces categories an analyst must address rather than
 * scoring likelihood (tier2 LLM-assist territory).
 */
export function generateThreatModel(input: ArchitectureInput): GeneratedThreatModel {
  const threats: ThreatItem[] = [];

  // External connectivity → spoofing + information_disclosure candidates.
  for (const endpoint of input.connectivity) {
    threats.push({
      id: `T-spoofing-${slug(endpoint)}`,
      category: 'spoofing',
      title: `Unauthorized endpoint impersonation: ${endpoint}`,
      affectedAsset: endpoint,
      description:
        'Connected endpoint must authenticate via mutual TLS or signed tokens to prevent spoofing.',
    });
    threats.push({
      id: `T-info-${slug(endpoint)}`,
      category: 'information_disclosure',
      title: `Unencrypted data exposure on link: ${endpoint}`,
      affectedAsset: endpoint,
      description: 'Data in transit over this link must be encrypted (TLS 1.2+).',
    });
  }

  // External interfaces → denial_of_service + elevation_of_privilege candidates.
  for (const iface of input.externalInterfaces) {
    threats.push({
      id: `T-dos-${slug(iface)}`,
      category: 'denial_of_service',
      title: `Resource exhaustion via interface: ${iface}`,
      affectedAsset: iface,
      description: 'Rate limiting and backpressure must protect this interface.',
    });
    threats.push({
      id: `T-eop-${slug(iface)}`,
      category: 'elevation_of_privilege',
      title: `Privilege escalation via interface: ${iface}`,
      affectedAsset: iface,
      description: 'Input validation + least-privilege service account required.',
    });
  }

  // Data flows crossing trust boundaries → tampering + repudiation candidates.
  for (const flow of input.dataFlows) {
    const crossesBoundary = input.trustBoundaries.some((b) => flow.includes(b));
    if (crossesBoundary) {
      threats.push({
        id: `T-tamper-${slug(flow)}`,
        category: 'tampering',
        title: `Tampering of flow crossing trust boundary: ${flow}`,
        affectedAsset: flow,
        description: 'Integrity protection (HMAC / signature) required for cross-boundary data.',
      });
      threats.push({
        id: `T-repud-${slug(flow)}`,
        category: 'repudiation',
        title: `Non-repudiable audit gap on flow: ${flow}`,
        affectedAsset: flow,
        description:
          'Append-only audit trail required for regulated data crossing trust boundaries.',
      });
    }
  }

  // Assets with no explicit trust boundary → flag for review.
  for (const asset of input.assets) {
    const hasBoundary = input.trustBoundaries.some((b) => b.includes(asset) || asset.includes(b));
    if (!hasBoundary) {
      threats.push({
        id: `T-tamper-asset-${slug(asset)}`,
        category: 'tampering',
        title: `Asset lacks explicit trust boundary: ${asset}`,
        affectedAsset: asset,
        description: 'Define a trust boundary around this asset or document the residual risk.',
      });
    }
  }

  return { threats };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
