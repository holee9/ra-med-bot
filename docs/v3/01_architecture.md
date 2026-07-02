# 01 · System Architecture

## 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER (SPA)                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  React 18 · Persona-aware routing                      │    │
│  │   ├─ Employee (5 screens)                              │    │
│  │   ├─ RA (6 screens)                                    │    │
│  │   └─ Admin (12 screens · 5 categories)                 │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTPS + SSO cookie
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Next.js / API)                    │
│  ┌────────────┬───────────────┬────────────┬────────────┐      │
│  │ Auth Guard │ Route Guard   │ Rate Limit │ Audit Hook │      │
│  └────────────┴───────────────┴────────────┴────────────┘      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Service Layer                                          │    │
│  │  ├─ AskService (RAG + LLM)                             │    │
│  │  ├─ InboxService (Kanban · Triage · ESIG)              │    │
│  │  ├─ ImpactCheckService (4-layer)                       │    │
│  │  ├─ CorpusService (3 repos ingest + embeddings)        │    │
│  │  ├─ AuditService (append-only + hash chain)            │    │
│  │  └─ ProductService (auto-extract from ra-llm-wiki)     │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
        │              │               │              │
        ▼              ▼               ▼              ▼
   ┌────────┐    ┌──────────┐   ┌──────────┐   ┌──────────┐
   │Postgres│    │ pgvector │   │  Object  │   │ Claude   │
   │ (6 tbl)│    │(1 index) │   │ Storage  │   │   API    │
   └────────┘    └──────────┘   └──────────┘   └──────────┘
                       ▲
                       │ nightly cron (03:00/20/40)
                       │
   ┌───────────────────┴────────────────────┐
   │ Ingest Pipeline (Inngest workers)      │
   │  ├─ ra-llm-wiki   ← 사내 NAS (VPN)     │
   │  ├─ MD-process    ← GitHub             │
   │  └─ ra-project    ← GitHub             │
   └────────────────────────────────────────┘
