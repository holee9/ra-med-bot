# 의존성 구조 — Regula

> 최종 업데이트: 2026-06-17
> 출처: 자동 생성된 코드베이스 분석
> 총 의존성 패키지: 110+개
> 주요 업데이트: Next.js 15.5.18, Drizzle ORM 0.45.2

---

## 의존성 개요

Regula는 현대적 생태계 기반으로 구축되며, 프론트엔드 백엔드, AI/ML, 데이터베이스, 개발 도구 4개 카테고리로 의존성을 분류합니다. 모든 의존성은 버전 락이 걸려 있으며, 보안 및 업데이트 관리를 위한 정책이 수립되어 있습니다.

### 의존성 분류 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                       Dependencies                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Frontend        │  │ Backend/API     │  │ AI/ML           │ │
│  │ Stack           │  │ Stack           │  │ Stack           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Database        │  │ Dev Tools       │  │ Infrastructure  │ │
│  │ Stack           │  │ Stack           │  │ Stack           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 외부 의존성 그래프

### 프론트엔드 의존성
| 카테고리 | 패키지 | 버전 | 설명 | 용도 |
|---|---|---|---|---|
| **Framework** | next | 15.0.0 | React 기반 프레임워크 | App Router, SSR |
| | react | 18.3.0 | React 라이브러리 | UI 렌더링 |
| | react-dom | 18.3.0 | DOM 렌더링 | 클라이언트 사이드 렌더링 |
| **Styling** | tailwindcss | 4.0.0 | 유틸리티 퍼스트 CSS | 디자인 시스템 |
| | @tailwindcss/typography | 0.5.0 | Tailwind 타이포그래피 플러그인 | 텍스트 스타일링 |
| **UI Components** | radix-ui | 1.0.0 | 접근성 컴포넌트 | 기본 UI 요소 |
| | lucide-react | 0.463.0 | 아이콘 라이브러리 | 시각적 요소 |
| **State Management** | zustand | 5.0.0 | 경량 상태 관리 | 클라이언트 상태 |
| | @tanstack/react-query | 5.51.1 | 서버 상태 관리 | 캐싱, 동기화 |
| **Forms** | react-hook-form | 7.52.0 | 폼 관리 라이브러리 | 폼 유효성 검사 |
| | @hookform/resolvers | 3.6.0 | 폼 유효성 해결사 | 유효성 규칙 |
| | zod | 3.23.8 | 스키마 유효성 검사 | 타입 안전한 검증 |
| **Rich Content** | react-markdown | 9.0.0 | 마크다운 렌더러 | LLM 출력 렌더링 |
| | rehype-raw | 7.0.0 | HTML 지원 | 마크다운 내 HTML |
| **Charts** | recharts | 2.12.7 | 차트 라이브러리 | 대시보드 시각화 |
| **Virtualization** | @tanstack/react-virtual | 3.8.0 | 가상화 라이브러리 | 긴 리스트 최적화 |
| **Animation** | framer-motion | 11.2.12 | 애니메이션 라이브러리 | 마이크로 인터랙션 |
| **Fonts** | next/font/google | 15.0.0 | Google Fonts 통합 | 폰트 로딩 |
| | @fontsource-variable/pretendard | 1.1.0 | Pretendard 폰트 | 한국어 UI |

### 백엔드/API 의존성
| 카테고리 | 패키지 | 버전 | 설명 | 용도 |
|---|---|---|---|---|
| **Runtime** | node | 20.17.0 | JavaScript 런타임 | 서버 실행 환경 |
| **API Framework** | next | 15.0.0 | API Route Handlers | 엔드포인트 처리 |
| **Authentication** | next-auth | 4.24.7 | 인증 라이브러리 | SSO, 세션 관리 |
| | @auth/core | 0.24.0 | Auth.js 코어 | 인증 엔진 |
| **Database ORM** | drizzle-orm | 0.33.0 | 타입 안전 ORM | 데이터 모델링 |
| | drizzle-kit | 0.21.0 | 마이그레이션 도구 | 스키마 관리 |
| **Database Driver** | postgres | 3.4.4 | PostgreSQL 클라이언트 | DB 연결 |
| | pgvector | 0.3.0 | PostgreSQL 벡터 확장 | 벡터 검색 |
| **Validation** | zod | 3.23.8 | 스키마 유효성 검사 | API 요청 검증 |
| **Security** | @types/node | 20.17.0 | Node.js 타입 정의 | 타입 안전성 |
| | cookie | 0.6.0 | 쿠키 관리 | 세션 처리 |

