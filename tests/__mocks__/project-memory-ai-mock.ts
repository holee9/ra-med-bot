// @MX:NOTE [AUTO] Shared AI mock for project-memory extractor tests.
// @MX:REASON vi.spyOn(ai, 'generateText') fails — the 'ai' package exports are
//   non-configurable. A hoisted vi.mock('ai') with an exported mock function
//   lets the extractor test control generateText return values per-test.

import { vi } from 'vitest';

export const mockGenerateText = vi.fn();

export const mockAiModule = {
  generateText: mockGenerateText,
  // biome-ignore lint/suspicious/noExplicitAny: language model type is opaque in tests
  LanguageModel: class {} as any,
};
