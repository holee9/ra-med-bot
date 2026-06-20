# QA Gate 0 Checklist Template

## Issue Information

- **Issue Number:** #{ISSUE_NUMBER}
- **Issue Title:** {ISSUE_TITLE}
- **SPEC ID:** {SPEC_ID}
- **Checked by:** {REVIEWER_NAME}
- **Check Date:** {CHECK_DATE}

## Prerequisites

### Branch Readiness
- [ ] Latest `main` branch pulled
- [ ] No stale branch conflicts
- [ ] Implementation branch created: `{BRANCH_NAME}`
- [ ] Base branch: `main`

### Issue-SPEC Alignment
- [ ] Issue body scope matches SPEC document
- [ ] SPEC document exists: `{SPEC_PATH}`
- [ ] README roadmap alignment verified
- [ ] #73 QA Matrix scope/priority aligned
- [ ] No silent additions or omissions

## Requirements Validation

### Acceptance Criteria (AC) Quality
- [ ] All REQ/AC written as testable statements
- [ ] No ambiguous "should" language in REQ/AC
- [ ] Untestable AC count: 0
- [ ] AC specific and measurable
- [ ] Negative paths and edge cases covered

### Scope Clarity
- [ ] In-scope items explicitly listed
- [ ] Out-of-scope items documented
- [ ] Deferred items tracked separately
- [ ] Placeholder language removed

## Dependencies & Fixtures

### External Dependencies
- [ ] External API dependencies identified
- [ ] Mock definitions documented
- [ ] External service contracts defined

### Test Data & Fixtures
- [ ] Required seed data listed
- [ ] Test fixtures specified
- [ ] Test database migrations identified
- [ ] Mock external API versions specified

### Prerequisite Issues
- [ ] Dependency issues identified
- [ ] Predecessor gate states confirmed
- [ ] #18 Work Gate state recorded

## Impact Analysis

### Impact Axes Tagged
- [ ] **schema:** Database schema changes
- [ ] **API:** Route handler changes
- [ ] **RBAC:** Role/permission changes
- [ ] **audit:** Audit log requirements
- [ ] **citation:** Citation requirements
- [ ] **export:** Export functionality
- [ ] **i18n:** Internationalization
- [ ] **a11y:** Accessibility requirements
- [ ] **security:** Security considerations
- [ ] **performance:** Performance impact

## Risk Assessment

### Technical Risks
- [ ] High-risk areas identified
- [ ] Mitigation strategies documented
- [ ] Rollback plan defined

### QA Risks
- [ ] Test automation gaps identified
- [ ] Manual QA requirements documented
- [ ] Success criteria clearly defined

## Completion Criteria

### Gate 0 Pass Conditions
- [ ] All checklist items completed
- [ ] Reviewer approval obtained
- [ ] Branch creation authorized
- [ ] Implementation ready to start

### Blocker Issues
- [ ] No critical blockers unresolved
- [ ] All dependencies satisfied
- [ ] No scope creep detected

## Reviewer Approval

**Reviewer:** {REVIEWER_NAME}  
**Approval Status:** [ ] APPROVED | [ ] REJECTED | [ ] CONDITIONAL  
**Comments:**

{REVIEWER_COMMENTS}

---

**Gate 0 Status:** [ ] PASSED | [ ] FAILED | [ ] DEFERRED

**Next Steps:**
- PASSED: Proceed to implementation branch creation
- FAILED: Address checklist items and re-submit
- DEFERRED: Move to future sprint
