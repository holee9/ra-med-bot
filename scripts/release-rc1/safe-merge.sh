#!/usr/bin/env bash
# scripts/release-rc1/safe-merge.sh
# 각 worktree 작업 완료 후 PR 생성 전 안전 점검 스크립트
#
# 사용법:
#   ./scripts/release-rc1/safe-merge.sh 99   # issue-99 worktree 점검
#   ./scripts/release-rc1/safe-merge.sh 97
#   ./scripts/release-rc1/safe-merge.sh 98
#   ./scripts/release-rc1/safe-merge.sh 100

set -euo pipefail

ISSUE="${1:-}"
if [[ -z "$ISSUE" ]]; then
  echo "Usage: $0 <issue-number>"
  echo "Example: $0 99"
  exit 1
fi

WORKTREE_PATH="worktrees/issue-${ISSUE}"
REPO_ROOT="$(git rev-parse --show-toplevel)"

if [[ ! -d "${REPO_ROOT}/${WORKTREE_PATH}" ]]; then
  echo "❌ worktree not found: ${REPO_ROOT}/${WORKTREE_PATH}"
  exit 1
fi

echo ""
echo "======================================"
echo " Safe Merge Check — Issue #${ISSUE}"
echo "======================================"
echo ""

# 1. worktree 브랜치 확인
BRANCH=$(git -C "${REPO_ROOT}/${WORKTREE_PATH}" branch --show-current)
echo "▸ Branch: ${BRANCH}"

# 2. origin/main과 차이 확인
AHEAD=$(git -C "${REPO_ROOT}/${WORKTREE_PATH}" rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
BEHIND=$(git -C "${REPO_ROOT}/${WORKTREE_PATH}" rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
echo "▸ Commits ahead of main: ${AHEAD}"
echo "▸ Commits behind main:   ${BEHIND}"

if [[ "$BEHIND" != "0" && "$BEHIND" != "?" ]]; then
  echo ""
  echo "⚠️  main보다 ${BEHIND}개 커밋 뒤처짐. rebase 필요:"
  echo "   cd ${WORKTREE_PATH} && git fetch origin && git rebase origin/main"
  echo ""
fi

# 3. uncommitted 변경 확인
DIRTY=$(git -C "${REPO_ROOT}/${WORKTREE_PATH}" status --porcelain | wc -l | tr -d ' ')
if [[ "$DIRTY" != "0" ]]; then
  echo "⚠️  미커밋 변경 ${DIRTY}개 존재:"
  git -C "${REPO_ROOT}/${WORKTREE_PATH}" status --short
  echo ""
else
  echo "✅ 워킹 트리 깨끗함"
fi

# 4. 파일 소유권 충돌 점검 (다른 이슈 소유 파일 수정 여부)
echo ""
echo "▸ 파일 소유권 점검..."

declare -A FORBIDDEN
FORBIDDEN[99]="tests/e2e tests/fixtures/auth.ts playwright.config.ts .github/workflows/deploy .github/workflows/ci.yml app/layout.tsx lib/observability"
FORBIDDEN[97]="scripts/setup-env scripts/dev-bootstrap lib/env.ts DEVELOPMENT.md .github/workflows/deploy app/layout.tsx lib/observability"
FORBIDDEN[98]="scripts/setup-env scripts/dev-bootstrap lib/env.ts DEVELOPMENT.md tests/e2e tests/fixtures/auth.ts playwright.config.ts app/layout.tsx lib/observability"
FORBIDDEN[100]="scripts/setup-env scripts/dev-bootstrap lib/env.ts DEVELOPMENT.md tests/e2e/auth tests/e2e/consultation tests/e2e/expert-review tests/e2e/project-switch tests/e2e/i18n tests/e2e/a11y tests/e2e/security-headers .github/workflows/deploy .github/workflows/ci.yml"

CHANGED_FILES=$(git -C "${REPO_ROOT}/${WORKTREE_PATH}" diff --name-only origin/main...HEAD 2>/dev/null || echo "")

CONFLICT=0
if [[ -n "${FORBIDDEN[$ISSUE]:-}" ]]; then
  for PATTERN in ${FORBIDDEN[$ISSUE]}; do
    MATCHES=$(echo "$CHANGED_FILES" | grep "$PATTERN" || true)
    if [[ -n "$MATCHES" ]]; then
      echo "  ❌ 소유권 충돌 가능: $PATTERN"
      echo "$MATCHES" | sed 's/^/     /'
      CONFLICT=1
    fi
  done
fi

if [[ "$CONFLICT" == "0" ]]; then
  echo "  ✅ 소유권 충돌 없음"
fi

# 5. 변경 파일 목록 출력
echo ""
echo "▸ 변경된 파일 (origin/main 기준):"
if [[ -n "$CHANGED_FILES" ]]; then
  echo "$CHANGED_FILES" | sed 's/^/   /'
else
  echo "   (없음)"
fi

# 6. PR 열려있는지 확인
echo ""
echo "▸ 기존 PR 확인..."
EXISTING_PR=$(gh pr list --head "$BRANCH" --json number,title --jq '.[0] | "\(.number): \(.title)"' 2>/dev/null || echo "")
if [[ -n "$EXISTING_PR" ]]; then
  echo "  📌 PR 이미 존재: #${EXISTING_PR}"
else
  echo "  (PR 없음 — 신규 생성 필요)"
fi

echo ""
echo "======================================"

# 최종 판정
if [[ "$BEHIND" == "0" && "$DIRTY" == "0" && "$CONFLICT" == "0" ]]; then
  echo " ✅ PASS — PR 생성 및 머지 준비 완료"
  echo ""
  echo " 다음 단계:"
  echo "   cd ${WORKTREE_PATH}"
  echo "   cat PROMPT.md  # 머지 절차 섹션 참고"
else
  echo " ⚠️  WARN — 위 항목 해결 후 재실행"
fi

echo "======================================"
echo ""
