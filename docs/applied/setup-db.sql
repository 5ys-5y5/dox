-- 신규 DB 기준 서명 도메인 전체 스키마
-- 중요:
-- 1. 이 파일은 signing 스키마를 정본으로 사용합니다.
-- 2. 기존 public.sign_* 테이블이 이미 있는 DB라면 먼저
--    docs/applied/run-this-supabase-signing-schema-migration.sql 을 실행해야 합니다.
-- 3. Supabase Dashboard > Project Settings > API > Exposed schemas 에 signing 을 추가해야
--    src/services/signService.ts 와 src/services/signAuthService.ts 의 schema('signing') 호출이 동작합니다.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS signing;

COMMENT ON SCHEMA signing IS
    'SIGNING_DOMAIN_SCHEMA: sign_requests, sign_authentications, signatures, signature_audit_logs are owned by the signing service boundary.';

DO $$
BEGIN
    IF (
        to_regclass('public.sign_requests') IS NOT NULL
        OR to_regclass('public.sign_authentications') IS NOT NULL
        OR to_regclass('public.signatures') IS NOT NULL
        OR to_regclass('public.signature_audit_logs') IS NOT NULL
    ) AND to_regclass('signing.sign_requests') IS NULL THEN
        RAISE EXCEPTION 'legacy public sign tables detected. Run docs/applied/run-this-supabase-signing-schema-migration.sql before setup-db.sql';
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA signing TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA signing TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA signing TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA signing TO service_role;

