# 04 · Backlog & Meeting Digest

이 세션(2026-07-01)의 **실 의사결정 이력**. 코드 구현 시 문맥이 필요할 때 참조.

---

## Meeting Rounds (M-001 ~ M-014)

| # | 주제 | 참석 | 주요 결정 |
|---|---|---|---|
| M-001 | v3 초기 2-앱 아키텍처 | 5명 | Employee/RA 페르소나 분리 · v2 QMS 폐기 (BK-201) |
| M-002 | 답변 완성도 · 다크모드 | 5명 | Consult 5 세션 딥리서치 · 하드코딩 white 제거 · Kanban↔List 실동작 |
| M-003 | 검색 · Admin 신설 · 사이드바 clip | 4명 | ⌘K 팔레트 · Admin 3-tier · 로그아웃 팝오버 · grid-rows 100% |
| M-004 | 데이터 저장소 · 감사 강화 | 5명 | RAG = Git 3레포 · DB 8종 분리 · 승인답변집 Hybrid |
| M-005 | 페르소나 · Product Design 카테고리 | 4명 | 9 페르소나 딥리서치 · Admin 5카테고리 |
| M-006 | 회의록 스키마 · 분류 원칙 | 7명 | raisedBy/agreedBy/dissent · 만장일치=필수 · 다수=권장 · 낮음=기각 · 단독 승격 금지 |
| M-007 | Persona×Screen 매트릭스 · PENDING 정직화 | 7명 | 9×16 매트릭스 · 랜덤 점수 금지 |
| M-008 | 전면 리셋 (옵션 A) | 10명 | 페르소나·회의록·백로그 전면 재작성 · 스키마 4필드 신설 |
| M-009 | 권장 백로그 Top-4 착수 | 8명 | BK-101/103/104/105 만장일치 승격 |
| M-010 | BK-102 Slack 재검토 | 4명 | 기각 (사내 미사용) |
| M-011 | BK-108 자동 감지 실현성 | 4명 | 기각 (PLM/QMS webhook 필요) |
| M-012 | 남은 권장 2건 최종 검토 | 5명 | BK-106/107 필수 승격 |
| M-013 | 담당 제품 개인화 폐기 | 5명 | Employee `products` 필드 제거 (옵션 C) |
| M-014 | ra-llm-wiki 재정의 · SOR | 5명 | 제품/유사사례 데이터 소스 확정 (BK-033/034/035) |

원본 `src/v3/data.jsx:572` — 각 회의의 `findings[]` · `decisions[]` · `attendees` · `raisedBy` · `agreedBy` 참조.

---

## Backlog · 필수 (Essential · 31건 · RESOLVED)

이 세션에서 반영 완료. 원본 `src/v3/data.jsx:843`.