### AI/ML 의존성
| 카테고리 | 패키지 | 버전 | 설명 | 용도 |
|---|---|---|---|---|
| **LLM Framework** | @langchain/core | 0.3.28 | LangChain 코어 | RAG 파이프라인 |
| | @langchain/community | 0.3.28 | 커뮤니티 통합 | 확장 기능 |
| | @langchain/openai | 0.3.8 | OpenAI 통합 | 임베딩 모델 |
| | @langchain/anthropic | 0.3.8 | Anthropic 통합 | Claude 모델 |
| **Streaming** | ai | 3.3.4 | Vercel AI SDK | 스트리밍 처리 |
| | @ai-sdk/core | 0.7.1 | AI SDK 코어 | LLM 통합 |
| **Vector Search** | @pinecone/client | 3.0.2 | Pinecone 클라이언트 | 벡터 DB 접근 |
| **Embedding** | openai | 4.52.0 | OpenAI 클라이언트 | 임베딩 생성 |
| | @anthropic-ai/sdk | 0.34.0 | Anthropic SDK | Claude 접근 |
| **Re-ranking** | cohere | 5.10.0 | Cohere 클라이언트 | 결과 재정렬 |
| **Evaluation** | promptfoo | 0.86.0 | LLM 평가 도구 | 답변 품질 검증 |

### 데이터베이스 의존성
| 카테고리 | 패키지 | 버전 | 설명 | 용도 |
|---|---|---|---|---|
| **Database** | postgres | 16.3.0 | PostgreSQL 데이터베이스 | 주 데이터 저장소 |
| | pgvector | 0.8.1 | pgvector 확장 | 벡터 저장소 |
| **ORM** | drizzle-orm | 0.33.0 | 타입 안전 ORM | 쿼리 빌드 |
| | drizzle-kit | 0.21.0 | 스키마 마이그레이션 | DB 스키마 관리 |
| **Connection** | postgres | 3.4.4 | PostgreSQL 연결 | DB 연결 풀링 |
| **Full-Text Search** | pg-tsquery | 1.0.4 | PostgreSQL 전문 검색 | 텍스트 검색 |
| **Migration** | drizzle-orm | 0.33.0 | 마이그레이션 도구 | 스키마 버전 관리 |

### 개발 도구 의존성
| 카테고리 | 패키지 | 버전 | 설명 | 용도 |
|---|---|---|---|---|
| **Package Manager** | pnpm | 9.9.0 | 패키지 관리자 | 의존성 설치 |
| **Linting** | @biomejs/biome | 1.8.3 | 리얼타임 리터 | 코드 품질 |
| **Formatting** | @biomejs/biome | 1.8.3 | 코드 포맷터 | 스타일 일관성 |
| **Testing** | vitest | 2.1.3 | 단위 테스트 프레임워크 | 단위 테스트 |
| | @testing-library/react | 15.0.0 | React 테스트 유틸리티 | 컴포넌트 테스트 |
| | @testing-library/jest-dom | 6.4.0 | Jest DOM 확장 | DOM 테스트 |
| | @vitest/coverage-v8 | 1.6.0 | 테스트 커버리지 | 코드 커버리지 |
| **E2E Testing** | @playwright/test | 1.46.3 | E2E 테스트 프레임워크 | 통합 테스트 |
| | @axe-core/react | 5.0.0 | 접근성 테스팅 | 웹 접근성 |
| **Storybook** | @storybook/react | 8.3.4 | 컴포넌트 문서화 | 컴포넌트 개발 |
| | storybook-test | 2.0.0 | Storybook 테스트 | 컴포넌트 테스트 |