```

---

## 배포 구성

**프런트**: Next.js 14 · App Router · React 18 · Tailwind-free (v3.css 커스텀)
**백엔드**: Next.js API routes (동일 프로세스) 또는 별도 FastAPI (Python이 필요한 인제스트 파이프라인)
**DB**: PostgreSQL 15+ (pgvector 확장 필수)
**Object Storage**: S3 호환 (MinIO 사내 · AWS S3 클라우드)
**Job Queue**: Inngest (cron + retry + audit trail)
**LLM**: Anthropic Claude Sonnet 4 (`window.claude.complete` 스타일 API)
**Auth**: Google Workspace SSO (Auth.js)

---

## 통합 지점 (외부)

### GitHub (github.com/holee9)
- `MD-process` · `ra-project` public read
- OAuth token으로 pull 인증 (rate limit 완화)

### 사내 NAS
- `10.11.1.40:7001/DR_RnD/ra-llm-wiki.git` · Gitea/GitLab 사내 인스턴스
- VPN 게이트웨이 통한 접근 · 서비스 계정 SSH 키

### Slack (기각 · BK-102)
- **BK-102 기각**: 사내 Slack 미사용. 대체 커뮤니케이션 채널은 별도 확인 후 재검토.

### PLM/QMS (미통합 · BK-108)
- 자동 감지 트리거는 사내 PLM/QMS webhook 없이는 불가. 별도 트랙.

---

## 페르소나 · Role · Route Guard

| Persona (UI) | Role (DB) | Sidebar Items | 접근 가능 API |
|---|---|---|---|
| Employee | `employee` · `viewer` | 5 items | `/api/ask` · `/api/my-questions` · `/api/products (read)` · `/api/guides` · `/api/impact-check` |
| RA | `ra-member` · `ra-lead` | 6 items | 위 + `/api/inbox/*` · `/api/consult/*` · `/api/submissions/*` · `/api/registry` · `/api/radar` · `/api/knowledge/*` |
| Admin | `admin` | 12 items (5 cat) | 위 + `/api/admin/*` (users · corpus · radar-src · logs · settings · personas · usability · backlog) |

**Route guard 예시** (Next.js middleware):
```ts
// middleware.ts
const rolePolicy = {
  '/api/admin':      ['admin'],
  '/api/inbox':      ['ra-member', 'ra-lead', 'admin'],
  '/api/consult':    ['ra-member', 'ra-lead', 'admin'],
  '/api/impact-check': ['employee', 'viewer', 'ra-member', 'ra-lead', 'admin'],
  '/api/ask':        ['employee', 'viewer', 'ra-member', 'ra-lead', 'admin'],
};
```

Employee 계정으로 `/api/admin` 접근 시 403 · **감사 로그에 기록** (부정 접근 이벤트).

---

## Cron Schedule (Inngest jobs)

| Cron | 시각 (KST) | 작업 | 대상 |
|---|---|---|---|
| `ingest-ra-llm-wiki`  | daily 03:00 | Git pull → 문서 파싱 → 임베딩 → **제품 메타 자동 추출** (BK-033) | pgvector + products |
| `ingest-md-process`   | daily 03:20 | Git pull → SOP 파싱 → 임베딩 | pgvector |
| `ingest-ra-project`   | daily 03:40 | Git pull → 규제 조항 파싱 → 임베딩 | pgvector |
| `snapshot-approved-answers` | daily 03:20 | DB → git commit → push (regula-approved-answers) | git 스냅샷 |
| `verify-audit-chain` | monthly 1st 00:00 | audit_log 전수 hash 재계산 · 실패 시 알림 (BK-105) | audit_log |
| `radar-scrape`       | 4h/6h/12h 개별 | FDA/EMA/MFDS/NMPA/PMDA RSS/Scraper | radar_items |
| `expire-waiting-tickets` | daily 04:00 | 5일 회신 없는 waiting 티켓 자동 취소 | inbox_tickets |

---

## 감사 이벤트 (필수 기록)

모든 아래 액션은 `audit_log`에 INSERT (SHA-256 previous_hash · append-only):

- `auth.sso.login` / `auth.logout`
- `inbox.create` (Employee 질문 접수)
- `triage.auto` (자동 응답 판정)
- `triage.escalate` (자동 에스컬)
- `inbox.approve` / `inbox.reject` (RA ESIG)
- `inbox.escalate.manual` (RA 수동 외부 자문)
- `knowledge.publish` / `knowledge.draft` / `knowledge.deprecate`
- `impact.check` (Employee 위저드 실행)
- `impact.ticket.create` (자동 티켓 생성)
- `product.update` (Admin edit)
- `role.grant` / `role.revoke`
- `settings.update`
- `corpus.reindex` / `corpus.sync`
- `radar.scrape` / `radar.impact.assess`
- `esig.sign` (전자서명)

**부정 접근**: 403/401 응답도 감사 로그에 기록.

---

## LLM Prompt 설계

### Ask 응답 프롬프트 (System)
```
당신은 의료기기 규제 전문가입니다. 사용자의 자연어 질문에 답할 때:
1. RAG로 검색된 관련 문서를 반드시 인용 (footnote <sup class="cite" data-src="...">번호</sup>)
2. 관할권(FDA/MDR/MFDS/NMPA/PMDA)이 다르면 반드시 분리 서술
3. Confidence 계산: 인용 문서가 3개 이상 + 최근 2년 이내 + 관할권 매칭 시 높음
4. 위험 키워드(recall/FSCA/breach/off-label) 감지 시 confidence를 강제 하향 → escalated
5. 답변 언어 = 질문 언어와 동일 (KO 질문 → KO 답변)
```

### Impact Check 카테고리 분류 프롬프트
```
사용자가 입력한 변경 상세를 다음 카테고리로 분류:
[sw, sw-minor, hw-bom, hw-structure, label, warn, process, sterile]
출력: JSON {"category": string, "confidence": 0-100, "reason": string}
confidence < 80이면 사용자에게 재확인 요청.
```

---

## 로컬 개발 · 시크릿

`.env.example`:
```
# SSO
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=

# DB
DATABASE_URL=postgresql://...
POSTGRES_VECTOR_DIM=1536

# LLM
ANTHROPIC_API_KEY=

# Git
GITHUB_TOKEN=              # ra-project · MD-process pull
NAS_SSH_PRIVATE_KEY=       # ra-llm-wiki (사내 NAS)
NAS_HOST=10.11.1.40
NAS_PORT=7001

# Storage
S3_BUCKET=regula-assets
S3_ENDPOINT=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```
