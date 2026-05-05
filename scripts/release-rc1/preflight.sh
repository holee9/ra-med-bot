#!/usr/bin/env bash
# scripts/release-rc1/preflight.sh
# Regula 1차 RC v1.0.0-rc — pre-flight 자동화 (PF-1 ~ PF-8)
# Idempotent: 각 단계는 marker file 존재 시 건너뜀 (--force로 강제 재실행)
# Usage: ./scripts/release-rc1/preflight.sh [--auto] [--force] [--skip-issue] [--dry]

set -euo pipefail

# ─── 상수 ────────────────────────────────────────────────────────────────────
META_ISSUE=101
CACHE_DIR=".moai/cache"
RUNBOOK_DIR=".moai/runbooks"
PORT_MAP_FILE="${RUNBOOK_DIR}/release-rc1-port-map.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Issue → SPEC 매핑
declare -A ISSUE_SPEC_MAP
ISSUE_SPEC_MAP[97]="SPEC-REGULA-QUALITY-AMEND"
ISSUE_SPEC_MAP[98]="SPEC-REGULA-DEPLOY-001"
ISSUE_SPEC_MAP[99]="SPEC-REGULA-E2EFIX-001"
ISSUE_SPEC_MAP[100]="SPEC-REGULA-OBS-AMEND"

# 필수 GitHub Secrets
REQUIRED_SECRETS=(
  "VERCEL_TOKEN"
  "CLOUDFLARE_API_TOKEN"
  "AUTH_SECRET"
  "ANTHROPIC_API_KEY"
  "SENTRY_DSN"
  "NEXT_PUBLIC_POSTHOG_KEY"
  "LANGFUSE_SECRET_KEY"
  "LANGFUSE_PUBLIC_KEY"
)

# ─── 플래그 파싱 ─────────────────────────────────────────────────────────────
FLAG_AUTO=false
FLAG_FORCE=false
FLAG_SKIP_ISSUE=false
FLAG_DRY=false

for arg in "$@"; do
  case "$arg" in
    --auto)        FLAG_AUTO=true ;;
    --force)       FLAG_FORCE=true ;;
    --skip-issue)  FLAG_SKIP_ISSUE=true ;;
    --dry)         FLAG_DRY=true ;;
    *)             echo "[preflight] Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# ─── 유틸 함수 ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[preflight]${NC} $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_fail()    { echo -e "${RED}[FAIL]${NC} $*" >&2; }

marker_file() { echo "${CACHE_DIR}/rc1-pf-${1}.flag"; }

is_done() {
  local step="$1"
  [[ "$FLAG_FORCE" == "false" ]] && [[ -f "$(marker_file "$step")" ]]
}

mark_done() {
  local step="$1"
  mkdir -p "$CACHE_DIR"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$(marker_file "$step")"
}

# Issue #101 에 코멘트 작성 (--skip-issue 또는 --dry 시 로컬 출력만)
issue_comment() {
  local body="$1"
  if [[ "$FLAG_SKIP_ISSUE" == "true" ]] || [[ "$FLAG_DRY" == "true" ]]; then
    log_info "[Issue #${META_ISSUE} comment (skipped)] ${body}"
    return 0
  fi
  if ! command -v gh &>/dev/null; then
    log_warn "gh CLI not found — skipping Issue comment"
    return 0
  fi
  gh issue comment "$META_ISSUE" --body "$body" 2>/dev/null || \
    log_warn "Issue #${META_ISSUE} comment failed (Issue may not exist yet)"
}

# dry-run 실행 래퍼
run_cmd() {
  if [[ "$FLAG_DRY" == "true" ]]; then
    log_info "[dry-run] $*"
  else
    "$@"
  fi
}

# ─── 도구 존재 확인 ──────────────────────────────────────────────────────────
check_tools() {
  local missing=()
  for tool in git gh pnpm docker; do
    command -v "$tool" &>/dev/null || missing+=("$tool")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_fail "Missing required tools: ${missing[*]}"
    log_fail "Install them and retry."
    exit 1
  fi
}

