---
name: regula-handoff-reader
description: "Regula 프로젝트의 handoff README (RA-bot-design/design_handoff_regula/README.md)에서 섹션별 요구사항을 추출하는 도우미. handoff의 §N, §N.M 참조를 만나거나, 'handoff', '디자인 핸드오프', 'RA-bot-design' 키워드를 만나면 반드시 이 스킬을 사용. 섹션 번호를 정확히 파싱해서 해당 요구사항만 반환하여 컨텍스트 낭비 방지."
---

# Regula Handoff Reader

Regula 프로젝트의 단일 진실원인 `RA-bot-design/design_handoff_regula/README.md` (약 950줄)에서 섹션별 요구사항을 추출하는 도우미 스킬.

## 왜 이 스킬이 필요한가

handoff README는 ~41KB, 950줄이다. 모든 에이전트가 전체를 읽으면 컨텍스트 윈도우의 25-50%가 소모된다. 대신 필요한 섹션(§5 폴더 구조, §11.1 SSE contract, §12 data models 등)만 추출하면 2-5%로 충분하다.

## 섹션 구조 (빠른 인덱스)

| 섹션 | 제목 | 에이전트 |
|------|------|---------|
| §1 | Overview | 전원 |
| §4 | Recommended Tech Stack | regula-architect |
| §5 | Project Structure | regula-architect |
| §6 | Design Tokens | regula-design-system |
| §7 | Screens & Views (7.1~7.11) | regula-frontend |
| §8 | Shared Components (8.1~8.10) | regula-frontend |
| §9 | Interactions & Behavior | regula-frontend |
| §10 | State Management | regula-frontend |
| §11 | Backend Integration & API (11.1~11.10) | regula-backend, regula-rag-pipeline |
| §11.1 | SSE contract | regula-rag-pipeline |
| §12 | Data Models (Drizzle schema) | regula-architect, regula-backend |
| §13 | Assets & Icons | regula-frontend, regula-design-system |
| §14 | Accessibility | regula-frontend, regula-compliance-qa |
| §15 | Performance & SEO | regula-compliance-qa |
| §16 | Security & Compliance | regula-backend, regula-compliance-qa |
| §17 | Testing Strategy | regula-compliance-qa |
| §18 | Deployment & DevOps | regula-architect, regula-backend |
| §19 | Suggested Additional Features | (참고용) |
| §20 | Implementation Roadmap (Phase 1-6) | 오케스트레이터 |

## 사용법

### 특정 섹션 추출

사용자 또는 에이전트가 "§7.4 Chat view 요구사항" 같은 형태로 요청하면:

1. Grep으로 해당 섹션의 시작 라인 찾기:
   ```
   Grep pattern: "^### 7.4" path: "RA-bot-design/design_handoff_regula/README.md" -n
   ```
2. 다음 `###` 또는 `##` 시작 라인까지가 섹션 범위
3. Read with offset=시작, limit=끝-시작

### 여러 섹션 일괄 추출

Phase별 작업 시 관련 섹션들을 한 번에 추출:

| Phase | 필요한 섹션 |
|-------|-----------|
| Phase 1 Foundation | §4, §5, §6, §12, §18 |
| Phase 2 Chat core | §7.4, §8.1-8.3, §9.1-9.2, §11.1 |
| Phase 3 Structured outputs | §8.5-8.10, §11.1 (blocks) |
| Phase 4 Breadth | §7.5-7.9, §11.2-11.9 |
| Phase 5 Enterprise | §14, §16 |
| Phase 6 Quality | §17 |

### 인용 형식

에이전트가 결정을 내릴 때 반드시 섹션 번호로 근거를 인용:

> "이 구조는 handoff §5의 폴더 구조를 따랐다. `lib/ai/retrievers/fda.ts` 경로는 §5의 예시와 일치."

## 주의사항

- **handoff 원본을 수정하지 않는다.** 읽기 전용.
- **§11.1의 SSE event 목록은 손실 없이 유지.** 하나라도 누락하면 프론트-백엔드 계약이 깨진다.
- **§12의 테이블 목록은 완전성 검증 필수.** 누락된 테이블 없도록.
- **§19 Suggested Features는 초기 구축 범위가 아님.** Roadmap에 포함될 때만 다룸.

## 파싱 실패 시

- handoff README 파일이 없거나 읽을 수 없으면 Phase 리더(오케스트레이터)에게 즉시 보고.
- 자의적으로 요구사항을 "추정"하지 않는다. 원본 없이는 진행 불가.