### 인프라 의존성
| 카테고리 | 서비스 | 버전 | 설명 | 용도 |
|---|---|---|---|---|
| **Hosting** | Vercel | - | 프론트엔드 호스팅 | 배포 |
| | Railway | - | 백엔드 호스팅 | API 서버 |
| | Supabase | - | 데이터베이스 관리 | DB 서비스 |
| | AWS S3 | - | 객체 저장소 | 파일 저장 |
| **CI/CD** | GitHub Actions | - | 자동화 파이프라인 | 배포 자동화 |
| **Monitoring** | Sentry | - | 에러 모니터링 | 에러 추적 |
| | PostHog | - | 제품 분석 | 사용자 분석 |
| | Langfuse | - | LLM 모니터링 | AI 모델 추적 |
| **Secrets** | Vercel Secrets | - | 비밀 관리 | 환경 변수 |
| | AWS Secrets Manager | - | 비밀 관리 | 민감 정보 보안 |

---

## 내부 모듈 의존성

### 애플리케이션 의존성 그래프
```mermaid
graph TD
    subgraph "Frontend Layer"
        A[app/(auth)] --> B[lib/auth]
        C[app/(app)] --> D[components/shell]
        C --> E[components/views]
        F[components/chat] --> G[hooks/useStreamingAnswer]
        F --> H[lib/ai/consult]
    end
    
    subgraph "Core Layer"
        I[lib/ai/consult] --> J[lib/db/queries]
        I --> K[lib/ai/retrievers]
        I --> L[lib/ai/prompts]
        M[lib/db/queries] --> N[lib/db/schema]
    end
    
    subgraph "State Management"
        O[hooks/useStreamingAnswer] --> P[stores/ui]
        O --> Q[stores/conversation]
        R[stores/ui] --> S[Zustand]
        Q --> S
    end
    
    subgraph "Infrastructure"
        T[lib/auth] --> U[Auth.js]
        V[lib/db/schema] --> W[PostgreSQL]
        X[lib/db/client] --> V
    end
    
    B --> I
    D --> B
    D --> R
    G --> O
    H --> I
    J --> M
    K --> N
    L --> I
    M --> N
    N --> V
    P --> R
    Q --> S
    U --> T
    V --> W
    W --> X
```

### 의존성 분석

#### 1. 핵심 의존성 체인
```
User Interaction
    ↓
React Components
    ↓
Custom Hooks (useStreamingAnswer)
    ↓
AI Module (lib/ai/consult)
    ↓
Database Module (lib/db/queries)
    ↓
PostgreSQL Database
```

#### 2. 의존성 복잡도
- **총 모듈 수**: 12개 주요 모듈
- **외부 의존성**: 50+ 패키지
- **의존성 깊이**: 최대 4단계
- **순환 의존성**: 0개 (설계 목표)

#### 3. 의존성 분포
| 레이어 | 모듈 수 | 외부 의존성 | 내부 의존성 |
|---|---|---|---|
| Presentation | 6개 | 30+ | 2개 |
| Application | 3개 | 10+ | 5개 |
| Domain | 2개 | 5+ | 3개 |
| Infrastructure | 1개 | 5+ | 1개 |

---

## 의존성 관리 전략

### 1. 의존성 버전 관리

#### 버전 고정 정책
- **파일 로크**: 모든 패키지 버전 고정
- **세마버**: 주요 업데이트 시 업데이트
- **패치**: 보안 패치 자동 업데이트
- **마이너**: 주요 기능 업데이트 검토 후 적용

#### 업데이트 주기
| 의존성 유형 | 업데이트 주기 | 검증 방법 |
|---|---|---|
| 보안 패치 | 월간 | 자동 스캔 |
| 패치 버전 | 분기 | 테스트 스위트 |
| 마이너 버전 | 6개월 | 통합 테스트 |
| 메이저 버전 | 수동 | 심층 검토 |

### 2. 의존성 보안

#### 보안 검사
- **npm audit**: 정기적 보안 취약점 검사
- **Snyk**: 상세 보안 분석
- **Dependabot**: 자동 보안 업데이트

#### 취약점 대응
- **긴급**: 24시간 내 패치 적용
- **중요**: 일주일 내 대응
- **주의**: 다음 업데이트에서 해결

### 3. 의존성 최적화

