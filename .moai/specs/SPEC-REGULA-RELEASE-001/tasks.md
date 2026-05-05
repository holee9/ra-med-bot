# SPEC-REGULA-RELEASE-001 Tasks

## Release Task Order

### T-001 - Scope Freeze

Linked: REQ-REL-001, #18, #22, #23, #24, #25

- Confirm 1차 릴리즈 includes current implemented surface only.
- Mark #22~#25 as post-v0.1 unless explicitly pulled into release scope.
- Ensure README/roadmap wording does not imply open Wave 3/4 features are release blockers.

Done:

- Release scope table updated or confirmed.
- #18 comment records scope freeze.

### T-002 - PR and Issue Closure Integrity

Linked: REQ-REL-010, REQ-REL-011, #12, #13, #30, PR #20, PR #21

- Fix PR #20 E2E failures.
- Fix PR #21 CI Gates failures.
- Verify #12/#13/#14 closure metadata and comments.
- Close only after merge or verified main-equivalent evidence.

Done:

- All checks green.
- Issue comments include final commit/PR evidence.

### T-003 - Build Reproducibility

Linked: REQ-REL-020, #26

- Establish bounded local `pnpm ci:build` command.
- Document env placeholder set matching CI.
- Add process cleanup notes for hung Node/Next/esbuild processes.

Done:

- CI build pass linked.
- Local build instructions are deterministic and time-bounded.

### T-004 - Placeholder and Deferred Integration Sweep

Linked: REQ-REL-030, #27

- Classify TODO/placeholder/stub occurrences.
- Resolve in-scope production paths.
- Feature-gate or document deferred integrations.

Done:

- `git grep` evidence attached to #27.
- User-visible release flows do not show implementation placeholders.

### T-005 - Runtime Logging Policy

Linked: REQ-REL-040, #29

- Classify runtime `console.*` usages.
- Replace unsafe logs with structured logger or safe observability hooks.
- Keep audit logging separate from operational logging.

Done:

- No PII/raw prompt/raw answer in runtime logs.
- Safe exceptions are documented.

### T-006 - Security and Compliance Gate

Linked: REQ-REL-050, #26, #27, #29, #30

- Verify append-only audit.
- Verify security headers E2E.
- Verify dependency scan and gitleaks.
- Verify docs match actual deployment behavior.

Done:

- Security scan green.
- Required compliance tests pass.

### T-007 - Handoff and Release Notes

Linked: REQ-REL-060, #28

- Clean or document worktree state.
- Resolve `.worktrees/` and `.moai/state/session-memo.md` policy.
- Produce release notes.
- Tag only after release candidate criteria pass.

Done:

- `git status --short --branch` clean or intentionally documented.
- Release notes include scope, exclusions, verification, limitations, rollback.

