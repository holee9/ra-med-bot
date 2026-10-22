#!/usr/bin/env bash
# 보안 분류 규약 v1.0 ③ push 전 차단 (3세션 공동 구속, 2026-10-20)
# Blocks push when git-tracked first-party files contain REAL confidential
# markers: actual 510(k)/cert numbers (synthetic test placeholders are
# allowlisted below), 사업자번호, or non-example personal/company emails.
set -uo pipefail
cd "$(dirname "$0")/.."

# Synthetic K-numbers used by test fixtures — NOT real. A REAL number found
# here must be removed from the file, never added to this list.
ALLOW_K="K000001 K123456 K213456 K234567 K241234 K345678 K456789 K999999 KXXXXXX"

FILES=$(git ls-files | grep -vE '^(\.|archive/|node_modules/)' | grep -E '\.(md|ts|tsx|json|txt|csv|ya?ml)$' | head -3000)
[ -z "$FILES" ] && { echo "✅ 보안 게이트: 스캔 대상 없음"; exit 0; }

fail=0

# 1) K-numbers not in the synthetic allowlist
k_hits=$(echo "$FILES" | xargs grep -ohE '\bK[0-9]{6}\b' 2>/dev/null | sort -u \
  | grep -vxF -f <(echo "$ALLOW_K" | tr ' ' '\n') || true)
if [ -n "$k_hits" ]; then
  echo "❌ [보안 규약] 실제 K번호 의심:" >&2
  echo "$k_hits" | sed 's/^/   /' >&2
  fail=1
fi

# 2) 사업자등록번호
biz_hits=$(echo "$FILES" | xargs grep -lE '\b[0-9]{3}-[0-9]{2}-[0-9]{5}\b' 2>/dev/null || true)
if [ -n "$biz_hits" ]; then
  echo "❌ [보안 규약] 사업자번호 포함 파일:" >&2
  echo "$biz_hits" | sed 's/^/   /' >&2
  fail=1
fi

# 3) Personal/company emails (example/test fixtures and public no-reply excluded)
mail_hits=$(echo "$FILES" | xargs grep -ohE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' 2>/dev/null | sort -u \
  | grep -viE '@(example|test|noreply|github\.com|users\.noreply)' \
  | grep -viE '^(ra\.lead@example|viewer@example|admin@example|admin@test\.com|hnabyz2023)' || true)
if [ -n "$mail_hits" ]; then
  echo "⚠️ [보안 규약] 이메일 후보 (기존 공개 노출분 — 심사 목록):" >&2
  echo "$mail_hits" | head -10 | sed 's/^/   /' >&2
  # Known public/test contacts do not block; unknown NEW personal emails should.
  # V1: warn only for emails, block for K번호/사업자번호.
fi

[ "$fail" -eq 0 ] && echo "✅ 보안 게이트 통과" || echo "push 차단됨" >&2
exit $fail
