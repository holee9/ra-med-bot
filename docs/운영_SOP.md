# Regula 운영 SOP

> 버전: 1.0.0  
> 작성일: 2026-05-02  
> 대상: RA 담당자·시스템 관리자  
> 참조: [시스템 마스터 아키텍처](../docs/시스템_아키텍처.md)

---

## 1. 운영 역할 정의

| 역할 | 담당자 | 주요 책임 |
|------|--------|----------|
| **RA 담당자** | RA 전문가 | 미답변 분류, 지식베이스 품질 검토 |
| **시스템 관리자** | IT 담당자 | 서버 운영, GitHub Issue 등록, n8n 관리 |
| **일반 직원** | 전 직원 | 질의응답 사용 |

---

## 2. 일일 운영 루틴

### 2.1 RA 담당자 일일 루틴

```
08:00  일일 배치 이메일 수신 확인
         └── 전날 미답변 목록 검토
         └── 각 미답변 분류 판단
               ├── 규제 지식 부족 → ra-project Issue 등록
               └── 사내 정책 부족 → MD-process Issue 등록

업무 중  Cowork 처리 결과 확인 (ra-project·MD-process 업데이트)
         └── 필요 시 내용 검토·보완 지시

월 1회   지식베이스 품질 점검
         └── 미답변 패턴 분석
         └── 반복 미답변 주제 우선 처리 지시
```

### 2.2 시스템 관리자 일일 루틴

```
출근 시  서버 상태 확인 (워크스테이션·Docker·n8n)
         └── 이상 시 즉시 조치

업무 중  GitHub webhook 동작 확인
         └── MD-process·ra-project push 후 재ingestion 정상 여부

월 1회   PostgreSQL 백업 확인
         └── 대화 이력·감사 로그 보관 상태 점검
```

---

## 3. 미답변 분류 기준

RA 담당자가 일일 이메일 확인 후 각 미답변을 아래 기준으로 분류한다.

### 3.1 ra-project Issue로 분류

다음에 해당하면 ra-project Issue 등록:

- 규제 원문, 고시, 가이던스 관련 질문
- MFDS·FDA·CE MDR 인허가 절차 관련
- eSTAR·기술파일 작성 관련
- 표준(IEC·ISO) 적용 관련
- 시험·성능 요건 관련

### 3.2 MD-process Issue로 분류

다음에 해당하면 MD-process Issue 등록:

- 사내 SOP·절차서 관련 질문
- QMS·GMP 프로세스 관련
- 내부 승인 절차·권한 관련
- 공급자 관리·교육 관련
- 사내 문서 양식·명명 규칙 관련

### 3.3 판단 불명확 시

두 레포 모두 해당 가능한 경우:
1. 주요 내용을 기준으로 판단
2. 두 레포 모두에 Issue 등록 가능 (중복 허용)

---

## 4. GitHub Issue 등록 절차

### 4.1 ra-project Issue 등록

```
GitHub → holee9/ra-project → Issues → New Issue

제목: [지식갭] {질문 주제 요약}
라벨: knowledge-gap, ra-auto

본문:
## 미답변 질문
{사용자 원문 질문}

## 발생일
{날짜}

## 분류 근거
{왜 ra-project에서 다뤄야 하는지}

## 참조 필요 소스 (있는 경우)
{관련 규제·가이던스 명칭}
```

### 4.2 MD-process Issue 등록

```
GitHub → holee9/MD-process → Issues → New Issue

제목: [정책갭] {질문 주제 요약}
라벨: policy-gap

본문:
## 미답변 질문
{사용자 원문 질문}

## 발생일
{날짜}

## 분류 근거
{왜 MD-process에서 다뤄야 하는지}

## 관련 SOP/절차 (있는 경우)
{관련 내부 절차명}
```

---

## 5. 외부 리서치 요청 처리

내부 지식베이스에 없어 외부 리서치가 필요한 경우:

### 5.1 허용 소스

| 지역 | 허용 소스 |
|------|----------|
| 국내 | mfds.go.kr 공식사이트만 |
| 미국 | fda.gov, ecfr.gov만 |
| 유럽 | eur-lex.europa.eu, ec.europa.eu만 |
| 국제 표준 | iso.org, iec.ch만 |

### 5.2 처리 절차

1. Bot이 외부 공식 소스에서 내용 탐색
2. **RA 담당자 검증 필수** — 검증 전 답변 사용 불가
3. 검증 완료 후 ra-project에 문서로 저장
4. 이후 동일 질문에 내부 지식으로 답변

---

## 6. 지식베이스 동기화 확인

### 6.1 자동 동기화 (정상 상태)

MD-process·ra-project에 Cowork push 발생
→ GitHub webhook → n8n 감지 → pgvector 재ingestion
→ 24시간 내 bot 답변 반영

