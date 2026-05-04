---
id: SPEC-REGULA-CER-001
version: 0.1.0
status: draft
phase: wave3
priority: High
created: 2026-05-04
updated: 2026-05-04
author: manager-spec (Regula harness)
issue_number: null
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
---

# SPEC-REGULA-CER-001 — EU MDR Annex XIV Clinical Evaluation Report Builder

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-05-04 | manager-spec (Regula harness) | Initial draft. Wave 3 SPEC absorbing former Phase 9 scope. 40 REQ across 4 groups (MEDDEV 10-stage / PubMed integration / Output / Audit). Reflects master-roadmap-v2 §4.3. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

EU MDR(Medical Device Regulation, Regulation (EU) 2017/745)은 모든 의료기기에 대해 임상평가(Clinical Evaluation)를 의무화한다. EU MDR **Article 61(1)**은 "임상평가는 제조자가 충분한 임상 증거를 수집·생성·평가하여 기기의 안전성과 성능 적합성을 입증하는 체계적·계획적·지속적 프로세스"로 정의하며, 그 결과물은 **Clinical Evaluation Report (CER)** 로 문서화되어야 한다. CER은 EU MDR **Annex XIV (Clinical Evaluation and Post-Market Clinical Follow-up)** 에 명시된 구조와 내용을 따라야 하며, Notified Body 심사 시 핵심 제출 자료가 된다.

현재 Regula 운영 환경에서 RA 담당자는 다음과 같은 어려움을 겪는다:
- **MEDDEV 2.7/1 Rev4** (CER 작성 가이드라인) 의 10단계 구조를 매번 수작업으로 구성
- **PubMed** 등 학술 DB에서 50+ 편의 임상 문헌을 수동 검색·리뷰 (1 CER 당 최소 40~80시간 소요)
- **Article 61(4) 동등성(equivalence) 주장**의 3차원 비교표(임상/기술/생물학적) 작성 누락 시 NB 심사 지적 사항으로 이어짐
- 인용한 문헌의 **SIGN 50 / GRADE evidence level** 평가가 정성적·주관적으로 흐름

본 SPEC은 Wave 3에서 위 작업을 **반자동화(semi-automated)** 하는 CER Builder를 구축한다. 자동화 대상은 (1) MEDDEV 10단계 템플릿 골격, (2) PubMed E-utilities API 기반 문헌 검색 50+, (3) LLM 보조 SIGN 50/GRADE 평가, (4) Article 61(4) 비교표 자동 생성, (5) DOCX/PDF 출력이다. **법적 책임이 따르는 동등성 주장과 최종 결론은 expert review gate를 통해 RA-lead 승인 후에만 "Submission-ready" 상태로 전환된다.**

### 1.2 EU MDR 법적 근거 (Regulatory Anchor)

- **Article 61 (Clinical Evaluation)**: §1 임상평가 의무 / §4 동등 기기 임상 데이터 사용 조건
- **Annex XIV Part A (Clinical Evaluation)**: §1 임상평가 일반 요건 / §3 CER 구조와 내용
- **Annex XIV Part B (Post-Market Clinical Follow-up)**: PMCF 계획·보고서 (cross-link to PMCF-Plan workflow)
- **MEDDEV 2.7/1 Rev4** (2016): EU 집행위 임상평가 작성 가이드 (10단계 구조 기준)
- **MDCG 2020-13**: MEDDEV 2.7/1 Rev4를 보완·일부 대체하는 최신 가이드 (RADAR가 transition을 추적)

### 1.3 본 SPEC의 범위 (In Scope)

- MEDDEV 2.7/1 Rev4 기반 10단계 CER 위저드 UI (`app/(app)/workflows/cer/page.tsx`)
- PubMed E-utilities API 통합 + 50+ 자동 인용
- Article 61(4) 동등성 비교표 빌더 (`lib/cer/equivalence-builder.ts`)
- SIGN 50 / GRADE 휴리스틱 평가 (`lib/cer/literature-appraisal.ts`)
- DOCX / PDF 출력 + draft watermark
- 21 CFR Part 11 호환 audit trail (5종 audit_action)

---

## §2 Goals and Non-Goals

### 2.1 Goals

| # | Goal | 성공 지표 (KPI) |
|---|------|-----------------|
| G1 | MEDDEV 10단계 골격 자동 생성 | 10단계 모두 템플릿 제공 + 누락 stage validate |
| G2 | PubMed 문헌 검색 자동화 | 1회 검색당 ≥50 abstract 반환, rate limit 준수 |
| G3 | SIGN 50 / GRADE 평가 LLM 보조 | LLM 1차 평가 + 사용자 override 100% 가능 |
| G4 | Article 61(4) 동등성 3차원 비교표 자동 생성 | 임상/기술/생물학적 3섹션 모두 강제 |
| G5 | Submission-ready CER 출력 (DOCX/PDF) | Vancouver 인용 형식 + draft watermark 분기 |
| G6 | 21 CFR Part 11 audit trail | 5종 audit_action 100% 기록 |

