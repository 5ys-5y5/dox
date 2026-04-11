-- 2026-04-10 전자서명 무결성 보강 마이그레이션
-- 실행 상태: 2026-04-10 사용자가 Supabase SQL Editor에서 실행 완료.
-- DOCUMENT_HASH_INTEGRITY: 전자서명 문서 해시 무결성 보강 구간입니다.
-- LLM-BREADCRUMB: 운영 앱 코드 구현 시 같은 표식으로 해시 고정/재검증 로직을 연결하세요.
-- Supabase SQL Editor 실행 대상은 이 파일 하나였습니다.
-- 기존 setup-db.sql을 예전에 실행한 DB에 추가로 적용하는 용도입니다.
-- 실행 규칙:
-- 1. 이 파일은 "기본 1회 실행 + 레거시 signatures 백필" 용도입니다.
-- 2. protect_signatures_append_only 트리거가 이미 있는 DB에서는 보통 재실행할 필요가 없습니다.
-- 3. 재실행하더라도 아래 DO 블록은 append-only 트리거를 감지하면 레거시 UPDATE 백필을 건너뜁니다.

DO $$
DECLARE
    signatures_append_only_trigger_exists BOOLEAN;
BEGIN
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash TEXT;
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT DEFAULT 'sha256';
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT DEFAULT 'hex';
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_canonicalization TEXT DEFAULT 'utf8-string';
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_byte_length INTEGER;

    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT DEFAULT 'sha256';
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT DEFAULT 'hex';
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_canonicalization TEXT DEFAULT 'utf8-string';
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_byte_length INTEGER DEFAULT 0;
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS integrity_version INTEGER DEFAULT 1;

    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'protect_signatures_append_only'
          AND NOT tgisinternal
    )
    INTO signatures_append_only_trigger_exists;

    IF NOT signatures_append_only_trigger_exists THEN
        UPDATE signatures
        SET
            document_hash_algorithm = COALESCE(document_hash_algorithm, 'sha256'),
            document_hash_encoding = COALESCE(document_hash_encoding, 'hex'),
            document_canonicalization = COALESCE(document_canonicalization, 'utf8-string'),
            document_byte_length = COALESCE(document_byte_length, 0),
            integrity_version = COALESCE(integrity_version, 1);
    END IF;

    ALTER TABLE signatures ALTER COLUMN document_hash_algorithm SET DEFAULT 'sha256';
    ALTER TABLE signatures ALTER COLUMN document_hash_algorithm SET NOT NULL;
    ALTER TABLE signatures ALTER COLUMN document_hash_encoding SET DEFAULT 'hex';
    ALTER TABLE signatures ALTER COLUMN document_hash_encoding SET NOT NULL;
    ALTER TABLE signatures ALTER COLUMN document_canonicalization SET DEFAULT 'utf8-string';
    ALTER TABLE signatures ALTER COLUMN document_canonicalization SET NOT NULL;
    ALTER TABLE signatures ALTER COLUMN document_byte_length SET DEFAULT 0;
    ALTER TABLE signatures ALTER COLUMN document_byte_length SET NOT NULL;
    ALTER TABLE signatures ALTER COLUMN integrity_version SET DEFAULT 1;
    ALTER TABLE signatures ALTER COLUMN integrity_version SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_requests_status') THEN
        ALTER TABLE sign_requests
            ADD CONSTRAINT chk_sign_requests_status
            CHECK (status IN ('pending', 'authenticating', 'authenticated', 'signed', 'failed', 'expired'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_requests_document_hash_sha256') THEN
        ALTER TABLE sign_requests
            ADD CONSTRAINT chk_sign_requests_document_hash_sha256
            CHECK (document_hash IS NULL OR document_hash ~ '^[a-f0-9]{64}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_requests_hash_algorithm') THEN
        ALTER TABLE sign_requests
            ADD CONSTRAINT chk_sign_requests_hash_algorithm
            CHECK (document_hash_algorithm = 'sha256');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_requests_hash_encoding') THEN
        ALTER TABLE sign_requests
            ADD CONSTRAINT chk_sign_requests_hash_encoding
            CHECK (document_hash_encoding = 'hex');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_requests_canonicalization') THEN
        ALTER TABLE sign_requests
            ADD CONSTRAINT chk_sign_requests_canonicalization
            CHECK (document_canonicalization IN ('raw-bytes', 'utf8-string', 'canonical-json'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_requests_document_byte_length') THEN
        ALTER TABLE sign_requests
            ADD CONSTRAINT chk_sign_requests_document_byte_length
            CHECK (document_byte_length IS NULL OR document_byte_length >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_signatures_document_hash_sha256') THEN
        ALTER TABLE signatures
            ADD CONSTRAINT chk_signatures_document_hash_sha256
            CHECK (document_hash ~ '^[a-f0-9]{64}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_signatures_hash_algorithm') THEN
        ALTER TABLE signatures
            ADD CONSTRAINT chk_signatures_hash_algorithm
            CHECK (document_hash_algorithm = 'sha256');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_signatures_hash_encoding') THEN
        ALTER TABLE signatures
            ADD CONSTRAINT chk_signatures_hash_encoding
            CHECK (document_hash_encoding = 'hex');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_signatures_canonicalization') THEN
        ALTER TABLE signatures
            ADD CONSTRAINT chk_signatures_canonicalization
            CHECK (document_canonicalization IN ('raw-bytes', 'utf8-string', 'canonical-json'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_signatures_document_byte_length') THEN
        ALTER TABLE signatures
            ADD CONSTRAINT chk_signatures_document_byte_length
            CHECK (document_byte_length >= 0);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sign_requests_document_hash ON sign_requests(document_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_signatures_request_id ON signatures(request_id);

CREATE OR REPLACE FUNCTION prevent_sign_request_hash_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.document_hash IS NOT NULL AND (
        OLD.document_hash IS DISTINCT FROM NEW.document_hash OR
        OLD.document_hash_algorithm IS DISTINCT FROM NEW.document_hash_algorithm OR
        OLD.document_hash_encoding IS DISTINCT FROM NEW.document_hash_encoding OR
        OLD.document_canonicalization IS DISTINCT FROM NEW.document_canonicalization OR
        OLD.document_byte_length IS DISTINCT FROM NEW.document_byte_length
    ) THEN
        RAISE EXCEPTION 'sign_requests document hash fields are immutable after first assignment';
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS protect_sign_request_hash ON sign_requests;
CREATE TRIGGER protect_sign_request_hash
    BEFORE UPDATE ON sign_requests
    FOR EACH ROW
    EXECUTE PROCEDURE prevent_sign_request_hash_mutation();

-- AUTH_GATE_POST_INTEGRATION_REQUIRED
-- BaroCert/PASS 본인확인 연동이 끝나면 이 함수에서 pending -> signed를 제거하고
-- authenticated -> signed만 남겨야 합니다. 검증 SQL의 auth_gate_temporary_pending_signed는
-- 그 변경이 끝나기 전까지 WARN이어야 하고, 변경 후에는 PASS가 되어야 합니다.
CREATE OR REPLACE FUNCTION validate_sign_request_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
        (OLD.status = 'pending' AND NEW.status IN ('authenticating', 'authenticated', 'signed', 'failed', 'expired')) OR
        (OLD.status = 'authenticating' AND NEW.status IN ('authenticated', 'failed', 'expired')) OR
        (OLD.status = 'authenticated' AND NEW.status IN ('signed', 'expired')) OR
        (OLD.status = 'failed' AND NEW.status IN ('authenticating', 'expired'))
    ) THEN
        RAISE EXCEPTION 'invalid sign_requests status transition: % -> %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS validate_sign_request_status ON sign_requests;
CREATE TRIGGER validate_sign_request_status
    BEFORE UPDATE ON sign_requests
    FOR EACH ROW
    EXECUTE PROCEDURE validate_sign_request_status_transition();

CREATE OR REPLACE FUNCTION prevent_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% rows are append-only and cannot be %', TG_TABLE_NAME, TG_OP;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS protect_signatures_append_only ON signatures;
CREATE TRIGGER protect_signatures_append_only
    BEFORE UPDATE OR DELETE ON signatures
    FOR EACH ROW
    EXECUTE PROCEDURE prevent_append_only_mutation();

DROP TRIGGER IF EXISTS protect_signature_audit_logs_append_only ON signature_audit_logs;
CREATE TRIGGER protect_signature_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON signature_audit_logs
    FOR EACH ROW
    EXECUTE PROCEDURE prevent_append_only_mutation();