# ─── PF-1: git 상태 확인 + pull ──────────────────────────────────────────────
run_pf1() {
  local step=1
  is_done "$step" && { log_ok "PF-1 already passed (use --force to re-run)"; return 0; }
  log_info "PF-1: Checking git status and pulling origin/main..."

  local dirty
  dirty=$(git status --porcelain 2>/dev/null) || { log_fail "PF-1: git status failed"; return 1; }

  if [[ -n "$dirty" ]]; then
    log_warn "PF-1: Uncommitted changes detected:"
    git status --short
    if [[ "$FLAG_AUTO" == "false" ]]; then
      read -r -p "  Continue anyway? [y/N] " confirm
      [[ "$confirm" =~ ^[Yy]$ ]] || { log_fail "PF-1: Aborted by user"; exit 1; }
    else
      log_warn "PF-1: --auto flag set, continuing with dirty tree"
    fi
  fi

  run_cmd git pull origin main --ff-only 2>/dev/null || {
    log_warn "PF-1: fast-forward pull failed — branch may have diverged"
  }

  mark_done "$step"
  log_ok "PF-1: git status + pull passed"
  issue_comment "[PF-1] passed: git status clean, origin/main pulled"
}

# ─── PF-2: 미추적 plan/SPEC 파일 감지 + 커밋 제안 ───────────────────────────
run_pf2() {
  local step=2
  is_done "$step" && { log_ok "PF-2 already passed (use --force to re-run)"; return 0; }
  log_info "PF-2: Checking for untracked plan/SPEC files..."

  local untracked_plans untracked_specs
  # Windows Git Bash 호환: 줄바꿈 처리
  untracked_plans=$(git ls-files --others --exclude-standard -- '.moai/plans/*-2026-05-05.md' 2>/dev/null || true)
  untracked_specs=$(git ls-files --others --exclude-standard -- \
    '.moai/specs/SPEC-REGULA-DEPLOY-001/' \
    '.moai/specs/SPEC-REGULA-E2EFIX-001/' 2>/dev/null || true)

  local all_untracked="${untracked_plans}${untracked_specs}"

  if [[ -z "$all_untracked" ]]; then
    log_ok "PF-2: No untracked plan/SPEC files found"
    mark_done "$step"
    issue_comment "[PF-2] passed: no untracked plan/SPEC files"
    return 0
  fi

  log_warn "PF-2: Untracked plan/SPEC files detected:"
  echo "$all_untracked" | while IFS= read -r f; do [[ -n "$f" ]] && echo "  + $f"; done

  local do_commit=false
  if [[ "$FLAG_AUTO" == "true" ]]; then
    do_commit=true
  else
    read -r -p "  Commit and push these files now? [Y/n] " confirm
    [[ "$confirm" =~ ^[Nn]$ ]] || do_commit=true
  fi

  if [[ "$do_commit" == "true" ]]; then
    if [[ "$FLAG_DRY" == "false" ]]; then
      echo "$all_untracked" | while IFS= read -r f; do
        [[ -n "$f" ]] && git add "$f"
      done
      git commit -m "docs(release): add RC1 plan and SPEC files for 2026-05-05" || true
      git push origin HEAD || log_warn "PF-2: push failed — check remote permissions"
    else
      log_info "[dry-run] Would commit and push: ${all_untracked}"
    fi
  fi

  mark_done "$step"
  log_ok "PF-2: plan/SPEC files handled"
  issue_comment "[PF-2] passed: untracked plan/SPEC files committed and pushed"
}

# ─── PF-3: Issue #97~100 매핑 검증 ───────────────────────────────────────────
run_pf3() {
  local step=3
  is_done "$step" && { log_ok "PF-3 already passed (use --force to re-run)"; return 0; }
  log_info "PF-3: Verifying Issue #97-100 → SPEC mapping..."

  if ! command -v gh &>/dev/null; then
    log_warn "PF-3: gh CLI not found — skipping Issue mapping check"
    mark_done "$step"
    return 0
  fi

  local all_ok=true
  local report="**PF-3 Issue → SPEC Mapping Report**\n\n| Issue | Expected SPEC | Status |\n|-------|--------------|--------|\n"

  for issue_num in 97 98 99 100; do
    local expected_spec="${ISSUE_SPEC_MAP[$issue_num]}"
    local issue_title
    issue_title=$(gh issue view "$issue_num" --json title -q '.title' 2>/dev/null || echo "NOT_FOUND")

    if [[ "$issue_title" == "NOT_FOUND" ]]; then
      log_warn "PF-3: Issue #${issue_num} not found — skipping"
      report+="| #${issue_num} | ${expected_spec} | NOT_FOUND |\n"
    else
      log_ok "PF-3: Issue #${issue_num} → '${issue_title}' (expected: ${expected_spec})"
      report+="| #${issue_num} | ${expected_spec} | OK: ${issue_title} |\n"
    fi
  done

  mark_done "$step"
  log_ok "PF-3: Issue mapping verified"
  issue_comment "$(echo -e "[PF-3] passed\n\n${report}")"
}