### 2.2 Non-Goals

- **CER 자동 승인(auto-approval)**: 모든 최종 CER은 RA-lead의 명시적 승인이 필요하다. LLM은 draft 생성과 보조에만 사용된다.
- **Article 61(4) 동등 기기 기술 문서 자동 입수**: 동등 기기 제조자의 기술 문서 접근은 법적·계약적 의무이며 시스템이 자동화할 수 없다. 시스템은 disclaimer를 강제 표시하고 사용자가 수동 입력한다.
- **Notified Body와의 직접 통합**: NB 제출 채널(EUDAMED 포함)은 본 SPEC 범위 밖이다. CER는 DOCX/PDF로 출력되어 사용자가 별도 채널로 제출한다.
- **임상시험 데이터 자동 수집**: Stage 6의 Clinical Investigation Data는 사용자 수동 입력 또는 외부 시스템(향후 SPEC) 연동을 가정한다.
- **PMS/Vigilance 데이터 자동 통합**: Stage 7 PMCF data는 PMCF-Plan workflow와 cross-link만 제공한다. 자동 데이터 가공은 별도 SPEC.
- **MDCG 2020-13 전체 자동 마이그레이션**: MEDDEV 2.7/1 Rev4 → MDCG 2020-13 transition은 RADAR가 감지하여 banner로 알리되, 템플릿 자동 변환은 본 SPEC 범위 밖이다.

---

## §3 Functional Requirements (40 REQ, EARS Format)

각 REQ는 다음 구조를 따른다: EARS 문장 / 근거(rationale) / 검증 방법(verification).

### Group A — MEDDEV 2.7/1 Rev4 10-Stage CER Structure (REQ-CER-001 ~ REQ-CER-015)

#### REQ-CER-001 — Stage 1: Scope of Clinical Evaluation

**Statement**: The system SHALL provide a structured form for defining the scope of clinical evaluation, capturing (a) device description, (b) intended purpose, (c) claims to be evaluated, (d) applicable regulations (EU MDR 2017/745 Annex XIV), (e) evaluation period.

**근거**: MEDDEV 2.7/1 Rev4 §6.1 — Stage 0/1은 모든 후속 단계의 기준점이며, scope 누락 시 NB가 CER 전체를 기각할 수 있다.

**검증**: E2E 테스트로 Stage 1 form의 5개 필수 필드 모두 입력 검증, 누락 시 다음 단계 진입 차단 확인.

#### REQ-CER-002 — Stage 2: Current State of the Art

**Statement**: The system SHALL use the existing RAG pipeline (from SPEC-REGULA-BREADTH-001 EU MDR retriever) to retrieve current state-of-the-art information relevant to the device category, returning top-10 cited regulations and standards.

**근거**: MEDDEV 2.7/1 Rev4 §8 — State of the art는 동등성 주장과 risk-benefit 분석의 기준선이다. BREADTH retriever 재사용으로 일관성 확보.

**검증**: Top-10 결과의 `source_id`가 모두 BREADTH retriever의 EU MDR / harmonised standards 코퍼스에서 유래함을 확인.

#### REQ-CER-003 — Stage 3: Equivalence Assessment (Article 61(4))

**Statement**: The system SHALL generate a comparison table for Article 61(4) equivalence claim across 3 dimensions: clinical (same intended purpose, same conditions of use, same target population), technical (same design, same materials, same specifications), biological (same materials in contact with tissue/body fluids).

**근거**: EU MDR Article 61(4) — 동등성 주장은 3차원 모두를 충족해야 하며, 누락 시 동등성 주장 자체가 무효이다.

**검증**: 동등성 비교표 컴포넌트의 3개 섹션(clinical/technical/biological)이 항상 렌더링되며, 각 섹션에 최소 1행 입력 강제.

#### REQ-CER-004 — Equivalence Disclaimer

**Statement**: The system SHALL display a mandatory disclaimer: "Equivalence claims under Article 61(4) require manufacturer access to the equivalent device's technical documentation. Legal obligation cannot be automated."

**근거**: EU MDR Article 61(5) — 동등 기기 기술 문서 접근 의무는 제조자의 법적 책임이며, 시스템이 자동 검증할 수 없는 영역임을 사용자에게 명시.

**검증**: Stage 3 페이지 진입 시 disclaimer가 dismissible-but-logged 형태로 표시되고, audit log에 disclaimer 노출 이벤트 기록.

#### REQ-CER-005 — Stage 4: Literature Search (PubMed)

**Statement**: The system SHALL execute a systematic literature search via PubMed E-utilities API (esearch + efetch) using device-specific search terms (MeSH terms + free text), returning at minimum 50 abstracts.

