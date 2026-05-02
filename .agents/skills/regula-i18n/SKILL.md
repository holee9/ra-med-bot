---
name: regula-i18n
description: "Regula의 한/영 이중언어 지원 규칙. 한국어 first-class, Noto Serif KR + Pretendard 폰트 스택, locale 전환 시 대화 보존, 규제 용어 번역 일관성. 'i18n', '다국어', '국제화', 'locale', 'ko', 'en', 'Noto Serif KR', 'Pretendard', '한글', '영어' 언급 시 반드시 이 스킬 사용."
---

# Regula i18n (Korean + English)

Regula는 한국어와 영어를 **모두 first-class**로 지원한다. 프로토타입 UI는 한국어 중심이지만, 프로덕션에서는 locale switch가 UX 손실 없이 작동해야 한다.

## 원칙

- **한국어는 기본 locale.** 프로토타입 기반으로 먼저 ko 고정, en은 Phase 5에서 병행.
- **세션 유지.** locale 변경 시 대화나 현재 페이지를 새로고침하지 않음.
- **규제 용어는 번역 금지 또는 통제된 번역.** "510(k)", "MDR", "NB"는 번역하지 않음. "임상시험"과 "clinical trial"은 glossary 기반 일관성.
- **LLM 답변은 locale을 따른다.** `ConsultRequest.locale === 'en'`이면 prompt와 답변 모두 영어. citation 마크업은 언어 독립.

## 폰트 스택

### Sans
```
IBM Plex Sans  →  Pretendard  →  system-ui
```
- `IBM Plex Sans`: 라틴 기본
- `Pretendard`: 한글 (@fontsource-variable/pretendard)

### Serif
```
Source Serif 4  →  Noto Serif KR  →  Georgia
```
- `Source Serif 4`: 라틴 serif
- `Noto Serif KR`: 한글 serif (핵심 — 브랜드 차별화 요소)

### Mono
```
IBM Plex Mono  →  JetBrains Mono  →  ui-monospace
```

## Next.js font 로딩

