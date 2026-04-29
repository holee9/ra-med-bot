---
id: SPEC-REGULA-LAUNCH-001
document: research
phase: 6
created: 2026-04-22
author: manager-spec
related_handoff_sections:
  - "§15"
  - "§16"
  - "§17"
  - "§18"
  - "§20"
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-STRUCTURED-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-ENTERPRISE-001
---

# SPEC-REGULA-LAUNCH-001 — Research (Phase 6: Quality & Launch)

본 문서는 handoff §20 Phase 6 (Quality & Launch)의 SPEC 작성에 선행하는 사전 조사이다. 선정된 기술·데이터셋 구성·운영 전략의 근거를 기록하고, Phase 6 진입 시 재평가될 조건을 명시한다.

---

## 1. LLM Eval Harness 선정

### 1.1 비교 매트릭스

| 도구 | 라이선스 | 핵심 기능 | CI 친화성 | Regula 적합성 | 탈락/선정 |
|---|---|---|---|---|---|
| **promptfoo** | MIT (OSS) | YAML DSL, 커스텀 scorer, red-team, CLI, HTML report | `promptfoo eval --output json` CI 통합 용이 | 규제 질의 50+ 시나리오, citation coverage custom scorer, Anthropic/OpenAI provider 다양 | **선정** |
| LangSmith (LangChain) | Closed-source SaaS, 월 $39+ | Trace + Dataset + Eval 통합, LangChain 생태계 | LangChain SDK 기반 API 호출 | Langfuse와 기능 중복. 별도 계정/키 관리 비용 | 탈락 (중복 + 비용) |
| HumanEval/ragas | MIT (OSS) | RAG-전용 metrics (faithfulness, context recall) | Python | Next.js 프로젝트에 Python 도구 추가는 DevOps 부담, TypeScript 친화성 낮음 | 탈락 (언어 스택 불일치) |
| Custom harness | — | 완전 제어 | 자체 구현 필수 | citation coverage/hallucination rate 이미 post-processing (Phase 2)에 존재, 50+ 시나리오 실행 오케스트레이션만 필요하므로 promptfoo가 더 효율적 | 탈락 (재발명) |
| DeepEval | Apache 2.0 | Python `pytest`-style LLM eval | pytest CI 통합 | Python 언어 이중 스택 문제 | 탈락 |

### 1.2 선정 근거

promptfoo는 다음 조건을 모두 충족한다:
- **YAML DSL**: 규제 질의 50+ 시나리오를 RA 리드가 직접 추가/편집 가능 (엔지니어 개입 없이)
- **커스텀 scorer**: TypeScript로 citation coverage parser 재사용 가능 (Phase 2 `lib/rag/citation-parser.ts` 직접 import)
- **Anthropic provider 네이티브 지원**: `providers: [anthropic:claude-sonnet-4-5, anthropic:claude-haiku-4-5]` 형식으로 Sonnet/Haiku 양쪽 eval
- **CI 출력**: JSON/JUnit XML로 GitHub Actions matrix 통합
- **red-team 모드**: prompt injection, jailbreak 시나리오 일부 내장

### 1.3 재평가 조건

- promptfoo가 Anthropic zero-data-retention API와 호환되지 않으면 (v0.x 기준 미확인) custom harness로 마이그레이션
- 시나리오 수 200+ 확장 시 실행 시간 측정 후 병렬화 필요성 판단

---

## 2. 50+ 규제 질의 데이터셋 구성 전략

### 2.1 도메인 분포

| 규제 권역 | 질의 수 | 근거 |
|---|---|---|
| FDA (21 CFR, Guidance, 510(k) pathway) | 15 | handoff §3 주 대상 사용자는 FDA-first |
| EU MDR (Regulation 2017/745, MDCG 가이던스) | 15 | 두 번째 주요 권역, MDR 전환 이슈 현황성 |
| MFDS (한국 식약처, 의료기기법) | 10 | 국내 사용자 대상 + 한국어 citation 검증 |
| NMPA (중국) | 5 | 아시아 확장 시 필수 |
| PMDA (일본) | 5 | 아시아 확장 시 필수 |
| 내부 SOP (ISO 13485, ISO 14971) | 5 | internal corpus 검증 |
| **합계** | **55** | 50+ 목표 충족 |