**근거**: MEDDEV 2.7/1 Rev4 Appendix 2 — 체계적 문헌 검색은 CER의 핵심 evidence base이며, 최소 50편은 EU NB 심사 관행상 권장 임계값.

**검증**: PubMed API mock으로 50개 미만 반환 시 경고 표시, 50개 이상 반환 시 정상 진행.

#### REQ-CER-006 — Search Strategy Documentation

**Statement**: The system SHALL automatically document the literature search strategy: database (PubMed), date range, search terms, Boolean operators, inclusion/exclusion criteria, in a format compliant with MEDDEV 2.7/1 Rev4 Appendix 2.

**근거**: NB 심사 시 검색 전략의 재현성(reproducibility)이 요구된다. 검색 매개변수가 자동 기록되어야 누락이 없다.

**검증**: Stage 4 완료 시 search strategy JSON이 `workflow_runs.metadata`에 저장되고 Annex II로 export 가능 확인.

#### REQ-CER-007 — Stage 5: Literature Appraisal (SIGN 50 / GRADE)

**Statement**: The system SHALL apply SIGN 50 evidence levels (1++ to 4) and GRADE (High/Moderate/Low/Very Low) quality ratings to each retrieved clinical paper using LLM heuristics (Claude `claude-haiku-4-5-20251001`). User SHALL review and may override each rating.

**근거**: MEDDEV 2.7/1 Rev4 Appendix 5 — 임상 문헌의 evidence level 평가는 CER 결론의 신뢰도 기준. Haiku 사용으로 비용 최적화 (G4 risk R4 대응).

**검증**: 50편 평가 시 평균 비용 ≤$0.50 (Haiku 단가 기준), 사용자 override UI가 모든 행에 노출 확인.

#### REQ-CER-008 — Stage 6: Clinical Investigation Data

**Statement**: The system SHALL provide a structured input form for entering clinical investigation data (if applicable): study design, number of subjects, endpoints, results, adverse events, statistical analysis.

**근거**: MEDDEV 2.7/1 Rev4 §9.3 — 자체 임상시험 데이터가 있는 경우 CER에 통합되어야 한다. 없는 경우 N/A 명시.

**검증**: 사용자가 "No clinical investigation conducted" 체크박스 선택 시 Stage 6 skip 가능, 그 외에는 6개 필수 필드 입력 강제.

#### REQ-CER-009 — Stage 7: Post-Market Clinical Follow-up Data

**Statement**: The system SHALL provide a structured input for Post-Market Clinical Follow-up (PMCF) data from the PMCF plan/report, including complaint rates, serious adverse event rates, field safety corrective actions.

**근거**: EU MDR Annex XIV Part B — PMCF는 CER의 지속적 업데이트 근거. 본 SPEC은 입력 필드만 제공, 데이터 가공은 별도 SPEC.

**검증**: PMCF 데이터 4개 필드 입력 가능 + 단위(rate/yr 등) 검증.

#### REQ-CER-010 — Stage 8: Risk-Benefit Analysis

**Statement**: The system SHALL use RAG-retrieved clinical evidence and user-entered clinical data to generate a structured risk-benefit summary, explicitly citing the evidence source for each benefit and risk claim.

**근거**: MEDDEV 2.7/1 Rev4 §10 — risk-benefit 분석은 모든 benefit/risk 주장에 evidence trace가 있어야 한다. 미인용 시 NB 지적 1순위.

**검증**: 생성된 risk-benefit 텍스트의 모든 claim이 footnote citation 또는 inline reference를 가지고 있는지 정규식 검증.

#### REQ-CER-011 — Stage 9: Conclusions

**Statement**: The system SHALL auto-generate a CER conclusions section based on completed stages 1-8, including: overall clinical evidence adequacy determination, residual risks acceptable determination, post-market surveillance adequacy statement. User MUST review and approve.

**근거**: MEDDEV 2.7/1 Rev4 §11 — Conclusions는 CER의 핵심 결정사항이며 RA-lead 승인 필수.

**검증**: Stage 9 생성된 결론은 항상 "DRAFT — pending review" 상태로 시작, 사용자 명시적 승인 액션 후에만 finalize.

#### REQ-CER-012 — CER Completeness Check

**Statement**: The system SHALL validate completeness of all 10 MEDDEV stages before allowing export. Missing mandatory sections SHALL be flagged with specific remediation guidance.

**근거**: 미완성 CER export 방지로 NB 제출 사고 차단.

**검증**: 10단계 중 1개라도 미완성 상태에서 export 버튼 클릭 시 차단 + 미완성 stage 목록 표시.

#### REQ-CER-013 — Expert Review Gate

**Statement**: The system SHALL require expert review (RA-lead role) before final CER export. A CER without expert approval SHALL be marked "DRAFT — Not for Submission".

**근거**: 21 CFR Part 11 + EU MDR Article 10(9) — 품질경영시스템 책임자 검토 의무.

