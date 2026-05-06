# Session Memo

## P1: Session Context

session_id: current
cwd: D:\workspace-github\ra-med-bot
branch: main
updated: 2026-05-06

## P2: Work Gate

Issue #18 remains the mandatory preflight for every issue, SPEC, branch, PR, or implementation task.

Current verified state:

| Item | State |
|---|---|
| `HEAD` | `61137cd` |
| `origin/main` | `61137cd` |
| active branch | `main` |
| local dirty files | DEPLOY-001 Node 22 / staging secret gate follow-up in progress |
| existing open PRs | none open at preflight |
| deploy branches checked | none matching `*deploy*`, `*107*`, `*release*`, `*hardening*` |

## P3: RC1 Pipeline

| Step | Issue / PR | State | Next action |
|---|---|---|---|
| 1 | #32 RELEASE-GATE-001 | CLOSED / COMPLETED | none |
| 2 | #33 HARDENING-001 / PR #102 | MERGED | none |
| 3 | #34 QUALITY-001 / PR #103 | MERGED | none |
| 4 | #97 + #104 E2EFIX-001 / PR #106 | MERGED | none |
| 5 | #105 DEPLOY-001 | FOLLOW-UP IN PROGRESS | Deploy workflow Node.js 22 + staging secret gate correction |
| 6 | #26 build reproducibility | OPEN / IN SCOPE | bounded build and process cleanup procedure added to runbook |
| 7 | #30 PR/CI closure integrity | OPEN / IN SCOPE | PR #20/#21 and #12/#13/#14 evidence refresh in progress |
| 8 | #31 RELEASE-001 | CLOSED | `v1.0.0-rc` prerelease published |
| 9 | `v1.0.0-rc` | PUBLISHED | GitHub Release target `main` |

## P4: Issue Audit Result

The prior ordering problem came from using limited latest-updated issue queries. That missed older open issues after #22 and made Wave ordering unreliable.

Correct classification:

| Lane | Issues |
|---|---|
| RC immediate | #105 -> #26 -> #30 -> #31 -> RC tag |
| RC completed | #32, #33, #34, #97, #104 |
| Wave 3 post-RC | #22, #23, #24, #35~#43, #47, #48, #50, #51, #52, #55, #58~#62 |
| Wave 4 post-RC | #25, #44~#46, #49, #53, #54, #56, #57, #63~#65 |
| Wave 5 post-RC | #66~#72, #84~#92 |
| QA / E2E gates | #73~#83 |
| Superseded / excluded | #93~#101 |
| Persistent governance | #1, #18 |

Wave 3 starts at #22, not #45.

## P5: Follow-up Recording

This audit is recorded in:

- `.moai/runbooks/release-rc1-runbook.md`
- `README.md`
- GitHub comments on #18, #31, #73, #105

Purpose: ensure future workers can start from the issue body/runbook without reconstructing the project state from chat history.
