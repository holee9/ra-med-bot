#!/usr/bin/env bash
# scripts/release-rc1/pr-body-template.sh
# Regula 1차 RC — PR body 생성기
# Usage: gh pr create --body "$(./scripts/release-rc1/pr-body-template.sh T1)"

set -euo pipefail

META_ISSUE=101
TN="${1:-}"

# ─── 설정 맵 ─────────────────────────────────────────────────────────────────
declare -A SPEC_ID=([T1]="SPEC-REGULA-QUALITY-AMEND" [T2]="SPEC-REGULA-DEPLOY-001" [T3]="SPEC-REGULA-E2EFIX-001" [T4]="SPEC-REGULA-OBS-AMEND")
declare -A ISSUE_NUM=([T1]=97 [T2]=98 [T3]=99 [T4]=100)
declare -A MERGE_SLOT=([T1]="Wave A — Slot 1 (no dependencies)" [T2]="Wave A — Slot 2 (independent of T1)" [T3]="Wave A — Slot 3 (rebase after T1 merge)" [T4]="Wave B — Slot 1 (after Wave A complete)")
declare -A POST_MERGE=([T1]="T3 may now rebase. Comment Issue #${META_ISSUE}: T1 merged." [T2]="Confirm deploy pipeline smoke passes." [T3]="Check Wave A status. If T1+T2 merged, trigger Wave B." [T4]="All waves complete. Tag v1.0.0-rc.")

if [[ -z "$TN" ]] || [[ -z "${SPEC_ID[$TN]:-}" ]]; then
  echo "Usage: $0 T1|T2|T3|T4" >&2
  exit 1
fi

SPEC="${SPEC_ID[$TN]}"
ISSUE="${ISSUE_NUM[$TN]}"
SLOT="${MERGE_SLOT[$TN]}"
POST="${POST_MERGE[$TN]}"

# 형제 PR 목록 (gh로 조회, 실패 시 placeholder)
fetch_sibling_prs() {
  if ! command -v gh &>/dev/null; then
    echo "_(gh CLI unavailable — list sibling PRs manually)_"
    return
  fi
  local others=""
  for t in T1 T2 T3 T4; do
    [[ "$t" == "$TN" ]] && continue
    local sibling_issue="${ISSUE_NUM[$t]}"
    local sibling_pr
    sibling_pr=$(gh pr list --search "Closes #${sibling_issue}" --json number,title -q '.[0] | "#\(.number) \(.title)"' 2>/dev/null || echo "")
    [[ -n "$sibling_pr" ]] && others+="- ${t}: ${sibling_pr}\n"
  done
  [[ -n "$others" ]] && echo -e "$others" || echo "_(no sibling PRs found yet)_"
}

SIBLING_PRS=$(fetch_sibling_prs)

# ─── PR body 출력 ────────────────────────────────────────────────────────────
cat <<EOF
## Summary

<!-- ${TN} (${SPEC}) implementation summary — fill in before creating PR -->

-
-
-

## Related Tracker

- Meta Issue: #${META_ISSUE}
- Closes: #${ISSUE}
- Sibling PRs:
${SIBLING_PRS}

## Merge Slot

**${SLOT}**

| Terminal | Issue | Merge Order |
|----------|-------|-------------|
| T1 | #97 | First (Wave A) |
| T2 | #98 | Parallel with T1 (Wave A) |
| T3 | #99 | After T1 rebase (Wave A) |
| T4 | #100 | After Wave A (Wave B) |

## Pre-merge Checklist

- [ ] All CI checks green (ci.yml)
- [ ] No ownership violations: \`./scripts/release-rc1/merge-gate.sh --ownership-check\`
- [ ] Merge safety confirmed: \`./scripts/release-rc1/merge-gate.sh --check ${TN}\`
- [ ] PR description filled in (Summary section above)
- [ ] Related Issue #${ISSUE} updated with implementation notes

## Post-merge Action

${POST}

---

🗿 MoAI <hnabyz2023@gmail.com>
EOF
