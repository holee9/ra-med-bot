# SPEC-REGULA-CICD-001: GitHub Actions CI 설정

## Metadata

| Field        | Value                                    |
|--------------|------------------------------------------|
| SPEC-ID      | SPEC-REGULA-CICD-001                     |
| Title        | GitHub Actions CI 파이프라인 구성          |
| Status       | approved                                 |
| Priority     | High                                     |
| Author       | MoAI (auto-generated)                    |
| Created      | 2026-05-02                               |
| Methodology  | TDD                                      |

## Objective

Regula 프로젝트에 GitHub Actions CI 워크플로우를 추가하여,
`main` 브랜치 push 및 PR 생성 시 코드 품질(lint · typecheck · test · build)을
자동으로 검증한다.

## Scope

**In Scope:**
- `.github/workflows/ci.yml` — CI 워크플로우 파일

**Out of Scope:**
- CD(배포) 파이프라인
- E2E 테스트 (Playwright) — DB/브라우저 환경 필요, 별도 SPEC
- Dependabot 설정

## Requirements (EARS Format)

### REQ-CICD-001: 트리거
WHEN `main` 브랜치에 push되거나 `main`을 대상으로 하는 PR이 생성·업데이트될 때,
CI 파이프라인 SHALL 자동으로 실행된다.

### REQ-CICD-002: 병렬 잡 구성
CI 파이프라인은 다음 4개의 잡을 **병렬로** 실행 SHALL 한다:
- `lint` — `pnpm lint` (Biome check + no-hex-colors)
- `typecheck` — `pnpm typecheck` (tsc --noEmit)
- `test` — `pnpm test` (Vitest 단위 테스트)
- `build` — `pnpm build` (Next.js 프로덕션 빌드)

### REQ-CICD-003: pnpm 설정
각 잡은 `pnpm/action-setup@v4`로 pnpm@9.12.0을 설정하고,
`actions/setup-node@v4`의 `cache: 'pnpm'` 옵션으로 스토어 캐시를 활용 SHALL 한다.

### REQ-CICD-004: Node.js 버전
CI는 Node.js 20.x를 사용 SHALL 한다 (engines.node >=20.0.0 준수).

### REQ-CICD-005: Next.js 빌드 캐시
`build` 잡은 `actions/cache@v4`를 사용해 `.next/cache` 디렉토리를
`pnpm-lock.yaml` 해시 기반으로 캐시 SHALL 한다.

### REQ-CICD-006: 빌드 환경변수
`build` 잡은 `lib/env.ts` Zod 검증을 통과하는 더미 환경변수를
`env:` 블록으로 주입 SHALL 한다.
실제 시크릿 값은 포함하지 않으며, CI 빌드 아티팩트 검증 목적의 플레이스홀더만 사용한다.

### REQ-CICD-007: 실패 시 머지 차단
어느 한 잡이라도 실패하면 PR 머지가 차단 SHALL 된다
(GitHub Branch Protection Rules 설정은 SPEC 범위 외, 워크플로우 구조로 지원).

## Acceptance Criteria

| ID   | 기준                                                               |
|------|-------------------------------------------------------------------|
| AC-1 | `.github/workflows/ci.yml` 파일이 존재한다                         |
| AC-2 | 워크플로우에 `push.branches: [main]` 트리거가 정의된다              |
| AC-3 | 워크플로우에 `pull_request.branches: [main]` 트리거가 정의된다      |
| AC-4 | `lint`, `typecheck`, `test`, `build` 4개 잡이 정의된다             |
| AC-5 | 각 잡에 `pnpm/action-setup@v4` 스텝이 포함된다                     |
| AC-6 | `build` 잡에 `.next/cache` 캐시 스텝이 포함된다                    |
| AC-7 | `build` 잡에 더미 env vars 블록이 포함된다                         |
| AC-8 | `pnpm install --frozen-lockfile`으로 의존성을 설치한다              |

## Technical Notes

- pnpm 버전: `packageManager` 필드에서 추출 → `9.12.0`
- Node.js: `20`  (engines.node >=20.0.0)
- `lib/env.ts`의 `getEnv()`는 lazy evaluation이지만,
  Next.js 빌드 중 서버 컴포넌트가 `getEnv()`를 호출할 수 있으므로
  더미 env vars를 반드시 주입한다.
- 더미 `AUTH_SECRET`은 Zod 스키마의 `min(32)` 조건을 충족해야 한다.

## Files to Create

| Path                          | Description                     |
|-------------------------------|---------------------------------|
| `.github/workflows/ci.yml`    | GitHub Actions CI 워크플로우 파일 |
