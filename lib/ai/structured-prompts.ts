// @MX:NOTE [AUTO] Structured block prompt builders — REQ-STRUCT-017~018.
// 7 functions: 3 classifier pairs (checklist/comparison/timeline) + related generator.
// All generator prompts end with the required JSON-only instruction.
// HTML tags (<sup>, data-source=) are intentionally EXCLUDED per REQ-STRUCT-018.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-017, REQ-STRUCT-018)

interface PromptInput {
  question: string;
  prose: string;
  topSources: Array<{ title: string; orgLabel: string; year: number | null }>;
  locale: 'ko';
}

const JSON_ONLY_INSTRUCTION = '응답은 오직 JSON 객체로만 출력하라. 코드 블록, 해설, 서문 금지.';

function formatSources(sources: PromptInput['topSources']): string {
  return sources
    .map((s, i) => `[${i + 1}] ${s.orgLabel} — ${s.title}${s.year ? ` (${s.year})` : ''}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export function buildChecklistClassifier(input: PromptInput): string {
  return `다음 의료기기 규제 질문과 답변을 읽고, 체크리스트(단계별 확인 항목)가 필요한지 판단하라.

질문: ${input.question}

답변 요약: ${input.prose.slice(0, 500)}

체크리스트가 유용하다면 yes, 불필요하다면 no 로만 답하라.`;
}

export function buildChecklistGenerator(input: PromptInput): string {
  const sourceList = formatSources(input.topSources);
  return `다음 의료기기 규제 답변을 바탕으로 실무자가 따라야 할 체크리스트를 생성하라.

질문: ${input.question}

답변:
${input.prose.slice(0, 2000)}

참고 출처:
${sourceList}

요구사항:
- 각 항목은 구체적인 실무 액션이어야 한다.
- ref 필드는 순수 텍스트 법령 참조 (예: "21 CFR §807.81(a)")로만 표기한다. HTML 태그 사용 금지.
- 1개 이상 20개 이하의 항목을 생성하라.
- 모든 텍스트는 한국어로 작성하라.

출력 형식:
{
  "type": "checklist",
  "items": [
    { "id": "...", "title": "...", "ref": "...", "completed": false }
  ]
}

${JSON_ONLY_INSTRUCTION}`;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export function buildComparisonClassifier(input: PromptInput): string {
  return `다음 의료기기 규제 질문과 답변을 읽고, 관할권·기준·방법 등을 비교하는 표가 필요한지 판단하라.

질문: ${input.question}

답변 요약: ${input.prose.slice(0, 500)}

비교표가 유용하다면 yes, 불필요하다면 no 로만 답하라.`;
}

export function buildComparisonGenerator(input: PromptInput): string {
  const sourceList = formatSources(input.topSources);
  return `다음 의료기기 규제 답변을 바탕으로 관할권별 또는 기준별 비교표를 생성하라.

질문: ${input.question}

답변:
${input.prose.slice(0, 2000)}

참고 출처:
${sourceList}

요구사항:
- 열(cols)은 2개 이상 5개 이하로 설정하라.
- 행(rows)은 1개 이상 30개 이하로 설정하라.
- 각 행의 셀 수는 열 수와 정확히 일치해야 한다.
- 모든 텍스트는 한국어로 작성하라. HTML 태그 사용 금지.

출력 형식:
{
  "type": "comparison",
  "title": "...",
  "cols": ["열1", "열2"],
  "rows": [["값1", "값2"]]
}

${JSON_ONLY_INSTRUCTION}`;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function buildTimelineClassifier(input: PromptInput): string {
  return `다음 의료기기 규제 질문과 답변을 읽고, 날짜 기반 타임라인(규제 일정, 단계별 이정표)이 필요한지 판단하라.

질문: ${input.question}

답변 요약: ${input.prose.slice(0, 500)}

타임라인이 유용하다면 yes, 불필요하다면 no 로만 답하라.`;
}

export function buildTimelineGenerator(input: PromptInput): string {
  const sourceList = formatSources(input.topSources);
  return `다음 의료기기 규제 답변을 바탕으로 규제 일정 타임라인을 생성하라.

질문: ${input.question}

답변:
${input.prose.slice(0, 2000)}

참고 출처:
${sourceList}

요구사항:
- 날짜는 YYYY-MM-DD 형식으로만 표기하라.
- 1개 이상 12개 이하의 항목을 생성하라.
- 현재 단계(current: true)는 1개 이하로 설정하라.
- 모든 텍스트는 한국어로 작성하라. HTML 태그 사용 금지.

출력 형식:
{
  "type": "timeline",
  "items": [
    { "date": "YYYY-MM-DD", "title": "...", "description": "...", "current": false }
  ]
}

${JSON_ONLY_INSTRUCTION}`;
}

// ---------------------------------------------------------------------------
// Related (always generated, no classifier)
// ---------------------------------------------------------------------------

export function buildRelatedGenerator(input: PromptInput): string {
  return `다음 의료기기 규제 질문과 답변을 읽고, 사용자가 이어서 질문할 가능성이 높은 관련 질문 3~5개를 한국어로 생성하라.

원 질문: ${input.question}

답변 요약: ${input.prose.slice(0, 800)}

요구사항:
- 반드시 3~5개를 생성하라. 3개 미만 또는 5개 초과는 허용하지 않는다.
- 각 질문은 100자 이하의 자연스러운 한국어 문장이어야 한다.
- HTML 태그 사용 금지.

출력 형식:
{
  "type": "related",
  "items": ["질문1", "질문2", "질문3"]
}

${JSON_ONLY_INSTRUCTION}`;
}
