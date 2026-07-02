# 05 · Claude Code Playbook

**목적**: Claude Code가 이 프로토타입을 실제 프로덕션 앱으로 구현할 때 필요한 실용 가이드.

---

## 원칙

1. **`src/v3/data.jsx`가 스키마의 유일한 진실.** DB 컬럼과 API 응답은 여기 필드를 그대로 반영.
2. **UI 세부는 프로토타입 그대로.** `Regula v3 - RA Gateway.html`을 열어 각 화면 인터랙션을 실제 확인 후 구현.
3. **재도입 금지 7건 지키기.** `04_backlog.md` 참조.
4. **모든 write 액션은 audit_log에 기록.** 트랜잭션 원자성 유지.
5. **정직성 원칙**: 목업 화면에 랜덤 데이터 · 가짜 통계 · "곧 나옴" 문구 금지. 미구현이면 PENDING 배지 표기.

---

## Phase별 브랜치 · PR 전략

**Phase 1 (Bootstrap)**: `feat/phase1-*` 브랜치, 각 PR은 하나의 서비스 (AskService, CorpusService, AuditService 등).
**Phase 2 (Inbox)**: `feat/inbox-*`
**Phase 3 (Impact Check)**: `feat/impact-*`
**Phase 4 (RA Workflow)**: `feat/ra-*`
**Phase 5 (Admin)**: `feat/admin-*`

각 PR에 아래 체크리스트 첨부:
- [ ] DB 마이그레이션 (`prisma migrate` 등)
- [ ] Zod/Yup 스키마 (요청 검증)
- [ ] Route guard (role check)
- [ ] audit_log 이벤트 (해당 시)
- [ ] E2E 테스트 (Playwright) · Kanban 이동 · ⌘K · Impact 위저드 필수
- [ ] `.env.example` 갱신

---

## 화면 매핑 (UI → 파일)

| 페르소나 | 화면 | 프로토타입 컴포넌트 | 실 구현 |
|---|---|---|---|
| Employee | Ask | `EmpAsk` in `Employee.jsx` | `/app/(employee)/ask/page.tsx` |
| Employee | 내 질의 | `EmpMyQuestions` | `/app/(employee)/my-questions/page.tsx` |
| Employee | 제품 카드 | `EmpProducts` | `/app/(employee)/products/page.tsx` |
| Employee | Guides | `EmpGuides` | `/app/(employee)/guides/page.tsx` |
| Employee | Impact Check | `EmpChangeImpact` | `/app/(employee)/impact/page.tsx` |
| RA | Inbox | `RaInbox` in `RA.jsx` | `/app/(ra)/inbox/page.tsx` |
| RA | Consult | `RaConsult` in `RaConsult.jsx` | `/app/(ra)/consult/page.tsx` |
| RA | Submissions | `RaSubmissions` | `/app/(ra)/submissions/page.tsx` |
| RA | Registry | `RaRegistry` | `/app/(ra)/registry/page.tsx` |
| RA | Radar | `RaRadar` + `RegulationOriginalCard` | `/app/(ra)/radar/page.tsx` |
| RA | Knowledge | `RaKnowledge` | `/app/(ra)/knowledge/page.tsx` |
| Admin | 12 화면 | `Admin.jsx` | `/app/admin/{overview,users,corpus,radar-sources,logs,settings,personas,usability,backlog}/page.tsx` |

---

## Component Library

프로토타입의 재사용 컴포넌트는 실 앱에서도 그대로 유지:

- `<PageHead title sub actions />` — 페이지 헤더
- `<Card><CardHead><CardBody>` — 기본 카드
- `<StateBadge state="approved" />` — 5-state
- `<PersonaBar />` — 3-tier persona 스위치
- `<SidebarV3 />` — 페르소나 인지 사이드바
- `<ProductDetailModal />` — 재시험 매트릭스 탭 포함
- `<GuideDetailModal />`
- `<QuestionDetailModal />`
- `<ToastHost />` · `<ModalHost />` — 전역 UI 이벤트
- `<SearchPalette />` — ⌘K
- `<TermAutocomplete />` — BK-106
- `<SimilarCasesCard />` — BK-034
- `<RegulationOriginalCard />` — BK-103

**디자인 토큰**: `styles/tokens.css` (건드리지 말 것) · `styles/v3.css` (페르소나 · 사이드바)

---

## Auto-Triage 구현 우선순위 (Phase 2 핵심)

```ts
async function triage(question: string, user: User, product?: Product) {
  // 1. RAG 검색
  const embedding = await embed(question);
  const chunks = await pgvector.search(embedding, { limit: 8 });

  // 2. LLM 답변 + confidence
  const llm = await claude.complete({
    system: ASK_SYSTEM_PROMPT,
    user: { question, context_chunks: chunks, user_role: user.role }
  });

  // 3. 위험 키워드 감지
  const dangerHit = DANGER_KEYWORDS.some(kw => question.toLowerCase().includes(kw));
  const category = classifyCategory(question); // ML classifier or LLM
  const inWhitelist = SAFE_DOMAINS.includes(category);

  // 4. 트리아지 결정
  let state: TriageState;
  if (dangerHit || llm.confidence < 60) state = 'escalated';
  else if (llm.confidence >= 85 && inWhitelist) state = 'auto';
  else state = 'needs-review';

  const sla = computeSLA(state); // 24h / 12h / 48h
  const ticket = await db.inbox_tickets.create({ ..., triage_state: state, sla_deadline: sla });

  await audit.log('triage.auto', ticket.id, { confidence: llm.confidence, category, state });

  return { ticket, answer: llm.text, citations: chunks };
}
```

