// @MX:NOTE [AUTO] System-prompt project-memory injector (AC-02 call target).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-003, REQ-010, AC-02, AC-06)
// @MX:REASON REQ-003: new conversations MUST receive the project's accumulated
//   RA decisions so AI answers stay consistent with prior design-control choices
//   (ISO 13485). REQ-010: expired memories (valid_until <= now()) are excluded.
//   §7 #3 budget: injection caps at ~2000 chars (~500 tokens) to avoid prompt
//   bloat; on overflow, higher-priority memoryType wins (device_classification
//   > risk_class > target_markets > predicate_device > submission_strategy > custom).
//
// AC-02 dead-code prevention (L-008, recurred 7× in #50): this function is the
//   injector, but its mere existence does NOT satisfy AC-02. It MUST be called
//   from lib/ai/consult.ts at the composePrompt site. The wiring + budget logic
//   are verified by tests/unit/project-memory/injector.test.ts (two-layer:
//   formatMemoriesForInjection unit + consult wiring spy via dynamic-import mock).

import { getValidMemories } from './manager';

/**
 * memoryType injection priority (§7 design decision #3). Higher = injected
 * first when the 2000-char budget overflows. device_classification and
 * risk_class drive regulatory pathway consistency (ISO 13485) so they win.
 */
const MEMORY_TYPE_PRIORITY: Record<string, number> = {
  device_classification: 60,
  risk_class: 50,
  target_markets: 40,
  predicate_device: 30,
  submission_strategy: 20,
  custom: 10,
};

/** §7 #3: total injection budget (~500 tokens). */
const MAX_INJECTION_CHARS = 2000;
/** §7 #3: per-memory value cap before truncation. */
const MAX_VALUE_CHARS = 200;

/** Human-readable label per memoryType for the injected block. */
const MEMORY_TYPE_LABEL: Record<string, string> = {
  device_classification: '디바이스 분류',
  target_markets: '목표 시장',
  submission_strategy: '제출 전략',
  predicate_device: 'Predicate Device',
  risk_class: '위험 등급',
  custom: '기타',
};

/**
 * Format the valid memories into a compact Korean block prefixed to the system
 * prompt. Applies budget truncation by memoryType priority. Visible for testing.
 */
export function formatMemoriesForInjection(
  memories: Array<{
    memoryType: string;
    key: string;
    value: string;
  }>,
): string {
  if (memories.length === 0) return '';

  // Sort by priority desc, then by key for deterministic output.
  const sorted = [...memories].sort((a, b) => {
    const pa = MEMORY_TYPE_PRIORITY[a.memoryType] ?? 0;
    const pb = MEMORY_TYPE_PRIORITY[b.memoryType] ?? 0;
    if (pb !== pa) return pb - pa;
    return a.key.localeCompare(b.key);
  });

  const lines: string[] = [];
  let used = 0;
  // Reserve room for the header + footer.
  const header = '## 프로젝트 컨텍스트 (자동 주입)';
  const footer = '';
  used += header.length + footer.length + 4; // newlines + bullet overhead

  for (const m of sorted) {
    const label = MEMORY_TYPE_LABEL[m.memoryType] ?? m.memoryType;
    const value =
      m.value.length > MAX_VALUE_CHARS ? `${m.value.slice(0, MAX_VALUE_CHARS - 1)}…` : m.value;
    const line = `- ${label}: ${value}`;
    if (used + line.length + 1 > MAX_INJECTION_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }

  if (lines.length === 0) return '';
  return `${header}\n${lines.join('\n')}\n\n`;
}

/**
 * REQ-003 / AC-02: prepend the project's valid memories to `systemPrompt`.
 * Returns the original prompt unchanged when the project has no valid memories
 * (zero-allocation fast path). Throws are swallowed — injection is best-effort
 * and MUST NEVER block the consult stream (the user still gets an answer).
 *
 * Called from lib/ai/consult.ts (lazy import) at the composePrompt site.
 */
export async function injectProjectMemory(
  systemPrompt: string,
  projectId: string,
  orgId: string,
): Promise<string> {
  try {
    const memories = await getValidMemories(projectId, orgId);
    if (memories.length === 0) {
      return systemPrompt;
    }
    const block = formatMemoriesForInjection(memories);
    if (!block) return systemPrompt;
    return block + systemPrompt;
  } catch {
    // Non-fatal: injection failure MUST NOT break the consult stream.
    return systemPrompt;
  }
}
