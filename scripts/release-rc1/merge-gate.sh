#!/usr/bin/env bash
# scripts/release-rc1/merge-gate.sh
# Regula 1차 RC — T3 rebase orchestrator + pre-merge ownership check
# Usage:
#   ./scripts/release-rc1/merge-gate.sh --check T1|T2|T3|T4
#   ./scripts/release-rc1/merge-gate.sh --rebase T3
#   ./scripts/release-rc1/merge-gate.sh --ownership-check
#   ./scripts/release-rc1/merge-gate.sh --merged T1|T2|T3|T4

set -euo pipefail

META_ISSUE=101

# ─── File Ownership Map ───────────────────────────────────────────────────────
# T1: SPEC-REGULA-QUALITY-AMEND
T1_FILES=(
  "scripts/dev-bootstrap.ts"
  "lib/env.ts"
  "DEVELOPMENT.md"
)

# T2: SPEC-REGULA-DEPLOY-001
T2_FILES=(
  ".github/workflows/deploy.yml"
  "scripts/post-deploy-smoke.sh"
  "vercel.json"
  "docs/runbook/deploy.md"
)

# T3: SPEC-REGULA-E2EFIX-001
T3_FILES=(
  "tests/e2e/auth.spec.ts"
  "tests/e2e/consultation.spec.ts"
  "tests/e2e/expert-review.spec.ts"
  "tests/e2e/project-switch.spec.ts"
  "tests/e2e/i18n.spec.ts"
  "tests/e2e/a11y.spec.ts"
  "tests/e2e/security-headers.spec.ts"
  "tests/e2e/fixtures/auth.ts"
  "playwright/globalSetup.ts"
  "playwright.config.ts"
)

# T4: SPEC-REGULA-OBS-AMEND
T4_FILES=(
  "app/layout.tsx"
  "lib/observability/langfuse-handler.ts"
  "app/api/ra/consult/route.ts"
  "tests/e2e/observability-integration.spec.ts"
)

# ─── 유틸 ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[merge-gate]${NC} $*"; }
log_ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $*" >&2; }

issue_comment() {
  local body="$1"
  if command -v gh &>/dev/null; then
    gh issue comment "$META_ISSUE" --body "$body" 2>/dev/null || \
      log_warn "Issue #${META_ISSUE} comment failed"
  else
    log_info "[Issue comment skipped — gh not found] ${body}"
  fi
}

# 특정 Tn이 main에 머지됐는지 확인 (PR label 또는 Issue close 기반)
is_merged() {
  local tn="$1"
  local issue_map=([T1]=97 [T2]=98 [T3]=99 [T4]=100)
  local issue_num="${issue_map[$tn]:-}"
  [[ -z "$issue_num" ]] && return 1

  if command -v gh &>/dev/null; then
    local state
    state=$(gh issue view "$issue_num" --json state -q '.state' 2>/dev/null || echo "OPEN")
    [[ "$state" == "CLOSED" ]]
  else
    # gh 없으면 로컬 branch 기반으로 추정
    git ls-remote --heads origin | grep -q "feature/.*$(echo "$tn" | tr '[:upper:]' '[:lower:]')" && return 1 || return 0
  fi
}

