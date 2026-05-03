#!/usr/bin/env bash
set -euo pipefail

# Run promptfoo evaluation
# SPEC-REGULA-LAUNCH-001 — REQ-LAUNCH-005
#
# Usage: ./scripts/run-eval.sh [--ci]

CI_MODE="${1:-}"
CONFIG="tests/eval/promptfoo.config.yaml"

if [ ! -f "$CONFIG" ]; then
  echo "Error: promptfoo config not found at $CONFIG"
  exit 1
fi

if [ "$CI_MODE" = "--ci" ]; then
  mkdir -p tests/eval/results
  pnpm promptfoo eval --config "$CONFIG" --output json --output-path tests/eval/results/latest.json
else
  pnpm promptfoo eval --config "$CONFIG"
fi
