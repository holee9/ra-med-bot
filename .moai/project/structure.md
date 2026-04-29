# 프로젝트 구조 — Regula

> 최종 업데이트: 2026-04-30
> 출처: `RA-bot-design/design_handoff_regula/README.md`

---

## 디렉토리 전략 (§5)

Next.js 15 App Router를 사용하며, `(auth)`와 `(app)` Route Group으로 인증 경계를 명확히 분리한다.

```
regula/
├── app/
│   ├── (auth)/                          # 비인증 라우트
│   │   ├── login/page.tsx
│   │   └── sso/callback/route.ts
│   ├── (app)/                           # 인증 후 앱 셸 (공통 layout 공유)
│   │   ├── layout.tsx                   # Sidebar + Topbar 래퍼
│   │   ├── page.tsx                     # Home
│   │   ├── chat/
│   │   │   ├── page.tsx                 # 새 상담
│   │   │   └── [conversationId]/page.tsx
│   │   ├── history/page.tsx
│   │   ├── templates/
│   │   │   ├── page.tsx
│   │   │   └── [templateId]/page.tsx
│   │   ├── knowledge/page.tsx           # Knowledge Base
│   │   ├── updates/
│   │   │   ├── page.tsx
│   │   │   └── [updateId]/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── projects/[projectId]/page.tsx
│   │   ├── sources/[sourceId]/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── ra/consult/route.ts          # 메인 RAG 엔드포인트 (streaming)
│   │   ├── ra/conversations/route.ts
│   │   ├── ra/sources/route.ts
│   │   ├── ra/templates/route.ts
│   │   ├── ra/updates/route.ts
│   │   ├── ra/projects/route.ts
│   │   └── ra/expert-review/route.ts
│   ├── layout.tsx                       # 루트 레이아웃 (폰트, globals)
│   └── globals.css
├── components/
│   ├── shell/                           # 앱 셸 — Sidebar, Topbar
│   ├── chat/                            # 채팅 관련 컴포넌트
│   ├── views/                           # 각 View 컴포넌트
│   ├── onboarding/
│   ├── primitives/                      # Radix 래핑 기본 요소
│   └── icons/Icon.tsx
├── lib/
│   ├── ai/                              # RAG 오케스트레이션, 리트리버
│   ├── db/                              # Drizzle 스키마 + 쿼리
│   ├── auth.ts
│   ├── i18n.ts
│   └── utils.ts
├── hooks/                               # 커스텀 훅
├── stores/                              # Zustand 스토어
├── styles/tokens.css                    # Tailwind @theme 매핑
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── fixtures/
├── .env.example
├── drizzle.config.ts
├── next.config.mjs
├── tailwind.config.ts
├── biome.json
└── package.json

---

## 백엔드 우선 전략 주의사항

**구현 순서가 매우 중요합니다**:

1. **먼저 구현해야 할 것** (백엔드)
   - `lib/db/` — Drizzle 스키마와 쿼리
   - `lib/ai/` — RAG 파이프라인 로직
   - `app/api/ra/` — API 엔드포인트
   - `hooks/` — 스트리밍 훅(`useStreamingAnswer`)

2. **이후에 구현할 것** (프론트엔드)
   - `components/` — UI 컴포넌트
   - `app/(app)/` — Next.js 페이지
   - `stores/` — 클라이언트 상태 관리

이 순서를 지키지 않으면 API 연동 문제와 의존성 문제가 발생합니다.
```

---

## Route Groups 설명

| Route Group | 경로 | 목적 |
|---|---|---|
| `(auth)` | `/login`, `/sso/callback` | 비인증 페이지. noindex 외 예외 허용 유일 공개 경로 |
| `(app)` | 나머지 모든 경로 | 인증 후 공통 셸(Sidebar + Topbar) 레이아웃 공유. 미인증 접근 시 `/login` 리다이렉트 |

`(app)/layout.tsx`가 Sidebar + Topbar를 포함하므로, 모든 인증 페이지는 별도 셸 렌더링 없이 공통 레이아웃을 자동으로 사용한다.

