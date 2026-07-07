// Barrel export for signature domain.
// Re-exports public API for backward compatibility and cleaner imports.

export { computeAnswerHash } from './hash';
export { getActiveSignature, insertSignature, revokeSignature } from './queries';
export { getAuthorizedSignatureMessage } from './authorization';
export { isAnswerLocked } from './lock';
export { injectSignatureToPDFData } from './pdf-inject';

export type { AuthorizedSignatureMessage } from './authorization';
export type { HashableBlock } from './hash';
export type { SignatureRow, InsertSignatureData } from './queries';
export type { PDFSignatureData } from './pdf-inject';