### 2.2 시나리오 카테고리 (각 권역 내부)

| 카테고리 | 예시 질의 | 검증 대상 |
|---|---|---|
| Lookup (정의/조회) | "21 CFR 820.30 design controls 요구사항은?" | 정확한 citation, 고 confidence |
| Comparison (비교) | "FDA 510(k) vs EU MDR Class IIb 기술 문서 차이" | ComparisonTable 구조화 블록, 양측 citation |
| Timeline (일정) | "MDR 2017/745 transition deadline은?" | Timeline 블록, 정확한 날짜 |
| Checklist (절차) | "510(k) 제출 체크리스트는?" | Checklist 블록 ≥8 항목 |
| Edge (경계) | "Class I exempt device는 510(k) 없이 즉시 출시 가능한가?" | 예외 조항 정확한 인용 |
| Trap (오답 유도) | "21 CFR Part 11이 EU MDR에도 적용되나?" (false premise) | 오답 검출, 정정 citation, 저 confidence → expert review gating |
| Hallucination (거짓 선제) | "FDA guidance Q-Sub 2029는?" (존재하지 않는 문서) | "해당 문서를 찾을 수 없음" 응답, expert_review_required event |
| Korean (한국어) | "의료기기법 제6조 요약" | Korean citation, serif/sans 렌더링 |

### 2.3 정답 데이터 (ground truth) 구조

각 시나리오는 다음 필드를 포함한다:

```yaml
- id: FDA-001
  category: lookup
  input: "21 CFR 820.30 design controls의 핵심 요구사항 5가지는?"
  locale: en
  expected:
    must_include_citations:
      - source_id: "fda-21cfr-820"
        section: "820.30"
    must_not_include:
      - "invented regulation"
      - "hallucinated section number"
    confidence_min: 0.80
    expert_review_required: false
    block_types_expected: [prose, checklist, sources]
  rubric:
    faithfulness: "All 5 items match 820.30(a)-(j) actual text"
    citation_coverage: 1.0
```

### 2.4 RA 전문가 검수 프로세스

- 초기 55개 데이터셋 작성: `regula-rag-pipeline` agent가 draft 작성
- **RA 리드 검수 필수** (handoff §9.3 expert review와 동일 권위): Phase 6 kickoff 시 약 8시간 세션으로 검수
- 검수 결과 `tests/eval/datasets/REVIEWED.md`에 서명(이름 + 날짜) 기록
- 6개월 주기 재검수 (규제 문서 개정 반영)

### 2.5 재평가 조건

- 검수 후 시나리오 수 < 50이면 추가 작성 후 재검수
- Phase 6 first run에서 eval 통과율 < 50%면 규제 corpus 품질 재검토 (Phase 4 retriever tuning 이슈)

---

## 3. Citation Coverage 자동 측정

### 3.1 재사용 전략

Phase 2(CHAT) 구현의 `lib/rag/citation-parser.ts`(또는 동등 경로)는 이미 다음 기능을 제공한다:
- 응답 텍스트에서 `<sup class="cite">N</sup>` 마커 추출
- 각 N이 `sources` 배열의 유효 인덱스인지 검증
- Claim(문장 단위)별 citation 존재 여부 판정

promptfoo custom scorer는 이 parser를 import하여:
```ts
// tests/eval/scorers/citation-coverage.ts
import { parseCitations, claimsWithoutCitations } from '@/lib/rag/citation-parser';

export default async function citationCoverage({ output, test }) {
  const { claims, citations } = parseCitations(output.text);
  const uncitedClaims = claimsWithoutCitations(claims, citations);
  const coverage = 1 - uncitedClaims.length / claims.length;
  return {
    pass: coverage >= (test.vars.citationMin ?? 1.0),
    score: coverage,
    reason: `Citation coverage: ${coverage.toFixed(2)}. Uncited: ${uncitedClaims.length}`,
  };
}
```

