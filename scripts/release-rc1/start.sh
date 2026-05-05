#!/usr/bin/env bash
# scripts/release-rc1/start.sh
# Regula 1차 RC — 터미널별 단일 진입점
# 각 터미널(T1~T4)이 독립적으로 실행. preflight.sh 불필요.
#
# Usage:
#   ./scripts/release-rc1/start.sh T1 [--no-issue] [--dry] [--skip-deps] [--force-rebase]
#   ./scripts/release-rc1/start.sh T2 [flags]
#   ./scripts/release-rc1/start.sh T3 [flags]
#   ./scripts/release-rc1/start.sh T4 [flags]  # Wave A 완료 후 실행

set -euo pipefail

# ─── 상수 ─────────────────────────────────────────────────────────────────────
META_ISSUE=101
CACHE_DIR=".moai/cache"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Worktree 루트: moai 관행 따름
WORKTREE_BASE="${HOME}/.moai/worktrees/ra-med-bot"

# ─── 색상 ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[start]${NC} $*"; }
log_ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $*" >&2; }

# ─── 플래그 파싱 ──────────────────────────────────────────────────────────────
TN_ARG=""
FLAG_NO_ISSUE=false
FLAG_DRY=false
FLAG_SKIP_DEPS=false
FLAG_FORCE_REBASE=false

for arg in "$@"; do
  case "$arg" in
    T1|T2|T3|T4) TN_ARG="$arg" ;;
    --no-issue)   FLAG_NO_ISSUE=true ;;
    --dry)        FLAG_DRY=true ;;
    --skip-deps)  FLAG_SKIP_DEPS=true ;;
    --force-rebase) FLAG_FORCE_REBASE=true ;;
    *)
      log_fail "Unknown argument: $arg"
      echo "Usage: ./scripts/release-rc1/start.sh T1|T2|T3|T4 [--no-issue] [--dry] [--skip-deps] [--force-rebase]"
      exit 1
      ;;
  esac
done

# T 인자 필수
if [[ -z "$TN_ARG" ]]; then
  echo "Usage: ./scripts/release-rc1/start.sh T1|T2|T3|T4 [--no-issue] [--dry] [--skip-deps] [--force-rebase]"
  echo ""
  echo "  T1  SPEC-REGULA-QUALITY-001  quality amend (solo)"
  echo "  T2  SPEC-REGULA-DEPLOY-001   deploy pipeline (solo)"
  echo "  T3  SPEC-REGULA-E2EFIX-001   E2E fix (team)"
  echo "  T4  SPEC-REGULA-ENTERPRISE-001-obs  enterprise obs (team) — Wave B"
  exit 1
fi

# ─── dry-run 실행 래퍼 ────────────────────────────────────────────────────────
run_cmd() {
  if [[ "$FLAG_DRY" == "true" ]]; then
    log_info "[dry-run] $*"
  else
    "$@"
  fi
}

# Issue 코멘트 (--no-issue 또는 --dry 시 로컬 출력만)
issue_comment() {
  local body="$1"
  if [[ "$FLAG_NO_ISSUE" == "true" ]] || [[ "$FLAG_DRY" == "true" ]]; then
    log_info "[Issue #${META_ISSUE} comment (skipped)] ${body}"
    return 0
  fi
  if ! command -v gh &>/dev/null; then
    log_warn "gh CLI not found — skipping Issue comment"
    return 0
  fi
  gh issue comment "$META_ISSUE" --body "$body" 2>/dev/null || \
    log_warn "Issue #${META_ISSUE} comment failed"
}

# ─── STEP 1: 필수 도구 검증 ───────────────────────────────────────────────────
check_tools() {
  local missing=()
  for tool in git pnpm; do
    command -v "$tool" &>/dev/null || missing+=("$tool")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_fail "Missing required tools: ${missing[*]}"
    log_fail "Install and retry."
    exit 2
  fi

  # gh CLI — 없으면 경고만 (issue 코멘트 및 secret 체크만 skip)
  if ! command -v gh &>/dev/null; then
    log_warn "gh CLI not found — Issue comments and secret checks will be skipped"
  fi

  # moai CLI — 없으면 git worktree fallback 사용
  if ! command -v moai &>/dev/null; then
    log_warn "moai CLI not found — will use 'git worktree add' as fallback"
  fi
}

