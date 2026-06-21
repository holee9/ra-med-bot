// @MX:NOTE [AUTO] Shared content flattening util for PCCP exporters.
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-018/019)
// Renders content_jsonb (arbitrary JSON) into a flat [key, value] list that
// both the PDF and DOCX exporters consume. Single source of truth — avoids
// duplicating the recursion logic across renderers.

/**
 * Flatten content_jsonb into a flat list of [key, value] text lines.
 * Objects recurse one level; arrays join with "; "; primitives stringify.
 * Nested object keys are joined with " · ".
 */
export function flattenContent(
  content: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(content)) {
    const label = prefix ? `${prefix} · ${k}` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      const items = v.map((item) =>
        typeof item === 'object' && item !== null
          ? Object.entries(item as Record<string, unknown>)
              .map(([ik, iv]) => `${ik}: ${iv}`)
              .join(', ')
          : String(item),
      );
      out.push({ key: label, value: items.join('; ') });
    } else if (typeof v === 'object') {
      out.push(...flattenContent(v as Record<string, unknown>, label));
    } else {
      out.push({ key: label, value: String(v) });
    }
  }
  return out;
}
