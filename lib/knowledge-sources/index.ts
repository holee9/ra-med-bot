// Barrel export for knowledge-sources domain.
// Re-exports public API for backward compatibility and cleaner imports.

export { assertKnowledgeSourceInOrg } from './access';
export { ingestDocuments } from './sync';
export { syncKnowledgeSource } from './sync';
export { parseGitUrl } from './parse-git-url';

export type { ParsedGitUrl } from './parse-git-url';
