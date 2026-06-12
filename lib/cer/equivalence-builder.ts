// @MX:NOTE EU MDR Article 61(4) equivalence assessment (3 dimensions).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-003, REQ-CER-004)
//
// Article 61(4) requires demonstrating equivalence across all three of the
// clinical, technical, and biological dimensions. Overall equivalence is true
// only if every dimension is satisfied — a single unsatisfied dimension breaks
// the equivalence claim.

export interface EquivalenceDimension {
  dimension: 'clinical' | 'technical' | 'biological';
  claimText: string;
  justification: string;
  satisfied: boolean;
}

export interface EquivalenceAssessment {
  deviceName: string;
  equivalentDevice: string;
  dimensions: EquivalenceDimension[];
  overallEquivalent: boolean; // true only if ALL 3 dimensions satisfied
  summaryText: string;
}

/**
 * Build a 3-dimension equivalence assessment per EU MDR Article 61(4).
 *
 * A dimension is treated as satisfied when its claim text is non-empty — the
 * presence of a substantiated claim is the manufacturer's assertion of
 * equivalence for that dimension. Empty claims leave the dimension unsatisfied
 * and therefore break overall equivalence, surfacing the gap to the author.
 */
export function buildEquivalenceAssessment(params: {
  deviceName: string;
  equivalentDevice: string;
  clinicalClaim: string;
  technicalClaim: string;
  biologicalClaim: string;
}): EquivalenceAssessment {
  const dimensions: EquivalenceDimension[] = [
    buildDimension('clinical', params.clinicalClaim, params),
    buildDimension('technical', params.technicalClaim, params),
    buildDimension('biological', params.biologicalClaim, params),
  ];

  const overallEquivalent = dimensions.every((d) => d.satisfied);

  return {
    deviceName: params.deviceName,
    equivalentDevice: params.equivalentDevice,
    dimensions,
    overallEquivalent,
    summaryText: buildSummary(
      params.deviceName,
      params.equivalentDevice,
      dimensions,
      overallEquivalent,
    ),
  };
}

function buildDimension(
  dimension: EquivalenceDimension['dimension'],
  claim: string,
  params: { deviceName: string; equivalentDevice: string },
): EquivalenceDimension {
  const claimText = claim.trim();
  const satisfied = claimText.length > 0;

  const justification = satisfied
    ? `${capitalize(dimension)} equivalence between ${params.deviceName} and ${params.equivalentDevice} is supported by the stated characteristics.`
    : `No ${dimension} equivalence claim provided; this dimension is unsatisfied and must be substantiated before equivalence can be asserted under Article 61(4).`;

  return { dimension, claimText, justification, satisfied };
}

function buildSummary(
  deviceName: string,
  equivalentDevice: string,
  dimensions: EquivalenceDimension[],
  overallEquivalent: boolean,
): string {
  if (overallEquivalent) {
    return `${deviceName} is considered equivalent to ${equivalentDevice} across all three Article 61(4) dimensions (clinical, technical, biological).`;
  }

  const unmet = dimensions
    .filter((d) => !d.satisfied)
    .map((d) => d.dimension)
    .join(', ');

  return `${deviceName} is NOT established as equivalent to ${equivalentDevice}: the following dimension(s) are unsatisfied: ${unmet}. All three dimensions must be satisfied to claim equivalence under Article 61(4).`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
