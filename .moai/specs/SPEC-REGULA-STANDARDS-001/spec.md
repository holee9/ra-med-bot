---
id: SPEC-REGULA-STANDARDS-001
version: 1.0.0
status: completed
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 62
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-CLASSIFY-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-STANDARDS-001 — 조화 표준 적용성 & 개정 추적기 (ISO/IEC/EN/ASTM 자동 매핑)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #62 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

규제 인허가의 핵심 증거는 조화 표준(Harmonized Standards) 준수다. CE 마킹은 EU 조화 표준(EN 60601, EN ISO 10993 등), FDA 510(k)는 Recognized Consensus Standards(ISO, ASTM 등) 준수를 통해 적합성 추정(Presumption of Conformity)을 받는다.

현재 Regula의 Regulatory Radar(Phase 10)는 FDA Federal Register, EU Official Journal, MFDS 공고 등 규제 기관 변경을 모니터링하지만, ISO/IEC/EN/ASTM 등 표준 기구의 개정은 추적하지 않는다. 그 결과 의료기기 회사는 "우리 기기에 어떤 표준이 적용되나?"를 수작업으로 수십 시간 조사하거나, IEC 60601-1-2 개정을 놓쳐 갱신 비용이 발생하거나, EU OJ 표준 개정 게재 후 유예기간을 놓쳐 비준수 제품을 출시하는 위험에 직면한다.

