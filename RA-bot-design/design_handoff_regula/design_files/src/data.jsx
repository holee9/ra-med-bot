// Seed data — realistic RA content for demo
const DATA = {
  projects: [
    { id: 'p1', title: 'RegenScan Pro — Class II', dot: '#2b4d8a', count: 34, tag: 'Active' },
    { id: 'p2', title: 'CardioMesh 510(k)', dot: '#d89400', count: 18, tag: 'Submission' },
    { id: 'p3', title: 'NeuroTrack EU MDR', dot: '#0f7a4d', count: 27, tag: 'Ongoing' },
    { id: 'p4', title: 'AeroSense — 신의료기술', dot: '#a8142b', count: 9, tag: 'Planning' },
  ],

  history: [
    { id: 'h1', q: 'IEC 60601-1-2:2020 4판 EMC 시험에서 Class II 의료기기 면제 조항?', project: 'RegenScan Pro', when: '2시간 전', citations: 6 },
    { id: 'h2', q: 'FDA 510(k) Substantial Equivalence를 위한 Predicate Device 선정 기준', project: 'CardioMesh', when: '오늘 오전', citations: 8 },
    { id: 'h3', q: 'EU MDR Annex XVI 제품의 Clinical Evaluation 요구사항', project: 'NeuroTrack', when: '어제', citations: 5 },
    { id: 'h4', q: 'MFDS 의료기기 GMP 심사 중 CAPA 운영 기록 요구사항', project: 'RegenScan Pro', when: '3일 전', citations: 4 },
    { id: 'h5', q: '중국 NMPA 등록 Class II 의료기기 Type Testing 한국 결과 활용 가능?', project: 'CardioMesh', when: '일주일 전', citations: 7 },
    { id: 'h6', q: 'ISO 14971:2019 위험관리 파일 구성 — 포함되어야 하는 산출물', project: '전역', when: '일주일 전', citations: 9 },
  ],

  templates: [
    { id: 't1', title: '510(k) Submission Checklist', desc: 'FDA 510(k) 제출 시 필수 검토 항목과 Predicate 비교표 템플릿', icon: 'file', tag: 'FDA · US', uses: 142 },
    { id: 't2', title: 'EU MDR Technical Documentation', desc: 'MDR Annex II/III 기준 Technical File 구성 가이드', icon: 'book', tag: 'CE · EU', uses: 87 },
    { id: 't3', title: '의료기기 기술문서 (KR)', desc: 'MFDS 의료기기법 시행규칙 별표2 양식', icon: 'doc', tag: 'MFDS · KR', uses: 203 },
    { id: 't4', title: 'Risk Management File (ISO 14971)', desc: 'Hazard analysis, FMEA, Benefit-Risk 일괄 생성', icon: 'shield', tag: 'ISO', uses: 165 },
    { id: 't5', title: 'Clinical Evaluation Report', desc: 'MEDDEV 2.7/1 rev.4 + MDR Article 61 기반 CER', icon: 'bar', tag: 'CE · EU', uses: 61 },
    { id: 't6', title: 'Design History File (DHF)', desc: '21 CFR 820.30 Design Controls 전체 산출물 구조', icon: 'layers', tag: 'FDA · US', uses: 94 },
  ],

  updates: [
    { date: '2026-04-18', title: 'FDA, AI/ML SaMD Predetermined Change Control 최종 지침 발행', region: 'US', severity: 'high' },
    { date: '2026-04-10', title: 'EU MDR 전환기간 제품군별 추가 연장 공고 (Class III 2028)', region: 'EU', severity: 'med' },
    { date: '2026-03-28', title: 'MFDS 의료기기 사이버보안 가이드라인 v3.0 개정', region: 'KR', severity: 'high' },
    { date: '2026-03-15', title: 'IEC 62304:2006/Amd2:2024 소프트웨어 수명주기 개정', region: 'ISO', severity: 'med' },
  ],

  // Sample answer — demonstrates the system's capability
  sampleAnswer: {
    question: 'Class II 의료기기의 EU MDR 기술문서 작성 시, Clinical Evaluation Report와 Post-Market Surveillance Plan이 어떻게 연계되어야 하나요?',
    confidence: 'high',
    confidenceScore: 92,
    sources: 8,
    duration: '12.4s',

    trace: [
      { step: 'Retrieving EU MDR Article 61 & 83-86', status: 'done' },
      { step: 'Cross-referencing MEDDEV 2.7/1 rev.4 and MDCG 2020-7', status: 'done' },
      { step: 'Scanning internal SOP: PMS-SOP-003 v2.1', status: 'done' },
      { step: 'Building causal chain between CER → PMS Plan → PSUR', status: 'done' },
    ],

    summary: `EU MDR 하에서 <b>Clinical Evaluation Report (CER)</b>와 <b>Post-Market Surveillance (PMS) Plan</b>은 단일한 제품 안전성 피드백 루프의 두 축으로 작동합니다<sup class="cite" data-src="1">1</sup>. CER이 출시 전 임상 근거를 확립한다면, PMS Plan은 이를 출시 후 지속 확인하는 프로세스를 정의하며, 두 문서는 <b>상호 인용 관계</b>여야 합니다<sup class="cite" data-src="2">2</sup>.

핵심 연계 지점은 세 가지입니다. 첫째, CER에서 식별된 <b>residual risk와 open clinical question</b>이 PMS Plan의 specific objectives로 그대로 이관되어야 합니다<sup class="cite" data-src="3">3</sup>. 둘째, PMS를 통해 수집된 실사용 데이터(Real-World Evidence)는 정기적으로 CER로 피드백되어 <b>최소 연 1회 업데이트</b>가 원칙입니다 (Class IIb/III는 PSUR과 연계)<sup class="cite" data-src="4">4</sup>. 셋째, Periodic Safety Update Report(PSUR)는 CER과 PMS 데이터의 통합 요약이므로 <em>세 문서 간 일관성</em>이 감사의 주요 관심사입니다<sup class="cite" data-src="5">5</sup>.`,

    checklist: [
      { id: 'c1', title: 'CER의 Clinical Evaluation Plan에 PMS 데이터 수집 방법 명시', ref: 'MDR Art. 61(3)', done: true },
      { id: 'c2', title: 'PMS Plan이 CER의 residual risks를 specific objectives로 참조', ref: 'MDR Annex III §1.1(a)', done: true },
      { id: 'c3', title: 'PMS 데이터의 CER 업데이트 주기 정의 (최소 연 1회)', ref: 'MDCG 2020-7 §3.2', done: false },
      { id: 'c4', title: 'PSUR 템플릿에 CER 업데이트 트리거 조건 통합', ref: 'MDR Art. 86', done: false },
      { id: 'c5', title: 'Notified Body 감사 대비 세 문서 간 cross-reference 매트릭스 작성', ref: 'Internal SOP-PMS-003', done: false },
    ],

    comparison: {
      title: '주요 관할권별 CER-PMS 연계 요구사항',
      cols: ['항목', 'EU MDR', 'US FDA', 'MFDS (KR)'],
      rows: [
        ['법적 근거', 'Regulation 2017/745 Art. 61, 83-86', '21 CFR 803, 806, 822', '의료기기법 제31조, 추적관리'],
        ['CER 업데이트 주기', 'Class IIa 최소 2년 / IIb·III 연 1회', '별도 CER 개념 없음 (MDR 관리)', '재심사 주기 (5년)'],
        ['PMS 공식 문서', 'PMS Plan (필수) + PMCF', 'MDR + MedWatch 보고', '재심사 + 추적관리 보고서'],
        ['연계 요구도', '높음 — 단일 피드백 루프', '중간 — 문서 독립, 데이터 공유', '중간 — 시판 후 조사 결과 재심사 반영'],
      ],
    },

    timeline: [
      { date: '2026-05', title: 'CER 업데이트 초안', desc: '현재 PMS 데이터 통합' },
      { date: '2026-06', title: 'PMS Plan v2.0 검토', desc: 'residual risks 매핑 갱신', current: true },
      { date: '2026-08', title: 'PSUR 연례 보고', desc: 'Notified Body 제출' },
      { date: '2026-12', title: 'NB Surveillance Audit', desc: 'Cross-reference 점검' },
    ],

    sourceList: [
      { idx: 1, org: 'EU Commission', title: 'Regulation (EU) 2017/745 — Article 61 Clinical Evaluation', year: '2017', type: 'Regulation', url: '#' },
      { idx: 2, org: 'MDCG', title: 'MDCG 2020-7 — PMCF Plan Template Guidance', year: '2020', type: 'Guidance', url: '#' },
      { idx: 3, org: 'EU Commission', title: 'MDR Annex III — Technical Documentation on PMS', year: '2017', type: 'Regulation', url: '#' },
      { idx: 4, org: 'MEDDEV', title: 'MEDDEV 2.7/1 Revision 4 — Clinical Evaluation', year: '2016', type: 'Guidance', url: '#' },
      { idx: 5, org: 'Team-NB', title: 'Position Paper on CER-PMS-PSUR Integration', year: '2023', type: 'Industry', url: '#' },
      { idx: 6, org: '사내 SOP', title: 'PMS-SOP-003 — Post-Market Surveillance Procedure v2.1', year: '2024', type: 'Internal', url: '#' },
      { idx: 7, org: 'ISO', title: 'ISO 14971:2019 — Medical device risk management', year: '2019', type: 'Standard', url: '#' },
      { idx: 8, org: 'BSI Group', title: 'White Paper: Aligning CER, PMS and Risk Management', year: '2022', type: 'Industry', url: '#' },
    ],

    related: [
      'PMS Plan과 Risk Management File은 어떻게 연계되나요?',
      'Class IIb 제품의 PMCF 연구 설계 가이드',
      'PSUR 작성 시 CER에서 가져와야 할 필수 섹션',
      'MDR 전환기간 중 기존 CER의 gap analysis 방법',
    ],
  },

  dashboardStats: [
    { label: '이번 달 질의', val: '247', delta: '+18%', up: true },
    { label: '인용된 출처', val: '1,284', delta: '+124', up: true },
    { label: '활성 프로젝트', val: '12', delta: '+2', up: true },
    { label: '전문가 검토 요청', val: '8', delta: '-3', up: false },
  ],
};

window.DATA = DATA;
