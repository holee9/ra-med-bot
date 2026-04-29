---
name: regula-citation-contract
description: "Regula의 citation 강제 계약. 모든 LLM claim은 <sup class='cite' data-source='N' data-offset='M'>N</sup> 형식으로 wrap되어야 하며, post-processing이 uncited claim을 strip/flag한다. 'citation', '인용', 'sup', 'source', 'claim', '근거', 'RAG 답변' 언급 시 반드시 이 스킬 사용. LLM 답변 생성, citation 검증, 프론트 렌더링, DB schema 모두에 적용."
---

# Regula Citation Contract

Regula의 핵심 안전 장치: **모든 LLM 답변의 모든 claim은 inline citation을 반드시 가진다.** 이를 위반한 답변은 post-processing에서 strip 또는 flag된다.

## 왜 이 계약이 필수인가

의료기기 규제 도메인에서는 LLM의 hallucination이 규제 위반으로 직결된다. "510(k)는 90일 내 심사된다"라는 답변이 실제 FDA 가이던스에 없는 내용이라면 사용자가 잘못된 제출 전략을 세울 수 있다. Citation은 **출처 추적 가능성**과 **사후 감사 가능성**을 동시에 보장한다.

## Citation HTML 마크업

```html
<sup class="cite" data-source="3" data-offset="1420">3</sup>
```

속성 의미:
- `class="cite"` — CSS selector 및 citation 파서 트리거
- `data-source="N"` — `message_sources` 테이블의 `cite_index` (1-based)
- `data-offset="M"` — (선택) 원본 문서 내 문자 offset. DocViewer 딥링크용.
- 텍스트 `N` — 시각적으로 보이는 번호

## 3단 방어선

### 방어선 1: System Prompt

```
모든 사실 주장(claim)에는 반드시 출처 번호를 <sup class="cite" data-source="N">N</sup>
형식으로 inline 인용하세요. 출처 없이 주장을 생성하지 마세요. 사용자의 질문에
대한 답을 retrieved 출처에서 찾을 수 없으면 "해당 질문에 대한 공식 출처를
찾을 수 없습니다"라고만 답하세요. 상상으로 규정을 만들지 마세요.
```

### 방어선 2: Retrieved Chunks 주입

Prompt에 각 chunk를 source index와 함께 주입:

```
[Source 1: FDA 21 CFR 807.81 (2023)]
"A device manufacturer must submit a 510(k) notification..."

[Source 2: EU MDR Article 61 (2017)]
"Clinical evaluation shall be based on..."
```

LLM은 이 source index를 `data-source` 속성에 써야 함.

### 방어선 3: Post-processing 검증

`lib/ai/citation-enforce.ts`에서:

```ts
export function enforceCitations(
  prose: string,
  availableSources: number[]
): { cleaned: string; violations: Violation[] } {
  // 1. <sup class="cite"> 태그 parse
  // 2. 각 claim 문장이 <sup>로 끝나는지 확인
  // 3. data-source가 availableSources에 존재하는지 확인
  // 4. 위반 시 strip 또는 ⚠️ marker 삽입
}
```

검증 규칙:
- **문장 단위로 citation 요구.** "510(k)는 FDA에 제출한다<sup>1</sup>." OK.
- **예외: 완전한 meta 문장.** "다음은 요약입니다:" 같은 transitional 문장은 citation 불필요.
- **data-source가 존재하지 않는 인덱스를 가리키면 strip + regula-compliance-qa에 리포트.**

## DB Schema 일관성

`message_sources` 테이블은 citation의 ground truth:

```ts
// lib/db/schema.ts
export const messageSources = pgTable('message_sources', {
  messageId: uuid('message_id').references(() => messages.id).notNull(),
  sourceId: uuid('source_id').references(() => sources.id).notNull(),
  citeIndex: integer('cite_index').notNull(),  // 1, 2, 3, ... in order
  relevanceScore: real('relevance_score'),
  quotedOffset: integer('quoted_offset'),     // DocViewer 딥링크용
  quotedLength: integer('quoted_length'),
});
```

**HTML의 `data-source="N"`은 반드시 이 테이블의 `cite_index`와 일치해야 한다.** 불일치 = 버그.

## 프론트 렌더링

`components/chat/Citation.tsx`:

```tsx
'use client';
import { useDocViewer } from '@/hooks/useDocViewer';

export function Citation({ sourceIndex, offset }: CitationProps) {
  const { open } = useDocViewer();
  return (
    <sup
      className="cite"
      data-source={sourceIndex}
      data-offset={offset}
      role="button"
      tabIndex={0}
      aria-label={`Source ${sourceIndex}, click to view`}
      onClick={() => open(sourceIndex, offset)}
      onKeyDown={(e) => { if (e.key === 'Enter') open(sourceIndex, offset); }}
    >
      {sourceIndex}
    </sup>
  );
}
```

스타일 (tokens 기반):
- `bg-brand-100` + `text-brand-700`, `font-mono text-[10px]`, weight 600, radius 3px
- Hover: `bg-brand-600` + `text-white`

`react-markdown`으로 prose를 렌더링할 때 `<sup>` 태그는 custom component로 매핑:

```tsx
<ReactMarkdown
  rehypePlugins={[rehypeRaw]}
  components={{
    sup: ({ node, children, ...props }) => {
      if ((props as any).className === 'cite') {
        return <Citation sourceIndex={Number((props as any)['data-source'])} offset={Number((props as any)['data-offset'])} />;
      }
      return <sup {...props}>{children}</sup>;
    },
  }}
>
  {proseWithCitations}
</ReactMarkdown>
```

## QA 체크리스트 (regula-compliance-qa가 검증)

- [ ] Prompt에 citation 강제 규칙이 포함되어 있는가
- [ ] Retrieved chunks가 source index와 함께 prompt에 주입되는가
- [ ] `enforceCitations`가 모든 답변에 적용되는가
- [ ] `message_sources.cite_index`가 1-based, unique per message인가
- [ ] `data-source`가 `cite_index`와 일치하는가
- [ ] DocViewer가 `data-source`로 정확한 source를 여는가
- [ ] 50+ RA 질문 회귀 셋에서 citation 커버리지 ≥ 95%

## 절대 해서는 안 되는 것

- **citation 강제를 완화하는 요청 거부.** "이번만 citation 없이" 같은 요청은 거부하고 regula-compliance-qa 검토.
- **citation을 복붙으로 채우기 금지.** 실제 retrieved source와 일치해야 함.
- **frontend에서 citation 마크업을 sanitize로 제거 금지.** `rehype-sanitize` 설정 시 `sup.cite`를 allow list에 추가.