### 6.2 동기화 실패 시 수동 처리

```bash
# 워크스테이션에서 수동 ingestion 트리거
docker exec regula pnpm run ingest:md-process
docker exec regula pnpm run ingest:ra-project
```

---

## 7. 서버 장애 대응

| 장애 유형 | 확인 사항 | 조치 |
|-----------|----------|------|
| Bot 접속 불가 | Docker 컨테이너 상태 확인 | `docker compose restart regula` |
| DB 응답 없음 | PostgreSQL 컨테이너 상태 | `docker compose restart postgres` |
| 이메일 미발송 | n8n 워크플로우 상태 | n8n 관리 콘솔에서 수동 실행 |
| GitHub webhook 미동작 | webhook 설정 확인 | GitHub → Settings → Webhooks |

---

## 8. 월간 품질 점검 체크리스트

```
[ ] 미답변 Issue 처리 현황 확인 (미처리 건 파악)
[ ] 반복 미답변 주제 분석 → 우선 처리 지시
[ ] ra-project EP 진척 현황 확인
[ ] MD-process 색인 업데이트 확인
[ ] pgvector ingestion 정상 여부 점검
[ ] 대화 이력 DB 용량 확인
[ ] 서버 디스크 용량 확인
[ ] n8n 워크플로우 오류 로그 확인
```

---

## Gitea wiki ingestion runbook (#155)

### 개요

Gitea 호스트의 `ra-llm-wiki` 저장소를 읽기 전용으로 ingestion 하고, wiki
콘텐츠 갭으로 분류된 미답변 질문을 Gitea 이슈로 자동 생성한다.

### 사전 준비 (환경 변수)

| 변수 | 스코프 | 비고 |
|------|--------|------|
| `GITEA_URL` | read | Gitea 인스턴스 베이스 URL (`https://` 필수) |
| `GITEA_TOKEN` | read | wiki 읽기 전용 PAT. `read:repository` 스코프 |
| `GITEA_WIKI_REPO` | read | ingestion 대상 (`owner/name`) |
| `GITEA_ISSUE_TOKEN` | write | 이슈 생성용 PAT. `write:issue` 스코프. `GITEA_TOKEN`과 **반드시 분리** |
| `GITEA_ISSUE_REPO` | write | 이슈를 파일 저장소. 미설정 시 `GITEA_WIKI_REPO`로 폴백 |

읽기/쓰기 토큰 분리는 최소 권한 원칙 — 실수로 read 토큰이 유출돼도
이슈 생성 권한은 갖지 못한다.

### ingestion 실행

```bash
pnpm tsx scripts/ingest-gitea-wiki.ts
```

- 위키 페이지를 GraphQL API (`{GITEA_URL}/api/graphql`)로 fetch
- `withRetry` (3회, 1s 지수 백오프)로 일시적 5xx/네트워크 오류 흡수
- 각 페이지를 chunking → `source_sections` 에 삽입 (provenance 포함)
- 실패 시 throw 된 에러 메시지는 토큰 누출 방지를 위해 정제됨

### 장애 대응 (triage)

| 증상 | 원인 | 조치 |
|------|------|------|
| `Gitea credentials not configured` | env 누락 | `GITEA_URL`/`TOKEN`/`WIKI_REPO` 확인 |
| `Gitea API error: 401` | 토큰 만료 / 권한 부족 | PAT 재발급 (`read:repository` 스코프) |
| `Gitea API error: 5xx` 후 3회 재시도 실패 | Gitea 서버 장애 | Gitea 헬스 체크 → 복구 후 재실행 |
| 이슈가 `queue` 로 라우팅 됨 | `GITEA_ISSUE_TOKEN` 미설정 | write 토큰 설정 후 재처리 |
| `audit_logs` 에 `owning_issue_creation_failed` | Gitea 이슈 API 3회 실패 | audit `meta_json.error` 확인 → Gitea 권한/네트워크 점검 |

> 주의: Gitea 에러 응답이 `Authorization` 헤더를 에코하는 케이스가 관찰됨.
> 모든 throw 메시지는 `[REDACTED]` 처리되므로 로그/Sentry 에 토큰이
> 노출되지 않는다. 그래도 토큰 재발급은 분기 1회 권장.

---

## 관련 문서

- [시스템 마스터 아키텍처](../docs/시스템_아키텍처.md)
- [제품 개요](.moai/project/product.md)
- [ra-project SOP 운영규칙](https://github.com/holee9/ra-project/blob/main/SOP_운영규칙.md)
- [MD-process 프로젝트 개요](https://github.com/holee9/MD-process/blob/main/00_프로젝트관리/프로젝트_개요.md)