### 3.2 Hallucination Rate

Hallucination 지표는 다음 조합으로 측정:
- `must_not_include` 키워드 포함 시 hallucination 발생
- citation이 실제 `sources[N]`에 존재하지 않으면 hallucination
- Sonnet-as-judge(Claude Sonnet 4.5)에 faithfulness 0-1 점수 요청 (RAGAS faithfulness 패턴)

목표: hallucination rate ≤ 2% (55개 중 최대 1개)

### 3.3 Confidence Calibration

- 정답 있는 케이스: confidence ≥ 0.80 목표
- 오답/hallucination 유도 케이스: confidence < 0.70 + `expert_review_required: true` 목표
- Calibration curve: 실제 정답률 vs 예측 confidence Brier score ≤ 0.15

---

## 4. Playwright E2E 구성

### 4.1 테스트 범위 (handoff §17)

handoff §17이 명시한 core flows:
1. **login** — SSO 버튼 클릭 → OIDC 플로우 → `/` 도달
2. **new consultation** — 질의 입력 → 스트리밍 → prose + citations 표시
3. **citation click** — `<sup>` 클릭 → DocViewer 슬라이드 → `#source=N&offset=M` 앵커 확인
4. **expert review request** — 저 confidence 응답 → `expert_review_required` 배지 → 리드 큐 등록
5. **project switch** — 프로젝트 셀렉터 변경 → 대화 보존 + context 반영

이 5개 + a11y + i18n + project-switch = **7개 spec 파일**.

### 4.2 Browser Matrix

| Browser | 우선순위 | 근거 |
|---|---|---|
| Chromium | P0 | 주 사용자 브라우저, RSC/SSE 안정 |
| Firefox | P0 | ESR(기업 환경) 호환성 |
| Webkit | P1 | macOS Safari 15%+ 사용자 |

### 4.3 Flakiness 방지 전략

- SSE 스트림 대기는 fixed timeout 금지, `page.waitForResponse(/\/api\/ra\/consult$/)` + custom event listener
- citation `<sup>` 클릭 전 `expect(page.locator('sup.cite')).toHaveCount({ min: 1 })` 가드
- expert review 시나리오는 LLM 호출 대신 **MSW로 SSE 이벤트 모킹** (재현성 확보)
- a11y spec은 `@axe-core/playwright`의 `include`로 route-level 고정

### 4.4 재평가 조건

- Webkit pass rate < 90%면 macOS CI runner 확보 후 재평가
- 실 LLM 호출 flakiness 심화 시 MSW 기반 recorded fixtures로 전환

---

## 5. Load Testing 도구 (k6 vs Artillery)

### 5.1 비교

| 항목 | k6 | Artillery |
|---|---|---|
| 언어 | JavaScript (ES6) | YAML + JavaScript |
| SSE 지원 | 네이티브 `k6/net/http` stream | plugin 필요 |
| Cloud 리포팅 | Grafana Cloud k6 (free tier) | Artillery Cloud |
| CI 통합 | `k6 run --out json` → 파싱 용이 | similar |
| 커뮤니티 | 큰 편 | 중간 |
| Anthropic rate limit 대응 | custom sleep/ramp-up stage 쉬움 | similar |

### 5.2 선정: **k6**

JavaScript 친화성 + SSE 네이티브 + Grafana Cloud 무료 티어. Artillery는 대안으로 유지하되 기본은 k6.

### 5.3 시나리오 설계

```js
// tests/load/k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    steady_50: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // ramp-up
        { duration: '5m', target: 50 },   // steady
        { duration: '1m', target: 0 },    // ramp-down
      ],
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 }, // spike to 100
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      startTime: '10m',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:consult_first_token}': ['p(95)<1500'],
    'http_req_duration{endpoint:consult_full}': ['p(95)<8000'],
    'http_req_failed': ['rate<0.01'],
  },
};
```

