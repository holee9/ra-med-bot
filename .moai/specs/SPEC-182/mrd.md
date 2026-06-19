# MRD: RA Lead 실사용자 관점 E2E 검증 체계

> Issue #182 — P0 Validation
> 작성일: 2026-06-19
> 작성자: MoAI

---

## 1. Executive Summary

### 목적
Regula의 주 사용자인 RA Lead(1~2명) 관점에서 실제 업무 흐름을 검증하고, 법적으로 방어 가능한 형태로 규제 문서를 더 빠르게 생성할 수 있는지 확인한다.

### 문제 정의
- P0 작업들(#161, #149, #150, #151)이 기술적으로 완료되었으나, **RA Lead 실사용자 관점 검증이 전혀 수행되지 않음**
- 기술적 완료: 100% vs RA Lead 관점 검증: 0%
- 괴리도: 80% 이상 설계된 기능이 실사용자 기준으로 검증되지 않음

### 검증 범위
- 대상 페르소나: RA Lead (1순위 사용자)
- 핵심 시나리오: 일일 작업 흐름 기반 E2E 여정
- 평가 기준: 법적 방어 가능성, 작업 시간 단축, 제출 품질 향상

---

## 2. RA Lead 페르소나 정의

### 2.1 기본 프로필

| 속성 | 설명 |
|------|------|
| **역할** | RA (Regulatory Affairs) Lead / 규제 담당자 |
| **인원 수** | 조직 내 1~2명 (실질 파워유저) |
| **업무 경력** | 5년+ 규제 준비 경험, FDA/EU MDR 제출 경험 다수 |
| **기술 숙련도** | 중간: 일반 문서 작업 가능, 규제 전문 도구 익숙 |
| **주요 업무** | CER 작성, Predicate 분석, PCCP 준비, 규제 변동 모니터링 |

### 2.2 업무 배경

**일일 작업 패턴**:
1. 오전: 신규 규제 업데이트 확인 (FDA guidance, EU MDR amendment)
2. 오전: CER PubMed 수집 + SIGN 50 평가 (40-80시간 → 목표 10-15시간)
3. 오후: Predicate 비교 분석 (수 시간 → 목표 수십 분)
4. 오후: PCCP 초안 작성 (수동 가이던스 참조 → 목표 4단계 위저드)
5. 수시: 규제 변동 모니터링 (수동 확인 → 목표 자동 알림)

**법적 책임**:
- 모든 제출 문서의 법적 책임자
- Expert Review Gate 최종 승인자
- FDA/EU MDR 재현성 요건 충족 책임

---

## 3. 핵심 시나리오 분석

### 3.1 Scenario 1: CER 작성 흐름

**현재 방식 (기존)**:
1. PubMed에서 관련 문서 수동 검색 (2-4시간)
2. SIGN 50 필터링 수동 적용 (1-2시간)
3. 관련성 평가 및 인용 정리 (20-40시간)
4. 근거 부족 문제로 재수집 (반복)

**Regula 방식 (목표)**:
1. RAG 쿼리로 관련 문서 즉시 검색 (5-10분)
2. 시스템 자동 SIGN 50 필터링 (자동)
3. 인용 기반 요약 및 근거 추적 (5-10시간)
4. Expert Review Gate로 법적 책임 명확화

**RA Lead 관점 성공 기준**:
- [ ] 검색 결과의 관련성: 90%+ (수동 40-80시간 vs 자동 10-15시간)
- [ ] 인용 근거 추적: 100% (모든 주장에 인용 부착)
- [ ] 법적 방어 가능성: NB/FDA 재현성 요건 충족

### 3.2 Scenario 2: Predicate 비교 분석

**현재 방식**:
- 수시간 수동 비교
- Excel로 추적 관리
- 버전 관리 어려움

**Regula 방식**:
- 수십 분 자동 비교
- 시스템 버전 관리
- 인용 기반 diff 표시

**RA Lead 관점 성공 기준**:
- [ ] 비교 시간 단축: 80%+ (수 시간 → 수십 분)
- [ ] 추적 가능성: 100% (모든 변경 이력 기록)
- [ ] 법적 요건 충족: Article 61(4) disclaimer 강제

### 3.3 Scenario 3: PCCP 초안 작성

**현재 방식**:
- 수동 가이던스 참조
- 4단계 프로세스 혼란
- 누락 섹션 위험

**Regula 방식**:
- 4단계 위저드 가이드
- 필수 섹션 자동 체크
- Draft watermark 강제

**RA Lead 관점 성공 기준**:
- [ ] 작성 시간 단축: 60%+
- [ ] 필수 섹션 누락: 0건 (시스템 강제)
- [ ] 미승인 제출 방지: Draft watermark 필수

### 3.4 Scenario 4: 규제 변동 모니터링

**현재 방식**:
- 수동 확인 (주 1회)
- 누락 위험 높음

**Regula 방식**:
- 자동 알림 (실시간)
- 6개 corpus 자동 업데이트

**RA Lead 관점 성공 기준**:
- [ ] 누락률: 0% (자동 알림)
- [ ] 업데이트 지연: 24시간 이내

---

## 4. 페르소나별 Go/No-Go 기준

### 4.1 RA Lead (Primary)

**Go 기준 (모두 충족 필요)**:
1. **법적 방어 가능성**: 모든 주장에 인용 근거 부착, Expert Review Gate 통과
2. **작업 시간 단축**: 핵심 시나리오 4개에서 각각 60%+ 시간 단축
3. **제출 품질**: NB/FDA 재현성 요건 충족, 0건 미승인 제출

**No-Go 기준 (하나라도 해당 시)**:
1. Expert Review Gate 우회 가능성
2. 인용 없는 주장 export 경로 존재
3. Draft watermark 우회 경로 존재
4. 법적 disclaimer(Article 61(4)) 제거 가능성

### 4.2 Dev (Secondary)

**Go 기준**:
1. 읽기 권한: 규제 맥락 이해 보조
2. 코멘트 권한: 규제 문서에 코멘트 가능

**No-Go 기준**:
- Dev 역할이 RA Lead 핵심 워크플로우 방해

### 4.3 Exec (Secondary)

**Go 기준**:
1. 읽기 권한: 제출 진행상황 가시성
2. 요약 대시보드: 진행 현황 파악

**No-Go 기준**:
- Exec 역할이 RA Lead 핵심 워크플로우 방해

---

## 5. P0 작업별 RA Lead 관점 기준

### 5.1 #161 DB Drift 수정

**RA Lead 관점 기준**:
- [ ] standards/CER/classification/SaMD/DHF/eSubmit/PCCP/Digest/Vigilance API에서 500 error 발생하지 않음
- [ ] RA Lead가 이 기능들을 사용하여 일일 작업 완수 가능
- [ ] 데이터 무결성: audit_logs append-only 보장

**Go/No-Go**:
- ✅ 12개 테이블, 33개 enum 값 추가 완료 → DB 기반 기능 정상 작동 확인 필요
- ❌ API 500 error 발생 시 → No-Go

### 5.2 #149 CI Quality Gate

**RA Lead 관점 기준**:
- [ ] TypeScript 타입 체크 통과 → RA Lead UI에서 런타임 에러 없음
- [ ] 빌드 안정성: CI/CD 파이프라인 안정화

**Go/No-Go**:
- ✅ CI Quality Gate 통과 → RA Lead에게 안정적인 릴리즈 보장
- ❌ 타입 에러 존재 시 → No-Go

### 5.3 #150 RBAC 수정

**RA Lead 관점 기준**:
- [ ] 비멤버 접근 차단: RA Lead 작업 공간 보호
- [ ] 권한 경계 명확: admin/ra-lead/guest 역할별 기능 구분
- [ ] audit_logs 접근 권한: 제품 정책 명시 필요

**Go/No-Go**:
- ✅ 비멤버 차단 구현 완료 → RA Lead 데이터 보호
- ❌ 권한 누수 시 → No-Go

### 5.4 #151 PII Redaction

**RA Lead 관점 기준**:
- [ ] 3-layer redaction 구현 → PII 보호
- [ ] 법적 요건 충족: GDPR, HIPAA 등 개인정보 보호법 준수

**Go/No-Go**:
- ✅ 3-layer redaction 완료 → RA Lead가 안전하게 규제 문서 공유 가능
- ❌ PII 누출 가능성 → No-Go

---

## 6. 실사용자 E2E 검증 실행 계획

### 6.1 Phase 1: 기능별 검증 (Week 1)

**Day 1-2: DB 기반 기능 검증 (#161)**
- [ ] standards API: 12개 테이블 존재 확인, CRUD 작동
- [ ] CER/classification/SaMD/DHF/eSubmit/PCCP/Digest/Vigilance API 500 error 0건 확인
- [ ] SSE endpoint stream payload의 `error` event 검증

**Day 3: RBAC 검증 (#150)**
- [ ] admin/ra-lead/guest 권한 경계 E2E 테스트
- [ ] 비멤버 접근 차단 확인
- [ ] audit_logs 접근 권한 정책 확인

**Day 4: PII Redaction 검증 (#151)**
- [ ] 3-layer redaction E2E 테스트
- [ ] PII 포함 문서 export/redaction 동작 확인

**Day 5: CI Quality Gate 확인 (#149)**
- [ ] TypeScript 타입 체크 통과 확인
- [ ] 빌드 안정성 확인

### 6.2 Phase 2: RA Lead 핵심 여정 검증 (Week 2)

**Scenario 1: CER 작성 흐름 E2E (2일)**
- [ ] RA Lead 페르소나로 로그인
- [ ] RAG 쿼리로 관련 문서 검색
- [ ] SIGN 50 필터링 확인
- [ ] 인용 기반 요약 작성
- [ ] Expert Review Gate 통과
- [ ] export 시 법적 방어 가능성 확인 (인용 근거 100%)

**Scenario 2: Predicate 비교 분석 E2E (1일)**
- [ ] Predicate 비교 분석 실행
- [ ] 시간 단축 확인 (수 시간 → 수십 분)
- [ ] 버전 관리 확인

**Scenario 3: PCCP 초안 작성 E2E (1일)**
- [ ] 4단계 위저드 진행
- [ ] 필수 섹션 누락 확인 (0건)
- [ ] Draft watermark 확인

**Scenario 4: 규제 변동 모니터링 (1일)**
- [ ] 자동 알림 확인
- [ ] 6개 corpus 업데이트 확인

### 6.3 Phase 3: 최종 3회 반복 검증 (Week 3)

**목표**: 치명 실패 0, pass rate 95% 이상

**반복 1 (Day 1)**:
- [ ] Scenario 1-4 전체 실행
- [ ] 실패 케이스 기록

**반복 2 (Day 2)**:
- [ ] 실패 케이스 수정 후 재실행
- [ ] 안정화 확인

**반복 3 (Day 3)**:
- [ ] 최종 3회 반복 검증
- [ ] pass rate 95%+ 달성 확인

---

## 7. 성공 기준 (Success Criteria)

### 7.1 기술적 완료 (이미 충족)
- ✅ #161 DB Drift 수정: 12개 테이블, 33개 enum 값 추가
- ✅ #149 CI Quality Gate: TypeScript 타입 체크 통과
- ✅ #150 RBAC 수정: 비멤버 접근 차단 구현
- ✅ #151 PII Redaction: 3-layer redaction 구현

### 7.2 RA Lead 관점 완료 (검증 필요)

**Scenario별 성공 기준**:

| Scenario | 법적 방어 가능성 | 작업 시간 단축 | 제출 품질 |
|----------|------------------|----------------|----------|
| CER 작성 | 인용 근거 100% | 60%+ (40-80시간 → 10-15시간) | NB/FDA 재현성 요건 충족 |
| Predicate 비교 | Article 61(4) disclaimer | 80%+ (수 시간 → 수십 분) | 추적 가능성 100% |
| PCCP 작성 | Draft watermark 강제 | 60%+ | 필수 섹션 누락 0건 |
| 규제 모니터링 | 알림 정확성 100% | 24시간 이내 업데이트 | 누락률 0% |

**최종 Go/No-Go 기준**:
- [ ] 4개 Scenario 모두 Go 기준 충족
- [ ] Expert Review Gate 우회 경로 0건
- [ ] 인용 없는 주장 export 0건
- [ ] E2E 3회 반복 pass rate 95%+

---

## 8. 리스크 및 완화 계획

### 8.1 리스크 1: RA Lead 페르소나 불일치

**리스크**: 실제 RA Lead 업무 패턴과 MRD 페르소나 불일치

**완화 계획**:
- MRD 작성 후 실제 RA Lead(내부담당자) 리뷰 요청
- 피드백 반영하여 시나리오 수정

### 8.2 리스크 2: 법적 요건 미충족

**리스크**: Expert Review Gate, 인용 근거 등 법적 요건 미충족

**완화 계획**:
- 법무팀 자문 (가능 시)
- Article 61(4) disclaimer 필수 확인
- NB/FDA 재현성 요건 확인

### 8.3 리스크 3: E2E 테스트 환경 불안정

**리스크**: E2E 테스트 환경 불안정으로 검증 신뢰성 저하

**완화 계획**:
- 3회 반복 검증으로 안정화 확인
- 불안정 테스트 케이스 수정 또는 제외

---

## 9. 다음 단계 (Next Steps)

1. **MRD 승인**: RA Lead(내부담당자) 리뷰 및 승인
2. **E2E 테스트 케이스 작성**: MRD 시나리오 기반 테스트 작성
3. **Phase 1 실행**: 기능별 검증 (Week 1)
4. **Phase 2 실행**: RA Lead 핵심 여정 검증 (Week 2)
5. **Phase 3 실행**: 최종 3회 반복 검증 (Week 3)
6. **Go/No-Go 판정**: 최종 판정 후 P1 진행 여부 결정

---

## 10. 참고 문서

- 제품 헌장: `.moai/specs/CHARTER.md`
- Issue #182: `[P0][Validation] 실사용자 관점 E2E 검증 체계 수립`
- Issue #167: `[P0][Quality Recovery Plan] E2E 실증 기반 85%+ 완성도 회복 실행 계획`
- Lessons L-001, L-005

---

Version: 1.0.0
Status: Draft (RA Lead 리뷰 대기)
