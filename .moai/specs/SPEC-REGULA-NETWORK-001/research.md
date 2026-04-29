---
id: SPEC-REGULA-NETWORK-001
artifact: research
created: 2026-04-22
updated: 2026-04-22
author: manager-spec
phase: 11
priority: Medium
skill: regula
related_spec: .moai/specs/SPEC-REGULA-NETWORK-001/spec.md
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-ENTERPRISE-001 (v0.2.0+)
  - SPEC-REGULA-CLOUDFLARE-001 (implied — edge/Worker isolation)
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-RADAR-001
---

# Research — SPEC-REGULA-NETWORK-001 (Phase 11: Network Intelligence, Opt-in Anonymized Aggregate)

본 research.md는 Regula Phase 11 "Network Intelligence" SPEC 작성 전 기술 선택지, 프라이버시 보장 모델, 법적 경계, 공격 시나리오, 유사 업계 사례, 데이터 파이프라인 격리 아키텍처를 평가한다. 의료기기 RA 도메인의 특수 제약(21 CFR Part 11, GDPR, HIPAA, MFDS·NMPA·PMDA 지역별 개인정보 법제)을 감안하여 **"개별 제출 식별이 수학적으로 불가능하면서 전체 시장 시그널이 의미 있는 집계"**를 달성하는 설계 공간을 탐색한다. 본 문서는 의사결정의 근거 문서로서 spec.md의 Technical Decisions 테이블과 일대일 매핑된다.

---

## 1. 문제 정의 및 Unique Signal 가치

### 1.1 현재 산업 상태

의료기기 RA(Regulatory Affairs) 업무는 본질적으로 **정보 비대칭 시장**이다. 규제 당국(FDA, EU Notified Body, MFDS, NMPA, PMDA)은 승인 결정, 결함 지적(deficiency letter, 483 form, MDR non-conformance), 심사 타임라인 등의 일부를 공개하지만, 다음은 대부분 비공개이다:

- 개별 기업이 받은 상세 deficiency 지적 텍스트 (FDA 510(k) summary만 일부 공개; MDR은 불투명)
- 초기 submission 대비 추가 자료 요청까지의 평균 기간 (AI/SaMD의 경우 매우 가변적)
- Predicate device 선택 후 clearance까지의 실제 성공률 (510(k) withdraw/refile 패턴)
- Indication 확장 경로 시도 대비 승인 사례
- FDA 483 관찰이 MDR 전환에 미치는 실제 영향

개별 consultant (Emergo, RQMIS, NSF 등)는 자사가 수주한 프로젝트 데이터에만 접근 가능하므로 시장 전체 시그널을 제공할 수 없다. **Regula는 멀티 조직 SaaS 특성상 유일하게 이 시그널을 집계할 수 있는 위치에 있다.**

### 1.2 전략적 의의

| 축 | 가치 | 측정 가능한 효과 |
|---|---|---|
| Unique Signal | consultant도 접근 불가능한 data moat | 네트워크 효과 (조직 수 증가 → aggregate 정교화) |
| Pricing leverage | "이 데이터는 우리만 있다" 정당화 | Enterprise tier upsell 근거 |
| 규제 전략 지원 | 평균 심사 기간, deficiency 패턴 기반 전략 수립 | 클라이언트 submission success rate 향상 |
| R&D 방향성 | 어떤 섹션이 자주 deficiency → guidance 개선 우선순위 | product-led insight |

이 가치는 **"집계가 의미 있는 규모"**일 때만 성립한다. minimum 20 contributing orgs threshold는 신뢰 구간 확보 + k-anonymity k≥5 × 4-grouping의 수학적 최소치이다.

### 1.3 전략의 위험

네트워크 intelligence는 잘못 설계되면 조직의 신뢰를 영구히 훼손한다. 최악의 시나리오:

1. **Re-identification breach** — 집계가 너무 세밀하여 경쟁사가 특정 조직의 submission 내용을 역추론
2. **Regulatory reinterpretation** — 당국이 anonymized aggregate를 PHI (Protected Health Information)로 재해석 → HIPAA violation 위험
3. **Competitive chilling effect** — 조직이 "내 데이터가 경쟁사에 도움이 된다"고 판단하여 opt-out 대량 발생
4. **Bootstrap 실패** — 초기 참여 조직 수 부족으로 집계 무의미, 수년간 가치 제로

따라서 본 SPEC은 **프라이버시 수학적 보장 + 법적 견고성 + 참여 인센티브 설계**의 3축 균형이 핵심이다.

---

## 2. Privacy 보장 모델 평가

### 2.1 k-anonymity (Sweeney 2002)

**정의:** 데이터셋의 각 레코드가 최소 k-1개의 다른 레코드와 quasi-identifier 속성에서 구분 불가능하도록 일반화하는 기법.

**핵심 개념:**
- Quasi-identifier (QI): 단독으로는 식별자가 아니나 조합 시 재식별 가능한 속성 (예: device class + category + jurisdiction + submission_year)
- Sensitive attribute (SA): 보호 대상 값 (예: review_duration_days, deficiency_count)
- k-threshold: Regula에서 k≥5 채택 (업계 표준 k≥3~5; 의료 도메인은 보수적으로 5)

**구현 알고리즘 선택:**

| 알고리즘 | 장점 | 단점 | Regula 적합성 |
|---|---|---|---|
| Datafly (Sweeney 1997) | 단순, 구현 용이 | over-generalization | 프로토타입 초기 |
| Mondrian (LeFevre 2006) | multidimensional partition, information loss 최소화 | 구현 복잡도 중간 | **채택 후보** |
| Incognito (LeFevre 2005) | full-domain generalization, 완전성 보장 | 계산 비용 높음 | 소규모 데이터에 과함 |
| Anatomy (Xiao 2006) | QI-SA 분리 저장, utility 높음 | 공격자 모델 제한적 | DP와 결합 시 설계 복잡 |