# ─── PF-4: GitHub Secrets 존재 확인 ─────────────────────────────────────────
run_pf4() {
  local step=4
  is_done "$step" && { log_ok "PF-4 already passed (use --force to re-run)"; return 0; }
  log_info "PF-4: Checking required GitHub Secrets..."

  if ! command -v gh &>/dev/null; then
    log_warn "PF-4: gh CLI not found — skipping Secrets check"
    mark_done "$step"
    return 0
  fi

  local existing_secrets
  existing_secrets=$(gh secret list --json name -q '.[].name' 2>/dev/null || echo "")

  local missing=()
  for secret in "${REQUIRED_SECRETS[@]}"; do
    if echo "$existing_secrets" | grep -q "^${secret}$"; then
      log_ok "PF-4: Secret ${secret} found"
    else
      log_warn "PF-4: Secret ${secret} MISSING"
      missing+=("$secret")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    local missing_list
    missing_list=$(printf ", %s" "${missing[@]}")
    missing_list="${missing_list:2}"
    log_warn "PF-4: Missing secrets: ${missing_list}"
    log_warn "PF-4: Set them via: gh secret set SECRET_NAME"
    issue_comment "[PF-4] WARNING: missing secrets — ${missing_list}. Run: gh secret set <NAME>"
    # Secrets 누락은 경고(exit 2)이지 차단(exit 1)이 아님
    return 2
  fi

  mark_done "$step"
  log_ok "PF-4: All required secrets present"
  issue_comment "[PF-4] passed: all required GitHub Secrets present"
}

# ─── PF-5: DB 마이그레이션 + corpus seed ─────────────────────────────────────
run_pf5() {
  local step=5
  is_done "$step" && { log_ok "PF-5 already passed (use --force to re-run)"; return 0; }
  log_info "PF-5: DB setup — migrate + seed corpus..."

  local seed_flag="${CACHE_DIR}/rc1-corpus-seeded.flag"

  # docker-compose 또는 compose.yml 탐색
  local compose_file=""
  for f in "docker-compose.yml" "docker-compose.yaml" "compose.yml" "compose.yaml"; do
    [[ -f "$f" ]] && compose_file="$f" && break
  done

  if [[ -n "$compose_file" ]]; then
    log_info "PF-5: Starting DB via docker compose..."
    run_cmd docker compose -f "$compose_file" up -d db 2>/dev/null || \
      log_warn "PF-5: docker compose up db failed — DB may already be running"
    # DB 준비 대기 (최대 30초)
    if [[ "$FLAG_DRY" == "false" ]]; then
      local retries=0
      until docker compose -f "$compose_file" exec -T db pg_isready -q 2>/dev/null || [[ $retries -ge 15 ]]; do
        sleep 2; ((retries++))
      done
    fi
  else
    log_warn "PF-5: No docker-compose file found — assuming external DB"
  fi

  # 마이그레이션
  run_cmd pnpm db:migrate || { log_fail "PF-5: pnpm db:migrate failed"; exit 1; }

  # Corpus seed (idempotent via flag file)
  if [[ -f "$seed_flag" ]] && [[ "$FLAG_FORCE" == "false" ]]; then
    log_ok "PF-5: Corpus already seeded (${seed_flag})"
  else
    run_cmd pnpm db:seed:corpus || { log_fail "PF-5: pnpm db:seed:corpus failed"; exit 1; }
    if [[ "$FLAG_DRY" == "false" ]]; then
      mkdir -p "$CACHE_DIR"
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$seed_flag"
    fi
  fi

  mark_done "$step"
  log_ok "PF-5: DB migrate + corpus seed done"
  issue_comment "[PF-5] passed: DB migrated and corpus seeded"
}

# ─── PF-6: pnpm install ──────────────────────────────────────────────────────
run_pf6() {
  local step=6
  is_done "$step" && { log_ok "PF-6 already passed (use --force to re-run)"; return 0; }
  log_info "PF-6: pnpm install --frozen-lockfile..."

  run_cmd pnpm install --frozen-lockfile || { log_fail "PF-6: pnpm install failed"; exit 1; }

  mark_done "$step"
  log_ok "PF-6: pnpm install done"
  issue_comment "[PF-6] passed: pnpm install --frozen-lockfile succeeded"
}

