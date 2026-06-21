---
name: QA Checkpoint
description: Post a QA plan, checkpoint, evidence, or signoff block on an implementation issue
title: "QA — <issue number>"
labels: []
body:
  - type: markdown
    attributes:
      value: |
        Use this template to post a QA block on an implementation issue tracked
        in `docs/qa/qa-matrix.md`. Pick exactly one section below and delete the
        rest. See [QA Matrix — QA Comment Templates](../../docs/qa/qa-matrix.md#qa-comment-templates)
        for the canonical format.
  - type: textarea
    id: qa-plan
    attributes:
      label: QA plan
      description: Required before implementation starts (Gate 0).
      value: |
        ## QA plan

        - Scope:
        - SPEC or issue source of truth:
        - Acceptance criteria:
        - Automated checks:
        - Fixture/mock needs:
        - External services:
        - Risk areas:
        - Gate 0 decision: PASS / BLOCKED
    validations:
      required: false
  - type: textarea
    id: qa-checkpoint
    attributes:
      label: QA checkpoint
      description: Posted during implementation (Gate 1).
      value: |
        ## QA checkpoint

        - Change checkpoint:
        - Checks run:
        - Result: PASS / FAIL / INCONCLUSIVE
        - Follow-up:
    validations:
      required: false
  - type: textarea
    id: qa-evidence
    attributes:
      label: QA evidence
      description: Required in the PR body before merge (Gate 2).
      value: |
        ## QA evidence

        - Commit or PR:
        - Commands:
        - Results:
        - Artifacts:
        - Manual signoff:
        - Residual risk:
    validations:
      required: false
  - type: textarea
    id: qa-signoff
    attributes:
      label: QA signoff
      description: Required before merge for release blockers (Gate 2).
      value: |
        ## QA signoff

        - Gate status: PASS / WAIVED / BLOCKED
        - Approver:
        - Evidence links:
        - Closure decision:
    validations:
      required: false
---

## Usage

This template is for posting a QA block as a comment on any implementation
issue tracked in [docs/qa/qa-matrix.md](../../docs/qa/qa-matrix.md). Pick the
single section that matches your current phase and delete the other three
before posting.

| Section | Phase | Gate |
|---|---|---|
| QA plan | Before branch creation | Gate 0 (#74) |
| QA checkpoint | During implementation | Gate 1 (#75) |
| QA evidence | PR body before merge | Gate 2 (#76) |
| QA signoff | Release blocker merge | Gate 2 (#76) |

Refer to [QA Gate Definitions](../../docs/qa/qa-gate-definitions.md) for the
full PASS conditions of each gate.