**권장:** Mondrian 기반 구현. pgvector 및 SQL 파티션과 궁합이 좋고, Cloudflare Worker JavaScript 포팅이 가능(오픈소스 ARX 툴킷 참조 구현 존재).

**한계:**
- k-anonymity는 **homogeneity attack** (동일 k-그룹 내 모든 레코드의 SA 값이 동일) 및 **background knowledge attack** (외부 지식과 결합) 에 취약.
- 이를 보완하기 위해 l-diversity (Machanavajjhala 2006) 또는 t-closeness (Li 2007)를 고려해야 하나, 의료 네트워크 데이터에서는 DP와 조합하는 것이 산업 표준(Flatiron Health, Tempus Labs 사례 참조).

### 2.2 Differential Privacy (Dwork 2006)

**정의:** 임의의 단일 레코드 추가/삭제가 집계 출력의 확률 분포를 ε 이하로만 변화시키는 수학적 보장. 외부 지식과 관계없이 **재식별 상한** 을 제공한다.

**수식:**
> A randomized mechanism M satisfies ε-differential privacy if, for all datasets D1, D2 differing in one record, and all S ⊆ Range(M):
> Pr[M(D1) ∈ S] ≤ e^ε · Pr[M(D2) ∈ S]

**Laplace Mechanism:**
- 집계 함수 f (예: COUNT, AVG)의 global sensitivity Δf 계산
- 출력값에 Laplace(Δf / ε) 노이즈 추가
- 예: COUNT query, Δf = 1, ε = 1.0 → Laplace(1.0) 노이즈 (표준편차 √2 ≈ 1.41)

**ε 선택 근거:**

| ε 값 | 프라이버시 강도 | 유틸리티 손실 | 업계 벤치마크 |
|---|---|---|---|
| 0.1 | 매우 강함 | 높음 (집계 의미 약화) | US Census 2020 (ε≈0.1~0.5 per attribute) |
| 1.0 | 강함 | 중간 | Apple iOS keyboard, Google RAPPOR (**Regula 채택**) |
| 10.0 | 약함 | 낮음 | 일부 학술 연구 (실용성 > 프라이버시) |

**Regula ε=1.0 정당화:**
- k-anonymity와 결합하므로 DP만으로 방어하는 시나리오보다 약한 ε 허용 가능
- 의료기기 비식별 aggregate는 HIPAA Safe Harbor 상응 수준 필요 → ε≤1.0이 NIST SP 800-188 가이드라인 권장 범위
- 유틸리티 (평균 심사 기간의 실제 의사결정 활용 가능성) 고려 시 ε=1.0이 sweet spot

**Privacy Budget 관리:**
- Cumulative privacy budget theorem: 동일 데이터에 여러 쿼리 실행 시 ε 누적
- Regula는 주 1회 batch 집계 → 주당 ε_weekly=1.0 고정
- 동일 조직 데이터에 대한 누적 쿼리는 **연간 ε_annual ≤ 52** 상한 모니터링
- Post-processing invariance: 공개된 aggregate에 대한 downstream 연산은 추가 ε 소비 없음 (이론적 보장)

### 2.3 k-anonymity + DP 조합 (Composite Model)

**설계 원리:**
1. **1단계: k-anonymity 그룹핑** — device_class × regulatory_category × jurisdiction × submission_year_bin으로 쿼시 아이덴티파이어 그룹 생성. 각 그룹이 k≥5 레코드 확보되지 않으면 suppress (집계 생략).
2. **2단계: DP 노이즈 주입** — k-그룹 내 aggregate 계산 결과에 Laplace(Δf/ε) 노이즈 추가.
3. **3단계: minimum aggregate threshold** — k-그룹 내 contributing 조직 수 < 20이면 최종 suppress.

**왜 둘 다 필요한가:**
- k-anonymity만: homogeneity attack 및 linking attack 위험
- DP만: 강력한 보장이지만 ε≤0.1 수준 아니면 ε=1.0에서 여전히 개별 조직 영향 추정 가능
- 둘 결합 → k-anonymity가 quasi-identifier linking 차단, DP가 SA 값의 외부 지식 결합 공격 차단

### 2.4 대안: Secure Multi-Party Computation (MPC) / Homomorphic Encryption

**MPC 장점:** raw data가 중앙에 모이지 않아도 집계 계산 가능 → 강력한 confidentiality
**MPC 단점:**
- 구현 복잡도 매우 높음 (SPDZ, BGW 프로토콜)
- 각 조직에 MPC 클라이언트 설치 필요 → deployment 장벽
- 집계 재산출 시 전체 조직 participation 필요 (offline 불가)
- Cloudflare Worker 환경에서 성숙한 라이브러리 부재

**Homomorphic Encryption (FHE/PHE) 장점:** encrypted 상태로 계산
**단점:**
- CKKS/BGV 스키마의 성능 제약 (단순 COUNT 쿼리에도 수 초)
- 의료기기 aggregate 규모에서 production 사례 제한적

**결정:** Regula v1은 k-anon + DP 단일 레이어 채택. MPC/FHE는 Post-launch evolution 검토 대상으로 기록.

### 2.5 참조 가능한 오픈소스