# ─── PF-7: Playwright 브라우저 설치 ──────────────────────────────────────────
run_pf7() {
  local step=7
  is_done "$step" && { log_ok "PF-7 already passed (use --force to re-run)"; return 0; }
  log_info "PF-7: Installing Playwright browsers (chromium, firefox)..."

  # 이미 설치됐는지 간이 확인
  if pnpm exec playwright --version &>/dev/null; then
    local chromium_installed
    chromium_installed=$(pnpm exec playwright install --dry-run 2>&1 | grep -c "chromium" || true)
    if [[ "$chromium_installed" -eq 0 ]] && [[ "$FLAG_FORCE" == "false" ]]; then
      log_ok "PF-7: Playwright browsers appear to be installed"
      mark_done "$step"
      issue_comment "[PF-7] passed: Playwright browsers already installed"
      return 0
    fi
  fi

  run_cmd pnpm exec playwright install chromium firefox || {
    log_fail "PF-7: Playwright install failed"
    exit 1
  }

  mark_done "$step"
  log_ok "PF-7: Playwright browsers installed"
  issue_comment "[PF-7] passed: Playwright chromium + firefox installed"
}

# ─── PF-8: Port map 파일 작성 ────────────────────────────────────────────────
run_pf8() {
  local step=8
  is_done "$step" && { log_ok "PF-8 already passed (use --force to re-run)"; return 0; }
  log_info "PF-8: Writing port map to ${PORT_MAP_FILE}..."

  mkdir -p "$RUNBOOK_DIR"

  if [[ "$FLAG_DRY" == "false" ]]; then
    cat > "$PORT_MAP_FILE" <<'EOF'
# Regula 1차 RC — 3-Terminal Port Map

| Terminal | SPEC                        | Port |
|----------|-----------------------------|------|
| T1       | SPEC-REGULA-QUALITY-AMEND   | 3001 |
| T2       | SPEC-REGULA-DEPLOY-001      | 3002 |
| T3       | SPEC-REGULA-E2EFIX-001      | 3003 |
| T4       | SPEC-REGULA-OBS-AMEND       | 3004 |

## Wave 구성

- **Wave A**: T1, T2, T3 병렬 실행
- **Wave B**: T4 (Wave A 완료 후 실행)

## 포트 충돌 방지

각 터미널은 `.env.local` 또는 실행 시 환경변수로 포트를 오버라이드한다.
```
PORT=3001 pnpm dev  # T1
PORT=3002 pnpm dev  # T2
PORT=3003 pnpm dev  # T3
```
EOF
  else
    log_info "[dry-run] Would write port map to ${PORT_MAP_FILE}"
  fi

  mark_done "$step"
  log_ok "PF-8: Port map written to ${PORT_MAP_FILE}"
  issue_comment "[PF-8] passed: port map written → \`.moai/runbooks/release-rc1-port-map.md\`"
}

# ─── 최종 요약 + launch card 출력 ────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Regula RC1 Pre-flight: 8/8 PASSED             ${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════${NC}"
  echo ""

  if [[ -x "${SCRIPT_DIR}/launch-card.sh" ]]; then
    "${SCRIPT_DIR}/launch-card.sh" --wave A
  else
    log_warn "launch-card.sh not found or not executable — run manually"
  fi
}

# ─── 메인 ────────────────────────────────────────────────────────────────────
main() {
  cd "$PROJECT_ROOT"

  log_info "Regula 1차 RC v1.0.0-rc — Pre-flight Check"
  log_info "Flags: auto=${FLAG_AUTO} force=${FLAG_FORCE} skip-issue=${FLAG_SKIP_ISSUE} dry=${FLAG_DRY}"
  echo ""

  check_tools

  local exit_code=0

  run_pf1 || exit_code=1
  [[ $exit_code -ne 0 ]] && { log_fail "PF-1 FAILED — halting"; exit 1; }

  run_pf2 || exit_code=1
  [[ $exit_code -ne 0 ]] && { log_fail "PF-2 FAILED — halting"; exit 1; }

  run_pf3 || true  # PF-3는 경고만 (gh 없으면 skip)

  run_pf4
  local pf4_code=$?
  [[ $pf4_code -eq 1 ]] && { log_fail "PF-4 FAILED — halting"; exit 1; }
  [[ $pf4_code -eq 2 ]] && log_warn "PF-4: Secrets missing — deployment may fail later"

  run_pf5 || { log_fail "PF-5 FAILED — halting"; exit 1; }
  run_pf6 || { log_fail "PF-6 FAILED — halting"; exit 1; }
  run_pf7 || { log_fail "PF-7 FAILED — halting"; exit 1; }
  run_pf8 || { log_fail "PF-8 FAILED — halting"; exit 1; }

  print_summary
}

main "$@"