---

## 8개 View 목록 (§7.1 ~ §7.11)

> 핸드오프는 §7.1~§7.11 총 11개 항목(Shell 2개 + View 9개)으로 구성.

| View | Path | 주 목적 | 주요 컴포넌트 |
|---|---|---|---|
| Shell — Sidebar (§7.1) | 공통 | 내비게이션, 프로젝트 전환, 새 상담 버튼 | `Sidebar.tsx`, 프로젝트 목록 |
| Shell — Topbar (§7.2) | 공통 | 브레드크럼, 테마 토글, 전문가 검토 버튼 | `Topbar.tsx`, ThemeToggle |
| Home (§7.3) | `/` | 빠른 시작, 최근 질의, 빠른 템플릿 | `HomeView.tsx`, Quick grid |
| Chat / New Consultation (§7.4) | `/chat`, `/chat/[id]` | 핵심 화면 — 질의 제출 + 답변 + 출처 | `Composer`, `AnswerBlock`, `RightContextPanel` |
| History (§7.5) | `/history` | 과거 상담 목록, 필터 | `HistoryView.tsx`, 가상화 목록 |
| Templates (§7.6) | `/templates`, `/templates/[id]` | 재사용 가능한 제출 문서 템플릿 | `TemplatesView.tsx`, 3열 그리드 |
| Knowledge Base / Sources (§7.7) | `/knowledge` | Regula가 아는 출처 투명성 공개 | `SourcesView.tsx`, 그룹별 출처 카드 |
| Regulatory Updates (§7.8) | `/updates`, `/updates/[id]` | 사용자 제품 맞춤 규제 변경 피드 | `UpdatesView.tsx`, 영향도 분석 버튼 |
| Dashboard (§7.9) | `/dashboard` | 팀 수준 활동 개요 | `DashboardView.tsx`, Recharts 바 차트 |
| Document Viewer (§7.10) | 모달 (모든 경로) | 출처 문서 전문 열람, 관련 단락 하이라이트 | `DocViewer.tsx`, 문서 앵커 내비 |
| Onboarding (§7.11) | 첫 방문 모달 | 4단계 온보딩 안내 | `OnboardingModal.tsx` |

---

## Shared 컴포넌트 (§8)

`components/chat/` 아래에 위치하며, AnswerBlock 내부 합성에 사용되는 핵심 공유 컴포넌트들이다.

| 컴포넌트 | 섹션 | 설명 |
|---|---|---|
| `Citation` | §8.1 | `<sup class="cite">N</sup>` — mono 10px, brand-100 bg. 클릭 → DocViewer |
| `ConfidenceBadge` | §8.2 | high(green)/med(amber)/low(red) 3단계. 퍼센트 + 컬러 dot |
| `AnswerBlock` | §8.3 | 복합 컴포넌트: meta row → expert callout → 산문 → 체크리스트 → 비교표 → 타임라인 → 출처 → 후속 질문 |
| `SourceCard` | §8.4 | index 배지 + 기관명 + 타입 필 + 제목 + 연도. hover: lift 1px |
| `Checklist Row` | §8.5 | 16×16 체크박스, 완료 시 success 색상. ref 배지 |
| `ComparisonTable` | §8.6 | 첫 열 헤더 스타일, region chip `<th>`, vertical-align top |
| `Timeline` | §8.7 | 세로 1px 선 + 9px 불릿. current = amber. 날짜(mono) + 제목 + 설명 |
| `Callout` | §8.8 | info(brand)/warn(amber)/expert(amber 강조) 3 variants |
| `Chip / Button / IconButton` | §8.9 | sm/md 사이즈, primary/ghost/accent/default. hover 120ms |
| `SuggestionPill` | §8.10 | rounded-full, hover → brand-400 border + brand-50 fill, plus icon prefix |

---

## 폴더 경계 규칙

