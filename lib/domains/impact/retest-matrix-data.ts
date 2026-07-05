// SPEC-V3-IMPACT-001 M2: retestMatrix 35-cell deterministic data.
// AC-IMP-10: retestMatrix 데이터 코드 임베드.

export interface RetestMatrixCell {
  level: 'required' | 'conditional' | 'not-required';
  ref: string;
  note: string;
}

export interface RetestMatrixData {
  changeTypes: Array<{ id: string; label: string }>;
  markets: Array<{ id: string; label: string; color: string }>;
  cells: Record<string, RetestMatrixCell>;
}

export const RETEST_MATRIX: RetestMatrixData = {
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
  cells: {
    // BOM changes
    'bom-us': {
      level: 'conditional',
      ref: 'FDA Design Change §III.A',
      note: 'Special 510(k) 검토 필요 · Letter to File 가능 케이스',
    },
    'bom-eu': {
      level: 'required',
      ref: 'MDR Art. 120(3), Annex II',
      note: 'NB 통보 · TR 개정 · 성능시험 재수행',
    },
    'bom-kr': {
      level: 'required',
      ref: 'MFDS 라벨링 심사 기준 §III-2',
      note: '품목변경 심사 · 임상시험 재수행 필요',
    },
    'bom-cn': {
      level: 'conditional',
      ref: 'NMPA 제품등록명세서 변경 지침',
      note: '등록정보 변경 신고 · 성능시험 면제 가능',
    },
    'bom-jp': {
      level: 'conditional',
      ref: 'PMDAPAL 제품변경 관련 심사 기준',
      note: '경미 변경은 신고 면제 · 중요 변경은 인증 필요',
    },
    // SW algorithm retraining
    'sw-us': {
      level: 'conditional',
      ref: 'FDA Software as SaMD SoC/K',
      note: '알고리즘 중요도 평가 · 510(k) 또는 De Novo 분석',
    },
    'sw-eu': {
      level: 'required',
      ref: 'MDR Art. 10(9), MDCG 2024-9',
      note: 'CIP 없으면 TR 개정 필수 · 성능평가 재수행',
    },
    'sw-kr': {
      level: 'required',
      ref: 'MFDS 소프트웨어 심사 기준',
      note: '임상평가 재수행 · 안전성·유효성 입증 필요',
    },
    'sw-cn': {
      level: 'conditional',
      ref: 'NMPA SW 변경 관련 기술 가이드',
      note: '등록정보 변경 · 리스크 분석서 제출',
    },
    'sw-jp': {
      level: 'conditional',
      ref: 'PMDA SW 변경 통지',
      note: '중요 변경 시 인증 심사 · 경미 변경은 신고',
    },
    // SW minor (bugfix)
    'sw-minor-us': {
      level: 'not-required',
      ref: 'FDA Bug Fix Guidance',
      note: '버그 수정만으로는 제조업자 통신 불필요',
    },
    'sw-minor-eu': {
      level: 'not-required',
      ref: 'MDR Art. 10(9) 예외',
      note: '임상평가 재수행 불필요 · 문서화로 충분',
    },
    'sw-minor-kr': {
      level: 'not-required',
      ref: 'MFDS SW 변경 심사 기준 예외',
      note: '경미 버그 수정은 심사 면제 가능',
    },
    'sw-minor-cn': {
      level: 'not-required',
      ref: 'NMPA SW 마이너 변경 가이드',
      note: '등록정보 변경 불필요 · 내부기록 유지',
    },
    'sw-minor-jp': {
      level: 'not-required',
      ref: 'PMDA 경미 SW 변경',
      note: '신고 불필요 · 변경 이력 관리',
    },
    // Label wording changes
    'label-us': {
      level: 'conditional',
      ref: 'FDA Labeling Guidance §21',
      note: '중요 변경 시 510(k) · 경미 변경은 Letter to File',
    },
    'label-eu': {
      level: 'conditional',
      ref: 'MDR Art. 10(11), Annex I',
      note: 'IFU 변경 시 NB 통보 · 라벨만 변경면 면제 가능',
    },
    'label-kr': {
      level: 'conditional',
      ref: 'MFDS 라벨링 심사 기준',
      note: '사용자 정보 변경 시 심사 필요 · 경미 변경은 면제',
    },
    'label-cn': {
      level: 'conditional',
      ref: 'NMPA 라벨링 변경 기준',
      note: '등록정보 변경 신고 · 품목 표시 규정 준수',
    },
    'label-jp': {
      level: 'conditional',
      ref: 'PMDA 라벨링 변경 통지',
      note: '중요 변경 시 인증 필요 · 경미 변경은 신고',
    },
    // Critical warning revision
    'warn-us': {
      level: 'conditional',
      ref: 'FDA Warning Letter Policy',
      note: '경고 내용에 따라 510(k) 또는 Field Remediation',
    },
    'warn-eu': {
      level: 'required',
      ref: 'MDR Art. 10(10), FSCA',
      note: 'FSR 필수 · NB 통보 · Corrective Action Plan',
    },
    'warn-kr': {
      level: 'required',
      ref: 'MFDS 안전성 조치 지침',
      note: '리콜 계획 제출 · 재발 방지 대책 수립',
    },
    'warn-cn': {
      level: 'required',
      ref: 'NMPA 안전성 정보 변경',
      note: '안전성 평가 재수행 · 변경 등록',
    },
    'warn-jp': {
      level: 'required',
      ref: 'PMDA 경고 사항 조치',
      note: '후생조치 계획 · 리콜 시스템 강화',
    },
    // Manufacturing process changes
    'process-us': {
      level: 'conditional',
      ref: 'FDA Process Validation Guidance',
      note: '공정 중요도 평가 · PQ 재수행 가능성 검토',
    },
    'process-eu': {
      level: 'required',
      ref: 'MDR Art. 10(8), Annex IX',
      note: 'QMS 재평가 · NB 현장 감사 · 성능시험 재수행',
    },
    'process-kr': {
      level: 'required',
      ref: 'MFDS 제조공정 변경 심사',
      note: '공정검증 재수행 · 품질기준 확인',
    },
    'process-cn': {
      level: 'conditional',
      ref: 'NMPA 제조공정 변경 기준',
      note: '공정 변경 등록 · GMP 준수 확인',
    },
    'process-jp': {
      level: 'conditional',
      ref: 'PMDA 공정 변경 관련',
      note: '공정 현장 감사 가능 · 품질평가 재수행',
    },
    // Sterilization condition changes
    'sterile-us': {
      level: 'required',
      ref: 'FDA Sterilization Guidance',
      note: '유효성 재검증 · 510(k) 제출 · Process Validation 재수행',
    },
    'sterile-eu': {
      level: 'required',
      ref: 'MDR Art. 10(4), Annex IX',
      note: '멸균 프로세스 재검증 · NB 승인 · 성능시험 재수행',
    },
    'sterile-kr': {
      level: 'required',
      ref: 'MFDS 멸균 심사 기준',
      note: '멸균 방법 검증 · 임상시험 재수행',
    },
    'sterile-cn': {
      level: 'required',
      ref: 'NMPA 멸균 조건 변경',
      note: '멸균 유효성 평가 · 재등록 심사',
    },
    'sterile-jp': {
      level: 'required',
      ref: 'PMDA 멸균 검토 기준',
      note: '멸균 프로세스 재검증 · 인증 갱신 필요',
    },
  },
};
