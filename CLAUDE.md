# Project Instructions

Follow the Mandatory Project Work Gate in @AGENTS.md.

Read @.codex/project-memory.md for project constraints and working context.

After analysis or gap findings, cross-check GitHub Issues and track missing project work before implementation.

## 보안 분류 규약 v1.0 (HARD — 3세션 공동 구속, 2026-10-20 사용자 직접 지시)

- **[외부 사실]** 공개 규제 지식(법령·가이던스·공개 FDA/공식 데이터·공개 표준) → GitHub 원격 저장 허용
- **[내부]** NAS 유래 자료, 회사 정보(제품·인증번호·만료일·고객·거래·인보이스·임직원), DHF 파생물 → **내부 Gitea / NAS / T3610 로컬 전용. GitHub 원격 절대 금지**
- 판정 원칙: 자료가 NAS·이메일·내부 문서에서 왔으면 내용 불문 무조건 [내부]
- 신규 데이터 추가 시 출처 분류 명시 의무 — 미분류 커밋 금지
- 위반 발견 시: push 전이면 차단(pre-push 스캔), push 후면 즉시 정정 + 세션 통보
- 자가 점검: ops-status-collector가 주기 스캔 → 운영 콘솔 '보안' 섹션 노출
- 규약 변경은 사용자 명시 승인 외 불가
