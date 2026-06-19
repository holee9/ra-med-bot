# Dev Server Startup Runbook

개발 서버 시작, health check, 공개 URL 검증을 위한 절차서.

## 목차

- [개요](#개요)
- [환경 변수 검증 강화 (Issue #165)](#환경-변수-검증-강화-issue-165)
- [개발 서버 시작](#개발-서버-시작)
- [Health Check](#health-check)
- [공개 URL 검증](#공개-url-검증)
- [문제 해결](#문제-해결)

---

## 개요

이 runbook은 다음을 보장합니다:

1. **환경 변수 검증**: 필수 환경 변수 누락 시 서버 시작 차단
2. **DB 연결 보장**: 잘못된 credentials로 DB 연결 시도 방지
3. **Health Check**: 공개 URL 접근 전 시스템 상태 확인

---

## 환경 변수 검증 강화 (Issue #165)

### 문제 배경

`SKIP_ENV_VALIDATION=1`이 설정되면 `lib/env.ts`의 `getEnv()`가 빈 객체를 반환하여 DB 클라이언트가 잘못된 credentials로 연결을 시도합니다. 이는 28P01 인증 오류를 유발하고 공개 URL 검증을 차단합니다.

### 해결 방안

#### 1. lib/env.ts 수정

**이전 문제**:
- `SKIP_ENV_VALIDATION=1` + `REGULA_ALLOW_ENV_VALIDATION_SKIP=build` 조건에서 빈 객체 반환
- 런타임에 빈 env 객체가 전달되어 DB 연결 실패

**해결**:
- Build-time bypass를 제거하고 항상 에러를 던짐
- 빈 객체 반환 로직 (lines 100-102) 삭제
- 런타임 환경에서는 `SKIP_ENV_VALIDATION=1`을 완전히 차단

#### 2. package.json 수정

**이전 문제**:
- `dev` 스크립트가 `next dev`만 실행하여 env validation 우회

**해결**:
- `dev` 스크립트를 에러 메시지 출력 후 `exit 1`로 변경
- `dev:public` 스크립트 사용 권장

#### 3. Health Check 스크립트 추가

**목적**:
- 공개 URL 접근 전 필수 env 확인
- DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL 검증
- Exit code 기반 건강 상태 판단

**사용법**:
```bash
node scripts/health-check.ts
# Exit 0: healthy
# Exit 1: unhealthy
```

---

## 개발 서버 시작

### Forbidden: 직접 `pnpm dev` 사용

```bash
# ❌ 금지: env validation 우회로 잠재적 보안 위험
pnpm dev

# Error: Use pnpm dev:public for validated dev server. 
# Direct pnpm dev bypasses env validation and is forbidden.
```

### 권장: `pnpm dev:public` 사용

```bash
# ✅ 권장: env validation 포함
pnpm dev:public

# 실행 단계:
# 1. scripts/validate-runtime-env.ts로 env 검증
# 2. 검증 통과 시 next dev 시작
# 3. http://0.0.0.0:3000에서 서버 실행
```

### 환경 변수 설정 확인

필수 환경 변수가 설정되어 있어야 합니다:

```bash
# .env.local에 필수 항목 설정
DATABASE_URL=postgresql://user:password@localhost:5432/regula
AUTH_SECRET=<최소 32자 secret>
NEXTAUTH_URL=http://localhost:3000
```

---

## Health Check

### 로컬 health check 실행

```bash
# standalone 실행
node scripts/health-check.ts

# 출력 예시 (healthy):
{
  "status": "healthy",
  "checks": {
    "database_url": { "available": true },
    "auth_secret": { "available": true },
    "nextauth_url": { "available": true }
  },
  "timestamp": "2026-06-19T00:00:00.000Z"
}
```

### CI/CD 통합

```yaml
# GitHub Actions 예시
- name: Health Check
  run: node scripts/health-check.ts

# 또는 deploy 전 단계
- name: Verify Runtime Env
  run: pnpm dev:public  # validate-runtime-env.ts 포함
```

---

## 공개 URL 검증

### 검증 절차

1. **Health check 통과 확인**
   ```bash
   node scripts/health-check.ts
   # Exit code 0 확인
   ```

2. **Dev server 시작**
   ```bash
   pnpm dev:public
   # http://0.0.0.0:3000 확인
   ```

3. **공개 URL 접근**
   - Cloudflare Tunnel: `regula.abyz-lab.work`
   - Vercel Preview: PR에서 제공된 URL

### 진입점별 검증

| 진입점 | 검증 방법 | 확인 사항 |
|--------|----------|----------|
| **Local** | `pnpm dev:public` | Env validation 통과 |
| **Cloudflare Tunnel** | Health check → Tunnel 접속 | DATABASE_URL 올바른지 확인 |
| **Vercel Preview** | Environment Variables 설정 → Deploy | 프로덕션 credentials 사용 |

---

## 문제 해결

### Issue: 28P01 인증 오류

**증상**:
```
Connection error: [28P01] FATAL: password authentication failed
```

**원인**:
- `SKIP_ENV_VALIDATION=1`로 빈 env 객체 반환
- DB 클라이언트가 빈 credentials로 연결 시도

**해결**:
```bash
# 1. .env.local에 올바른 DATABASE_URL 설정
echo "DATABASE_URL=postgresql://user:password@localhost:5432/regula" >> .env.local

# 2. SKIP_ENV_VALIDATION 제거
unset SKIP_ENV_VALIDATION

# 3. dev:public로 재시작
pnpm dev:public
```

### Issue: Env validation 실패

**증상**:
```
Error: SKIP_ENV_VALIDATION=1 is allowed only for next build
```

**해결**:
```bash
# Build-time에만 허용됨
# Runtime에서는 SKIP_ENV_VALIDATION 사용 금지
unset SKIP_ENV_VALIDATION
```

### Issue: Health check 실패

**증상**:
```json
{
  "status": "unhealthy",
  "checks": {
    "database_url": { "available": false, "error": "DATABASE_URL is missing" }
  }
}
```

**해결**:
```bash
# .env.local에 필수 env 설정
cp .env.example .env.local
# .env.local을 실제 값으로 채우기
```

---

## 참고

- Issue #165: https://github.com/holee9/ra-med-bot/issues/165
- lib/env.ts: Environment validation 모듈
- scripts/health-check.ts: Health check 스크립트
- scripts/validate-runtime-env.ts: Runtime env validation
