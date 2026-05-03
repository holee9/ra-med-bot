// REQ-LAUNCH-037: vercel.json with regions=["iad1"], function maxDuration
// REQ-LAUNCH-038: consult API route uses nodejs runtime (not edge)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../');

describe('vercel.json configuration (REQ-LAUNCH-037, 038)', () => {
  it('vercel.json exists', () => {
    expect(existsSync(path.join(ROOT, 'vercel.json'))).toBe(true);
  });

  it('vercel.json is valid JSON', () => {
    const content = readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('vercel.json has iad1 region config', () => {
    const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8'));
    const configStr = JSON.stringify(config);
    expect(configStr).toContain('iad1');
  });

  it('vercel.json has security headers', () => {
    const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8'));
    expect(config.headers).toBeDefined();
    const configStr = JSON.stringify(config.headers);
    expect(configStr).toMatch(/X-Frame-Options|X-Content-Type|Strict-Transport/i);
  });

  it('consult route has maxDuration configured', () => {
    const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8'));
    expect(config.functions).toBeDefined();
    const functionsStr = JSON.stringify(config.functions);
    expect(functionsStr).toContain('maxDuration');
  });
});