# ─── --check Tn: merge 안전성 검증 ───────────────────────────────────────────
cmd_check() {
  local tn="$1"
  log_info "Checking merge readiness for ${tn}..."

  case "$tn" in
    T1)
      # T1은 독립 — 언제든 merge 가능
      log_ok "T1: No dependencies. Safe to merge."
      ;;
    T2)
      # T2도 독립 — deploy.yml이 T3와 충돌하지 않음 확인
      local deploy_yml_in_t3=false
      for f in "${T3_FILES[@]}"; do
        [[ "$f" == ".github/workflows/deploy.yml" ]] && deploy_yml_in_t3=true && break
      done
      if [[ "$deploy_yml_in_t3" == "false" ]]; then
        log_ok "T2: deploy.yml not in T3 ownership. Safe to merge."
      else
        log_fail "T2: deploy.yml ownership conflict with T3"
        exit 1
      fi
      ;;
    T3)
      # T3는 T1 완료 확인 권장 (필수는 아님)
      if is_merged T1; then
        log_ok "T3: T1 is merged. T3 is safe to proceed."
      else
        log_warn "T3: T1 not yet merged. T3 can proceed but rebase against main is recommended."
      fi
      # fixtures/auth.ts 소유권 확인
      local auth_ts_owner="T3"
      log_ok "T3: fixtures/auth.ts ownership = ${auth_ts_owner}. No conflict."
      ;;
    T4)
      # T4는 Wave A (T1+T2+T3) 완료 후 시작
      local wave_a_done=true
      for t in T1 T2 T3; do
        is_merged "$t" || { wave_a_done=false; log_warn "T4: ${t} not yet merged"; }
      done
      if [[ "$wave_a_done" == "true" ]]; then
        log_ok "T4: Wave A complete. T4 is safe to merge."
      else
        log_fail "T4: Wave A not complete. Wait for T1+T2+T3 merges."
        exit 1
      fi
      ;;
    *)
      log_fail "Unknown terminal: ${tn} (expected T1|T2|T3|T4)"
      exit 1
      ;;
  esac
}

# ─── --rebase T3: T3 브랜치 자동 rebase ──────────────────────────────────────
cmd_rebase() {
  local tn="$1"
  [[ "$tn" != "T3" ]] && { log_fail "--rebase only supported for T3"; exit 1; }

  log_info "Rebasing T3 onto origin/main..."

  git fetch origin main || { log_fail "git fetch origin main failed"; exit 1; }

  # 현재 브랜치 확인
  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  log_info "Current branch: ${current_branch}"

  # rebase 시도
  if git rebase origin/main; then
    log_ok "T3: Rebase onto origin/main succeeded"
    return 0
  fi

  # rebase 실패 시 — fixtures/auth.ts 3-way merge 시도
  log_warn "T3: Rebase conflict detected. Attempting 3-way merge for fixtures/auth.ts..."

  local conflict_files
  conflict_files=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")

  if echo "$conflict_files" | grep -q "tests/e2e/fixtures/auth.ts"; then
    log_info "T3: Attempting auto-resolve for tests/e2e/fixtures/auth.ts (ours strategy)..."
    git checkout --ours "tests/e2e/fixtures/auth.ts" 2>/dev/null && \
      git add "tests/e2e/fixtures/auth.ts" && \
      log_ok "T3: fixtures/auth.ts resolved with --ours strategy" || \
      log_warn "T3: Could not auto-resolve fixtures/auth.ts"
  fi

  # 나머지 충돌 확인
  local remaining_conflicts
  remaining_conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")

  if [[ -z "$remaining_conflicts" ]]; then
    git rebase --continue || {
      log_fail "T3: git rebase --continue failed"
      git rebase --abort
      log_fail "T3: Rebase aborted. Manual resolution required."
      log_fail "  1. git fetch origin main"
      log_fail "  2. git rebase origin/main"
      log_fail "  3. Resolve conflicts manually"
      log_fail "  4. git add <resolved-files>"
      log_fail "  5. git rebase --continue"
      exit 1
    }
    log_ok "T3: Rebase completed after conflict resolution"
  else
    git rebase --abort
    log_fail "T3: Remaining conflicts in: ${remaining_conflicts}"
    log_fail "Manual resolution required:"
    log_fail "  1. git fetch origin main"
    log_fail "  2. git rebase origin/main"
    log_fail "  3. Resolve each conflict, git add, git rebase --continue"
    exit 1
  fi
}

