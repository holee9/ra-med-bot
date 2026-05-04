---
id: SPEC-REGULA-DOCINGEST-001
title: Regula Phase 8 Document Ingestion — 인증 문서·제출 자료 수집·분류·PII redact·Tenant 격리
status: completed
created: 2026-04-22
updated: 2026-05-04
author: manager-spec
phase: 8
skill: regula
version: 1.0.0
priority: High
issue_number: 10
revision_history:
  - version: 1.0.0
    date: 2026-05-04
    author: manager-docs
    notes: |
      Implementation complete. 78/78 REQ-DOC implemented across 8 groups.
      Commits: 5f8c9df (Phase 8A+8B), 4500868 (Phase 8C-8E).
      Tests: 1622 total (1616 pass, 6 skip). tsc --noEmit: 0 errors.
      Key deliverables: 3-layer PII redaction, DB-level tenant isolation (RLS),
      8-class × 4-role ACL matrix, 14 class-specific chunkers, hybrid search
      retriever P95 < 300ms, Admin Portal 3 pages, Inngest pipeline.
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial draft. 78 REQ-DOC across 8 groups (A Classification / B Ingestion
      Sources / C PII Redaction / D Schema Migration / E Chunking / F ACL / G
      Retrieval Integration / H Admin UI). 10 technical decisions captured in
      research.md. Depends on FOUNDATION-001 v0.4.0 (13-table baseline, audit
      pgEnum), BREADTH-001 v0.2.0 (retriever pattern, router), ENTERPRISE-001
      v0.2.0 (RBAC, withPermission, audit completeness gate), LAUNCH-001 v0.1.0
      (launch readiness), CLOUDFLARE-001 (R2 + optional Vectorize, parallel SPEC).
related_handoff_sections:
  - "§4"
  - "§5"
  - "§11"
  - "§12"
  - "§16"
  - "§17"
  - "§20"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-BREADTH-001 (v0.2.0+)
  - SPEC-REGULA-ENTERPRISE-001 (v0.2.0+)
  - SPEC-REGULA-LAUNCH-001 (v0.1.0+)
  - SPEC-REGULA-CLOUDFLARE-001 (parallel — R2 + Email Workers dependency)
---

# SPEC-REGULA-DOCINGEST-001 — Regula Phase 8 Document Ingestion

## 목적 (Purpose)

조직이 보유한 **인증 문서**(FDA 510(k) 승인서, CE Certificate of Conformity, MFDS
허가서, ISO 13485 인증서)와 **제출 자료**(승인된 510(k) dossier, EU MDR Technical
Documentation, CER, PER, CSR, GSPR 체크리스트, PMS·PSUR·MDR report, QMS SOP, FDA
483 응답 등)를 안전하게 수집·분류·인덱싱하여 Regula RAG retrieval의 확장 대상에
편입시키고, 차기 제출 초안 생성(Phase 9)의 기반 데이터층을 구축한다.

Phase 8은 Phase 2(FDA 공개 corpus), Phase 4(EU MDR·MFDS·NMPA·PMDA·Internal SOP
공개 corpus)와 구분되는 **조직 내부 민감 문서** 영역을 개척한다. 민감 데이터의
특수성으로 다음 4개 축이 Day-1 필수 요구사항이다:

1. **8-class 문서 분류 체계** — 인증서·성공 제출·심사중·임상 보고·체크리스트·
   시판 후 감시·SOP·감사 대응 — 각각 고유 ACL 기본값, chunking 전략, PII 민감도,
   metadata schema를 가진다.

2. **3-layer PII Redaction 파이프라인** — HIPAA Safe Harbor 18 identifier를
   (a) Regex fast-path, (b) Cloudflare Workers AI GLiNER, (c) Presidio
   (`critical_phi_mode` 문서만) 순차 적용. 원본은 R2 encrypted retention,
   검색 인덱스는 redacted만. redaction_map은 별도 private schema + AES-256-GCM
   + RLS + pii_admin_role 분리로 이중 방어.

3. **DB-level Tenant Isolation** — Postgres RLS + pgvector WHERE filter로
   organization_id 기반 행 수준 접근 통제. application-layer 실수 시에도 DB가
   차단. SQL injection / ORM bug 방어의 최종 보루.

4. **Role × Document-class × Project ACL 매트릭스** — ENTERPRISE Phase 5 RBAC
   4-role (admin / ra-lead / ra-member / viewer) × 8 document class × project
   scope 2-tier. 모든 document access는 audit_logs에 `document.access` enum으로
   기록 (FOUNDATION audit_action enum에 선제 선언되어 있음, 본 Phase에서 wiring).

후속 보강이 극히 어려운 제약은 본 Phase에서 Day-1로 확보해야 한다(특히 RLS 정책
뒤늦게 도입 시 기존 쿼리 전수 재검증, PII redaction 누락 시 원본 파기 불가,
redaction_map 암호화 누락 시 재암호화 migration 복잡). Phase 8은 Phase 9(제출
초안 자동 생성 워크플로우), Phase 11(network intelligence aggregate) 등 후속 조직
문서 소비자의 기반이다.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| Document classification | `lib/ingest/doc-classifier.ts` (MVP 사용자 수동 분류 + 휴리스틱 추천), `lib/ingest/doc-class.ts` (8-class enum + label + default ACL + PII sensitivity mapping) |
| DB schema (4 신규 테이블 + 1 신규 schema) | `lib/db/schema-docingest.ts` (organization_documents, document_chunks, document_access_policies, redaction_maps), `migrations/0010_docingest.sql` (테이블 + 3 pgEnum + HNSW index), `migrations/0011_docingest_rls.sql` (RLS 정책 + private schema + role GRANT/REVOKE + AES 암호화 함수) |
| Audit enum 확장 | `lib/audit.ts` `AuditAction` TypeScript union 확장 (6 신규 값 — `document.upload`, `document.access`, `document.redact`, `document.chunk`, `document.search`, `redaction_map.access`). FOUNDATION v0.4.0 REQ-FND-049 audit_action pgEnum에 `ALTER TYPE audit_action ADD VALUE` 6회 migration |
| Ingestion sources (5 handlers) | `lib/ingest/sources/google-drive.ts` (OAuth + files.watch + delta sync), `lib/ingest/sources/sharepoint.ts` (Microsoft Graph + delta query), `lib/ingest/sources/dropbox.ts` (files.list_folder/continue), `lib/ingest/sources/email-workers.ts` (Cloudflare Email Workers MIME parse + 첨부 추출), `lib/ingest/sources/manual-upload.ts` (R2 presigned URL flow) |
| PII redaction (3-layer) | `lib/ingest/pii/regex.ts` (Layer 1 — SSN / email / phone / CC / URL), `lib/ingest/pii/workers-ai.ts` (Layer 2 — Cloudflare Workers AI GLiNER + llama-guard), `lib/ingest/pii/presidio.ts` (Layer 3 — separate Lambda/Cloud Run wrapper, critical PHI only), `lib/ingest/pii/policy-by-class.ts` (class별 sensitivity level + custom recognizer 등록), `lib/ingest/pii/redaction-map.ts` (AES-256-GCM + private schema INSERT) |
| Chunking (14 class-specific + 1 generic) | `lib/ingest/chunkers/index.ts` (registry), `lib/ingest/chunkers/base.ts`, `submission-510k.ts`, `submission-eu-mdr.ts`, `submission-mfds.ts`, `cer-meddev.ts`, `per.ts`, `csr-ich-e3.ts`, `certificate.ts`, `checklist-template.ts`, `pms-psur.ts`, `mdr-report.ts`, `sop-iso13485.ts`, `fda-483-response.ts`, `mdsap-capa.ts`, `generic.ts` (fallback) |
| Text extraction | `lib/ingest/extract/pdf.ts` (`pdf-parse` 기반), `lib/ingest/extract/docx.ts` (`mammoth`), `lib/ingest/extract/xlsx.ts` (`exceljs`), `lib/ingest/extract/zip.ts` (안티 압축 폭탄 검증), `lib/ingest/extract/index.ts` (MIME 기반 dispatcher), OCR은 `quarantine` 처리 |
| ACL matrix | `lib/acl/document-acl.ts` (Role × Class × Project 매트릭스 계산), `lib/acl/default-policies.ts` (8-class 별 default policy seed), `lib/acl/with-document-permission.ts` (Route Handler 미들웨어 — ENTERPRISE withPermission 확장) |
| Retrieval integration | `lib/ai/retrievers/internal-docs.ts` (신규 — `withTenantScope` + ACL 필터), `lib/ai/router.ts` 확장 (intent 매핑 public + org 병행, 2 신 intent 추가), `lib/ai/merge.ts` 확장 (citation prefix `org:` 지원), `lib/ai/citation-enforce.ts` 확장 (조직 citation 형식 검증) |
| Admin UI (3 pages) | `app/(app)/admin/documents/page.tsx` (목록 + 필터 by class/project/status), `app/(app)/admin/documents/upload/page.tsx` (R2 presigned URL flow + class 선택 + metadata 입력), `app/(app)/admin/documents/[id]/page.tsx` (상세 + metadata 편집 + redaction 미리보기 + 수동 재처리) |
| Admin UI 미들웨어 | `middleware.ts` 확장 (`/admin/*` 경로는 admin + ra-lead만 접근), `app/(app)/admin/layout.tsx` (noindex + noarchive + nosnippet 메타 강화) |
| Inngest 워크플로우 | `lib/inngest/docingest/upload-processed.ts` (R2 업로드 완료 이벤트 → 텍스트 추출 → PII redaction → chunking → embedding → status=indexed), `lib/inngest/docingest/gdrive-sync.ts` (주기 sync), `lib/inngest/docingest/sharepoint-sync.ts`, `lib/inngest/docingest/email-received.ts` |
| Seed data | `scripts/seed-documents.ts` (샘플 510(k) clearance, CER, SOP, GSPR checklist — 가공된 익명 샘플 3~5개/class), `scripts/seed-access-policies.ts` (8-class × 4-role default policy) |
| 관리자 알림 | `lib/notifications/admin-quarantine.ts` (quarantine status 문서 발생 시 admin 대시보드 뱃지) |

### Out of Scope

다음 항목은 **의도적으로 본 Phase에서 구현하지 않는다**.

