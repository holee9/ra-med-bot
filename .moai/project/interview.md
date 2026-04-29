# Project Interview

> Generated: 2026-04-29
> Phase: Project Documentation Update (Phase 1.5 Deep Interview)

---

## Round 1: Vision and Direction

**Question 1: Regula 프로젝트의 현재 개발 단계와 향후 방향은 어떻게 되나요?**

Answer: **기획/설계 단계** — 프로토타입 기반으로 구체적인 개발 계획을 수립하는 단계. Phase 1 기반 구축(4-Layer Memory System)은 완료되었으며, 이제 본격적인 제품 구현을 위한 계획 수립에 집중.

**Question 2: 프로젝트의 핵심 철학(4가지 가치 제안)에 대해 어떤 입장이신가요?**

Answer: **기존 철학 유지 + 구체적 구현 전략 추가** — Evidence-first, Context-aware, Expert-reviewable, Actionable 원칙은 그대로 유지하되, 이를 구현하기 위한 구체적인 기술 전략과 아키텍처 결정을 추가.

**Question 3: 다음 개발 단계에서 가장 중요하게 생각하는 영역은 무엇인가요?**

Answer: **MVP 우선** — FDA 코퍼스 수집 + 기본 RAG 파이프라인 + Chat UI를 최우선으로 구현.

**Question 4: 프로젝트에 알려진 제약사항이나 기술적 부채가 있나요?**

Answer: **기존 제약 유지** — 21 CFR Part 11, citation 강제, WCAG 2.1 AA 등 기존 제약사항 준수.

---

## Round 2: Implementation Strategy and Non-Goals

**Question 1: MVP에 포함할 최소 기능 범위는 어디까지인가요?**

Answer: **Full MVP** — 모든 구조화 출력(checklist, comparison, timeline) + DocViewer + Expert Review까지 포함. 범위가 넓지만 완전한 가치 검증을 위해 전체 기능 포함.

**Question 2: MVP 구현 시 어떤 개발 전략을 선호하나요?**

Answer: **백엔드 우선** — RAG 파이프라인, DB 스키마, API를 먼저 완성한 후 프론트엔드를 붙이는 방식. API 안정성을 먼저 확보.

**Question 3: MVP에서 명시적으로 제외할 기능(비목표)을 선택하세요.**

Answer: **다크 모드 연기** — 다크 모드/다크 테마는 초기 버전에서 제외. 라이트 테마만 먼저 지원.

**Question 4: 문서에서 가장 중요하게 포착해야 할 영역은 무엇인가요?**

Answer: **아키텍처/모듈 경계** — 모듈 경계와 시스템 구조를 가장 중요하게 문서화. 구현 전 아키텍처 이해도가 높아야 함.

---

## Round 3: Technical Decisions

**Question 1: 백엔드 기술 스택을 확정해주세요.**

Answer: **기존 스택 유지** — Drizzle ORM + PostgreSQL 16 + pgvector. 이미 tech.md에 정의된 스택 그대로 사용.

**Question 2: LLM 전략을 확정해주세요.**

Answer: **멀티 LLM** — 목적에 따라 다중 LLM 사용. 임베딩은 OpenAI, 추론은 Claude, 라우팅은 Haiku 등 목적별 최적 모델 선택.

**Question 3: 초기 RAG 코퍼스 수집 범위는 어디까지인가요?**

Answer: **MFDS, FDA, EU MDR 우선** — 한국(MFDS), 미국(FDA), 유럽(EU MDR) 코퍼스를 먼저 수집. NMPA(중국), PMDA(일본)는 추후 연동.

**Question 4: 초기 배포 환경은 어떻게 구성하시겠어요?**

Answer: **로컬 개발 + Docker 병용** — Docker로 PostgreSQL 16 + pgvector 실행, 로컬 Node.js로 Next.js 개발 서버 실행. 개발 속도와 환경 일관성 모두 확보.

---

## Summary: Key Decisions

| Decision | Choice |
|----------|--------|
| Project Phase | Planning/Design → Implementation |
| Philosophy | Keep 4 values + add concrete implementation strategy |
| MVP Scope | Full MVP (all structured outputs + DocViewer + Expert Review) |
| Dev Strategy | Backend-first |
| Non-Goals (MVP) | Dark mode delayed |
| Doc Priority | Architecture/module boundaries |
| Backend Stack | Drizzle ORM + PostgreSQL 16 + pgvector (unchanged) |
| LLM Strategy | Multi-LLM (OpenAI embeddings, Claude reasoning, etc.) |
| Corpus Priority | MFDS, FDA, EU MDR first; NMPA, PMDA later |
| Deployment | Local dev + Docker (DB containerized) |