### 5.4 Anthropic Rate Limit 우회

Phase 6 load test는 production key를 사용하지 않고 **load test 전용 API key** (quota 분리, Anthropic enterprise console에서 조직 분리 설정) 또는 **MSW-backed mock SSE** 두 가지 모드를 지원한다. CI는 mock 모드 기본 실행, staging deploy pre-launch는 실제 API 1회 실행.

---

## 6. Security Review 프레임워크

### 6.1 OWASP Top 10 (2025) 매핑

| OWASP ID | 위협 | Regula 대응 | Phase 1-5 구현 | Phase 6 추가 검증 |
|---|---|---|---|---|
| A01 Broken Access Control | RBAC 우회 | Auth.js v5 + middleware + Drizzle query guard (ENTERPRISE Phase 5) | ✅ | Playwright 음성 테스트 (다른 org 세션으로 API 호출 → 403) |
| A02 Cryptographic Failures | TLS/시크릿 노출 | Vercel HSTS + env secret + rotate quarterly | ✅ | secret scanning (gitleaks) CI |
| A03 Injection | SQL/Command/Prompt | Drizzle parameterized + Zod + prompt injection red-team | ✅ | promptfoo red-team suite |
| A04 Insecure Design | 아키텍처 결함 | 보안 설계 리뷰 (regula-architect) | — | OWASP threat model 문서화 |
| A05 Security Misconfiguration | CSP/헤더 누락 | next.config.mjs CSP nonce + headers | ✅ (Phase 1) | Mozilla Observatory 스캔 + ≥ A 등급 |
| A06 Vulnerable Components | 의존성 취약점 | Dependabot | 부분 | `pnpm audit` High/Critical = 0 CI gate |
| A07 Auth Failures | 세션 관리 | Auth.js 세션 30min idle timeout | ✅ | session hijack 시뮬 Playwright |
| A08 Software/Data Integrity | CI 공급망 | GitHub Actions OIDC, SLSA level 2 목표 | 부분 | CI publish 시 artifact signing |
| A09 Logging/Monitoring | 감사 누락 | append-only audit_logs (FOUNDATION) + Sentry (ENTERPRISE) | ✅ | audit_logs INSERT-only 정적 테스트 (Phase 6 재검증) |
| A10 SSRF | 외부 요청 검증 | 외부 도메인 화이트리스트 + DNS rebind 방지 | 부분 | SSRF 페이로드 테스트 |

### 6.2 21 CFR Part 11 적합성 재검증

FOUNDATION Phase에서 구현한 append-only `audit_logs`와 ENTERPRISE Phase의 7-year retention을 Phase 6에서 정적 + 동적 검증:
- 정적: migration 파일 trigger SQL inspection
- 동적: `UPDATE/DELETE/TRUNCATE audit_logs` 시도 → 모두 오류 반환 확인
- Retention: `pg_partition` 설정 확인 (또는 대안 archive job)

### 6.3 재평가 조건

- OWASP Top 10 2028 개정 시 매핑 재작성
- 외부 pen-test (optional, post-launch) 결과에 따라 Post-launch SPEC 발행

---

## 7. Production Deployment (Vercel)

### 7.1 Vercel Edge Functions 제약

handoff §18은 Vercel을 명시하나, Next.js 15 Route Handlers의 runtime 선택은 함수별로 다르다:

| Route | Runtime | 근거 |
|---|---|---|
| `/api/ra/consult` | **nodejs** | pgvector 쿼리 + Anthropic SDK 장시간 스트림. Edge는 CPU time 제약 (~30s) 있으므로 Node runtime 60s timeout |
| `/api/ra/conversations` (paginated list) | edge | 단순 DB read, 저지연 이점 |
| `/api/ra/updates` (feed) | edge | ISR 캐시 가능 |
| `/api/ra/expert-review` | nodejs | write + 알림 트리거 |
| `/api/admin/ingest/*` | nodejs | 장시간 작업, Inngest로 enqueue 후 즉시 리턴 |