**검증**: `auth.users.role === 'ra-lead'` 사용자만 approve 버튼 가능, 그 외 사용자는 read-only.

#### REQ-CER-014 — Annex Templates

**Statement**: The system SHALL provide pre-populated Annex templates (Annex I: Device description, Annex II: Search strategy, Annex III: Literature appraisal table, Annex IV: Clinical evaluation summary, Annex V: PMCF plan template).

**근거**: MEDDEV 2.7/1 Rev4 Annex 구조 표준화로 NB 심사 일관성 확보.

**검증**: 5종 Annex 템플릿 파일 (`lib/cer/annexes/*.ts`) 존재 + 각 템플릿 export 시 자동 채움 확인.

#### REQ-CER-015 — Regulatory Guidance Reference

**Statement**: The system SHALL display inline references to MEDDEV 2.7/1 Rev4 section numbers for each stage. When RADAR detects an update to MEDDEV 2.7/1 Rev4 (or transition to MDCG 2020-13), the system SHALL display a banner warning that templates may need updating.

**근거**: MEDDEV 2.7/1 Rev4 → MDCG 2020-13 transition (R3 risk) 사용자 가시성 확보.

**검증**: RADAR가 'meddev-2.7.1' 또는 'mdcg-2020-13' tag의 update 발견 시 CER builder 페이지 상단 banner 표시.

---

### Group B — PubMed Integration (REQ-CER-016 ~ REQ-CER-025)

#### REQ-CER-016 — PubMed E-utilities API Integration

**Statement**: The system SHALL integrate with NCBI E-utilities API (`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`) for literature search using esearch and efetch endpoints.

**근거**: PubMed은 무료 공식 API를 제공하며, MEDDEV 2.7/1 Rev4가 권장하는 1순위 임상 DB.

**검증**: `lib/cer/pubmed-client.ts`의 esearch + efetch 함수가 실제 NCBI 응답 스키마와 일치 (E2E test against NCBI test endpoint).

#### REQ-CER-017 — Rate Limiting

**Statement**: The system SHALL enforce NCBI rate limits: 3 requests/second without API key, 10 requests/second with `NCBI_API_KEY` environment variable. Exceeding rate SHALL queue requests with exponential backoff.

**근거**: NCBI 정책 위반 시 IP 차단 위험 (R1 risk).

**검증**: Burst 100개 동시 요청 시 throttling이 적용되어 rate limit 위반 0회 확인.

#### REQ-CER-018 — Search Result Volume

**Statement**: The system SHALL retrieve a minimum of 50 abstracts per literature search. If fewer than 50 results exist, the system SHALL display a warning about limited literature availability.

**근거**: NB 심사 관행상 50편 미만은 "insufficient evidence" 지적 위험.

**검증**: PubMed mock 30개 반환 시 warning UI 표시, 50개 이상 시 warning 미표시.

#### REQ-CER-019 — Abstract Retrieval

**Statement**: The system SHALL retrieve full abstracts (not just titles) for all results. If abstract is not available, title + MeSH terms SHALL be used as substitute.

**근거**: Abstract 없는 인용은 SIGN 50 평가 불가.

**검증**: Mock으로 abstract null 반환 시 fallback (title + MeSH) 데이터로 평가 진행 확인.

#### REQ-CER-020 — Citation Formatting (Vancouver Style)

**Statement**: The system SHALL format retrieved citations in Vancouver style (required for EU MDR submissions) with: author(s), title, journal, year, volume, pages, DOI.

**근거**: Vancouver는 EU NB 제출 표준 인용 스타일.

**검증**: Citation formatter 단위 테스트 — 입력 PubMed JSON → 출력 Vancouver 문자열 정확성 확인.

#### REQ-CER-021 — Duplicate Detection

**Statement**: The system SHALL detect and de-duplicate identical PMIDs in search results before displaying to user.

**근거**: 중복 인용은 evidence base 신뢰도 훼손.

**검증**: 동일 PMID 3회 포함된 mock 결과에서 1개만 노출 확인.

#### REQ-CER-022 — PubMed Result Caching

**Statement**: The system SHALL cache PubMed search results in Cloudflare KV with 7-day TTL (literature changes less frequently than regulatory data).

**근거**: 동일 검색 반복 시 NCBI API 부하·rate limit 회피, 비용 절감.

**검증**: 동일 검색어 재요청 시 KV cache hit 확인 (응답 시간 ≤100ms).

#### REQ-CER-023 — Relevance Ranking

**Statement**: The system SHALL rank PubMed results by relevance to the device's intended purpose using the existing Cohere Rerank model.

**근거**: PubMed 기본 정렬은 게재일 기준이며, intended purpose 관련성 정렬이 RA에게 더 유용.

**검증**: Top-10 결과의 평균 rerank score ≥0.6 확인 (intended purpose 텍스트 기준).

#### REQ-CER-024 — Literature Exclusion Tracking

