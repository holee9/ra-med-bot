# Research — SPEC-REGULA-QUALITY-001

본 문서는 SPEC-REGULA-QUALITY-001 작성을 위해 수행한 코드베이스 분석 결과(Verified Quality Gaps)와 그 근거를 기록한다. spec.md/plan.md/acceptance.md 의 모든 요구사항은 본 분석에서 도출되었다.

조사 일자: 2026-05-04
조사자: drake.lee (manager-spec)
조사 범위: D:/workspace-github/ra-med-bot

---

## 1. Verified Quality Gaps

### Q-1: RAG Corpus Data Empty

**증거**

- 스키마: `lib/db/schema.ts` line 298 — `sourceSections` pgTable 정의, `embedding vector(1536)` 컬럼 존재
- 스키마 주석 line 10 — `source_sections` 가 핵심 테이블 중 하나로 명시
- 5개 코퍼스 리트리버 존재:
  - `lib/ai/retrievers/fda.ts`
  - `lib/ai/retrievers/eu-mdr.ts`
  - `lib/ai/retrievers/mfds.ts`
  - `lib/ai/retrievers/nmpa.ts`
  - `lib/ai/retrievers/pmda.ts`
- 하이브리드 검색: `lib/ai/retrievers/hybrid-search.ts` (pgvector cosine + Postgres FTS)
- 시드 스크립트 부재: `package.json` 에 `db:seed*` 스크립트 grep 결과 0건

**결론**: 스키마와 검색 인프라는 존재하나, `source_sections` 를 채우는 시드 메커니즘이 없다. 시스템이 graceful degradation 으로 "정보 없음" 만 반환하는 상태.

**대응**: REQ-QUAL-001 ~ 005 (Group A — Corpus Seed)

### Q-2: promptfoo eval:ci Cannot Pass Without Corpus

**증거**

- `package.json` line 39: `"eval:ci": "promptfoo eval --config tests/eval/promptfoo.config.yaml --output json"`
- 평가 데이터셋 6종 존재: `tests/eval/datasets/{fda,eu-mdr,mfds,nmpa,pmda,internal-sop}.yaml`
- promptfoo 의존성: `node_modules/promptfoo` 설치 확인
- Q-1 의 결과로 코퍼스가 비어있다면, 모든 시나리오가 confidence threshold 미달

**결론**: 평가 하네스는 구축되어 있으나, 시드 데이터 부재로 실제 통과 보장 불가.

**대응**: REQ-QUAL-006 ~ 010 (Group B — Eval Pipeline) — Group A 후행 의존

### Q-3: Cloudflare Vectorize TODO Unresolved

**증거**

- `lib/ai/hybrid-router.ts` line 142: `// TODO: implement with VectorizeIndex binding in Workers runtime`
- line 137~145 의 `retrieveVectorize` 함수가 빈 배열만 반환 — 사실상 스텁
- line 143 주석: `// For now returns empty array — real implementation added in Task 6`
- Vectorize 어댑터 파일 존재: `lib/ai/retrievers/vectorize-{fda,eu-mdr,mfds,nmpa,pmda}.ts`
- pgvector 폴백은 `lib/ai/retrievers/hybrid-search.ts` 가 담당

**결론**: 어댑터 파일은 있으나 라우터 분기는 미배선. 환경 변수 미설정 시 자동 폴백 동작이 코드/문서 어디에도 명시되지 않음.

**대응**: REQ-QUAL-011 ~ 014 (Group C — Cloudflare Fallback) — TODO 해소 + 폴백 명시화

### Q-4: Document Ingestion UI Wiring Unverified

**증거**

- 관리자 페이지 존재:
  - `app/(app)/admin/documents/page.tsx` (목록)
  - `app/(app)/admin/documents/upload/page.tsx` (업로드 폼)
  - `app/(app)/admin/documents/[id]/page.tsx` (상세)
- API 라우트 존재: `app/api/ra/sources/[id]/route.ts`
- Ingest 파이프라인 존재:
  - `lib/ingest/extract/` (텍스트 추출)
  - `lib/ingest/pii/` (PII 마스킹)
  - `lib/ingest/chunkers/` (청크 분할)
  - `lib/ingest/embed.ts` (임베딩)
  - `lib/ingest/sources/` (DB 적재)
- 별도 SPEC `SPEC-REGULA-DOCINGEST-001` 존재 — 관련 작업이 일부 진행되었을 가능성

**결론**: 컴포넌트는 모두 존재하나, 업로드 폼 → ingest 파이프라인 → `source_sections` 적재의 엔드투엔드 연결과 RBAC 차단/에러 처리가 검증되지 않음.

**대응**: REQ-QUAL-015 ~ 019 (Group D — DocIngest E2E)

### Q-5: Security Headers E2E Uncertain in CI

**증거**

- 보안 헤더 E2E 테스트 존재(이름 패턴 `security-headers`) — 사용자 보고 기반
- Edge middleware 가 `/api/ra/*` 헤더 적용을 담당할 것으로 추정
- `dev` vs `production build` 에서 미들웨어 동작 차이로 CI 결과 비결정성 발생 가능

**결론**: 테스트 자체는 있으나 production build 기준 CI 통과 여부 미확인. 4개 헤더(CSP nonce, X-Frame-Options DENY, HSTS, X-Content-Type-Options) 각각의 검증 강도도 보강 필요.