#### 번들 크기 최적화
- **Tree shaking**: 사용되지 않는 코드 제거
- 코드 분할: `next/dynamic` 활용
- 지연 로딩: 초기 로딩 성능 개선

#### 성능 모니터링
- **Bundle Analyzer**: 번들 크기 분석
- **Lighthouse**: 성능 점수 추적
- **Web Vitals**: 사용자 경지 모니터링

### 4. 의존성 충돌 해결

#### 충돌 검출
- `npm ls`: 의존성 트리 분석
- `npm outdated`: 업데이트 확인
- `npm dedupe`: 중복 의존성 제거

#### 해결 전략
- **패치 업그레이드**: 가능한 경우 최신 버전으로
- **대체 패키지**: 호환성 있는 대체 패키지 검토
- **필요 시 분기**: 충돌 해결이 어려운 경우 별도 버전 관리

---

## 패키지 매니저 구성

### pnpm 설정
```json
{
  "packageManager": "pnpm@9.9.0",
  "engines": {
    "node": ">=20.17.0"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "18.3.0",
    "react-dom": "18.3.0",
    "@langchain/core": "0.3.28",
    "drizzle-orm": "0.33.0"
  },
  "devDependencies": {
    "@biomejs/biome": "1.8.3",
    "vitest": "2.1.3",
    "@playwright/test": "1.46.3"
  },
  "pnpm": {
    "overrides": {
      "react": "18.3.0",
      "react-dom": "18.3.0"
    }
  }
}
```

### lock 파일 관리
- **pnpm-lock.yaml**: 정�한 의존성 버전 고정
- **체크인**: lock 파일을 Git에 관리
- **재생성**: 의존성 업데이트 시 재생성

---

## 의존성 성능 영향

### 1. 로딩 성능
| 의존성 | 크기 (KB) | 로딩 시간 영향 | 최적화 전략 |
|---|---|---|---|
| React | 130KB | 높음 | 코드 분할 |
| Tailwind | 450KB | 높음 | Tree shaking |
| Recharts | 180KB | 중간 | 동적 임포트 |
| Framer Motion | 220KB | 중간 | 조건적 렌더링 |

### 2. 실행 성능
| 의존성 | 실행 시간 영향 | 메모리 사용 | 최적화 방법 |
|---|---|---|---|
| Zustand | 낮음 | 낮음 | 선택자 사용 |
| TanStack Query | 중간 | 중간 | 캐싱 활용 |
| LangChain | 높음 | 높음 | 세션 공유 |
| PostgreSQL | 높음 | 높음 | 연결 풀링 |

### 3. 빌드 성능
| 의존성 | 빌드 시간 영향 | 캐싱 효과 | 최적화 방법 |
|---|---|---|---|
| Next.js | 높음 | 좋음 | 증분 빌드 |
| TypeScript | 중간 | 좋음 | 타입 검증 캐싱 |
| Biome | 낮음 | 좋음 | 빠른 리싸이클링 |
| Vitest | 중간 | 중간 | 테스트 분할 |

---

## 의존성 모니터링

### 1. 의존성 문제 추적
| 문제 유형 | 감지 방법 | 대응 시간 |
|---|---|---|
| 취약점 | npm audit, Snyk | 24시간 |
| 호환성 문제 | CI/CD 실패 | 즉시 |
| 성능 저하 | Lighthouse 점수 | 일주일 |
| 크기 증가 | Bundle Analyzer | 분기 |

### 2. 지표 모니터링
- **의존성 수**: 총 패키지 수 추적
- **버전 호환성**: 의존성 충돌 모니터링
- **보안 상태**: 취약점 추적
- **성능 영향**: 번들 크기 추적

### 3. 경고 시스템
- **알림 설정**: 의존성 문제 시 알림
- **자동 검사**: CI/CD 파이프라인 통합
- **정기 리뷰**: 주기적 의존성 리뷰

---

## 관련 핸드오프 섹션

- §4 Recommended Tech Stack — 기술 스택 선택 근거
- §11 Backend Integration & API Contracts — API 통합 패턴
- §12 Data Models — 데이터 모델 설계
- §17 Testing Strategy — 테스트 도구 전략
- §18 Deployment & DevOps — 배포 및 DevOps 전략