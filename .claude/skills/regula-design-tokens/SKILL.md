---
name: regula-design-tokens
description: "Regula의 디자인 토큰 매핑 규칙. tokens.css → Tailwind v4 @theme, Serif/Sans 타이포 디시플린, 다크 모드 분기, 간격/반경/그림자 토큰. 'Tailwind', 'tokens', 'theme', 'serif', '다크 모드', '디자인 토큰' 언급 시 반드시 이 스킬 사용. 임의 색 하드코딩 방지 규칙 포함."
---

# Regula Design Tokens

`design_handoff_regula/design_files/styles/tokens.css`를 Tailwind v4 `@theme`에 1:1 매핑하는 규칙 모음.

## 매핑 원칙

**tokens.css = 단일 진실원.** Tailwind 기본 팔레트를 건드리지 않고, `@theme` 블록에서 모든 색을 재정의한다. 새 토큰을 임의로 만들지 않는다.

## Tailwind v4 `@theme` 구조

```css
/* styles/tokens.css */
@import "tailwindcss";

@theme {
  /* Brand — Deep Navy (tokens.css --brand-N) */
  --color-brand-50:  #f4f7fb;
  --color-brand-100: #e6ecf5;
  --color-brand-200: #c5d2e5;
  --color-brand-300: #7e9bc4;
  --color-brand-400: #4a6fa8;
  --color-brand-500: #2b4d8a;
  --color-brand-600: #1f3a6b;
  --color-brand-700: #16294f;
  --color-brand-800: #0f1e3a;
  --color-brand-900: #0a1628;

  /* Amber — Regulatory accent */
  --color-amber-50:  #fffaed;
  --color-amber-100: #fdf3d9;
  --color-amber-400: #e6ab33;
  --color-amber-500: #d89400;
  --color-amber-600: #b27300;
  --color-amber-700: #8a5a00;

  /* Semantic */
  --color-success:    #0f7a4d;
  --color-success-bg: #e6f4ed;
  --color-warn:       #a85c00;
  --color-warn-bg:    #fdf1de;
  --color-danger:     #a8142b;
  --color-danger-bg:  #fce8eb;

  /* Ink (warm cool gray) — ladder from tokens.css */
  --color-ink-50:  #f7f9fb;
  /* ... 중략 — tokens.css의 전체 ladder 그대로 복제 ... */
  --color-ink-950: #0c1116;

  /* Typography stacks */
  --font-sans:  'IBM Plex Sans', 'Pretendard', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Source Serif 4', 'Noto Serif KR', Georgia, serif;
  --font-mono:  'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace;

  /* Type scale */
  --text-xs:  11px;
  --text-5xl: 48px;
  /* ... */

  /* Spacing (4px base) */
  --spacing-1:  4px;
  --spacing-12: 96px;

  /* Radii */
  --radius-xs:   4px;
  --radius-2xl:  20px;
  --radius-full: 999px;

  /* Motion */
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

/* Dark mode — tokens.css의 [data-theme="dark"] 블록 복제 */
[data-theme="dark"] {
  --color-brand-50:  /* dark mode 대응값 */;
  /* ... 모든 color 토큰 dark 값 ... */
}
```

## Serif/Sans 디시플린 (브랜드 요구)

**Serif가 필수인 곳:**
- H1 (Home hero, Chat empty state "새로운 상담")
- 문서 뷰어 본문 (DocViewer main content)
- Stat 값 (Dashboard stat cards의 숫자)
- 채팅 사용자 질문 (26px, weight 500)
- 인용된 규제 텍스트 (amber-underlined passages)
- 리스트/템플릿/Updates/Source 카드의 타이틀

**Sans를 쓰는 곳:**
- Nav, buttons, chips, meta text, 설명 문장, form labels

**Tailwind 사용 패턴:**

```tsx
<h1 className="font-serif text-5xl">무엇을 <em>검토</em>해 드릴까요?</h1>
<p className="font-sans text-base text-ink-600">설명 문장</p>
<span className="font-mono text-xs">2026-04-22</span>
```

## 자주 쓰는 유틸리티 (매핑 참조)

| 토큰 | Tailwind class | 용도 |
|------|---------------|------|
| `--brand-800` | `bg-brand-800` / `text-brand-800` | Primary button bg |
| `--brand-100` | `bg-brand-100` | Citation badge bg |
| `--amber-500` | `bg-amber-500` / `text-amber-500` | Regulatory accent |
| `--success-bg` | `bg-success-bg` | High confidence badge |
| `--ink-600` | `text-ink-600` | Tertiary body text |
| `--radius-xs` | `rounded-xs` (4px) | Chip radius |
| `--spacing-4` | `p-4` (16px) | Card padding |

## 레이아웃 상수

CSS 변수로 유지 (Tailwind 유틸리티로 내보내기 부적합):

```css
:root {
  --nav-w: 260px;
  --topbar-h: 56px;
  --right-w: 360px;
  --content-max: 840px;
}
```

## 금지 패턴

- **임의 hex 색 하드코딩 금지.** `bg-[#0f1e3a]`는 리뷰에서 리젝트. `bg-brand-800`으로.
- **arbitrary text size 금지.** `text-[13px]` 대신 type scale 확장 또는 가까운 표준 사용.
- **`color-brand-500`을 다른 의도로 재사용 금지.** focus ring 전용.
- **Serif를 sans로 대체 금지.** H1, 인용문, stat 값은 serif 엄수.

## 다크 모드 구현

```tsx
// app/layout.tsx
<html lang="ko" suppressHydrationWarning>

// components/shell/Topbar.tsx 내 토글
const toggle = () => {
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('regula-theme', next);
};
```

`prefers-color-scheme`은 최초 방문 시에만 존중 (localStorage에 값 있으면 그것 우선).

## 폰트 로딩

```tsx
// app/layout.tsx
import { IBM_Plex_Sans, IBM_Plex_Mono, Source_Serif_4, Noto_Serif_KR } from 'next/font/google';
// Pretendard는 @fontsource-variable/pretendard에서
import '@fontsource-variable/pretendard';
```

CSS 변수 연결:

```css
html {
  font-family: var(--font-sans);
}
```

## 접근성 기본

- Focus ring: `focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2`
- Reduced motion: 모든 transition은 `motion-safe:transition-all motion-safe:duration-200`
- 색 대비: 본문 텍스트 (ink-700) vs 배경 (surface)는 AA 4.5:1 이상. dark 모드에서도 동일 기준.
