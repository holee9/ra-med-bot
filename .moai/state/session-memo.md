# Session Memo

## P1: Session Context

session_id: ac96dd5c-0ce7-4ea8-a3ba-a518e29cbaae
cwd: /home/abyz-lab/work/workspace-github/holee9/ra-med-bot
event: PreCompact

## P2: 2026-06-16 PR #174 CI Recovery

| Item | State |
|---|---|
| active branch | `fix/digest-generator-parse-error` |
| current HEAD at start | `ccd7d97af0f5b0951944fdd1ef20f81dbd182962` |
| main reference | `243fcda70541fda42cd4cb903e5dedfadeb5de67` (`origin/main`) |
| PR | #174 `fix(digest): digest-generator parse 오류 수정 및 Biome lint 전면 적용` |
| #18 work gate | rechecked before edits; no stale branch merge performed |

Fixes applied:

- Removed incompatible `ai` major override so app code resolves `ai` back to 3.4.x.
- Restored Vitest compatibility by reverting direct `vitest` dependency to 1.6.x and removing incompatible Vitest/Vite major overrides.
- Added root `vite` 5.4.x dev dependency so Vitest config and React plugin share the same Vite type family.
- Restored AI SDK v3 stream chunk usage and embedding model bridge casts in affected AI retriever paths.
- Fixed Vitest v1 mock typings without `any`.
- Kept `calculateDeadline()` returning a definite `string` without Biome-forbidden non-null assertion.
- Adjusted digest email escaping from `&#039;` to `&apos;` so `lint:hex` does not misclassify the entity as a raw color.

Verification:

| Command | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| targeted Vitest for predicate cache/comparison/internal SOP retriever | 20 tests pass |
| `pnpm build` | pass with non-fatal optional extractor warnings |
| `git diff --check` | pass |
