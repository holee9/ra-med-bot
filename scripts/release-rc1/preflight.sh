#!/usr/bin/env bash
# scripts/release-rc1/preflight.sh
# DEPRECATED (2026-05-05) — 3-터미널 개별 실행 모델로 전환됨.
#
# 사용 금지. 대신 각 터미널에서:
#   ./scripts/release-rc1/start.sh T1   # quality-amend
#   ./scripts/release-rc1/start.sh T2   # deploy
#   ./scripts/release-rc1/start.sh T3   # e2e-fix
#   ./scripts/release-rc1/start.sh T4   # obs-amend (Wave B, T1+T2+T3 머지 후)
#
# 본 파일은 backward-compat 안내용으로만 남아 있으며 실제 동작하지 않습니다.

set -euo pipefail

cat <<'EOF'
─────────────────────────────────────────────────────────────────
⚠ preflight.sh는 폐기되었습니다 (deprecated 2026-05-05)

3-터미널 개별 실행 모델로 전환됨. 다음 명령을 각 터미널에서 실행하세요:

  터미널 1:  ./scripts/release-rc1/start.sh T1
  터미널 2:  ./scripts/release-rc1/start.sh T2
  터미널 3:  ./scripts/release-rc1/start.sh T3

각 start.sh가 해당 터미널에 필요한 사전 준비를 idempotent 실행합니다.
메인 세션 단독 실행은 불필요합니다.

자세한 내용: .moai/runbooks/release-rc1-runbook.md (v1.1.0+)
─────────────────────────────────────────────────────────────────
EOF

exit 1