### 7.2 Vercel 설정

```json
// vercel.json
{
  "regions": ["iad1", "fra1"],  // US-East + EU-West (data residency)
  "functions": {
    "app/api/ra/consult/route.ts": { "maxDuration": 60 },
    "app/api/admin/ingest/*/route.ts": { "maxDuration": 300 }
  },
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }] }
  ]
}
```

### 7.3 Data Residency (EU 고객)

handoff §16 명시: "EU customers → EU-only hosting". Vercel region pinning + Neon EU branch:
- 기본: `iad1` + Neon `aws-us-east-1`
- EU org flag: org에 `region: eu` 플래그 → Vercel Middleware가 `fra1`로 라우팅 + Neon `aws-eu-central-1` 브랜치 사용

Phase 6은 US region만 런치 범위. EU residency는 **Post-launch GA로 이관** (본 SPEC Out of Scope에 명시).

### 7.4 환경변수 매트릭스

| 변수 | dev | preview | production |
|---|---|---|---|
| `DATABASE_URL` | local postgres | Neon preview branch | Neon prod |
| `AUTH_SECRET` | .env.local | Vercel env | Vercel env (rotated quarterly) |
| `ANTHROPIC_API_KEY` | dev key (low quota) | preview key | prod key + ZDR |
| `LANGFUSE_SECRET_KEY` | dev instance | preview | prod |
| `SENTRY_DSN` | (none) | preview env | prod env |
| `NEXTAUTH_URL` | http://localhost:3000 | preview URL | https://regula.{domain} |

---

## 8. Database Hosting 결정 (Neon vs Supabase vs RDS)

### 8.1 비교

| 항목 | Neon | Supabase | AWS RDS |
|---|---|---|---|
| pgvector | ✅ | ✅ | ✅ (수동 설치) |
| Serverless | ✅ (auto-suspend) | ❌ (always-on) | ❌ |
| Branching (DB per preview) | ✅ | ❌ | ❌ |
| HIPAA/SOC2 | SOC2 Type II, HIPAA BAA (Enterprise tier) | SOC2, HIPAA BAA (Team+) | HIPAA eligible |
| Region 다양성 | AWS + Azure, US/EU/AP | AWS, US/EU/AP | AWS 전 region |
| Vercel 통합 | native partner | native partner | 수동 |
| 21 CFR Part 11 | 별도 eval | 별도 eval | 별도 eval |

### 8.2 선정: **Neon**

- Branching 기능으로 Vercel preview 브랜치마다 격리된 DB (migration 테스트 안전)
- Serverless auto-suspend로 비용 효율
- Enterprise tier에서 HIPAA BAA 제공 (미래 PHI 취급 대비)
- Vercel native integration (env auto-injection)

### 8.3 Phase 6 이전에 확정 필요

DB 선정은 ENTERPRISE Phase 5의 RBAC/data residency 요건이 결정된 후 최종 확정되어야 한다. Phase 6 kickoff 시점에 DB provider가 확정되지 않으면 Phase 6 deploy가 블록된다. 본 SPEC은 Neon을 **권장 선택**으로 명시하되, Phase 5 → Phase 6 전환 게이트에서 `regula-architect`의 최종 승인을 받는다.

### 8.4 재평가 조건

- Neon vendor lock-in 부담 증가 시 RDS + pgvector 셀프 호스팅으로 마이그레이션 (Drizzle는 DB-agnostic)
- 코퍼스 > 50M 청크 시 pgvector 성능 재측정 후 별도 vector DB 검토

---

## 9. CI/CD 파이프라인

### 9.1 GitHub Actions 매트릭스