| 항목 | 해당 Phase | 사유 |
|---|---|---|
| **Phase 9 제출 초안 자동 생성 워크플로우** (과거 제출 재사용 → 신규 submission 초안 LLM 생성 → 체크리스트 평가) | Phase 9 | Phase 8은 데이터 층만 구축. 워크플로우 UI·LLM 파이프라인은 별도 Phase 9 SPEC |
| **Phase 11 network intelligence aggregate** (조직 간 익명화 집계 → 예측 모델) | Phase 11 | Phase 8은 단일 조직 격리 완전성을 우선 |
| **DocuSign 등 전자서명 통합** | Post-launch | GxP 전자 서명 플로우는 별도 SPEC 필요 |
| **업로드 문서의 자동 품질 평가** (예: CER 누락 섹션 감지, submission dossier 완전성 체크) | Phase 9 | 본 Phase는 수집·분류·인덱싱만, 질적 평가는 후속 |
| **이미지 PDF / OCR 지원** | Phase 9 이후 | MVP는 텍스트 PDF만, 이미지 PDF는 `quarantine` status |
| **Regulatory Portal 자동 미러링** (FDA ESG, EMA CESP) | Post-launch | 정부 포털 로그인 자동화는 Cloudflare Browser Rendering + 별도 법무 검토 필요 |
| **ML 기반 자동 문서 분류** | Phase 9 | MVP는 사용자 수동 분류 + heuristic 추천. ML classifier는 충분한 labeled data 축적 후 |
| **문서 버전 diff 시각화** | Phase 9 또는 post-launch | 개정판 텍스트 diff는 별도 UX 연구 필요 |
| **문서 태깅·자유 메타데이터 추가 UI** | Phase 9 | MVP는 class별 구조화 metadata_json만 |
| **문서 삭제 (hard delete)** | Post-launch | 감사 이슈로 MVP는 `archived_at` soft marker만 |
| **cross-org 문서 공유** (M&A 시나리오 등) | Post-launch | tenant 격리 원칙을 우선 |
| **redaction_map 복호화 UI** (권한자의 원본 PII 조회) | Phase 9 | MVP는 API만, UI는 검토 후 추가 |
| **Playwright E2E (upload → search 전체 경로)** | Phase 6 (LAUNCH) | Phase 8은 Vitest 단위·통합 테스트만, E2E는 Phase 6 통합 |
| **관측성 벤더 전송 분리 검증** (PII-free 보증) | Phase 5 (ENTERPRISE) 재활용 | ENTERPRISE의 audit ↔ 관측성 분리 원칙에 편승 |

### 영향받지 않는 Phase 1~7 산출물 (수정 금지)

본 Phase는 다음을 **수정하지 않는다**:

- `lib/db/schema.ts` (FOUNDATION 13 tables) — 새 테이블은 `schema-docingest.ts`에
  분리
- `migrations/0000_init.sql`, `migrations/0001_audit_append_only.sql`,
  Phase 2~5 migration — 모두 `0010_*`, `0011_*` 번호 이후 migration으로 추가
- `lib/ai/retrievers/fda.ts`, `eu-mdr.ts`, `mfds.ts`, `nmpa.ts`, `pmda.ts` — 인터
  페이스 유지, 공개 corpus 검색만
- `lib/ai/retrievers/internal-sops.ts` — **리네임 권고** (`published-sops.ts`)
  이나 BREADTH SPEC의 수정은 Out of Scope이므로 deprecation 주석만 본 Phase에서
  추가하고 실제 rename은 Phase 9에서 수행
- `lib/audit.ts` — `AuditAction` TypeScript union 확장만, 기존 value 삭제 금지
- `lib/auth/with-permission.ts` (ENTERPRISE) — 새 권한 추가만 (`document:upload`,
  `document:read`, `document:read_unredacted`, `document:admin`), 기존 권한 삭제
  금지

---

## 기술 결정 (Technical Decisions)

본 SPEC은 research.md §8 Decision Log의 10개 결정을 확정하고, 후속 재평가 조건을
명시한다.

### Phase 8 확정 결정

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | 문서 저장소 | **Cloudflare R2** (CLOUDFLARE SPEC 기반) | AWS S3 / Google Cloud Storage | 생태계 통합 (Workers AI + Vectorize 동일 벤더), zero egress, Email Workers 직접 연동 | R2 latency P95 > 500ms 또는 월간 availability < 99.9% 시 S3 대체 |
| 2 | PII redact 엔진 | **3-layer hybrid** (Layer 1 regex + Layer 2 Workers AI GLiNER + Layer 3 Presidio for critical PHI) | 단일 Presidio / 단일 regex / 단일 Workers AI | Layer 1 정확·빠름, Layer 2 entity NER coverage, Layer 3 custom recognizer (의료기기 serial) | GLiNER recall < 95% 시 Presidio 전면 확대, regex FP > 10% 시 Layer 1 축소 |
| 3 | OCR 도입 | **Phase 9 이후 deferred**, MVP는 `quarantine` 상태로 저장 | 초기 포함 | 복잡도 분리, 이미지 PDF 비중 < 20% 추정 (RA 실무 주로 텍스트 PDF) | 이미지 PDF 요청 > 20% 또는 quarantine 잔여 > 100건 축적 시 Phase 9 우선화 |
| 4 | Tenant isolation | **Postgres RLS + pgvector RLS policy** (DB-level 강제) | application-layer WHERE only | SQL injection / ORM bug 방어, 최종 보루. 성능 저하 < 15% 확인 | RLS + HNSW 성능 저하 > 50% 시 partial index + RLS hybrid 튜닝 |
| 5 | Chunking 모델 | **class별 전용 chunker 14종 + generic fallback** | 단일 general chunker | 규제 문서 구조 보존 — 510(k) 7 element, CER 7 section, SOP 3-part 등 정확 분할이 retrieval 정확도 결정 | class별 chunker 유지 비용이 retrieval 정확도 향상 대비 비효율적이면 fallback generic 확대 |
| 6 | Audit 기록 정책 | **모든 document read도 audit_logs 기록** (append-only) | sampling | 21 CFR Part 11 §11.10(e) strict 해석 — 조직 문서는 PHI 가능성 높아 완전 추적 필수 | 일일 `document.access` row > 1M 시 Phase 9에서 partition 분할 (월간 partition) |
| 7 | Intent router 확장 | **기존 6 intent에 public + org corpus 병행 매핑 + 2 신 intent** (`past_submission_reuse`, `audit_response_drafting`) | 별도 router 분리 | BREADTH router 재사용, citation `org:` prefix로 공개/조직 구분 | cross-corpus merge latency > 800ms 시 intent 조건부 분기 |
| 8 | Ingestion 트리거 | **Inngest step function** (upload event → extract → redact → chunk → embed → index) | Vercel Queue / 직접 호출 | FOUNDATION 결정 #2 Inngest 재사용, idempotent upsert, step retry 내장 | Inngest step 한도(25 steps) 초과 시 Trigger.dev 재평가 |
| 9 | Dedup key | **SHA-256 hash of file content** | filename + size | bit-identical 중복만 제거, 개정판은 version++ 별도 row | hash collision 비현실적, 재평가 불필요 |
| 10 | redaction_map 암호화 | **AES-256-GCM + env key `PII_MAP_KEY` + private schema + RLS + pii_admin_role 분리** | plaintext + RLS only | 이중 방어. 앱 DB 유출 시에도 key 없으면 복호화 불가 | KMS 도입 가능 환경 시 envelope encryption으로 전환 |

### Phase 8 Decision Points (재평가 필요)

| # | 항목 | 현재 결정 | 후속 재평가 조건 |
|---|---|---|---|
| DP-1 | pgvector vs Vectorize | CLOUDFLARE SPEC 확정에 따름. 양자택일이 아닌 dual-write 가능 | CLOUDFLARE v0.1.0 공표 후 확정 |
| DP-2 | 한국어 PII 엔진 | 현재 Workers AI GLiNER 한국어 품질 미확인. MVP는 영어 문서 우선 지원, 한국어 문서는 spaCy ko_core_news_lg (Presidio 통합) fallback | Phase 8 구현 중 한국어 샘플 100건 benchmark 후 확정 |
| DP-3 | OAuth state 컬럼 암호화 방식 | `organizations` 테이블에 `gdrive_refresh_token_encrypted` 등 추가. AES-256-GCM 동일 키 재사용 vs 독립 키 분리 | 보안 감사 결과에 따라 Post-launch에서 key 분리 |
| DP-4 | 문서 분류 UI 흐름 | MVP 수동 (upload 시 dropdown 선택). 선택 오류는 admin UI에서 재분류 가능. ML classifier 도입 시점 | labeled 문서 > 500건 축적 후 Phase 9 |
| DP-5 | 관리자 포털 레이아웃 | Phase 5 ENTERPRISE의 shell 재사용 vs 별도 `/admin` 레이아웃 | BREADTH Sidebar는 `/admin`에서 숨김, Topbar는 유지. 디자인 검토 Phase 9 Kickoff |

---

## EARS 인수 기준 (Acceptance Criteria)

각 요구사항은 `REQ-DOC-NNN` ID로 식별하며, EARS 5개 패턴 중 적절한 형태로 기술한다.
모든 요구사항은 테스트 가능(testable)해야 한다.

**v0.1.0 상태:** REQ-DOC-001 ~ 078 (총 **78개**) 요구사항. 8개 그룹(A~H)으로 분할
관리. 본 SPEC은 후속 Phase 9(제출 초안 생성) 및 Phase 11(network intelligence)의
데이터 층 기반을 제공한다.

---

### Group A: Document Classification & Type System (REQ-DOC-001 ~ REQ-DOC-010)

이 그룹은 8-class 문서 분류 체계의 enum 정의, class별 ACL 기본값, PII 민감도 매핑
의 3개 축을 다룬다.

#### REQ-DOC-001 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/doc-class.ts` exporting a
TypeScript enum `DocClass` with exactly 8 values in this order: `issued_certificate`,
`submission_success`, `submission_inprogress`, `clinical_report`, `checklist_template`,
`surveillance_report`, `internal_sop`, `audit_response`.
**근거:** research.md §1.1 — 8-class 분류 체계는 ACL·chunking·PII 정책 분기의 기반.
**검증 방법:** Vitest로 `Object.keys(DocClass)`.length === 8 및 정확한 값 배열 assert.

#### REQ-DOC-002 (Ubiquitous)
**요구사항:** The system SHALL define a Postgres enum `doc_class` in
`migrations/0010_docingest.sql` matching the 8 values of `DocClass` TypeScript enum,
in identical order.
**근거:** research.md §4.2 — DB-level enum과 TypeScript enum이 불일치하면 INSERT
시 런타임 에러 유발.
**검증 방법:** migration 적용 후 `SELECT unnest(enum_range(NULL::doc_class))`로 순서 및 값 확인. Drizzle schema introspection과 TypeScript enum 교차 검증.

#### REQ-DOC-003 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/doc-class-labels.ts` exporting a
mapping `docClassLabels: Record<DocClass, { ko: string; en: string }>` providing the
Korean and English UI labels per handoff §6 (한국어 기본). Example values:
`issued_certificate → { ko: '취득 인증서', en: 'Issued Certificate' }`.
**근거:** research.md §1.1 + handoff §6 한국어 UI 기본값 + Non-Obvious Constraint #6.
**검증 방법:** Vitest에서 8개 class 전부 ko/en 키 존재 assert. UI snapshot test에서 Korean label 렌더 확인.

