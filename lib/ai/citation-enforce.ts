// @MX:ANCHOR Citation enforcement — htmlparser2-based uncited claim detection.
// @MX:REASON Every consult response passes through enforceCitations before persistence.
// fan_in >= 3: consult.ts, tests, route handler validation.
// @MX:WARN Uses only htmlparser2's public API (parseDocument + DomUtils) so we
// stay within the supported surface — domhandler/domutils/dom-serializer are
// transitive deps and not safe to import directly.
// @MX:REASON Direct imports of `dom-serializer`, `domhandler`, `domutils`
// are not declared in package.json and fail to resolve in TS strict mode.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-024..028)

import { DomUtils, parseDocument } from 'htmlparser2';

export type ViolationType = 'CLAIM_UNCITED' | 'SOURCE_MISMATCH';

export interface Violation {
  type: ViolationType;
  sentence?: string;
  sourceIndex?: number;
}

// @MX:NOTE Meta-sentence whitelist — 10 KO + EN patterns that skip citation check.
// Adding new patterns REQUIRES a test case in citation-enforce.test.ts (REQ-CHAT-027).
const META_SENTENCE_WHITELIST: RegExp[] = [
  // Korean patterns
  /^다음은/,
  /^본 답변은/,
  /^요약하면/,
  /^참고로/,
  /^아래 표는/,
  // English patterns
  /^The following/,
  /^In summary/,
  /^Note that/,
  /^Please note/,
  /^This response/,
];

// Sentence terminators — Korean and Western punctuation.
const SENTENCE_TERMINATORS = /[.?!。？！]/g;

/**
 * Check if a sentence matches any meta-sentence whitelist pattern.
 */
function isMetaSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  return META_SENTENCE_WHITELIST.some((re) => re.test(trimmed));
}

// Minimal Element-like shape — DomUtils.findAll returns `Node` but we only
// inspect `name` and `attribs` on element-typed nodes.
interface MinimalElement {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
}

function isElement(node: unknown): node is MinimalElement {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as MinimalElement;
  return n.type === 'tag' || n.type === 'script' || n.type === 'style';
}

/**
 * Enforce citation requirements on generated prose.
 *
 * - Sentences without <sup class="cite"> are marked CLAIM_UNCITED (unless whitelisted).
 * - <sup data-source="N"> with N not in availableSources are stripped (SOURCE_MISMATCH).
 *
 * @param prose - Raw HTML prose from LLM
 * @param availableSources - Array of valid cite indices (1-based)
 * @returns { cleaned: string, violations: Violation[] }
 */