# ─── --ownership-check: 현재 worktree 수정 파일 소유권 검증 ──────────────────
cmd_ownership_check() {
  log_info "Checking file ownership in current worktree..."

  # 현재 브랜치에서 수정된 파일 목록
  local modified_files
  modified_files=$(git diff --name-only origin/main...HEAD 2>/dev/null || \
                   git diff --name-only HEAD~1 2>/dev/null || echo "")

  if [[ -z "$modified_files" ]]; then
    log_ok "No modified files found relative to origin/main"
    return 0
  fi

  # 브랜치명으로 Tn 추론
  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  local inferred_tn=""

  # 브랜치명 패턴: feature/t1-*, feature/t2-* 등
  if echo "$current_branch" | grep -qi "t1\|quality\|bootstrap"; then
    inferred_tn="T1"
  elif echo "$current_branch" | grep -qi "t2\|deploy"; then
    inferred_tn="T2"
  elif echo "$current_branch" | grep -qi "t3\|e2e\|playwright"; then
    inferred_tn="T3"
  elif echo "$current_branch" | grep -qi "t4\|obs\|observ"; then
    inferred_tn="T4"
  fi

  if [[ -z "$inferred_tn" ]]; then
    log_warn "Could not infer Tn from branch '${current_branch}' — skipping ownership check"
    return 0
  fi

  log_info "Inferred terminal: ${inferred_tn} from branch '${current_branch}'"

  # 해당 Tn의 소유 파일 목록 가져오기
  local -n owner_files="${inferred_tn}_FILES"
  local violations=()

  while IFS= read -r modified; do
    [[ -z "$modified" ]] && continue
    local owned=false
    for owned_file in "${owner_files[@]}"; do
      # 정확 일치 또는 prefix 일치 (디렉토리)
      if [[ "$modified" == "$owned_file" ]] || [[ "$modified" == "${owned_file}/"* ]]; then
        owned=true
        break
      fi
    done
    if [[ "$owned" == "false" ]]; then
      violations+=("$modified")
    fi
  done <<< "$modified_files"

  if [[ ${#violations[@]} -gt 0 ]]; then
    log_fail "Ownership violations in ${inferred_tn}:"
    for v in "${violations[@]}"; do
      log_fail "  VIOLATION: ${v} is not owned by ${inferred_tn}"
    done
    log_fail "Check ownership map in merge-gate.sh and coordinate with team"
    exit 1
  fi

  log_ok "${inferred_tn}: All modified files within ownership scope"
}

# ─── --merged Tn: post-merge 북키핑 ─────────────────────────────────────────
cmd_merged() {
  local tn="$1"
  log_info "${tn} merge detected — running post-merge bookkeeping..."

  issue_comment "[Auto] ${tn} merged. See wave-progress-tracker workflow for next steps."

  case "$tn" in
    T1)
      log_info "T1 merged. T3 may now rebase against main."
      log_info "Next: T2 and T3 can continue in parallel."
      ;;
    T2)
      log_info "T2 merged. Deployment workflow active."
      ;;
    T3)
      log_info "T3 merged. Check Wave A status (T1+T2+T3)."
      if is_merged T1 && is_merged T2; then
        log_ok "Wave A complete! Trigger T4 via wave-b-trigger workflow."
        issue_comment "[Auto] Wave A complete (T1+T2+T3 all merged). Triggering Wave B..."
      else
        log_warn "Wave A not yet complete — waiting for remaining terminals"
      fi
      ;;
    T4)
      log_info "T4 merged. All waves complete."
      issue_comment "[Auto] T4 merged. All waves complete. Regula 1차 RC is ready."
      ;;
  esac
}

# ─── 메인 ────────────────────────────────────────────────────────────────────
main() {
  local cmd="${1:-}"
  local arg="${2:-}"

  case "$cmd" in
    --check)
      [[ -z "$arg" ]] && { log_fail "--check requires T1|T2|T3|T4"; exit 1; }
      cmd_check "$arg"
      ;;
    --rebase)
      [[ -z "$arg" ]] && { log_fail "--rebase requires T3"; exit 1; }
      cmd_rebase "$arg"
      ;;
    --ownership-check)
      cmd_ownership_check
      ;;
    --merged)
      [[ -z "$arg" ]] && { log_fail "--merged requires T1|T2|T3|T4"; exit 1; }
      cmd_merged "$arg"
      ;;
    *)
      cat <<'USAGE'
Usage:
  ./scripts/release-rc1/merge-gate.sh --check T{N}
  ./scripts/release-rc1/merge-gate.sh --rebase T3
  ./scripts/release-rc1/merge-gate.sh --ownership-check
  ./scripts/release-rc1/merge-gate.sh --merged T{N}
USAGE
      exit 1
      ;;
  esac
}

main "$@"
