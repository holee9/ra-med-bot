# llm-wiki 소비자 리트리버 설계 (구현 완료 — 2026-10-28, #550)

작성: 2026-10-23 · 3세션 수렴 원칙 반영 (hermes-ra·ra-hermes-multi 이견 없음)
**구현: 2026-10-28 착수·완료** — 착수조건 3종 실측 충족(고정 SHA `f1d939a` 소비·토큰 Read·
팀 권한), B안(키워드 catalog 검색)으로 `LlmWikiRetriever` 구현, A/B 실측 통과(아래).

## 목적

llm-wiki(선별·고신뢰 지식 계층 ②)를 Regula 상담 검색에 병합한다.
①전수 NAS(nas_ra_docs)가 recall을 담당하고, ②wiki가 검증된 종합을
담당한다 — ECOSYSTEM 헌장 원칙 5(지식 토대 공유)의 두 번째 연결.

## 공식 인터페이스 (AI-CONSUMER-GUIDE v1.0 — 2026-10-28 실측 갱신)

- **Gitea API만 사용** (clone 금지): `http://diskstation:7001/api/v1`
- **고정 commit 조회**: 답변 1건마다 `GET /repos/DR_RnD/ra-llm-wiki/git/refs/heads/main`로
  SHA를 확보 → 이후 모든 파일 요청에 동일 `ref` 사용 (한 답변에 commit 혼용 금지)
- **발견 (실측 2026-10-27 배포분)**: catalog는 **매니페스트 + 타입별 JSONL 샤드**로 진화 —
  `wiki/indexes/agent/catalog.json`(매니페스트: total_entries·counts·entry_schema) +
  `wiki/indexes/agent/{concept,entity,source,query,comparison,synthesis,methodology}-NNN.jsonl`
  (총 64,114 엔트리). 샤드 목록은 디렉터리 리스팅으로 확보. 엔트리 스키마:
  `path·type·title·summary·tags·aliases·updated`
- **본문**: `GET /repos/DR_RnD/ra-llm-wiki/contents/{path}?ref={SHA}` (소형) /
  `raw/{path}?ref={SHA}` (샤드 등 대형 — base64 팽창 없음)
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

## 착수 조건 (2026-10-28 전부 실측 충족 — 착수 완료)

- [x] #18 7단계 "원격 AI 고정 SHA·catalog 소비 인수시험" — 2026-10-27 배포 아티팩트를
  ra-med-bot이 직접 소비 검증(고정 SHA `f1d939a` 확보·재조회 동일, 샤드·본문 fetch 성공)
- [x] RA_Wiki_Consumers 팀 가입 — 토큰으로 전 소비 API 정상 입증
- [x] GITEA_TOKEN wiki 저장소 Read 권한 — repo 접근 200 실측

## 구현·검증 결과 (2026-10-28, #550)

- `lib/ai/retrievers/llm-wiki.ts` — B안(키워드 catalog 검색) 구현. catalog는
  디스크 캐시(24h TTL, `var/llm-wiki/`) + 과반수 샤드 장애 시에만 무효(부분 장애 허용).
  병합은 merge.ts 레지스트리 + router 항시 포함. wiki 프록시 sources 행·source_license 시드
  (scripts/seed-llm-wiki-source.ts).
- **A/B 실측 (시험은행 40건, retrieval-level hit@8)**:
  A(NAS 단독) 10% → B(NAS+llm-wiki) 15% — **상승 +2, 회귀 0** → 계층 ② 유지 확정
  (계약 "병합이 정확도를 낮추면 재설계" 미발동). 측정 스크립트:
  `scripts/ab-llm-wiki-testbench.ts`
- 단위 테스트 9건(게이트·매핑·출처 포인터·부분 샤드 장애·전면 장애) 통과

## 관련

- NAS 연결(계층 ①): 커밋 fcf1bed — 라이브 실증 0.933
- 소비 계약 원문: DR_RnD/ra-llm-wiki/AI-CONSUMER-GUIDE.md
- 협의 기록: 3세션 망형 메시지 (2026-10-22~23)
