# 03 · API Contract

**Base**: `/api` · JSON · Auth: Google SSO cookie · CSRF: double-submit token
**Error 형식**:
```json
{ "error": { "code": "STRING", "message": "human readable", "detail": {} } }
```

---

## 3.1 Employee APIs

### POST /api/ask
사용자의 자연어 질문 → RAG + LLM 응답 → Auto-triage.

**Request**:
```json
{ "question": "BLE 5.3 SoC 교체 시 재인허가 필요?", "product_id": "xray-det" (optional) }
```

**Response (streaming SSE)**:
```
event: token
data: {"text": "이 변경은..."}
event: citation
data: {"n": 1, "source": "ra-llm-wiki/기술파일/xray-det/DHF-v2.3.pdf#p12", "quote": "..."}
event: done
data: {"ticket_id": "Q-3407", "triage": "needs-review", "confidence": 72.4, "sla_deadline": "2026-07-02T09:00:00+09:00"}
```

audit_log 이벤트: `inbox.create` → `triage.auto` (or `triage.escalate`).

---

### GET /api/my-questions
로그인 사용자의 질문 이력.

**Response**:
```json
{
  "items": [
    { "id": "Q-3401", "at": "2026-06-30T15:22:00+09:00", "q": "...", "state": "approved",
      "product": "촬영실 GUI SW", "final_answer": "...", "citations": [...] }
  ]
}
```

---

### GET /api/products
사내 전 제품 요약 (담당 필터링 없음 · BK-032).

**Response**: `D3.products`와 동일 구조.

---

### GET /api/products/:id
상세 (standards · predicate · markets · retest_matrix).

---

### GET /api/guides
승인 답변집 조회 (Employee 관점).

**Query**: `?category=...&q=...&limit=20&offset=0`

**Response**:
```json
{ "items": [ { "id": "g1", "cat": "Software", "q": "...", "updated": "...", "hits": 142 } ] }
```

---

### GET /api/guides/:id
가이드 본문 + 인용.

---

### POST /api/impact-check
변경 영향 자가진단 4-계층 판정.

**Request**:
```json
{
  "product_id": "xray-src",
  "change_category": "hw-bom",
  "change_detail": "BLE 4.2 → 5.3 SoC 교체 및 안테나 재설계",
  "markets": ["us","eu","kr","cn"]
}
```

**Response**:
```json
{
  "layer1_matrix": {
    "us": { "level": "conditional", "ref": "FDA Design Change §III.A", "note": "..." },
    "eu": { "level": "required",    "ref": "MDR Art. 120(3), Annex II", "note": "..." },
    "kr": { "level": "required",    "ref": "MFDS 고시 2024-02",       "note": "..." },
    "cn": { "level": "required",    "ref": "GB 9706.1-2020 §7.9.2",   "note": "누설전류 강화 조항" }
  },
  "layer2_classification": {
    "category_confirmed": "hw-bom",
    "confidence": 88.5,
    "reason": "부품 교체 + 안테나 재설계는 hardware BOM 변경으로 분류"
  },
  "layer4_similar_cases": [
    { "id": "CS-2024-107", "product": "RegenScan-Pro v2.1", "when": "2024-11",
      "change": "BLE 4.2 → 5.0 교체", "verdict": "FDA Letter to File · CE 신고",
      "source": "ra-llm-wiki/기술파일/RegenScan/DCN-2024-107" }
  ],
  "recommended_action": "ra-ticket",
  "auto_ticket_id": "Q-3407"
}
```

audit_log: `impact.check` + (필요시) `impact.ticket.create`.

---

## 3.2 RA APIs

### GET /api/inbox
Kanban 4열.

**Query**: `?state=auto|needs-review|escalated|waiting&assignee=me`

### GET /api/inbox/:id
상세.

### POST /api/inbox/:id/approve
ESIG로 답변 확정 → approved_answers에 스냅샷.

**Request**:
```json
{ "final_answer": "...", "citations": [...], "esig": { "password": "...", "meaning": "Approved" } }
```

audit_log: `inbox.approve`.

### POST /api/inbox/:id/escalate
외부 자문 또는 상급자 에스컬.

### POST /api/inbox/:id/reject
정책 위반 · 오분류 등.

---

### GET /api/consult/sessions · POST /api/consult/sessions · GET /api/consult/sessions/:id · POST /api/consult/sessions/:id/turns
Power Chat CRUD.

---

### GET /api/submissions · POST /api/submissions/:id/update-stage
제출 워크플로우.

---

### GET /api/radar · POST /api/radar/:id/assess-impact
규제 레이더 · 사내 임팩트 평가.

---

### GET /api/knowledge · POST /api/knowledge · PATCH /api/knowledge/:id (publish/draft/deprecate)
승인 답변집 관리 (RA 편집).

---

## 3.3 Admin APIs

전 엔드포인트 role `admin` 강제.

### Users
- `GET /api/admin/users`
- `POST /api/admin/users/:id/role` — role 변경 시 audit_log `role.grant`

### Corpus
- `GET /api/admin/corpus` — 3레포 상태 + commit hash
- `POST /api/admin/corpus/:repo/reindex` — 수동 재인덱싱
- `GET /api/admin/corpus/cron` — 크론 스케줄 (03:00/20/40)
- `POST /api/admin/corpus/cron` — 크론 편집 (BK-104)

### Radar Sources
- `GET /api/admin/radar-sources`
- `POST /api/admin/radar-sources/:id/toggle` — ON/OFF

### Audit Log
- `GET /api/admin/audit-log` — 페이지네이션 + 필터
- `POST /api/admin/audit-log/verify` — 무결성 재검증 (BK-105)
- `GET /api/admin/audit-log/verify/status` — 마지막 자동 검증 결과

### Settings
- `GET /api/admin/settings` · `PATCH /api/admin/settings/:group/:key`
- 그룹: `sla` · `triage` · `esig` · `integrations` · `retention`

### Product Design (내부 협업)
- `GET /api/admin/personas` · `PATCH /api/admin/personas/:id`
- `GET /api/admin/usability-meetings` · `POST /api/admin/usability-meetings`
- `GET /api/admin/backlog` · `POST /api/admin/backlog` · `PATCH /api/admin/backlog/:id/status`

---

## 3.4 공통 규칙

- 모든 write 액션은 `audit_log`에 INSERT (트랜잭션 내부)
- ESIG 필요 액션 (`approve` · `role.grant` · `settings.update`)은 `POST` body에 `esig` 오브젝트 필수
  ```json
  { "esig": { "password": "...", "meaning": "Approved|Reviewed|Authored", "reason": "..." } }
  ```
  → 서버는 password 재인증 확인 후 진행
- 페이지네이션: `?limit=20&offset=0` · 응답에 `total`
- 검색 팔레트: `GET /api/search?q=...` (프런트 로컬 인덱스는 데모용 · 프로덕션은 서버 fuzzy 검색)

---

## 3.5 SSE / WebSocket

- `/api/ask` — 스트리밍 응답 (SSE)
- `/api/inbox/subscribe` — 실시간 새 티켓 알림 (WebSocket)
- `/api/audit-log/subscribe` — 부정 접근 즉시 알림 (Admin console)
