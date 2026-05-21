#!/usr/bin/env bash
# =============================================================
# T3610 Ubuntu 26.x Developer Setup Script
# Usage: chmod +x setup_dev_t3610.sh && ./setup_dev_t3610.sh
# =============================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
section() { echo -e "\n${BOLD}${YELLOW}=== $* ===${NC}"; }

# 스크립트 시작 시 PATH 확정 (apt 설치 직후 명령 인식용)
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.cargo/bin:$PATH"

# =============================================================
# 1. SYSTEM BASE
# =============================================================
section "System Update & Base Packages"
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  curl wget git ripgrep unzip zip \
  build-essential cmake ninja-build \
  pkg-config ca-certificates \
  software-properties-common apt-transport-https \
  gnupg lsb-release \
  htop tmux tree jq \
  openssh-client \
  python3 python3-pip python3-venv python3-dev python3-full \
  pipx \
  clang clang-format clang-tidy \
  gdb valgrind \
  llvm \
  libssl-dev zlib1g-dev libbz2-dev \
  libreadline-dev libsqlite3-dev libffi-dev
info "Base packages installed."

# =============================================================
# 2. NODE.JS
# =============================================================
section "Node.js 22 LTS"
if command -v node &> /dev/null; then
  info "Node.js already installed: $(node --version)"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
  info "Node.js installed: $(node --version)"
fi

mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
grep -qF '.npm-global/bin' "$HOME/.bashrc" \
  || echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
export PATH="$HOME/.npm-global/bin:$PATH"

# =============================================================
# 3. CLAUDE CODE
# =============================================================
section "Claude Code"
if command -v claude &> /dev/null; then
  info "Claude Code already installed: $(claude --version)"
else
  if npm install -g @anthropic-ai/claude-code 2>/dev/null; then
    info "Claude Code installed via npm."
  else
    warn "npm failed. Trying Anthropic apt repo..."
    sudo install -d -m 0755 /etc/apt/keyrings
    sudo curl -fsSL https://downloads.claude.ai/keys/claude-code.asc \
      -o /etc/apt/keyrings/claude-code.asc
    echo "deb [signed-by=/etc/apt/keyrings/claude-code.asc] https://downloads.claude.ai/claude-code/apt/stable stable main" \
      | sudo tee /etc/apt/sources.list.d/claude-code.list
    sudo apt update && sudo apt install -y claude-code
    info "Claude Code installed via apt."
  fi
fi
info "Auth: claude  (브라우저 OAuth 또는 ANTHROPIC_API_KEY)"

# =============================================================
# 4. OPENAI CODEX CLI
# =============================================================
section "OpenAI Codex CLI"
if command -v codex &> /dev/null; then
  info "Codex CLI already installed."
else
  npm install -g @openai/codex
  info "Codex CLI installed."
fi
info "Auth: codex  (Sign in with ChatGPT 또는 OPENAI_API_KEY)"

# =============================================================
# 5. GITHUB CLI
# =============================================================
section "GitHub CLI"
if command -v gh &> /dev/null; then
  info "GitHub CLI already installed: $(gh --version | head -1)"
else
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update && sudo apt install -y gh
  info "GitHub CLI installed: $(gh --version | head -1)"
fi
info "Auth: gh auth login"

# =============================================================
# 6. DOCKER CE
# =============================================================
section "Docker CE"
if command -v docker &> /dev/null; then
  info "Docker already installed: $(docker --version)"
else
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  info "Docker installed. Re-login to use without sudo."
fi

# =============================================================
# 7. PYTHON TOOLS (pipx + uv)
# =============================================================
section "Python Tools"

# uv: apt 우선 (Ubuntu 26.x 포함), 없으면 pipx
if command -v uv &> /dev/null; then
  info "uv already installed: $(uv --version)"
else
  if sudo apt install -y uv 2>/dev/null && command -v uv &> /dev/null; then
    info "uv installed via apt: $(uv --version)"
  else
    pipx install uv
    info "uv installed via pipx."
  fi
fi

# CLI 툴 pipx 설치
for pkg in ruff black mypy ipython; do
  if pipx list 2>/dev/null | grep -q "package ${pkg}"; then
    info "${pkg} already installed."
  else
    pipx install "${pkg}" && info "${pkg} installed."
  fi
done

# =============================================================
# 8. RUST
# =============================================================
section "Rust"
if command -v rustc &> /dev/null; then
  info "Rust already installed: $(rustc --version)"
else
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  grep -qF '.cargo/env' "$HOME/.bashrc" \
    || echo 'source "$HOME/.cargo/env"' >> "$HOME/.bashrc"
  info "Rust installed: $(rustc --version)"
fi

# =============================================================
# 9. VS CODE
# =============================================================
section "VS Code"
if command -v code &> /dev/null; then
  info "VS Code already installed."
else
  wget -qO /tmp/vscode.deb \
    "https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64"
  sudo apt install -y /tmp/vscode.deb
  rm -f /tmp/vscode.deb
  info "VS Code installed."