```tsx
// app/layout.tsx
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4, Noto_Serif_KR } from 'next/font/google';
import '@fontsource-variable/pretendard';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-ibm-plex-mono', display: 'swap' });
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['400','500','600'], style: ['normal','italic'], variable: '--font-source-serif', display: 'swap' });
const notoSerifKr = Noto_Serif_KR({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-noto-serif-kr', display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning
          className={`${plexSans.variable} ${plexMono.variable} ${sourceSerif.variable} ${notoSerifKr.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

## CSS 변수 매핑

```css
/* styles/tokens.css */
@theme {
  --font-sans:  var(--font-ibm-plex-sans), 'Pretendard Variable', system-ui, sans-serif;
  --font-serif: var(--font-source-serif), var(--font-noto-serif-kr), Georgia, serif;
  --font-mono:  var(--font-ibm-plex-mono), ui-monospace, monospace;
}
```

## 딕셔너리 구조

```ts
// lib/i18n/dictionaries/ko.ts
export const ko = {
  shell: {
    newConsultation: '새로운 상담',
    home: '홈',
    history: '상담 이력',
    templates: '템플릿',
    knowledgeBase: '지식 베이스',
    regulatoryUpdates: '규제 업데이트',
    dashboard: '대시보드',
    expertReview: '전문가 검토',
  },
  chat: {
    placeholder: '규제 질문을 입력하세요...',
    send: '전송',
    analyzing: '분석 중',
    confidenceHigh: '높음',
    confidenceMed: '보통',
    confidenceLow: '낮음',
    summary: '요약 답변',
    checklist: '핵심 체크리스트',
    comparison: '주요 관할권별 비교',
    timeline: '실행 타임라인',
    sources: '출처',
    related: '이어서 질문하기',
    expertReviewBanner: '전문가 검토가 필요합니다',
  },
  citations: {
    aria: (n: number, title: string) => `출처 ${n}: ${title}, 클릭하여 보기`,
  },
  // ...
} as const;

// lib/i18n/dictionaries/en.ts
export const en = {
  shell: {
    newConsultation: 'New consultation',
    home: 'Home',
    history: 'History',
    templates: 'Templates',
    knowledgeBase: 'Knowledge Base',
    regulatoryUpdates: 'Regulatory Updates',
    dashboard: 'Dashboard',
    expertReview: 'Expert review',
  },
  chat: {
    placeholder: 'Ask a regulatory question...',
    send: 'Send',
    analyzing: 'Analyzing',
    confidenceHigh: 'High',
    confidenceMed: 'Medium',
    confidenceLow: 'Low',
    summary: 'Summary',
    checklist: 'Key checklist',
    comparison: 'Jurisdictional comparison',
    timeline: 'Timeline',
    sources: 'Sources',
    related: 'Follow-up',
    expertReviewBanner: 'Expert review required',
  },
  citations: {
    aria: (n: number, title: string) => `Source ${n}: ${title}, click to view`,
  },
  // ...
} as const;
```

## 훅과 사용

```tsx
// hooks/useI18n.ts
export function useI18n() {
  const locale = useUIStore(s => s.locale);  // 'ko' | 'en'
  const dict = locale === 'ko' ? ko : en;
  return { t: dict, locale };
}

// components/shell/Sidebar.tsx
const { t } = useI18n();
<nav>
  <Link href="/">{t.shell.home}</Link>
  <Link href="/history">{t.shell.history}</Link>
  ...
</nav>
```

## Locale 전환

```tsx
// components/shell/LocaleToggle.tsx
const setLocale = useUIStore(s => s.setLocale);

<select onChange={(e) => setLocale(e.target.value as 'ko' | 'en')}>
  <option value="ko">한국어</option>
  <option value="en">English</option>
</select>
```

**대화 보존:** locale 변경 시 URL 유지, Zustand store만 업데이트. 페이지 새로고침 없음. 현재 대화의 prose는 그대로 유지 (LLM이 생성한 원본 언어로 유지).

## 규제 용어 Glossary

```ts
// lib/i18n/regulatory-glossary.ts
// 번역하지 말 것 (원문 유지)
export const UNTRANSLATABLE = [
  '510(k)', 'MDR', 'IVDR', 'PMA', 'De Novo', 'MDSAP',
  'NB', 'CE', 'UDI', 'IFU', 'DHF', 'DMR', 'DHR',
  'GMP', 'QSR', 'QMS', 'ISO 13485', '21 CFR Part 820',
] as const;

// 통제된 번역 (일관성 유지)
export const CONTROLLED_TRANSLATIONS = {
  '임상시험': 'clinical investigation',
  '임상평가': 'clinical evaluation',
  '시판전 신고': 'premarket notification',
  '시판후 감시': 'post-market surveillance',
  '기술문서': 'technical documentation',
  '품질시스템': 'quality management system',
  '이상사례': 'adverse event',
  // ...
} as const;
```

regula-rag-pipeline의 prompt에서 이 glossary를 주입하여 LLM이 번역 시 일관성 유지.

## LLM locale 분기

```ts
// lib/ai/prompts.ts
export function buildSystemPrompt(locale: 'ko' | 'en') {
  if (locale === 'ko') {
    return `당신은 의료기기 규제 전문가입니다. 아래 출처 중심으로...
    모든 사실 주장에 <sup class="cite" data-source="N">N</sup> 형식의 inline citation을 포함하세요.
    510(k), MDR, NB 등 고유 용어는 번역하지 마세요.`;
  }
  return `You are a medical device regulatory affairs expert. Based strictly on the sources below...
  Include inline citations in <sup class="cite" data-source="N">N</sup> format for every factual claim.`;
}
```

## 접근성

- `<html lang={locale}>` 동적 업데이트
- 스크린 리더 힌트는 해당 locale의 딕셔너리 사용
- RTL은 현재 미지원 (향후 아랍어/히브리어 지원 시 별도 고려)

## 체크리스트 (regula-compliance-qa)

- [ ] Noto Serif KR이 실제 로딩되는가 (Network tab에서 확인)
- [ ] locale 전환 시 URL / 대화 상태 유지되는가
- [ ] en 딕셔너리 키가 ko와 완전 일치하는가 (누락 감지)
- [ ] LLM prompt가 locale에 따라 분기되는가
- [ ] 규제 고유 용어가 en 답변에서 번역되지 않는가
- [ ] `<html lang>` 속성이 현재 locale과 일치하는가