CREATE TABLE IF NOT EXISTS signing.sign_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL,
    document_hash TEXT,
    document_hash_algorithm TEXT DEFAULT 'sha256',
    document_hash_encoding TEXT DEFAULT 'hex',
    document_canonicalization TEXT DEFAULT 'utf8-string',
    document_byte_length INTEGER,
    signer_info JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    expiration_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signing.sign_authentications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES signing.sign_requests(id) ON DELETE CASCADE,
    provider_group TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_product TEXT NOT NULL,
    receipt_id TEXT,
    transaction_id TEXT,
    request_nonce_hash TEXT,
    document_hash TEXT NOT NULL,
    document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256',
    document_hash_encoding TEXT NOT NULL DEFAULT 'hex',
    document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string',
    document_byte_length INTEGER NOT NULL DEFAULT 0,
    consent_text_hash TEXT NOT NULL,
    terms_version TEXT NOT NULL,
    ci_hash TEXT,
    di_hash TEXT,
    signer_name_enc TEXT,
    birthdate_enc TEXT,
    phone_enc TEXT,
    signed_data_hash TEXT,
    raw_response_hash TEXT,
    auth_status VARCHAR(20) NOT NULL DEFAULT 'requested',
    provider_metadata JSONB,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signing.signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES signing.sign_requests(id) ON DELETE CASCADE,
    document_hash TEXT NOT NULL,
    document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256',
    document_hash_encoding TEXT NOT NULL DEFAULT 'hex',
    document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string',
    document_byte_length INTEGER NOT NULL DEFAULT 0,
    integrity_version INTEGER NOT NULL DEFAULT 1,
    signature_image_path TEXT,
    signer_id UUID,
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signing.signature_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES signing.sign_requests(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE signing.sign_requests ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE signing.sign_requests ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT DEFAULT 'sha256';
ALTER TABLE signing.sign_requests ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT DEFAULT 'hex';
ALTER TABLE signing.sign_requests ADD COLUMN IF NOT EXISTS document_canonicalization TEXT DEFAULT 'utf8-string';
ALTER TABLE signing.sign_requests ADD COLUMN IF NOT EXISTS document_byte_length INTEGER;

ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS provider_group TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS provider_product TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS receipt_id TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS request_nonce_hash TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256';
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT NOT NULL DEFAULT 'hex';
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string';
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS document_byte_length INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS consent_text_hash TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS ci_hash TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS di_hash TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS signer_name_enc TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS birthdate_enc TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS phone_enc TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS signed_data_hash TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS raw_response_hash TEXT;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS auth_status VARCHAR(20) NOT NULL DEFAULT 'requested';
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS provider_metadata JSONB;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE signing.sign_authentications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE signing.signatures ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256';
ALTER TABLE signing.signatures ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT NOT NULL DEFAULT 'hex';
ALTER TABLE signing.signatures ADD COLUMN IF NOT EXISTS document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string';
ALTER TABLE signing.signatures ADD COLUMN IF NOT EXISTS document_byte_length INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signing.signatures ADD COLUMN IF NOT EXISTS integrity_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE signing.sign_requests DROP CONSTRAINT IF EXISTS chk_sign_requests_status;
ALTER TABLE signing.sign_requests
    ADD CONSTRAINT chk_sign_requests_status
    CHECK (status IN ('pending', 'authenticating', 'authenticated', 'signed', 'failed', 'expired'));

ALTER TABLE signing.sign_requests DROP CONSTRAINT IF EXISTS chk_sign_requests_document_hash_sha256;
ALTER TABLE signing.sign_requests
    ADD CONSTRAINT chk_sign_requests_document_hash_sha256
    CHECK (document_hash IS NULL OR document_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE signing.sign_requests DROP CONSTRAINT IF EXISTS chk_sign_requests_hash_algorithm;
ALTER TABLE signing.sign_requests
    ADD CONSTRAINT chk_sign_requests_hash_algorithm
    CHECK (document_hash_algorithm = 'sha256');

ALTER TABLE signing.sign_requests DROP CONSTRAINT IF EXISTS chk_sign_requests_hash_encoding;
ALTER TABLE signing.sign_requests
    ADD CONSTRAINT chk_sign_requests_hash_encoding
    CHECK (document_hash_encoding = 'hex');

ALTER TABLE signing.sign_requests DROP CONSTRAINT IF EXISTS chk_sign_requests_canonicalization;
ALTER TABLE signing.sign_requests
    ADD CONSTRAINT chk_sign_requests_canonicalization
    CHECK (document_canonicalization IN ('raw-bytes', 'utf8-string', 'canonical-json'));

ALTER TABLE signing.sign_requests DROP CONSTRAINT IF EXISTS chk_sign_requests_document_byte_length;
ALTER TABLE signing.sign_requests
    ADD CONSTRAINT chk_sign_requests_document_byte_length
    CHECK (document_byte_length IS NULL OR document_byte_length >= 0);

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_provider_group;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_provider_group
    CHECK (provider_group IN ('barocert', 'mobile_identity'));

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_provider;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_provider
    CHECK (provider IN ('kakao', 'naver', 'toss', 'pass', 'niceid', 'kcb', 'sci'));

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_provider_product;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_provider_product
    CHECK (provider_product IN ('identity', 'user_identity', 'digital_signature', 'mobile_identity'));

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_auth_status;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_auth_status
    CHECK (auth_status IN ('requested', 'completed', 'failed', 'expired', 'verified', 'cancelled'));

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_document_hash_sha256;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_document_hash_sha256
    CHECK (document_hash IS NULL OR document_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_hash_algorithm;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_hash_algorithm
    CHECK (document_hash_algorithm = 'sha256');

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_hash_encoding;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_hash_encoding
    CHECK (document_hash_encoding = 'hex');

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_canonicalization;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_canonicalization
    CHECK (document_canonicalization IN ('raw-bytes', 'utf8-string', 'canonical-json'));

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_document_byte_length;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_document_byte_length
    CHECK (document_byte_length >= 0);

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_consent_text_hash_sha256;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_consent_text_hash_sha256
    CHECK (consent_text_hash IS NULL OR consent_text_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_request_nonce_hash_sha256;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_request_nonce_hash_sha256
    CHECK (request_nonce_hash IS NULL OR request_nonce_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_signed_data_hash_sha256;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_signed_data_hash_sha256
    CHECK (signed_data_hash IS NULL OR signed_data_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE signing.sign_authentications DROP CONSTRAINT IF EXISTS chk_sign_authentications_raw_response_hash_sha256;
ALTER TABLE signing.sign_authentications
    ADD CONSTRAINT chk_sign_authentications_raw_response_hash_sha256
    CHECK (raw_response_hash IS NULL OR raw_response_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE signing.signatures DROP CONSTRAINT IF EXISTS chk_signatures_document_hash_sha256;
ALTER TABLE signing.signatures
    ADD CONSTRAINT chk_signatures_document_hash_sha256
    CHECK (document_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE signing.signatures DROP CONSTRAINT IF EXISTS chk_signatures_hash_algorithm;
ALTER TABLE signing.signatures
    ADD CONSTRAINT chk_signatures_hash_algorithm
    CHECK (document_hash_algorithm = 'sha256');

ALTER TABLE signing.signatures DROP CONSTRAINT IF EXISTS chk_signatures_hash_encoding;
ALTER TABLE signing.signatures
    ADD CONSTRAINT chk_signatures_hash_encoding
    CHECK (document_hash_encoding = 'hex');

ALTER TABLE signing.signatures DROP CONSTRAINT IF EXISTS chk_signatures_canonicalization;
ALTER TABLE signing.signatures
    ADD CONSTRAINT chk_signatures_canonicalization
    CHECK (document_canonicalization IN ('raw-bytes', 'utf8-string', 'canonical-json'));

ALTER TABLE signing.signatures DROP CONSTRAINT IF EXISTS chk_signatures_document_byte_length;
ALTER TABLE signing.signatures
    ADD CONSTRAINT chk_signatures_document_byte_length
    CHECK (document_byte_length >= 0);

CREATE INDEX IF NOT EXISTS idx_signing_sign_requests_document_id ON signing.sign_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_signing_sign_requests_document_hash ON signing.sign_requests(document_hash);
CREATE INDEX IF NOT EXISTS idx_signing_sign_authentications_request_id ON signing.sign_authentications(request_id);
CREATE INDEX IF NOT EXISTS idx_signing_sign_authentications_auth_status ON signing.sign_authentications(auth_status);
CREATE INDEX IF NOT EXISTS idx_signing_sign_authentications_document_hash ON signing.sign_authentications(document_hash);
CREATE INDEX IF NOT EXISTS idx_signing_signatures_request_id ON signing.signatures(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_signatures_request_id ON signing.signatures(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sign_authentications_verified_request
    ON signing.sign_authentications(request_id)
    WHERE auth_status = 'verified';
CREATE UNIQUE INDEX IF NOT EXISTS uq_sign_authentications_provider_receipt_id
    ON signing.sign_authentications(provider_group, provider, receipt_id)
    WHERE receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signing_signature_audit_logs_request_id ON signing.signature_audit_logs(request_id);

CREATE OR REPLACE FUNCTION signing.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.prevent_sign_request_hash_mutation()
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.validate_sign_authentication_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.auth_status IS DISTINCT FROM NEW.auth_status AND NOT (
        (OLD.auth_status = 'requested' AND NEW.auth_status IN ('completed', 'verified', 'failed', 'expired', 'cancelled')) OR
        (OLD.auth_status = 'completed' AND NEW.auth_status IN ('verified', 'failed', 'expired', 'cancelled')) OR
        (OLD.auth_status = 'verified' AND NEW.auth_status IN ('expired'))
    ) THEN
        RAISE EXCEPTION 'invalid sign_authentications status transition: % -> %', OLD.auth_status, NEW.auth_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.enforce_sign_authentication_request_integrity()
RETURNS TRIGGER AS $$
DECLARE
    request_record signing.sign_requests%ROWTYPE;
BEGIN
    SELECT *
    INTO request_record
    FROM signing.sign_requests
    WHERE id = NEW.request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sign_authentications.request_id does not reference an existing sign_requests row';
    END IF;

    IF request_record.status IN ('signed', 'expired') THEN
        RAISE EXCEPTION 'sign_authentications cannot be written for sign_requests status %', request_record.status;
    END IF;

    IF request_record.document_hash IS NULL OR request_record.document_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'sign_authentications cannot be inserted before sign_requests.document_hash is fixed';
    END IF;

    IF request_record.document_hash_algorithm <> 'sha256'
       OR request_record.document_hash_encoding <> 'hex'
       OR request_record.document_canonicalization NOT IN ('raw-bytes', 'utf8-string', 'canonical-json')
       OR request_record.document_byte_length IS NULL
       OR request_record.document_byte_length <= 0 THEN
        RAISE EXCEPTION 'sign_authentications cannot be inserted before sign_requests hash metadata is complete';
    END IF;

    IF NEW.document_hash IS DISTINCT FROM request_record.document_hash
       OR NEW.document_hash_algorithm IS DISTINCT FROM request_record.document_hash_algorithm
       OR NEW.document_hash_encoding IS DISTINCT FROM request_record.document_hash_encoding
       OR NEW.document_canonicalization IS DISTINCT FROM request_record.document_canonicalization
       OR NEW.document_byte_length IS DISTINCT FROM request_record.document_byte_length THEN
        RAISE EXCEPTION 'sign_authentications hash metadata must match sign_requests hash metadata';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.requested_at IS NULL THEN
        NEW.requested_at = NOW();
    END IF;

    IF NEW.auth_status IN ('completed', 'verified') AND NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
    END IF;

    IF NEW.auth_status = 'verified' AND NEW.verified_at IS NULL THEN
        NEW.verified_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.enforce_sign_request_document_hash_required()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('pending', 'authenticating', 'authenticated', 'signed')
       AND (
           NEW.document_hash IS NULL
           OR NEW.document_hash !~ '^[a-f0-9]{64}$'
           OR NEW.document_hash_algorithm <> 'sha256'
           OR NEW.document_hash_encoding <> 'hex'
           OR NEW.document_canonicalization NOT IN ('raw-bytes', 'utf8-string', 'canonical-json')
           OR NEW.document_byte_length IS NULL
           OR NEW.document_byte_length <= 0
       ) THEN
        RAISE EXCEPTION 'active sign_requests rows require fixed document hash metadata before insert/update';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.validate_sign_request_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- AUTH_GATE_POST_INTEGRATION_REQUIRED
    -- BaroCert/PASS 본인확인 연동 후에는 pending -> signed 임시 허용을 제거하고
    -- authenticated -> signed만 남겨야 합니다.
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.enforce_signed_request_document_integrity()
RETURNS TRIGGER AS $$
DECLARE
    request_signature_count INTEGER;
    matching_signature_count INTEGER;
    verified_auth_count INTEGER;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'signed' THEN
        RAISE EXCEPTION 'sign_requests cannot be inserted directly as signed';
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.status = 'signed'
       AND (
           OLD.document_hash IS DISTINCT FROM NEW.document_hash OR
           OLD.document_hash_algorithm IS DISTINCT FROM NEW.document_hash_algorithm OR
           OLD.document_hash_encoding IS DISTINCT FROM NEW.document_hash_encoding OR
           OLD.document_canonicalization IS DISTINCT FROM NEW.document_canonicalization OR
           OLD.document_byte_length IS DISTINCT FROM NEW.document_byte_length
       ) THEN
        RAISE EXCEPTION 'signed sign_requests hash metadata cannot be changed or backfilled';
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.status = 'signed'
       AND OLD.status IS DISTINCT FROM NEW.status THEN

        IF OLD.document_hash IS NULL OR OLD.document_hash !~ '^[a-f0-9]{64}$' THEN
            RAISE EXCEPTION 'sign_requests.document_hash must be fixed before signed status';
        END IF;

        IF OLD.document_hash_algorithm <> 'sha256'
           OR OLD.document_hash_encoding <> 'hex'
           OR OLD.document_canonicalization NOT IN ('raw-bytes', 'utf8-string', 'canonical-json')
           OR OLD.document_byte_length IS NULL
           OR OLD.document_byte_length <= 0 THEN
            RAISE EXCEPTION 'sign_requests hash metadata must be complete before signed status';
        END IF;

        SELECT count(*)
        INTO request_signature_count
        FROM signing.signatures
        WHERE request_id = NEW.id;

        IF request_signature_count <> 1 THEN
            RAISE EXCEPTION 'signed request must have exactly one signature row, found %', request_signature_count;
        END IF;

        SELECT count(*)
        INTO matching_signature_count
        FROM signing.signatures
        WHERE request_id = NEW.id
          AND document_hash = OLD.document_hash
          AND document_hash_algorithm = OLD.document_hash_algorithm
          AND document_hash_encoding = OLD.document_hash_encoding
          AND document_canonicalization = OLD.document_canonicalization
          AND document_byte_length = OLD.document_byte_length;

        IF matching_signature_count <> 1 THEN
            RAISE EXCEPTION 'signature hash metadata must match sign_requests hash metadata before signed status';
        END IF;

        IF OLD.status = 'authenticated' THEN
            SELECT count(*)
            INTO verified_auth_count
            FROM signing.sign_authentications
            WHERE request_id = NEW.id
              AND auth_status = 'verified'
              AND document_hash = OLD.document_hash
              AND document_hash_algorithm = OLD.document_hash_algorithm
              AND document_hash_encoding = OLD.document_hash_encoding
              AND document_canonicalization = OLD.document_canonicalization
              AND document_byte_length = OLD.document_byte_length;

            IF verified_auth_count < 1 THEN
                RAISE EXCEPTION 'authenticated sign_requests must have a verified sign_authentications row before signed status';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.enforce_signature_request_document_integrity()
RETURNS TRIGGER AS $$
DECLARE
    request_record signing.sign_requests%ROWTYPE;
    verified_auth_count INTEGER;
BEGIN
    SELECT *
    INTO request_record
    FROM signing.sign_requests
    WHERE id = NEW.request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'signatures.request_id does not reference an existing sign_requests row';
    END IF;

    -- AUTH_GATE_POST_INTEGRATION_REQUIRED
    -- BaroCert/PASS 본인확인 연동 후에는 pending 허용을 제거하고
    -- request_record.status = authenticated 만 signature INSERT 가능하게 좁혀야 합니다.
    IF request_record.status NOT IN ('pending', 'authenticated') THEN
        RAISE EXCEPTION 'signature insert is not allowed for sign_requests status %', request_record.status;
    END IF;

    IF request_record.document_hash IS NULL OR request_record.document_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'signatures cannot be inserted before sign_requests.document_hash is fixed';
    END IF;

    IF request_record.document_hash_algorithm <> 'sha256'
       OR request_record.document_hash_encoding <> 'hex'
       OR request_record.document_canonicalization NOT IN ('raw-bytes', 'utf8-string', 'canonical-json')
       OR request_record.document_byte_length IS NULL
       OR request_record.document_byte_length <= 0 THEN
        RAISE EXCEPTION 'signatures cannot be inserted before sign_requests hash metadata is complete';
    END IF;

    IF NEW.document_hash IS DISTINCT FROM request_record.document_hash
       OR NEW.document_hash_algorithm IS DISTINCT FROM request_record.document_hash_algorithm
       OR NEW.document_hash_encoding IS DISTINCT FROM request_record.document_hash_encoding
       OR NEW.document_canonicalization IS DISTINCT FROM request_record.document_canonicalization
       OR NEW.document_byte_length IS DISTINCT FROM request_record.document_byte_length THEN
        RAISE EXCEPTION 'signature hash metadata must match sign_requests hash metadata';
    END IF;

    IF request_record.status = 'authenticated' THEN
        SELECT count(*)
        INTO verified_auth_count
        FROM signing.sign_authentications
        WHERE request_id = NEW.request_id
          AND auth_status = 'verified'
          AND document_hash = request_record.document_hash
          AND document_hash_algorithm = request_record.document_hash_algorithm
          AND document_hash_encoding = request_record.document_hash_encoding
          AND document_canonicalization = request_record.document_canonicalization
          AND document_byte_length = request_record.document_byte_length;

        IF verified_auth_count < 1 THEN
            RAISE EXCEPTION 'authenticated sign_requests require a verified sign_authentications row before signatures insert';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION signing.prevent_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% rows are append-only and cannot be %', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sign_requests_updated_at ON signing.sign_requests;
CREATE TRIGGER update_sign_requests_updated_at
    BEFORE UPDATE ON signing.sign_requests
    FOR EACH ROW
    EXECUTE FUNCTION signing.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sign_authentications_updated_at ON signing.sign_authentications;
CREATE TRIGGER update_sign_authentications_updated_at
    BEFORE UPDATE ON signing.sign_authentications
    FOR EACH ROW
    EXECUTE FUNCTION signing.update_updated_at_column();

DROP TRIGGER IF EXISTS protect_sign_request_hash ON signing.sign_requests;
CREATE TRIGGER protect_sign_request_hash
    BEFORE UPDATE ON signing.sign_requests
    FOR EACH ROW
    EXECUTE FUNCTION signing.prevent_sign_request_hash_mutation();

DROP TRIGGER IF EXISTS validate_sign_authentication_status ON signing.sign_authentications;
CREATE TRIGGER validate_sign_authentication_status
    BEFORE UPDATE ON signing.sign_authentications
    FOR EACH ROW
    EXECUTE FUNCTION signing.validate_sign_authentication_status_transition();

DROP TRIGGER IF EXISTS enforce_sign_authentication_integrity ON signing.sign_authentications;
CREATE TRIGGER enforce_sign_authentication_integrity
    BEFORE INSERT OR UPDATE ON signing.sign_authentications
    FOR EACH ROW
    EXECUTE FUNCTION signing.enforce_sign_authentication_request_integrity();

DROP TRIGGER IF EXISTS require_sign_request_document_hash ON signing.sign_requests;
CREATE TRIGGER require_sign_request_document_hash
    BEFORE INSERT OR UPDATE ON signing.sign_requests
    FOR EACH ROW
    EXECUTE FUNCTION signing.enforce_sign_request_document_hash_required();

DROP TRIGGER IF EXISTS validate_sign_request_status ON signing.sign_requests;
CREATE TRIGGER validate_sign_request_status
    BEFORE UPDATE ON signing.sign_requests
    FOR EACH ROW
    EXECUTE FUNCTION signing.validate_sign_request_status_transition();

DROP TRIGGER IF EXISTS enforce_signed_request_integrity ON signing.sign_requests;
CREATE TRIGGER enforce_signed_request_integrity
    BEFORE INSERT OR UPDATE ON signing.sign_requests
    FOR EACH ROW
    EXECUTE FUNCTION signing.enforce_signed_request_document_integrity();

DROP TRIGGER IF EXISTS enforce_signature_request_integrity ON signing.signatures;
CREATE TRIGGER enforce_signature_request_integrity
    BEFORE INSERT ON signing.signatures
    FOR EACH ROW
    EXECUTE FUNCTION signing.enforce_signature_request_document_integrity();

DROP TRIGGER IF EXISTS protect_signatures_append_only ON signing.signatures;
CREATE TRIGGER protect_signatures_append_only
    BEFORE UPDATE OR DELETE ON signing.signatures
    FOR EACH ROW
    EXECUTE FUNCTION signing.prevent_append_only_mutation();

DROP TRIGGER IF EXISTS protect_signature_audit_logs_append_only ON signing.signature_audit_logs;
CREATE TRIGGER protect_signature_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON signing.signature_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION signing.prevent_append_only_mutation();
