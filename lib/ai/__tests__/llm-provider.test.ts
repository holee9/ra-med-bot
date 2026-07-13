// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/ai/llm-provider (SPEC-LLM-MIGRATION-BC).
// @MX:SPEC SPEC-LLM-MIGRATION-BC

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modelFactory = vi.fn((name: string) => ({ modelId: name }));
const createOllama = vi.fn(() => modelFactory);

vi.mock('ollama-ai-provider', () => ({ createOllama }));

const { getLlmFastModel, getLlmModel } = await import('../llm-provider');

const origEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // Set explicit defaults so tests are deterministic regardless of .env files.
  process.env.OLLAMA_BASE_URL = 'http://192.168.100.1:11434/api';
  process.env.OLLAMA_MODEL = 'gpt-oss:120b';
  process.env.OLLAMA_FAST_MODEL = '';
});

afterEach(() => {
  process.env = { ...origEnv };
});

describe('llm-provider (SPEC-LLM-MIGRATION-BC)', () => {
  it('getLlmModel uses the configured model and base URL', () => {
    getLlmModel();
    expect(createOllama).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'http://192.168.100.1:11434/api' }),
    );
    expect(modelFactory).toHaveBeenCalledWith('gpt-oss:120b');
  });

  it('respects OLLAMA_MODEL override', () => {
    process.env.OLLAMA_MODEL = 'llama3:70b';
    getLlmModel();
    expect(modelFactory).toHaveBeenLastCalledWith('llama3:70b');
  });

  it('converts /v1 base URL to native /api', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434/v1';
    getLlmModel();
    expect(createOllama).toHaveBeenLastCalledWith({ baseURL: 'http://localhost:11434/api' });
  });

  it('getLlmFastModel falls back to main model when OLLAMA_FAST_MODEL is empty', () => {
    Reflect.deleteProperty(process.env, 'OLLAMA_FAST_MODEL');
    getLlmFastModel();
    expect(modelFactory).toHaveBeenLastCalledWith('gpt-oss:120b');
  });

  it('getLlmFastModel uses OLLAMA_FAST_MODEL when set', () => {
    process.env.OLLAMA_FAST_MODEL = 'fast-model';
    getLlmFastModel();
    expect(modelFactory).toHaveBeenLastCalledWith('fast-model');
  });
});
