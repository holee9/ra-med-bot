// @MX:NOTE [AUTO] homeQuickCards — static home page quick-start cards (no DB fetch).
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-004)

/**
 * Shape of a single home quick card.
 */
export interface QuickCard {
  /** Lucide icon name (string key). */
  icon: string;
  /** Korean card title. */
  title: string;
  /** Korean description. */
  description: string;
  /** Korean sample question pre-filled in the chat input. */
  sampleQuestion: string;
}

/**
 * Four Korean-language quick-start cards for the Regula home page.
 * Covers: regulation-lookup, strategy, comparison, timeline use cases.
 */
export const homeQuickCards: QuickCard[] = [
  {
    icon: 'Search',
    title: '규제 검색',
    description: '특정 규제 조항 조회',
    sampleQuestion: 'FDA 21 CFR Part 820 품질시스템 규정의 주요 요건은 무엇인가요?',
  },
  {
    icon: 'Target',
    title: '전략 수립',
    description: '허가 전략 자문',
    sampleQuestion: 'EU MDR Class IIb 의료기기의 CE 인증 전략을 수립해 주세요.',
  },
  {
    icon: 'GitCompare',
    title: '규제 비교',
    description: '국가별 요건 비교',
    sampleQuestion: 'FDA와 MFDS의 임상시험 면제(510k vs 동등성) 요건을 비교해 주세요.',
  },
  {
    icon: 'Clock',
    title: '타임라인',
    description: '허가 일정 예측',
    sampleQuestion: '한국 MFDS 2등급 의료기기 신규 허가에 소요되는 평균 기간은?',
  },
];
