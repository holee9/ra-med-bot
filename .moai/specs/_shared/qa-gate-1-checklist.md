# QA Gate 1 Checklist Template

## Issue Information

- **Issue Number:** #{ISSUE_NUMBER}
- **Issue Title:** {ISSUE_TITLE}
- **SPEC ID:** {SPEC_ID}
- **Implementation Branch:** {BRANCH_NAME}
- **Checkpoint Date:** {CHECK_DATE}
- **Checked by:** {PENDING}

## Prerequisites

### Gate 0 Completion
- [ ] Gate 0 checklist passed
- [ ] SPEC document approved
- [ ] Implementation branch created

### Code Quality Baseline
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Linter passes (`pnpm lint`)
- [ ] Base unit tests pass (`pnpm test`)

## Implementation Checkpoint

### Unit Test Coverage
- [ ] New functions have unit tests
- [ ] Edge cases covered (null, undefined, empty, boundary values)
- [ ] Error paths tested
- [ ] Mock external dependencies
- [ ] Test coverage ≥ 80% for new code

### API Contract Validation (if applicable)
- [ ] Request schema matches Zod validation
- [ ] Response schema documented and tested
- [ ] Status codes correct (200/201/400/401/403/404/500)
- [ ] Error messages user-friendly
- [ ] Rate limiting applied (if public endpoint)

### Citation Coverage (if applicable)
- [ ] citation-required responses include citations
- [ ] Citation count ≥ 1 for RA domain queries
- [ ] Citation source links valid
- [ ] Citation metadata complete (source, page, section)
- [ ] No citation orphan (answer without source)

### Audit Log Verification (if applicable)
- [ ] audit_logs row created for relevant actions
- [ ] Event type correct (create/update/delete/read)
- [ ] User ID recorded
- [ ] Timestamp accurate
- [ ] Resource identifiers documented
- [ ] Before/after state captured for mutations

### RBAC & Authorization (if applicable)
- [ ] Positive path: authorized user can access
- [ ] Negative path: unauthorized user rejected
- [ ] Department ACL enforced (if applicable)
- [ ] Admin-only endpoints protected
- [ ] Public endpoints documented as such
- [ ] Permission check before resource access

### Database & Schema (if applicable)
- [ ] Migration file created (if schema change)
- [ ] Migration backward-compatible
- [ ] Indexes added for new query patterns
- [ ] Foreign key constraints validated
- [ ] Seed data updated (if needed)
- [ ] Rollback migration tested

### External API Integration (if applicable)
- [ ] Mock service defined for dev/test
- [ ] Timeout configured (≤ 30s)
- [ ] Retry logic for transient failures
- [ ] Rate limit handling (429 responses)
- [ ] Circuit breaker for downstream failures
- [ ] Failure mode graceful degradation

### LLM & RAG Pipeline (if applicable)
- [ ] Prompt changes versioned
- [ ] Retrieval parameters documented
- [ ] Rerank configuration validated
- [ ] Confidence score threshold set
- [ ] Fallback behavior for LLM failures
- [ ] Expert review gating logic tested

## Regression Testing

### Contract Tests
- [ ] Existing API contracts unchanged
- [ ] Breaking changes flagged in PR title
- [ ] Migration scripts tested on fresh DB
- [ ] Rollback verified

### Cross-Feature Integration
- [ ] No citation regression (existing queries still cite)
- [ ] No audit regression (existing events still logged)
- [ ] No RBAC regression (existing permissions unchanged)
- [ ] No performance regression (response time stable)

## Security & Compliance

### Security Checks
- [ ] No hardcoded secrets
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (DOMPurify on user content)
- [ ] CSRF tokens (if state-changing operations)

### Accessibility (if UI changes)
- [ ] Keyboard navigation works
- [ ] Screen reader labels present
- [ ] Color contrast WCAG AA compliant
- [ ] Focus indicators visible
- [ ] Error messages announced to screen readers

## Performance

### Response Time
- [ ] API response ≤ 2s (p95)
- [ ] Database query ≤ 500ms
- [ ] LLM call ≤ 30s (or streaming)
- [ ] No N+1 query pattern

### Resource Usage
- [ ] Memory leaks checked (no growing buffers)
- [ ] Connection pooling efficient
- [ ] File handles closed properly
- [ ] Background jobs complete

## QA Evidence

### Test Execution Results
- [ ] Unit test output attached (`pnpm test`)
- [ ] Typecheck output attached (`pnpm typecheck`)
- [ ] Linter output attached (`pnpm lint`)
- [ ] Build output attached (`pnpm build`)

### Manual QA Evidence (if applicable)
- [ ] Screenshots of UI flows
- [ ] API curl examples
- [ ] Database query examples
- [ ] Audit log entries
- [ ] Citation examples

### CI/CD Artifacts
- [ ] CI run link attached
- [ ] Test coverage report attached
- [ ] Build artifacts link attached
- [ ] Deployment preview link (if applicable)

## Blocker Issues

### Critical Blockers
- [ ] No critical bugs unresolved
- [ ] No security vulnerabilities
- [ ] No data loss risk
- [ ] No performance regression P95

### Workarounds Documented
- [ ] Known issues documented
- [ ] Temporary workarounds explained
- [ ] Follow-up issues created
- [ ] Risk acceptance recorded (if applicable)

## Gate 1 Status

**Checkpoint Result:** [ ] PASSED | [ ] FAILED | [ ] CONDITIONAL

**Reviewer:** {PENDING}  
**Review Date:** {PENDING}  
**Approval Status:** [ ] APPROVED | [ ] REJECTED | [ ] REQUEST CHANGES

**Reviewer Comments:**

{PENDING}

---

## Next Steps

### PASSED
- Continue with implementation
- Next checkpoint scheduled: {NEXT_CHECKPOINT_DATE}
- Merge to integration branch when ready

### FAILED
- Address checklist failures
- Re-run checkpoint tests
- Re-submit for review

### CONDITIONAL
- Address non-blocking issues
- Document risk acceptance
- Proceed with monitoring