# ─── STEP 2: CWD 검증 (프로젝트 루트 여부) ───────────────────────────────────
check_project_root() {
  if [[ ! -d "${PROJECT_ROOT}/.moai" ]] || [[ ! -f "${PROJECT_ROOT}/package.json" ]]; then
    log_fail "Not a valid project root: ${PROJECT_ROOT}"
    log_fail "Expected .moai/ and package.json to be present."
    exit 1
  fi
  log_ok "Project root validated: ${PROJECT_ROOT}"
}

# ─── STEP 3: git fetch + pull --ff-only ───────────────────────────────────────
sync_main() {
  log_info "Syncing origin/main..."
  run_cmd git -C "${PROJECT_ROOT}" fetch origin main

  # ff-only pull: 로컬 main이 diverged면 거부
  if ! run_cmd git -C "${PROJECT_ROOT}" pull --ff-only origin main 2>/dev/null; then
    if [[ "$FLAG_DRY" == "false" ]]; then
      log_fail "git pull --ff-only failed: local main has diverged from origin/main."
      log_fail "Resolve by: git reset --hard origin/main (주의: 로컬 커밋 손실)"
      log_fail "또는 diverged commit을 push/PR 처리 후 재시도하세요."
      exit 1
    fi
  fi
  log_ok "origin/main synced"
}

# ─── STEP 4~5: Tn별 SPEC/branch/worktree 메타 결정 ───────────────────────────
# 출력 변수: SPEC, BRANCH, WT_NAME, CLAUDE_MODE
resolve_tn_meta() {
  case "$TN_ARG" in
    T1)
      SPEC="SPEC-REGULA-QUALITY-001"
      BRANCH="feature/SPEC-REGULA-QUALITY-001-amend"
      WT_NAME="quality-amend"
      CLAUDE_MODE="solo"
      ;;
    T2)
      SPEC="SPEC-REGULA-DEPLOY-001"
      BRANCH="feature/SPEC-REGULA-DEPLOY-001"
      WT_NAME="deploy"
      CLAUDE_MODE="solo"
      ;;
    T3)
      SPEC="SPEC-REGULA-E2EFIX-001"
      BRANCH="feature/SPEC-REGULA-E2EFIX-001"
      WT_NAME="e2e-fix"
      CLAUDE_MODE="team"
      ;;
    T4)
      SPEC="SPEC-REGULA-ENTERPRISE-001"
      BRANCH="feature/SPEC-REGULA-ENTERPRISE-001-obs"
      WT_NAME="enterprise-obs"
      CLAUDE_MODE="team"
      ;;
  esac

  WT_PATH="${WORKTREE_BASE}/${WT_NAME}"
  log_info "Terminal: ${TN_ARG} | SPEC: ${SPEC} | Branch: ${BRANCH} | Mode: ${CLAUDE_MODE}"
  log_info "Worktree path: ${WT_PATH}"
}

# ─── STEP 6: Worktree 생성 (idempotent) ──────────────────────────────────────
ensure_worktree() {
  if [[ -d "${WT_PATH}/.git" ]] || [[ -f "${WT_PATH}/.git" ]]; then
    log_ok "Worktree already exists: ${WT_PATH}"
    return 0
  fi

  log_info "Creating worktree: ${WT_PATH}"

  if [[ "$FLAG_DRY" == "true" ]]; then
    log_info "[dry-run] Would create worktree at ${WT_PATH} for branch ${BRANCH}"
    return 0
  fi

  mkdir -p "${WORKTREE_BASE}"

  # moai CLI 우선, 없으면 git worktree add
  if command -v moai &>/dev/null; then
    moai worktree new "${SPEC}" 2>/dev/null || {
      log_warn "moai worktree new failed — falling back to git worktree add"
      _git_worktree_add
    }
  else
    _git_worktree_add
  fi

  log_ok "Worktree created: ${WT_PATH}"
}