**Statement**: The system SHALL track which retrieved papers were included/excluded, with the user-entered exclusion reason for each excluded paper, to satisfy MEDDEV 2.7/1 Rev4 Appendix 2 documentation requirements.

**근거**: NB 심사 시 "왜 이 논문을 제외했는가" 추적 의무.

**검증**: Exclusion 액션 시 reason 입력 강제 (빈 문자열 reject), 결과가 Annex II에 포함 확인.

#### REQ-CER-025 — Full-Text Availability Indication

**Statement**: The system SHALL indicate for each abstract whether full-text is freely available (via PubMed Central) and provide a direct link.

**근거**: RA가 SIGN 50 평가 시 full-text 접근 여부가 평가 신뢰도에 영향.

**검증**: PMC ID가 있는 결과에 "Free Full Text" 배지 + PMC URL 링크 노출 확인.

---

### Group C — Output and Export (REQ-CER-026 ~ REQ-CER-035)

#### REQ-CER-026 — CER Document Assembly

**Statement**: The system SHALL assemble all completed stages into a single CER document with standardized section headings compliant with MEDDEV 2.7/1 Rev4 structure.

**근거**: 산발적 stage 데이터를 단일 문서로 통합해야 NB 제출 가능.

**검증**: 10단계 모두 채워진 fixture로 assemble 시 section heading 순서·레벨 정확성 확인.

#### REQ-CER-027 — DOCX Export

**Statement**: The system SHALL export the assembled CER as a Microsoft Word DOCX file with proper heading styles (H1/H2/H3), table formatting, and reference list.

**근거**: NB 제출 표준 포맷 1순위가 DOCX.

**검증**: 생성된 DOCX를 Word로 열어 heading style·TOC 자동 생성 확인.

#### REQ-CER-028 — PDF Export

**Statement**: The system SHALL export the assembled CER as PDF via headless browser or server-side rendering.

**근거**: NB 제출 표준 포맷 2순위 + EUDAMED 업로드 호환성.

**검증**: 생성된 PDF의 페이지 수, 폰트 임베딩, 검색 가능 텍스트 확인.

#### REQ-CER-029 — Draft Watermark

**Statement**: Draft CERs (before expert review approval) SHALL include a prominent "DRAFT — NOT FOR REGULATORY SUBMISSION" watermark on every page of exported documents.

**근거**: 미승인 CER의 실수 제출 방지 (사용자 실수 + 외부 유출 시).

**검증**: status='draft' 상태로 export 시 모든 페이지에 워터마크 확인, status='approved' 시 워터마크 미표시.

#### REQ-CER-030 — Version Control

**Statement**: Each CER save SHALL create a new version entry in `workflow_runs`. The system SHALL maintain all previous versions and allow viewing/exporting any previous version.

**근거**: 21 CFR Part 11 — 문서 변경 이력 보존 의무.

**검증**: 동일 CER 5회 수정 시 5개 version row 생성, 각 version export 가능 확인.

#### REQ-CER-031 — Template Customization

**Statement**: The system SHALL allow RA users to customize the CER template (add/remove sections, reorder stages) while preserving mandatory MEDDEV 2.7/1 Rev4 stages as non-removable.

**근거**: 디바이스 카테고리별 추가 섹션 (예: AI/ML 디바이스의 algorithm validation) 필요.

**검증**: 10개 mandatory stage 삭제 시도 시 거부, custom section 추가 가능 확인.

#### REQ-CER-032 — Progress Auto-Save

**Statement**: The system SHALL auto-save CER progress every 60 seconds. On browser refresh or session restore, incomplete CERs SHALL resume from last saved state.

**근거**: 장시간 작성(40~80시간) 도중 데이터 손실 방지.

**검증**: 60초 후 IndexedDB/server state 자동 동기화 확인, refresh 후 동일 stage 위치 복원.

#### REQ-CER-033 — CER Summary Report

**Statement**: The system SHALL generate a 1-page CER Summary report (for internal management review) showing: device, indication, evaluation date, key conclusions, expert reviewer, expert approval date.

**근거**: Exec 사용자(임원 1명)의 빠른 검토용.

**검증**: Summary report PDF가 정확히 1페이지, 6개 메타데이터 모두 포함 확인.

#### REQ-CER-034 — Cross-Reference to PMCF Plan

**Statement**: When a PMCF Plan workflow exists in `workflow_runs` for the same device, the CER builder SHALL display a link to it and allow importing PMCF data directly.

**근거**: CER Stage 7 (PMCF data) 입력 효율화 + 데이터 일관성.

**검증**: 동일 `device_id`의 PMCF workflow_run 존재 시 import 버튼 노출, 클릭 시 Stage 7 자동 채움 확인.

#### REQ-CER-035 — Submission Readiness Checklist

