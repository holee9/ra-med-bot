# llm-wiki 소비자 리트리버 설계 (대기 상태 — #18 7단계 인수시험 통과 후 착수)

작성: 2026-10-23 · 3세션 수렴 원칙 반영 (hermes-ra·ra-hermes-multi 이견 없음)

## 목적

llm-wiki(선별·고신뢰 지식 계층 ②)를 Regula 상담 검색에 병합한다.
①전수 NAS(nas_ra_docs)가 recall을 담당하고, ②wiki가 검증된 종합을
담당한다 — ECOSYSTEM 헌장 원칙 5(지식 토대 공유)의 두 번째 연결.

## 공식 인터페이스 (AI-CONSUMER-GUIDE v1.0 확정)

- **Gitea API만 사용** (clone 금지): `http://diskstation:7001/api/v1`
- **고정 commit 조회**: 답변 1건마다 `GET /repos/DR_RnD/ra-llm-wiki/git/refs/heads/main`로
  SHA를 확보 → 이후 모든 파일 요청에 동일 `ref` 사용 (한 답변에 commit 혼용 금지)
- **발견**: `wiki/indexes/agent/catalog.json` (64,084 엔트리 — path·type·title·summary·tags·updated)
- **본문**: `GET /repos/DR_RnD/ra-llm-wiki/contents/{path}?ref={SHA}`
- **권한**: RA_Wiki_Consumers 팀 (코드 Read·이슈 Read/Write·Write/PR 금지)
- **피드백**: Gitea 이슈 #1 댓글로만 (공식 지식 아님)

## 리트리버 (lib/ai/retrievers/llm-wiki.ts — 설계)

`corpus = 'llm-wiki'`, NasDocsRetriever와 동일 구조:

1. **질의 임베딩**: catalog 엔트리는 임베딩되어 있지 않다(메타데이터 색인).
   검색 경로 2안:
   - **A안(권장)**: catalog 전체를 로컬 캐시로 적재(64,084 × title+summary 약 60토큰
     ≈ 400만 토큰 — 1536 MRL로 임베딩해 pgvector 별도 테이블/컬렉션 보관, 일 1회 갱신)
     → 질의 시 벡터 검색으로 상위 N 엔트리 발견 → 해당 Markdown 본문을 고정 SHA에서 fetch
   - B안(대안): 키워드/태그 매칭으로 catalog 필터링 — 임베딩 비용 0이지만 한국어
     재현율이 title 품질에 의존. A안 우선, 초기 버전은 B안으로 시작해도 무방
2. **본문 fetch**: 발견된 엔트리 path → contents API (?ref=고정 SHA) → 청크
3. **매핑**: RetrievedResult { id: `wiki-{path-hash}`, content, score,
   sourceId: **wiki 프록시 sources 행** (아래), metadata: { orgLabel: 'llm-wiki',
   title, url: null, wikiPath, **출처 포인터: wiki 엔트리의 원 NAS 문서 경로** } }
4. **장애 우회**: Gitea 접근 불가 시 [] 반환 — nas-docs가 답변 유지

## 병합 원칙 (hermes-ra 제안, 3세션 채택)

1. **출처 포인터 필수**: wiki 경유 청크는 원 NAS 문서 경로를 metadata에 반드시
   동반 — 인용 클릭 시 원 근거로 환원 (wiki가 아닌 원문이 진실원)
2. **권위 위계 → authority_grade 매핑** (충돌 판정):
   - 공식 발급 문서 (인증서·허가증) → `regulator_official`
   - 사내 규정 (SOP·품질매뉴얼) → `internal_sop`
   - wiki 컴파일 (종합·재구성) → `harmonized_standard` 아래 별도 취급:
     동일 주장 충돌 시 상위 등급이 승리. wiki 프록시 sources 행의 grade는
     `internal_sop`로 두되, 동일 주제 상위 등급 청크가 검색되면 wiki 청크는
     참조용으로만 (점수 감쇠 ×0.8)
3. **A/B 실측**: 병합 전후를 시험은행 42건(hermes-ra 제공)으로 측정 —
   wiki 병합이 정확도를 낮추면 계층 ②는 재설계

## 시드 데이터 (착수 시)

```sql
-- wiki 프록시 sources 행 (nas와 동일 패턴)
INSERT INTO sources (org_label, title, type, organization_id, approval_status, authority_grade)
VALUES ('llm-wiki', 'RA LLM Wiki (선별 지식 계층)', 'Internal', :org, 'approved', 'internal_sop');
-- + source_license (internal_sop·영구)
```

## 착수 조건 (전부 확인 후)

- [ ] #18 7단계 "원격 AI 고정 SHA·catalog 소비 인수시험" 완료 보고
- [ ] RA_Wiki_Consumers 팀 가입 승인 (사용자)
- [ ] GITEA_TOKEN에 wiki 저장소 Read 권한 확인

## 관련

- NAS 연결(계층 ①): 커밋 fcf1bed — 라이브 실증 0.933
- 소비 계약 원문: DR_RnD/ra-llm-wiki/AI-CONSUMER-GUIDE.md
- 협의 기록: 3세션 망형 메시지 (2026-10-22~23)
