#!/usr/bin/env bash
# Post-deployment smoke test for Regula production environment.
# Usage: BASE_URL=https://regula.app bash scripts/post-deploy-smoke.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
FAILED=()

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url")
  if [ "$status" = "$expected" ]; then
    echo "  ✓ $label ($status)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label — expected $expected, got $status"
    FAIL=$((FAIL + 1))
    FAILED+=("$label")
  fi
}

check_header() {
  local label="$1"
  local url="$2"
  local header="$3"
  local expected="$4"
  local value
  value=$(curl -s -I --max-time 10 "$url" | grep -i "^$header:" | tr -d '\r' | cut -d' ' -f2-)
  if echo "$value" | grep -qi "$expected"; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label — expected '$expected', got '$value'"
    FAIL=$((FAIL + 1))
    FAILED+=("$label")
  fi
}

echo "╔══════════════════════════════════════════════════════╗"
echo "║         Regula Post-Deploy Smoke Test                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo "Target: $BASE_URL"
echo ""

echo "── HTTP Endpoints"
check "Home page"                  "$BASE_URL/"
check "Health check"               "$BASE_URL/api/health"
check "Auth endpoint"              "$BASE_URL/api/auth/providers"
check "Robots.txt"                 "$BASE_URL/robots.txt"

echo ""
echo "── Security Headers"
check_header "X-Frame-Options DENY"           "$BASE_URL/" "X-Frame-Options" "DENY"
check_header "X-Content-Type-Options nosniff" "$BASE_URL/" "X-Content-Type-Options" "nosniff"
check_header "HSTS header present"            "$BASE_URL/" "Strict-Transport-Security" "max-age"

echo ""
echo "── API Availability (unauthenticated — expect 401)"
check "RA consult API (unauthed)"  "$BASE_URL/api/ra/consult" "401"
check "RA projects API (unauthed)" "$BASE_URL/api/ra/projects" "401"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Smoke Test Summary"
echo "║  Passed: $PASS  Failed: $FAIL"
echo "╚══════════════════════════════════════════════════════╝"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Failed checks:"
  for f in "${FAILED[@]}"; do
    echo "  • $f"
  done
  echo ""
  exit 1
fi

echo "All smoke checks passed."