| 폴더 | 책임 | 포함하지 않는 것 |
|---|---|---|
| `components/shell/` | Sidebar, Topbar, UserMenu — 앱 셸 프레임 | 페이지별 비즈니스 로직 |
| `components/chat/` | Composer, AnswerBlock, Citation 등 채팅 흐름 | 셸 레이아웃, 뷰 특화 컴포넌트 |
| `components/views/` | HomeView, HistoryView, DashboardView 등 페이지 컴포넌트 | 재사용 가능한 공유 컴포넌트 |
| `components/primitives/` | Radix UI 래핑(Button, Chip, Dialog, Dropdown, Callout) | 도메인 로직 |
| `lib/ai/` | RAG 오케스트레이션, 리트리버, 프롬프트, confidence, expert-review | DB 쿼리, auth |
| `lib/db/` | Drizzle 스키마, 쿼리, 클라이언트 | AI/LLM 로직 |
| `lib/auth.ts` | Auth.js 설정, 세션 헬퍼 | 앱 비즈니스 로직 |
| `hooks/` | `useStreamingAnswer`, `useConversation`, `useProject`, `useTheme` | 서버 사이드 로직 |
| `stores/` | Zustand — `ui.ts`(테마, 사이드바), `conversation.ts` | 서버 상태(TanStack Query 담당) |

---

## 현재 vs. 계획된 구현 상태

### 현재 상태 (프로토타입/설계 단계)
- **프로덕션 코드 없음**: 현재는 프로토타입과 설계 문서만 존재
- **기술 결정 완료**: Next.js 15 + TypeScript + Tailwind v4 + Radix UI 스택 확정
- **구조 설계 완료**: 폴더 구조와 컴포넌트 경계 완전 정의됨
- **API 스펙 완성**: RAG 파이프라인과 엔드포인트 인터페이스 명확히 정의됨

### 계획된 구현 (백엔드 우선)
**백엔드 우선 전략**에 따라 다음 순서로 구현됩니다:

1. **Phase 1 — Foundation** (DB, API, RAG 파이프라인)
   - PostgreSQL 16 + pgvector DB 스키마
   - `/api/ra/consult` 등 핵심 API 엔드포인트
   - RAG 파이프라인 코어 로직

2. **Phase 2 — Chat Core** (프론트엔드 연동)
   - Next.js App Router 기반 UI
   - Composer, AnswerBlock, DocViewer 컴포넌트
   - SSE 스트리밍 훅 구현

3. **Phase 3 — Structured Outputs** (고급 기능)
   - Checklist, ComparisonTable, Timeline 컴포넌트
   - Expert Review 자동 게이팅 시스템

### Prototype vs. Production 경계

CLAUDE.md "Prototype vs. Production Code" 블록 한국어 요약:

**참조만 가능한 것 (직접 복사 금지)**
- `design_files/src/*.jsx` — `<script type="text/babel">` + `@babel/standalone`로 브라우저에서만 동작
- 번들러/TypeScript/npm 모듈 없음, ad-hoc 글로벌 사용
- `data.jsx`의 시드 데이터 — 예시 픽스처일 뿐, 실제 API 연동 필요

**허용되는 참조 용도**
- 레이아웃, 간격(spacing), 색상, 타이포그래피 → 픽셀 정확도 구현
- 인터랙션 의도(hover 동작, 애니메이션 타이밍 등)
- 컴포넌트 합성 순서 (AnswerBlock 내부 구조 등)

**생산 코드에서 재구현**
- Next.js 15 + TypeScript + Tailwind v4 + Radix UI 스택으로 새로 작성
- 프로토타입 `*.jsx`를 `components/` + `app/` 구조로 매핑 (§5, §7~§8)

---

## 관련 핸드오프 섹션

- §5 Project Structure — 전체 폴더 트리 원문
- §7.1 ~ §7.11 Screens & Views — 각 View 상세 스펙
- §8.1 ~ §8.10 Shared Components — 공유 컴포넌트 상세
- §2 About the Design Files — 프로토타입 파일 목적 및 제약