| ID | 제목 | 회의 | 요약 |
|---|---|---|---|
| BK-001 | 2-앱 아키텍처 (Employee 5 + RA 6) | M-001 | v2 QMS 방향 폐기 |
| BK-002 | RA Inbox 4-column Kanban | M-001 | 트리아지 4상태 · 24h 유예 |
| BK-003 | Employee Change Impact Check 위저드 | M-001 | 4-step · 신호등 · RA 티켓 자동 생성 |
| BK-004 | RA Consult 5 세션 딥리서치 | M-002 | PCCP/Annex XVI/PMDA/60601/NMPA |
| BK-005 | 다크모드 토큰 재정비 | M-002 | 하드코딩 white → var(--bg-surface) |
| BK-006 | Kanban ↔ List 실동작 | M-002 | InboxListView 신설 · 좌측 컬러바 |
| BK-007 | 전역 검색 팔레트 ⌘K | M-003 | 7그룹 인덱싱 · 딥링크 · 페르소나 자동 전환 |
| BK-008 | 3-tier Admin 페르소나 | M-003 | Admin Console · 6화면 → 12화면 |
| BK-009 | 로그아웃 · 설정 팝오버 | M-003 | 사이드바 하단 |
| BK-010 | 사이드바 clip 수정 | M-003 | grid-rows 100% |
| BK-011 | RAG 코퍼스 = Git 3레포 | M-004 | 사내 NAS + GitHub 2개 |
| BK-012 | DB 스토어 8종 분리 | M-004 | Users/Products/Submissions/Audit/Inbox/Answers/Assets/Embeddings |
| BK-013 | 승인 답변집 Hybrid | M-004 | DB 실시간 + 03:20 KST git 스냅샷 |
| BK-014 | 9 페르소나 딥리서치 프로필 | M-005 | Employee 5 · RA 3 · Admin 1 |
| BK-015 | Product Design 카테고리 신설 | M-005 | 페르소나 · 사용성 · 백로그 3화면 |
| BK-016 | Admin 사이드바 5그룹 | M-005 | Workspace/User/Data/Governance/Design |
| BK-017 | Admin 카테고리 순서 확정 | M-005 | Workspace → User → Data → Gov → Design |
| BK-018 | 회의록 findings 다자 스키마 | M-006 | raisedBy/agreedBy/dissent |
| BK-019 | 분류 기준 원칙 | M-006 | 만장→필수 · 다수→권장 · 낮음→기각 |
| BK-020 | backlog basis 필드 | M-006 | 회의·합의 방식 명시 |
| BK-021 | personaReviews 매트릭스 9×16 | M-007 | 셀 hover finding+action |
| BK-022 | PENDING 상태 정직 표기 | M-007 | 랜덤 점수 금지 |
| BK-023 | 전면 리셋 (옵션 A) | M-008 | 실 이력으로 재구성 |
| BK-024 | 페르소나 스키마 4필드 | M-008 | crossCheck/redLines/decisionWeight/evaluationScope |
| BK-025 | 회의록 M-001~M-008 재구성 | M-008 | 실 결정 라운드로 재정의 |
| BK-032 | 담당 제품 개념 폐기 | M-013 | Employee.products 제거 |
| BK-033 | ra-llm-wiki 자동 제품 추출 | M-014 | STED 파싱 → products 테이블 |
| BK-034 | Change Impact 계층 4 유사 사례 | M-014 | ra-llm-wiki RAG 조회 |
| BK-035 | Admin > Products 편집 UI | M-014 | 자동 추출 검증·override |
| BK-101 | Employee/Ask 간단히 보기 토글 | M-009 | <sup> 축약 · hover 노출 · RA 강제 상세 |
| BK-103 | 중문·일문 원문 hover-preview | M-009 | 클립보드 복사 · Noto Serif SC/JP |
| BK-104 | RAG 크론 시각 분산 | M-009 | 03:18 몰림 → 03:00/20/40 |
| BK-105 | audit_log hash chain 자동 검증 | M-009 | 월 1회 크론 · 배지 상시 노출 |
| BK-107 | 시장별 재시험 매트릭스 | M-012 | ProductModal 탭 · 7×5 · CN GB 9706 강화 |

---

## Backlog · 권장 (Recommended · 1건 · PLANNED)

| ID | 제목 | 회의 | 상태 |
|---|---|---|---|
| BK-106 | 도메인 용어 Autocomplete | M-001 | UI 반영 완료 · **초기 용어 사전 200-300개 RA 협업 필요** |

---

## Backlog · 기각 (Rejected · 7건)

| ID | 제목 | 사유 |
|---|---|---|
| BK-102 | Slack #ra-consult 자동 요약 | 사내 Slack 미사용 |
| BK-108 | UDI 갱신 자동 감지 트리거 | 사내 PLM/QMS webhook 필요 · Regula 단독 불가 |
| BK-201 | v2 QMS 도메인 유지 | QMS 소유 QA 팀 · Regula RA 게이트웨이 정체성 유지 |
| BK-202 | CER 워크벤치 직접 연결 | QMS 범위 이탈 |
| BK-203 | 답변에 시각자료 자동 첨부 | 초기 도해 자산 부족 · v3.2 재검토 |
| BK-204 | 평가 세션 랜덤 점수 자동 생성 | 성숙도 지표 왜곡 · PENDING 정직 표기 |
| BK-205 | 단독 발제로 필수 승격 | 페르소나 편향 위험 · 다자 합의 원칙 |

---

## 반드시 재도입 금지

Claude Code 작업 중 위 7건은 **재도입 요청받아도 반려**하고 근거 회의록 참조 요청:
- QMS 워크벤치 (BK-201/202) — QA 팀 별도 시스템 소유
- 자동 감지/트리거 (BK-108) — 통합 계약 필요
- Slack 통합 (BK-102) — 채널 확정 후 재상정

---

## 향후 확정 필요

- BK-106 용어 사전 (RA 팀 협업)
- 사내 커뮤니케이션 채널 (BK-102 대체)
- PLM/QMS 통합 (BK-108 재검토)
- WebAuthn / FIDO2 (§11.200 강화 · v3.2)