fi

# =============================================================
# 10. GIT CONFIG REMINDER
# =============================================================
section "Git Global Config (수동 설정)"
echo ""
echo "  git config --global user.name  \"Your Name\""
echo "  git config --global user.email \"you@example.com\""
echo "  git config --global core.editor \"code --wait\""
echo "  git config --global init.defaultBranch main"
echo ""

# =============================================================
# 11. GIT REPOSITORY USER CONFIG
# =============================================================
section "Git Repository User Config"

WORK_DIR="$HOME/work/workspace-github"

for repo in holee9/MD-process holee9/ra-med-bot holee9/ra-project holee9/regula-eval-suite; do
  repo_path="$WORK_DIR/$repo"
  if [ -d "$repo_path/.git" ]; then
    git -C "$repo_path" config user.name "holee9"
    git -C "$repo_path" config user.email "holee9@gmail.com"
    info "$repo: user 설정 완료"
  else
    warn "$repo_path 없음, 스킵"
  fi
done

HERMES_PATH="$WORK_DIR/hnabyz-bot/hermes-ra"
if [ -d "$HERMES_PATH/.git" ]; then
  git -C "$HERMES_PATH" config user.name "hnabyz-bot"
  git -C "$HERMES_PATH" config user.email "hnabyz2023@gmail.com"
  git -C "$HERMES_PATH" config credential.helper \
    '!f() { echo username=hnabyz-bot; echo password=$(gh auth token --user hnabyz-bot 2>/dev/null); }; f'
  info "hermes-ra: user 설정 + hnabyz-bot credential helper 적용"
else
  warn "$HERMES_PATH 없음, 스킵"
fi

# =============================================================
# 12. CLAUDE CODE HOOK: CwdChanged gh 자동 계정 전환
# =============================================================
section "Claude Code CwdChanged Hook"

HOOK_FILE="$HOME/work/.claude/hooks/moai/handle-cwd-changed.sh"

if [ ! -f "$HOOK_FILE" ]; then
  warn "Hook 파일 없음: $HOOK_FILE (moai-adk 설치 후 재실행 필요)"
else
  if grep -q "Auto gh account switching" "$HOOK_FILE"; then
    info "CwdChanged hook 이미 패치됨, 스킵"
  else
    cat > "$HOOK_FILE" << 'HOOKEOF'
#!/bin/bash
# MoAI CwdChanged Hook Wrapper - Generated by moai-adk
# This script forwards stdin JSON to the moai hook cwd-changed command.
# Project-local hook: .claude/hooks/moai/handle-cwd-changed.sh

# Create temp file to store stdin
temp_file=$(mktemp)
trap 'rm -f "$temp_file"' EXIT

# Read stdin into temp file
cat > "$temp_file"

# Auto gh account switching based on directory
NEW_CWD=$(python3 -c "import json,sys; print(json.load(open('$temp_file')).get('cwd',''))" 2>/dev/null)
if echo "$NEW_CWD" | grep -q "hnabyz-bot"; then
    /usr/bin/gh auth switch --user hnabyz-bot >/dev/null 2>&1
else
    /usr/bin/gh auth switch --user holee9 >/dev/null 2>&1
fi

# Try moai command in PATH
if command -v moai &> /dev/null; then
	exec moai hook cwd-changed < "$temp_file" 2>/dev/null
fi

# Try detected Go bin path from initialization
if [ -f "/home/abyz-lab/go/bin/moai" ]; then
	exec "/home/abyz-lab/go/bin/moai" hook cwd-changed < "$temp_file" 2>/dev/null
fi

# Try default ~/go/bin/moai
if [ -f "$HOME/go/bin/moai" ]; then
	exec "$HOME/go/bin/moai" hook cwd-changed < "$temp_file" 2>/dev/null
fi

# Try ~/.local/bin/moai (Linux install location)
if [ -f "$HOME/.local/bin/moai" ]; then
	exec "$HOME/.local/bin/moai" hook cwd-changed < "$temp_file" 2>/dev/null
fi

# Not found - exit silently (Claude Code handles missing hooks gracefully)
exit 0
HOOKEOF
    chmod +x "$HOOK_FILE"
    info "CwdChanged hook 패치 완료: gh 자동 계정 전환 추가"
  fi
fi

# =============================================================
# SUMMARY
# =============================================================
section "Installation Complete"
echo ""
for cmd in claude codex gh docker node python3 uv ruff rustc code; do
  if command -v "$cmd" &> /dev/null; then
    echo -e "  ${GREEN}v${NC} $cmd: $(command -v $cmd)"
  else
    echo -e "  ${YELLOW}x${NC} $cmd (not found — re-login 후 확인)"
  fi
done
echo ""
echo -e "${YELLOW}[!] source ~/.bashrc  또는 re-login 후 PATH 적용${NC}"
echo ""
