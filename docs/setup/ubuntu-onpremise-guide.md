# Regula — Ubuntu 온프레미스 구축 가이드

> **대상 환경**: Dell T3610 (Xeon E5-2696 v2 / 64GB RAM / SSD 480GB)  
> **OS**: Ubuntu Desktop 24.04 LTS  
> **목적**: 사내 LAN 환경에서 개발 + 운영을 단일 머신으로 운영

---

## 목차

1. [Ubuntu 설치](#1-ubuntu-설치)
2. [기본 시스템 설정](#2-기본-시스템-설정)
3. [개발 도구 설치](#3-개발-도구-설치)
4. [Docker 설치](#4-docker-설치)
5. [코드 세팅](#5-코드-세팅)
6. [환경 변수 설정](#6-환경-변수-설정)
7. [DB 초기화 및 코퍼스 투입](#7-db-초기화-및-코퍼스-투입)
8. [앱 실행](#8-앱-실행)
9. [사내망 접근 설정](#9-사내망-접근-설정)
10. [부팅 시 자동 시작 (선택)](#10-부팅-시-자동-시작-선택)
11. [AI 전략 — LLM 단계별 확장](#11-ai-전략--llm-단계별-확장)
12. [문제 해결](#12-문제-해결)

---

## 1. Ubuntu 설치

### 1-1. ISO 다운로드

```
https://ubuntu.com/download/desktop
→ Ubuntu 24.04.x LTS 선택
```

### 1-2. 부팅 USB 생성

- Windows에서: [Rufus](https://rufus.ie) 사용
- Ubuntu에서: `Startup Disk Creator` 사용

### 1-3. 설치 옵션

| 항목 | 권장 설정 |
|------|----------|
| 파티션 | SSD 전체 단일 파티션 (/ 에 480GB 할당) |
| 스왑 | 8GB (RAM이 충분하므로 최소) |
| 언어 | 한국어 또는 영어 (영어 권장 — 경로 오류 방지) |
| 최소 설치 | 선택 (불필요한 소프트웨어 제외) |

---

## 2. 기본 시스템 설정

### 2-1. 패키지 업데이트

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential ca-certificates gnupg
```

### 2-2. 고정 IP 설정 (사내 LAN 접근용)

```bash
# 네트워크 인터페이스 이름 확인
ip addr show

# Settings → Network → 유선 연결 → 설정 아이콘 → IPv4
# 방법: 수동
# 주소: 192.168.x.x  (사내 네트워크에 맞게 설정)
# 넷마스크: 255.255.255.0
# 게이트웨이: 192.168.x.1
# DNS: 8.8.8.8, 8.8.4.4
```

> 라우터 관리자 페이지에서 T3610 MAC 주소에 고정 IP를 할당하는 방법도 권장합니다.

### 2-3. SSH 서버 설치 (원격 접속 필요 시)

```bash
sudo apt install -y openssh-server
sudo systemctl enable ssh
sudo systemctl start ssh

# 접속 확인 (다른 PC에서)
# ssh username@192.168.x.x
```

---

## 3. 개발 도구 설치

### 3-1. Node.js (nvm 경유)

```bash
# nvm 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

# Node.js 22 LTS 설치
nvm install 22
nvm use 22
nvm alias default 22

# 확인
node --version   # v22.x.x
```

### 3-2. pnpm

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate

# 확인
pnpm --version   # 9.12.0
```

### 3-3. Claude Code (개발 작업용)

```bash
npm install -g @anthropic-ai/claude-code

# 확인
claude --version
```

### 3-4. gh CLI (GitHub 작업용, 선택)

```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
  https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install -y gh

# 로그인
gh auth login
```

---

## 4. Docker 설치

### 4-1. Docker 공식 설치

```bash
# GPG 키 및 저장소 추가
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 4-2. 현재 사용자에게 Docker 권한 부여

```bash
sudo usermod -aG docker $USER
newgrp docker

# 확인 (sudo 없이 동작해야 함)
docker --version
docker compose version
```

---

## 5. 코드 세팅

```bash
# 레포 클론
git clone https://github.com/holee9/ra-med-bot.git
cd ra-med-bot

# 의존성 설치
pnpm install
```

---

## 6. 환경 변수 설정

### 6-1. .env.local 자동 생성

```bash
pnpm dev:bootstrap
```

`dev-placeholder-*` 값이 채워진 `.env.local`이 생성됩니다.

### 6-2. 필수 값 교체

아래 항목을 실제 값으로 수정합니다 (`nano .env.local` 또는 VS Code로 편집):

| 변수 | 설명 | 획득 방법 |
|------|------|----------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API 키 (채팅 추론) | [aistudio.google.com](https://aistudio.google.com/app/apikey) — 무료 |
| `OPENAI_API_KEY` | 임베딩 생성용 (소량 사용) | [platform.openai.com](https://platform.openai.com) |
| `AUTH_SECRET` | 세션 암호화 (32자 이상 임의 문자열) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 앱 접근 URL | `http://localhost:3000` 또는 `http://192.168.x.x:3000` |
| `AUTH_GOOGLE_ID` | Google OAuth 클라이언트 ID | [Google Cloud Console](#6-3-google-oauth-설정) |
| `AUTH_GOOGLE_SECRET` | Google OAuth 시크릿 | [Google Cloud Console](#6-3-google-oauth-설정) |

`DATABASE_URL`은 bootstrap이 `postgresql://postgres:postgres@localhost:5432/regula_dev`로 자동 설정합니다.

> **임베딩 비용**: OpenAI text-embedding-3-small은 월 수천 토큰 수준으로 거의 무료($0.01 미만)입니다.

### 6-3. Google OAuth 설정

> Gemini API 키와 Google OAuth는 **같은 Google 계정**으로 발급 가능합니다.

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 사용)
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. 애플리케이션 유형: **Web application**
5. 승인된 리디렉션 URI 추가:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://192.168.x.x:3000/api/auth/callback/google` (사내 IP 접근용)
6. 생성된 Client ID / Client Secret을 `.env.local`에 입력

---

## 7. DB 초기화 및 코퍼스 투입

```bash
# PostgreSQL 16 + pgvector 컨테이너 시작
pnpm db:up

# 스키마 마이그레이션 (최초 1회)
pnpm db:migrate

# 규제 코퍼스 임베딩 투입 (FDA / EU MDR / MFDS / NMPA / PMDA)
# OPENAI_API_KEY가 실제 키여야 동작함
pnpm db:seed:corpus
```

> `db:seed:corpus`는 최초 1회 실행 후 재실행해도 중복 투입되지 않습니다 (멱등성 보장).

---

## 8. 앱 실행

### 8-1. 개발 모드 (코드 변경 즉시 반영)

```bash
pnpm dev
# → http://localhost:3000
```

### 8-2. 운영 모드 (안정적 실행 권장)

```bash
pnpm build
pnpm start
# → http://localhost:3000
```

### 8-3. 실행 확인

브라우저에서 `http://localhost:3000` 접속 → 로그인 화면 표시 → Google 계정으로 로그인.

---

## 9. 사내망 접근 설정

### 9-1. T3610 IP 확인

```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# 예: 192.168.1.100
```

### 9-2. 방화벽 포트 허용

```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

### 9-3. 팀원 접근

팀원 브라우저에서:
```
http://192.168.1.100:3000
```

> Google OAuth 설정 시 **6-3**에서 추가한 리디렉션 URI에 사내 IP가 포함되어 있어야 합니다.

---

## 10. 부팅 시 자동 시작 (선택)

PM2를 사용해 앱을 서비스로 등록합니다.

```bash
# PM2 설치
npm install -g pm2

# 앱 등록 (빌드 후)
cd ~/ra-med-bot
pnpm build
pm2 start "pnpm start" --name regula --cwd ~/ra-med-bot

# 부팅 시 자동 시작 등록
pm2 startup
# → 출력된 sudo 명령어 실행
pm2 save

# 상태 확인
pm2 status
pm2 logs regula
```

DB 컨테이너 부팅 시 자동 시작:

```bash
sudo systemctl enable docker
```

---

## 11. AI 전략 — LLM 단계별 확장

Regula는 LLM 추론을 외부 API에 위임합니다. T3610 하드웨어 성능과 무관하게 API 품질과 비용만으로 운영 수준을 결정합니다.

### 단계별 확장 경로

| 단계 | 모델 | 비용 | 전환 조건 |
|------|------|------|----------|
| **Stage 1** (초기) | Gemini 2.0 Flash | **$0** (1,500건/일 무료) | 지금 |
| **Stage 2** (성장) | Gemini 2.0 Flash 유료 | $0.075/M 입력 토큰 | 일 1,500건 초과 시 |
| **Stage 3** (품질) | Gemini 1.5 Pro 또는 Claude API | $3.5~15/M 입력 토큰 | 답변 품질이 부족할 때 |

> 단계 전환 시 **모델명 한 줄만 교체**하면 됩니다. Vercel AI SDK가 공급자 교체를 추상화합니다.

### Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. **Create API Key** 클릭
3. 생성된 키를 `.env.local`의 `GOOGLE_GENERATIVE_AI_API_KEY`에 입력

무료 한도: **1,500건/일, 15건/분, 100만 토큰/일** — 사내 소규모 팀에 충분합니다.

### 비용 예측 (사내 10~20명 기준)

| 단계 | 예상 월 비용 |
|------|------------|
| Stage 1 (Gemini Flash 무료) | **$0** |
| Stage 2 (Gemini Flash 유료) | $5~15 |
| Stage 3 (Gemini Pro) | $20~60 |

---

## 12. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `docker: permission denied` | 그룹 미적용 | `newgrp docker` 또는 재로그인 |
| `ZodError: GOOGLE_GENERATIVE_AI_API_KEY` | `.env.local` 미설정 | 6-2 단계 재확인 |
| `vector extension not found` | pgvector 미설치 | `pnpm db:up` 으로 컨테이너 재시작 |
| `ECONNREFUSED 5432` | DB 컨테이너 미실행 | `docker ps` 확인 후 `pnpm db:up` |
| Google 로그인 실패 `redirect_uri_mismatch` | OAuth 리디렉션 URI 불일치 | Google Console에서 현재 IP/URL 추가 |
| 사내망에서 접속 안 됨 | 방화벽 차단 | `sudo ufw allow 3000/tcp` |
| PM2 재시작 시 환경변수 없음 | .env.local 경로 문제 | `pm2 start` 시 `--cwd ~/ra-med-bot` 옵션 추가 |
| Gemini 429 Too Many Requests | 무료 한도 초과 | Stage 2 유료 전환 (결제 정보 등록) |

---

## 참고

- [DEVELOPMENT.md](../../DEVELOPMENT.md) — 개발 명령어 전체 목록
- [docs/deployment/](../deployment/) — DNS, HTTPS 설정 (외부 공개 시)
- [docs/runbook.md](../runbook.md) — 운영 절차

---

*최초 작성: 2026-05-06 | 대상: Dell T3610 / Ubuntu 24.04 LTS*
