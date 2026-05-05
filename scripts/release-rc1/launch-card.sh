#!/usr/bin/env bash
# scripts/release-rc1/launch-card.sh
# Regula 1차 RC — 3-terminal launch commands를 copyable block으로 출력
# Usage: ./scripts/release-rc1/launch-card.sh [--wave A|B]

set -euo pipefail

WAVE="${2:-A}"
for arg in "$@"; do
  case "$arg" in
    --wave) ;;
    A|B) WAVE="$arg" ;;
  esac
done

REPO_URL="https://github.com/$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo 'your-org/ra-med-bot')"
ISSUE_URL="${REPO_URL}/issues/101"

# ─── 출력 유틸 ───────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

box_header() { echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"; }
box_footer() { echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"; }
box_line()   { printf "${GREEN}║${NC}  %-52s${GREEN}║${NC}\n" "$1"; }
box_sep()    { echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"; }
box_title()  { printf "${GREEN}║${CYAN}  %-52s${GREEN}║${NC}\n" "$1"; }

print_terminal_card() {
  local tn="$1"         # T1, T2, T3, T4
  local spec="$2"       # SPEC-REGULA-...
  local issue="$3"      # #97, #98, ...
  local port="$4"       # 3001, 3002, ...
  local branch="$5"     # feature/rc1-t1-quality-amend

  echo ""
  box_header
  box_title "  ${tn} | ${spec}"
  box_sep
  box_line "Issue: ${REPO_URL}/issues/${issue#\#}"
  box_line "Port:  ${port}"
  box_sep
  box_title "  Step 1: Create worktree"
  box_line "moai worktree new ${spec}"
  box_sep
  box_title "  Step 2: Enter worktree"
  box_line "cd ~/.moai/worktrees/ra-med-bot/${spec}"
  box_sep
  box_title "  Step 3: Launch Claude"
  box_line "claude"
  box_sep
  box_title "  Step 4: Run SPEC"
  box_line "/moai run ${spec}"
  box_sep
  box_line "Meta Issue: ${ISSUE_URL}"
  box_footer
}

print_wave_a() {
  echo ""
  echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Regula 1차 RC — Wave A: 3-Terminal Launch Cards   ${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"

  print_terminal_card \
    "T1" \
    "SPEC-REGULA-QUALITY-AMEND" \
    "#97" \
    "3001" \
    "feature/rc1-t1-quality-amend"

  print_terminal_card \
    "T2" \
    "SPEC-REGULA-DEPLOY-001" \
    "#98" \
    "3002" \
    "feature/rc1-t2-deploy"

  print_terminal_card \
    "T3" \
    "SPEC-REGULA-E2EFIX-001" \
    "#99" \
    "3003" \
    "feature/rc1-t3-e2efix"

  echo ""
  echo -e "${CYAN}Wave A Notes:${NC}"
  echo "  - T1, T2, T3 run in parallel (3 separate terminals)"
  echo "  - T3 should rebase after T1 merges:"
  echo "    ./scripts/release-rc1/merge-gate.sh --rebase T3"
  echo "  - Merge order: T1 → T2 → T3 (T2 and T3 can merge in any order after T1)"
  echo "  - After all three merge: Wave B auto-triggers via GitHub Actions"
  echo ""
  echo -e "${CYAN}Port Map:${NC} .moai/runbooks/release-rc1-port-map.md"
  echo -e "${CYAN}Meta Issue:${NC} ${ISSUE_URL}"
  echo ""
}

print_wave_b() {
  echo ""
  echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Regula 1차 RC — Wave B: T4 Launch Card            ${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"

  print_terminal_card \
    "T4" \
    "SPEC-REGULA-OBS-AMEND" \
    "#100" \
    "3004" \
    "feature/rc1-t4-observability"

  echo ""
  echo -e "${CYAN}Wave B Notes:${NC}"
  echo "  - T4 starts only after Wave A (T1+T2+T3) is complete"
  echo "  - Observability integration requires T1 env + T2 deploy pipeline"
  echo "  - Final merge: T4 → main completes RC1"
  echo ""
  echo -e "${CYAN}Meta Issue:${NC} ${ISSUE_URL}"
  echo ""
}

# ─── 메인 ────────────────────────────────────────────────────────────────────
case "$WAVE" in
  A) print_wave_a ;;
  B) print_wave_b ;;
  *)
    echo "Usage: $0 [--wave A|B]"
    exit 1
    ;;
esac
