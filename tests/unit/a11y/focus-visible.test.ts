// tests/unit/a11y/focus-visible.test.ts
// REQ-ENTERPRISE-045: focus-visible and reduced-motion CSS checks

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_FILE = path.join(process.cwd(), 'app', 'globals.css');

describe('focus-visible CSS', () => {
  it('globals.css exists', () => {
    expect(fs.existsSync(CSS_FILE)).toBe(true);
  });

  it('contains :focus-visible rule', () => {
    const css = fs.readFileSync(CSS_FILE, 'utf8');
    expect(css).toContain(':focus-visible');
  });

  it(':focus-visible has outline property', () => {
    const css = fs.readFileSync(CSS_FILE, 'utf8');
    // Find the :focus-visible block
    const focusIdx = css.indexOf(':focus-visible');
    expect(focusIdx).toBeGreaterThan(-1);
    const block = css.slice(focusIdx, focusIdx + 200);
    expect(block).toContain('outline');
  });
});

describe('prefers-reduced-motion CSS', () => {
  it('contains prefers-reduced-motion media query', () => {
    const css = fs.readFileSync(CSS_FILE, 'utf8');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('reduced-motion disables animation-duration', () => {
    const css = fs.readFileSync(CSS_FILE, 'utf8');
    expect(css).toContain('animation-duration');
  });

  it('reduced-motion disables transition-duration', () => {
    const css = fs.readFileSync(CSS_FILE, 'utf8');
    expect(css).toContain('transition-duration');
  });
});

describe('skip-to-content CSS', () => {
  it('contains .skip-to-content class', () => {
    const css = fs.readFileSync(CSS_FILE, 'utf8');
    expect(css).toContain('.skip-to-content');
  });
});