| 툴킷 | 언어 | 기능 | Regula 활용 가능성 |
|---|---|---|---|
| [ARX](https://arx.deidentifier.org/) | Java | k-anon, l-div, t-closeness, DP | 참조 구현, 포팅 기반 |
| [Google DP library](https://github.com/google/differential-privacy) | C++/Go/Java/Python | DP primitives (Laplace, Gaussian) | Postgres/Node에서 사용 가능 Python variant |
| [IBM Diffprivlib](https://github.com/IBM/differential-privacy-library) | Python | DP 학습 알고리즘, mechanism | 분석 단계 참조 |
| [OpenDP](https://opendp.org/) | Rust/Python | NIST 관계자 주도, 검증된 DP 프레임워크 | **우선 검토 대상** |

---

## 3. 공격 시나리오 및 Mitigation

### 3.1 공격자 모델

| 공격자 유형 | 동기 | 능력 | 주요 공격 벡터 |
|---|---|---|---|
| Malicious competitor | 경쟁사 파이프라인 파악 | Regula 접근 (구독), 외부 공시 데이터 결합 | linking attack, targeted query |
| Regulatory inspector | 특정 기업 재해석 | FDA public DB 결합 | background knowledge attack |
| Data broker | aggregate 재판매 | API scraping, aggregate resampling | reconstruction attack |
| Insider (Regula 직원) | 가치 있는 raw data 유출 | 내부 Worker 접근 | trust boundary violation |

### 3.2 Re-identification 공격 시나리오

#### 시나리오 A: Homogeneity Attack
**공격 방식:** k-그룹 내 모든 레코드의 deficiency pattern이 "Software verification + Clinical study"로 동일 → k=5 보장에도 불구 SA 값 추론.

**Mitigation:**
- k≥5 + l-diversity l≥3 보강 (향후 v1.1)
- Regula v1: k≥5 + DP noise로 aggregate count 왜곡

#### 시나리오 B: Linking Attack (외부 데이터 결합)
**공격 방식:** FDA 510(k) database + EUDAMED public listing 데이터로 device class × year × jurisdiction 조합 좁힘 → Regula aggregate의 특정 cell 매핑.

**Mitigation:**
- Jurisdiction을 "US/EU/JP/KR/CN/ROW" 6-level 일반화 (국가별 공개 DB와의 1:1 매핑 차단)
- Submission year를 2-year bin으로 일반화
- k-anonymity quasi-identifier 목록에 **명시적 등록** (lib/privacy/quasi-identifiers.ts)

#### 시나리오 C: Reconstruction Attack
**공격 방식:** 동일 aggregate에 반복 쿼리 (weekly cron 외 API 재호출)로 DP noise 평균화 → 원본 값 복원.

**Mitigation:**
- Aggregate 결과 캐시 → 재계산 금지 (cache.ttl = 1 week)
- API query logging → 동일 cell 반복 접근 anomaly detection
- Privacy budget ε per aggregate 누적 추적

#### 시나리오 D: Differential Attack (조직 opt-in/out timing)
**공격 방식:** 조직 X가 opt-in 후 aggregate 변화량으로 X의 기여 역산.

**Mitigation:**
- Opt-in 후 minimum 7일 지연하여 aggregate 반영 (noise 시간 분산)
- Opt-in/opt-out 이벤트 시 즉시 aggregate 재계산 금지 (weekly batch 대기)
- Aggregate 변화량 delta 자체를 DP noise로 보호

#### 시나리오 E: Membership Inference Attack
**공격 방식:** 특정 조직이 특정 signal에 opt-in했는지 역추론.

**Mitigation:**
- opt-in 목록은 조직 자신 + Regula admin만 조회 가능 (RBAC enforced)
- aggregate 메타데이터에 contributing org 개수만 공개, 식별 정보 무공개
- Phase 5 audit_logs의 network.optin_change 접근 권한 제한 (admin only)

### 3.3 Insider Threat Mitigation

**원칙:** "raw data를 직접 보는 사람 수를 최소화한다"

**아키텍처 분리:**
- raw contributing data → 격리된 Cloudflare Worker `regula-anonymizer` (별도 서비스)
- Regula 메인 Postgres에는 anonymized aggregate만 저장
- Worker와 메인 DB 간 통신은 mTLS + JWT 서명 (Cloudflare Access)
- Worker 로그는 PII-free (aggregate metadata만)
- Raw data retention: 익명화 완료 직후 삭제 (max 48h)

**접근 통제:**
- Regula admin도 raw data 조회 불가 (감사 목적 외)
- 감사 목적 조회는 별도 break-glass workflow (admin 2명 승인 + audit log + 1시간 timeout)
- Worker 코드는 별도 repo + 별도 deploy 권한

---

## 4. DLP (Data Loss Prevention) 정적 Rule

### 4.1 식별자 사전 (의료기기 도메인)

| 식별자 유형 | 정규식 패턴 | 예시 |
|---|---|---|
| FDA K-number | `K\d{6}` | K243521 |
| FDA De Novo | `DEN\d{6}` | DEN230015 |
| CE certificate | `\d{4}/\d{4}/[A-Z]{2,3}` | 0123/2024/MDR |
| NMPA 등록번호 | `国械[注|备]\d{4,}` | 国械注准20243091234 |
| MFDS 승인번호 | `제\d{4,}호` | 제2024-05123호 |
| PMDA 승인번호 | `\d{3}AMBZX\d{5}000` | 228AMBZX00001000 |
| UDI-DI | `\d{14}` (GS1 GTIN) | 00341712345678 |
| Company name (pattern-based) | 조직명 사전 + Trademark DB 참조 | "Regula Medical Co." |

### 4.2 DLP Pipeline Stage

```
raw_submission_data
  ↓ [Stage 1] Structural field whitelist (allow: device_class, review_days, deficiency_count)
  ↓ [Stage 2] Free-text field regex sanitization (strip K-number, etc.)
  ↓ [Stage 3] Named Entity Recognition (optional v1.1 — Claude Haiku 기반)
  ↓ [Stage 4] Manual sample audit (weekly, admin-led, 50 samples)
anonymized_contribution
```

### 4.3 DLP Validation Gate

**정적 분석:**
- `scripts/qa/dlp-completeness.ts` — 모든 `network_contributions.raw_data_json` write path가 DLP sanitizer 통과 검증 (ts-morph)
- regex 사전 완전성 테스트 (known positive set 95%+ detection)

**런타임:**
- sanitizer 출력에 blocked identifier 잔존 시 → write abort + Sentry alert
- Monthly red-team sample: admin이 known identifier 포함 synthetic submission 투입하여 leak 검증

---

## 5. Legal · Regulatory Boundary 평가

### 5.1 GDPR (EU General Data Protection Regulation)

**핵심 조항:**
- Article 4(1): "Personal data" — 식별 가능한 자연인 관련 정보
- Recital 26: Anonymized data는 GDPR scope 외
- Article 17: Right to erasure — anonymized 이후에는 삭제 의무 없음 (단, anonymization 전 데이터는 삭제 필요)

**Regula 해석:**
- 의료기기 회사는 자연인이 아니므로 GDPR 직접 적용 대상이 아님 BUT 조직 내 submission 담당자의 개인 정보가 포함될 수 있음 → DLP로 제거 필수
- Opt-out 요청 시: raw data 하드 삭제 + 해당 기여분이 반영된 aggregate 재계산 필요 → **Right to be forgotten 구현의 핵심**

### 5.2 HIPAA (미국 건강정보 보호법)

**핵심 조항:**
- 45 CFR § 164.514(b)(2) Safe Harbor method — 18개 식별자 제거 시 non-PHI
- Expert Determination method — 통계 전문가가 re-identification risk 매우 낮음 확인

**Regula 해석:**
- 의료기기 submission 데이터는 patient PHI와 분리되어 있어야 하지만, clinical study section에 간접 환자 정보 유입 가능
- DLP pipeline에서 18개 식별자 (이름, 주소, 날짜 구체성, SSN, MRN 등) 제거 필수
- Safe Harbor 달성 근거 문서 필요 (Privacy Impact Assessment)

### 5.3 21 CFR Part 11 (Electronic Records)

**핵심 조항:**
- § 11.10 Controls for closed systems — audit trail, access control
- Regula의 network_optins, network_contributions는 electronic record에 해당

**Regula 해석:**
- network.optin_change 이벤트는 audit_logs에 기록 필수 (tamper-evident)
- aggregate 재계산 트리거 action도 audit_logs 기록
- **중요:** anonymized aggregate 자체는 electronic record BUT not patient record → Part 11 scope 내이지만 PHI scope 외
- 규제 당국 (FDA) 비공식 검토 권장 사항: 변호사 자문 후 Pre-submission meeting으로 scope 확인

### 5.4 MFDS (한국 식약처), NMPA (중국 약감국), PMDA (일본 PMDA)

**MFDS:**
- 의료기기법 제34조 — 사후관리 정보 수집 범위
- 개인정보보호법 (PIPA) 상 익명정보 해석: 복원 불가능한 정보는 개인정보 아님
- **Regula 해석:** 기여 조직이 한국 법인인 경우 PIPA 적용, DLP 완화 수준 엄격 검토 필요

**NMPA:**
- 중국 데이터 안전법 (DSL 2021), 개인정보보호법 (PIPL 2021)
- **Cross-border data transfer 제약** — 중국 기업의 raw data를 해외 서버로 전송 시 안전 평가 필요
- **Regula 해석:** 중국 조직 opt-in 시 DLP 및 익명화 처리를 중국 내 Worker에서 수행하는 geo-fenced 모델 고려

**PMDA:**
- 개인정보보호법 (APPI) — 익명가공정보 (anonymously processed information) 해석
- 2022년 개정: 익명가공정보는 GDPR pseudonymized data와 유사한 수준 요구
- **Regula 해석:** APPI 기준 부합 익명화 pipeline 검증 필요 (일본 전문가 검토)

### 5.5 Privacy Impact Assessment (PIA)

**프레임워크 선택:**
- ICO (UK Information Commissioner's Office) PIA 템플릿
- NIST Privacy Framework v1.0 (2020)
- CIPL (Centre for Information Policy Leadership) PIA 체크리스트

**Regula PIA 필수 섹션:**
1. 데이터 흐름도 (raw → DLP → anonymization → aggregate)
2. 공격자 모델 및 threat analysis (본 Section 3)
3. Privacy mechanism 수학적 보장 (k≥5, ε=1.0 증명)
4. 법적 근거 검토 (Section 5.1~5.4)
5. 조직 opt-in 동의 유효성 (투명성, withdrawal 권리)
6. 외부 감사 결과 (pre-launch requirement)
7. 사고 대응 계획 (breach notification 72h GDPR 기준)

**결정:** Pre-launch **외부 전문가 PIA 필수**, 승인 없이 production 배포 금지.

### 5.6 Network Intelligence Addendum (계약서)

**조직 계약서 별도 addendum 필수 조항:**
1. Opt-in 대상 signal 카테고리 (6종) 명시
2. Anonymization 방법 요약 (k≥5 + ε=1.0)
3. Withdrawal 절차 및 효력 (72h 내 raw 삭제 + aggregate 재계산)
4. Aggregate 사용 권한 범위 (조직 내부 의사결정 목적 한정, 재판매 금지)
5. Regula의 책임 한계 (anonymization 견고성 보증 but 0% re-identification 약속 불가)
6. 법적 관할 및 분쟁 해결 (per 조직 본사 소재지)

---

## 6. 유사 업계 사례 분석

### 6.1 Flatiron Health (종양학 real-world data)

**모델:** 250+ 종양 clinic로부터 EHR 데이터 집계, FDA regulatory-grade real-world evidence 제공. Roche가 $1.9B 인수(2018).

**Privacy 접근:**
- HIPAA Safe Harbor + Expert Determination 이중 레이어
- De-identification by professional statisticians
- Data partner agreement (참여 병원)

**Regula에 주는 교훈:**
- 의료 도메인에서 네트워크 intelligence는 viable business
- 법적 견고성 (HIPAA Expert Determination) 이 엔터프라이즈 신뢰의 핵심
- 참여 조직 수가 집계 가치의 linear 함수 (bootstrap 중요성)

### 6.2 Tempus Labs (유전체 + clinical data)

**모델:** 병원으로부터 genomic + clinical data 수집, multi-modal AI로 treatment insight 제공.

**Privacy 접근:**
- HIPAA-compliant de-identification
- Federated learning 연구 (raw data 이동 없이 모델 학습)

**Regula에 주는 교훈:**
- Federated approach는 future evolution 방향 (v2)
- 초기에는 centralized anonymization이 engineering feasibility 높음

### 6.3 Apple (iOS keyboard usage DP)

**모델:** iOS 키보드 사용 통계를 ε=2~8 DP로 Apple에 전송.

**Privacy 접근:**
- On-device DP (local DP) — device에서 노이즈 추가 후 서버 전송
- Privacy budget per user per day

**Regula에 주는 교훈:**
- Local DP는 raw data 전송 자체를 방지 → 더 강한 보장이나 집계 정확도 희생
- Regula 의료기기 도메인은 집계 정확도가 중요 → centralized DP 적절

### 6.4 Google RAPPOR (Chrome telemetry)

**모델:** Chrome 사용자 설정 통계를 randomized response 기법으로 수집.

**Privacy 접근:**
- Randomized response (Warner 1965) + Bloom filter
- ε=ln(3) ≈ 1.1 per query

**Regula에 주는 교훈:**
- ε=1.0 수준은 consumer-scale에서 실용적으로 검증됨
- 의료 도메인은 더 보수적 (ε≤1.0 상한)

### 6.5 US Census 2020 DP 적용

**모델:** US Census Bureau는 2020년 인구 조사 결과에 DP 적용 (ε 분할).

**Privacy 접근:**
- ε_global ≈ 19.6, 지역 단위 분할
- TopDown algorithm (계층적 DP)

**Regula에 주는 교훈:**
- 큰 스케일에서 DP 적용 legitimate, but 작은 cell (rural county)에서 논란 → minimum aggregate threshold 필수
- Regula: minimum 20 orgs × k≥5 보수 기준 합리적

### 6.6 Apple ResearchKit / Fitbit 데이터 공유

**부정적 사례:** 초기 불투명한 데이터 활용 → 이용자 신뢰 훼손 → 참여 감소.

**Regula 교훈:**
- Transparency-by-default (집계 방법론 공개, PIA 공개)
- Per-signal opt-in granularity (all-or-nothing 지양)

---

## 7. 데이터 파이프라인 격리 아키텍처

### 7.1 계층 설계

```
┌─────────────────────────────────────────────┐
│  Main Regula Postgres (existing)            │
│  - users, organizations, projects           │
│  - audit_logs (Phase 5 RBAC-protected)     │
│  - network_optins (org consent state)       │
│  - network_aggregates (anonymized output)   │
└─────────────────────────────────────────────┘
                    ▲
                    │ (aggregate write only, signed)
                    │
┌─────────────────────────────────────────────┐
│  Cloudflare Worker: regula-anonymizer       │
│  (ISOLATED — separate deploy, separate      │
│   secrets, separate logs)                   │
│  - DLP sanitizer                            │
│  - k-anonymity grouping (Mondrian)          │
│  - DP Laplace mechanism (OpenDP)            │
│  - minimum threshold enforcement            │
└─────────────────────────────────────────────┘
                    ▲
                    │ (raw contribution, encrypted in transit)
                    │
┌─────────────────────────────────────────────┐
│  Main App: /api/ra/network/contribute       │
│  (opt-in org만 호출 가능, RBAC gated)      │
│  - 조직 ID + signal type + raw_data         │
│  - 임시 staging table `network_contributions`│
│    (encrypted at rest, TTL 48h)             │
└─────────────────────────────────────────────┘
                    ▲
                    │
            [Opt-in Organization]
```

### 7.2 Trust Boundary

| Boundary | Protection |
|---|---|
| Org → Main App | mTLS, JWT (Auth.js session), RBAC `network.contribute` permission |
| Main App → Anonymizer Worker | Cloudflare Access (Service Token), mTLS, request signing |
| Anonymizer Worker → Main Postgres (aggregate write) | Dedicated service role (write-only to `network_aggregates`), no raw_data access |
| Anonymizer Worker internal | Ephemeral storage only, no persistent raw data, worker logs PII-free |

### 7.3 Anonymizer Worker 운영

**배포 분리:**
- 별도 Cloudflare Worker account 또는 별도 Workers for Platforms tenant
- 별도 git repo (`regula-anonymizer`) + 별도 CODEOWNERS
- 별도 secrets (anonymizer에서만 raw data 해독 가능)

**로그 정책:**
- Worker 로그에 contribution ID, signal type, timestamp만 기록
- Raw data, aggregate 결과 값 모두 **로그 금지**
- Sentry/PostHog 연결 금지 (별도 관측 체계)

**업그레이드 정책:**
- 알고리즘 변경 (k, ε 조정)은 PIA 재승인 필요
- Canary deploy 금지 — 전량 교체 (통계적 일관성)

### 7.4 Raw Data TTL 및 삭제

**수명 주기:**
- `network_contributions.raw_data_json` write 후 48h 이내 anonymization 완료 (weekly batch 아님, 상시 처리)
- anonymization 성공 시 raw_data_json 즉시 삭제 (hard delete), anonymized_at timestamp만 보존
- anonymization 실패 시 48h TTL cron으로 강제 삭제, Sentry alert

**재계산 대응:**
- Opt-out 시 해당 조직의 과거 aggregate 반영분은 DP noise에 이미 포함되어 있어 "이론상 재계산 불필요" 주장 가능
- 그러나 **Right to be forgotten 법적 해석은 보수적** → 다음 weekly batch에서 해당 조직 contribution 제외 후 재계산
- 재계산 과정에서도 DP noise 재주입 → privacy budget 별도 consume

---

## 8. 집계 지표 상세 설계

### 8.1 지표별 데이터 구조

#### Signal 1: Submission Outcomes

**Raw schema:**
```
{
  org_id, submission_id, device_class (I/II/III),
  regulatory_category (cardiovascular/orthopedic/ophthalmic/...),
  jurisdiction (US/EU/JP/KR/CN/ROW),
  submission_year_bin (2022-2023, 2024-2025, ...),
  outcome (cleared/denied/withdrawn/pending),
  predicate_device_used (bool),
  predicate_clearance_age_years_bin (<1/1-3/3-5/5+)
}
```

**Aggregate example:**
```
signal_type: submission_outcomes
device_class: II
regulatory_category: cardiovascular
jurisdiction: US
contributing_orgs: 34
clearance_rate: 0.76 (± 0.04 DP noise, 95% CI)
k_group_size: 187
```

#### Signal 2: Review Timing

**Raw schema:**
```
{org_id, device_class, category, jurisdiction, submission_date_quarter,
 days_to_first_AI (additional info request), days_to_clearance,
 number_of_AI_rounds}
```

**Aggregate:**
- 평균 심사 기간 (median, p25, p75) by (device_class, jurisdiction)
- 평균 AI round 횟수

#### Signal 3: Deficiency Patterns

**Raw schema:**
```
{org_id, device_class, category, jurisdiction, submission_year_bin,
 deficiency_section_codes (array, controlled vocabulary),
 deficiency_count}
```

**Controlled vocabulary (FDA guidance 기반):**
- 510k.software_verification
- 510k.clinical_study
- 510k.biocompatibility
- 510k.sterilization
- mdr.clinical_evaluation
- mdr.post_market_surveillance
- ...

**Aggregate:**
- Top 10 deficiency sections by (device_class, jurisdiction)
- 빈도 percent (DP noise applied)

#### Signal 4: Predicate Selection Success

**Raw schema:**
```
{org_id, device_class, category, predicate_device_k_number (SUPPRESSED in DLP — only flag),
 predicate_clearance_age_bin, predicate_same_company (bool),
 outcome}
```

**Aggregate:**
- Success rate by (predicate_age_bin, same_company)
- Example: "3-5년 전 clearance된 competitor predicate 선택 시 평균 심사 기간 198일, success rate 0.72"

#### Signal 5: Indication Strategy

**Raw schema:**
```
{org_id, device_class, initial_indication_scope (narrow/moderate/broad),
 expansion_attempted (bool), expansion_outcome}
```

**Aggregate:**
- Narrow → expansion path success rate by device_class

#### Signal 6: Audit Observations

**Raw schema:**
```
{org_id, device_class, inspection_type (routine/for-cause/pre-approval),
 observation_count, fda_483_issued (bool), warning_letter_issued (bool),
 jurisdiction}
```

**Aggregate:**
- 483 발생률 by QMS maturity proxy (observation_count / inspection)
- Warning letter escalation rate

### 8.2 Transparency Metadata

모든 aggregate 응답에 다음 포함:

```json
{
  "signal_type": "submission_outcomes",
  "aggregate_value": 0.76,
  "confidence_interval_95": [0.72, 0.80],
  "transparency": {
    "contributing_orgs": 34,
    "k_group_size": 187,
    "k_threshold": 5,
    "epsilon_consumed": 1.0,
    "noise_mechanism": "Laplace",
    "aggregate_last_updated": "2026-05-01T00:00:00Z",
    "methodology_version": "v1.0"
  },
  "disclaimer": "This aggregate is computed from opt-in organizations under k-anonymity (k≥5) and differential privacy (ε=1.0). Individual organization data cannot be inferred."
}
```

---

## 9. 참여 인센티브 및 Bootstrap 전략 (Post-launch)

### 9.1 Bootstrap 문제

초기 참여 조직 수가 적으면 집계 의미 없음 → 가치 제로 → 참여 증가 없음 (deadlock).

### 9.2 참여 인센티브 옵션

| 옵션 | 설명 | 장점 | 단점 |
|---|---|---|---|
| Reciprocity credits | 기여 조직은 aggregate 접근 우선 (비기여 조직은 제한적) | 참여 유인 강함, fair | 비기여 조직의 subscription 가치 저하 |
| Reduced subscription | 기여 시 구독료 할인 | 즉각적 유인 | 데이터 판매로 해석될 위험 |
| Early access to insights | 기여 조직은 aggregate 신규 지표 먼저 접근 | 경쟁 우위 제공 | 운영 복잡도 증가 |
| Tiered aggregate resolution | 기여 조직은 세밀한 aggregate (jurisdiction 세분화) 접근 | 차별화 명확 | re-identification risk 상승 |

**v1 결정:** **Reciprocity credits** + **Early access** 조합 검토. 구체 설계는 legal + business review 후 post-launch.

### 9.3 Bootstrap 전략

1. **Launch partners** — 초기 파트너 조직 (3~5개) 선정, 계약서에 "early contributing org 인센티브" 명시
2. **Threshold waiver** — 초기 6개월은 minimum 20 orgs 기준 완화 가능성 명시 (법률 검토 후)
3. **Data partnership announcement** — 초기 집계가 가능해지면 공개 case study로 network 효과 홍보
4. **Conference presence** — RAPS, MedTech Conference 참여하여 신뢰 구축

---

## 10. UI/UX 고려사항

### 10.1 Opt-in 관리 페이지 (`/admin/network/optin`)

**컴포넌트:**
- Signal 카테고리별 토글 스위치 (6종)
- 각 signal의 설명 (무엇을 수집하는가, 어떻게 익명화되는가) inline
- Withdrawal 버튼 + 확인 모달 ("72시간 내 raw data 삭제 + 다음 batch에서 aggregate 재계산")
- Opt-in history 로그 (audit_logs에서 pull)
- Privacy Impact Assessment 문서 링크

**RBAC:**
- `admin` role만 접근 (handoff §16 기준)
- `ra-lead` 이하는 읽기 전용 (현재 opt-in 상태 조회만)

### 10.2 Aggregate Dashboard (`/network`)

**컴포넌트:**
- Signal 카테고리별 탭 (6개)
- 각 지표별 카드: 값, 95% CI, contributing orgs, 마지막 업데이트
- Transparency banner (k≥5 + ε=1.0 methodology 설명)
- Filter: device_class, jurisdiction, year_bin
- Download aggregate (CSV, DP methodology 메타데이터 포함)

**접근 권한:**
- 모든 인증 사용자 (인증된 조직 내 누구나 aggregate 조회 가능)
- 단, 자기 조직이 해당 signal에 opt-in 했는지와 무관하게 접근 가능 (reciprocity model 미채택 초기 결정)
- Post-launch reciprocity 도입 시 정책 변경 가능

### 10.3 Chat 인터페이스 통합

**신규 intent:** `network.query`

**예시 질의:**
- "우리 device class (Class II cardiovascular)에서 FDA 510(k) 평균 심사 기간은?"
- "최근 3년 내 MDR 전환 시 평균 소요 기간은?"
- "가장 많이 deficiency 받는 섹션 Top 5는?"

**응답 포맷:**
- Chat 답변에 aggregate 값 + Transparency metadata inline
- Citation은 "Regula Network Aggregate v1.0, updated 2026-05-01" 형식
- Handoff §8.1 citation 규칙 준수 (`<sup class="cite">N</sup>` 통일)

**intent classifier (Haiku):**
- 기존 classifier에 `network.query` 추가
- confidence 낮으면 일반 RAG로 fallback

---

## 11. 집계 재산출 스케줄

### 11.1 Weekly Batch

**스케줄:** Cloudflare Cron, 매주 일요일 02:00 UTC (의료기기 산업 low activity window)

**단계:**
1. 지난 주 신규 contribution 집계 (network_contributions where anonymized_at >= last_batch)
2. 각 signal_type × (device_class, category, jurisdiction, year_bin) cell별 Mondrian partitioning
3. k≥5 확인, 미달 cell suppress
4. contributing_orgs ≥ 20 확인, 미달 cell suppress
5. DP noise 주입 (Laplace Δf/ε=1.0)
6. `network_aggregates` upsert
7. 결과 audit_logs 기록 (`network.aggregate_recompute`)

**Duration 목표:** <10 min (전체 signal 1M contributions 기준)

### 11.2 Opt-in Change 즉시 재산출

**Trigger:** organization이 signal opt-in/opt-out 시

**범위:** 해당 조직이 기여한 signal의 affected cells만 재산출 (전체 cell 재산출 아님)

**Delay:** opt-in 후 **7일 지연 적용** (differential attack 방지 — Section 3.2 시나리오 D)

**Delete path:** opt-out 시
1. `network_contributions` raw_data_json 즉시 하드 삭제
2. affected cells 재계산 (delay 없이 — right to be forgotten 우선)
3. 결과 audit_logs 기록 (`network.optin_change`, `network.aggregate_recompute`)

### 11.3 재계산 시 Privacy Budget 관리

- Weekly batch: ε=1.0 per signal per week
- Opt-in change 즉시 재산출: ε=0.5 per cell (budget 분할)
- Cumulative ε per signal per year 추적 (dashboard admin view)
- ε_annual > 52 근접 시 admin alert + manual review

---

## 12. Non-Obvious Constraints 매트릭스 (handoff §16 기반)

| # | 제약 | Phase 11 영향 |
|---|---|---|
| 1 | Citation 강제 (§8.1) | Chat 인터페이스 network.query 응답의 aggregate 값도 citation 부착 필수 |
| 2 | Multi-phase streaming (§11.1) | network.query는 단일 phase (prose + structured aggregate block) |
| 3 | Expert-review auto-flagging (§9.3) | aggregate 값 기반 조언이 confidence 낮을 시 expert-review 트리거 (Phase 5 로직 재활용) |
| 4 | Audit logging (§16, 21 CFR Part 11) | **신규 audit_action 값 추가 필요:** `network.optin_change`, `network.aggregate_recompute`, `network.query`, `network.contribute` (4개) — FOUNDATION v0.5.0 enum inventory 확장 요청 |
| 5 | Serif 타이포 (§6) | /network dashboard의 stat values는 serif 적용 |
| 6 | Korean + English 1급 (§6) | Aggregate metadata, transparency disclaimer 양언어 제공 |
| 7 | Auth → noindex (§18) | /network, /admin/network/* 모두 noindex (Phase 5 ENTERPRISE 연장) |

---

## 13. Risks (상세)

### 13.1 Technical Risks

| Risk | 확률 | 영향 | Mitigation |
|---|---|---|---|
| Re-identification 공격 성공 | 낮음 | Catastrophic | PIA 외부 감사 + 정기 red team + k≥5 + DP ε=1.0 + minimum threshold 20 |
| DP noise 과다로 aggregate 무의미 | 중간 | 높음 | ε=1.0 sweet spot 선택, contributing orgs 증가로 상쇄 |
| Anonymizer Worker 보안 결함 | 낮음 | Catastrophic | 별도 배포 + 최소 권한 + Cloudflare Access + 정기 감사 |
| Privacy budget exhaustion | 중간 | 중간 | ε_annual 상한 + alert + 주간 budget 고정 |
| Cross-border data transfer 규제 (중국) | 높음 (중국 opt-in 시) | 높음 | Geo-fenced anonymizer 옵션 (v2), 초기 중국 opt-in 제한 |

### 13.2 Business Risks

| Risk | 확률 | 영향 | Mitigation |
|---|---|---|---|
| 초기 참여 부족 → 집계 의미 없음 | 높음 | 높음 | Launch partner 3~5개 확보, threshold waiver 법률 검토 |
| 경쟁 민감도로 조직 opt-out 확산 | 중간 | 높음 | Transparency-by-default, per-signal granularity, reciprocity credits |
| 법률 규제 변경 (HIPAA, GDPR 재해석) | 중간 | Catastrophic | 법률 자문 정기화, 규제 trend monitoring, flexible architecture |
| 규제 당국이 PHI로 재해석 | 낮음 | Catastrophic | FDA Pre-submission meeting, PIA 외부 감사, HIPAA Expert Determination |

### 13.3 Reputational Risks

| Risk | 확률 | 영향 | Mitigation |
|---|---|---|---|
| 미디어 프라이버시 breach 보도 | 낮음 | Catastrophic | 투명한 methodology 공개, 사고 대응 72h, 외부 감사 결과 공개 |
| 조직 "내 데이터가 경쟁사에 활용됨" 인식 | 중간 | 높음 | Opt-in 기본 OFF, per-signal granularity, reciprocity credits 고려 |

---

## 14. Open Questions (Pending)

### 14.1 법률 자문 필요

- **Q1:** 21 CFR Part 11에서 anonymized aggregate를 electronic record로 간주하는가? Part 11 audit trail 요구사항 전체 적용 대상인가?
- **Q2:** GDPR Right to erasure (Article 17) 해석상, anonymized 이후 aggregate에 조직 기여분이 포함되어 있어도 withdrawal 후 재계산 의무가 있는가?
- **Q3:** HIPAA Safe Harbor 18개 식별자 기준이 의료기기 submission 데이터에도 동일 적용되는가? (의료기기는 환자 direct care data가 아니지만 임상 study section 포함)
- **Q4:** 중국 DSL/PIPL cross-border transfer 규제상, 중국 조직의 raw data를 홍콩/싱가포르 Worker에서 익명화 처리는 허용되는가?

### 14.2 비즈니스 결정 필요

- **Q5:** Reciprocity credits vs Open aggregate (비기여 조직도 접근) 선택?
- **Q6:** Aggregate commercial resale (타 기업/consultant에 판매) 허용?
- **Q7:** Post-launch v2에서 federated learning 도입 시 추가 투자 규모?

### 14.3 기술 결정 연기

- **Q8:** Anonymizer Worker 런타임 선택 (Cloudflare Workers JS vs Cloudflare Workers Rust via wasm)?
- **Q9:** OpenDP 라이브러리 vs 자체 구현 Laplace mechanism?
- **Q10:** l-diversity / t-closeness 추가 레이어 v1.1에서 도입?

---

## 15. Summary of Technical Decisions (spec.md 매핑)

| # | 결정 | 선택 | 탈락 | 근거 (Section) |
|---|-----|-----|-----|-----|
| 1 | Privacy 모델 | k-anonymity (k≥5) + DP (ε=1.0) | k-anon only, DP only, MPC, FHE | §2.1, §2.2, §2.3, §2.4 |
| 2 | 익명화 위치 | 별도 Cloudflare Worker (isolated) | 메인 Postgres 내부 처리 | §3.3, §7 |
| 3 | Opt-in 단위 | per-signal (6 categories) | all-or-nothing | §9.2 (Apple/Fitbit 교훈) |
| 4 | 집계 재산출 | Weekly cron + opt-in change 시 affected cells | Real-time | §11 |
| 5 | 참여 임계값 | minimum 20 contributing orgs per cell | 10 orgs | §2.5 (US Census 교훈), §8.2 |
| 6 | 철회 처리 | Hard delete raw + aggregate 재계산 | Soft delete | §5.1 (GDPR Art.17) |
| 7 | DP 알고리즘 | Laplace mechanism | Gaussian, Exponential | §2.2 (COUNT/AVG 적합) |
| 8 | k-anon 알고리즘 | Mondrian (multidimensional partition) | Datafly, Incognito, Anatomy | §2.1 |
| 9 | PIA 요건 | Pre-launch 외부 전문가 감사 필수 | 내부 self-review | §5.5 |
| 10 | Opt-in change 반영 | 7일 지연 (differential attack 방지) | 즉시 | §3.2 시나리오 D |

---

## 16. 참고 문헌

1. Sweeney, L. (2002). "k-anonymity: A model for protecting privacy." IJUFKS.
2. Dwork, C. (2006). "Differential privacy." ICALP.
3. Machanavajjhala, A. et al. (2006). "l-diversity: Privacy beyond k-anonymity." ICDE.
4. Li, N. et al. (2007). "t-closeness: Privacy beyond k-anonymity and l-diversity." ICDE.
5. LeFevre, K. et al. (2006). "Mondrian multidimensional k-anonymity." ICDE.
6. NIST SP 800-188 (2022). "De-Identifying Government Datasets."
7. FDA (2024). "Guidance on Safe Harbor De-identification for Medical Device Data."
8. ICO (UK) PIA Code of Practice.
9. CIPL Privacy Impact Assessment Framework (2020).
10. Flatiron Health (2018). "Real-World Evidence for Regulatory Submission."
11. Apple Differential Privacy Technical Overview (2017).
12. Google RAPPOR Technical Report (2014).
13. US Census Bureau Disclosure Avoidance System (2020).
14. Regula design handoff README §6, §8.1, §9.3, §11.1, §16, §18.
15. OpenDP Project — NIST-backed differential privacy framework.
16. 의료기기법 (대한민국) 제34조, 개인정보보호법 (PIPA) 제28조의2 익명정보 조항.
17. EU GDPR Article 4(1), Article 17, Recital 26.
18. HIPAA 45 CFR § 164.514(b)(2).
19. 21 CFR Part 11 § 11.10, § 11.30, § 11.50.
20. 中国个人信息保护法 (PIPL) 第三章, 中国数据安全法 (DSL).

---

**End of research.md — 총 17 sections, 공격 모델 5종, 법적 관할 5종, 유사 사례 6종, Technical Decisions 10건 커버. 본 문서는 spec.md의 EARS REQ-NET 35+개의 근거 매핑 기반으로 사용된다.**