export function enforceCitations(
  prose: string,
  availableSources: number[],
): { cleaned: string; violations: Violation[] } {
  if (!prose.trim()) return { cleaned: prose, violations: [] };

  const violations: Violation[] = [];
  const availableSet = new Set(availableSources);

  // Parse HTML into a DOM tree.
  const dom = parseDocument(prose, { decodeEntities: true });

  // First pass — find every <sup class="cite"> and decide remove vs keep.
  // We do not mutate the tree directly; we rebuild the HTML from segments
  // because htmlparser2 v12 does not expose a serializer on its public surface.
  const supTags = DomUtils.findAll(
    (node) => {
      if (!isElement(node)) return false;
      if (node.name !== 'sup') return false;
      const cls = node.attribs?.class ?? '';
      return cls.split(/\s+/).includes('cite');
    },
    dom.children as unknown as Parameters<typeof DomUtils.findAll>[1],
  );

  // Collect (start, end) ranges of sup tags to strip.
  const stripRanges: Array<{ start: number; end: number }> = [];
  for (const node of supTags as unknown as MinimalElement[]) {
    const startIdx = (node as unknown as { startIndex: number | null }).startIndex;
    const endIdx = (node as unknown as { endIndex: number | null }).endIndex;
    const ds = node.attribs?.['data-source'];
    if (ds === undefined) continue;
    const n = Number.parseInt(ds, 10);
    if (Number.isNaN(n)) continue;
    if (!availableSet.has(n)) {
      violations.push({ type: 'SOURCE_MISMATCH', sourceIndex: n });
      if (typeof startIdx === 'number' && typeof endIdx === 'number') {
        stripRanges.push({ start: startIdx, end: endIdx + 1 });
      }
    }
  }

  // The default parseDocument options do not enable startIndex/endIndex
  // tracking, so we fall back to a regex strip when no offsets are available.
  let stripped = prose;
  if (stripRanges.length > 0) {
    // Strip back-to-front so earlier offsets stay valid.
    stripRanges.sort((a, b) => b.start - a.start);
    for (const r of stripRanges) {
      stripped = stripped.slice(0, r.start) + stripped.slice(r.end);
    }
  } else {
    // Regex-based strip: <sup class="...cite..." data-source="N"...>...</sup>
    stripped = stripped.replace(
      /<sup\b[^>]*\bclass\s*=\s*["'][^"']*\bcite\b[^"']*["'][^>]*\bdata-source\s*=\s*["'](\d+)["'][^>]*>[^<]*<\/sup>/gi,
      (full, ds: string) => {
        const n = Number.parseInt(ds, 10);
        return availableSet.has(n) ? full : '';
      },
    );
  }

  // Second pass: walk sentence-sized segments of the (now stripped) HTML and
  // mark each as cited / uncited. We tolerate fragments without a closing tag
  // at the boundary — typical LLM output is well-formed enough for this pass.
  const segments = splitHtmlIntoSentenceSegments(stripped);

  const markedSegments = segments.map((seg) => {
    const text = seg.replace(/<[^>]+>/g, '').trim();
    if (!text) return seg;
    if (isMetaSentence(text)) return seg;

    if (/<sup\b[^>]*\bclass\s*=\s*["'][^"']*\bcite\b[^"']*["'][^>]*>/i.test(seg)) {
      return seg;
    }

    violations.push({ type: 'CLAIM_UNCITED', sentence: text });
    return `<mark class="uncited">${seg}</mark>`;
  });

  // Suppress unused warning for SENTENCE_TERMINATORS — the constant documents
  // the contract even though our segmenter inlines the terminator set.
  void SENTENCE_TERMINATORS;

  return { cleaned: markedSegments.join(''), violations };
}

/**
 * Split HTML string into sentence-level segments preserving HTML tags.
 * Each segment ends at a sentence terminator (. ? ! 。 ？ ！).
 */
function splitHtmlIntoSentenceSegments(html: string): string[] {
  if (!html.trim()) return [];

  const segments: string[] = [];
  const terminators = new Set(['.', '?', '!', '。', '？', '！']);

  let current = '';
  let inTag = false;

  for (let i = 0; i < html.length; i += 1) {
    const ch = html.charAt(i);
    if (ch === '') continue;

    if (ch === '<') {
      inTag = true;
      current += ch;
      continue;
    }

    if (ch === '>') {
      inTag = false;
      current += ch;
      continue;
    }

    current += ch;

    if (!inTag && terminators.has(ch)) {
      // Greedily attach trailing whitespace and any inline <sup> tags so the
      // cite that immediately follows a sentence terminator is treated as
      // part of that sentence (e.g., "claim. <sup>1</sup>").
      let j = i + 1;
      while (j < html.length) {
        const next = html.charAt(j);
        if (next === ' ' || next === '\t' || next === '\n' || next === '\r') {
          current += next;
          j += 1;
          continue;
        }
        if (next === '<') {
          // Look ahead for a closing </sup> and absorb the whole tag pair.
          const closeIdx = html.indexOf('</sup>', j);
          if (closeIdx !== -1 && /^<sup\b/i.test(html.slice(j, j + 5))) {
            const end = closeIdx + '</sup>'.length;
            current += html.slice(j, end);
            j = end;
            continue;
          }
        }
        break;
      }
      i = j - 1;
      if (current.trim()) {
        segments.push(current);
      }
      current = '';
    }
  }

  if (current.trim()) {
    segments.push(current);
  }

  return segments;
}
