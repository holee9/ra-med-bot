// @MX:ANCHOR [AUTO] computeAnswerHash — SHA-256 signature/record linkage (§11.70).
// @MX:REASON Called by POST sign route, lock helper, and revoke route.
//            fan_in will reach 3+ across signature routes.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-002)

/**
 * Block canonical representation for hashing.
 * Only id, content, and type are included — immutable identity fields.
 */
export interface HashableBlock {
  id: string;
  content: string;
  type: string;
}

/**
 * Computes a SHA-256 hex digest linking a signature to an answer record.
 *
 * Canonical input: JSON.stringify({ prose: contentProse, blocks: [...] })
 * - Blocks are included in their received order (order matters for §11.70).
 * - Uses globalThis.crypto.subtle for Edge-compatible crypto.
 *
 * Returns: lowercase hex string (64 characters).
 */
export async function computeAnswerHash(
  contentProse: string,
  blocks: HashableBlock[],
): Promise<string> {
  const canonical = JSON.stringify({
    prose: contentProse,
    blocks: blocks.map((b) => ({ id: b.id, content: b.content, type: b.type })),
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