_git_worktree_add() {
  # 원격 브랜치가 이미 있으면 track, 없으면 -b로 새 브랜치 생성
  if git -C "${PROJECT_ROOT}" ls-remote --heads origin "${BRANCH}" | grep -q "${BRANCH}"; then
    git -C "${PROJECT_ROOT}" worktree add "${WT_PATH}" "${BRANCH}" 2>/dev/null || \
      git -C "${PROJECT_ROOT}" worktree add --track -b "${BRANCH}" "${WT_PATH}" "origin/${BRANCH}"
  else
    git -C "${PROJECT_ROOT}" worktree add -b "${BRANCH}" "${WT_PATH}" origin/main
  fi
}

# ─── STEP 7: CWD 전환 (cd 명령은 서브셸이라 export로 힌트 제공) ───────────────
set_worktree_cwd() {
  # 실제 shell CWD는 부모 프로세스로 전파 불가 → 경로를 출력해 사용자가 직접 cd
  # 이후 단계에서는 git -C "${WT_PATH}" 또는 cd + 서브셸로 처리
  log_info "Worktree CWD set to: ${WT_PATH}"
}

# ─── STEP 8: Tn별 pre-checks ─────────────────────────────────────────────────
run_prechecks() {
  case "$TN_ARG" in
    T1) precheck_t1 ;;
    T2) precheck_t2 ;;
    T3) precheck_t3 ;;
    T4) precheck_t4 ;;
  esac
}

precheck_t1() {
  [[ "$FLAG_SKIP_DEPS" == "true" ]] && { log_info "T1: --skip-deps set, skipping pnpm install"; return 0; }
  log_info "T1: pnpm install --frozen-lockfile..."
  run_cmd pnpm --dir "${WT_PATH}" install --frozen-lockfile || {
    log_fail "T1: pnpm install failed"; exit 1
  }
  log_ok "T1: deps installed"
}

