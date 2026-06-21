// @MX:ANCHOR [AUTO] Delta-sync pipeline entry point — corpus incremental synchronization.
// @MX:REASON fan_in >= 3: crawler completion handler, dashboard API, and gap-replay
// trigger all call this orchestrator. Coordinates detect → ingest → vectorstore.
// @MX:SPEC SPEC-REGULA-DELTA-SYNC-001 (Issue #45)

export {
  computeContentHash,
  detectChanges,
  type ChangeDetectionInput,
  type ChangeDetectionResult,
  type ChangeStatus,
} from './detector';

export {
  assembleEmbeddedChunks,
  buildOutdateOperations,
  chunkForDelta,
  type ChunkDelta,
  type EmbeddedChunk,
} from './ingest';

export {
  buildVectorizeUpsertPayload,
  defaultRetryDelay,
  MAX_RETRY_COUNT,
  shouldRetry,
  upsertWithRetry,
  type VectorizeUpsertEntry,
  type VectorizeUpsertInput,
} from './vectorstore';

export {
  shouldTriggerGapReplay,
  triggerGapReplay,
  type GapReplayInput,
  type GapReplayResult,
} from './gap-replay';