본 SPEC은 기기 분류 및 특성을 기반으로 적용 표준을 자동 매핑하고, 표준 기구(ISO, IEC, CEN, ASTM) 개정을 실시간 추적하여 영향 포트폴리오를 알린다. 표준 매핑 엔진은 분류 결과(SPEC-REGULA-CLASSIFY-001)를 입력받아 규칙 기반 + RAG 보조로 적용 표준 목록을 생성하며, cron 기반 표준 데이터베이스 모니터링이 개정을 감지하면 영향 분석과 알림 파이프라인을 거쳐 Regulatory Radar 및 Notifications Hub(#52)에 통합된다.

전환 기간(Transition Period) 및 철회일(Withdrawal Date)에 대해 D-12개월, D-6개월, D-3개월 단계 알림을 제공하여 비준수 위험을 사전에 차단한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA: Recognized Consensus Standards Database (Section 514(c) of FD&C Act), Presumption of Conformity
- EU: Harmonized Standards (Official Journal Series C), Presumption of Conformity under MDR
- 전기안전: IEC 60601 시리즈
- 생체적합성: ISO 10993 시리즈
- 소프트웨어: IEC 62304, IEC 62366
- 무균/멸균: ISO 11135, ISO 13485
- 위험관리: ISO 14971
- 포장: ISO 11607

### 1.3 본 SPEC의 범위 (In Scope)

- 표준 적용성 매핑: 분류 결과 → 적용 표준 목록 자동 생성, FDA Recognized Consensus Standards / EU Harmonized Standards 연동, 기기 특성별 표준 매핑
- 표준 데이터베이스 구축: ISO Online Browsing Platform 크롤러, IEC Webstore 메타데이터, ASTM Compass API, CEN OpenStandards 연동, 버전 이력 및 대체 관계 관리
- 표준 개정 알림 시스템: cron 기반 개정 감지, EU OJ 게재 → 전환 기간 자동 계산, 영향 제품 자동 식별, D-12/6/3개월 알림
- 표준 갭 분석: 현재 인증 표준 버전 vs 최신 버전 비교, 개정 사항 요약, 업데이트 필요 검증 항목 목록
- FDA 510(k) 인정 표준 체크: 인용 표준의 FDA 인정 여부 실시간 확인, 철회된 표준 경고, 대체 인정 표준 제안

### 1.4 Out of Scope

- 기기 분류 자체 (SPEC-REGULA-CLASSIFY-001 소관, 본 SPEC은 분류 결과 입력만)
- ISO 14971 위험관리 워크플로우 (#46 소관, 본 SPEC은 표준 준수 체크 연계만)
- 알림 채널 인프라 구축 (#52 Notifications Hub 소관, 본 SPEC은 알림 발행만)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-STANDARDS-001 | WHEN a device classification result is provided THE SYSTEM SHALL automatically generate a list of applicable standards. | High |
| REQ-STANDARDS-002 | WHEN applicable standards are generated THE SYSTEM SHALL integrate the FDA Recognized Consensus Standards Database. | High |
| REQ-STANDARDS-003 | WHEN applicable standards are generated THE SYSTEM SHALL integrate EU Harmonized Standards from the Official Journal. | High |
| REQ-STANDARDS-004 | WHEN a device has electrical-safety characteristics THE SYSTEM SHALL map the IEC 60601 series. | Medium |
| REQ-STANDARDS-005 | WHEN a device has biocompatibility characteristics THE SYSTEM SHALL map the ISO 10993 series. | Medium |
| REQ-STANDARDS-006 | WHEN a device contains software THE SYSTEM SHALL map IEC 62304 and IEC 62366. | Medium |
| REQ-STANDARDS-007 | WHEN the standards database is built THE SYSTEM SHALL crawl ISO Online Browsing Platform, IEC Webstore, ASTM Compass API, and CEN OpenStandards. | High |
| REQ-STANDARDS-008 | WHEN standards metadata is stored THE SYSTEM SHALL manage version history and supersession relationships. | High |
| REQ-STANDARDS-009 | WHILE cron monitoring is active THE SYSTEM SHALL detect revisions to applicable standards. | High |
| REQ-STANDARDS-010 | WHEN a standard is published in the EU OJ THE SYSTEM SHALL automatically calculate the transition period. | High |
| REQ-STANDARDS-011 | WHEN a standard revision is detected THE SYSTEM SHALL automatically identify the affected products. | High |
| REQ-STANDARDS-012 | WHEN a withdrawal date approaches THE SYSTEM SHALL send alerts at D-12 months, D-6 months, and D-3 months. | High |
| REQ-STANDARDS-013 | WHEN gap analysis runs THE SYSTEM SHALL compare the current certified standard version against the latest version. | High |
| REQ-STANDARDS-014 | WHEN a revision is summarized THE SYSTEM SHALL describe what changed and why it matters, and list verification items needing update. | Medium |
| REQ-STANDARDS-015 | WHEN a standard is cited for a 510(k) submission THE SYSTEM SHALL verify its FDA recognition status in real time. | High |
| REQ-STANDARDS-016 | IF a cited standard's FDA recognition has been withdrawn THEN THE SYSTEM SHALL warn the user and propose an alternative recognized standard. | High |
| REQ-STANDARDS-017 | WHEN a standard revision alert is produced THE SYSTEM SHALL integrate it into the Regulatory Radar dashboard. | Medium |
| REQ-STANDARDS-018 | WHEN a standard revision alert is produced THE SYSTEM SHALL publish it to the Notifications Hub (#52) for email/Slack delivery. | Medium |
| REQ-STANDARDS-019 | WHEN a device classification is provided THE SYSTEM SHALL produce the applicable standards list within 5 seconds. | High |
| REQ-STANDARDS-020 | WHEN a standard revision is detected THE SYSTEM SHALL emit an alert within 24 hours. | High |
| REQ-STANDARDS-021 | WHEN any applicable-standard result is returned THE SYSTEM SHALL include a citation to the source standards database entry. | High |
| REQ-STANDARDS-022 | WHILE a user lacks the required role for standards tracking THE SYSTEM SHALL deny access and return an authorization error. | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | FDA Recognized Standards Database가 완전 연동되어 6,000개 이상 표준을 포함한다. | Test |
| AC-02 | EU Harmonized Standards OJ 크롤러가 자동 업데이트된다. | Test |
| AC-03 | 기기 분류 → 적용 표준 목록 생성이 5초 이내이다. | Test |
| AC-04 | 표준 개정 감지 → 알림이 24시간 이내에 발행된다. | Test |
| AC-05 | 전환 기간 만료 D-6개월 자동 경고가 발생한다. | Test |
| AC-06 | 인용 표준의 FDA 인정 철회 시 경고와 대체 표준 제안이 표시된다. | Test / Review |

---

## §4 Technical Approach

### 4.1 파일 구조

- `app/(workflows)/standards/page.tsx` — 표준 매핑 및 추적 UI
- `app/api/standards/applicability/route.ts` — 적용 표준 매핑 API
- `app/api/standards/check/route.ts` — FDA 인정 상태 실시간 체크 API
- `lib/standards/mapping-engine.ts` — 표준 매핑 엔진 (규칙 기반 + RAG 보조)
- `lib/standards/crawlers/` — ISO/IEC/CEN/ASTM 크롤러
- `lib/standards/revision-detector.ts` — 개정 감지 (cron)
- `lib/standards/transition-calculator.ts` — 전환 기간 자동 계산
- `lib/standards/impact-analyzer.ts` — 영향 제품 식별 및 분석
- `lib/standards/alert-pipeline.ts` — 알림 파이프라인 (Radar / Notifications Hub 통합)

### 4.2 DB Schema

- `standards_catalog` (신규): 표준 메타데이터 (번호, 제목, 버전, 상태)
- `standards_applicability` (신규): 기기 유형별 적용 표준 매핑
- `standards_updates` (신규): 개정 이력 및 영향 분석
- `product_standards_compliance` (신규): 제품별 표준 준수 상태

### 4.3 API Endpoints

- `POST /api/standards/applicability` — 분류 결과 → 적용 표준 목록 생성
- `GET /api/standards/check?standard={id}` — FDA 인정 상태 실시간 체크
- `GET /api/standards/[id]/gap` — 표준 갭 분석 (현재 버전 vs 최신)
- `POST /api/standards/cron/detect` — cron 트리거 개정 감지 (내부)

### 4.4 의존성

- SPEC-REGULA-CLASSIFY-001 (기기 분류 결과 → 표준 매핑 입력)
- Phase 10 Regulatory Radar (표준 개정 알림 통합)
- #46 ISO 14971 Risk (위험관리 표준 준수 체크 연계)
- #37 Submission Lifecycle (인용 표준 FDA 인정 상태 실시간 체크)
- #52 Notifications Hub (표준 개정 알림 채널)
- 외부: FDA Recognized Consensus Standards DB, EU OJ Series C, ISO/IEC/CEN/ASTM 표준 카탈로그