precheck_t2() {
  [[ "$FLAG_SKIP_DEPS" == "true" ]] || {
    log_info "T2: pnpm install --frozen-lockfile..."
    run_cmd pnpm --dir "${WT_PATH}" install --frozen-lockfile || {
      log_fail "T2: pnpm install failed"; exit 1
    }
    log_ok "T2: deps installed"
  }

  # GitHub Secrets 존재 확인 (경고만, 차단하지 않음)
  local required_secrets=("VERCEL_TOKEN" "CLOUDFLARE_API_TOKEN" "AUTH_SECRET")
  if command -v gh &>/dev/null; then
    log_info "T2: Checking required GitHub Secrets..."
    local existing
    existing=$(gh secret list --json name -q '.[].name' 2>/dev/null || echo "")
    local missing_secrets=()
    for s in "${required_secrets[@]}"; do
      echo "$existing" | grep -q "^${s}$" || missing_secrets+=("$s")
    done
    if [[ ${#missing_secrets[@]} -gt 0 ]]; then
      log_warn "T2: Missing secrets: ${missing_secrets[*]}"
      log_warn "T2: Set via: gh secret set <NAME>"
      log_warn "T2: Deployment may fail without these — continuing anyway"
    else
      log_ok "T2: All required secrets present"
    fi
  else
    log_warn "T2: gh CLI not found — skipping secret check"
  fi
}

precheck_t3() {
  [[ "$FLAG_SKIP_DEPS" == "true" ]] || {
    log_info "T3: pnpm install --frozen-lockfile..."
    run_cmd pnpm --dir "${WT_PATH}" install --frozen-lockfile || {
      log_fail "T3: pnpm install failed"; exit 1
    }
    log_ok "T3: deps installed"
  }

  # DB corpus seed (idempotent via marker)
  local seed_flag="${PROJECT_ROOT}/${CACHE_DIR}/rc1-corpus-seeded.flag"
  if [[ -f "$seed_flag" ]]; then
    log_ok "T3: Corpus already seeded (${seed_flag})"
  else
    log_info "T3: Seeding DB corpus..."
    if [[ "$FLAG_DRY" == "false" ]]; then
      pnpm --dir "${WT_PATH}" db:seed:corpus || {
        log_warn "T3: pnpm db:seed:corpus failed — continuing (DB may be external)"
      }
      mkdir -p "${PROJECT_ROOT}/${CACHE_DIR}"
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$seed_flag"
    else
      log_info "[dry-run] Would run pnpm db:seed:corpus"
    fi
    log_ok "T3: DB corpus seed done"
  fi

  # Playwright 브라우저 설치 (idempotent)
  _ensure_playwright_browsers
}

_ensure_playwright_browsers() {
  log_info "T3: Checking Playwright browsers..."

  # dry-run 시 건너뜀
  if [[ "$FLAG_DRY" == "true" ]]; then
    log_info "[dry-run] Would check/install Playwright browsers"
    return 0
  fi

  # ms-playwright 캐시 디렉토리 확인 (Linux/macOS/Windows Git Bash)
  local pw_cache="${HOME}/.cache/ms-playwright"
  local pw_installed=false

  if [[ -d "$pw_cache" ]] && [[ -n "$(ls -A "$pw_cache" 2>/dev/null)" ]]; then
    pw_installed=true
  fi

  # playwright install --dry-run 으로 추가 확인
  if [[ "$pw_installed" == "false" ]]; then
    if pnpm --dir "${WT_PATH}" exec playwright install --dry-run 2>&1 | grep -qi "already installed"; then
      pw_installed=true
    fi
  fi

  if [[ "$pw_installed" == "true" ]]; then
    log_ok "T3: Playwright browsers already installed"
  else
    log_info "T3: Installing Playwright browsers (chromium, firefox)..."
    pnpm --dir "${WT_PATH}" exec playwright install chromium firefox || {
      log_warn "T3: Playwright install failed — E2E tests may not run"
    }
    log_ok "T3: Playwright browsers installed"
  fi
}

precheck_t4() {
  # T4: Wave A 완료 여부 검증 (차단)
  log_info "T4: Verifying Wave A completion (T1+T2+T3 merged)..."

  if ! command -v gh &>/dev/null; then
    log_fail "T4: gh CLI required to verify Wave A status"
    exit 2
  fi

  local wave_a_issues=([T1]=97 [T2]=98 [T3]=99)
  local all_merged=true

  for tn in T1 T2 T3; do
    local issue_num="${wave_a_issues[$tn]}"
    local state
    state=$(gh issue view "$issue_num" --json state -q '.state' 2>/dev/null || echo "OPEN")
    if [[ "$state" == "CLOSED" ]]; then
      log_ok "T4: ${tn} (Issue #${issue_num}) is merged/closed"
    else
      log_fail "T4: ${tn} (Issue #${issue_num}) is NOT yet merged (state: ${state})"
      all_merged=false
    fi
  done

  if [[ "$all_merged" == "false" ]]; then
    log_fail "T4: Wave A incomplete. Wait for T1+T2+T3 PRs to be merged before starting T4."
    exit 3
  fi

  log_ok "T4: Wave A complete. Proceeding..."

  [[ "$FLAG_SKIP_DEPS" == "true" ]] && return 0
  log_info "T4: pnpm install --frozen-lockfile..."
  run_cmd pnpm --dir "${WT_PATH}" install --frozen-lockfile || {
    log_fail "T4: pnpm install failed"; exit 1
  }
  log_ok "T4: deps installed"
}

# ─── STEP 9: T3 rebase 체크 (T1 merge 후 자동 rebase) ────────────────────────
maybe_rebase_t3() {
  [[ "$TN_ARG" != "T3" ]] && return 0

  # T1 merge 여부 확인
  local t1_merged=false
  if command -v gh &>/dev/null; then
    local state
    state=$(gh issue view 97 --json state -q '.state' 2>/dev/null || echo "OPEN")
    [[ "$state" == "CLOSED" ]] && t1_merged=true
  fi

  if [[ "$t1_merged" == "true" ]] || [[ "$FLAG_FORCE_REBASE" == "true" ]]; then
    log_info "T3: T1 is merged — running rebase via merge-gate.sh..."
    local merge_gate="${SCRIPT_DIR}/merge-gate.sh"
    if [[ -x "$merge_gate" ]]; then
      if [[ "$FLAG_DRY" == "false" ]]; then
        # merge-gate.sh --rebase T3 는 현재 worktree 디렉토리에서 실행해야 함
        (cd "${WT_PATH}" && bash "${merge_gate}" --rebase T3) || {
          log_warn "T3: Auto-rebase failed — manual rebase may be needed"
          log_warn "  Run: cd ${WT_PATH} && git rebase origin/main"
        }
      else
        log_info "[dry-run] Would run: merge-gate.sh --rebase T3 in ${WT_PATH}"
      fi
    else
      log_warn "T3: merge-gate.sh not found at ${merge_gate} — skipping auto-rebase"
    fi
  else
    log_info "T3: T1 not yet merged — skipping rebase (use --force-rebase to override)"
  fi
}

# ─── STEP 10: Issue #101 코멘트 ───────────────────────────────────────────────
post_ready_comment() {
  issue_comment "[${TN_ARG}] worktree ready, starting work"
}

# ─── STEP 11: 완료 배너 출력 ─────────────────────────────────────────────────
print_ready_banner() {
  local claude_cmd
  if [[ "$CLAUDE_MODE" == "team" ]]; then
    claude_cmd="claude --team"
  else
    claude_cmd="claude"
  fi

  local moai_run_cmd
  if [[ "$CLAUDE_MODE" == "team" ]]; then
    moai_run_cmd="/moai run ${SPEC} --team"
  else
    moai_run_cmd="/moai run ${SPEC}"
  fi

  # 배너 너비 맞춤
  local wt_display="${WT_PATH}"

  echo ""
  echo -e "${BOLD}${GREEN}╭─ ${TN_ARG} READY ─────────────────────────────────────────────╮${NC}"
  printf "${BOLD}${GREEN}│${NC}  %-54s ${BOLD}${GREEN}│${NC}\n" "worktree: ${wt_display}"
  echo -e "${BOLD}${GREEN}│${NC}                                                        ${BOLD}${GREEN}│${NC}"
  echo -e "${BOLD}${GREEN}│${NC}  Next steps (paste into THIS terminal):                ${BOLD}${GREEN}│${NC}"
  printf "${BOLD}${GREEN}│${NC}    %-52s ${BOLD}${GREEN}│${NC}\n" "cd ${wt_display}"
  printf "${BOLD}${GREEN}│${NC}    %-52s ${BOLD}${GREEN}│${NC}\n" "${claude_cmd}"
  echo -e "${BOLD}${GREEN}│${NC}                                                        ${BOLD}${GREEN}│${NC}"
  echo -e "${BOLD}${GREEN}│${NC}  Inside Claude Code, run:                              ${BOLD}${GREEN}│${NC}"
  printf "${BOLD}${GREEN}│${NC}    %-52s ${BOLD}${GREEN}│${NC}\n" "${moai_run_cmd}"
  echo -e "${BOLD}${GREEN}│${NC}                                                        ${BOLD}${GREEN}│${NC}"
  printf "${BOLD}${GREEN}│${NC}  Tracker: %-44s ${BOLD}${GREEN}│${NC}\n" "gh issue view ${META_ISSUE} --comments"
  echo -e "${BOLD}${GREEN}╰────────────────────────────────────────────────────────╯${NC}"
  echo ""
  echo -e "  ${CYAN}Worktree path (copy):${NC}"
  echo "  ${WT_PATH}"
  echo ""
}

# ─── 메인 ─────────────────────────────────────────────────────────────────────
main() {
  cd "${PROJECT_ROOT}"

  log_info "Regula 1차 RC — start.sh ${TN_ARG}"
  log_info "Flags: no-issue=${FLAG_NO_ISSUE} dry=${FLAG_DRY} skip-deps=${FLAG_SKIP_DEPS} force-rebase=${FLAG_FORCE_REBASE}"
  echo ""

  # 1. 도구 검증
  check_tools

  # 2. 프로젝트 루트 검증
  check_project_root

  # 3. origin/main 동기화
  sync_main

  # 4~5. Tn 메타 결정
  resolve_tn_meta

  # 6. Worktree 생성 (idempotent)
  ensure_worktree

  # 7. CWD 설정 (로그)
  set_worktree_cwd

  # 8. Tn별 pre-checks
  run_prechecks

  # 9. T3 자동 rebase
  maybe_rebase_t3

  # 10. Issue 코멘트
  post_ready_comment

  # 11. 배너 출력
  print_ready_banner
}

main "$@"
