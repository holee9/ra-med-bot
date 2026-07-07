// Barrel export for traceability domain.
// Re-exports public API for backward compatibility and cleaner imports.

export { buildMatrix } from './matrix';
export { createEdge, deleteEdge, deleteEdgeByKey } from './graph';
export { findNodeByRef, getNode, upsertNode, listEdgesForNode } from './graph';
export { getEvidencePacket } from './evidence-packet';
export { exportPacket } from './export-packet';
export { propagateStaleFromNode, listStaleNodeIds } from './stale-propagation';
export { verifyAnswerEdges } from './verify-edges';
export { onRegulatoryUpdateSuperseded, onSourceSectionSuperseded } from './hooks';

export type { VerifyEdgesResult } from './verify-edges';
export type { EvidencePacket } from './evidence-packet';
export type { StaleReason } from './stale-reason';
export { EdgeIdorError, SelfReferenceError } from './graph';
