// @MX:NOTE [AUTO] Base types for all ingestion sources (REQ-DOC-011).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-011)

/** A file discovered from a remote source. */
export interface RawFile {
  externalId: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedAt: Date;
}

/** File metadata enriched with source identifier. */
export interface RawMetadata extends RawFile {
  source: string;
}

/** Standard interface for all document ingestion sources. */
export interface IngestionSource {
  listChanged(since: Date): Promise<RawFile[]>;
  download(externalId: string): Promise<Buffer>;
  getMetadata(externalId: string): Promise<RawMetadata>;
}
