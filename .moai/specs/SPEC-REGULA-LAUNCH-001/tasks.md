## Task Decomposition
SPEC: SPEC-REGULA-LAUNCH-001

| Task ID | Group | Description | REQ | Dependencies | Planned Files | Status |
|---------|-------|-------------|-----|--------------|---------------|--------|
| TASK-001 | A | promptfoo 설치 + config skeleton | REQ-001,002 | - | package.json, tests/eval/promptfoo.config.yaml | pending |
| TASK-002 | A | 6 dataset YAML + schema 검증 테스트 | REQ-003~005 | TASK-001 | tests/eval/datasets/{fda,eu-mdr,mfds,nmpa,pmda,internal-sop}.yaml, REVIEWED.md, tests/unit/eval-dataset-schema.test.ts | pending |
| TASK-003 | A | 4 custom scorer 구현 + unit tests | REQ-006~008,010 | TASK-001 | tests/eval/scorers/{citation-coverage,hallucination,confidence-calibration,expert-review-gating}.ts, tests/unit/scorers/*.test.ts | pending |
| TASK-004 | A | run-eval.sh + eval:ci script + Langfuse env | REQ-009,011 | TASK-001~003 | scripts/run-eval.sh, .env.eval.example | pending |
| TASK-005 | A | CI eval job 추가 | REQ-012 | TASK-004 | .github/workflows/ci.yml | pending |
| TASK-006 | B | playwright.config.ts (3 browser) | REQ-013,014 | - | playwright.config.ts | pending |
| TASK-007 | B | E2E spec 5종 + fixtures | REQ-015~019 | TASK-006 | tests/e2e/{auth,consultation,citation-click,expert-review,project-switch}.spec.ts, tests/e2e/fixtures/{msw-sse,auth}.ts | pending |
| TASK-008 | B | i18n + a11y spec | REQ-020,021 | TASK-006 | tests/e2e/{i18n,a11y}.spec.ts | pending |
| TASK-009 | B | CI e2e matrix job | REQ-022 | TASK-006~008 | .github/workflows/ci.yml | pending |
| TASK-010 | C | k6.js (steady+spike+thresholds) | REQ-023,024 | - | tests/load/k6.js | pending |
| TASK-011 | C | k6-mock.js + prod-guard test | REQ-025,028 | TASK-010 | tests/load/k6-mock.js, tests/unit/k6-prod-guard.test.ts | pending |
| TASK-012 | C | run-load.sh + scripts + reports dir | REQ-026 | TASK-010 | scripts/run-load.sh, tests/load/reports/.gitkeep | pending |
| TASK-013 | C | LCP 측정 | REQ-027 | TASK-010 | tests/load/lcp-check.js | pending |
| TASK-014 | D | OWASP 문서 + threat-model + pentest-plan | REQ-029 | - | docs/security/{owasp-top10-2025,threat-model,pentest-plan}.md | pending |
| TASK-015 | D | audit immutability + retention 통합 테스트 | REQ-030,031 | TASK-014 | tests/integration/{audit-immutability,audit-retention}.test.ts | pending |
| TASK-016 | D | security CI workflow + gitleaks | REQ-032,033 | TASK-014 | .github/workflows/security.yml, .gitleaks.toml | pending |
| TASK-017 | D | security headers E2E + Observatory | REQ-034 | TASK-006, TASK-019 | tests/e2e/security-headers.spec.ts | pending |
| TASK-018 | D | Anthropic ZDR + Sentry redaction tests | REQ-035,036 | - | tests/unit/sentry-redaction.test.ts | pending |
| TASK-019 | E | vercel.json + consult route runtime 검증 | REQ-037,038 | - | vercel.json | pending |
| TASK-020 | E | env-matrix.md + dns-setup.md | REQ-039 | - | docs/deployment/{env-matrix,dns-setup}.md | pending |
| TASK-021 | E | preflight.sh + alias scripts + shape test | REQ-040 | TASK-001~018 | scripts/preflight.sh, tests/integration/preflight-shape.test.ts | pending |
| TASK-022 | E | production env approval + runbook + post-deploy smoke | REQ-041~043 | TASK-019 | docs/runbook.md, scripts/post-deploy-smoke.sh | pending |
| TASK-023 | F | DEVELOPMENT.md + README + CHANGELOG | REQ-044,045 | TASK-001~022 | DEVELOPMENT.md, README.md, CHANGELOG.md | pending |
| TASK-024 | F | architecture + runbook + compliance + api-reference | REQ-046~048 | TASK-022 | docs/{architecture,runbook,compliance,api-reference}.md | pending |
