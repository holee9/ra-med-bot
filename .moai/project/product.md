# 제품 개요 — Regula

> 최종 업데이트: 2026-04-22
> 출처: `RA-bot-design/design_handoff_regula/README.md`

---

## 제품 비전 (§1)

**의료기기 규제(RA) 전문가 및 개발/QA 실무자가 규제 질의를 제출하면, 공식 규제 코퍼스와 사내 SOP를 교차 검색하여 inline citation이 포함된 구조화 답변·체크리스트·비교표·타임라인을 즉시 제공하는 RAG 챗봇.**

---

## 타깃 사용자 (§1)

| 사용자 그룹 | 설명 | 주요 니즈 |
|---|---|---|
| 주 사용자 | 개발/QA팀 비RA 전문가 | RA 전문 지식 없이 규제 질의 → 근거 기반 답변 |
| 부 사용자 | 사내 RA 리드 | 플래그된 답변 검토, expert review 큐 관리 |
| 3차 사용자 | 해외 딜러/컨설턴트 | 특정 시장 규제 명확화 요청 |

---

## 핵심 Job-to-be-Done (§1)

1. **규제 자문 질의 → citation 포함 구조화 답변**: FDA, EU MDR, MFDS, NMPA, PMDA, ISO/IEC 공식 문서 + 사내 SOP를 검색하여 모든 주장에 inline `<sup>N</sup>` citation 첨부
2. **정책 판단 지원**: 체크리스트, 관할권별 비교표, 제출 타임라인으로 "다음 행동" 제시
3. **Expert review 게이팅**: 신뢰도 낮거나 고위험 질의는 자동으로 RA 리드에게 플래그
4. **컨텍스트 기반 답변**: 사용자의 현재 프로젝트(device class, target market) 반영
5. **규제 최신성 유지**: 규제 업데이트 피드로 사용자 제품군에 영향 있는 변경사항 알림

---

## 핵심 가치 제안 (§1)

| 원칙 | 내용 |
|---|---|
| Evidence-first | 모든 LLM 주장에 근거 문서 inline citation 필수 |
| Context-aware | 프로젝트·제품 클래스·목표 시장 반영 |
| Expert-reviewable | 낮은 신뢰도/고위험 답변 → 인간 RA 검토 자동 플래그 |
| Actionable | 텍스트만이 아닌 체크리스트·비교표·제출 타임라인 제공 |

---

## 제품 원칙 — Non-Obvious Constraints

아래 7개 제약은 CLAUDE.md "Non-Obvious Product Constraints" 블록에서 발췌. **구현 전 내재화 필수**.

### 1. 모든 LLM 주장에 inline citation 강제 (§8.1, §16)
- LLM 출력의 모든 사실적 주장에 `<sup class="cite">N</sup>` 태그 부착
- **두 겹 강제**: 시스템 프롬프트에서 citation 규칙 명시 + citation 없는 주장을 제거하거나 플래그하는 후처리 패스
- 미인용 주장이 최종 출력에 도달해서는 안 됨

### 2. SSE 다단계 스트리밍 (§9.1, §11.1)
- 단일 SSE 스트림에서 **3단계** 순서로 이벤트 도달:
  1. `trace` — 검색 단계별 진행 상태 (각 500ms 이상 간격)
  2. `prose_delta` — 산문 토큰 스트리밍
  3. 구조화 블록 JSON: `checklist`, `comparison`, `timeline`, `sources`, `related`, `expert_review_required`
- `useStreamingAnswer` 훅은 **모든 이벤트 타입을 처리**해야 함

### 3. Expert-review 자동 게이팅 (§9.3)
- **자동 조건**: `confidence_score < 0.7` OR 정책 차단 키워드 포함("임상시험 면제", "응급" 등)
- **수동**: Topbar "전문가 검토" 버튼 → `/api/ra/expert-review` POST
- 제품 안전 게이트이며 단순 UI 요소가 아님. Day 1부터 구현 필수

### 4. 21 CFR Part 11 감사 로그 (§16)
- 모든 LLM 호출, 출처 접근, expert review 플래그 → **append-only `audit_logs` 테이블**
- **7년 보존** (FDA 기대치 충족)
- 나중에 추가하는 것이 아닌 **Day 1 요구사항**
- 불변(immutable) 로그; 수정·삭제 불가

### 5. Serif/Sans 타이포그래피 대비 = 브랜드 요건 (§6)
- **Serif 강제 적용 위치**: H1 헤딩, 문서 뷰어 본문, 통계 수치, 채팅 사용자 질문, 인용 규제 텍스트
- **폰트**: `Source Serif 4` (영문), `Noto Serif KR` (한국어)
- Sans 단일 폰트로 대체 불가 — 브랜드 요건

