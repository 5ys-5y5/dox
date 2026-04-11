-- 기존 public 전자서명 테이블을 signing 스키마로 이동합니다.
-- 실행 대상:
-- - 이미 public.sign_requests / public.signatures 등을 사용 중인 기존 DB
-- 실행 후 반드시 이어서 할 일:
-- 1. docs/applied/setup-db.sql 재실행
-- 2. Supabase Dashboard > Project Settings > API > Exposed schemas 에 signing 추가
-- 3. docs/applied/verify-signing-schema-migration.sql 실행

CREATE SCHEMA IF NOT EXISTS signing;

DO $$
BEGIN
    IF to_regclass('public.sign_requests') IS NOT NULL AND to_regclass('signing.sign_requests') IS NOT NULL THEN
        RAISE EXCEPTION 'both public.sign_requests and signing.sign_requests exist. resolve duplicate tables before migration';
    END IF;

    IF to_regclass('public.sign_authentications') IS NOT NULL AND to_regclass('signing.sign_authentications') IS NOT NULL THEN
        RAISE EXCEPTION 'both public.sign_authentications and signing.sign_authentications exist. resolve duplicate tables before migration';
    END IF;

    IF to_regclass('public.signatures') IS NOT NULL AND to_regclass('signing.signatures') IS NOT NULL THEN
        RAISE EXCEPTION 'both public.signatures and signing.signatures exist. resolve duplicate tables before migration';
    END IF;

    IF to_regclass('public.signature_audit_logs') IS NOT NULL AND to_regclass('signing.signature_audit_logs') IS NOT NULL THEN
        RAISE EXCEPTION 'both public.signature_audit_logs and signing.signature_audit_logs exist. resolve duplicate tables before migration';
    END IF;
END;
$$;

ALTER TABLE IF EXISTS public.sign_requests SET SCHEMA signing;
ALTER TABLE IF EXISTS public.sign_authentications SET SCHEMA signing;
ALTER TABLE IF EXISTS public.signatures SET SCHEMA signing;
ALTER TABLE IF EXISTS public.signature_audit_logs SET SCHEMA signing;

GRANT USAGE ON SCHEMA signing TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA signing TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA signing TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA signing TO service_role;

DO $$
BEGIN
    RAISE NOTICE 'signing schema migration completed. next: run docs/applied/setup-db.sql and expose the signing schema in Supabase API settings.';
END;
$$;
