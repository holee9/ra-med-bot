-- 0085_app_role.sql
-- SPEC-REGULA-RLS-ENFORCE-001 (Issue #239) — Phase 4 (migration piece)
--
-- Non-superuser application DB role `regula_app` 생성.
-- 이 role 은 NOBYPASSRLS 이므로 RLS 정책의 대상이 되며, migration 0084 의
-- FORCE ROW LEVEL SECURITY 와 함께 적용될 때 비로소 tenant isolation 이
-- 런타임에 enforce 된다.
--
-- @MX:WARN 비밀번호는 placeholder 이다. ops 는 본 migration 적용 후 즉시
--   `ALTER ROLE regula_app WITH PASSWORD '<secrets-manager 값>';` 으로
--   실제 비밀번호를 설정해야 한다. 실제 비밀번호를 본 파일에 기록하지 마십시오.
--   DATABASE_URL 도 같은 비밀번호로 설정된다 (runbook §3-4 참조).
--
-- @MX:NOTE 최초의 CREATE ROLE migration. 이전까지 regula_app role 은
--   migration 0001_audit_append_only.sql 주석에 "사전 존재해야 함"으로
--   명시되었으나 실제 생성 스크립트는 본 파일이 최초다. 0001 의
--   GRANT/REVOKE 는 role 부재 시 no-op 이므로 순서 역전은 무해하다.
--
-- @MX:SPEC SPEC-REGULA-RLS-ENFORCE-001 Phase 4
-- @MX:REASON superuser 또는 BYPASSRLS role 로는 FORCE RLS 를 걸어도 정책이
--   우회된다. 앱 코드가 실행되는 role 이 NOBYPASSRLS + NOSUPERUSER 여야
--   app.current_org_id GUC 기반 tenant filtering 이 실제로 동작한다.

-- ============================================================
-- 1. Role creation (idempotent via DO block)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'regula_app') THEN
    CREATE ROLE regula_app
      WITH LOGIN
      PASSWORD 'CHANGE_ME_SET_VIA_ALTER_ROLE'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

-- ============================================================
-- 2. Schema + table privileges
-- ============================================================
GRANT USAGE ON SCHEMA public TO regula_app;

-- 기존 테이블에 대한 DML 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO regula_app;

-- 시퀀스 사용 권한
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO regula_app;

-- 이후 migration 으로 생성되는 테이블에도 동일 권한 자동 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO regula_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO regula_app;
