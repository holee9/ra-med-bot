// @MX:NOTE: [AUTO] k6 script shape validation — REQ-LAUNCH-023, REQ-LAUNCH-024
// @MX:SPEC: SPEC-REGULA-LAUNCH-001
// Reads the k6 JS files as text and asserts structural properties.
// k6 scripts are NOT Node.js-compatible so we never import them — only inspect content.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const k6Path = path.join(root, 'tests', 'load', 'k6.js');
const k6MockPath = path.join(root, 'tests', 'load', 'k6-mock.js');

describe('tests/load/k6.js — REQ-LAUNCH-023 / REQ-LAUNCH-024', () => {
  it('file exists', () => {
    expect(fs.existsSync(k6Path), `k6.js not found at ${k6Path}`).toBe(true);
  });

  it('contains http_req_duration threshold', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    expect(content).toContain('http_req_duration');
  });

  it('contains p(95)<1500 threshold for first token latency', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    expect(content).toContain('p(95)<1500');
  });

  it('contains p(95)<8000 threshold for full response latency', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    expect(content).toContain('p(95)<8000');
  });

  it('contains steady scenario with 50 VU target', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    // Matches "target: 50" for the steady-state stage
    expect(content).toMatch(/target:\s*50/);
  });

  it('contains spike scenario with 100 VU target', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    // Matches "target: 100" for the spike stage
    expect(content).toMatch(/target:\s*100/);
  });

  it('uses ramping-vus executor for at least one scenario', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    expect(content).toContain('ramping-vus');
  });

  it('declares consult_first_token custom metric', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    expect(content).toContain('consult_first_token');
  });

  it('declares http_req_failed error rate threshold < 0.01', () => {
    const content = fs.readFileSync(k6Path, 'utf8');
    expect(content).toContain('http_req_failed');
    expect(content).toMatch(/rate\s*<\s*0\.01/);
  });
});

describe('tests/load/k6-mock.js — REQ-LAUNCH-025', () => {
  it('file exists', () => {
    expect(fs.existsSync(k6MockPath), `k6-mock.js not found at ${k6MockPath}`).toBe(true);
  });

  it('reads BASE_URL from __ENV', () => {
    const content = fs.readFileSync(k6MockPath, 'utf8');
    expect(content).toContain('BASE_URL');
    expect(content).toContain('__ENV');
  });
});
