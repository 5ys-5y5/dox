-- 본인확인 증적 스키마 보강용 증분 SQL
-- 대상: 이미 docs/setup-db.sql 또는 무결성 SQL이 적용된 기존 DB
-- 목적: sign_authentications 테이블, 상태 전이 제약, authenticated 경로 DB guard 추가
-- 실행 규칙:
-- 1. 기존 운영 DB에 본인확인 기능을 추가할 때 실행합니다.
-- 2. 신규 DB는 이 파일 대신 docs/setup-db.sql 전체를 실행하면 됩니다.
-- 3. 재실행 가능하도록 IF NOT EXISTS / CREATE OR REPLACE 위주로 작성했습니다.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sign_authentications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES sign_requests(id) ON DELETE CASCADE,
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

ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS provider_group TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS provider_product TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS receipt_id TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS request_nonce_hash TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256';
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT NOT NULL DEFAULT 'hex';
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string';
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS document_byte_length INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS consent_text_hash TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS ci_hash TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS di_hash TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS signer_name_enc TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS birthdate_enc TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS phone_enc TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS signed_data_hash TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS raw_response_hash TEXT;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS auth_status VARCHAR(20) NOT NULL DEFAULT 'requested';
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS provider_metadata JSONB;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sign_authentications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_provider_group') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_provider_group
            CHECK (provider_group IN ('barocert', 'mobile_identity'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_provider') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_provider
            CHECK (provider IN ('kakao', 'naver', 'toss', 'pass', 'niceid', 'kcb', 'sci'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_provider_product') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_provider_product
            CHECK (provider_product IN ('identity', 'user_identity', 'digital_signature', 'mobile_identity'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_auth_status') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_auth_status
            CHECK (auth_status IN ('requested', 'completed', 'failed', 'expired', 'verified', 'cancelled'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_document_hash_sha256') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_document_hash_sha256
            CHECK (document_hash IS NULL OR document_hash ~ '^[a-f0-9]{64}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_hash_algorithm') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_hash_algorithm
            CHECK (document_hash_algorithm = 'sha256');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_hash_encoding') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_hash_encoding
            CHECK (document_hash_encoding = 'hex');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_canonicalization') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_canonicalization
            CHECK (document_canonicalization IN ('raw-bytes', 'utf8-string', 'canonical-json'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_document_byte_length') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_document_byte_length
            CHECK (document_byte_length >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_consent_text_hash_sha256') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_consent_text_hash_sha256
            CHECK (consent_text_hash IS NULL OR consent_text_hash ~ '^[a-f0-9]{64}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_request_nonce_hash_sha256') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_request_nonce_hash_sha256
            CHECK (request_nonce_hash IS NULL OR request_nonce_hash ~ '^[a-f0-9]{64}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_signed_data_hash_sha256') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_signed_data_hash_sha256
            CHECK (signed_data_hash IS NULL OR signed_data_hash ~ '^[a-f0-9]{64}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sign_authentications_raw_response_hash_sha256') THEN
        ALTER TABLE sign_authentications
            ADD CONSTRAINT chk_sign_authentications_raw_response_hash_sha256
            CHECK (raw_response_hash IS NULL OR raw_response_hash ~ '^[a-f0-9]{64}$');
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sign_authentications_request_id ON sign_authentications(request_id);
CREATE INDEX IF NOT EXISTS idx_sign_authentications_auth_status ON sign_authentications(auth_status);
CREATE INDEX IF NOT EXISTS idx_sign_authentications_document_hash ON sign_authentications(document_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sign_authentications_verified_request
    ON sign_authentications(request_id)
    WHERE auth_status = 'verified';
CREATE UNIQUE INDEX IF NOT EXISTS uq_sign_authentications_provider_receipt_id
    ON sign_authentications(provider_group, provider, receipt_id)
    WHERE receipt_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sign_authentications_updated_at ON sign_authentications;
CREATE TRIGGER update_sign_authentications_updated_at
    BEFORE UPDATE ON sign_authentications
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE OR REPLACE FUNCTION validate_sign_authentication_status_transition()
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
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS validate_sign_authentication_status ON sign_authentications;
CREATE TRIGGER validate_sign_authentication_status
    BEFORE UPDATE ON sign_authentications
    FOR EACH ROW
    EXECUTE PROCEDURE validate_sign_authentication_status_transition();

CREATE OR REPLACE FUNCTION enforce_sign_authentication_request_integrity()
RETURNS TRIGGER AS $$
DECLARE
    request_record sign_requests%ROWTYPE;
BEGIN
    SELECT *
    INTO request_record
    FROM sign_requests
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
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS enforce_sign_authentication_integrity ON sign_authentications;
CREATE TRIGGER enforce_sign_authentication_integrity
    BEFORE INSERT OR UPDATE ON sign_authentications
    FOR EACH ROW
    EXECUTE PROCEDURE enforce_sign_authentication_request_integrity();

CREATE OR REPLACE FUNCTION enforce_signed_request_document_integrity()
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
        FROM signatures
        WHERE request_id = NEW.id;

        IF request_signature_count <> 1 THEN
            RAISE EXCEPTION 'signed request must have exactly one signature row, found %', request_signature_count;
        END IF;

        SELECT count(*)
        INTO matching_signature_count
        FROM signatures
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
            FROM sign_authentications
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
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS enforce_signed_request_integrity ON sign_requests;
CREATE TRIGGER enforce_signed_request_integrity
    BEFORE INSERT OR UPDATE ON sign_requests
    FOR EACH ROW
    EXECUTE PROCEDURE enforce_signed_request_document_integrity();

CREATE OR REPLACE FUNCTION enforce_signature_request_document_integrity()
RETURNS TRIGGER AS $$
DECLARE
    request_record sign_requests%ROWTYPE;
    verified_auth_count INTEGER;
BEGIN
    SELECT *
    INTO request_record
    FROM sign_requests
    WHERE id = NEW.request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'signatures.request_id does not reference an existing sign_requests row';
    END IF;

    -- AUTH_GATE_POST_INTEGRATION_REQUIRED
    -- BaroCert/PASS 본인확인 연동 후에는 pending 허용을 제거하고
    -- request_record.status = 'authenticated'만 signature INSERT 가능하게 좁혀야 합니다.
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
        FROM sign_authentications
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
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS enforce_signature_request_integrity ON signatures;
CREATE TRIGGER enforce_signature_request_integrity
    BEFORE INSERT ON signatures
    FOR EACH ROW
    EXECUTE PROCEDURE enforce_signature_request_document_integrity();