---

## Ingest Pipeline (Phase 1 핵심)

Inngest job 3개:

```ts
// ingest-ra-llm-wiki (03:00 KST daily)
export const ingestRaLLMWiki = inngest.createFunction(
  { id: 'ingest-ra-llm-wiki' },
  { cron: '0 3 * * *' },
  async ({ event, step }) => {
    const repo = await step.run('clone', () => gitClone(NAS_URL, { key: NAS_SSH_KEY }));
    const files = await step.run('list-files', () => walkRepo(repo, ['.md', '.pdf', '.docx']));
    for (const file of files) {
      const chunks = await step.run(`parse-${file}`, () => parseAndChunk(file));
      const embeddings = await step.run(`embed-${file}`, () => embedBatch(chunks));
      await step.run(`store-${file}`, () => storeEmbeddings(embeddings, { source_repo: 'ra-llm-wiki' }));

      // BK-033: 제품 메타 자동 추출
      if (file.match(/기술파일\/(\d+_[^/]+)\/DHF/)) {
        const meta = await step.run(`extract-product-${file}`, () => extractProductMeta(chunks, file));
        await step.run(`upsert-product-${file}`, () => upsertProduct(meta));
      }
    }
    await audit.log('corpus.reindex', 'ra-llm-wiki', { files: files.length });
  }
);
```

`extractProductMeta`는 Claude API로 STED 첫 페이지 → JSON `{name, class, sub_type, standards, predicate}`.

---

## 감사 로그 · Hash Chain 검증 (BK-105)

```ts
// monthly cron
export const verifyAuditChain = inngest.createFunction(
  { id: 'verify-audit-chain' },
  { cron: '0 0 1 * *' },
  async ({ step }) => {
    const result = await step.run('verify', async () => {
      const rows = await db.$queryRaw`
        WITH r AS (
          SELECT seq, digest(
            ts::text || actor || action || target || COALESCE(meta::text,'') ||
            encode(previous_hash,'hex'), 'sha256'
          ) AS recalc FROM audit_log
        )
        SELECT COUNT(*) FILTER (WHERE r.recalc = a.hash) AS ok,
               COUNT(*) FILTER (WHERE r.recalc <> a.hash) AS mismatch
        FROM audit_log a JOIN r USING (seq);
      `;
      return rows[0];
    });

    if (result.mismatch > 0) {
      // Slack 대신 사내 알림 채널로 (BK-102 참조 · 채널 미확정 시 이메일 폴백)
      await notify.internal('audit_chain_broken', { mismatch: result.mismatch });
    }

    await db.audit_verify_history.create({
      run_at: new Date(), ok: result.ok, mismatch: result.mismatch,
      status: result.mismatch === 0 ? 'PASS' : 'FAIL'
    });
  }
);
```

---

## 테스트

**단위**: 각 서비스 (Ask/Inbox/Impact/Corpus/Audit) 최소 커버리지 70%.
**통합**: Kanban 이동 · ESIG 승인 → approved_answers 저장 → audit_log 기록 chain.
**E2E (Playwright)**:
- Employee Ask → auto-triage 응답 렌더 → MyQuestions 반영
- Employee Impact 위저드 4-step → 신호등 결과 + 유사 사례 카드 렌더
- RA Inbox Kanban 드래그 · List 뷰 토글
- Admin ⌘K → 페르소나 자동 전환 딥링크
- Admin audit 로그 재검증 버튼 → 무결성 검증 결과 표시

---

## 데모 데이터 시딩

프로토타입의 `D3` 오브젝트를 SQL seed로 변환:

```bash
pnpm ts-node scripts/seed-from-prototype.ts \
  --src src/v3/data.jsx \
  --out prisma/seed.ts
```

시드 스크립트가 유지되도록 `data.jsx`는 pure ES module로 export.

---

## 최종 체크리스트 (프로덕션 배포 전)

- [ ] 21 CFR Part 11 §11.10(e) · §11.50 · §11.100 · §11.200 · §11.300 준수 검증
- [ ] IQ/OQ/PQ 문서 (규제 요구)
- [ ] SSO + 2FA 활성 · Google Workspace 도메인 화이트리스트
- [ ] audit_log INSERT-only 룰 배포 (REVOKE UPDATE/DELETE)
- [ ] hash chain 검증 크론 등록 및 첫 실행 성공
- [ ] 3레포 인제스트 크론 실행 성공 (03:00/20/40)
- [ ] BK-201/202/108/102/203/204/205 재도입 금지 문서화
- [ ] 데이터 보관 정책 자동 삭제 크론 설정 (retention)
- [ ] VPN 게이트웨이 통한 사내 NAS 접근 확인
- [ ] 배포 시 감사 로그 초기 hash chain 시드
- [ ] 롤 백 시 데이터 무결성 (audit_log는 롤백 불가)

---

## 참고

- 프로토타입 인터랙션 검증: `Regula v3 - Standalone.html`을 열어 각 시나리오 실제 클릭
- 페르소나 프로필 (crossCheck · redLines · decisionWeight · evaluationScope): `src/v3/data.jsx:437`
- 회의록 원본 (findings + decisions): `src/v3/data.jsx:572`
- 백로그 원본 (basis + resolvedAt): `src/v3/data.jsx:843`
