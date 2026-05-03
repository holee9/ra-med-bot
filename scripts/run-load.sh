#!/usr/bin/env bash
set -euo pipefail

# Regula load test runner
# Usage: ./scripts/run-load.sh [staging|mock] [--vus N] [--duration Xs]

MODE="${1:-mock}"
SCRIPT_DIR="tests/load"

case "$MODE" in
  staging)
    if [ -z "${BASE_URL:-}" ]; then
      echo "Error: BASE_URL must be set for staging load test"
      exit 1
    fi
    echo "Running staging load test against $BASE_URL"
    k6 run "$SCRIPT_DIR/k6.js" \
      -e BASE_URL="$BASE_URL" \
      -e TEST_API_KEY="${TEST_API_KEY:-}" \
      --out json="$SCRIPT_DIR/reports/$(date +%Y%m%d_%H%M%S)_staging.json"
    ;;
  mock)
    BASE_URL="${BASE_URL:-http://localhost:3000}"
    echo "Running mock load test against $BASE_URL"
    k6 run "$SCRIPT_DIR/k6-mock.js" \
      -e BASE_URL="$BASE_URL"
    ;;
  *)
    echo "Usage: $0 [staging|mock]"
    exit 1
    ;;
esac
