// @MX:NOTE [AUTO] On-prem LLM no-egress verification — supersedes REQ-LAUNCH-035 (ZDR).
// @MX:SPEC SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-035, superseded by gx10 on-prem redesign, issue #318)
//
// The original ZDR (zero-data-retention) requirement was an Anthropic-cloud mitigation.
// The gx10 redesign moves the chat/generation LLM layer to an on-prem Ollama instance
// (gpt-oss:120b) with no external egress, making ZDR moot. This test now verifies that
// (a) the legacy Anthropic ZDR singleton has been removed, and (b) the LLM provider
// routes to the on-prem endpoint with no cloud SDK instantiation in the chat layer.
//
// No live API calls — reads source files only.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

describe('On-prem LLM no-egress (gx10 redesign, issue #318)', () => {
  it('the legacy Anthropic ZDR singleton has been removed', () => {
    const legacyClient = path.join(ROOT, 'lib/ai/anthropic-client.ts');
    expect(existsSync(legacyClient), 'lib/ai/anthropic-client.ts must be deleted').toBe(false);
  });

  it('llm-provider routes to the on-prem Ollama endpoint by default', () => {
    const providerFile = path.join(ROOT, 'lib/ai/llm-provider.ts');
    expect(existsSync(providerFile)).toBe(true);
    const content = readFileSync(providerFile, 'utf-8');

    // The ollama branch must build an OpenAI-compatible client pointed at the on-prem URL.
    expect(content).toContain('createOpenAI');
    expect(content).toContain('OLLAMA_BASE_URL');
    // Default model is the gx10 on-prem gpt-oss:120b.
    expect(content).toContain('gpt-oss:120b');
  });

  it('the chat layer does not instantiate the Anthropic SDK at runtime', () => {
    const providerFile = path.join(ROOT, 'lib/ai/llm-provider.ts');
    const content = readFileSync(providerFile, 'utf-8');
    // The anthropic branch must be lazy (require()-gated) so it is never loaded
    // when LLM_PROVIDER is ollama (the on-prem default). A static top-level
    // import would pull the SDK into the runtime graph unconditionally.
    expect(content).not.toMatch(/^import.*@ai-sdk\/anthropic/m);
    expect(content).toContain("require('@ai-sdk/anthropic')");
  });
});
