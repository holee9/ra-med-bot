// @MX:NOTE Tailwind v4 config. Most theme tokens live in styles/tokens.css
// via the `@theme` directive (REQ-FND-029). This file exists primarily to
// satisfy the content glob discovery and dark-mode strategy
// (REQ-FND-029a: darkMode: 'class').

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    // Theme extension is intentionally empty here — design tokens are defined
    // in styles/tokens.css using the v4 `@theme` block. See regula-design-tokens skill.
    extend: {},
  },
  plugins: [],
};

export default config;
