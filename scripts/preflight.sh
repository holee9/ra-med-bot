#!/usr/bin/env bash
# Regula pre-flight checklist: runs all quality gates before production deploy.
# Usage: bash scripts/preflight.sh [--skip-eval] [--skip-e2e] [--skip-load]
set -euo pipefail

SKIP_EVAL=false
SKIP_E2E=false
SKIP_LOAD=false

for arg in "$@"; do
  case "$arg" in
    --skip-eval) SKIP_EVAL=true ;;
    --skip-e2e) SKIP_E2E=true ;;
    --skip-load) SKIP_LOAD=true ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--skip-eval] [--skip-e2e] [--skip-load]"
      exit 2
      ;;
  esac
done

PASS=0
FAIL=0
SKIP=0
FAILED_STEPS=()

run_step() {
  local label="$1"
  shift
  echo ""
  echo "Step: $label"
  if "$@"; then
    echo "PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $label"
    FAIL=$((FAIL + 1))
    FAILED_STEPS+=("$label")
    return 1
  fi
}

skip_step() {
  local label="$1"
  echo ""
  echo "SKIP: $label"
  SKIP=$((SKIP + 1))
}

echo "============================================================"
echo "Regula Pre-Flight Checklist"
echo "============================================================"
echo "skip-eval=$SKIP_EVAL  skip-e2e=$SKIP_E2E  skip-load=$SKIP_LOAD"

run_step "Step 1: format check" pnpm ci:format
run_step "Step 2: lint" pnpm lint
run_step "Step 3: typecheck" pnpm typecheck
run_step "Step 4: unit tests" pnpm test
run_step "Step 5: tokens symmetry" pnpm tokens:check
run_step "Step 6: module boundaries" pnpm modules:check
run_step "Step 7: contrast check" pnpm contrast:check
run_step "Step 8: i18n completeness" pnpm i18n:check
run_step "Step 9: RBAC check" pnpm rbac:check
run_step "Step 10: audit completeness" pnpm audit:check
run_step "Step 11: migrations check" pnpm ci:migrations
run_step "Step 12: glossary check" pnpm ci:glossary
run_step "Step 13: dependency audit" pnpm audit --audit-level=high
run_step "Step 14: build" pnpm build

if [ "$SKIP_EVAL" = "true" ]; then
  skip_step "Step 15: LLM eval (promptfoo)"
else
  run_step "Step 15: LLM eval (promptfoo)" pnpm eval:ci
fi

if [ "$SKIP_E2E" = "true" ]; then
  skip_step "Step 16: E2E tests (playwright)"
else
  run_step "Step 16: E2E tests (playwright)" pnpm test:e2e --reporter=list
fi

if [ "$SKIP_LOAD" = "true" ]; then
  skip_step "Step 17: load test (k6 mock)"
else
  run_step "Step 17: load test (k6 mock)" bash scripts/run-load.sh mock
fi

echo ""
echo "============================================================"
echo "Pre-Flight Summary"
echo "Passed: $PASS  Failed: $FAIL  Skipped: $SKIP"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed steps:"
  for step in "${FAILED_STEPS[@]}"; do
    echo "  - $step"
  done
  echo ""
  exit 1
fi

echo "All checks passed. Ready to deploy."