**Statement**: Before export, the system SHALL display a checklist: (1) All 10 MEDDEV stages completed, (2) ≥50 literature sources reviewed, (3) Expert review approved, (4) Annexes populated, (5) No outstanding "REVIEW NEEDED" flags.

**근거**: 사용자가 export 직전 최종 확인할 수 있는 readiness gate.

**검증**: 5개 항목 중 1개라도 미완성 시 export 차단, 모두 완료 시 진행 가능.

---

### Group D — Audit and Compliance (REQ-CER-036 ~ REQ-CER-040)

#### REQ-CER-036 — CER Creation Audit

**Statement**: The system SHALL record `audit_action = 'cer_created'` when a new CER is started, with device name and indication in metadata.

**근거**: 21 CFR Part 11 — 문서 생성 시점 추적 의무.

**검증**: CER 신규 생성 시 `audit_logs` row 생성 확인 (action, user_id, device 메타데이터).

#### REQ-CER-037 — Stage Completion Audit

**Statement**: The system SHALL record `audit_action = 'cer_stage_completed'` for each of the 10 MEDDEV stages, with stage number and completion timestamp.

**근거**: 단계별 완료 시점 추적으로 작업 progression NB 심사 시 입증.

**검증**: 10단계 순차 완료 시 10개 audit row 생성 확인.

#### REQ-CER-038 — Expert Approval Audit

**Statement**: The system SHALL record `audit_action = 'cer_expert_approved'` when expert review is completed, with reviewer identity and approval timestamp, compliant with 21 CFR Part 11.

**근거**: 21 CFR Part 11 §11.50 — electronic signature와 동등한 audit 기록.

**검증**: RA-lead 승인 시 audit_logs row + reviewer email + ISO timestamp 기록 확인.

#### REQ-CER-039 — Export Audit

**Statement**: The system SHALL record `audit_action = 'cer_exported'` for every document export, with format (DOCX/PDF), version number, and department of exporting user.

**근거**: 외부 유출 추적 + 부서별 export 감사.

**검증**: DOCX/PDF export 각각 1회당 audit row 1건, format/version/department 메타데이터 정확성 확인.

#### REQ-CER-040 — Literature Search Audit

**Statement**: The system SHALL record `audit_action = 'cer_literature_search'` with search terms, database, result count, and date range, to satisfy MEDDEV 2.7/1 Rev4 documentation trail requirements.

**근거**: 검색 전략 재현성 (REQ-CER-006와 보완) — audit log에도 별도 기록.

**검증**: PubMed 검색 1회당 audit_logs row 1건, search_terms JSON 형태 저장 확인.

---

## §4 Acceptance Criteria

다음 기준이 모두 충족되어야 SPEC-REGULA-CER-001이 "complete" 상태로 전환된다.

1. **AC-01** — `lib/cer/meddev-stages.ts` 파일이 존재하며 10단계 enum + 각 stage 메타데이터(name, description, mandatory_fields)를 export한다.
2. **AC-02** — `lib/cer/pubmed-client.ts`의 `searchPubMed()` 함수가 fixture 기반 단위 테스트에서 mock 응답을 정확히 파싱한다 (≥10 test cases).
3. **AC-03** — `lib/cer/literature-appraisal.ts`의 `appraiseSign50()` + `appraiseGrade()` 함수가 50편 mock 입력에 대해 평균 비용 ≤$0.50로 평가를 완료한다.
4. **AC-04** — `lib/cer/equivalence-builder.ts`의 `buildEquivalenceTable()`가 3차원(clinical/technical/biological) 모두 누락 시 validation error를 반환한다.
5. **AC-05** — `app/(app)/workflows/cer/page.tsx`가 10단계 wizard UI를 렌더링하며, Stage 1→10 순차 진행 + 누락 stage 차단이 E2E 테스트에서 검증된다.
6. **AC-06** — Article 61(4) disclaimer가 Stage 3 진입 시 1회 표시되고, dismiss 액션이 audit log에 기록된다 (REQ-CER-004).
7. **AC-07** — PubMed rate limiting이 burst 100 요청에 대해 NCBI 정책(3 req/s 또는 10 req/s) 위반 0회로 동작한다 (REQ-CER-017).
8. **AC-08** — DOCX export가 Microsoft Word 365에서 정상 열림 + heading style 자동 인식 + TOC 생성 가능하다 (REQ-CER-027).
9. **AC-09** — Draft CER export 시 모든 페이지에 "DRAFT — NOT FOR REGULATORY SUBMISSION" 워터마크 표시 (REQ-CER-029).
10. **AC-10** — Expert review gate가 `auth.users.role !== 'ra-lead'` 사용자의 approve 액션을 거부한다 (REQ-CER-013).
11. **AC-11** — 5종 audit_action(`cer_created`, `cer_stage_completed`, `cer_expert_approved`, `cer_exported`, `cer_literature_search`) 모두 `audit_logs` 테이블에 기록되며, integration 테스트에서 검증된다.
12. **AC-12** — RADAR가 'meddev-2.7.1' 또는 'mdcg-2020-13' tag의 update 감지 시 CER builder 상단에 banner가 표시된다 (REQ-CER-015).
13. **AC-13** — Submission readiness checklist 5개 항목 중 1개라도 미완성 시 export 버튼이 비활성화된다 (REQ-CER-035).
14. **AC-14** — PubMed 검색 결과 7-day Cloudflare KV cache hit/miss가 cache stats endpoint에서 확인 가능하다 (REQ-CER-022).
15. **AC-15** — Vancouver citation formatter 단위 테스트가 ≥20 PubMed JSON fixture에 대해 100% 통과한다 (REQ-CER-020).
16. **AC-16** — Cross-reference to PMCF Plan 기능이 동일 `device_id`의 PMCF workflow_run 존재 시 자동 노출 + import 가능 (REQ-CER-034).
17. **AC-17** — Annex I~V 5개 템플릿이 `lib/cer/annexes/` 하위에 존재하며 export 시 자동 채움 동작 (REQ-CER-014).

