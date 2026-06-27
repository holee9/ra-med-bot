# Knowledge Source Boundary & Provenance Contract

> Issue #154 — REQ-INTEGRATION-001: every citation must be reproducible down to
> **host > owner/repo > ref (commit/tag) > path > anchor**.

## 1. Provenance columns (migration 0059)

Both `sources` and `source_sections` carry provenance fields so that any chunk
returned by the RAG pipeline can be traced back to an exact location in a Git
repository (or a local filesystem path for dev seeds).

### `sources`

| Column            | Type        | Purpose                                          |
|-------------------|-------------|--------------------------------------------------|
| `source_host`     | TEXT        | `github.com`, `gitea.example.com`, `local`       |
| `source_owner`    | TEXT        | Repository owner / organisation                  |
| `source_repo`     | TEXT        | Repository name                                  |
| `source_branch`   | TEXT        | Branch name (nullable for tag/commit pins)       |
| `source_ref`      | TEXT        | Commit SHA, tag, or reference                    |
| `source_path`     | TEXT        | Root path within the repository                  |
| `content_hash`    | TEXT        | SHA256 of source content (dedup + tamper check)  |
| `ingestion_run_id`| UUID        | Links to the ingestion job row                   |
| `ingested_at`     | TIMESTAMPTZ | When the source was ingested                     |

### `source_sections`

| Column            | Type        | Purpose                                          |
|-------------------|-------------|--------------------------------------------------|
| `chunk_hash`      | TEXT        | SHA256 of the section text                       |
| `section_path`    | TEXT        | Full section path (file path + anchor)           |
| `ingestion_run_id`| UUID        | Links to the ingestion job                       |
| `ingested_at`     | TIMESTAMPTZ | When the section was ingested                    |

## 2. Citation wiring (retriever → SSE → UI)

1. **Retrievers** (`lib/ai/retrievers/hybrid-search.ts`, `internal-sops.ts`)
   SELECT the provenance columns from `sources` and project them into
   `RetrievedChunk` / `RetrievalResult.metadata`.
2. **consult.ts** maps retrieved chunks → `SourceItem` (see
   `types/streaming.ts`), carrying `sourceHost`/`sourceOwner`/`sourceRepo`/
   `sourceRef`/`sourcePath`.
3. **SourceCard.tsx** renders a compact provenance row
   (`owner/repo@ref:path`) under the title when any provenance field is
   present. Hidden for external citations (FDA/EUDAMED) that lack Git
   provenance.

## 3. Seed contract (scripts/seed-local-docs.ts)

- `RA_PROJECT_PATH` and `MD_PROCESS_PATH` env vars are **required in
  production**. The script throws if either is missing and `NODE_ENV !== 'development'`.
- In development, the script falls back to the legacy hardcoded dev-machine
  paths and logs a warning.
- Every ingested `sources` row gets `sourceHost: 'local'`,
  `sourceOwner: 'internal'`, `sourceRepo: <basename>`, `sourcePath: <abs path>`,
  `contentHash: <sha256>`.
- Every `source_sections` row gets `chunkHash`, `sectionPath`, `ingestionRunId`,
  `ingestedAt`.

## 4. Re-seed runbook

See [runbook.md § Re-seed local corpus](./runbook.md#re-seed-local-corpus).