#### REQ-DOC-004 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/doc-sensitivity.ts` exporting a
mapping `docSensitivity: Record<DocClass, 'low' | 'medium' | 'high' | 'critical_phi'>`
aligned with research.md §1.3 PII Sensitivity matrix: issued_certificate=low,
checklist_template=low, internal_sop=medium, submission_success=high,
submission_inprogress=high, surveillance_report=high, clinical_report=critical_phi,
audit_response=critical_phi.
**근거:** research.md §1.3 — sensitivity level이 PII redaction 레이어 분기의 기준.
**검증 방법:** Vitest로 8개 class 전부 선언 확인. Integration test: `clinical_report` upload 시 Layer 3 Presidio 호출 로그 발생 확인.

#### REQ-DOC-005 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/doc-classifier.ts` exporting
`classifyDocument(metadata: { filename: string; mimeType: string; firstPageText?: string; }): { suggestedClass: DocClass; confidence: number }`. The MVP implementation SHALL use heuristic rules (filename pattern, first-page keyword) — ML model is deferred to Phase 9 (DP-4).
**근거:** research.md §1.1 + DP-4 — MVP는 사용자가 수동 분류하되 추천값을 제공.
**검증 방법:** Vitest에서 "510k_K123456.pdf" → `submission_success` with confidence > 0.5 assert. "SOP-CC-001_rev3.docx" → `internal_sop` assert.

#### REQ-DOC-006 (Event-driven)
**요구사항:** WHEN a user uploads a document via `POST /api/admin/documents`, THEN
the system SHALL require `docClass` as a mandatory field in the request body (Zod
schema validation).
**근거:** DP-4 — MVP는 수동 분류 필수, 자동 분류는 추천값일 뿐.
**검증 방법:** Vitest에서 `docClass` 누락 시 400 응답 + Zod error message 확인.

#### REQ-DOC-007 (Ubiquitous)
**요구사항:** The system SHALL define `lib/acl/default-policies.ts` exporting seed
data for `document_access_policies` covering all 8 `DocClass` × 4 roles (admin,
ra-lead, ra-member, viewer) default `action` value (`read` / `reference` / `draft_reuse`).
Baseline:
- `issued_certificate`: all roles `read` (org-wide)
- `submission_success`: admin/ra-lead `read`+`reference`+`draft_reuse`, ra-member `read`+`reference` (own project only), viewer no access
- `submission_inprogress`: admin/ra-lead/ra-member `read` (project only), viewer no access
- `clinical_report`: admin/ra-lead `read`, ra-member `read` (project, redacted only), viewer no access
- `checklist_template`: all roles `read`+`reference` (org-wide)
- `surveillance_report`: admin/ra-lead/ra-member `read` (project), viewer no access
- `internal_sop`: all roles `read` (org-wide), admin/ra-lead `reference`
- `audit_response`: admin/ra-lead `read` only (no ra-member, no viewer)
**근거:** research.md §1.1 default ACL — 민감도 기반 차등 접근.
**검증 방법:** `scripts/seed-access-policies.ts` 실행 후 `document_access_policies` 테이블에 `8 × 4 = 32` row 삽입 확인. Admin UI에서 정책 노출 확인.

#### REQ-DOC-008 (Ubiquitous)
**요구사항:** The system SHALL define a Postgres enum `doc_source` with values:
`google_drive`, `sharepoint`, `dropbox`, `email_workers`, `manual_upload`,
`regulatory_portal` (마지막은 미래 확장용).
**근거:** research.md §5 — 5 ingestion source handlers + 1 미래 확장.
**검증 방법:** migration 적용 후 enum 값 5개 확인 + TypeScript `DocSource` 매칭.

#### REQ-DOC-009 (Ubiquitous)
**요구사항:** The system SHALL define a Postgres enum `doc_status` with values in
this order: `pending`, `extracting`, `redacting`, `chunking`, `indexed`, `failed`,
`quarantine`, `archived`.
**근거:** research.md §4.2 — 문서 처리 상태 머신.
**검증 방법:** migration + TypeScript enum 교차 검증. Inngest step 진행에 따른 status 전이 integration test.

#### REQ-DOC-010 (Ubiquitous)
**요구사항:** The system SHALL reject documents with MIME types outside the
whitelist: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx),
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx),
`application/zip`. Rejected uploads SHALL return HTTP 415 Unsupported Media Type
with a Korean error message.
**근거:** research.md §5.5 보안 — MIME 화이트리스트 + magic bytes 검증.
**검증 방법:** Vitest에서 `image/jpeg` 업로드 시 415 응답 확인. 실제 magic bytes와 MIME 불일치 시 reject.

---

### Group B: Ingestion Sources (REQ-DOC-011 ~ REQ-DOC-025)

이 그룹은 5개 ingestion source handler (Google Drive, SharePoint, Dropbox, Email
Workers, Manual Upload)의 공통 계약 + 각 source별 요건을 정의한다.

#### REQ-DOC-011 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/sources/base.ts` exporting a
common interface `IngestionSource` with required methods: `listChanged(since:
Date): Promise<RawFile[]>`, `download(externalId: string): Promise<Buffer>`,
`getMetadata(externalId: string): Promise<RawMetadata>`. Each source handler
(google-drive, sharepoint, dropbox, email-workers, manual-upload) SHALL implement
this interface.
**근거:** research.md §5 — 5 sources 공통 계약으로 orchestrator 단순화.
**검증 방법:** Vitest에서 각 handler가 `IngestionSource` 인터페이스 implements 확인. TypeScript 컴파일 시점 검증.