### 6. 한/영 이중언어 First-class (§6, §11.1)
- `Noto Serif KR` + `Pretendard` 폰트 스택 포함
- API 요청에 `locale: 'ko' | 'en'` 파라미터 포함
- 한국어 UI가 기본 (`ko`); 영어는 동등한 지원 대상
- 로케일 전환 시 **전체 페이지 리로드 없이** 대화 유지

### 7. Auth 뒤 → 전역 noindex (§15 SEO)
- `/login` 페이지를 제외한 **모든 앱 페이지에 `noindex`**
- 마케팅 SEO는 별도 마케팅 사이트에서 처리
- 앱 셸에 마케팅 SEO 메타태그 추가 금지

---

## 핵심 사용자 시나리오 (§9)

| 시나리오 | 흐름 | 주요 컴포넌트 |
|---|---|---|
| **1. 규제 질의 제출** | Composer에 질문 입력 → Enter → SSE 스트림 → Thinking trace → 산문 → 구조화 블록 순 렌더링 | Composer, Thinking, AnswerBlock |
| **2. Citation 클릭** | 답변 내 `<sup>N</sup>` 클릭 → DocViewer 모달 → 관련 단락 하이라이트(amber underline), `#source=N&offset=M` 딥링크 | Citation, DocViewer |
| **3. Expert review 플래그** | confidence < 0.7 또는 차단 키워드 → amber callout 자동 표시 + RA 리드 큐에 전송 | ConfidenceBadge, Callout, expert-review API |
| **4. 프로젝트 전환** | Sidebar 프로젝트 클릭 → Zustand `currentProjectId` 업데이트 → 이후 질의에 projectId 포함 → RAG 내부 문서 가중치 조정 | Sidebar, useProject, /api/ra/consult |
| **5. 다크모드 전환** | Topbar 아이콘 클릭 → `data-theme="dark"` on `<html>` → localStorage + 사용자 프로필 저장 → `prefers-color-scheme` 초기 방문 시 존중 | ThemeToggle, ui.ts Zustand store |

---

## 성공 지표 (KPI)

| 지표 | 목표값 | 측정 방법 |
|---|---|---|
| Citation coverage | 100% — 모든 주장에 citation | 후처리 패스 + LLM eval harness |
| Audit log completeness | 100% — 모든 LLM 호출·출처 접근 기록 | DB 쿼리 감사 |
| Expert-review latency | < 영업일 1일 | expert_reviews 테이블 resolved_at |
| 접근성 — Axe-core 위반 | 0 violations | Playwright + axe-core (§17) |
| 접근성 기준 | WCAG 2.1 AA | 자동화 + 수동 심사 |
| LCP | ≤ 2.0s | Vercel Analytics / Web Vitals |
| INP | ≤ 200ms | Web Vitals |
| First answer token | ≤ 1.5s after submit | Langfuse latency trace |

---

## 범위 외 (Out of Scope)

- 일반 소비자용 챗봇 (B2C, 비규제 영역)
- 의료기기와 무관한 산업 규제 QA
- 마케팅 SEO / 공개 랜딩 페이지 (별도 마케팅 사이트)
- AI 생성 이미지/일러스트 (규제 청중에 부적절 — §13.4)
- 인증 없이 접근 가능한 페이지 (`/login` 제외)
- Phase 1 착수 전 로드맵 §19의 추가 기능 (문서 diff 뷰어, 제출 플래너 Gantt 등)

---

## 구현 로드맵 요약 (§20)

| Phase | 범위 | 우선순위 |
|---|---|---|
| Phase 1 — Foundation | Next.js 스캐폴딩, Tailwind 토큰 매핑, Auth.js SSO, Drizzle 스키마, RSC 셸(Sidebar+Topbar), Home + 빈 Chat | High |
| Phase 2 — Chat core | Composer, 스트리밍 훅, Thinking, AnswerBlock(산문+citation+출처), DocViewer, 단일 코퍼스 RAG(FDA) | High |
| Phase 3 — Structured outputs | Checklist, ComparisonTable, Timeline, SuggestedFollowups, RightContextPanel | High |
| Phase 4 — Breadth | History, Templates, Knowledge Base, Regulatory Updates, Dashboard, Project switching | Medium |
| Phase 5 — Enterprise hardening | Expert review flow, audit_logs, RBAC, 다크모드 polish, i18n, 접근성 감사, Sentry/Langfuse | High |
| Phase 6 — Quality & launch | LLM eval harness, Playwright e2e, 부하 테스트, 보안 리뷰 | Medium |

---

## 관련 핸드오프 섹션

- §1 Overview — 제품 비전, 타깃 사용자, 핵심 가치 제안
- §9 Interactions & Behavior — 5개 핵심 시나리오 상세 흐름
- §15 Performance & SEO — KPI 및 SEO 전략
- §16 Security & Compliance — 21 CFR Part 11, audit_logs
- §19 Suggested Additional Features — 범위 외 로드맵 아이템
- §20 Implementation Roadmap — Phase 1–6 순서