---

## §5 Implementation Notes

### 5.1 Key Files

| 파일 경로 | 책임 | REQ Mapping |
|-----------|------|-------------|
| `lib/cer/meddev-stages.ts` | MEDDEV 2.7/1 Rev4 10단계 정의 + 메타데이터 | REQ-CER-001 ~ 011 |
| `lib/cer/pubmed-client.ts` | PubMed E-utilities esearch/efetch + rate limiting + cache | REQ-CER-016 ~ 022, 025 |
| `lib/cer/literature-appraisal.ts` | SIGN 50 / GRADE LLM 휴리스틱 평가 | REQ-CER-007 |
| `lib/cer/equivalence-builder.ts` | Article 61(4) 3차원 비교표 | REQ-CER-003, 004 |
| `lib/cer/citation-formatter.ts` | Vancouver style 인용 변환 | REQ-CER-020, 021 |
| `lib/cer/cer-assembler.ts` | 10 stages → 단일 CER 문서 통합 | REQ-CER-026, 030, 031 |
| `lib/cer/exporters/docx.ts` | DOCX export (heading + watermark) | REQ-CER-027, 029 |
| `lib/cer/exporters/pdf.ts` | PDF export (server-side render) | REQ-CER-028, 029 |
| `lib/cer/annexes/*.ts` | Annex I~V 템플릿 5종 | REQ-CER-014 |
| `lib/cer/audit.ts` | 5종 cer_* audit_action 기록 | REQ-CER-036 ~ 040 |
| `app/(app)/workflows/cer/page.tsx` | 10단계 wizard UI 메인 페이지 | REQ-CER-001 ~ 015, 032 |
| `app/(app)/workflows/cer/_components/PubMedReview.tsx` | 50+ 문헌 리뷰 UI + include/exclude | REQ-CER-018, 023, 024 |
| `app/(app)/workflows/cer/_components/EquivalenceTable.tsx` | 3차원 동등성 비교표 컴포넌트 | REQ-CER-003 |
| `app/(app)/workflows/cer/_components/SubmissionChecklist.tsx` | Export 직전 readiness checklist | REQ-CER-035 |
| `app/api/ra/workflows/cer/route.ts` | CER CRUD + version 관리 | REQ-CER-030, 032 |
| `app/api/ra/workflows/cer/export/route.ts` | DOCX/PDF export endpoint | REQ-CER-027 ~ 029 |

### 5.2 Database Schema Additions

`lib/db/schema.ts` (Drizzle ORM)에 다음 테이블/필드 추가:

- `workflow_runs.workflow_type`에 `'cer'` enum 값 추가
- `workflow_runs.metadata`(JSONB)에 stage_progress, search_strategy, equivalence_claim 등 저장
- `cer_literature` (신규 테이블): `id`, `cer_run_id`, `pmid`, `title`, `abstract`, `vancouver_citation`, `sign50_level`, `grade_quality`, `included`, `exclusion_reason`, `created_at`
- `audit_logs.action` enum에 5종 cer_* 값 추가

### 5.3 External Dependencies

- **NCBI E-utilities**: 환경변수 `NCBI_API_KEY` (선택사항, 없으면 3 req/s)
- **Cohere Rerank**: 기존 BREADTH retriever와 공유 (별도 비용 추가 없음)
- **Claude Haiku 4.5**: SIGN 50/GRADE 평가 (Anthropic API key 기존 재사용)
- **PDF rendering**: 서버사이드 (Next.js API route + chromium headless or puppeteer)

### 5.4 Cost Optimization (R4 Risk Mitigation)