#### REQ-DOC-012 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/sources/google-drive.ts`
implementing OAuth 2.0 refresh_token flow with scope `https://www.googleapis.com/auth/drive.readonly` + `drive.metadata.readonly`. The refresh_token SHALL be stored in
`organizations.gdrive_refresh_token_encrypted` column (AES-256-GCM with env key
`PII_MAP_KEY` — reused per decision #10).
**근거:** research.md §5.1 — Google Drive OAuth + refresh_token 암호화.
**검증 방법:** Integration test — mock Drive API로 authorize flow 실행 후 `organizations` row에 encrypted token 저장 확인. 복호화 후 원본 token 복원 확인.

#### REQ-DOC-013 (Event-driven)
**요구사항:** WHEN the Google Drive source watches a designated folder via
`files.watch` webhook, AND a new file is created or modified in that folder, THEN
the system SHALL enqueue an Inngest event `docingest.gdrive.file_changed` with
the Drive `fileId`, `modifiedTime`, and `organizationId`.
**근거:** research.md §5.1 — webhook 기반 변경 감지.
**검증 방법:** Vercel Route Handler `/api/ingest/webhooks/gdrive` mock POST 후 Inngest event emit 확인.

#### REQ-DOC-014 (Conditional)
**요구사항:** IF the Google Drive webhook is unavailable (e.g., network restriction),
THEN the system SHALL fall back to a cron-scheduled Inngest function running every
15 minutes calling `listChanged(organization.lastGdriveSyncAt)`.
**근거:** research.md §5.1 — webhook 불가 환경 fallback.
**검증 방법:** Webhook endpoint 비활성화 후 cron job 트리거 시 새 파일 감지 확인.

#### REQ-DOC-015 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/sources/sharepoint.ts`
implementing Microsoft Graph API v1.0 with scope `Sites.Read.All` + `Files.Read.All`,
using `delta` query for efficient change detection. Authentication SHALL use
certificate-based auth (client assertion) rather than client secret where possible.
**근거:** research.md §5.2 — SharePoint delta query + certificate auth.
**검증 방법:** Microsoft Graph SDK mock으로 delta query 호출 후 변경된 files 목록 반환 확인.

#### REQ-DOC-016 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/sources/email-workers.ts`
handling Cloudflare Email Worker incoming events. The worker SHALL: (a) verify
sender SPF/DKIM/DMARC status, (b) match sender email domain or explicit allow-list
against `organizations.email_ingest_allowlist` jsonb column, (c) extract attachments
matching the MIME whitelist (REQ-DOC-010), (d) upload attachments directly to R2,
(e) emit Inngest event `docingest.email.received`.
**근거:** research.md §5.4 — Email Workers 수신 + 발신자 검증 + 첨부 추출.
**검증 방법:** Mock MIME email (with valid DKIM + allow-listed sender) → worker 실행 → R2 업로드 + Inngest event emit 확인.

#### REQ-DOC-017 (Unwanted)
**요구사항:** The email-workers handler SHALL NOT accept emails with:
- ZIP archives exceeding 500MB uncompressed size (zip bomb protection)
- Files containing Word macros (`.docm`)
- Senders failing SPF/DKIM/DMARC all three checks
Rejected emails SHALL create a `quarantine` status document entry with sender
metadata for admin review.
**근거:** research.md §5.4 보안 — anti-malware + zip bomb 방지.
**검증 방법:** Test email with 1GB uncompressed zip → quarantine status 확인. `.docm` 파일 → quarantine.

#### REQ-DOC-018 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/sources/manual-upload.ts`
implementing R2 presigned URL flow: (a) client requests presigned PUT URL via
`POST /api/admin/documents/presign` with filename + docClass + mimeType, (b)
server validates RBAC (admin/ra-lead only) and returns R2 presigned URL + upload
token, (c) client uploads directly to R2, (d) client calls `POST /api/admin/documents`
with upload token + metadata, (e) server verifies R2 object exists and creates
`organization_documents` row + triggers Inngest.
**근거:** research.md §5.5 — browser → R2 직접 업로드 (Vercel bandwidth 절약).
**검증 방법:** Playwright (Phase 6 통합 시)에서 드래그 앤 드롭 → R2 업로드 → 문서 목록 반영 경로 확인. 단위 테스트에서 presigned URL 만료 15분 assert.

#### REQ-DOC-019 (Unwanted)
**요구사항:** The manual-upload handler SHALL NOT allow non-admin, non-ra-lead
users to request presigned URLs. IF a ra-member or viewer calls
`POST /api/admin/documents/presign`, THEN the system SHALL return HTTP 403
Forbidden AND write an `rbac.permission_deny` entry to audit_logs.
**근거:** ENTERPRISE RBAC + REQ-DOC-007 default policy.
**검증 방법:** Integration test with ra-member session → 403 + audit_logs row 확인.

#### REQ-DOC-020 (Conditional)
**요구사항:** IF an ingestion source returns a file whose SHA-256 hash
(`file_hash_sha256`) matches an existing row in `organization_documents` for the
same `org_id`, THEN the system SHALL skip creating a new row and log a
`document.upload_duplicate_skipped` audit entry. IF the existing row's metadata
differs (e.g., title, source), THEN the system SHALL update the existing row's
`updated_at` and `source_meta_json` only (no new version).
**근거:** research.md §8 결정 #9 — dedup by SHA-256.
**검증 방법:** Same file upload 2회 → `organization_documents` row count 증가 없음 + audit log 확인.

#### REQ-DOC-021 (Event-driven)
**요구사항:** WHEN a document passes dedup check and is newly created, THEN the
system SHALL emit Inngest event `docingest.document.created` with `documentId`,
`orgId`, `docClass`, `sensitivityLevel`, triggering the processing pipeline
(extract → redact → chunk → embed → index).
**근거:** research.md §8 결정 #8 — Inngest step function.
**검증 방법:** Mock upload → Inngest dev tool에서 event 확인 → pipeline step 순차 실행 관찰.

#### REQ-DOC-022 (Conditional)
**요구사항:** IF any step in the ingestion pipeline fails (extract / redact /
chunk / embed / index), THEN the system SHALL update document status to `failed`
AND store error details in `organization_documents.source_meta_json.error` AND
write a `document.ingest_failed` audit entry. Inngest step retry SHALL be enabled
with exponential backoff (max 3 retries).
**근거:** research.md §11 R-DOC-05 — 대용량 처리 시간 + retry 정책.
**검증 방법:** Mock PII service 5xx 응답 → retry → 최종 failed status 확인 + audit log.

#### REQ-DOC-023 (Ubiquitous)
**요구사항:** The system SHALL store OAuth refresh_tokens and other source credentials
encrypted with AES-256-GCM using env key `PII_MAP_KEY` (reused per decision #10)
in dedicated columns on `organizations` table: `gdrive_refresh_token_encrypted`
(text), `sharepoint_tenant_id` (text, non-secret), `sharepoint_client_cert_encrypted`
(bytea), `dropbox_refresh_token_encrypted` (text), `email_ingest_allowlist` (jsonb).
**근거:** research.md DP-3 — OAuth credential 암호화 (MVP는 동일 키 재사용, 분리는 Post-launch).
**검증 방법:** migration 후 컬럼 존재 확인. Unit test: encrypt/decrypt roundtrip 성공.

#### REQ-DOC-024 (Unwanted)
**요구사항:** The ingestion pipeline SHALL NOT upload original (unredacted) text or
file content to any third-party service other than: (a) Cloudflare R2 (primary
storage), (b) OpenAI embedding API (redacted chunks only), (c) Presidio Lambda
(critical PHI redaction only, short-lived). Sentry / PostHog / Langfuse SHALL
NEVER receive unredacted document content (ENTERPRISE audit vs observability
separation principle).
**근거:** research.md §11 R-DOC-10 — PII-free 관측성 보증.
**검증 방법:** Integration test: Sentry mock → unredacted content 전송 발생 시 fail. `pnpm audit:check` 확장 (ENTERPRISE static analyzer에 문서 ingest 경로 추가).

#### REQ-DOC-025 (Conditional)
**요구사항:** IF a document processing step takes longer than 5 minutes
(extract / redact / chunk / embed), THEN the system SHALL log a warning to
Langfuse (NOT including content) with document ID + step name + duration, and
continue processing. IF total pipeline exceeds 30 minutes, THEN status transitions
to `failed` and admin notification is emitted.
**근거:** research.md §11 R-DOC-05 — 대용량 문서 처리 시간 모니터링.
**검증 방법:** Mock 600MB PDF → 30분 경과 후 failed + admin notification row 확인.

---

### Group C: PII Redaction Pipeline (REQ-DOC-026 ~ REQ-DOC-035)

이 그룹은 3-layer redaction 파이프라인의 각 레이어 역할, redaction_map 암호화,
HIPAA 18 identifier coverage를 정의한다.

#### REQ-DOC-026 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/pii/regex.ts` implementing
Layer 1 regex-based redaction covering these entity types: `SSN` (US format
XXX-XX-XXXX), `EMAIL` (RFC 5322 simplified), `PHONE` (US + KR + international
E.164), `CREDIT_CARD` (16-digit with Luhn checksum), `URL` (http/https). The
function SHALL return `{ redactedText, spans: PIISpan[] }` where each span
includes `{ entityType, originalText, redactedToken, startOffset, endOffset }`.
**근거:** research.md §2.4 Layer 1 — fast-path 60% PII coverage.
**검증 방법:** Unit test with labeled corpus (20 SSN + 20 email + 20 phone + 20 CC + 20 URL) → precision ≥ 99%, recall ≥ 95%.

#### REQ-DOC-027 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/pii/workers-ai.ts` implementing
Layer 2 PII NER using Cloudflare Workers AI model `@cf/microsoft/piidetection-gliner-pii-base`.
The function SHALL invoke the model with the text (after Layer 1 redaction applied),
parse returned spans, and cover entity types: `PERSON`, `DATE`, `LOCATION`,
`ORGANIZATION`, `MEDICAL_RECORD_NUMBER`, `HEALTH_PLAN_NUMBER`, `LICENSE_NUMBER`.
**근거:** research.md §2.3 + §2.4 Layer 2 — NER for entities regex cannot catch.
**검증 방법:** Mock Workers AI response → expected spans 파싱 확인. Integration test with real API (Phase 6 LAUNCH).

#### REQ-DOC-028 (Conditional)
**요구사항:** IF the document's `docClass` has sensitivity `critical_phi`
(`clinical_report` OR `audit_response` per REQ-DOC-004), THEN the system SHALL
invoke Layer 3 Presidio via `lib/ingest/pii/presidio.ts`. Presidio runs in a
separate AWS Lambda or Google Cloud Run container (not Cloudflare Workers) and
provides custom recognizers for medical device identifiers and ko/en medical
terminology.
**근거:** research.md §2.2 + §2.4 — Presidio heavy weight, only for critical PHI.
**검증 방법:** Upload `clinical_report` document → Presidio Lambda 호출 로그 발생. Upload `issued_certificate` → Presidio 호출 없음 확인.

#### REQ-DOC-029 (Ubiquitous)
**요구사항:** The combined 3-layer pipeline SHALL achieve HIPAA Safe Harbor 18
identifier coverage recall ≥ 99% on a labeled test set of 500 samples
(50 per sensitivity category: low/medium/high/critical_phi, 5 per class × 8
classes + edge cases). Precision ≥ 95% (false positive 재인식 허용 수준).
**근거:** research.md §2.1 HIPAA 18 identifier + Acceptance Criteria ≥ 99% recall.
**검증 방법:** `pnpm test:pii-recall` 스크립트로 labeled set 실행 → metrics.json 생성. CI gate: recall < 99% 시 build fail.

#### REQ-DOC-030 (Unwanted)
**요구사항:** The PII redaction pipeline SHALL NOT redact medical device serial
numbers when they appear in `issued_certificate` or manufacturing tracking
context. The custom recognizer in `lib/ingest/pii/policy-by-class.ts` SHALL
distinguish legitimate device identifiers (e.g., `Device Serial Number: SN-`
heading) from patient case reports (e.g., `Patient ID: P-` heading).
**근거:** research.md §2.1 Phase 8 특별 주의 — HIPAA #13 Device identifier 이중성.
**검증 방법:** Test with certificate containing "Device Serial Number: SN-123456" → not redacted. Test with case report "Patient: P-001 used Device SN-123456" → both redacted.

#### REQ-DOC-031 (Ubiquitous)
**요구사항:** The system SHALL store redaction mappings in `private.redaction_maps`
table (separate Postgres schema `private`). Each row SHALL contain: `document_id`,
`original_token_encrypted` (bytea, AES-256-GCM), `redacted_token` (text, e.g.,
`[PERSON_1]`), `entity_type`, `start_offset`, `end_offset`, `authorized_roles`
(text[]), `created_at`.
**근거:** research.md §2.5 + §4.5 — redaction_map 이중 방어.
**검증 방법:** migration 후 `\dn private` 확인. INSERT 후 encrypted bytea 저장 확인. `SELECT` with pii_admin_role → decrypt 가능, with app_role → RLS 차단.

#### REQ-DOC-032 (Unwanted)
**요구사항:** The `app_role` Postgres role SHALL NOT have any GRANT on
`private.redaction_maps` or `private` schema. `REVOKE ALL ON SCHEMA private FROM
app_role` SHALL be explicitly applied in `migrations/0011_docingest_rls.sql`.
Attempts by app_role to `SELECT FROM private.redaction_maps` SHALL fail with
permission denied error.
**근거:** research.md §2.5 + §4.5 — role 분리.
**검증 방법:** Integration test — Drizzle client (app_role) 로 `SELECT` 시도 → Postgres error 확인.

#### REQ-DOC-033 (Event-driven)
**요구사항:** WHEN a user with `pii_admin_role` accesses
`private.redaction_maps`, THEN the system SHALL write an audit_logs entry with
action `redaction_map.access` including `document_id` and accessing user_id.
Accessing redaction_map content SHALL require an additional API endpoint
`GET /api/admin/pii/reveal/[documentId]` (Post-launch; MVP is read-only via DB).
**근거:** research.md §2.5 + REQ-DOC-006 audit 정책.
**검증 방법:** `redaction_map.access` action이 FOUNDATION audit_action pgEnum에 선언됨 확인. 모의 SELECT 실행 후 audit_logs row 확인.

#### REQ-DOC-034 (Ubiquitous)
**요구사항:** The system SHALL store the redacted text as `document_chunks.content_text`
(used for embedding and search) AND store the original (unredacted) file in R2 at
key `organization_documents.original_file_r2_key`. The redacted rendering of the
full document (with [PERSON_1] tokens) SHALL also be stored in R2 at
`organization_documents.redacted_file_r2_key` for admin preview.
**근거:** research.md §4.2 — 원본 보존 + redacted 별도 저장.
**검증 방법:** Mock upload → R2에 2개 object 존재 확인 (original + redacted).

#### REQ-DOC-035 (Unwanted)
**요구사항:** The system SHALL NEVER embed unredacted text. All embeddings
stored in `document_chunks.content_embedding` SHALL correspond to redacted
`content_text` only. Attempts to pass unredacted text to OpenAI embedding API
SHALL be blocked at the function layer (`lib/ingest/embed.ts` only accepts
pre-redacted input and validates absence of common PII patterns as defense-in-depth).
**근거:** research.md §11 R-DOC-10 — PII-free 관측성·external 전송 보증.
**검증 방법:** Unit test: unredacted text (containing SSN pattern) → embed() 호출 → 에러 throw. Integration test: embedding audit (중간 캐시 없음).

---

### Group D: Document Schema Migration (REQ-DOC-036 ~ REQ-DOC-045)

이 그룹은 4 신규 테이블 + 3 신규 pgEnum + RLS 정책 + private schema + role 분리의
DB 기반을 정의한다.

#### REQ-DOC-036 (Ubiquitous)
**요구사항:** The system SHALL define `lib/db/schema-docingest.ts` with 4 Drizzle
table definitions: `organizationDocuments`, `documentChunks`,
`documentAccessPolicies`, and **no redaction_maps** (redaction_maps resides in
`private` schema, managed via raw SQL migration only — not Drizzle).
**근거:** research.md §4 — Drizzle is for public schema tables only; private schema is raw SQL.
**검증 방법:** import 후 3 Drizzle exports 확인. Grep for `redactionMaps` in schema-docingest.ts → no match.

#### REQ-DOC-037 (Ubiquitous)
**요구사항:** The `organization_documents` table SHALL include the exact columns
and constraints per research.md §4.2: `id` uuid PK default gen_random_uuid,
`org_id` uuid NOT NULL FK organizations(id) onDelete RESTRICT, `doc_class`
doc_class enum NOT NULL, `title` text NOT NULL, `language` text NOT NULL default
'en', `original_file_r2_key` text NOT NULL, `redacted_file_r2_key` text NULL,
`file_size_bytes` integer NOT NULL, `file_mime_type` text NOT NULL,
`file_hash_sha256` text NOT NULL, `source` doc_source enum NOT NULL,
`source_meta_json` jsonb NOT NULL default '{}', `metadata_json` jsonb NOT NULL
default '{}', `uploaded_by` uuid NOT NULL FK users(id), `uploaded_at` timestamptz
NOT NULL default now(), `status` doc_status enum NOT NULL default 'pending',
`version` integer NOT NULL default 1, `supersedes_doc_id` uuid NULL,
`project_id` uuid NULL, `indexed_at` timestamptz NULL, `archived_at` timestamptz
NULL, `created_at` timestamptz NOT NULL default now(), `updated_at` timestamptz
NOT NULL default now().
**근거:** research.md §4.2.
**검증 방법:** Drizzle introspection으로 모든 컬럼 + 타입 + default 확인.

#### REQ-DOC-038 (Ubiquitous)
**요구사항:** The `organization_documents` table SHALL have these indexes:
`(org_id)`, `(org_id, doc_class)`, `(status)`, `(org_id, file_hash_sha256)`,
`(org_id, project_id)`. Names SHALL follow pattern `org_documents_<purpose>_idx`.
**근거:** research.md §4.2 — 조회 패턴 기반 인덱스.
**검증 방법:** `SELECT indexname FROM pg_indexes WHERE tablename = 'organization_documents'` 5개 이상 확인.

#### REQ-DOC-039 (Ubiquitous)
**요구사항:** The `document_chunks` table SHALL include: `id` uuid PK, `document_id`
uuid NOT NULL FK organization_documents(id) onDelete CASCADE, `chunk_index`
integer NOT NULL, `content_text` text NOT NULL (redacted), `content_embedding`
vector(1536), `section_path` text NOT NULL, `page_number` integer NULL, `offset`
integer NULL, `token_count` integer NOT NULL, `metadata_json` jsonb NOT NULL
default '{}', `created_at` timestamptz NOT NULL default now(). UNIQUE constraint
on `(document_id, chunk_index)`.
**근거:** research.md §4.3 — source_sections 시그니처 호환 + organization_documents 연결.
**검증 방법:** Drizzle introspection + UNIQUE 제약 검증.

#### REQ-DOC-040 (Ubiquitous)
**요구사항:** The system SHALL create an HNSW index on
`document_chunks.content_embedding` using cosine distance operator class:
`CREATE INDEX doc_chunks_embedding_hnsw ON document_chunks USING hnsw
(content_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`.
**근거:** research.md §4.3 + BREADTH pgvector 패턴.
**검증 방법:** `\d document_chunks` 출력에 HNSW 인덱스 확인. Benchmark: 10K rows에서 top-8 검색 P95 < 100ms.

#### REQ-DOC-041 (Ubiquitous)
**요구사항:** The system SHALL ENABLE ROW LEVEL SECURITY on `organization_documents`
and `document_chunks` with policies:
```sql
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_tenant_isolation ON organization_documents
  FOR ALL TO app_role
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY chunks_tenant_isolation ON document_chunks
  FOR SELECT TO app_role
  USING (document_id IN (
    SELECT id FROM organization_documents
    WHERE org_id = current_setting('app.current_org_id')::uuid
  ));
```
**근거:** research.md §3 — DB-level tenant isolation.
**검증 방법:** Integration test: 세션 A (orgA) → 세션 B (orgB) document SELECT → empty result. Red team test: SQL injection 시나리오에서도 cross-org 접근 차단.

#### REQ-DOC-042 (Ubiquitous)
**요구사항:** The system SHALL define `lib/db/client.ts` helper
`withTenantScope<T>(orgId: string, fn: (db: DrizzleClient) => Promise<T>):
Promise<T>` that wraps the callback in a transaction and calls
`SELECT set_config('app.current_org_id', orgId, true)` at the start. All
document-related queries SHALL execute within this wrapper.
**근거:** research.md §3.2 — session variable 초기화 helper.
**검증 방법:** ESLint custom rule `require-tenant-scope-for-documents`: `organization_documents` 또는 `document_chunks` 쿼리가 `withTenantScope` 외부에서 실행되면 error. Phase 8 구현 CI gate.

#### REQ-DOC-043 (Ubiquitous)
**요구사항:** The system SHALL create a separate Postgres role `pii_admin_role`
distinct from `app_role` and `migrations_role`. `pii_admin_role` SHALL have
`USAGE` on schema `private` and `SELECT` on `private.redaction_maps` only.
Application code SHALL NOT connect with `pii_admin_role`; only dedicated admin
endpoints (Post-launch) using short-lived credentials may assume this role.
**근거:** research.md §2.5 — role 분리 원칙.
**검증 방법:** `SELECT rolname FROM pg_roles WHERE rolname = 'pii_admin_role'` 확인. Connection string으로 `app_role` 접속 시 `private.redaction_maps` SELECT → permission denied.

#### REQ-DOC-044 (Ubiquitous)
**요구사항:** The `document_access_policies` table SHALL include: `id` uuid PK,
`document_id` uuid NOT NULL FK onDelete CASCADE, `role` text NOT NULL (ENTERPRISE
4-role enum values), `project_scope` uuid NULL, `action` text NOT NULL
(`read` | `reference` | `draft_reuse`), `created_at` timestamptz NOT NULL.
Index on `(document_id, role)`.
**근거:** research.md §4.4.
**검증 방법:** Drizzle introspection + default seed 8 class × 4 role = 32 row (seed 스크립트 실행 후).

#### REQ-DOC-045 (Ubiquitous)
**요구사항:** The `audit_action` pgEnum (FOUNDATION REQ-FND-049) SHALL be extended
in `migrations/0010_docingest.sql` via `ALTER TYPE audit_action ADD VALUE` with
6 new values: `document.upload`, `document.access`, `document.redact`,
`document.chunk`, `document.search`, `redaction_map.access`. The order SHALL
be stable (do not reorder existing values).
**근거:** research.md §10 Non-Obvious Constraints — audit 완전성 확장 + FOUNDATION v0.4.0 pgEnum 확장 패턴.
**검증 방법:** migration 적용 후 `SELECT unnest(enum_range(NULL::audit_action))` 결과에 6 신규 값 포함 확인. TypeScript `AuditAction` union 타입 확장 확인.

---

### Group E: Chunking Strategies (REQ-DOC-046 ~ REQ-DOC-055)

이 그룹은 14 class-specific chunker + 1 generic fallback + 공통 파라미터를 정의한다.

#### REQ-DOC-046 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/base.ts` exporting
common utilities: `countTokens(text: string): number` (using `tiktoken` for
OpenAI model compatibility), `splitByTokens(text: string, maxTokens: number,
overlapTokens: number): string[]`, `generateChunkMetadata(docClass: DocClass,
section: string, pageNumber?: number, offset?: number): ChunkMetadata`.
**근거:** research.md §6.2 — 공통 파라미터.
**검증 방법:** Vitest unit test with known text → expected chunk count.

#### REQ-DOC-047 (Ubiquitous)
**요구사항:** The common chunking parameters SHALL be: `MAX_CHUNK_TOKENS = 512`,
`OVERLAP_TOKENS = 64`, `MIN_CHUNK_TOKENS = 64`. These SHALL be exported as
named constants from `lib/ingest/chunkers/base.ts` and reused by all 14 chunkers.
**근거:** research.md §6.2.
**검증 방법:** Import test + 상수 값 assert.

#### REQ-DOC-048 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/submission-510k.ts`
implementing `chunk510k(text: string, metadata: Record<string, unknown>): Chunk[]`.
The chunker SHALL split text by the 13 known 510(k) sections (per research.md
§1.2.2 + FDA_510K_SECTIONS constant), falling back to heading-based detection
if explicit section headings are missing.
**근거:** research.md §1.2.2 — 21 CFR 807.87 7-element + FDA 가이던스 추가 6.
**검증 방법:** 실제 510(k) 샘플 (seed data) 입력 → 섹션 boundary accuracy ≥ 90% (labeled 20 샘플).

#### REQ-DOC-049 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/cer-meddev.ts`
implementing CER chunking per MEDDEV 2.7/1 rev4 Appendix A 7 stages (Scope,
Identification of data, Appraisal, Analysis, Finalization, PMCF plan, Update plan).
Section boundary accuracy ≥ 85% on labeled test set.
**근거:** research.md §1.2.3 + §6.3.
**검증 방법:** labeled CER 20 샘플 → boundary accuracy measurement.

#### REQ-DOC-050 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/sop-iso13485.ts`
implementing 3-part chunking (Header → Revision history → Body sections).
Section boundary accuracy ≥ 95% on labeled test set (SOP structure is highly
standardized).
**근거:** research.md §1.2.4 + §6.3.
**검증 방법:** labeled SOP 20 샘플 → boundary accuracy ≥ 95%.

#### REQ-DOC-051 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/certificate.ts`
implementing single-chunk + metadata-heavy strategy for `issued_certificate`
class. The entire document body SHALL be one chunk, but `metadata_json` SHALL
contain structured fields extracted via regex (fda_k_number, device_name,
decision_date, product_code, regulatory_class) with ≥ 90% extraction accuracy
on labeled test set.
**근거:** research.md §1.2.1 — 인증서는 메타데이터 heavy.
**검증 방법:** labeled 20 certificates → metadata 추출 accuracy.

#### REQ-DOC-052 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/fda-483-response.ts`
implementing observation-level chunking: each Observation section becomes a
separate chunk with metadata including `observation_number`, `root_cause`,
`corrective_action_summary`. ACL on `audit_response` class SHALL restrict access
to admin + ra-lead only (REQ-DOC-007).
**근거:** research.md §1.2.5.
**검증 방법:** labeled 483 response with 5 observations → 5 chunks 생성 확인.

#### REQ-DOC-053 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/generic.ts` as a
fallback chunker using heading-based detection (H1, H2, H3 패턴) + fixed-size
splitting when headings are absent. This SHALL be used for documents whose class
has no dedicated chunker (MVP: none; future classes may use this).
**근거:** research.md §6.1 — fallback.
**검증 방법:** 임의 structured text → 적절 chunk 생성 확인.

#### REQ-DOC-054 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ingest/chunkers/index.ts` exporting a
registry `chunkerRegistry: Record<DocClass, ChunkerFn>` mapping each DocClass
value to its chunker function. The dispatcher `chunk(document: OrganizationDocument,
extractedText: string): Chunk[]` SHALL look up the chunker by `document.docClass`.
**근거:** research.md §6.1 — registry pattern.
**검증 방법:** 8 DocClass 전부 registry 등록 확인. Fallback 경로 검증.

#### REQ-DOC-055 (Ubiquitous)
**요구사항:** The chunking step SHALL embed each chunk's `content_text` using
OpenAI `text-embedding-3-small` (1536 dim, FOUNDATION 결정) in batches of 100
chunks per API call. Failed embeddings SHALL be retried up to 3 times with
exponential backoff.
**근거:** research.md §6.2 + FOUNDATION embedding 결정.
**검증 방법:** Mock OpenAI API (batch 100) → 성공 경로 확인. 2회 5xx → 3회차 성공 → 최종 저장.

---

### Group F: ACL Matrix (REQ-DOC-056 ~ REQ-DOC-065)

이 그룹은 Role × Document-class × Project ACL 매트릭스의 계산, Route Handler
미들웨어, audit wiring을 정의한다.

#### REQ-DOC-056 (Ubiquitous)
**요구사항:** The system SHALL define `lib/acl/document-acl.ts` exporting
`computeDocumentPermissions(user: User, document: OrganizationDocument):
{ read: boolean; reference: boolean; draft_reuse: boolean }`. The function
SHALL query `document_access_policies` filtering by `(document_id, role IN
user.roles, project_scope IS NULL OR project_scope IN user.projects)`.
**근거:** research.md §4.4 — ACL 매트릭스.
**검증 방법:** Unit test: ra-member with projectA → document in projectB → all false. admin → all true.

#### REQ-DOC-057 (Ubiquitous)
**요구사항:** The system SHALL define `lib/acl/with-document-permission.ts`
extending ENTERPRISE `withPermission` middleware with document-specific checks.
Usage pattern:
```ts
export const GET = withDocumentPermission('read', async (req, ctx) => {
  const { documentId } = ctx.params;
  // ...
});
```
The middleware SHALL: (a) extract documentId from request, (b) load document,
(c) invoke `computeDocumentPermissions(user, document)`, (d) return 403 if
required action is false, (e) write `rbac.permission_deny` audit on denial.
**근거:** research.md §12.3 — ENTERPRISE withPermission 확장.
**검증 방법:** Integration test: admin GET → 200. viewer GET → 403 + audit row.

#### REQ-DOC-058 (Event-driven)
**요구사항:** WHEN a user calls `GET /api/admin/documents/[id]` or
`GET /api/ra/documents/[id]` (read-only shallow metadata), THEN the system SHALL
write an audit_logs entry with action `document.access` including `documentId`,
`userId`, `accessMode` ('metadata' or 'content'), within 1 second of the request.
**근거:** research.md §10 + REQ-DOC-006 — 모든 read audit 정책.
**검증 방법:** Integration test: 10 consecutive GETs → 10 audit rows within 1s total.

#### REQ-DOC-059 (Event-driven)
**요구사항:** WHEN the internal-docs retriever (`lib/ai/retrievers/internal-docs.ts`)
is invoked with a user query that produces N chunk results, THEN the system
SHALL write N audit_logs entries with action `document.search` linking each
chunk's `document_id` to the user who executed the query.
**근거:** research.md §10 — retrieval도 audit 대상.
**검증 방법:** Mock query returning 5 chunks → 5 audit rows with document.search action.

#### REQ-DOC-060 (Unwanted)
**요구사항:** The system SHALL NOT allow `ra-member` users to read documents
with `docClass = audit_response`. IF a ra-member attempts
`GET /api/admin/documents/[id]` where document is audit_response, THEN the
middleware SHALL return 403 AND write `rbac.permission_deny` audit.
**근거:** research.md §1.1 + REQ-DOC-007 — audit_response default ACL.
**검증 방법:** Integration test with ra-member + audit_response doc → 403 + audit.

#### REQ-DOC-061 (Unwanted)
**요구사항:** The system SHALL NOT return unredacted document content via any
API endpoint accessible to `ra-member` or `viewer` roles. These roles SHALL
only receive `redacted_file_r2_key` content (if their ACL grants `read`). Only
`admin` + `ra-lead` with explicit permission `document:read_unredacted` may
access `original_file_r2_key` (MVP: no UI exposing this; Phase 9 feature).
**근거:** research.md §1.1 + §2.4 — sensitivity level enforcement.
**검증 방법:** Integration test: ra-member GET presigned URL for original_file → 403.

#### REQ-DOC-062 (Ubiquitous)
**요구사항:** The system SHALL grant `admin` role implicit `read + reference +
draft_reuse` on all 8 document classes within their own organization (no project
scope restriction). This is a seed default in `default-policies.ts`.
**근거:** research.md §1.1 — admin 전권 (tenant 내).
**검증 방법:** Seed 실행 후 admin용 policy row 32개 (8 class × 3 action + 등가) 확인. Integration test: admin can access all.

#### REQ-DOC-063 (Conditional)
**요구사항:** IF a document has `project_id` set AND the user is `ra-member`,
THEN the user SHALL have access only if `user.projects` includes `document.project_id`.
Documents with `project_id = NULL` (org-wide) follow class default ACL regardless
of project.
**근거:** research.md §4.4 — project scope 필터.
**검증 방법:** Integration test: ra-member (projectA) GET projectB document → 403. GET org-wide document → 200 (if class allows).

#### REQ-DOC-064 (Ubiquitous)
**요구사항:** The system SHALL define an admin API `PATCH /api/admin/documents/[id]/access-policies`
allowing admin users to adjust `document_access_policies` for a specific document
(override default class policy). Changes SHALL be audit-logged with action
`document.access_policy_change` (new audit_action enum value — extend Phase 9
or this SPEC's migration).
**근거:** research.md §4.4 — 기본 정책 예외 처리.
**검증 방법:** Integration test: admin PATCH → row update + audit log 확인.

#### REQ-DOC-065 (Ubiquitous)
**요구사항:** The ACL computation SHALL be cached in-memory per request (one
computation per user×document pair per request) to avoid N+1 queries when
rendering document lists. Cache invalidation is per-request (request-scoped).
**근거:** research.md §4.4 performance + N+1 방지.
**검증 방법:** Integration test: document list view with 50 docs → ≤ 50 ACL computations (not 50 × access calls).

---

### Group G: Retrieval Integration (REQ-DOC-066 ~ REQ-DOC-072)

이 그룹은 internal-docs retriever, router 확장, citation prefix 규약을 정의한다.

#### REQ-DOC-066 (Ubiquitous)
**요구사항:** The system SHALL define `lib/ai/retrievers/internal-docs.ts`
exporting `internalDocsRetrieve(query: string, options: { topK: number;
orgId: string; userId: string; projectScope?: string; allowedClasses?:
DocClass[] }): Promise<RetrieverResult>` conforming to the BREADTH retriever
contract (research.md §3.4). The retriever SHALL execute within
`withTenantScope(orgId, ...)` wrapper AND filter results by ACL via
`computeDocumentPermissions`.
**근거:** research.md §3.4 — BREADTH 시그니처 호환.
**검증 방법:** Unit test + interface compliance check via TypeScript.

#### REQ-DOC-067 (Ubiquitous)
**요구사항:** The `internalDocsRetrieve` function SHALL execute hybrid search:
(a) pgvector cosine similarity on `content_embedding` (top 3×K candidates),
(b) Postgres FTS BM25 on `content_text` (top 3×K candidates), (c) merge with
0.6/0.4 weights (matching Phase 2 FDA retriever pattern), (d) apply ACL filter,
(e) return top-K.
**근거:** research.md §3.4 + BREADTH merge weights.
**검증 방법:** Benchmark test: 10K chunks, K=8 → P95 < 300ms (excluding embedding API).

#### REQ-DOC-068 (Ubiquitous)
**요구사항:** The system SHALL extend `lib/ai/router.ts` `intentToCorpora` mapping
per research.md §3.5, adding 2 new intents: `past_submission_reuse` (mapping to
`org_fda_submissions`, `org_eu_cer`, `org_mfds_submissions`) and
`audit_response_drafting` (mapping to `org_audit_responses` only — admin/ra-lead
restricted).
**근거:** research.md §3.5.
**검증 방법:** Unit test: classifyIntent("Can we reuse our previous K-number for this device?") → `past_submission_reuse`. Intent mapping lookup 확인.

#### REQ-DOC-069 (Ubiquitous)
**요구사항:** The system SHALL extend `lib/ai/merge.ts` to support merging
results from public corpora (BREADTH 5) + organizational corpora (DOCINGEST).
Each chunk result SHALL carry a `corpusType: 'public' | 'org'` field, preserved
through Cohere Rerank.
**근거:** research.md §3.5 — 병행 검색 + 구분.
**검증 방법:** Unit test: mixed input (3 public + 3 org) → output preserves corpusType.

#### REQ-DOC-070 (Ubiquitous)
**요구사항:** The citation rendering SHALL prefix organizational document
citations with `[Org · {TitleOrIdentifier}]` format, distinguishing them from
public citations. Example: `[Org · Our Submission K999001]` vs `[FDA] 21 CFR
820.30`. The `citation-enforce.ts` post-processor SHALL recognize both formats
as valid.
**근거:** research.md §3.5 + Non-Obvious Constraint #1 citation 강제.
**검증 방법:** Generated answer → citation format matches. citation-enforce unit test with org citations.

#### REQ-DOC-071 (Conditional)
**요구사항:** IF a retrieval result contains chunks from `clinical_report` or
`audit_response` (critical_phi classes), THEN the system SHALL set
`expert_review_required = true` in the SSE stream event (ENTERPRISE Phase 5 gating).
**근거:** research.md §10 Non-Obvious Constraint #3 — PHI 문서 인용 시 expert review 강제.
**검증 방법:** Integration test: query returning CER chunk → SSE event `expert_review_required: true` 관찰.

#### REQ-DOC-072 (Ubiquitous)
**요구사항:** The retriever SHALL include organizational citations in the
`message_sources` table insert (CHAT Phase 2 schema) using a new column
`message_sources.corpus_type` (default 'public', non-breaking) OR store corpus
distinction in `message_sources.meta_json` if schema change is out of scope.
Final choice is a Phase 8 Run-phase decision (this SPEC does NOT create a new
migration for message_sources; it uses meta_json first, migrates to column if
Phase 6 LLM eval requires filtering by corpus_type).
**근거:** CHAT Phase 2 schema 보존 원칙 + Phase 8 최소 침습.
**검증 방법:** Integration test: org citation → message_sources row with meta_json.corpus_type = 'org'.

---

### Group H: Admin UI (REQ-DOC-073 ~ REQ-DOC-078)

이 그룹은 관리자 포털 3 페이지 + middleware 강화 + Zod schema를 정의한다.

#### REQ-DOC-073 (Ubiquitous)
**요구사항:** The system SHALL define `app/(app)/admin/documents/page.tsx` rendering
a filtered list of organizational documents. Filters: `docClass` (8 options),
`projectId` (org's projects), `status` (8 options), `source` (6 options), `search`
(title + metadata search). The list SHALL paginate (TanStack Query infinite),
show status badges, and link to detail page.
**근거:** Phase 8 admin UI 요건.
**검증 방법:** Storybook snapshot + Vitest rendering test with mock 50 documents.

#### REQ-DOC-074 (Ubiquitous)
**요구사항:** The system SHALL define `app/(app)/admin/documents/upload/page.tsx`
rendering an upload form: drag-and-drop zone, docClass dropdown (mandatory),
projectId dropdown (optional), metadata JSON editor (per-class schema hints),
"Upload" button. The form SHALL use R2 presigned URL flow (REQ-DOC-018).
**근거:** Phase 8 admin UI 요건.
**검증 방법:** Playwright (Phase 6 통합) — upload flow E2E. Unit test: Zod schema validation.

#### REQ-DOC-075 (Ubiquitous)
**요구사항:** The system SHALL define `app/(app)/admin/documents/[id]/page.tsx`
rendering: metadata panel (editable for admin), chunk preview (top 10 chunks by
section_path), redaction preview (redacted_file_r2_key rendered inline), status
history (from audit_logs filtered by document_id), re-process button (re-runs
ingestion pipeline).
**근거:** Phase 8 admin UI 요건.
**검증 방법:** Storybook + Vitest. Integration test: re-process button → Inngest event emit.

#### REQ-DOC-076 (Ubiquitous)
**요구사항:** The system SHALL add middleware rules in `middleware.ts` restricting
`/admin/*` paths to users with `admin` or `ra-lead` role. Non-matching users SHALL
be redirected to `/403` with Korean error message "권한이 없습니다."
**근거:** research.md §10 — Non-Obvious Constraint #7 noindex 강화.
**검증 방법:** Integration test: ra-member → /admin/documents → redirect to /403. admin → access granted.

#### REQ-DOC-077 (Ubiquitous)
**요구사항:** The system SHALL define `app/(app)/admin/layout.tsx` emitting
metadata: `robots: { index: false, follow: false, noarchive: true, nosnippet: true }`
(강화된 noindex). This extends the base `(app)` layout noindex default.
**근거:** research.md §10 — admin portal noindex 강화.
**검증 방법:** Render `/admin/documents` → HTML head contains `noindex, nofollow, noarchive, nosnippet` 메타.

#### REQ-DOC-078 (Ubiquitous)
**요구사항:** The system SHALL define Zod schemas in `lib/schemas/documents.ts`
for the 8 DocClass × metadata_json structure: each class has a dedicated schema
(e.g., `ClearanceCertificateMetadata`, `FiveTenKSubmissionMetadata`,
`CERMetadata`). These schemas validate both the upload form input and the
stored metadata_json on read (post-migration drift detection).
**근거:** research.md §1.2 — class별 metadata 구조.
**검증 방법:** Zod schema unit test: valid payload → parse 성공, invalid → ZodError. 8 schemas 전부 export 확인.

---

## Acceptance Criteria 집계 (정량 목표)

| # | 지표 | 목표 | 측정 방법 |
|---|----|-----|---------|
| AC-1 | PII recall (HIPAA 18 identifier) | ≥ 99% | labeled 500 샘플 automated eval |
| AC-2 | PII precision | ≥ 95% | same eval |
| AC-3 | Document class classifier (heuristic) confidence for obvious cases | ≥ 80% | 100 filename 샘플 (MVP는 사용자가 수정 가능) |
| AC-4 | Tenant isolation | 0 cross-org leak | Red team integration test (교차 org SELECT / SQL injection payload) |
| AC-5 | `document.access` audit latency | ≤ 1s between request and row | integration test 10 requests |
| AC-6 | Redaction map access restriction | 0 `app_role` SELECT success | Postgres role integration test |
| AC-7 | 510(k) chunking section boundary accuracy | ≥ 90% | labeled 20 샘플 |
| AC-8 | CER chunking section boundary accuracy | ≥ 85% | labeled 20 샘플 |
| AC-9 | SOP chunking section boundary accuracy | ≥ 95% | labeled 20 샘플 |
| AC-10 | Internal docs retrieval P95 latency (10K chunks, K=8) | ≤ 300ms | Benchmark test (excluding embedding API call) |
| AC-11 | Ingestion pipeline end-to-end (10MB PDF) | ≤ 30s total | integration test |
| AC-12 | Admin UI access restriction | ra-member redirect to /403 | Playwright |
| AC-13 | ACL N+1 prevention | 1 ACL computation per document in list | benchmark with 50-doc list |
| AC-14 | Ingestion failure recovery | Inngest step retry up to 3 | integration test with mock 5xx |
| AC-15 | `document.upload_duplicate_skipped` on SHA-256 match | 0 new rows, 1 audit entry | integration test |

---

## Non-Obvious Constraints 매트릭스 Phase 8 기여

CLAUDE.md의 7개 Non-Obvious Product Constraints에 대한 Phase 8 단계별 진행:

| # | Constraint | Phase 8 기여 |
|---|----------|----------|
| 1 | Citation 강제 | **확장** — `[Org · ...]` prefix 규약 도입, citation-enforce.ts 확장, message_sources.meta_json에 `corpus_type: 'org'` 기록 |
| 2 | SSE 다단계 | 무영향 (protocol 변경 없음) |
| 3 | Expert-review 게이팅 | **강화** — critical_phi 문서 retrieval 시 `expert_review_required = true` 자동 발행 (REQ-DOC-071) |
| 4 | Audit 기록 | **전면 wiring** — 6 신규 audit action enum (`document.*`, `redaction_map.access`), 모든 read/search/upload 이벤트 기록, audit-completeness static analyzer에 Phase 8 Handler 포함 |
| 5 | Serif 타이포 | 관리자 UI도 Phase 1 tokens.css 상속 — 무영향 |
| 6 | ko/en 이중언어 | 관리자 UI 한국어 우선 (docClassLabels.ko), 규제 terminology glossary는 BREADTH 재사용 |
| 7 | noindex | **강화** — `/admin/*` 경로는 `noindex, nofollow, noarchive, nosnippet` 4중 메타 (REQ-DOC-077) |

---

## Risks

research.md §11 Risks에서 상세. 요약:

| ID | Risk | 영향도 | 완화 |
|---|------|------|----|
| R-DOC-01 | PII redaction 누락 | Critical | 3-layer + 정기 audit + critical_phi_mode |
| R-DOC-02 | Tenant isolation 우회 | Critical | RLS + red team test + ESLint rule |
| R-DOC-03 | redaction_maps 유출 | High | AES + RLS + role 분리 + audit |
| R-DOC-04 | OAuth rate limit | Medium | exponential backoff + Inngest retry |
| R-DOC-05 | 대용량 처리 시간 | Medium | R2 streaming + Inngest long-running step |
| R-DOC-06 | 문서 분류 오분류 | Medium | 사용자 수동 + heuristic 추천 |
| R-DOC-07 | Cross-ref 오류 | Critical | withTenantScope 필수 ESLint |
| R-DOC-08 | OCR 미지원 누락 | Medium | quarantine + admin 알림 |
| R-DOC-09 | 개정 체인 누락 | Medium | version + supersedes_doc_id |
| R-DOC-10 | 관측성 PII 유출 | Critical | audit vs 관측성 분리 CI gate |

---

## Pending Decisions

| DP | 항목 | 재평가 시점 |
|---|-----|---------|
| DP-1 | pgvector vs Vectorize dual-write | CLOUDFLARE SPEC 확정 후 |
| DP-2 | 한국어 PII 품질 (Workers AI vs Presidio spaCy ko) | Phase 8 Run 중 benchmark |
| DP-3 | OAuth state 컬럼 key 분리 | Post-launch 보안 감사 후 |
| DP-4 | ML 기반 문서 자동 분류 | labeled data > 500건 후 Phase 9 |
| DP-5 | 관리자 포털 레이아웃 (shell 재사용 vs 전용) | Phase 9 Kickoff |

---

## 의존 SPEC 인터페이스 요약

**FOUNDATION v0.4.0:**
- audit_logs.action pgEnum 확장 (6 신규 값)
- organizations 테이블 컬럼 확장 (OAuth state)
- source_sections 테이블은 영향 없음 (공개 corpus 전용)

**BREADTH v0.2.0:**
- router.ts intent 매핑 확장 (+2 intent, public+org 병행)
- merge.ts `corpusType` 필드 추가
- internal-sops.ts deprecate 권고 (실제 rename은 Phase 9)

**ENTERPRISE v0.2.0:**
- withPermission 확장 (4 신규 permission)
- audit-completeness CI gate 자동 포함

**LAUNCH v0.1.0:**
- launch_readiness_checklist에 Phase 8 항목 5개 추가 (LR-DOC-01 ~ 05)

**CLOUDFLARE (병렬):**
- R2 bucket + Email Workers + (optional) Vectorize 의존

---

## Definition of Done (DoD)

Phase 8 완료 시 다음 조건 **전부** 만족:

1. 78 REQ-DOC-001 ~ 078 전부 구현 및 Vitest pass
2. AC-1 ~ AC-15 정량 지표 전부 목표 달성
3. migrations/0010 + 0011 프로덕션 DB 적용 (RLS + private schema + role 분리)
4. 8-class seed data + 32 default access policies 삽입
5. admin portal 3 페이지 live
6. Phase 8 Handler 전부 audit-completeness CI gate 통과 (0 violations)
7. ESLint custom rule `require-tenant-scope-for-documents` 활성화, 위반 0건
8. Red team integration test (cross-org leak + SQL injection) 0 leak
9. Inngest workflow `docingest.document.created` end-to-end 동작 확인
10. Phase 6 LAUNCH에 LR-DOC-01 ~ 05 readiness 항목 추가 및 reserved

---

## 문서 유지보수 정책

- Phase 8 REQ 번호는 추후 audit에서 suffix (예: REQ-DOC-029a) 추가만 허용. 재번호 금지
- Phase 9 Kickoff 시 DP-1 ~ DP-5 재평가 → 본 SPEC에 revision 추가
- CLOUDFLARE SPEC v0.1.0 공표 후 본 SPEC에 R2 key naming 규약 동기화 revision
- research.md와 본 SPEC은 상호 참조: research는 근거, SPEC은 요구사항

---

## 부록 A: Chunker Registry 상세 (14 chunkers)

각 class별 dedicated chunker의 매핑 테이블. REQ-DOC-054의 registry 구현 참조용.

| DocClass | Chunker File | 기반 표준 | Section 수 | Boundary Accuracy 목표 |
|---------|-------------|---------|----------|----------------------|
| `issued_certificate` | `certificate.ts` | FDA Letter + MDR Certificate 포맷 | 1 (단일 chunk) | 100% (단순) |
| `submission_success` | `submission-510k.ts` + `submission-eu-mdr.ts` + `submission-mfds.ts` | 21 CFR 807.87 + MDR Annex II+III + MFDS 허가 규정 | 7~15 / class | ≥ 90% |
| `submission_inprogress` | 동일 (submission_success chunkers) | 동일 | 7~15 | ≥ 90% |
| `clinical_report` | `cer-meddev.ts` + `per.ts` + `csr-ich-e3.ts` | MEDDEV 2.7/1 rev4 + IVDR PER + ICH E3 | 7~13 / class | ≥ 85% |
| `checklist_template` | `checklist-template.ts` | GSPR / ER / DoC 템플릿 | 항목별 chunk (~20~50 items) | ≥ 92% (항목 boundary) |
| `surveillance_report` | `pms-psur.ts` + `mdr-report.ts` | EU MDR Art. 86 PSUR + FDA MDR | 6~10 / class | ≥ 85% |
| `internal_sop` | `sop-iso13485.ts` | ISO 13485:2016 4-8 + 조직 템플릿 | 3-part (header + history + body) | ≥ 95% |
| `audit_response` | `fda-483-response.ts` + `mdsap-capa.ts` | FDA 483 포맷 + MDSAP CAPA | Observation별 N chunks | ≥ 90% |
| (fallback) | `generic.ts` | Heading-based + fixed-size | N/A | N/A (fallback) |

---

## 부록 B: HIPAA Safe Harbor 18 Identifier → Redaction Layer 매핑

Research.md §2.1 기반 상세 매핑. 각 identifier가 어느 layer에서 포착되는지 명시.

| # | Identifier | Layer 1 (regex) | Layer 2 (Workers AI) | Layer 3 (Presidio) | Notes |
|---|-----------|:-:|:-:|:-:|------|
| 1 | Names | — | O | O | Workers AI PERSON entity |
| 2 | Geographic < state | — | O | O | LOCATION entity + ZIP pattern |
| 3 | Dates | — | O | O | DATE entity + year-only 허용 |
| 4 | Phone numbers | O | — | — | regex US+KR+E.164 |
| 5 | Fax numbers | O | — | — | 동일 phone regex |
| 6 | Email | O | — | — | RFC 5322 simplified |
| 7 | SSN | O | — | — | regex XXX-XX-XXXX |
| 8 | Medical record # | — | O | O | MEDICAL_RECORD_NUMBER entity |
| 9 | Health plan # | — | O | O | HEALTH_PLAN_NUMBER entity |
| 10 | Account # | — | — | O | Presidio US_ACCOUNT + custom |
| 11 | Certificate/license # | — | O | O | LICENSE_NUMBER entity |
| 12 | Vehicle identifier | — | — | O | Presidio US_DRIVER_LICENSE (VIN은 낮은 우선순위) |
| 13 | Device identifier/serial | — | — | O (선별) | **context-aware** — issued_certificate에서 보존 |
| 14 | Web URL | O | — | — | regex http/https |
| 15 | IP address | O | — | — | regex IPv4/IPv6 |
| 16 | Biometric | — | — | — | 바이너리 데이터, 텍스트 추출 범위 외 |
| 17 | Photos | — | — | — | 이미지, 텍스트 추출 범위 외 (OCR Phase 9 이후) |
| 18 | Other unique codes | — | O | O | PERSON + custom recognizers |

---

## 부록 C: Phase 8 Inngest Step Function 상세

REQ-DOC-021의 `docingest.document.created` 이벤트 처리 파이프라인 (Inngest step
function).

```
event: docingest.document.created
 └─ step 1: r2.fetch — download original from R2
 └─ step 2: extract.dispatch — MIME 기반 text extraction
      └─ status: extracting → extracted
 └─ step 3: pii.redact.layer1 — regex-based
 └─ step 4: pii.redact.layer2 — Workers AI
 └─ step 5 (conditional): pii.redact.layer3 — Presidio (critical_phi만)
      └─ status: redacting → redacted
 └─ step 6: chunk.dispatch — class 기반 chunker 호출
 └─ step 7: embed.batch — OpenAI embedding (batches of 100)
      └─ status: chunking → embedded
 └─ step 8: index.write — document_chunks INSERT + HNSW reindex
      └─ status: indexed
 └─ step 9 (audit): writeAudit(document.indexed) + admin notification
```

각 step은 Inngest step retry (max 3, exponential backoff) 대상이며, failure 시
`status = failed` + `source_meta_json.error` 저장 (REQ-DOC-022).

---

## 부록 D: 관리자 포털 URL 계층

| URL | 접근 권한 | 기능 |
|-----|---------|----|
| `/admin` | admin + ra-lead | 대시보드 (문서 count, quarantine 대기, 최근 업로드) |
| `/admin/documents` | admin + ra-lead | 문서 목록 + 필터 |
| `/admin/documents/upload` | admin + ra-lead | 업로드 폼 |
| `/admin/documents/[id]` | admin + ra-lead | 상세 + 재처리 |
| `/admin/documents/[id]/policies` | admin only | ACL 조정 |
| `/admin/documents/quarantine` | admin + ra-lead | quarantine 리뷰 큐 |
| `/admin/sources` | admin only | ingestion source 설정 (OAuth 연결) |
| `/admin/sources/google-drive` | admin only | Google Drive OAuth + 폴더 선택 |
| `/admin/sources/sharepoint` | admin only | SharePoint 설정 |
| `/admin/sources/email` | admin only | Email Workers allow-list |

모든 `/admin/*` 경로는 REQ-DOC-076 middleware 및 REQ-DOC-077 4중 noindex 메타 적용.

---

## 부록 E: Test Data Seed 전략

Phase 8 구현 단계에서 필요한 seed 문서 (모두 **익명화·가공된 샘플**, 실제 조직
데이터 아님):

| Class | 샘플 수 | 출처 |
|------|------|----|
| `issued_certificate` | 5 | FDA 510(k) database 공개 clearance letter (재가공) |
| `submission_success` | 3 | FDA 510(k) Summary (공개 문서 재구성) |
| `submission_inprogress` | 2 | 가상 draft dossier (구조만 참조) |
| `clinical_report` | 2 | MDCG 공개 CER 샘플 + 가상 데이터 |
| `checklist_template` | 3 | MDCG GSPR checklist 공개본 |
| `surveillance_report` | 2 | EU PSUR 구조 샘플 + FDA MDR 공개 데이터 |
| `internal_sop` | 5 | ISO 13485 템플릿 재가공 |
| `audit_response` | 3 | FDA 483 Form 공개본 + 가상 응답 |

**합계**: 25 샘플. 모두 PII-free (가상 이름 / 더미 주소 / 익명 환자 ID).
labeled data (boundary accuracy 측정용)와 동일 파일 재사용.

---

## 부록 F: TRUST 5 Compliance

MoAI 원칙에 비추어 Phase 8 SPEC의 TRUST 5 준수 검증:

| 축 | 준수 내용 |
|----|--------|
| **Tested** | 78 REQ 전부 Vitest + Integration test 검증 방법 명시, 15 AC 정량 지표, Red team 테스트 포함 |
| **Readable** | 8 그룹(A~H) 구조 명확, research.md 1000+ lines 상세 근거, 한국어 label + 영어 identifier 이중 |
| **Unified** | BREADTH retriever 시그니처 호환, ENTERPRISE withPermission 확장, FOUNDATION pgEnum 확장 패턴 재사용 |
| **Secured** | 3-layer PII + RLS + private schema + role 분리 + audit 전면 wiring + noindex 4중 + AES 암호화 |
| **Trackable** | 각 REQ에 근거 (handoff section / research.md 참조), 10 technical decisions + 5 DP 재평가 조건 명시, revision_history YAML |

---

## 부록 G: 완료 서명 (Sign-off Checklist)

Phase 8 SPEC v0.1.0이 PROCEED_TO_PHASE_8 준비 완료 판정 받기 위해 충족해야 할
조건:

- [x] research.md 작성 완료 (1000+ lines)
- [x] spec.md 작성 완료 (1100+ lines 목표, 78 REQ-DOC)
- [x] 8 그룹 REQ 분포 적절 (A 10 / B 15 / C 10 / D 10 / E 10 / F 10 / G 7 / H 6)
- [x] 10 technical decisions 명시
- [x] 15 Acceptance Criteria 정량 지표
- [x] Non-Obvious Constraints 매트릭스 작성
- [x] 10 Risks 식별 + 완화 전략
- [x] 의존 SPEC 인터페이스 요약
- [x] Pending Decision Points 5개
- [x] 부록 A~G (chunker registry, HIPAA 매핑, Inngest step, 관리자 URL, seed, TRUST 5, sign-off)
- [ ] plan-auditor 1차 감사 (audit-001)
- [ ] compliance-qa 승인
- [ ] PROCEED_TO_PHASE_8 verdict

---

*End of SPEC-REGULA-DOCINGEST-001 v0.1.0*

---

## Implementation Notes (v1.0.0 — 2026-05-04)

Phase 8 전체 구현 완료. 78/78 REQ-DOC 충족.

### 구현 커밋

| 커밋 | 범위 | 내용 |
|------|------|------|
| `5f8c9df` | Phase 8A+8B | DocClass enum, DB 스키마, RLS, PII Layer 1, ACL 기반 |
| `4500868` | Phase 8C-8E | 인제스트 파이프라인, 소스 핸들러, 청킹, Admin UI |

### 주요 구현 파일

- `lib/ingest/` — 분류기, 민감도 매핑, PII 3-layer, 추출기, 청커 14종
- `lib/ingest/sources/` — manual-upload, google-drive, sharepoint, dropbox, email-workers
- `lib/inngest/docingest/` — Inngest step-function pipeline
- `lib/ai/retrievers/internal-docs.ts` — hybrid search + ACL + tenant 격리
- `app/(app)/admin/documents/` — Admin Portal 3 pages
- `migrations/0017_docingest_schema_fix.sql` — 스키마 수정

### 검증 결과

- Tests: 1622 total (1616 pass, 6 skip)
- TypeScript: `tsc --noEmit` → 0 errors
- 78/78 REQ-DOC 구현 완료
- GitHub Issue #10 CLOSED

### Definition of Done 최종 확인

- [x] 78 REQ-DOC-001~078 전부 구현
- [x] 3-layer PII redaction (Regex + Workers AI GLiNER + Presidio)
- [x] DB-level tenant isolation (RLS + withTenantScope)
- [x] 8-class × 4-role ACL 매트릭스 + 32 seed policies
- [x] 14 class-specific chunkers + generic fallback
- [x] hybrid search retriever P95 < 300ms
- [x] expert_review_required=true for clinical_report/audit_response
- [x] Admin Portal 3 pages + middleware RBAC
- [x] Inngest step-function pipeline (extract→redact→chunk→embed→index)
- [x] audit_logs wiring (6 document.* enum actions)
- [x] Vitest 1622 tests (1616 pass)

*End of SPEC-REGULA-DOCINGEST-001 v1.0.0*
