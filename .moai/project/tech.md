# 기술 명세 — Regula

> 버전: 2.0.0  
> 최종 업데이트: 2026-05-02  
> 개정 사유: 브레인스토밍 확정 — 운영 서버 중고 워크스테이션 + Linux + Docker로 전환

---

## 기술 스택 전체도

| 카테고리 | 기술 선택 |
|----------|----------|
| **Frontend** | Next.js 15 App Router, TypeScript 5.4+, React 18, Tailwind CSS v4, Radix UI, Zustand, TanStack Query v5, Vercel AI SDK |
| **Backend** | Next.js Route Handlers + SSE, Drizzle ORM, PostgreSQL 16 + pgvector, Auth.js v5 |
| **AI / RAG** | Claude Sonnet 4.5 (추론·답변), Claude Haiku 4.5 (탐색·라우팅), OpenAI text-embedding-3, LangChain/LlamaIndex (TS), Cohere Rerank |
| **Agent** | Hermes Agent / Claw류 — 탐색·라우팅 전담 |
| **자동화** | n8n — GitHub Issue 자동 등록, 이메일 배치 발송 |
| **패키지 매니저** | pnpm |

---

## 인프라 아키텍처

### 운영 환경 (확정)

| 구성 요소 | 내용 |
|-----------|------|
| **Bot 서버** | 중고 워크스테이션 + Ubuntu 22.04 LTS |
| **런타임** | Docker + Docker Compose |
| **데이터베이스** | PostgreSQL 16 + pgvector (Docker 컨테이너) |
| **민감 문서 보관** | NAS DS224+ (내부망 직접 연결) |
| **GitHub 동기화** | GitHub API + n8n 스케줄러 |

> Vercel·Railway·AWS 등 외부 클라우드 배포 없음. 완전 내부망 운영.

### Docker Compose 구성

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: regula
      POSTGRES_USER: regula_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  regula:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://regula_user:${POSTGRES_PASSWORD}@postgres:5432/regula
    depends_on:
      - postgres

  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
```

---

## Agent + Bot 기술 역할 분리

### Agent (탐색·라우팅)

| 항목 | 내용 |
|------|------|
| 기술 | Hermes Agent / Claw류 |
| 역할 | MD-process·ra-project GitHub 문서 탐색, 관련 문서 후보 선별 |
| 제약 | 답변 생성 절대 불가. 탐색 결과만 Bot에 전달 |

### Bot (팩트 답변)

| 항목 | 내용 |
|------|------|
| 추론 모델 | Claude Sonnet 4.5 |
| 라우팅 모델 | Claude Haiku 4.5 |
| 임베딩 | OpenAI text-embedding-3 |
| 제약 | Agent가 전달한 문서만 근거 사용. 추가 생성 없음 |

---

## RAG 파이프라인

### Knowledge Source 구성

| 소스 | 유형 | 동기화 방식 |
|------|------|------------|
| MD-process GitHub | .md 파일 (정책·SOP) | GitHub API 자동 pull |
| ra-project GitHub | .md 파일 (규제 지식) | GitHub API 자동 pull |
| NAS DS224+ | 민감 원본 문서 | 내부망 직접 마운트 |

### 파이프라인 흐름

```
1. 사용자 질문 수신
2. Haiku — 의도 분류 (정책 질의 / 규제 질의 / 복합)
3. Agent — 해당 레포 문서 탐색 (pgvector 벡터 검색 + FTS)
4. Cohere Rerank — 검색 결과 정밀도 향상
5. Sonnet 4.5 — 찾은 문서만 근거로 답변 생성 (출처 명시 필수)
6. 후처리 — 출처 검증, 미답변 여부 판단
7. DB 저장 — 대화 이력·감사 로그
```

### 동기화 주기

| 소스 | 주기 | 방식 |
|------|------|------|
| MD-process | Cowork push 감지 즉시 | GitHub webhook → n8n → 재ingestion |
| ra-project | Cowork push 감지 즉시 | GitHub webhook → n8n → 재ingestion |
| NAS 원본 | 수동 트리거 | 담당자 업로드 후 관리자 실행 |

---

## 자동화 (n8n)

### 워크플로우 목록

| 워크플로우 | 트리거 | 동작 |
|-----------|--------|------|
| GitHub 동기화 | MD-process·ra-project push webhook | pgvector 재ingestion |
| 미답변 Issue 등록 | Bot 미답변 감지 | ra-med-bot GitHub Issue 자동 생성 |
| 일일 배치 이메일 | 매일 08:00 | 전날 미답변 목록 이메일 발송 |

---

## 데이터 모델 (핵심 테이블)

| 테이블 | 핵심 컬럼 | 비고 |
|--------|----------|------|
| `users` | id, email, name, role | role: general / ra_admin |
| `conversations` | id, user_id, title, created_at | |
| `messages` | id, conversation_id, role, content, answered | answered: boolean |
| `message_sources` | message_id, source_repo, source_path, section | 출처 명시 |
| `unanswered_queue` | id, message_id, classified, classified_by, target_repo | 미답변 분류 큐 |
| `sources` | id, repo, path, content, embedding vector(1536) | pgvector |
| `audit_logs` | id, user_id, action, resource, created_at | 내부 운영 기록 |

---

## 개발 환경

| 항목 | 내용 |
|------|------|
| 개발 PC | 별도 PC (확정 예정) |
| 개발 방식 | 로컬 Node.js + Docker DB |
| 배포 방식 | 워크스테이션에 Docker Compose 배포 |
| CI/CD | GitHub Actions → 워크스테이션 자동 배포 (SSH) |

---

## 보안

| 항목 | 내용 |
|------|------|
| 접근 제어 | 사내 내부망 전용, 외부 노출 없음 |
| 인증 | Auth.js v5 세션 기반 |
| 민감 데이터 | NAS 내부 보관, 외부 전송 없음 |
| LLM 데이터 | zero-data-retention 모드 사용 |

---

## 관련 문서

- [시스템 마스터 아키텍처](../../docs/시스템_아키텍처.md)
- [제품 개요](product.md)
- [운영 SOP](../../docs/운영_SOP.md)