```yaml
# .github/workflows/ci.yml
jobs:
  lint:
    steps: [pnpm install --frozen, pnpm biome check, pnpm typecheck]
  unit:
    steps: [pnpm test:unit -- --coverage]
    gate: coverage ≥ 80%
  integration:
    services: [postgres:16 with pgvector]
    steps: [pnpm test:integration]
  e2e:
    strategy:
      matrix: { browser: [chromium, firefox, webkit] }
    steps: [pnpm playwright test --project=${{ matrix.browser }}]
  eval:
    if: github.event_name == 'pull_request'
    steps: [pnpm eval:ci]
    gate: citation coverage = 100%, hallucination ≤ 2%
  security:
    steps: [pnpm audit --audit-level=high, gitleaks detect]
    gate: 0 High/Critical
  build:
    needs: [lint, unit, integration]
    steps: [pnpm build]
```

### 9.2 Deployment Gate

production 배포 조건:
- 모든 CI 매트릭스 green
- manual approval (GitHub environment protection rule)
- 최근 7일간 staging 에러 rate < 0.5%
- Langfuse eval dashboard citation coverage ≥ 98%

### 9.3 Rollback 전략

- Vercel: `vercel rollback` 즉시 이전 deployment 복원
- DB migration: Drizzle Kit migration에 down script 1주일 유지 (handoff §18)
- Feature flag: 문제 발생 feature를 Statsig/Vercel Flags로 즉시 off

---

## 10. Documentation 구성

### 10.1 FOUNDATION REQ-FND-060 확장

FOUNDATION Phase 1 REQ-FND-060은 `DEVELOPMENT.md`가 5개 섹션을 포함하도록 규정했다:
1. Prerequisites
2. Setup
3. Development workflow
4. Testing
5. Deployment

Phase 6에서는 여기에 다음 섹션 추가:
6. Troubleshooting (자주 발생하는 에러 + 대응)
7. Architecture overview (Phase 2~5 결과 반영)
8. Compliance overview (21 CFR Part 11 + OWASP 준수 요약)

### 10.2 신규 문서

| 문서 | 대상 독자 | 내용 |
|---|---|---|
| `README.md` | 외부 사용자, RA 리드 | Regula 소개, 주요 기능, 스크린샷 |
| `docs/architecture.md` | 엔지니어 (on-boarding) | mermaid 시스템 다이어그램, 데이터 플로우 |
| `docs/runbook.md` | On-call 엔지니어 | incident response, 알림 대응, 롤백 절차 |
| `docs/compliance.md` | QA/감사 | 21 CFR Part 11 체크리스트, retention, audit trail 접근 |
| `docs/api-reference.md` | 엔지니어 | `/api/ra/*` 엔드포인트 + Zod 스키마 |
| `DEVELOPMENT.md` (확장) | 엔지니어 | 위 8개 섹션 |
| `CHANGELOG.md` | 전원 | Phase 1-6 변경 이력 |

### 10.3 다국어 지원

- `README.md`와 `docs/`는 **영문 primary**, 한국어 번역은 Post-launch
- UI 사용자 매뉴얼은 한국어/영어 양쪽 (i18n breadth Phase 5 범위)
- 본 SPEC(Phase 6)의 **DEVELOPMENT.md는 영문 only**

---

## 11. Launch Readiness Gate (사전 조사)

### 11.1 Gate 범주

Phase 6 완료 = production deployment = 다음 6개 범주 100% 통과:

1. **Functional**: 모든 E2E green, 5개 core flow 통과
2. **Quality**: unit ≥ 80%, integration 100%, a11y 0 violation
3. **LLM**: eval citation coverage = 100%, hallucination ≤ 2%, calibration Brier ≤ 0.15
4. **Performance**: LCP ≤ 2.0s, INP ≤ 200ms, first token P95 ≤ 1.5s @ 50 VU
5. **Security**: OWASP Top 10 all N/A or mitigated, 0 High/Critical deps, audit trail verified
6. **Operational**: runbook.md 존재, on-call 교대 설정, Sentry/Langfuse 알림 정상

### 11.2 Go/No-Go 결정권자

