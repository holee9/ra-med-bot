// @MX:ANCHOR [AUTO] PMS inputs — complaint/vigilance data normalization + validation.
// @MX:REASON Patient-safety data integrity (REQ-PMS-006, REQ-PMS-012). fan_in >= 3:
//           inputs API route, pms-report executor, UI uploader.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-005, REQ-PMS-006, REQ-PMS-012, AC-05)

/** Allowed complaint/vigilance source categories. */
const VALID_SOURCES = new Set(['complaint', 'vigilance', 'susar', 'trend']);

/** Allowed severity levels (IMDRF terminology). */
const VALID_SEVERITIES = new Set(['non_serious', 'serious', 'death']);

/** Maximum upload file size: 10 MB. REQ-PMS-012 — reject oversized/malformed files. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Raw input shape from the API (strings, unnormalized). Matches the JSON the
 * POST /api/pms/inputs route receives before normalization.
 */
export interface PmsInputRaw {
  source?: string;
  severity?: string;
  susar_flag?: boolean | string;
  trend_category?: string;
  /** Optional free-form payload (manual form data or parsed file rows). */
  payload?: Record<string, unknown>;
}

/** Normalized PMS input ready for DB insertion. */
export interface PmsInputNormalized {
  source: string;
  severity?: string;
  susarFlag: boolean;
  trendCategory?: string;
  payload: Record<string, unknown>;
}

/**
 * Normalize a raw PMS input: lowercase + trim strings, coerce susar_flag to
 * boolean, default missing fields. Does NOT validate — call validatePmsInput
 * after normalization.
 */
export function normalizePmsInput(raw: PmsInputRaw): PmsInputNormalized {
  const source = (raw.source ?? '').trim().toLowerCase();
  const severity = raw.severity?.trim().toLowerCase() || undefined;
  const trendCategory = raw.trend_category?.trim().toLowerCase() || undefined;
  const susarFlag = coerceBoolean(raw.susar_flag);
  return {
    source,
    severity,
    susarFlag,
    trendCategory,
    payload: raw.payload ?? {},
  };
}

/** Validation result — errors is empty when ok is true. */
export interface PmsInputValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a normalized PMS input (REQ-PMS-012). Returns field-level errors
 * with safe (non-PII) messages only.
 */
export function validatePmsInput(input: {
  source: string;
  severity?: string;
  susar_flag?: boolean;
  trend_category?: string;
}): PmsInputValidation {
  const errors: string[] = [];

  if (!input.source) {
    errors.push('source is required.');
  } else if (!VALID_SOURCES.has(input.source)) {
    errors.push(`source must be one of: ${[...VALID_SOURCES].join(', ')}.`);
  }

  if (input.severity && !VALID_SEVERITIES.has(input.severity)) {
    errors.push(`severity must be one of: ${[...VALID_SEVERITIES].join(', ')}.`);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Check that an uploaded file's byte length is within the limit (REQ-PMS-012).
 * Returns an error message when the file is too large or empty.
 */
export function checkUploadSize(byteLength: number): string | null {
  if (byteLength === 0) return 'Uploaded file is empty.';
  if (byteLength > MAX_UPLOAD_BYTES) {
    return `Uploaded file exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`;
  }
  return null;
}

function coerceBoolean(value: boolean | string | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}
