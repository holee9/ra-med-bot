# QMS/PMS 도메인 아카이브

## 아카이브 사유

v3 아키텍처 개편 (BK-201, BK-202)에 따라 기존 QMS(Quality Management System) 및 PMS(Project Management System) 도메인이 폐기되었습니다.

- **Regula Charter [지양-3]**: 의료기기 품질 시스템에 관련된 법규/표준/QMS 도메인은 스코프에서 제외
- **대상 도메인**: 4개 (clinical-investigation, cyberdevice, labeling, change-control)
- **아카이브 일시**: 2026-07-02

## 복원 방법

이 아카이브를 원래 위치로 복원하려면 다음 단계를 순서대로 실행하십시오:

1. **파일 이력 복원** (git mv 역방향):
   ```bash
   # lib 복원
   git mv archive/qms-pms/lib/clinical-investigation lib/
   git mv archive/qms-pms/lib/cyberdevice lib/
   git mv archive/qms-pms/lib/labeling lib/
   git mv archive/qms-pms/lib/change-control lib/

   # app/api 복원 (존재 시)
   git mv archive/qms-pms/app/api/clinical-investigation app/api/
   git mv archive/qms-pms/app/api/cyberdevice app/api/
   git mv archive/qms-pms/app/api/labeling app/api/
   git mv archive/qms-pms/app/api/change-control app/api/

   # app/(app) 복원 (페이지 존재 시)
   git mv archive/qms-pms/app/\(app\)/clinical-investigation app/\(app\)/
   git mv archive/qms-pms/app/\(app\)/cyberdevice app/\(app\)/
   git mv archive/qms-pms/app/\(app\)/labeling app/\(app\)/
   git mv archive/qms-pms/app/\(app\)/change-control app/\(app\)/

   # tests 복원
   git mv archive/qms-pms/tests/integration tests/
   git mv archive/qms-pms/tests/unit tests/

   # components 복원 (존재 시)
   git mv archive/qms-pms/components/clinical-investigation components/
   git mv archive/qms-pms/components/cyberdevice components/
   git mv archive/qms-pms/components/labeling components/
   git mv archive/qms-pms/components/change-control components/

   # specs 복원
   git mv archive/qms-pms/specs/SPEC-REGULA-CLINICAL-INVESTIGATION-001 .moai/specs/
   git mv archive/qms-pms/specs/SPEC-REGULA-CYBERDEVICE-001 .moai/specs/
   git mv archive/qms-pms/specs/SPEC-REGULA-LABELING-001 .moai/specs/
   git mv archive/qms-pms/specs/SPEC-REGULA-CHANGE-CONTROL-001 .moai/specs/
   ```

2. **설정 복원** (config에서 archive 제거):
   - `tsconfig.json`: exclude 배열에서 `"archive/**"` 제거
   - `vitest.config.ts`: test.exclude에서 `**/archive/**` 제거
   - `biome.json`: ignore/unignore에서 archive 패턴 제거

3. **schema.ts 복원**:
   - `lib/db/schema.ts`에서 해당 4도메인 테이블 정의의 `@deprecated` 주석 제거

## 의존성 정정 (38건)

기존 구조 문서에는 이 4도메인 간 의존성이 기록되어 있었으나, 실제 코드 분석 결과 0-의존성으로 확인되어 구조 문서 §179에 정정되었습니다:

- **clinical-investigation**: 0-의존성 (KEEP 코드에서 참조 0건)
- **cyberdevice**: 0-의존성 (KEEP 코드에서 참조 0건)
- **labeling**: 0-의존성 (KEEP 코드에서 참조 0건)
- **change-control**: 0-의존성 (KEEP 코드에서 참조 0건)

상세 정정 내용은 `.moai/project/structure.md` §179를 참조하십시오.

## Migration 제자리 유지

다음 파일들은 이동하지 않고 제자리에 유지됩니다:

- **migration/**: 마이그레이션 체인 보존 (테이블 DROP 금지)
- **lib/db/schema.ts**: 테이블 정의 유지 (@deprecated 주석만 추가)
- **lib/audit.ts**: audit_action enum 값 유지

## 아카이브된 도메인

1. **clinical-investigation**: 임상조사 품질 시스템
2. **cyberdevice**: 사이버 장비 품질 시스템
3. **labeling**: 라벨링 품질 시스템
4. **change-control**: 변경관리 품질 시스템

## 참조 문서

- [v3 아키텍처 개편 계획](../../docs/proposals/v3-architecture-revamp-plan-2026-07-02.md) §4 아카이브 계획
- [구조 문서](../../.moai/project/structure.md) §150 아카이브 섹션 + §179 의존성 정정
