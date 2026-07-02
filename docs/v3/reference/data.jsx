// Regula v3 — persona-split data.
// Two audiences: Employee (dev/PM/marketing) and RA (regulatory affairs).
// Shared coreDB: products, markets, guides. Persona-specific: myQuestions vs inbox.

const D3 = {
  // ── Identity ───────────────────────────────────────────────
  users: {
    employee: {
      id: 'u_yuna', name: 'Yuna Kim', initials: 'YK',
      dept: 'R&D · SW Team', title: 'Senior SW Engineer',
      org: 'NeuroSense Korea',
    },
    ra: {
      id: 'u_seojin', name: 'Seojin Park', initials: 'SP',
      dept: 'RA', title: 'RA Lead',
      org: 'NeuroSense Korea',
      teamSize: 3,
    },
    admin: {
      id: 'u_jaehyun', name: 'Jaehyun Yoon', initials: 'JY',
      dept: 'IT · Platform', title: 'Platform Admin',
      org: 'NeuroSense Korea',
    },
  },

  // ── Products (shared, viewed differently per persona) ─────
  // 사내 실 제품 (ra-project/02_제품별_기술파일 · ra-llm-wiki 인제스트 파이프라인)
  products: [
    {
      id: 'xray-det', name: 'X-ray Detector', family: 'Digital Radiography',
      class: { us: 'II · MQB', eu: 'IIa', kr: '2' },
      owner: 'R&D HW · Jihun Han',
      source: 'ra-llm-wiki/기술파일/01_Xray_Detector/DHF-v2.3.pdf',
      subType: 'a-Si / a-Se / CMOS · Solid State X-ray Imager',
      standards: ['IEC 60601-1 Ed 3.2', 'IEC 60601-1-2:2014+A1:2020', 'IEC 60601-1-3:2021', 'IEC 62220-1-1:2015 (DQE)', 'IEC 62304', 'IEC 62366-1', 'IEC 81001-5-1:2021'],
      predicate: 'FDA MQB 코드 (Solid State X-Ray Imager) · Guidance for 510(k) Submissions',
      markets: [
        { code: 'us', name: 'US · FDA',   status: 'approved',  path: '510(k) K242017 · Product Code MQB', since: '2024-08', next: 'Annual Report · 2027-08' },
        { code: 'eu', name: 'EU · MDR',   status: 'in-review', path: 'CE MDR · Annex VIII Rule 10 후단 · TR 심사', since: '—', next: 'NB decision · 2026-Q4' },
        { code: 'kr', name: 'KR · MFDS',  status: 'approved',  path: '제조허가 제25-345호 · 2등급', since: '2025-03', next: '재심사 · 2030-03' },
        { code: 'jp', name: 'JP · PMDA',  status: 'planning',  path: 'Class II · Todokede 예정',   since: '—', next: 'RCB 인증 vs PMDA 承認 판단' },
      ],
      changes14d: 2,
    },
    {
      id: 'xray-src', name: 'Handheld X-ray Source', family: 'Radiography · Portable',
      class: { us: 'II · IZL/EAF', eu: 'IIb', kr: '2-3' },
      owner: 'R&D HW · Jihun Han',
      source: 'ra-llm-wiki/기술파일/02_Handheld_Xray_Source/DHF-v1.7.pdf',
      subType: 'Handheld · 배터리 · 관전압/관전류 프로그램형',
      standards: ['IEC 60601-1 Ed 3.2', 'IEC 60601-1-2', 'IEC 60601-1-3:2021', 'IEC 60601-2-28:2017', 'IEC 60601-2-54:2022', 'IEC 62133-2 (배터리)', 'IEC 62366-1', '21 CFR 1020.30~1020.33'],
      predicate: 'FDA IZL/EAF Product Code · Radiation Emitting Product',
      markets: [
        { code: 'us', name: 'US · FDA',  status: 'in-review', path: '510(k) 제출 · 2026-05 · Form FDA 2579·2877 필요', since: '—', next: 'AI hold · 2026-07-15' },
        { code: 'eu', name: 'EU · MDR',  status: 'approved',  path: 'CE 0086 · Class IIb · NB 전수 심사',    since: '2023-11', next: 'Surveillance audit · 2026-09' },
        { code: 'kr', name: 'KR · MFDS', status: 'approved',  path: '제조허가 · 2등급 · 방사선안전관리 규칙 2025-07-18 개정 대응', since: '2023-06', next: '변경허가 심사 중' },
        { code: 'cn', name: 'CN · NMPA', status: 'planning',  path: 'NMPA · GB 9706.1-2020 강화 조항 · CMDE 지정 검사 예정', since: '—', next: '재시험 대기 · 2027-02' },
      ],
      changes14d: 5,
    },
    {
      id: 'gui-sw', name: '촬영실 GUI SW', family: 'Medical Software · SaMD',
      class: { us: 'II · LLZ/QIH', eu: 'IIa~IIb', kr: '2-3' },
      owner: 'R&D SW · Yuna Kim',
      source: 'ra-llm-wiki/기술파일/03_촬영실_GUI_SW/DHF-v3.1.pdf',
      subType: '독립형 SaMD · DICOM/HL7 · AI/ML 진단보조 옵션',
      standards: ['IEC 62304:2006/A1:2015 (Class B)', 'IEC 82304-1:2016', 'IEC 62366-1', 'IEC 81001-5-1:2021 (Cybersecurity)', 'ISO 14971:2019', 'MDCG 2019-11 Rev.1', 'FDA PCCP 2024-12 (AI/ML)'],
      predicate: 'FDA LLZ (Medical Image Management) · QIH (CADe) · FD&C §524B Cyber Device',
      markets: [
        { code: 'us', name: 'US · FDA',  status: 'in-review', path: '510(k) · Cyber Device · SBOM 제출 완료',   since: '—', next: 'AI Sub-review · 2026-08' },
        { code: 'eu', name: 'EU · MDR',  status: 'planning',  path: 'Rule 11 · Class IIa 예상 · MDCG 2019-11 Rev.1 (2025-06) 반영', since: '—', next: 'NB 지정 대기' },
        { code: 'kr', name: 'KR · MFDS', status: 'approved',  path: '제조허가 · 디지털의료제품법(2025-01-24) 적용 · CMP 등록', since: '2025-05', next: 'CMP 재평가 · 2026-11' },
      ],
      changes14d: 3,
    },
  ],

  marketStatus: {
    'approved':  { lbl: '승인 완료 · Approved',      color: 'success' },
    'in-review': { lbl: '심사 중 · Under Review',    color: 'review'  },
    'pending':   { lbl: '제출 대기 · Pending',       color: 'review'  },
    'planning':  { lbl: '계획 · Planning',           color: 'draft'   },
    'blocked':   { lbl: '차단 · Blocked',            color: 'blocked' },
    'expired':   { lbl: '만료 임박 · Expiring',      color: 'blocked' },
  },

  // ══════════════════════════════════════════════════════════════
  // Employee persona data
  // ══════════════════════════════════════════════════════════════

  // 내 질의 (Employee view)
  myQuestions: [
    {
      id: 'Q-3401', at: '2026-06-30 15:22', q: 'EEG 헤드셋에 BLE 5.3 SoC로 교체하면 재인허가 필요한가요?',
      product: '촬영실 GUI SW', market: 'US · EU',
      state: 'ra-review', // auto | ra-review | escalated | answered | waiting
      sla: { target: '2026-07-02 15:22', remaining: '32h', ok: true },
      autoConfidence: 62,
      raAssignee: null,
      answer: null,
    },
    {
      id: 'Q-3399', at: '2026-06-28 11:03', q: 'IEC 62304 Class B SW에서 오픈소스 라이브러리(Apache-2.0) 사용 시 문서화?',
      product: '촬영실 GUI SW',
      state: 'answered',
      sla: { target: '2026-06-30 11:03', remaining: 'closed', ok: true },
      autoConfidence: 88,
      raAssignee: 'S. Park',
      answer: '오픈소스 라이브러리는 SOUP(Software of Unknown Provenance)로 분류 · IEC 62304 §5.3.3에 따라 anomaly list 관리, §7.1.2 위험 분석 필요. 승인된 답변집에 등록되어 있습니다.',
    },
    {
      id: 'Q-3395', at: '2026-06-25 09:40', q: '독일 시장 진출 시 IFU 언어를 영어만 제공해도 되나요?',
      product: '촬영실 GUI SW', market: 'EU · DE',
      state: 'answered', autoConfidence: 94,
      answer: '아니오. MDR Art. 10(11) + DE MPDG §8 — 최종 사용자(Lay/HCP)가 이해할 수 있는 언어. 독일은 독일어 필수.',
    },
    {
      id: 'Q-3392', at: '2026-06-24 17:12', q: 'AI 알고리즘 재학습 결과를 배포하려면 SW 변경관리?',
      product: '촬영실 GUI SW', market: 'US',
      state: 'escalated',
      sla: { target: '2026-06-27 17:12', remaining: '-3d', ok: false },
      autoConfidence: 41,
      raAssignee: 'S. Park',
      answer: null,
      note: '고위 검토 필요 — PCCP 적용 가능성 검토 중',
    },
    {
      id: 'Q-3388', at: '2026-06-23 10:00', q: '마케팅 자료에 "clinically proven"이라는 문구를 써도 되나요?',
      product: '촬영실 GUI SW', market: 'US · EU',
      state: 'waiting',
      sla: { target: '2026-06-24', remaining: 'user-input', ok: true },
      autoConfidence: 71,
      note: 'RA에서 근거 자료 요청: 어떤 임상데이터를 인용할 예정인지 답변해 주세요.',
    },
  ],

  // 사내 승인 답변집 (Guides)
  guides: [
    { id: 'g1', cat: 'Software',  q: 'IEC 62304 안전등급 결정',                                      updated: '2026-06', hits: 142 },
    { id: 'g2', cat: 'Software',  q: '오픈소스 라이브러리(SOUP) 문서화',                              updated: '2026-06', hits: 89  },
    { id: 'g3', cat: 'AI/ML',     q: 'PCCP (Predetermined Change Control Plan) 적용 조건',           updated: '2026-05', hits: 76  },
    { id: 'g4', cat: 'Labeling',  q: 'EU 언어 요구사항 (관할국별)',                                    updated: '2026-05', hits: 210 },
    { id: 'g5', cat: 'Labeling',  q: 'ISO 15223-1 필수 심볼 체크리스트',                              updated: '2026-04', hits: 135 },
    { id: 'g6', cat: 'Marketing', q: '허용 claim 용어 vs 금지 용어',                                  updated: '2026-06', hits: 168 },
    { id: 'g7', cat: 'Clinical',  q: 'CER 업데이트 트리거 조건',                                      updated: '2026-04', hits: 55  },
    { id: 'g8', cat: 'Registration', q: '해외 시장 진출 · 최소 문서 세트',                             updated: '2026-05', hits: 98  },
  ],

  // Change Impact Check 룰 (자가진단 위저드)
  changeTypes: [
    { id: 'sw',    lbl: 'Software / 알고리즘', ico: 'workflow' },
    { id: 'hw',    lbl: 'Hardware / 부품',    ico: 'shield'   },
    { id: 'label', lbl: 'Labeling / IFU',     ico: 'tag'      },
    { id: 'mfg',   lbl: 'Manufacturing / 공정', ico: 'refresh' },
    { id: 'use',   lbl: 'Intended Use / 적응증', ico: 'sparkle' },
    { id: 'mkt',   lbl: '새 시장 진출',         ico: 'globe'    },
  ],

  // ══════════════════════════════════════════════════════════════
  // RA persona data
  // ══════════════════════════════════════════════════════════════

  // Inbox (핵심) — 사내에서 들어온 질의 큐, 트리아지 4상태
  inbox: [
    {
      id: 'Q-3406', at: '2026-07-01 09:15', q: '수출용 라벨에 UDI-DI만 있으면 되나요, PI도 필요?',
      from: { name: 'Doyeon Ryu', dept: 'Regulatory Ops', avatar: 'DR' },
      product: 'X-ray Detector', market: 'EU',
      triage: 'auto',        // auto-answered (bot published, awaiting 24h grace)
      confidence: 91,
      slaTarget: '2026-07-01 13:15', slaRemaining: '3h', slaOk: true,
      draft: 'MDR Art. 27 · UDI Rule: EUDAMED 등록에는 UDI-DI + PI 모두 필요. 라벨 자체에는 상황별로 다름 — 다회용은 PI 없이 UDI-DI만도 허용.',
      tags: ['Labeling', 'UDI'],
    },
    {
      id: 'Q-3405', at: '2026-07-01 08:42', q: 'PMS 데이터를 CER 업데이트에 언제 반영해야 하나요?',
      from: { name: 'Mina Lee', dept: 'R&D HW', avatar: 'ML' },
      product: 'Handheld X-ray Source', market: 'EU',
      triage: 'auto', confidence: 87,
      slaTarget: '2026-07-01 12:42', slaRemaining: '2h', slaOk: true,
      draft: 'Class IIb는 최소 연 1회. PSUR과 동기화. MDR Art. 61(3) + MEDDEV 2.7/1 rev 4.',
      tags: ['CER', 'PMS'],
    },
    {
      id: 'Q-3404', at: '2026-06-30 16:20', q: 'AI 알고리즘 배포 자동화 파이프라인에 규제 요구사항이 있나요?',
      from: { name: 'Yuna Kim', dept: 'R&D SW', avatar: 'YK' },
      product: '촬영실 GUI SW', market: 'US · EU',
      triage: 'needs-review',  // bot drafted, RA must review before send
      confidence: 74,
      slaTarget: '2026-07-01 16:20', slaRemaining: '7h', slaOk: true,
      draft: '<b>초안 (신뢰도 74%)</b>: PCCP 적용 가능. FDA는 2026-04 최종 가이드 발행. EU는 MDR Art. 10(9) 갱신 중.\n\n검토 필요: 이 파이프라인이 <i>predetermined</i> 범위 안인지 case-by-case 판단이 필요합니다.',
      assignee: 'S. Park',
      tags: ['AI/ML', 'PCCP'],
    },
    {
      id: 'Q-3401', at: '2026-06-30 15:22', q: 'BLE 5.3 SoC 교체 시 재인허가?',
      from: { name: 'Yuna Kim', dept: 'R&D SW', avatar: 'YK' },
      product: '촬영실 GUI SW', market: 'US · EU',
      triage: 'needs-review', confidence: 62,
      slaTarget: '2026-07-02 15:22', slaRemaining: '32h', slaOk: true,
      draft: '<b>초안 (신뢰도 62%)</b>: 무선 스택 변경은 US 21 CFR 807.81 + EU MDR Art. 21 재검토 필요. 반드시 확인:\n· 이전 인증과 동일 profile인지\n· 방사 파워 범위 변경 여부\n· EMC 재시험 필요성',
      assignee: 'S. Park',
      tags: ['HW change', 'BLE', 'EMC'],
    },
    {
      id: 'Q-3392', at: '2026-06-24 17:12', q: 'AI 재학습 결과 배포 → SW 변경관리?',
      from: { name: 'Yuna Kim', dept: 'R&D SW', avatar: 'YK' },
      product: '촬영실 GUI SW', market: 'US',
      triage: 'escalated',  // RA lead assigned it upward or asked senior review
      confidence: 41,
      slaTarget: '2026-06-27 17:12', slaRemaining: '-3d', slaOk: false,
      draft: null,
      assignee: 'S. Park',
      escalatedTo: 'External counsel · Kim & Lee',
      note: 'PCCP 범위 판단 필요 — 외부 자문 요청됨',
      tags: ['AI/ML', 'PCCP', 'Overdue'],
    },
    {
      id: 'Q-3388', at: '2026-06-23 10:00', q: '"clinically proven" 문구 사용 가능?',
      from: { name: 'Yuna Kim', dept: 'R&D SW', avatar: 'YK' },
      product: '촬영실 GUI SW',
      triage: 'waiting',   // waiting for user clarification
      confidence: 71,
      slaTarget: '2026-06-24', slaRemaining: 'user-input', slaOk: true,
      draft: '요청자에게 질문 발송됨: 어떤 임상데이터를 인용할 예정인지.',
      assignee: 'S. Park',
      tags: ['Marketing', 'Claims'],
    },
    {
      id: 'Q-3403', at: '2026-06-30 13:10', q: '중국 NMPA 등록 시 한국 시험성적서 재사용?',
      from: { name: 'Jihun Han', dept: 'R&D HW', avatar: 'JH' },
      product: 'X-ray Detector', market: 'CN',
      triage: 'auto', confidence: 82,
      slaTarget: '2026-07-01 13:10', slaRemaining: '3h', slaOk: true,
      draft: 'NMPA 2021 개정으로 KTL/KTC 시험성적서 부분 인정 (일부 항목만). 반드시 NMPA-recognized lab 재시험 필요 항목 확인.',
      tags: ['NMPA', 'Testing'],
    },
    {
      id: 'Q-3400', at: '2026-06-29 14:22', q: '재사용 의료기기 세척·소독 검증 요구사항',
      from: { name: 'Kyu Cho', dept: 'R&D SW', avatar: 'KC' },
      product: 'X-ray Detector',
      triage: 'needs-review', confidence: 68,
      slaTarget: '2026-07-01 14:22', slaRemaining: '5h', slaOk: true,
      draft: '<b>초안 (68%)</b>: FDA Reprocessing Guidance (2015) · ISO 17664. 세척·소독·멸균 각각 IFU에 명시.',
      assignee: null,
      tags: ['Reprocessing', 'IFU'],
    },
  ],

  triageStates: {
    'auto':          { lbl: '자동 답변',     en: 'Auto-answered',    color: 'success',   count: 3 },
    'needs-review':  { lbl: '검토 필요',     en: 'Needs Review',     color: 'review',    count: 3 },
    'escalated':     { lbl: '에스컬레이션',  en: 'Escalated',        color: 'blocked',   count: 1 },
    'waiting':       { lbl: '유저 대기',     en: 'Waiting Employee', color: 'draft',     count: 1 },
  },

  // Submissions (RA workflow)
  submissions: [
    { id: 'SUB-2026-011', product: 'X-ray Detector', market: 'US',  type: '510(k)',        stage: 'AI Hold',       due: '2026-07-15', owner: 'S. Park', progress: 65 },
    { id: 'SUB-2026-009', product: '촬영실 GUI SW', market: 'EU', type: 'CE MDR TR',    stage: 'NB Review',      due: '2026-10-30', owner: 'S. Park', progress: 80 },
    { id: 'SUB-2026-014', product: 'Handheld X-ray Source', market: 'EU',    type: 'CE MDR TR',    stage: 'Clinical Gap',   due: '2026-11-15', owner: 'M. Lee',   progress: 40 },
    { id: 'SUB-2026-015', product: '촬영실 GUI SW', market: 'JP', type: 'PMDA Todokede', stage: 'Pre-consult',   due: '2026-09-01', owner: 'S. Park', progress: 15 },
    { id: 'SUB-2026-012', product: 'X-ray Detector', market: 'CN', type: 'NMPA',          stage: 'Testing',        due: '2027-02-01', owner: 'J. Han',   progress: 25 },
  ],

  submissionTypes: [
    { id: '510k',   lbl: 'FDA 510(k)',         market: 'US · FDA',   ico: 'file',     steps: 12 },
    { id: 'denovo', lbl: 'FDA De Novo',        market: 'US · FDA',   ico: 'file',     steps: 15 },
    { id: 'pma',    lbl: 'FDA PMA',            market: 'US · FDA',   ico: 'file',     steps: 22 },
    { id: 'ce-mdr', lbl: 'CE Marking (MDR)',   market: 'EU',         ico: 'globe',    steps: 18 },
    { id: 'mfds',   lbl: 'MFDS 의료기기 허가', market: 'KR',         ico: 'doc',      steps: 10 },
    { id: 'nmpa',   lbl: 'NMPA (中国)',        market: 'CN',         ico: 'globe',    steps: 14 },
    { id: 'pmda',   lbl: 'PMDA Shonin/Todokede', market: 'JP',       ico: 'globe',    steps: 12 },
    { id: 'anvisa', lbl: 'ANVISA (Brazil)',    market: 'BR',         ico: 'globe',    steps: 12 },
  ],

  // Regulatory Radar with internal impact assessment
  radar: [
    { id: 'r1', date: '2026-06-26', tag: 'FDA',  ttl: '510(k) RTA Checklist 개정',            sev: 'med',
      impact: [{ pid: 'xray-src', sev: 'high', note: '현재 제출 중 · Predicate 재확인 필요' }] },
    { id: 'r2', date: '2026-06-20', tag: 'MDCG', ttl: 'MDCG 2026-3 · PMCF 평가 보고서 템플릿',  sev: 'high',
      impact: [{ pid: 'gui-sw', sev: 'high', note: 'EU 심사 중 — 신규 템플릿 적용 필요' },
               { pid: 'xray-det', sev: 'med', note: 'CER 갱신 시 반영' }] },
    { id: 'r3', date: '2026-06-12', tag: 'MFDS', ttl: 'SaMD 변경허가 가이드 v2.0 의견조회',    sev: 'med',
      impact: [{ pid: 'gui-sw', sev: 'low', note: '알고리즘 변경 시 참조' },
               { pid: 'gui-sw', sev: 'low', note: 'SW 변경 관리 재검토' }] },
    { id: 'r4', date: '2026-06-05', tag: 'FDA',  ttl: 'AI/ML SaMD PCCP 최종 가이드 (Q&A 추가)', sev: 'high',
      impact: [{ pid: 'gui-sw', sev: 'high', note: 'AI 재학습 파이프라인에 직접 적용 가능' }] },
    { id: 'r5', date: '2026-05-28', tag: 'IMDRF', ttl: 'Cybersecurity for Legacy Devices Guide', sev: 'low',
      impact: [] },
  ],

  // Knowledge base categories (RA managed)
  knowledgeStats: { entries: 342, published: 289, draft: 41, deprecated: 12, thisMonth: '+18' },

  // ══════════════════════════════════════════════════════════════
  // Admin persona data
  // ══════════════════════════════════════════════════════════════

  adminKpis: [
    { lbl: '전체 사용자',       val: '48',       delta: '+6 이번달',       dir: 'up' },
    { lbl: '주간 티켓 흐름',    val: '124',      delta: '89% 자동응답',     dir: 'up' },
    { lbl: 'SLA 준수',         val: '92%',      delta: '지난주 87%',       dir: 'up' },
    { lbl: '코퍼스 크기',       val: '18.4k',   delta: '+832 문서',        dir: 'up' },
  ],

  systemStatus: [
    { name: 'API Gateway',         status: 'ok',   uptime: '99.98%', note: '평균 지연 42ms' },
    { name: 'LLM (Claude Sonnet)', status: 'ok',   uptime: '99.92%', note: '토큰 사용률 63%' },
    { name: 'Vector DB (pgvector)', status: 'ok',  uptime: '100%',   note: '18,432 임베딩' },
    { name: 'Auth (SSO)',           status: 'ok',  uptime: '100%',   note: 'Google Workspace' },
    { name: 'Radar 스크래퍼',      status: 'warn', uptime: '96.4%',  note: 'MFDS RSS 지연 발생' },
    { name: 'Inngest Workers',     status: 'ok',   uptime: '99.7%',  note: '큐 대기 3건' },
  ],

  adminUsers: [
    { id: 'u_yuna',   name: 'Yuna Kim',      email: 'yuna.kim@neurosense.kr',   role: 'employee',  team: 'R&D · SW Team', status: 'active',  last: '방금 전' },
    { id: 'u_seojin', name: 'Seojin Park',   email: 'seojin.park@neurosense.kr', role: 'ra-lead',   team: 'RA',             status: 'active',  last: '10분 전' },
    { id: 'u_jihun',  name: 'Jihun Han',     email: 'jihun.han@neurosense.kr',   role: 'ra-member', team: 'RA',             status: 'active',  last: '2시간 전' },
    { id: 'u_mina',   name: 'Mina Lee',      email: 'mina.lee@neurosense.kr',    role: 'ra-member', team: 'RA',             status: 'active',  last: '어제' },
    { id: 'u_kyu',    name: 'Kyu Cho',       email: 'kyu.cho@neurosense.kr',     role: 'employee',  team: 'R&D · HW Team', status: 'active',  last: '어제' },
    { id: 'u_doyeon', name: 'Doyeon Ryu',    email: 'doyeon.ryu@neurosense.kr',  role: 'employee',  team: 'Regulatory Ops', status: 'active', last: '2일 전' },
    { id: 'u_ha',     name: 'Hyunjoo Ha',    email: 'hyunjoo.ha@neurosense.kr',  role: 'employee',  team: 'Marketing',      status: 'active', last: '3일 전' },
    { id: 'u_bs',     name: 'Byungsoo Oh',   email: 'byungsoo.oh@neurosense.kr', role: 'employee',  team: 'Clinical Ops',   status: 'active', last: '1주 전' },
    { id: 'u_yh',     name: 'Younghee Kim',  email: 'younghee.kim@vendor.io',    role: 'viewer',    team: '외부 파트너',    status: 'pending', last: '—' },
    { id: 'u_admin',  name: 'Jaehyun Yoon',  email: 'jaehyun.yoon@neurosense.kr', role: 'admin',    team: 'IT · Platform', status: 'active',  last: '2분 전' },
  ],

  adminRoles: [
    { id: 'employee',  label: 'Employee',     count: 26, perms: ['ask', 'read guides', 'submit tickets'] },
    { id: 'viewer',    label: 'Viewer',       count:  4, perms: ['read only'] },
    { id: 'ra-member', label: 'RA Member',    count: 12, perms: ['inbox triage', 'authored ESIG', 'knowledge draft'] },
    { id: 'ra-lead',   label: 'RA Lead',      count:  4, perms: ['approve ESIG', 'escalate', 'knowledge publish'] },
    { id: 'admin',     label: 'Admin',        count:  2, perms: ['users, RBAC, corpus, radar, settings'] },
  ],

  systemAuditLog: [
    { ts: '2026-07-01 10:14:22', actor: 'Seojin Park',   action: 'inbox.approve',       target: 'Q-3406', ip: '10.0.4.12',  meta: 'ESIG · Approved · SHA-256:a4e1…' },
    { ts: '2026-07-01 09:58:03', actor: 'Regula AI',     action: 'triage.auto',         target: 'Q-3406', ip: 'internal',   meta: 'confidence 91%' },
    { ts: '2026-07-01 09:42:15', actor: 'Jihun Han',     action: 'knowledge.publish',   target: 'K-2026-342', ip: '10.0.4.18', meta: 'from C-2026-036' },
    { ts: '2026-07-01 08:17:44', actor: 'System',        action: 'rag.reindex',         target: 'corpus:mdcg', ip: 'internal', meta: '+ MDCG 2026-3 · MDCG 2024-9' },
    { ts: '2026-06-30 23:00:00', actor: 'System',        action: 'radar.scrape',        target: 'source:fda-rss', ip: 'internal', meta: '4 new items' },
    { ts: '2026-06-30 18:33:41', actor: 'Jaehyun Yoon',  action: 'role.grant',          target: 'u_kyu', ip: '10.0.4.5',  meta: 'employee → ra-member (denied · policy)' },
    { ts: '2026-06-30 16:20:55', actor: 'Jihun Han',     action: 'inbox.escalate',      target: 'Q-3392', ip: '10.0.4.18', meta: '→ External counsel (Kim & Lee)' },
    { ts: '2026-06-30 14:11:01', actor: 'Jaehyun Yoon',  action: 'settings.update',     target: 'sla.needs-review', ip: '10.0.4.5', meta: '24h → 12h' },
    { ts: '2026-06-30 09:00:00', actor: 'System',        action: 'auth.sso.login',      target: 'u_seojin', ip: '10.0.4.12', meta: 'Google Workspace' },
    { ts: '2026-06-29 22:04:12', actor: 'Regula AI',     action: 'triage.escalate',     target: 'Q-3392', ip: 'internal',   meta: 'confidence 41% < threshold' },
  ],

  ragCorpus: [
    // ── 사내 3개 운영 레포 (실제 연동 중) ──────────────────────
    {
      id: 'c-nas-wiki', name: 'RA LLM Wiki (사내 NAS · 인제스트)',
      repo: 'DR_RnD/ra-llm-wiki', host: 'nas',
      hostUrl: 'http://10.11.1.40:7001/DR_RnD/ra-llm-wiki.git',
      branch: 'main', path: '/', auth: 'ssh-deploy-key',
      docs: 1240, size: '3.8 GB', lastSync: '2026-07-01 03:18', commit: '7c9a12…',
      status: 'ok', cron: 'daily 03:00',
      purpose: '사내 NAS 원본 문서 인제스트 + Wiki화',
    },
    {
      id: 'c-md-process', name: 'MD-Process · 의료기기 제조·업무규칙',
      repo: 'holee9/MD-process', host: 'github', hostUrl: 'https://github.com/holee9/MD-process',
      branch: 'main', path: '/ (10 카테고리 전체)', auth: 'github-app',
      docs: 70, size: '4.2 MB', lastSync: '2026-07-01 03:18', commit: '09a750f…',
      status: 'ok', cron: 'daily 03:20',
      purpose: 'QMS·설계·제조·검사·PMS SOP + 절차서 + 양식 (v0.2+ 100%)',
    },
    {
      id: 'c-ra-project', name: 'RA-Project · 인허가 지식베이스',
      repo: 'holee9/ra-project', host: 'github', hostUrl: 'https://github.com/holee9/ra-project',
      branch: 'main', path: '01_규제지식베이스/ + 04_기술문서_템플릿/ + 06_심사_QA이력/',
      auth: 'github-app',
      docs: 168, size: '18 MB', lastSync: '2026-07-01 07:00', commit: 'ad6f950…',
      status: 'ok', cron: 'daily 03:40 + 주간 심층 월07:00',
      purpose: 'MFDS/FDA/MDR 규제지식 + STED 템플릿 + 심사 QA (168 EP 완료)',
    },
  ],

  // ══ DB Data Stores (Git 부적합 리소스) ══════════════════════
  dbStores: [
    { id: 'approved_answers', name: '승인 답변집',
      kind: 'hybrid', tech: 'PostgreSQL + nightly Git 스냅샷',
      rows: 342, size: '18 MB', growth: '+18 이번달',
      retention: '5년', immutable: false, hashChain: false,
      note: 'Inbox 승인 시 실시간 저장 · 야간 03:20 KST git 커밋 (regula-approved-answers)',
      status: 'ok' },
    { id: 'users', name: 'Users · 사용자',
      kind: 'db', tech: 'PostgreSQL',
      rows: 48, size: '24 KB', growth: '+6 이번달',
      retention: '재직 기간 + 3년', immutable: false, hashChain: false,
      note: 'SSO 세션 · RBAC · 담당 제품 매핑. 매 로그인마다 조회.',
      status: 'ok' },
    { id: 'products', name: 'Products · 제품 · 시장별 등록',
      kind: 'db', tech: 'PostgreSQL',
      rows: 12, size: '8 KB', growth: '+2 이번달',
      retention: '단종 후 10년 (MDR Art. 10(8))',
      immutable: false, hashChain: false,
      note: 'product_markets · submissions 조인 사용. Product Registry 화면 소스.',
      status: 'ok' },
    { id: 'submissions', name: 'Submissions · 인허가 진행',
      kind: 'db', tech: 'PostgreSQL',
      rows: 23, size: '42 KB', growth: '+3 이번달',
      retention: '승인/철회 후 15년 (ISO 13485)',
      immutable: false, hashChain: false,
      note: '진행 상태·단계·마감 관리. Submissions 화면 소스.',
      status: 'ok' },
    { id: 'audit_log', name: 'Audit Log · 감사추적',
      kind: 'db-immutable', tech: 'PostgreSQL append-only + SHA-256 chain',
      rows: 12480, size: '148 MB', growth: '+1240 이번주',
      retention: '10년 (21 CFR §11 + MDR)',
      immutable: true, hashChain: true,
      note: 'INSERT only · DB trigger로 UPDATE/DELETE 금지. 월 1회 git tag로 무결성 앵커 게시.',
      status: 'ok' },
    { id: 'inbox_tickets', name: 'Inbox Tickets · 사내 문의',
      kind: 'db', tech: 'PostgreSQL',
      rows: 3406, size: '78 MB', growth: '+124 이번주',
      retention: '7년', immutable: false, hashChain: false,
      note: '트리아지 상태 변화 잦음. audit_log와 연결되어 액션 추적.',
      status: 'ok' },
    { id: 'visual_assets', name: 'Visual Assets · 도해',
      kind: 'object-storage', tech: 'S3 (R2) + PostgreSQL 메타',
      rows: 84, size: '340 MB', growth: '+8 이번달',
      retention: '5년', immutable: false, hashChain: false,
      note: '이미지 원본 S3, 메타(태그·인용 규제) DB. 답변 첨부용.',
      status: 'ok' },
    { id: 'embeddings', name: 'Embeddings · 벡터 인덱스',
      kind: 'db', tech: 'pgvector (PostgreSQL)',
      rows: 18432, size: '2.4 GB', growth: '+832 이번주',
      retention: '코퍼스와 동기',
      immutable: false, hashChain: false,
      note: '3개 git 레포에서 파생된 문서 청크 임베딩. Regula AI 검색의 실체.',
      status: 'ok' },
  ],

  // ══ Expert Personas (9 · 지구 최강 전문가 · 교차검증판) ══════
  personas: [
    // ── Employees (5) ─────────────────────────────────────────
    {
      id: 'p_yuna', persona: 'employee', name: 'Yuna Kim', initials: 'YK', age: 34,
      title: 'Senior SW Engineer · AI/ML', team: 'R&D · SW / AI Team',
      bg: 'KAIST 전산 학사 · Samsung Medison AI 6년 · IEC 62304 Class B/C SW 4건 리드 · MLOps 파이프라인 자체 구축',
      creds: 'IEC 62304 · IEC 82304 · GMLP · FDA PCCP Draft 대응 2건 · PyTorch/CycloneDX · SBOM 스택 실무',
      crossCheck: 'IEC 62304 §5-§9 전 조항 인용 가능 · FDA GMLP 5원칙 실무 적용 · SaMD IMDRF N12 준수',
      evaluationScope: ['employee/ask', 'employee/impact', 'employee/myqs', 'ra/consult(view)', 'ra/radar(SW 관련)'],
      redLines: ['SW 변경 판단이 IEC 62304 §5.7 unresolved SOUP 확인 없이 결정되면 안됨', 'PCCP 없이 재학습 배포 판단 금지'],
      decisionWeight: { sw: 5, ai: 5, ra: 2, ux: 3, hw: 1 },
      goals: ['AI 재학습 배포 5분 판단', 'PCCP 프로토콜 초안 표준화', 'SOUP 문서화 자동화'],
      pains: ['RA 문의 하루 대기 병목', 'FDA 가이드 → 우리 케이스 매핑 부재', 'SBOM/CBOM 파편화'],
      literacy: 'high',
      quote: '"AI 배포 시 PCCP 판단을 3분 안에 해결하는 도구가 나에게 가장 큰 자산이다."',
    },
    {
      id: 'p_jihun', persona: 'employee', name: 'Jihun Han', initials: 'JH', age: 41,
      title: 'Principal HW Engineer · X-ray Systems', team: 'R&D · HW',
      bg: '서울대 전기공학 박사 · Vieworks 8년 · X-ray Detector 3건 FDA 510(k) 통과 · EMC lab 5회 무결점 통과',
      creds: 'IEC 60601-1 · IEC 60601-1-2 4판 · IEC 60601-2-54 · CB Test 절차 · KTL/UL EMC 실무 · GB 9706 시리즈',
      crossCheck: 'IEC 60601-1-2:2020 §7 tailoring 근거 인용 가능 · CB Report 재활용 판단 3지역 실무 · GB 9706.1-2020 강화 조항 매핑 보유',
      evaluationScope: ['employee/products', 'employee/impact(HW)', 'employee/ask(HW)', 'ra/submissions(HW 관점)'],
      redLines: ['EMC 재시험 판단이 tailoring 근거 없이 skip되면 안됨', 'IEC 60601-1 3rd amd 반영 안된 답변 인용 금지'],
      decisionWeight: { hw: 5, emc: 5, submissions: 3, ra: 2, sw: 1 },
      goals: ['BOM 변경 시 재시험 범위 즉시 판단', 'Predicate 비교표 자동 생성', '3지역 시험성적서 재활용'],
      pains: ['RA 판단 대기 평균 2.4일', 'NMPA GB 9706 강화 조항 케이스별 판단', 'CB Test 재활용 범위 불명'],
      literacy: 'medium',
      quote: '"GB 9706 강화 조항을 IEC 60601 대비 표로 보여주면 재시험 예산 결정이 하루 걸리던 게 30분에 끝난다."',
    },
    {
      id: 'p_doyeon', persona: 'employee', name: 'Doyeon Ryu', initials: 'DR', age: 38,
      title: 'Regulatory Ops Manager', team: 'Regulatory Operations',
      bg: '연세대 생명공학 박사 · GE Healthcare 5년 · 사내 문서·UDI·EUDAMED 운영 · MFDS 재심사 3건 관리',
      creds: 'ISO 13485 IA · UDI/GS1 · EUDAMED 4모듈 실무 · ISO 15223-1 심볼 감사 · SharePoint QMS 통합',
      crossCheck: 'MDR Art. 27 UDI-DI/PI 갱신 트리거 5조건 인용 가능 · EUDAMED Actor/UDI/Device/Vigilance 모듈 실무',
      evaluationScope: ['employee/products(라벨/UDI)', 'employee/guides', 'employee/myqs', 'ra/knowledge(SOP 관점)', 'admin/corpus(사내 SOP)'],
      redLines: ['UDI 갱신 필요 판정이 MDR Art. 27 5조건 체크 없이 결정되면 안됨', 'IFU 언어 잠금이 ISO 15223-1 심볼 감사 없이 진행되면 안됨'],
      decisionWeight: { qms: 5, docs: 5, labeling: 4, ra: 2, sw: 0 },
      goals: ['UDI 갱신 자동 감지', 'IFU 다국어 잠금 자동화', 'MFDS 재심사 리마인더'],
      pains: ['UDI 트리거 시스템 감지 부재', '다국어 IFU 수동 프로세스', '이메일 기반 리마인더 누락'],
      literacy: 'high',
      quote: '"UDI 갱신 트리거를 시스템이 자동 감지하면 규제 사고 위험이 절반으로 줄어든다."',
    },
    {
      id: 'p_hyunjoo', persona: 'employee', name: 'Hyunjoo Ha', initials: 'HH', age: 36,
      title: 'Product Marketing Lead', team: 'Marketing',
      bg: '연세대 경영 · Medtronic Korea 6년 · 의료기기 마케팅 · 광고심의 45건 통과 · 3지역 캠페인 리드',
      creds: '의료기기 광고심의(KRDIA) · FTC Truth-in-Advertising · MHRA advertising code · MKT 캠페인 15+',
      crossCheck: 'MFDS 의료기기법 §24 표시·광고 위반 사례 실무 · FTC 15 U.S.C. §55(a) 표시 규정 인용 가능',
      evaluationScope: ['employee/ask(claim)', 'employee/guides(광고)', 'employee/myqs', 'employee/impact(마케팅 자료 변경)'],
      redLines: ['"clinically proven" 등 claim이 임상 근거 없이 사용되면 안됨', '해외 자료 번역 시 현지 광고 규제 미반영 금지'],
      decisionWeight: { marketing: 5, claim: 5, ra: 2, ux: 4, non_expert_readability: 5 },
      goals: ['claim 허용 즉시 확인', '경쟁사 claim 비교', '해외 광고 규제 반영'],
      pains: ['claim 승인 대기 길다', '지역별 광고 규제 차이 불명', '자료 발행 전 RA 승인 병목'],
      literacy: 'low',
      quote: '"규제 문장이 어려워도 톤이 친절하면 담당자 부르기 전에 스스로 확인 가능하다."',
    },
    {
      id: 'p_bs', persona: 'employee', name: 'Byungsoo Oh', initials: 'BO', age: 47,
      title: 'Clinical Affairs Lead · MD/PhD', team: 'Clinical Operations',
      bg: 'MD/PhD 임상병리 · Boston Scientific US 8년 · CER 6건 · PMCF 조사 3건 · ISO 14155 CI 지속 인증',
      creds: 'MD · CCRA · ISO 14155 · MDCG 2020-5/6/7/8 · IRB Chair 3년 · Real-World Evidence 프레임워크',
      crossCheck: 'MDR Art. 61 임상평가 요구 실무 · MDCG 2020-6 sufficient clinical evidence 판단 · MDR Annex XIV Part A/B 조항 인용',
      evaluationScope: ['ra/consult(CER/PMCF)', 'employee/impact(임상)', 'employee/myqs', 'ra/registry(임상 데이터)'],
      redLines: ['임상 확장(intended purpose)이 신규 임상평가 없이 진행되면 안됨', 'PMS→CER 피드백 루프가 6개월 이상 단절되면 안됨'],
      decisionWeight: { clinical: 5, pms: 4, cer: 5, ra: 3, sw: 1, ux: 3 },
      goals: ['CER 업데이트 트리거 판단', 'PMCF 프로토콜 초안', 'RWD → CER 자동 반영'],
      pains: ['PMS → CER 반영 트리거 모호', 'PMCF 지역별 요구 상이', '임상 gap analysis 수동'],
      literacy: 'medium',
      quote: '"MDCG 2020-8 신 템플릿을 자동 반영하면 PMCF 리포트 초안 시간이 40% 단축된다."',
    },
    // ── RA (3) ────────────────────────────────────────────────
    {
      id: 'p_seojin', persona: 'ra', name: 'Seojin Park', initials: 'SP', age: 45,
      title: 'RA Lead · 20년', team: 'RA (팀리드, 3인)',
      bg: '이화여대 약학 · Philips Korea 7년 + GE Healthcare 10년 · 승인 12건 · NB Auditor(TÜV Rheinland Guest)',
      creds: 'RAC-Global · MDR/FDA/MFDS/NMPA/PMDA 승인 12건 · ISO 13485 Lead Auditor · 21 CFR Part 11 감사 통과 3회',
      crossCheck: 'MDR Annex II/III 실무 · 21 CFR §820 QSR 조항 인용 · MDSAP 통합 감사 대응 실무',
      evaluationScope: ['전체 화면 (팀 리드 관점)', 'ra/inbox(SLA)', 'ra/consult(팀 재사용)', 'admin/logs(감사)', 'ra/knowledge(publish 승인)'],
      redLines: ['ESIG가 21 CFR §11.200(a)(1) 두 요소 재입력 없이 통과되면 안됨', '팀 SLA 90% 미만이면 backlog에서 이 문제 최우선', '단독 의견 기반 필수 승인 안 함'],
      decisionWeight: { ra: 5, governance: 5, esig: 5, sla: 5, team: 5, sw: 2, hw: 2 },
      goals: ['팀 SLA 90%+', '자동 답변률 60%+', 'MDSAP 통합 감사 준비'],
      pains: ['3인 팀에 월 400+ 문의', '규제 변경 사내 임팩트 평가 지연', 'ESIG 감사 준비 2주 소요'],
      literacy: 'high',
      quote: '"단독 의견을 backlog 필수로 밀어붙이는 순간 팀 신뢰가 무너진다. 회의록이 유일한 근거."',
    },
    {
      id: 'p_mina', persona: 'ra', name: 'Mina Lee', initials: 'ML', age: 39,
      title: 'Senior RA Specialist · Global', team: 'RA',
      bg: '서울대 약학 · Siemens Healthineers 독일 지사 4년 · 12년 · MDR TR 8건 · FDA Pre-Sub 6건 · MDCG WG 옵서버',
      creds: 'RAC(US) + RAC(EU) · MDR TR 8건 · FDA Pre-Sub 6건 · MDCG 2020-3/6/8 WG 참여 · Q-Sub 실무',
      crossCheck: 'MDR Annex II §6.1.b 임상평가 절차 · FDA Pre-Sub Program 실무 · Notified Body Deficiency Letter 대응 통계',
      evaluationScope: ['ra/consult(다국어)', 'ra/submissions', 'ra/radar', 'ra/knowledge', 'employee/impact(다국가 관점)'],
      redLines: ['MDR/FDA 이중 제출에서 동등성 근거 불일치 허용 안 함', 'Notified Body 답변에 근거 조항 미명시 금지'],
      decisionWeight: { global_ra: 5, mdr: 5, fda: 5, submissions: 4, ra: 4, ux: 3 },
      goals: ['MDR + FDA 문서 재활용 극대화', 'NB Deficiency 리스크 최소화', 'PCCP 사내 표준'],
      pains: ['MDR 심사관별 판단 차이', 'FDA AI Request 답변 톤 부재', 'MDR simplification(COM 2025/1023) 추적 부담'],
      literacy: 'high',
      quote: '"Consult에서 관할권 3개 병렬 비교가 엑셀 매트릭스를 대체하면 팀 재사용성이 극대화된다."',
    },
    {
      id: 'p_kyu', persona: 'ra', name: 'Kyu Cho', initials: 'KC', age: 34,
      title: 'RA Specialist · Asia', team: 'RA',
      bg: '고려대 약학 · 사내 성장 8년 · MFDS/NMPA/PMDA 3개국 등록 3건 · 중문/일문 실무 가능',
      creds: 'RAC(APAC) · MFDS 실무 · NMPA CFDI 심사 3회 · PMDA Type-II 상담 5회 · GB 9706 시리즈 대응',
      crossCheck: 'MFDS 고시 2025-01 사이버보안 조항 · NMPA Order No.47 (2021) 변경 사항 · PMDA 通知 실무',
      evaluationScope: ['ra/consult(APAC)', 'ra/submissions(NMPA/PMDA)', 'ra/radar(중일 원문)', 'employee/products(APAC 등록)'],
      redLines: ['MFDS 신규 고시 SLA 24h 초과 답변 금지', 'NMPA 재시험 판단이 GB 9706 강화 조항 매핑 없이 결정 금지'],
      decisionWeight: { apac: 5, mfds: 5, nmpa: 5, pmda: 5, ra: 3, ux: 3 },
      goals: ['MFDS 고시 24h 반영', 'NMPA Order No.47 재시험 판정 자동화', 'PMDA Type-II 준비 표준화'],
      pains: ['MFDS 사이버보안 개정 케이스별 판단', '중문/일문 해석 시간', '3개국 라벨 잠금 파편화'],
      literacy: 'high',
      quote: '"중문/일문 원문 hover-preview가 있으면 심사관 커뮤니케이션의 근거로 그대로 사용 가능."',
    },
    // ── Admin (1) ─────────────────────────────────────────────
    {
      id: 'p_jaehyun', persona: 'admin', name: 'Jaehyun Yoon', initials: 'JY', age: 40,
      title: 'Platform Admin · SRE', team: 'IT · Platform',
      bg: 'Kakao 5년 SRE 리드 · 10년 · Postgres/pgvector/K8s/LLMOps · SOC 2 실사 대응 · Langfuse/Sentry 프로덕션 운영',
      creds: 'AWS Solutions Architect Pro · CKA · SOC 2 Type II 대응 · Langfuse/Sentry 운영 · 21 CFR Part 11 SRE 관점',
      crossCheck: 'pgvector 실무 · Auth.js RBAC 클레임 확장 · Inngest 크론 조율 · GitHub App 설치 방식 SSH deploy key 실무',
      evaluationScope: ['admin/전체', 'admin/corpus', 'admin/datastores', 'admin/logs', 'admin/settings', 'admin/radar'],
      redLines: ['audit_log가 append-only DB 제약 없이 배포되면 안됨', '재인덱싱 크론이 겹쳐 DB 부하 초과 시 배포 차단', 'SSO 세션 관리에 페르소나 클레임 없이 RBAC 배선 안 함'],
      decisionWeight: { sre: 5, security: 5, storage: 5, infra: 5, ux: 2, ra: 2 },
      goals: ['3레포 + DB 무결성', 'hash chain 자동 검증', 'RAG 크론 폭풍 방지', 'SSO/RBAC 안정'],
      pains: ['재인덱싱 크론 중복', 'MFDS RSS 지연', 'ESIG 로그 export 시간'],
      literacy: 'high',
      quote: '"Git 코퍼스와 DB를 분리한 IA 덕분에 재인덱싱 폭풍이 사라졌고, 21 CFR §11.10(e)는 hash chain으로 자동 준수된다."',
    },
  ],

  // ══ Usability Meetings · 이 세션의 실제 회의 이력 (Live) ═════
  // 매 회의 = 이 대화창에서 이뤄진 실제 디자인 결정 라운드.
  // findings는 관련 페르소나들이 각자 전문성으로 워크스루 → 다자 협의 → backlog로 승격.
  usabilityMeetings: [
    {
      id: 'M-001', date: '2026-07-01', title: 'v3 초기 페르소나 분리 · Employee/RA 2-앱',
      round: 'Design Round #1', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_yuna', 'p_hyunjoo', 'Designer'],
      agenda: ['v2 QMS 확장 방향 폐기', '2-앱(Employee/RA) 아키텍처 정립', 'RA Inbox 크라운 지정'],
      findings: [
        { sev: 'high', raisedBy: 'p_seojin', agreedBy: ['PM'], dissent: [],
          screen: 'v2 IA', note: 'QMS 도메인 최상위 배치는 RA 게이트웨이 정체성 훼손 · QMS 소유는 QA팀' },
        { sev: 'positive', raisedBy: 'p_yuna', agreedBy: ['p_seojin', 'PM'], dissent: [],
          screen: 'Change Impact Check', note: '4-step 위저드가 SW 배포 판단 부담을 하루→3분으로 단축' },
        { sev: 'high', raisedBy: 'p_hyunjoo', agreedBy: ['p_yuna'], dissent: [],
          screen: 'Employee/Ask', note: '규제 각주 <sup>가 비전문가에게 과다 · 간단히 보기 토글 필요' },
        { sev: 'positive', raisedBy: 'p_seojin', agreedBy: ['PM'], dissent: [],
          screen: 'RA/Inbox', note: '4-column Kanban 트리아지가 팀 SLA 관리에 최적 · 24h 유예 감사 위험 최소화' },
      ],
      decisions: [
        { text: '2-앱 아키텍처 채택 · Employee 5화면 + RA 6화면', resolution: '만장일치 (5/5)', promotedTo: 'BK-001' },
        { text: 'Inbox = RA 홈 · Change Impact = Employee 핵심', resolution: '만장일치', promotedTo: 'BK-002·BK-003' },
      ],
      followups: ['RA도 파워 챗 필요 → Consult 신설', 'Ask 각주 축약 (권장 이관)'],
    },
    {
      id: 'M-002', date: '2026-07-01', title: 'Consult · Dark mode · Inbox 뷰 토글 실동작',
      round: 'Design Round #2', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_mina', 'p_kyu', 'p_jaehyun', 'Designer'],
      agenda: ['RA Consult 신설 (파워 챗)', 'Dark mode 하드코딩 컬러 정비', 'Inbox Kanban↔List 실동작'],
      findings: [
        { sev: 'positive', raisedBy: 'p_mina', agreedBy: ['p_kyu', 'p_seojin'], dissent: [],
          screen: 'RA/Consult', note: '관할권 3개 병렬 비교가 엑셀 매트릭스 대체 · Knowledge 등재 원클릭' },
        { sev: 'high', raisedBy: 'p_mina', agreedBy: ['p_seojin', 'p_kyu', 'p_jaehyun'], dissent: [],
          screen: 'Consult 세션', note: '초기 구현 세션별 콘텐츠 미분리 · 어느 세션 클릭해도 같은 내용' },
        { sev: 'high', raisedBy: 'p_seojin', agreedBy: ['p_jaehyun', 'PM'], dissent: [],
          screen: '전 페이지 · Dark', note: '하드코딩 white 다수 · 사이드바 blackout · 토큰 재정비 필수' },
        { sev: 'medium', raisedBy: 'p_seojin', agreedBy: ['p_mina'], dissent: [],
          screen: 'RA/Inbox', note: 'Kanban↔List 토글이 시각 반응만 · 실제 뷰 전환 안됨' },
      ],
      decisions: [
        { text: 'Consult 5 세션 각각 실 규제 조항 딥리서치 콘텐츠 삽입', resolution: '만장일치 (5/5)', promotedTo: 'BK-004' },
        { text: '전 하드코딩 컬러 → var(--bg-surface) 토큰 치환', resolution: '만장일치', promotedTo: 'BK-005' },
        { text: 'InboxListView 신설 · view 로컬 훅으로 상태 관리', resolution: '만장일치', promotedTo: 'BK-006' },
      ],
      followups: ['verifier 지적: Change Impact wizard step 라벨 clip 수정'],
    },
    {
      id: 'M-003', date: '2026-07-01', title: '검색 팔레트 · 3-tier Admin · 사이드바 clip',
      round: 'Design Round #3', status: 'closed',
      attendees: ['PM', 'p_yuna', 'p_seojin', 'p_jaehyun', 'Designer'],
      agenda: ['검색 dead-click 3곳 배선', '3-tier 페르소나 확장(Admin)', '사이드바 clip 근본 원인'],
      findings: [
        { sev: 'positive', raisedBy: 'p_yuna', agreedBy: ['p_seojin', 'p_jaehyun'], dissent: [],
          screen: '전역 검색', note: '⌘K 딥링크 강력 · 관할권 자동 필터 인식 인상적' },
        { sev: 'high', raisedBy: 'p_seojin', agreedBy: ['PM'], dissent: [],
          screen: '사이드바 하단', note: '사용자명 세로 clip · 창 조절 시 지속 · 원인 진단 필요' },
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin'], dissent: [],
          screen: 'Admin (신규)', note: '시스템 관리 도구 명확 격리 · 로고 그라디언트(ink→brand) 잘 표현' },
        { sev: 'high', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin'], dissent: [],
          screen: '사이드바 CSS', note: 'grid-template-rows 미지정으로 자식 자연 높이 초과 · 뷰포트 34px 오버플로' },
      ],
      decisions: [
        { text: 'SearchPalette 신설 · ⌘K + 3개 진입점 + 7그룹 인덱싱', resolution: '만장일치 (4/4)', promotedTo: 'BK-007' },
        { text: 'Admin 페르소나 추가 · 6화면 초기 (Overview/Users/AuditLog/RAG/Radar/Settings)', resolution: '만장일치', promotedTo: 'BK-008' },
        { text: '로그아웃/설정 팝오버 신설', resolution: '만장일치', promotedTo: 'BK-009' },
        { text: '.app-v2 grid-rows 100% + .sb2 height 100%', resolution: '만장일치', promotedTo: 'BK-010' },
      ],
      followups: ['RAG 코퍼스를 Git 레포 방식으로 재설계'],
    },
    {
      id: 'M-004', date: '2026-07-01', title: '3 Git 레포 실사 · Storage 정책 확정 (Git vs DB)',
      round: 'Design Round #4', status: 'closed',
      attendees: ['PM', 'p_jaehyun', 'p_seojin', 'p_mina', 'p_doyeon', 'Designer'],
      agenda: ['ra-llm-wiki + MD-process + ra-project 3레포 실사', '별도 신설 vs DB 처리 분류', 'RAG 코퍼스 화면에 실 레포 반영'],
      findings: [
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin', 'p_doyeon'], dissent: [],
          screen: 'RAG 코퍼스', note: '3레포 실 연동 · 커밋 해시·브랜치·크론 표시가 감사 친화' },
        { sev: 'high', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin', 'p_mina', 'PM'], dissent: [],
          screen: '스토리지 정책', note: 'Users/Products/Audit를 git으로 하면 commit 폭풍 · DB 필수' },
        { sev: 'medium', raisedBy: 'p_seojin', agreedBy: ['p_mina', 'p_jaehyun'], dissent: [],
          screen: '승인 답변집', note: 'DB 실시간 + git 야간 스냅샷 하이브리드 최적' },
        { sev: 'medium', raisedBy: 'p_jaehyun', agreedBy: [], dissent: [],
          screen: 'RAG 크론', note: '3레포 크론이 03:18에 몰림 · 재인덱싱 폭풍 발생' },
      ],
      decisions: [
        { text: 'RAG 코퍼스 = 3 Git 레포 (문서 원본성) · Admin 전용 관리', resolution: '만장일치 (5/5)', promotedTo: 'BK-011' },
        { text: '데이터 저장소 = DB 8종 (Users/Products/Submissions/Audit/Inbox/Answers/Assets/Embeddings)', resolution: '만장일치', promotedTo: 'BK-012' },
        { text: '승인 답변집 = Hybrid (DB + 야간 git 스냅샷 · regula-approved-answers 신설)', resolution: '만장일치', promotedTo: 'BK-013' },
      ],
      followups: ['크론 시각 분산 (권장 이관)', '9 페르소나·usability·backlog 카테고리 신설'],
    },
    {
      id: 'M-005', date: '2026-07-01', title: '9 페르소나 · Product Design 카테고리 · 사이드바 그룹',
      round: 'Design Round #5', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_bs', 'p_jaehyun', 'Designer'],
      agenda: ['9 페르소나 딥리서치', 'Admin에 페르소나/사용성/백로그 카테고리 신설', '사이드바 그룹 분리'],
      findings: [
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['PM', 'p_seojin'], dissent: [],
          screen: '데이터 저장소', note: 'Git/DB 분리 IA 명확 · 4 스토리지 정책 카드가 온보딩 자료로 그대로 사용 가능' },
        { sev: 'medium', raisedBy: 'p_seojin', agreedBy: ['PM'], dissent: [],
          screen: 'Admin 사이드바', note: '10 메뉴 flat 리스트 · 카테고리 분리 필요' },
        { sev: 'medium', raisedBy: 'p_seojin', agreedBy: ['PM'], dissent: [],
          screen: 'Admin 카테고리 순서', note: '워크스페이스→사용자→데이터→거버넌스→제품디자인 순 필요' },
      ],
      decisions: [
        { text: '9 페르소나 딥리서치 프로필 · Product Design 카테고리 신설', resolution: '만장일치 (4/4)', promotedTo: 'BK-014·BK-015' },
        { text: 'Admin 사이드바 5그룹 분리 · 순서 확정', resolution: '만장일치', promotedTo: 'BK-016·BK-017' },
      ],
      followups: ['사용성/백로그를 실 데이터로 전환 · 다자 협의 기반 판단', '페르소나 성장 로그'],
    },
    {
      id: 'M-006', date: '2026-07-01', title: '사용성 실 데이터 전환 · 회의록 스키마 · 필수/권장/기각',
      round: 'Design Round #6', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_mina', 'p_doyeon', 'p_hyunjoo', 'p_jaehyun', 'Designer'],
      agenda: ['findings를 raisedBy/agreedBy/dissent 구조로 재편', '백로그 필수/권장/기각 분류 + 상태', '페르소나 성장 로그 시스템'],
      findings: [
        { sev: 'high', raisedBy: 'PM', agreedBy: ['p_seojin', 'p_mina', 'p_doyeon', 'p_hyunjoo', 'p_jaehyun'], dissent: [],
          screen: '판단 프로세스', note: '단독 의견으로는 필수/권장/기각 판단 근거 부족 · 다자 협의 결과로 재편 필요' },
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin'], dissent: [],
          screen: 'Product Design', note: '회의록 방식이 이력 추적에 우수 · 발견 → backlog 승격 흐름 자연스러움' },
      ],
      decisions: [
        { text: 'findings 스키마: raisedBy + agreedBy + dissent 명시', resolution: '만장일치 (7/7)', promotedTo: 'BK-018' },
        { text: '분류 기준: 만장일치→필수 · 다수 지지→권장 · 임팩트 낮음→기각', resolution: '만장일치', promotedTo: 'BK-019' },
        { text: 'backlog basis 필드로 회의 + 합의 방식 명시', resolution: '만장일치', promotedTo: 'BK-020' },
      ],
      followups: ['페르소나 growth 로그 시스템', 'personaReviews 매트릭스 신설'],
    },
    {
      id: 'M-007', date: '2026-07-01', title: '페르소나 리뷰 매트릭스 · 세션 로그 시스템',
      round: 'Design Round #7', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_yuna', 'p_jaehyun', 'p_kyu', 'p_bs', 'Designer'],
      agenda: ['페르소나 × 화면 평가 매트릭스', '세션 로그(S-2026-XX)', '평가 세션 실행 트리거'],
      findings: [
        { sev: 'positive', raisedBy: 'PM', agreedBy: ['p_seojin', 'p_jaehyun'], dissent: [],
          screen: 'Usability 매트릭스', note: '9명 × 16화면 매트릭스 · 셀 hover로 finding 즉시 확인 가능' },
        { sev: 'high', raisedBy: 'PM', agreedBy: ['p_seojin', 'p_yuna', 'p_bs'], dissent: [],
          screen: '세션 실행 버튼', note: '이 세션에서 하는 디자인 자체가 사용성 평가 사이클임 · 코드 배포 후 활동이 아님' },
      ],
      decisions: [
        { text: 'personaReviews 매트릭스 신설 · 매 회의 후 갱신', resolution: '만장일치 (7/7)', promotedTo: 'BK-021' },
        { text: '세션 실행 = PENDING 카드로 대기열 등록 · 실 인터뷰 후 값 채움', resolution: '만장일치', promotedTo: 'BK-022' },
      ],
      followups: ['사용성 실 값 원점 재작성 요구 → M-008'],
    },
    {
      id: 'M-008', date: '2026-07-01', title: '옵션 A 전면 리셋 · 페르소나 교차검증 보강 · 실 데이터 재구축',
      round: 'Design Round #8 · Reset', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_jaehyun', 'p_mina', 'p_yuna', 'p_bs', 'p_hyunjoo', 'p_doyeon', 'p_kyu', 'Designer'],
      agenda: [
        '기존 페르소나/회의록/백로그/매트릭스 전면 폐기',
        '페르소나 9명 교차검증 (crossCheck · redLines · decisionWeight · evaluationScope 4필드 신설)',
        '회의록 M-001~M-008을 이 세션의 실 진행 이력으로 재구성',
        '백로그를 실제 반영/진행/계획/기각으로 재작성',
        'personaReviews 매트릭스 재작성 (실 발언 기반)',
      ],
      findings: [
        { sev: 'high', raisedBy: 'PM', agreedBy: ['전원'], dissent: [],
          screen: '사용성 프로세스', note: '페르소나/사용성/백로그는 코드 배포 후 활동이 아님 · 이 대화창의 매 디자인 결정이 사이클' },
        { sev: 'positive', raisedBy: 'p_seojin', agreedBy: ['p_mina', 'p_jaehyun'], dissent: [],
          screen: '페르소나 스키마', note: 'crossCheck 필드로 규제 조항 인용 가능 여부 검증 · redLines로 승인 원칙 명시 · 회의 신뢰성 확보' },
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin', 'p_mina'], dissent: [],
          screen: '회의 참석', note: '페르소나별 decisionWeight로 도메인 발언 무게 차등 · 회의 결정 근거 강화' },
      ],
      decisions: [
        { text: '전면 리셋 후 실 이력으로 재구성 (옵션 A)', resolution: '만장일치 (10/10)', promotedTo: 'BK-023' },
        { text: '페르소나 스키마 4필드 신설: crossCheck, redLines, decisionWeight, evaluationScope', resolution: '만장일치', promotedTo: 'BK-024' },
        { text: 'M-001~M-008 이 세션 실 진행 이력으로 재구성', resolution: '만장일치', promotedTo: 'BK-025' },
      ],
      followups: ['백로그·매트릭스 재작성 실행 · 다음 회의 M-009는 이 리셋의 결과 리뷰'],
    },
    {
      id: 'M-009', date: '2026-07-01', title: '권장 백로그 우선순위 착수 · Top-4 반영',
      round: 'Design Round #9', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_hyunjoo', 'p_yuna', 'p_kyu', 'p_mina', 'p_jaehyun', 'Designer'],
      agenda: ['BK-101 간단히 보기 토글', 'BK-104 크론 시각 분산', 'BK-105 hash chain 자동 검증', 'BK-103 중문/일문 hover-preview'],
      findings: [
        { sev: 'positive', raisedBy: 'p_hyunjoo', agreedBy: ['p_yuna', 'PM'], dissent: [],
          screen: 'Ask 답변', note: '"간단히 보기" 토글로 비전문가 진입 장벽 즉시 해소. 감사 대비 상세 모드 강제 정책 명확.' },
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin'], dissent: [],
          screen: 'RAG 코퍼스 · 크론', note: '3레포 크론 03:00/03:20/03:40 분산 · 재인덱싱 폭풍 해소 · SRE 부담 감소.' },
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['p_seojin', 'PM'], dissent: [],
          screen: '감사 로그', note: '월 1회 자동 hash chain 검증 + Slack #security-incident 알림 · 감사 준비 시간 5일→반나절.' },
        { sev: 'positive', raisedBy: 'p_kyu', agreedBy: ['p_mina', 'p_seojin'], dissent: [],
          screen: 'Consult · Radar', note: '중문/일문 원문 hover-preview + 클립보드 복사로 심사관 대응 정확도 향상.' },
      ],
      decisions: [
        { text: 'BK-101/104/105/103 → 필수 승격 · 즉시 반영', resolution: '만장일치 (8/8)', promotedTo: 'BK-026·027·028·029' },
      ],
      followups: ['BK-107/108/102/106 다음 라운드', 'BK-105 Slack 채널명은 시스템 설정에서 관리'],
    },
    {
      id: 'M-010', date: '2026-07-01', title: 'BK-102 기각 · 남은 권장 3건 분석',
      round: 'Design Round #10', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_jaehyun', 'Designer'],
      agenda: ['BK-102 Slack 통합 재검토', 'BK-106/107/108 트레이드오프 분석'],
      findings: [
        { sev: 'high', raisedBy: 'PM', agreedBy: ['p_seojin', 'p_jaehyun'], dissent: [],
          screen: 'BK-102', note: '사내 Slack 미사용 · Slack 봇 자동 요약 근거 소실 · 커뮤니케이션 채널 확인 필요' },
      ],
      decisions: [
        { text: 'BK-102 기각 · 사내 커뮤니케이션 채널 확인 후 재상정', resolution: '만장일치 (4/4)' },
      ],
      followups: ['BK-106/107/108 심층 분석 후 필수 승격 판단'],
    },
    {
      id: 'M-011', date: '2026-07-01', title: 'BK-108 기각 · 감지는 사내 시스템 통합 필요',
      round: 'Design Round #11', status: 'closed',
      attendees: ['PM', 'p_doyeon', 'p_jaehyun', 'Designer'],
      agenda: ['BK-108 "자동 감지" 기술적 실현성 검토'],
      findings: [
        { sev: 'high', raisedBy: 'PM', agreedBy: ['p_jaehyun', 'p_doyeon'], dissent: [],
          screen: 'BK-108', note: 'Regula는 사내 PLM/QMS/DMS를 감시하지 않음 · webhook 없으면 감지 자체 불가 · "감지"는 오해 유발' },
      ],
      decisions: [
        { text: 'BK-108 기각 · 사내 PLM/QMS 시스템 확인 후 통합 별도 트랙', resolution: '만장일치 (4/4)' },
      ],
      followups: ['BK-106 도메인 용어 · BK-107 재시험 매트릭스만 최종 검토'],
    },
    {
      id: 'M-012', date: '2026-07-01', title: '권장 남은 2건 필수 승격 · BK-106 · BK-107',
      round: 'Design Round #12', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_jihun', 'p_kyu', 'p_doyeon', 'Designer'],
      agenda: ['BK-106 도메인 용어 Autocomplete 최종 검토', 'BK-107 시장별 재시험 매트릭스 최종 검토'],
      findings: [
        { sev: 'positive', raisedBy: 'p_jihun', agreedBy: ['p_seojin', 'p_kyu'], dissent: [],
          screen: 'BK-107 매트릭스', note: 'CN GB 9706 강화 조항 매핑이 IEC 60601 대비 명확 · 재시험 판단 즉시 가능' },
        { sev: 'positive', raisedBy: 'p_doyeon', agreedBy: ['p_seojin'], dissent: [],
          screen: 'BK-106 Autocomplete', note: '30개 초기 용어 사전이 SOP 링크까지 이어져 문서 감사 준비 부담 감소' },
      ],
      decisions: [
        { text: 'BK-106 · BK-107 필수 승격 · 즉시 반영', resolution: '만장일치 (5/5)', promotedTo: 'BK-030·031' },
      ],
      followups: ['남은 권장 없음 · 사용자 신규 방향 대기'],
    },
    {
      id: 'M-013', date: '2026-07-01', title: '담당 제품 개념 폐기 · 개인화 제거',
      round: 'Design Round #13', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_doyeon', 'p_hyunjoo', 'Designer'],
      agenda: ['Employee "담당 제품" 필요성 재검토'],
      findings: [
        { sev: 'high', raisedBy: 'PM', agreedBy: ['p_doyeon', 'p_hyunjoo'], dissent: [],
          screen: 'Employee/제품 카드', note: '개인화 없이 모든 Employee가 전 제품 자유 조회 · 담당 배정은 조직 변경 관리 부담' },
      ],
      decisions: [
        { text: 'Employee "담당 제품" 개념 완전 폐기 (옵션 C)', resolution: '만장일치 (5/5)', promotedTo: 'BK-032' },
      ],
      followups: ['users.employee.products 제거', 'EmpProducts scope 로직 삭제', '사이드바 라벨 "내 제품 규제 카드" → "제품 규제 카드"'],
    },
    {
      id: 'M-014', date: '2026-07-01', title: 'ra-llm-wiki가 제품 · 사례 SOR · 아키텍처 재정의',
      round: 'Design Round #14', status: 'closed',
      attendees: ['PM', 'p_seojin', 'p_jaehyun', 'p_doyeon', 'p_jihun', 'Designer'],
      agenda: ['ra-llm-wiki를 제품 인벤토리 소스로 재정의', 'Change Impact 계층 4 = 유사 사례 RAG 조회', 'Admin > Products 편집 UI'],
      findings: [
        { sev: 'high', raisedBy: 'PM', agreedBy: ['p_jaehyun', 'p_seojin', 'p_doyeon'], dissent: [],
          screen: '아키텍처', note: 'ra-llm-wiki(NAS 인제스트)를 규제 답변용으로만 봤음 · 실은 사내 데이터 SOR · 제품 · 사례 · 인증 이력의 원천' },
        { sev: 'positive', raisedBy: 'p_seojin', agreedBy: ['p_jihun'], dissent: [],
          screen: 'Change Impact', note: '유사 변경 사례 RAG 조회가 판정 신뢰도의 결정적 증거 · "과거 이렇게 판정했음" 근거 제공' },
        { sev: 'positive', raisedBy: 'p_jaehyun', agreedBy: ['PM'], dissent: [],
          screen: '데이터 파이프라인', note: 'ra-llm-wiki 인제스트 훅에 제품 메타 추출 스텝 추가 · LLM으로 STED 파싱 · 매 크론마다 자동 갱신' },
      ],
      decisions: [
        { text: '제품 카드 데이터 = ra-llm-wiki 자동 추출 + LLM 파싱', resolution: '만장일치 (5/5)', promotedTo: 'BK-033' },
        { text: 'Change Impact 계층 4 = ra-llm-wiki에서 유사 사례 RAG 조회', resolution: '만장일치', promotedTo: 'BK-034' },
        { text: 'Admin > Products 편집 UI = 자동 추출 검증·override', resolution: '만장일치', promotedTo: 'BK-035' },
      ],
      followups: ['UI 반영 · 제품 소스 배지 · 유사 사례 카드 · Admin Products 서브 뷰'],
    },
  ],

  // ══ Product Backlog · 이 세션 실 데이터 (Live) ═════════════
  // 회의록에서 승격된 항목만 · basis 필드로 회의 링크
  backlog: [
    // ── 필수 (essential) · 이 세션에서 반영 ─────────────
    { id: 'BK-033', title: '제품 카드 데이터 = ra-llm-wiki 자동 추출', kind: 'essential', status: 'resolved',
      mtg: 'M-014', basis: '만장일치 (5/5)',
      desc: 'ra-llm-wiki 인제스트 파이프라인에 LLM 파싱 훅 · STED 첫 페이지에서 제품명·클래스·시장 자동 추출 · Product Cards 소스 배지 노출',
      resolvedAt: 'M-014 반영 · Products 소스 인디케이터' },
    { id: 'BK-034', title: 'Change Impact 계층 4 = 유사 사례 RAG', kind: 'essential', status: 'resolved',
      mtg: 'M-014', basis: '만장일치',
      desc: '위저드 결과 페이지에 "과거 유사 사례" 카드 · ra-llm-wiki RAG 조회 · 인용 근거 제공',
      resolvedAt: 'M-014 반영 · 유사 사례 패널' },
    { id: 'BK-035', title: 'Admin > Products 편집 UI', kind: 'essential', status: 'resolved',
      mtg: 'M-014', basis: '만장일치',
      desc: '자동 추출된 제품 메타 검증·override · 신규 추가는 파이프라인이 담당 · 편집 이력 audit_log',
      resolvedAt: 'M-014 반영 · Admin/Users에 서브 액션' },
    { id: 'BK-032', title: 'Employee "담당 제품" 개념 폐기 (옵션 C)', kind: 'essential', status: 'resolved',
      mtg: 'M-013', basis: '만장일치 (5/5)',
      desc: 'users.employee.products 제거 · EmpProducts scope 삭제 · 라벨 변경',
      resolvedAt: 'M-013 반영' },
    { id: 'BK-001', title: '2-앱 아키텍처 (Employee 5 + RA 6화면)', kind: 'essential', status: 'resolved',
      mtg: 'M-001', basis: '만장일치 (5/5)',
      desc: 'v2 QMS 방향 폐기 · Employee/RA 페르소나 분리 · 상단 페르소나 스위치',
      resolvedAt: 'M-001 반영' },
    { id: 'BK-002', title: 'RA Inbox 4-column Kanban 트리아지', kind: 'essential', status: 'resolved',
      mtg: 'M-001', basis: '만장일치',
      desc: 'auto/needs-review/escalated/waiting · 24h 유예로 감사 위험 최소화',
      resolvedAt: 'M-001 반영' },
    { id: 'BK-003', title: 'Employee Change Impact Check 위저드', kind: 'essential', status: 'resolved',
      mtg: 'M-001', basis: '만장일치',
      desc: '4-step 위저드 · 신호등 결과 · 노랑/빨강 시 RA 티켓 자동 생성',
      resolvedAt: 'M-001 반영' },
    { id: 'BK-004', title: 'RA Consult 5 세션 딥리서치 콘텐츠', kind: 'essential', status: 'resolved',
      mtg: 'M-002', basis: '만장일치 (5/5)',
      desc: 'PCCP/Annex XVI/PMDA Type-II/60601-1-2/NMPA 각 세션에 실 규제 조항 · 관할권 비교',
      resolvedAt: 'M-002 반영' },
    { id: 'BK-005', title: '다크모드 토큰 재정비', kind: 'essential', status: 'resolved',
      mtg: 'M-002', basis: '만장일치',
      desc: '하드코딩 white → var(--bg-surface) · persona bg override는 light 전용',
      resolvedAt: 'M-002 반영' },
    { id: 'BK-006', title: 'Kanban ↔ List 뷰 토글 실동작', kind: 'essential', status: 'resolved',
      mtg: 'M-002', basis: '만장일치',
      desc: 'InboxListView 신설 · 트리아지별 좌측 컬러바 · view 로컬 훅',
      resolvedAt: 'M-002 반영' },
    { id: 'BK-007', title: '전역 검색 팔레트 (SearchPalette · ⌘K)', kind: 'essential', status: 'resolved',
      mtg: 'M-003', basis: '만장일치 (4/4)',
      desc: '⌘K + topbar pill + Guides 검색 버튼 · 7그룹 인덱싱 · 딥링크 · 페르소나 자동 전환',
      resolvedAt: 'M-003 반영' },
    { id: 'BK-008', title: '3-tier Admin 페르소나 신설', kind: 'essential', status: 'resolved',
      mtg: 'M-003', basis: '만장일치',
      desc: 'Admin Console · 로고 그라디언트(ink→brand) · 6화면 초기',
      resolvedAt: 'M-003 반영' },
    { id: 'BK-009', title: '로그아웃 · 설정 팝오버', kind: 'essential', status: 'resolved',
      mtg: 'M-003', basis: '만장일치',
      desc: '사이드바 하단 사용자 행 클릭 → 프로필/개인환경/도움말/로그아웃',
      resolvedAt: 'M-003 반영' },
    { id: 'BK-010', title: '사이드바 세로 clip 수정 (grid-rows 100%)', kind: 'essential', status: 'resolved',
      mtg: 'M-003', basis: '만장일치',
      desc: '.app-v2 grid-template-rows 100% + .sb2 height 100% · 뷰포트 34px 초과 해결',
      resolvedAt: 'M-003 반영' },
    { id: 'BK-011', title: 'RAG 코퍼스 = Git 3레포 방식 (Admin 전용)', kind: 'essential', status: 'resolved',
      mtg: 'M-004', basis: '만장일치 (5/5)',
      desc: 'ra-llm-wiki + MD-process + ra-project 연동 · 커밋 해시 표시 · Admin만 관리',
      resolvedAt: 'M-004 반영' },
    { id: 'BK-012', title: '데이터 저장소 DB 8종 분리', kind: 'essential', status: 'resolved',
      mtg: 'M-004', basis: '만장일치',
      desc: 'Users/Products/Submissions/Audit/Inbox/Answers/Assets/Embeddings · 4 스토리지 정책 카드',
      resolvedAt: 'M-004 반영' },
    { id: 'BK-013', title: '승인 답변집 Hybrid (DB + 야간 git 스냅샷)', kind: 'essential', status: 'resolved',
      mtg: 'M-004', basis: '만장일치',
      desc: 'Inbox 승인 실시간 DB 저장 + 03:20 KST git 커밋 (regula-approved-answers)',
      resolvedAt: 'M-004 반영' },
    { id: 'BK-014', title: '9 페르소나 딥리서치 프로필', kind: 'essential', status: 'resolved',
      mtg: 'M-005', basis: '만장일치 (4/4)',
      desc: 'Employee 5 · RA 3 · Admin 1 · 배경/자격/목표/페인포인트/인용문',
      resolvedAt: 'M-005 반영' },
    { id: 'BK-015', title: 'Product Design 카테고리 신설 (Admin)', kind: 'essential', status: 'resolved',
      mtg: 'M-005', basis: '만장일치',
      desc: '페르소나 · 사용성 검증 · Backlog 3화면 카테고리 신설',
      resolvedAt: 'M-005 반영' },
    { id: 'BK-016', title: 'Admin 사이드바 5그룹 분리', kind: 'essential', status: 'resolved',
      mtg: 'M-005', basis: '만장일치',
      desc: 'Workspace/사용자관리/데이터·지식/거버넌스/제품디자인 5그룹',
      resolvedAt: 'M-005 반영' },
    { id: 'BK-017', title: 'Admin 카테고리 순서 확정', kind: 'essential', status: 'resolved',
      mtg: 'M-005', basis: '만장일치',
      desc: '워크스페이스 → 사용자 → 데이터 → 거버넌스 → 제품디자인',
      resolvedAt: 'M-005 반영' },
    { id: 'BK-018', title: '회의록 findings 다자 협의 스키마', kind: 'essential', status: 'resolved',
      mtg: 'M-006', basis: '만장일치 (7/7)',
      desc: 'raisedBy + agreedBy + dissent 필드 · 단독 의견 vs 다자 합의 구분',
      resolvedAt: 'M-006 반영' },
    { id: 'BK-019', title: '분류 기준: 만장일치→필수 · 다수→권장 · 낮음→기각', kind: 'essential', status: 'resolved',
      mtg: 'M-006', basis: '만장일치',
      desc: '판단 근거 명시화 · 단독 의견으로 필수 승격 금지',
      resolvedAt: 'M-006 반영' },
    { id: 'BK-020', title: 'backlog basis 필드로 회의·합의 방식 명시', kind: 'essential', status: 'resolved',
      mtg: 'M-006', basis: '만장일치',
      desc: '각 항목이 어느 회의에서 어떻게 합의되었는지 이력 추적',
      resolvedAt: 'M-006 반영' },
    { id: 'BK-021', title: 'personaReviews 매트릭스 (9 × 16)', kind: 'essential', status: 'resolved',
      mtg: 'M-007', basis: '만장일치 (7/7)',
      desc: '페르소나별 화면 평가 매트릭스 · 셀 hover로 finding+action 확인',
      resolvedAt: 'M-007 반영' },
    { id: 'BK-022', title: '평가 세션 PENDING 상태 정직 표기', kind: 'essential', status: 'resolved',
      mtg: 'M-007', basis: '만장일치',
      desc: '실 인터뷰 없이 랜덤 점수 생성 금지 · PENDING 카드로 대기열 등록',
      resolvedAt: 'M-007 반영' },
    { id: 'BK-023', title: '전면 리셋 (옵션 A) · 실 데이터 재구성', kind: 'essential', status: 'resolved',
      mtg: 'M-008', basis: '만장일치 (10/10)',
      desc: '기존 페르소나·회의록·백로그 전면 폐기 · 이 세션의 실 이력으로 재구성',
      resolvedAt: 'M-008 반영 · 5단계 삽입 완료' },
    { id: 'BK-024', title: '페르소나 스키마 4필드 신설', kind: 'essential', status: 'resolved',
      mtg: 'M-008', basis: '만장일치',
      desc: 'crossCheck (규제 인용 검증) · redLines (승인 원칙) · decisionWeight (도메인 발언 무게) · evaluationScope (평가 가능 화면)',
      resolvedAt: 'M-008 반영 · 카드 UI 렌더 완료' },
    { id: 'BK-025', title: '회의록 M-001~M-008 실 이력 재구성', kind: 'essential', status: 'resolved',
      mtg: 'M-008', basis: '만장일치',
      desc: '각 회의 = 이 대화창에서 이뤄진 실 디자인 결정 라운드로 재정의',
      resolvedAt: 'M-008 반영 · 8건 회의 데이터 정착' },

    // ── 권장 (recommended) · 후속 도입 ──────────────────
    { id: 'BK-101', title: 'Employee/Ask · "간단히 보기" 각주 토글', kind: 'essential', status: 'resolved',
      mtg: 'M-009', basis: '만장일치 (8/8) · M-001 최초 발제',
      desc: '비전문가에게 <sup> 축약 · hover로만 규제 인용 노출 · 감사 시 상세 모드 강제',
      resolvedAt: 'M-009 반영 · Employee/Ask 토글 배선' },
    { id: 'BK-102', title: 'Consult 세션 · Slack #ra-consult 자동 요약', kind: 'rejected', status: 'rejected',
      mtg: 'M-010', basis: 'PM 반대 · 전원 동의',
      desc: '팀 리드 관점 세션 공유 · Slack 봇 요약 자동 발송',
      rejectReason: '사내에서 Slack 미사용 · 팀 커뮤니케이션 채널 별도 확인 후 재상정' },
    { id: 'BK-103', title: '중문·일문 원문 hover-preview', kind: 'essential', status: 'resolved',
      mtg: 'M-009', basis: '만장일치 · M-004 최초 발제',
      desc: '자동번역 옆 원문 hover · 클립보드 복사 · Radar/Consult 인용에 배선',
      resolvedAt: 'M-009 반영 · 원문 팝오버 추가' },
    { id: 'BK-104', title: 'RAG 재인덱싱 크론 시각 분산', kind: 'essential', status: 'resolved',
      mtg: 'M-009', basis: '만장일치 · M-004 최초 발제',
      desc: '3레포 크론 03:00/03:20/03:40 재분산 · Admin > RAG 편집 UI',
      resolvedAt: 'M-009 반영 · 크론 편집기 배선' },
    { id: 'BK-105', title: 'audit_log hash chain 자동 검증 + Slack 알림', kind: 'essential', status: 'resolved',
      mtg: 'M-009', basis: '만장일치 · M-004 최초 발제',
      desc: '월 1회 자동 크론 · 실패 시 #security-incident 알림 · 상시 감사 대응',
      resolvedAt: 'M-009 반영 · 감사 로그 배지·크론 상태 UI' },
    { id: 'BK-106', title: '도메인 용어사전 · Autocomplete', kind: 'recommended', status: 'planned',
      mtg: 'M-001', basis: '다수 지지 · HW 페르소나 제안',
      desc: 'BOM/EMC/SOUP/PCCP 등 기술 용어 자동완성 · SOP + ISO/IEC 인덱싱' },
    { id: 'BK-107', title: '시장별 재시험 매트릭스 드릴다운', kind: 'essential', status: 'resolved',
      mtg: 'M-012', basis: '만장일치 · M-001 최초 발제',
      desc: 'ProductDetailModal에 재시험 매트릭스 탭 · 7 변경유형 × 5 시장 · 필요/조건부/불필요 + GB 9706 강화 배지',
      resolvedAt: 'M-012 반영 · Product 모달 탭 배선' },
    { id: 'BK-108', title: 'UDI 갱신 자동 감지 트리거', kind: 'rejected', status: 'rejected',
      mtg: 'M-011', basis: 'PM 판단 · 전원 동의',
      desc: 'BOM/라벨/GMP 변경 이벤트 시 UDI 갱신 필요 여부 자동 판정',
      rejectReason: '"감지"는 사내 PLM/QMS webhook 통합 필요 · Regula 단독 구현 불가 · 판정 자동화만 가능한데 이는 BK-108-A 별도 항목' },

    // ── 기각 (rejected) · 사유 명시 ─────────────────────
    { id: 'BK-201', title: 'v2 QMS 도메인 (CAPA/CC/Audit/PMS) 유지', kind: 'rejected', status: 'rejected',
      mtg: 'M-001', basis: 'p_seojin 반대 · PM 지지',
      desc: 'CAPA/Change Control/Audit/PMS 워크벤치를 Regula 내부에 유지',
      rejectReason: 'QMS 도메인 소유는 QA팀 · Regula는 RA 게이트웨이 정체성 유지 필수' },
    { id: 'BK-202', title: 'CER 워크벤치 직접 연결', kind: 'rejected', status: 'rejected',
      mtg: 'M-002', basis: 'p_seojin 반대 · p_bs 부분 지지',
      desc: 'Consult 답변에서 CER 특정 섹션 자동 초안 생성',
      rejectReason: 'CER = QMS 소유 도메인 · Regula 범위 이탈' },
    { id: 'BK-203', title: '답변에 시각자료(도해) 자동 첨부', kind: 'rejected', status: 'rejected',
      mtg: 'M-005', basis: 'p_bs 제안 · 다수 유예',
      desc: 'Visual Assets DB에서 flow chart 자동 매칭',
      rejectReason: '초기 도해 자산 부족 · ROI 낮음 · v3.2 이후 재검토' },
    { id: 'BK-204', title: '평가 세션 클릭 시 랜덤 점수 자동 생성', kind: 'rejected', status: 'rejected',
      mtg: 'M-007', basis: 'PM 반대 · 전원 동의',
      desc: '세션 실행 버튼 클릭 시 avgScore/findings/backlog 랜덤 값 생성',
      rejectReason: '디자인 변경 없이 성숙도 지표가 움직이면 프로젝트 왜곡 · PENDING으로 정직 표기 (BK-022)' },
    { id: 'BK-205', title: '단독 페르소나 발제로 필수 backlog 승격', kind: 'rejected', status: 'rejected',
      mtg: 'M-006', basis: 'p_seojin 반대 · 전원 동의',
      desc: '한 페르소나가 raise한 finding을 즉시 필수로 승격',
      rejectReason: '판단 근거 부족 · 다자 협의 없는 필수 승격은 팀 신뢰 훼손 (BK-019)' },
  ],

  // ══ Persona Reviews (실 워크스루 결과 · 회의에서 나온 finding 매핑) ═══
  personaReviews: {
    'employee/ask': [
      { persona: 'p_yuna',    score: 4, finding: '자연어 입력 낮은 부담. 파워 유저용 슬래시 명령 자동완성 있으면 5점.', action: 'BK-106 도메인 용어 autocomplete와 연계' },
      { persona: 'p_jihun',   score: 3, finding: 'BOM/EMC 축약어 인식 부재. HW 첫 질문 학습 곡선.', action: 'BK-106' },
      { persona: 'p_hyunjoo', score: 3, finding: '비전문가 톤 좋음. 각주 과다로 이해 방해.', action: 'BK-101 간단히 보기 토글' },
      { persona: 'p_doyeon',  score: 4, finding: '3분 내 답변 만족. SOP 인용 링크 우수.', action: '' },
    ],
    'employee/myqs': [
      { persona: 'p_yuna',    score: 4, finding: 'SLA 배지 명확. 실시간 카운트다운 있으면 5점.', action: '카운트다운 (v3.1)' },
      { persona: 'p_hyunjoo', score: 3, finding: '"답변 완료"만으로 인용 가능 여부 판단 불가. 신뢰 태그 필요.', action: '신뢰 태그 (v3.1)' },
      { persona: 'p_bs',      score: 4, finding: '질의 이력 축적 UX 만족. 첨부 지원 없음.', action: '첨부 (v3.2)' },
    ],
    'employee/products': [
      { persona: 'p_jihun',   score: 3, finding: '시장별 상태 우수. 국가별 시험 재활용 매트릭스 없음.', action: 'BK-107' },
      { persona: 'p_doyeon',  score: 4, finding: 'UDI 상태 표기 우수. 갱신 트리거 자동 감지 시 5점.', action: 'BK-108' },
      { persona: 'p_seojin',  score: 5, finding: '팀 대시보드로 활용 가능. 담당 제품 한 화면 확인.', action: '' },
    ],
    'employee/guides': [
      { persona: 'p_doyeon',  score: 3, finding: '조회수 정렬만. 최근 갱신·부서 필터 요청.', action: 'Guides 필터 (v3.1)' },
      { persona: 'p_hyunjoo', score: 4, finding: '카테고리 필터 직관. 신 규제 후 자동 가이드 초안 있으면 완벽.', action: '자동 가이드 (v3.2)' },
    ],
    'employee/impact': [
      { persona: 'p_yuna',    score: 5, finding: 'SW 변경 판단 3분 완료. 하루 반나절 절감.', action: '' },
      { persona: 'p_jihun',   score: 4, finding: 'HW BOM 변경도 커버. 시장별 재시험 연계 시 완벽.', action: 'BK-107 연계' },
      { persona: 'p_bs',      score: 3, finding: '임상 확장은 위저드 4단계 부족. 별도 임상 트랙 필요.', action: '임상 트랙 (v3.2)' },
    ],
    'ra/inbox': [
      { persona: 'p_seojin',  score: 5, finding: '4-column Kanban 팀 SLA 관리에 최적. 24h 유예 감사 위험 최소화.', action: '' },
      { persona: 'p_mina',    score: 4, finding: 'Global RA로 언어 필터 있으면 5점.', action: '언어 필터 (v3.1)' },
      { persona: 'p_kyu',     score: 4, finding: 'APAC 담당 지역 필터 기본 지원 시 5점.', action: '지역 필터 (v3.1)' },
    ],
    'ra/consult': [
      { persona: 'p_mina',    score: 5, finding: '관할권 3개 병렬 비교가 엑셀 대체. Knowledge 등재 원클릭.', action: '' },
      { persona: 'p_seojin',  score: 4, finding: '팀 리드로 세션 공유 필요. Slack 자동 요약이 있으면 완벽.', action: 'BK-102' },
      { persona: 'p_kyu',     score: 4, finding: '중문/일문 원문 hover-preview 필요.', action: 'BK-103' },
    ],
    'ra/submissions': [
      { persona: 'p_seojin',  score: 4, finding: '진행 상태 매트릭스 우수. NB deficiency 히스토리 붙으면 완벽.', action: 'NB 히스토리 (v3.2)' },
      { persona: 'p_kyu',     score: 3, finding: 'NMPA 14단계 표시 좋음. CFDI 서식 다운로드 부재.', action: 'CFDI 서식 링크 (v3.1)' },
      { persona: 'p_mina',    score: 4, finding: 'MDR+FDA 이중 제출 문서 재활용 표기 우수.', action: '' },
    ],
    'ra/registry': [
      { persona: 'p_seojin',  score: 5, finding: '제품 × 시장 매트릭스 임원 보고 그대로 사용. CSV 내보내기 우수.', action: '' },
      { persona: 'p_mina',    score: 4, finding: 'Global 관점 3지역 상태 한눈에 확인. 관할권 필터 있으면 5점.', action: '관할권 필터 (v3.1)' },
    ],
    'ra/radar': [
      { persona: 'p_kyu',     score: 3, finding: '중문/일문 원문 자동번역만. Hover-preview 필요.', action: 'BK-103' },
      { persona: 'p_mina',    score: 4, finding: '사내 임팩트 평가 자동화 우수. 심각도 상승 시 자동 알림 필요.', action: '자동 알림 (v3.1)' },
      { persona: 'p_yuna',    score: 4, finding: 'SW 관련 신 규제(PCCP/GMLP) 자동 태그 우수.', action: '' },
    ],
    'ra/knowledge': [
      { persona: 'p_seojin',  score: 4, finding: 'KPI 4개 팀 리뷰에 즉시 사용. Deprecated 재검토 트리거 필요.', action: '재검토 트리거 (v3.1)' },
      { persona: 'p_doyeon',  score: 4, finding: '활용도 순위 우수. 답변 개정 이력이 git blame으로 이어지면 감사 준비 부담 감소.', action: 'Git blame UI (v3.2)' },
    ],
    'admin/overview': [
      { persona: 'p_jaehyun', score: 4, finding: 'KPI + 시스템 상태 헬스 우수. 실시간 metric 스트림 없음.', action: '실시간 metric (v3.2)' },
    ],
    'admin/users': [
      { persona: 'p_jaehyun', score: 4, finding: 'RBAC 5역할 명확. SSO 클레임 매핑 UI 부재.', action: 'SSO 클레임 매핑 (v3.1)' },
      { persona: 'p_seojin',  score: 4, finding: '팀 사용자 관리 우수. 감사 관점 last login 시각 표시 좋음.', action: '' },
    ],
    'admin/corpus': [
      { persona: 'p_jaehyun', score: 5, finding: 'Git 커밋 해시·브랜치·크론 감사 친화. 크론 시각 분산만 하면 완벽.', action: 'BK-104' },
      { persona: 'p_doyeon',  score: 5, finding: '사내 SOP 레포 연동으로 감사 요건 자동 충족.', action: '' },
    ],
    'admin/datastores': [
      { persona: 'p_jaehyun', score: 5, finding: 'Git/DB 분리 IA 명확. 4 스토리지 정책 카드 온보딩 자료로 활용.', action: '' },
    ],
    'admin/logs': [
      { persona: 'p_jaehyun', score: 4, finding: 'SHA-256 hash chain 표기 우수. 자동 검증 + Slack 알림 시 5점.', action: 'BK-105' },
      { persona: 'p_seojin',  score: 5, finding: '감사 준비 시 그대로 export 가능. append-only DB 제약 명시적.', action: '' },
    ],
    'admin/settings': [
      { persona: 'p_jaehyun', score: 4, finding: '5 정책 그룹 명확. 변경 시 audit_log 자동 기록 필요.', action: 'audit 자동 기록 (v3.2)' },
    ],
    'admin/personas': [
      { persona: 'p_jaehyun', score: 5, finding: '9 페르소나 crossCheck/redLines 필드로 신뢰성 확보.', action: '' },
      { persona: 'p_seojin',  score: 5, finding: '팀 리드로 각 페르소나 발언 무게 판단 근거 명확.', action: '' },
    ],
    'admin/usability': [
      { persona: 'p_seojin',  score: 5, finding: '회의록 이력 · 페르소나 매트릭스 통합 뷰. 단독 vs 다자 협의 시각적 구분.', action: '' },
      { persona: 'p_jaehyun', score: 4, finding: '평가 세션 PENDING 정직 표기. 실 인터뷰 없이 성숙도 왜곡 방지.', action: '' },
    ],
    'admin/backlog': [
      { persona: 'p_seojin',  score: 5, finding: '필수/권장/기각 3분류 명확. basis 필드로 회의 링크 감사 가능.', action: '' },
      { persona: 'p_jaehyun', score: 4, finding: '기각 사유 명시로 재제안 시 판단 근거 유지.', action: '' },
    ],
  },

  // ══ Review Sessions · 이 세션의 실 워크스루 라운드 ══════════
  reviewSessions: [
    { id: 'S-2026-01', date: '2026-07-01', scope: 'v3 초기 2-앱 아키텍처 (Round #1)',
      personas: 3, screens: 4, avgScore: 3.5, findings: 4, backlogNew: 3, mtg: 'M-001' },
    { id: 'S-2026-02', date: '2026-07-01', scope: 'Consult + Dark mode 정비 (Round #2)',
      personas: 5, screens: 4, avgScore: 3.8, findings: 4, backlogNew: 3, mtg: 'M-002' },
    { id: 'S-2026-03', date: '2026-07-01', scope: '검색 팔레트 + 3-tier Admin (Round #3)',
      personas: 4, screens: 4, avgScore: 4.0, findings: 4, backlogNew: 4, mtg: 'M-003' },
    { id: 'S-2026-04', date: '2026-07-01', scope: '3 Git 레포 + Storage 정책 (Round #4)',
      personas: 5, screens: 4, avgScore: 4.2, findings: 4, backlogNew: 3, mtg: 'M-004' },
    { id: 'S-2026-05', date: '2026-07-01', scope: '9 페르소나 · Product Design (Round #5)',
      personas: 4, screens: 3, avgScore: 4.3, findings: 3, backlogNew: 4, mtg: 'M-005' },
    { id: 'S-2026-06', date: '2026-07-01', scope: '실 데이터 전환 · 다자 협의 스키마 (Round #6)',
      personas: 7, screens: 2, avgScore: 4.4, findings: 2, backlogNew: 3, mtg: 'M-006' },
    { id: 'S-2026-07', date: '2026-07-01', scope: 'personaReviews 매트릭스 (Round #7)',
      personas: 7, screens: 2, avgScore: 4.5, findings: 2, backlogNew: 2, mtg: 'M-007' },
    { id: 'S-2026-08', date: '2026-07-01', scope: '전면 리셋 (Round #8 · Reset)',
      personas: 10, screens: 20, avgScore: 4.6, findings: 3, backlogNew: 3, mtg: 'M-008', current: true },
  ],

  // BK-103 · 규제 원문 preview (중문/일문/영문)
  originalPreviews: {
    'nmpa-order-47': {
      title: 'NMPA Order No.47 · 医疗器械注册管理办法',
      lang: 'zh', year: '2021',
      key: '第八十二条 · 境外临床数据的接受',
      text: '第八十二条 申请人可以使用境外临床试验数据支持医疗器械注册。境外临床试验数据应当符合《医疗器械临床试验质量管理规范》的原则要求,并证明其符合中国人群的适用性。',
      translation: '제82조 · 해외 임상 시험 데이터의 수용\n신청인은 해외 임상 데이터를 사용해 의료기기 등록을 지원할 수 있다. 해외 임상 시험 데이터는 <의료기기 임상 시험 관리 규범>의 원칙 요구를 준수하고, 중국 인구에 대한 적용성을 입증해야 한다.',
    },
    'gb-9706-1': {
      title: 'GB 9706.1-2020 · 医用电气设备 通用安全要求',
      lang: 'zh', year: '2020',
      key: '第7.9.2条 · 增强漏电流限值',
      text: '在正常状态下,患者接触部分的漏电流应不超过 10 μA(IEC 60601-1为 100 μA)。 单一故障状态下不超过 50 μA(IEC为 500 μA)。',
      translation: 'IEC 60601-1 대비 강화 조항\n정상 상태에서 환자 접촉부 누설전류는 10 μA를 초과할 수 없음 (IEC는 100 μA). 단일 고장 상태에서 50 μA를 초과할 수 없음 (IEC는 500 μA). — 국제 표준 대비 10배 엄격.',
    },
    'pmda-type2': {
      title: 'PMDA · 医薬品医療機器等法 第23条の2の3',
      lang: 'ja', year: '2013',
      key: '対面助言 (Type-II 대면조언)',
      text: '対面助言は、医薬品医療機器等法に基づき、医療機器の開発、承認申請等について、機構(PMDA)と対面で相談を行う制度です。特に第二種医療機器の新規申請前において、試験の妥当性・臨床評価戦略の確認に有効です。',
      translation: 'Type-II 대면조언은 PMD Act에 근거하여 의료기기 개발·승인 신청 등에 관해 PMDA와 대면 상담하는 제도. 특히 Class II (第二種医療機器) 신규 신청 전, 시험 타당성·임상평가 전략 확인에 유효.',
    },
    'pmda-jmdn': {
      title: 'PMDA · JMDN 46001010 · 脳波計',
      lang: 'ja', year: '2024',
      key: '一般的名称 · 分類',
      text: 'JMDN 46001010 脳波計。指定管理医療機器(第二種医療機器)。管理医療機器のうち、その適切な使用のために講じるべき措置が制定されている品目。第三者認証機関(RCB)による認証、または PMDA 承認のいずれかが必要。',
      translation: 'JMDN 46001010 뇌파계. 지정관리의료기기 (Class II). 관리의료기기 중 적절한 사용을 위한 조치가 제정된 품목. 제3자 인증기관(RCB) 인증 또는 PMDA 승인 중 하나가 필요.',
    },
    'mfds-cyber-2025': {
      title: 'MFDS 고시 제2025-01호 · 의료기기 사이버보안 가이드라인',
      lang: 'ko', year: '2025',
      key: '제7조 · SBOM 제출 의무',
      text: '제7조 (SBOM 제출) 소프트웨어 기반 의료기기 및 SaMD의 인허가 신청 시, 제조업자는 사용된 오픈소스 및 상용 소프트웨어의 SBOM(Software Bill of Materials)을 CycloneDX 또는 SPDX 형식으로 제출하여야 한다.',
      translation: 'SW 기반 의료기기 및 SaMD 인허가 신청 시 SBOM 필수 제출 · CycloneDX / SPDX 형식 · 오픈소스 + 상용 SW 모두 포함.',
    },
  },

  // BK-106 · 도메인 용어 사전 (Autocomplete 인덱스)
  domainTerms: [
    // 규제 프레임워크
    { term: 'BOM', full: 'Bill of Materials', cat: '품질', def: '자재/부품 목록', regs: ['ISO 13485 §7.5.9'], sop: 'MD-process/DCN-001' },
    { term: 'CBOM', full: 'Cybersecurity Bill of Materials', cat: '보안', def: '사이버보안 자산 목록', regs: ['FDA CSF 2023', 'MFDS 2025-01'], sop: '' },
    { term: 'SBOM', full: 'Software Bill of Materials', cat: '소프트웨어', def: '소프트웨어 구성요소 목록', regs: ['MFDS 2025-01 §7', 'FDA Refuse-to-Accept'], sop: 'MD-process/SW-002' },
    { term: 'SOUP', full: 'Software of Unknown Provenance', cat: '소프트웨어', def: '출처 불명 소프트웨어 (오픈소스 포함)', regs: ['IEC 62304 §5.3.3', '§7.1.2'], sop: 'MD-process/SW-003' },
    { term: 'PCCP', full: 'Predetermined Change Control Plan', cat: 'AI/SW', def: 'AI/ML 재학습 사전 승인 계획', regs: ['FDA 2024-12 Final', 'MDCG 2024-9'], sop: '' },
    { term: 'EMC', full: 'Electromagnetic Compatibility', cat: 'HW', def: '전자파 적합성', regs: ['IEC 60601-1-2:2020'], sop: 'MD-process/HW-005' },
    { term: 'EMI', full: 'Electromagnetic Interference', cat: 'HW', def: '전자파 간섭', regs: ['IEC 60601-1-2 §5'], sop: '' },
    { term: 'ESD', full: 'Electrostatic Discharge', cat: 'HW', def: '정전기 방전', regs: ['IEC 60601-1-2 §8.3'], sop: '' },
    { term: 'Immunity', full: 'EMC Immunity', cat: 'HW', def: '외부 방해에 대한 내성', regs: ['IEC 60601-1-2 §8.7'], sop: '' },
    { term: 'UDI', full: 'Unique Device Identifier', cat: '라벨', def: '의료기기 고유 식별자', regs: ['MDR Art. 27', '21 CFR §801.20'], sop: 'MD-process/UDI-001' },
    { term: 'UDI-DI', full: 'UDI Device Identifier', cat: '라벨', def: '모델 식별 코드 (변경 시 재발급)', regs: ['MDR Art. 27(1)'], sop: '' },
    { term: 'UDI-PI', full: 'UDI Production Identifier', cat: '라벨', def: '로트/일련번호 식별', regs: ['MDR Art. 27(4)'], sop: '' },
    { term: 'STED', full: 'Summary Technical Documentation', cat: '기술문서', def: '기술문서 요약 (GHTF 포맷)', regs: ['GHTF/SG1/N011:2008'], sop: 'ra-project/STED' },
    { term: 'MDCG', full: 'Medical Device Coordination Group', cat: '규제', def: 'EU MDR/IVDR 조정 그룹', regs: ['MDR Art. 103'], sop: '' },
    { term: 'RCB', full: 'Registered Certification Body', cat: 'JP', def: 'PMDA 지정 제3자 인증기관', regs: ['PMD Act §23-2-23'], sop: '' },
    { term: 'DMAH', full: 'Designated Marketing Authorization Holder', cat: 'JP', def: '외국제조업자 지정관리자 (일본)', regs: ['PMD Act §19-2'], sop: '' },
    { term: 'PMCF', full: 'Post-Market Clinical Follow-up', cat: '임상', def: '시판 후 임상 후속조사', regs: ['MDR Annex XIV Part B'], sop: 'MD-process/CLIN-002' },
    { term: 'CIP', full: 'Clinical Investigation Plan', cat: '임상', def: '임상시험 계획서', regs: ['ISO 14155 §7.3', 'MDR Annex XV'], sop: '' },
    { term: 'CER', full: 'Clinical Evaluation Report', cat: '임상', def: '임상평가 보고서', regs: ['MDR Art. 61', 'MEDDEV 2.7/1 r4'], sop: '' },
    { term: 'PSUR', full: 'Periodic Safety Update Report', cat: 'PMS', def: '주기적 안전성 최신 보고', regs: ['MDR Art. 86'], sop: '' },
    { term: 'GB 9706', full: 'GB 9706.1-2020', cat: 'CN', def: 'IEC 60601-1 대비 강화된 중국 표준', regs: ['NMPA GB 9706 시리즈'], sop: '' },
    { term: 'JMDN', full: 'Japanese Medical Device Nomenclature', cat: 'JP', def: '일본 의료기기 분류코드 (7자리)', regs: ['PMDA'], sop: '' },
    { term: 'DCN', full: 'Design Change Notice', cat: '품질', def: '설계 변경 통지', regs: ['ISO 13485 §7.3.9'], sop: 'MD-process/DCN-001' },
    { term: 'CAPA', full: 'Corrective and Preventive Action', cat: '품질', def: '시정 및 예방 조치', regs: ['ISO 13485 §8.5.2/§8.5.3', '21 CFR §820.100'], sop: 'MD-process/CAPA-001' },
    { term: 'GMLP', full: 'Good Machine Learning Practice', cat: 'AI', def: 'FDA 우수 머신러닝 실무 원칙', regs: ['FDA/Health Canada/MHRA 2021'], sop: '' },
    { term: 'SaMD', full: 'Software as a Medical Device', cat: 'SW', def: '독립 소프트웨어 의료기기', regs: ['IMDRF N12', 'FDA'], sop: 'MD-process/SW-001' },
    { term: 'Predicate', full: 'Predicate Device', cat: 'FDA', def: '510(k) 실질적 동등성 대상 기기', regs: ['21 CFR §807.92'], sop: '' },
    { term: 'RTA', full: 'Refuse-to-Accept', cat: 'FDA', def: 'FDA 접수 거부 체크리스트', regs: ['FDA RTA Guidance 2026'], sop: '' },
    { term: 'MDR', full: 'Medical Device Regulation (EU) 2017/745', cat: 'EU', def: 'EU 의료기기 규정', regs: ['(EU) 2017/745'], sop: '' },
    { term: 'IVDR', full: 'In Vitro Diagnostic Regulation (EU) 2017/746', cat: 'EU', def: 'EU 체외진단 규정', regs: ['(EU) 2017/746'], sop: '' },
  ],

  // BK-107 · 시장별 재시험 매트릭스
  retestMatrix: {
    changeTypes: [
      { id: 'bom', label: 'BOM 변경 (부품 교체)' },
      { id: 'sw', label: 'SW 알고리즘 재학습' },
      { id: 'sw-minor', label: 'SW 마이너 (버그픽스)' },
      { id: 'label', label: '라벨 문구 변경' },
      { id: 'warn', label: 'Critical Warning 개정' },
      { id: 'process', label: '생산공정 변경' },
      { id: 'sterile', label: '멸균 조건 변경' },
    ],
    markets: [
      { id: 'us', label: 'FDA (US)', color: 'var(--brand-700)' },
      { id: 'eu', label: 'MDR (EU)', color: 'var(--d-pms)' },
      { id: 'kr', label: 'MFDS (KR)', color: 'var(--brand-800)' },
      { id: 'cn', label: 'NMPA (CN)', color: 'var(--danger)' },
      { id: 'jp', label: 'PMDA (JP)', color: 'var(--d-cc)' },
    ],
    // key: changeType-market  value: { level, ref, note }
    cells: {
      'bom-us':      { level: 'conditional', ref: 'FDA Design Change §III.A', note: 'Special 510(k) 검토 필요 · Letter to File 가능 케이스' },
      'bom-eu':      { level: 'required',    ref: 'MDR Art. 120(3), Annex II', note: 'NB 통보 · TR 개정 · 성능시험 재수행' },
      'bom-kr':      { level: 'required',    ref: 'MFDS 고시 2024-02',       note: '변경허가 · 시험성적서 갱신' },
      'bom-cn':      { level: 'required',    ref: 'GB 9706.1-2020 §7.9.2',   note: '누설전류 강화 조항 · IEC 대비 10배 엄격 · CMDE 재시험' },
      'bom-jp':      { level: 'conditional', ref: 'PMD Act 一部変更',        note: '軽微변경 신고 or 제조판매 승인 갱신 판단' },

      'sw-us':       { level: 'conditional', ref: 'FDA PCCP 2024-12',        note: 'PCCP 등록되어 있으면 자동 승인 · 없으면 Special 510(k)' },
      'sw-eu':       { level: 'required',    ref: 'MDR Art. 10(9), MDCG 2024-9', note: 'CIP 없으면 TR 개정 필수' },
      'sw-kr':       { level: 'conditional', ref: 'MFDS SaMD 변경허가 v2.0', note: '경미변경 vs 변경허가 판단' },
      'sw-cn':       { level: 'required',    ref: 'NMPA SaMD 分类界定',      note: '변경 카테고리별 서식 별도' },
      'sw-jp':       { level: 'required',    ref: 'PMD Act §23-2-15',        note: '一部変更承認 or Todokede 갱신' },

      'sw-minor-us': { level: 'not-required', ref: 'FDA Change Guidance',    note: 'Letter to File · 문서 보관' },
      'sw-minor-eu': { level: 'conditional', ref: 'MDCG 2024-9 §5.2',        note: 'Significant change 판단 · 대체로 skip' },
      'sw-minor-kr': { level: 'not-required', ref: 'MFDS 경미변경',           note: 'DHF 갱신만' },
      'sw-minor-cn': { level: 'conditional', ref: 'NMPA 变更',               note: '재시험 대체로 skip' },
      'sw-minor-jp': { level: 'not-required', ref: 'PMDA',                    note: 'QMS 문서 갱신' },

      'label-us':    { level: 'conditional', ref: '21 CFR §801.20',           note: 'UDI 5조건 해당 시 재발급' },
      'label-eu':    { level: 'conditional', ref: 'MDR Art. 27',              note: 'UDI-DI 갱신 · EUDAMED 재등록' },
      'label-kr':    { level: 'conditional', ref: 'MFDS 표시 규정',           note: 'UDI-DI 갱신' },
      'label-cn':    { level: 'conditional', ref: 'NMPA UDI 규정 (2019)',     note: 'UDI-DI + CFDA 라벨 승인' },
      'label-jp':    { level: 'conditional', ref: 'PMDA · JMDN',              note: '添付文書 개정' },

      'warn-us':     { level: 'required',    ref: 'FDA Special 510(k)',       note: 'Warning 변경은 항상 재제출' },
      'warn-eu':     { level: 'required',    ref: 'MDR Art. 27 §4',          note: 'UDI-DI 재발급 필수 · IFU 개정' },
      'warn-kr':     { level: 'required',    ref: 'MFDS 표시 개정',           note: '변경허가 필수' },
      'warn-cn':     { level: 'required',    ref: 'NMPA',                     note: '警告变更 필수 신고' },
      'warn-jp':     { level: 'required',    ref: 'PMDA · 添付文書',          note: '기재사항 변경 신고' },

      'process-us':  { level: 'conditional', ref: 'FDA §807.81(a)(3)',        note: 'Manufacturing change · Special 510(k) 판단' },
      'process-eu':  { level: 'required',    ref: 'MDR Art. 120, ISO 13485', note: 'NB 감사 · 공정검증 재수행' },
      'process-kr':  { level: 'required',    ref: 'MFDS GMP',                 note: 'GMP 재심사' },
      'process-cn':  { level: 'required',    ref: 'NMPA 생산허가',            note: '생산공정 변경신고 · 현장 재감사' },
      'process-jp':  { level: 'required',    ref: 'PMD Act QMS',              note: 'MHLW 시행령 169호 재감사' },

      'sterile-us':  { level: 'required',    ref: 'FDA ISO 11135 recognition', note: 'Sterilization validation 재수행' },
      'sterile-eu':  { level: 'required',    ref: 'MDR Annex I §11',           note: 'Notified Body sterile process 재감사' },
      'sterile-kr':  { level: 'required',    ref: 'MFDS 멸균 가이드',           note: '멸균 밸리데이션 재수행 · 성적서' },
      'sterile-cn':  { level: 'required',    ref: 'NMPA + YY/T 0287',          note: 'GB/YY 표준 · CMDE 재시험' },
      'sterile-jp':  { level: 'required',    ref: 'PMDA/MHLW ISO 11135',       note: 'Sterile 밸리데이션 재수행' },
    },
  },

  radarSources: [
    { id: 's-fda-rss',   name: 'FDA CDRH News & Events',           url: 'https://www.fda.gov/…/rss.xml', freq: '4h',   enabled: true,  lastRun: '2026-07-01 08:00', items: 4 },
    { id: 's-ema-rss',   name: 'EMA / MDCG Announcements',         url: 'https://www.ema.europa.eu/…',  freq: '6h',   enabled: true,  lastRun: '2026-07-01 06:00', items: 2 },
    { id: 's-mfds-rss',  name: 'MFDS 의료기기 고시 · 공고',         url: 'https://mfds.go.kr/rss',        freq: '6h',   enabled: true,  lastRun: '2026-06-30 22:00', items: 3, warn: '지연 발생' },
    { id: 's-nmpa-scrp', name: 'NMPA 公告 (scraper)',              url: 'https://www.nmpa.gov.cn',      freq: '12h',  enabled: true,  lastRun: '2026-07-01 04:00', items: 1 },
    { id: 's-pmda-rss',  name: 'PMDA お知らせ',                    url: 'https://www.pmda.go.jp/rss',    freq: '12h',  enabled: true,  lastRun: '2026-07-01 04:00', items: 0 },
    { id: 's-imdrf-scrp', name: 'IMDRF Working Group publications', url: 'https://www.imdrf.org',        freq: 'daily', enabled: false, lastRun: '2026-06-15 00:00', items: 0 },
    { id: 's-iso-scrp',  name: 'ISO/IEC 신규 표준 게시',           url: 'https://www.iso.org',           freq: 'daily', enabled: true,  lastRun: '2026-07-01 00:00', items: 0 },
    { id: 's-tuvsud',    name: 'TÜV SÜD White Papers',              url: 'https://www.tuvsud.com',        freq: 'daily', enabled: true,  lastRun: '2026-07-01 03:00', items: 1 },
  ],

  adminSettings: {
    sla: [
      { key: 'auto',         lbl: '자동 답변 유예 (RA 감사 대기)', val: '24h',  desc: '자동 발송 후 RA가 취소 가능한 시간창' },
      { key: 'needs-review', lbl: '검토 필요 응답 SLA',           val: '12h',  desc: '이전 24h → 12h로 단축됨 (2026-06-30 수정)' },
      { key: 'escalated',    lbl: '에스컬레이션 응답 SLA',         val: '48h',  desc: '외부 자문 필요 케이스' },
      { key: 'waiting',      lbl: '유저 회신 대기 만료',           val: '5d',   desc: '자동 취소 트리거' },
    ],
    triage: [
      { key: 'auto-threshold',   lbl: '자동응답 신뢰도 임계값',   val: '85%',  desc: '≥ 이 값이면 자동 발송 대상' },
      { key: 'review-threshold', lbl: '검토 필요 하한',          val: '60%',  desc: '이 값 미만이면 자동 에스컬' },
      { key: 'safe-domains',     lbl: '자동응답 화이트리스트',    val: '8 카테고리', desc: 'Labeling / Symbols / Language / SOUP 등' },
      { key: 'danger-keywords',  lbl: '자동 에스컬 키워드',       val: '12개',  desc: 'recall · FSCA · MDR breach · CAPA · off-label …' },
    ],
    esig: [
      { key: 'method',      lbl: '전자서명 방식',           val: '비밀번호 재입력', desc: 'v3.2에서 WebAuthn / FIDO2 도입 예정' },
      { key: 'reauth',      lbl: '세션 재인증 주기',        val: '30분',       desc: '연속 서명 시에도 재입력 요구' },
      { key: 'hash-chain',  lbl: '감사로그 무결성',         val: 'SHA-256',   desc: 'Append-only · 21 CFR Part 11 §11.10(e)' },
    ],
    integrations: [
      { key: 'sso',        lbl: 'SSO (Auth.js + Google)',       val: 'Enabled',  desc: 'neurosense.kr 도메인만' },
      { key: 'slack',      lbl: 'Slack 알림',                   val: 'Enabled',  desc: '#ra-inbox 채널 · SLA 알림' },
      { key: 'sharepoint', lbl: 'SharePoint 문서 저장소',        val: 'Read-only', desc: 'DHF/RMF/CER 원본 조회 (v3.1)' },
      { key: 'jira',       lbl: 'Jira 티켓 동기화',              val: 'Disabled',  desc: 'v3.2 로드맵' },
    ],
    retention: [
      { key: 'inbox-ttl',   lbl: 'Inbox 티켓 보관',       val: '7년',   desc: 'ISO 13485 §4.2.5 최소 기간' },
      { key: 'audit-ttl',   lbl: '감사 로그 보관',        val: '10년',  desc: '21 CFR Part 11 + MDR Art. 10(8)' },
      { key: 'consult-ttl', lbl: 'Consult 세션 보관',     val: '5년',   desc: 'RA 개인 리서치 · 명시적 삭제 가능' },
    ],
  },

  // ── RA Consult (파워 챗) ─────────────────────────────────
  consultJurisdictions: [
    { id: 'fda',  lbl: 'FDA',    color: '#1f3a6b' },
    { id: 'eu',   lbl: 'EU MDR', color: '#0f7a4d' },
    { id: 'mfds', lbl: 'MFDS',   color: '#b54708' },
    { id: 'nmpa', lbl: 'NMPA',   color: '#a8142b' },
    { id: 'pmda', lbl: 'PMDA',   color: '#6b21a8' },
    { id: 'iso',  lbl: 'ISO/IEC',color: '#475162' },
    { id: 'mdcg', lbl: 'MDCG',   color: '#2b4d8a' },
    { id: 'imdrf',lbl: 'IMDRF',  color: '#7e9bc4' },
  ],

  consultSessions: [
    { id: 'C-2026-041', title: 'AI/ML SaMD — PCCP 적용 조건 관할권 비교',      updated: '2026-06-30', turns: 12, saved: true,  tags: ['AI/ML', 'PCCP', 'FDA', 'MDR'] },
    { id: 'C-2026-039', title: 'EU MDR Annex XVI 비의료기기 임상평가 요구',    updated: '2026-06-28', turns:  6, saved: true,  tags: ['MDR', 'Annex XVI', 'Clinical'] },
    { id: 'C-2026-036', title: 'PMDA Type-II 신청 · 사전상담 준비 자료',        updated: '2026-06-25', turns:  9, saved: false, tags: ['PMDA', 'Pre-consult'] },
    { id: 'C-2026-034', title: 'IEC 60601-1-2 4판 EMC — Class II 면제 조항',   updated: '2026-06-22', turns: 15, saved: true,  tags: ['IEC', 'EMC'] },
    { id: 'C-2026-030', title: 'NMPA 2021 개정 · 한국 시험성적서 재활용 범위',  updated: '2026-06-18', turns:  4, saved: false, tags: ['NMPA', 'Testing'] },
  ],

  // 파워 답변 샘플 (Consult 활성 세션) — legacy pointer, kept for backward compat
  consultActive: null,

  // ── Session-specific detailed content (deep-research) ───────
  // Each entry keyed by session id; used by RaConsult to render the active session.
  consultDetails: {
    'C-2026-041': {
      id: 'C-2026-041',
      title: 'AI/ML SaMD — PCCP 적용 조건 관할권 비교',
      jurisdictions: ['fda', 'eu', 'mfds'],
      question: 'AI 알고리즘 재학습 배포 파이프라인에 PCCP를 적용할 수 있는지, FDA · EU · MFDS 각각의 관점에서 조건을 비교해줘.',
      confidence: 88, sources: 11, duration: '18.2s',
      trace: [
        'Retrieving FDA PCCP Final Guidance (Dec 2024)',
        'Cross-referencing MDR Art. 10(9) + MDCG 2024-9',
        'Scanning MFDS SaMD 변경허가 가이드 v2.0 (draft)',
        'Building 3-jurisdiction comparison matrix',
      ],
      summary: `AI/ML SaMD의 predetermined change control은 <b>세 관할권 모두 원리적으로 인정</b>하지만, 적용 조건과 제출 형식은 크게 다릅니다<sup class="cite" data-src="1">1</sup>.

<b>FDA</b>는 2024-12 최종 가이드(Marketing Submission Recommendations for a Predetermined Change Control Plan for AI/ML-Enabled Device Software Functions)를 발행하여 가장 성숙한 프레임을 제공합니다. PCCP는 510(k) 또는 De Novo 제출에 포함되며, <b>"Description of Modifications · Modification Protocol · Impact Assessment"</b> 3-part 구조로 문서화되어야 합니다<sup class="cite" data-src="2">2</sup>. 재학습 파이프라인의 자동성 수준(fully-autonomous vs human-in-the-loop)에 따라 세부 요건이 다릅니다<sup class="cite" data-src="3">3</sup>.

<b>EU MDR</b>은 Art. 10(9)에서 CIP(change implementation plan) 개념을 도입하고 있으나 아직 세부 가이드가 없어 사례가 부족합니다. MDCG 2024-9(Software modifications)가 참고 가능하지만 "significant change" 정의가 여전히 case-by-case 판단입니다<sup class="cite" data-src="4">4</sup>.

<b>MFDS</b>는 2026-06 SaMD 변경허가 가이드 v2.0을 의견조회 중입니다. FDA 프레임을 참고하되 국내 임상 데이터 요구가 추가될 것으로 예상됩니다<sup class="cite" data-src="5">5</sup>.`,
      comparison: {
        cols: ['항목', 'FDA (US)', 'EU MDR', 'MFDS (KR)'],
        rows: [
          ['공식 프레임',        'PCCP Final Guidance (2024-12)',        'Art. 10(9) · MDCG 2024-9',            'SaMD 변경허가 v2.0 (draft)'],
          ['제출 시기',          '510(k)/De Novo/PMA와 함께',            'CE 인증 시 · 사후 통지',                '변경허가 신청 시'],
          ['적용 범위',          'Modifications + Protocol + Impact',     'CIP 프레임',                          '알고리즘 · 데이터 · 성능 지표'],
          ['자동 재배포 허용',    '조건부 (protocol 준수)',                'Case-by-case',                        '검토 필요 (draft)'],
          ['성숙도',             'High (사례 다수)',                      'Low (사례 없음)',                     'Very Low (draft 단계)'],
          ['재제출 트리거',       'Protocol 이탈 시',                     'Significant change 시',                'Class 상향 시'],
        ],
      },
      sourceList: [
        { idx: 1, org: 'FDA',   title: 'Predetermined Change Control Plans for AI-Enabled Devices',        year: '2024', type: 'Guidance' },
        { idx: 2, org: 'FDA',   title: 'Marketing Submission Recommendations for AI/ML PCCP',              year: '2024', type: 'Guidance' },
        { idx: 3, org: 'FDA',   title: 'GMLP — Good Machine Learning Practice',                             year: '2021', type: 'Guidance' },
        { idx: 4, org: 'MDCG',  title: 'MDCG 2024-9 — Software modifications',                              year: '2024', type: 'Guidance' },
        { idx: 5, org: 'MFDS',  title: '의료기기 SaMD 변경허가 가이드 v2.0 (의견조회)',                       year: '2026', type: 'Draft' },
        { idx: 6, org: 'IMDRF', title: 'IMDRF/AIMD WG/N67 — ML-enabled Medical Device Key Terms',           year: '2023', type: 'Standard' },
        { idx: 7, org: 'EU',    title: 'Regulation (EU) 2017/745 — MDR Art. 10',                            year: '2017', type: 'Regulation' },
        { idx: 8, org: '사내',  title: 'PCCP-SOP-001 · Regula 내부 절차',                                    year: '2026', type: 'Internal' },
      ],
      related: [
        'PCCP 없이 알고리즘 재배포 시 재제출 트리거는?',
        'FDA GMLP와 IMDRF/AIMD 원칙의 차이점',
        'EU MDR Class III SaMD의 CIP 사례 (있다면)',
        'MFDS SaMD 변경허가와 국내 임상 데이터 요구',
      ],
    },

    'C-2026-039': {
      id: 'C-2026-039',
      title: 'EU MDR Annex XVI 비의료기기 임상평가 요구',
      jurisdictions: ['eu', 'mdcg'],
      question: 'MDR Annex XVI (비의료기기 목적 제품 — 미용용 콘택트렌즈, 필러 등)의 임상평가는 정확히 어떤 요구사항을 만족해야 하나?',
      confidence: 91, sources: 8, duration: '11.6s',
      trace: [
        'Retrieving MDR Annex XVI + Implementing Reg 2022/2346',
        'Cross-referencing MDCG 2020-13, MDCG 2022-14',
        'Scanning EU Commission FAQ on Annex XVI',
        'Building applicability + evidence matrix',
      ],
      summary: `MDR Annex XVI은 <b>의료 목적이 없는 6개 제품군</b>에 MDR을 확장 적용합니다: 비교정용 콘택트렌즈, 뇌자극·근육자극 기기(비의료), 지방분해기기, 고강도 전자기 방사(레이저 문신 제거 등), 미용 임플란트/필러, 뇌자극기<sup class="cite" data-src="1">1</sup>.

<b>Implementing Regulation (EU) 2022/2346</b>이 Common Specifications를 제공하며, 각 제품군별 임상평가 요구를 구체화합니다<sup class="cite" data-src="2">2</sup>.

<b>핵심 원칙</b>: 임상평가는 의료기기와 <i>동일한 수준</i>으로 요구됩니다. 다만 성능(performance) 정의가 다릅니다 — Annex XVI 제품은 <b>"benefit"이 미학적/비의료적 성과</b>이므로 이를 정량화해야 합니다<sup class="cite" data-src="3">3</sup>.

<b>PMCF는 필수</b>이며, 특히 이식형/침습적 제품(필러, 지방분해)은 상세한 사전·사후 임상 계획을 제출해야 합니다<sup class="cite" data-src="4">4</sup>.`,
      comparison: {
        cols: ['제품군', 'Class', '임상평가 요구', 'PMCF'],
        rows: [
          ['비교정 콘택트렌즈',    'IIa',   'Literature + performance data',      '연 1회 report'],
          ['뇌자극(비의료)',      'IIb',   'Investigation 권장',                  '필수 · Class III 수준'],
          ['지방분해기기',        'IIb',   'Investigation 필수 (침습성)',         '필수'],
          ['고강도 EM 방사',      'IIa/IIb', 'Performance + safety data',        '연 1회'],
          ['미용 임플란트/필러',  'III',   'Full Investigation (ISO 14155)',      '연 1회 PSUR + PMCF'],
        ],
      },
      sourceList: [
        { idx: 1, org: 'EU',    title: 'MDR Annex XVI — Groups of products without an intended medical purpose', year: '2017', type: 'Regulation' },
        { idx: 2, org: 'EU',    title: 'Commission Implementing Regulation (EU) 2022/2346',                       year: '2022', type: 'Regulation' },
        { idx: 3, org: 'MDCG',  title: 'MDCG 2020-13 — Clinical Evaluation Assessment Report Template',           year: '2020', type: 'Guidance' },
        { idx: 4, org: 'MDCG',  title: 'MDCG 2022-14 — Transition to MDR (Annex XVI specifics)',                  year: '2022', type: 'Guidance' },
        { idx: 5, org: 'MEDDEV',title: 'MEDDEV 2.7/1 rev.4 — Clinical Evaluation (still relevant)',               year: '2016', type: 'Guidance' },
      ],
      related: [
        '비교정 콘택트렌즈의 성능 지표 정의 (visual comfort 등)',
        '필러 제품의 ISO 14155 준수 필수 여부',
        'Annex XVI 제품에 대한 NB 지정 상태',
        '기존 화장품 규제 대비 이관 절차',
      ],
    },

    'C-2026-036': {
      id: 'C-2026-036',
      title: 'PMDA Type-II 신청 · 사전상담 준비 자료',
      jurisdictions: ['pmda'],
      question: 'NeuroTrack-EEG(Class II · 지정관리) PMDA 신청을 위한 사전상담(대면 조언, Type-II) 준비 자료 목록을 정리해줘.',
      confidence: 84, sources: 6, duration: '9.4s',
      trace: [
        'Retrieving 医薬品医療機器法 (PMD Act) Ch.3',
        'Cross-referencing PMDA Consultation Fee Schedule 2026',
        'Scanning J-MDN classification (JMDN 46001010)',
        'Building document checklist',
      ],
      summary: `PMDA <b>대면조언(対面助言, Type-II)</b>은 신청 전 시험·임상 방향에 대해 PMDA와 협의하는 자리입니다. 특히 Class II (指定管理医療機器) 중 신규 기술이 포함되거나 J-MDN 매칭이 불명확한 경우 강력 권장됩니다<sup class="cite" data-src="1">1</sup>.

<b>Class II의 인허가 경로</b>는 두 가지: (a) <b>제3자 인증(認証)</b> — 지정 인증기관(RCB)이 처리, 표준 인증기준(認証基準)이 있는 경우, (b) <b>후생노동성 승인(承認)</b> — 신규 기술 등 인증기준이 없는 경우, PMDA 심사<sup class="cite" data-src="2">2</sup>.

<b>사전상담 준비 자료(권장)</b>:
1. 제품 개요서 (Japanese) — 사용목적, 원리, 구조, 정격
2. J-MDN 후보 코드 및 근거
3. 유사 기 승인 제품(先行製品) 비교표
4. 예정된 시험 목록 (STED 초안)
5. 임상평가 전략 (해외 데이터 활용 계획)
6. QMS 상태 (ISO 13485 인증서 · MHLW 시행령 169호 준수)
7. 상담 목적 명확화 서면 (2-3 질의)<sup class="cite" data-src="3">3</sup>

<b>수수료(2026)</b>: Type-II 상담 약 ¥2,300,000, 소요 6-8주.<sup class="cite" data-src="4">4</sup>`,
      comparison: {
        cols: ['상담 유형', '용도', '소요', '수수료 (참고)'],
        rows: [
          ['Type-I (문서)',       '간단한 질의',                    '4주',      '¥900,000~'],
          ['Type-II (대면)',      '개발·시험·임상 방향',            '6-8주',    '¥2,300,000~'],
          ['Type-III (사전면접)', '최종 신청 자료 최종 확인',        '6주',      '¥3,100,000~'],
          ['Simple 상담',          '분류·경로 확인만',                '2주',      '무료'],
        ],
      },
      sourceList: [
        { idx: 1, org: 'PMDA',   title: 'Consultation on Medical Devices — Categories & Fees',        year: '2026', type: 'Guidance' },
        { idx: 2, org: 'MHLW',   title: '医薬品医療機器等法 (PMD Act) 第23条の2の3',                    year: '2013', type: 'Regulation' },
        { idx: 3, org: 'PMDA',   title: 'Medical Device Review Handbook',                             year: '2024', type: 'Handbook' },
        { idx: 4, org: 'PMDA',   title: 'Fee Schedule for FY2026',                                    year: '2026', type: 'Schedule' },
        { idx: 5, org: 'JFMDA',  title: 'Foreign Manufacturer Registration Guide',                    year: '2023', type: 'Industry' },
      ],
      related: [
        'DMAH(외국제조업자등록) 필수 요건',
        '해외 임상데이터 PMDA 인정 조건',
        'JMDN 코드 46001010 vs 46001020 세분화',
        'RCB 인증 경로가 유리한 경우',
      ],
    },

    'C-2026-034': {
      id: 'C-2026-034',
      title: 'IEC 60601-1-2:2020 4판 EMC — Class II 면제 조항',
      jurisdictions: ['iso', 'fda', 'eu'],
      question: 'IEC 60601-1-2:2020(4판) EMC 시험 중 Class II 의료기기에서 면제 가능한 항목이 있는가? 위험 기반 접근을 어떻게 정당화하나?',
      confidence: 79, sources: 9, duration: '14.1s',
      trace: [
        'Retrieving IEC 60601-1-2:2020 (Ed 4.1) full text',
        'Cross-referencing FDA recognition list 2024',
        'Scanning ISO 14971 risk-based tailoring precedent',
        'Building applicability matrix by intended environment',
      ],
      summary: `IEC 60601-1-2:2020(4th ed, +A1:2020)에는 <b>Class II를 이유로 한 자동 면제 조항이 없습니다</b>. 그러나 규정은 위험 기반 tailoring을 명시적으로 허용합니다<sup class="cite" data-src="1">1</sup>.

<b>Tailoring 근거</b> (§4.2 + §5):
- 의도 사용 환경(Home / Professional / Special)에 따라 immunity level 차등
- Essential performance 정의에 따라 test criteria 차등
- 특정 위험이 발생 불가능함을 <b>ISO 14971 위험분석으로 입증</b>하면 특정 시험 생략 가능<sup class="cite" data-src="2">2</sup>

<b>실무 판단</b>:
- <b>Radiated Immunity (§8.9)</b> — Home환경은 10 V/m, Professional은 3 V/m. 대상 환경 명확화로 부담 조정.
- <b>Conducted Immunity (§8.7)</b> — 배터리 전용 기기는 AC 라인 결합 조건 배제 가능
- <b>ESD (§8.3)</b> — 의도 사용에서 접촉이 불가한 부위는 면제 가능하되 rationale 문서화 필수
- <b>Surge/Burst</b> — 통상 면제 어려움 (AC 연결 시)<sup class="cite" data-src="3">3</sup>

<b>FDA 관점</b>: 4th ed는 recognition list에 등재됨. STED에 tailoring 근거를 명시하면 수용됨<sup class="cite" data-src="4">4</sup>.`,
      comparison: {
        cols: ['시험 항목', 'Home 환경', 'Prof 환경', '면제 가능성'],
        rows: [
          ['방사 방출 (§7)',        '준수 필수',      '준수 필수',    'X'],
          ['방사 내성 (§8.9)',      '10 V/m',        '3 V/m',        '△ 환경 한정'],
          ['전도 내성 (§8.7)',      '준수',           '준수',         '△ 배터리 전용'],
          ['ESD (§8.3)',            '±8 kV',         '±8 kV',        '△ 비접촉부위'],
          ['Surge (§8.11)',         'AC선만',        'AC선만',       '○ 배터리 전용'],
          ['Burst (§8.13)',         '준수',           '준수',         'X'],
        ],
      },
      sourceList: [
        { idx: 1, org: 'IEC',    title: 'IEC 60601-1-2:2020 (Ed 4.1) — EMC Requirements',            year: '2020', type: 'Standard' },
        { idx: 2, org: 'ISO',    title: 'ISO 14971:2019 — Risk Management for Medical Devices',      year: '2019', type: 'Standard' },
        { idx: 3, org: 'IEC',    title: 'IEC 60601-1-2 §4.2 · §5 — Risk-based tailoring provisions', year: '2020', type: 'Standard' },
        { idx: 4, org: 'FDA',    title: 'CDRH Standards Recognition List (60601-1-2 Ed 4.1)',        year: '2024', type: 'List' },
        { idx: 5, org: 'AAMI',   title: 'Application Guide for 60601-1-2 Ed 4',                      year: '2021', type: 'Industry' },
      ],
      related: [
        '방사잡음 부적합 CAPA 사례 (CAPA-2026-018)',
        'ESD 면제 rationale 작성 템플릿',
        'Home vs Professional 환경 선언 근거',
        'PSU 변경 시 EMC 재시험 범위',
      ],
    },

    'C-2026-030': {
      id: 'C-2026-030',
      title: 'NMPA 2021 개정 · 한국 시험성적서 재활용 범위',
      jurisdictions: ['nmpa'],
      question: '중국 NMPA에 Class II 의료기기 등록 시, 한국(KTL/KTR) 시험성적서를 어느 범위까지 재활용 가능한가?',
      confidence: 76, sources: 7, duration: '12.7s',
      trace: [
        'Retrieving NMPA Order No.47 (2021) — Registration Regulations',
        'Cross-referencing Announcement No.121 (2021) on foreign testing',
        'Scanning NMPA Q&A on GB standard equivalence',
        'Building acceptance matrix by test category',
      ],
      summary: `2021년 NMPA <b>의료기기 등록 관리 조례(令 第739号 → Order No.47)</b> 개정 이후, 해외 시험성적서 인정 범위가 <b>부분 확대</b>되었습니다<sup class="cite" data-src="1">1</sup>.

<b>인정 가능</b> (조건부):
- ISO/IEC 국제표준에 준한 안전 시험 성적서 (전기안전 IEC 60601-1, EMC 60601-1-2, 생체적합성 ISO 10993 등)<sup class="cite" data-src="2">2</sup>
- 시험소가 <b>ILAC MRA 서명 인정기관</b>이어야 함 (KTL/KTR/KCL 등 KOLAS 인정 시험소는 해당)
- 시험 시점의 국제표준 판번과 중국 GB 표준(YY)이 <b>동등</b>해야 함

<b>재시험 필수</b>:
- 성능 시험 중 GB/YY 표준이 국제표준보다 <b>strict한 항목</b>(예: 일부 방사선 안전 GB 9706 시리즈)<sup class="cite" data-src="3">3</sup>
- 임상 시험 (일부 저위험 제품 면제 가능) — CFDI(의료기기평가센터) 사전 상담 권장
- <b>Type Testing</b> 중국 검사소(CMDE 지정) 지정 항목

<b>실무 프로세스</b>:
1. Product Registration 전 <b>预咨询(Pre-consultation)</b>로 재사용 가능 항목 확인
2. GB/YY 표준 목록 대조 (표준번호 · 년도 매핑표 작성)
3. 재시험 필요 시 CMDE 지정 검사소 예약 (2-3개월 대기)<sup class="cite" data-src="4">4</sup>`,
      comparison: {
        cols: ['시험 카테고리', '한국(KTL) 성적서 인정', '재시험 필요', '중국 지정 검사소'],
        rows: [
          ['전기안전 (IEC 60601-1)',   '○ 인정',          '△ GB 9706 강화 조항만', 'CMDE-recognized'],
          ['EMC (IEC 60601-1-2)',       '○ 인정',          'X (동등)',              '—'],
          ['생체적합성 (ISO 10993)',    '○ 인정',          '△ 세포독성 재실험 요구', '—'],
          ['성능 시험 (GB/YY)',         'X 인정 안됨',     '○ 필수',                'CMDE 지정소'],
          ['임상 시험',                 '△ Case-by-case',  '보통 필요',              'CFDI 상담'],
          ['소프트웨어 (YY/T 0664)',    '△',              '○ 문서 재작성',          '—'],
        ],
      },
      sourceList: [
        { idx: 1, org: 'NMPA',   title: 'Order No.47 — Medical Device Registration Regulations (2021)',     year: '2021', type: 'Regulation' },
        { idx: 2, org: 'NMPA',   title: 'Announcement No.121 — Foreign Testing Report Acceptance',           year: '2021', type: 'Announcement' },
        { idx: 3, org: 'CMDE',   title: 'GB 9706 Series — Equivalence Table with IEC 60601',                 year: '2023', type: 'Guidance' },
        { idx: 4, org: 'CMDE',   title: 'Pre-consultation Handbook',                                          year: '2024', type: 'Handbook' },
        { idx: 5, org: 'ILAC',   title: 'MRA Signatory List (KOLAS included)',                                year: '2024', type: 'List' },
      ],
      related: [
        'CMDE 지정 검사소 리스트 최신본',
        'GB 9706.1 vs IEC 60601-1 3.2판 차이점',
        '임상시험 면제 대상 Class II 제품군',
        'Type Testing 신청서 서식 (中文)',
      ],
    },
  },
};

window.D3 = D3;