**대응**: REQ-QUAL-020 ~ 023 (Group E — Security Headers)

### Q-6: Admin RBAC Coverage Incomplete

**증거**

- `scripts/qa/check-rbac.mjs` 존재 — 사용자 보고
- `scripts/qa/rbac-coverage.ts` 와 `scripts/qa/rbac-whitelist.json` 존재 — directory listing 으로 확인
- admin 라우트 4종 존재(Q-4 참고) — whitelist 포함 여부 검증 필요

**결론**: RBAC 매트릭스 도구는 있으나, admin 문서 라우트가 커버리지에 모두 포함됐는지 확인이 필요하며 신규 라우트 추가 시 자동 탐지 로직 점검 필요.

**대응**: REQ-QUAL-024 ~ 025 (Group F — Admin RBAC)

---

## 2. Dependency Status (Important)

사용자 요청에 명시된 의존 SPEC 의 현재 상태:

| SPEC                                | 디렉토리 존재 | 파일 존재               | 상태             |
| ----------------------------------- | ------------- | ----------------------- | ---------------- |
| `SPEC-REGULA-RELEASE-GATE-001`      | ✅ 존재       | ❌ 빈 디렉토리          | 미작성/미시작    |
| `SPEC-REGULA-RELEASE-HARDENING-001` | ❌ 없음       | —                       | 존재하지 않음    |

**보고 사항**: spec.md frontmatter 의 `depends_on` 필드는 사용자 의도대로 명시했으나, 두 의존 SPEC 모두 현재 워크스페이스에 실재 콘텐츠가 없거나 디렉토리만 존재한다. 본 SPEC 의 Run 단계 진입 전에 다음 중 하나가 필요:

1. `SPEC-REGULA-RELEASE-GATE-001` 과 `SPEC-REGULA-RELEASE-HARDENING-001` 을 먼저 작성/완료
2. 의존 관계를 재정의 (예: 병렬 진행 또는 의존 제거)
3. 사용자가 명시적으로 "선행 SPEC 미완료 상태에서 본 SPEC 진행" 을 승인

이는 manager-spec 단계의 차단 사항으로 사용자(orchestrator) 에게 보고된다.

---

## 3. Code Pointers (Reference)

| 영역                | 파일                                                           | 라인 / 비고                                  |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| pgvector 스키마     | `lib/db/schema.ts`                                             | line 298 (sourceSections), line 39 (vector type) |
| 하이브리드 라우터   | `lib/ai/hybrid-router.ts`                                      | line 142 (Vectorize TODO)                    |
| 하이브리드 검색     | `lib/ai/retrievers/hybrid-search.ts`                           | pgvector + FTS                               |
| Vectorize 어댑터    | `lib/ai/retrievers/vectorize-*.ts`                             | 5개 파일                                     |
| Ingest 파이프라인   | `lib/ingest/{extract,pii,chunkers,embed,sources}.ts`           | 모듈별 분리                                  |
| 관리자 UI           | `app/(app)/admin/documents/{,upload/,[id]/}page.tsx`           | 3개 라우트                                   |
| 평가 설정           | `tests/eval/promptfoo.config.yaml`                             | 6 datasets                                   |
| 평가 데이터셋       | `tests/eval/datasets/{fda,eu-mdr,mfds,nmpa,pmda,internal-sop}.yaml` | 55 시나리오 (사용자 보고)                |
| RBAC 검증           | `scripts/qa/{check-rbac.mjs,rbac-coverage.ts,rbac-whitelist.json}` | 3개 자산                                  |
| package.json 스크립트 | `package.json`                                                 | line 39 `eval:ci`                            |

---

## 4. Out-of-Scope Items Considered and Excluded

조사 중 식별되었으나 본 SPEC 범위에서 제외한 항목:

| 항목                                  | 사유                                                              | 향후 SPEC 후보                       |
| ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| WHO/IMDRF 등 신규 코퍼스             | 5개 코퍼스 안정화가 우선                                          | SPEC-REGULA-CORPUS-EXPANSION-001 (가칭) |
| 임베딩 모델 변경                      | 1536-d 스키마 호환성 유지 필요                                    | SPEC-REGULA-EMBEDDING-V2-001 (가칭)  |
| Vectorize 실제 구현                   | Workers 런타임 검증 별도 트랙 필요                                | SPEC-REGULA-CLOUDFLARE-002 (가칭)    |
| 관리자 UI 디자인 개편                 | 기능 검증 우선                                                    | SPEC-REGULA-ADMIN-UX-001 (가칭)      |
| RBAC 정책 확장 (신규 role)           | TENANT-001 v2 와 통합 설계 필요                                   | SPEC-REGULA-TENANT-002 (진행 중)     |
| 검색 성능 튜닝 (인덱스, 캐시)         | 우선 정확성 확보 후 측정 기반 최적화                              | SPEC-REGULA-PERF-001 (가칭)          |

---

## 5. Open Questions for User

orchestrator 에게 보고가 필요한 사항(AskUserQuestion 후보):

1. 의존 SPEC 미완 상태에서 본 SPEC 진행 가능 여부
2. 시드 데이터 라이선스(공개 규제 문서 직접 인용)에 대한 법무 리뷰 필요 여부
3. eval 통과 임계값 80% 의 적정성(완화/강화 여부)
4. CI 환경에서 promptfoo 실행 시 사용할 LLM provider/예산 정책
