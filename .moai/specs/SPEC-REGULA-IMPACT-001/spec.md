---
id: SPEC-REGULA-IMPACT-001
version: 1.0.0
status: completed
phase: wave3
priority: High
created: 2026-06-12
updated: 2026-06-12
author: MoAI (backfilled)
issue_number: 41
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-RADAR-001
---

# SPEC-REGULA-IMPACT-001: 규제 변경 영향 추적기

## 개요

RADAR 모니터링 결과를 기반으로 규제 변경 사항이 기존 포트폴리오에 미치는 영향을 자동으로 분석하고, 대응 액션 아이템을 생성·추적하는 시스템.

## 구현 완료 (2026-06-12, commit 5dedd6e, PR #134)

### 구현된 기능

- `regulatory_impact_assessments` 테이블 — 규제 변경별 영향 평가
- `impact_action_items` 테이블 — 대응 항목 관리
- `audit_action` enum에 impact.* 3개 값 추가 (51 → 54)
- `lib/impact/` 모듈:
  - `portfolio-scanner.ts` — 포트폴리오 전체 스캔
  - `section-mapper.ts` — 규제 섹션 매핑
  - `action-queue.ts` — 대응 큐 관리
  - `audit-wiring.ts` — 21 CFR Part 11 감사 추적
  - `analyzer.ts` — 영향 분석 엔진
- API 라우트:
  - `GET /api/ra/impact` — 영향 평가 목록
  - `GET /api/ra/impact/[assessmentId]` — 상세 조회
  - `POST /api/admin/radar/impact` — 어드민 트리거
- DB 마이그레이션: 0033, 0034
- 테스트: 79개 전체 통과

### 연관 이슈

Fixes #41