- **Go**: QA lead (manager-quality role) + Product owner (handoff 저자) + Compliance lead
- **No-Go**: 위 3인 중 1인이라도 거부하면 차기 이터레이션으로 연기

---

## 12. 리스크 레지스터

| ID | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R-01 | Eval 데이터셋 정답 품질 부정확 → 사일런트 regression | High | RA 리드 검수 + 6개월 재검수 주기 |
| R-02 | Load test에서 Anthropic API rate limit hit | Medium | 전용 load test API key + MSW mock mode |
| R-03 | Vercel Edge runtime의 pgvector 비호환 | Medium | consult 라우트는 nodejs runtime 강제 |
| R-04 | Neon prod DB migration 순서 오류로 downtime | High | Neon branch에서 dry-run → 성공 시 prod apply |
| R-05 | Playwright webkit flakiness | Low | webkit 실패는 warning only, Chromium+Firefox 필수 pass |
| R-06 | 시크릿 commit 누락 | Critical | gitleaks CI + pre-commit hook 이중 방어 |
| R-07 | 배포 후 citation coverage 실측 < 98% (운영 환경에서 regression) | High | Langfuse 대시보드 상시 모니터링 + 자동 alert |
| R-08 | DB provider (Neon) 확정 지연 → Phase 6 착수 블록 | High | Phase 5 closing 2주 전 Neon 계약 체결 |

---

## 13. Non-Obvious Constraints 매트릭스 (Phase 6 초점)

CLAUDE.md에서 명시한 7개 Non-Obvious Constraints 중 Phase 6에서 **재검증 필수**인 항목:

| # | 제약 | Phase 6 재검증 방법 |
|---|---|---|
| 1 | Citation 100% 강제 | promptfoo citation coverage scorer에서 100% gate |
| 2 | Multi-phase streaming | E2E에서 SSE event type 7종 (trace/prose_delta/confidence/sources/checklist/comparison/timeline/related/expert_review_required/done/error) 전부 수신 검증 |
| 3 | Expert review auto-flagging | eval trap 시나리오 (저 confidence) → `expert_review_required: true` 100% 검출 |
| 4 | Audit logging (21 CFR Part 11) | 정적: trigger SQL inspection, 동적: UPDATE/DELETE/TRUNCATE 시도 전부 오류, 7-year retention partition 설정 확인 |
| 5 | Serif 타이포그래피 | a11y spec에서 H1, DocViewer body, stat value, chat user question, quoted regulation text의 computed font-family에 `Source Serif 4` 포함 확인 |
| 6 | Korean + English 이중 | i18n spec에서 한↔영 전환 후 Noto Serif KR / Pretendard 로딩 확인 |
| 7 | noindex (prod 검증) | `curl https://regula.{domain}/` → `x-robots-tag: noindex, nofollow`. `curl https://regula.{domain}/login` → robots meta `index, follow` |

---

## 14. 결론 및 권고

1. **LLM Eval**: promptfoo 선정, 55개 시나리오 (FDA 15 + MDR 15 + MFDS 10 + NMPA 5 + PMDA 5 + 내부 SOP 5), RA 리드 검수 필수
2. **E2E**: Playwright 3 browser matrix (Chromium/Firefox/Webkit), 7개 spec 파일
3. **Load**: k6, 50 VU steady 5분 + 100 VU spike, first token P95 ≤ 1.5s gate
4. **Security**: OWASP Top 10 전체 매핑, gitleaks + pnpm audit CI, audit trail 재검증
5. **Deploy**: Vercel multi-region(iad1+fra1 준비, Phase 6은 iad1만 activate), Neon DB
6. **Docs**: DEVELOPMENT.md 확장(8 섹션) + README + architecture + runbook + compliance

Phase 6은 **신규 비즈니스 로직 구현이 아닌 quality gating**이다. 본 SPEC은 구체적 gate 조건과 launch readiness checklist를 정량적으로 명시하여 "subjective launch OK" 실수를 방지한다.

---

Version: 1.0.0
Created: 2026-04-22
Author: manager-spec