10단계 전체 자동 생성 시 token 비용:
- Stage 2 (state of art) RAG: ~5K tokens (Sonnet) ≈ $0.07
- Stage 5 literature appraisal (50편 × Haiku): ~50K tokens × $0.001/K ≈ $0.05
- Stage 8 risk-benefit (Sonnet, 인용 포함): ~10K tokens ≈ $0.15
- Stage 9 conclusions (Sonnet): ~5K tokens ≈ $0.07
- **Total per draft**: ≈ $0.34 (Haiku fallback 적극 활용 시 $0.50 이내 유지)

Sonnet 전체 사용 시 $5+로 폭증하므로, Stage 5는 반드시 Haiku 사용.

---

## §6 Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R1 | PubMed API rate limit 위반 (3 req/s without key) | Medium | High (IP 차단) | REQ-CER-017 throttling + exponential backoff + KV cache (REQ-CER-022) + `NCBI_API_KEY` 권장 |
| R2 | EU MDR Annex XIV 문구 자동 검증 어려움 | High | Medium | REQ-CER-013 expert review gate 강제 + REQ-CER-029 draft watermark + 모든 결론 사용자 명시적 승인 (REQ-CER-011) |
| R3 | MEDDEV 2.7/1 Rev4 → MDCG 2020-13 transition | Medium | High (template 업데이트 필요) | REQ-CER-015 RADAR가 transition 감지 시 banner 알림 + 템플릿 수동 업데이트 가이드 |
| R4 | Token cost 폭증 ($5+/draft Sonnet) | High | High | §5.4 Cost optimization — Stage 5는 Haiku 강제 (REQ-CER-007) + RAG 결과 재사용 |
| R5 | Article 61(4) 동등성 주장 자동화 불가 (법적 책임) | High | Critical | REQ-CER-004 disclaimer + 사용자 수동 입력 + audit log + RA-lead 승인 게이트 |

---

## §7 Dependencies

### 7.1 Hard Dependencies (선행 SPEC 완료 필수)

- **SPEC-REGULA-FOUNDATION-001**: Auth.js v5 RBAC (RA-lead role 식별), Drizzle schema (workflow_runs, audit_logs), Cloudflare KV cache infrastructure
- **SPEC-REGULA-BREADTH-001**: EU MDR retriever (Stage 2 state of art) + 기존 RAG pipeline + Cohere Rerank
- **SPEC-REGULA-DOCINGEST-001**: 문서 ingestion pipeline (Annex 템플릿 storage), pgvector 인덱스
- **SPEC-REGULA-WORKFLOWS-001**: Workflow runner 공통 인프라 (workflow_runs CRUD, status machine, audit hook)

### 7.2 Soft Dependencies (있으면 좋음)

- **SPEC-REGULA-RADAR-001** (완료): MEDDEV 2.7/1 Rev4 → MDCG 2020-13 transition 알림 (REQ-CER-015)
- **PMCF Plan workflow** (별도 SPEC, 미정): Cross-reference (REQ-CER-034)

### 7.3 External Service Dependencies

- NCBI E-utilities API (가용성 99%+)
- Anthropic Claude API (Haiku + Sonnet)
- Cohere Rerank API (기존 사용)
- Neon Postgres + pgvector
- Cloudflare Workers KV

---

## Exclusions (What NOT to Build)

본 SPEC 범위에서 **명시적으로 제외**되는 항목:

1. **CER 자동 최종 승인 (auto-approval)** — 모든 CER은 RA-lead 명시 승인 필수, 자동 승인 로직 구현 금지
2. **동등 기기 기술 문서 자동 입수** — Article 61(5) 제조자 의무, 시스템이 자동 수집·검증 불가
3. **Notified Body 직접 제출 채널 통합** — EUDAMED 자동 업로드, NB API 연동 모두 범위 밖
4. **임상시험 데이터 자동 수집** — Stage 6 데이터는 사용자 수동 입력 또는 외부 시스템 연동 (별도 SPEC)
5. **PMS/Vigilance 데이터 자동 가공** — Stage 7은 PMCF-Plan workflow와 cross-link만 제공, 데이터 변환 로직 제외
6. **MDCG 2020-13 자동 마이그레이션** — RADAR banner 알림만, 템플릿 자동 변환은 별도 SPEC
7. **CER 다국어 번역** — EU MDR 제출 언어(영어 또는 회원국 언어) 변환 자동화 제외
8. **임상 통계 분석 자동 수행** — Stage 6/8의 통계 계산(p-value, CI 등)은 사용자가 외부 도구로 수행 후 입력
9. **PubMed 외 추가 DB 통합** — Embase, Cochrane Library, Web of Science 등은 향후 별도 SPEC
10. **CER PDF에서 OCR 기반 metadata 추출** — 기존 CER 문서 import 자동화 제외 (수동 마이그레이션)

---

REQ coverage: REQ-CER-001 through REQ-CER-040 (40 REQ total)
Lifecycle level: spec-anchored (Wave 3 production-critical)
Estimated implementation effort: High (frontend wizard + 4 lib modules + PubMed integration + DOCX/PDF export)
