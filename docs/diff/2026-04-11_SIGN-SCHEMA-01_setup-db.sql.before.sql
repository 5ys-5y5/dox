-- uuid-ossp 확장 활성화 (UUID 생성을 위함)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 서명 요청 테이블
-- 서명 프로세스의 시작과 만료, 상태를 관리합니다.
CREATE TABLE IF NOT EXISTS sign_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL, -- 대상 문서 식별자 (UUID에서 TEXT로 변경)
    document_hash TEXT, -- 요청 시점에 고정한 SHA-256 해시값
    document_hash_algorithm TEXT DEFAULT 'sha256',
    document_hash_encoding TEXT DEFAULT 'hex',
    document_canonicalization TEXT DEFAULT 'utf8-string',
    document_byte_length INTEGER,
    signer_info JSONB NOT NULL, -- 서명자 정보 (이메일, 이름 등)
    status VARCHAR(20) DEFAULT 'pending', -- 상태: pending, authenticating, authenticated, signed, failed, expired
    expiration_date TIMESTAMP WITH TIME ZONE, -- 서명 만료일
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 본인확인/전자서명 인증 증적 테이블
-- BaroCert 및 PASS/휴대폰 본인확인 결과를 문서 해시와 결합해 저장합니다.
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

-- 3. 전자 서명 및 무결성 데이터 테이블
-- 실제 서명 결과와 문서의 해시값을 저장하여 위변조를 방지합니다.
CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES sign_requests(id) ON DELETE CASCADE,
    document_hash TEXT NOT NULL, -- SHA-256 해시값 (무결성 보장)
    document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256',
    document_hash_encoding TEXT NOT NULL DEFAULT 'hex',
    document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string',
    document_byte_length INTEGER NOT NULL DEFAULT 0,
    integrity_version INTEGER NOT NULL DEFAULT 1,
    signature_image_path TEXT, -- Supabase Storage 내 서명 이미지 경로
    signer_id UUID, -- Supabase Auth 사용자 ID (선택 사항)
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 감사 추적 로그 테이블
-- 법적 증거 능력을 위해 서명 과정의 모든 행위를 기록합니다.
CREATE TABLE IF NOT EXISTS signature_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES sign_requests(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 행위: REQUEST_CREATED, AUTH_SUCCESS, SIGN_EXECUTED
    ip_address INET, -- 접속 IP
    user_agent TEXT, -- 브라우저/기기 정보
    metadata JSONB, -- 기타 추가 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기존 테이블에 무결성 보강 컬럼을 추가합니다.
ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT DEFAULT 'sha256';
ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT DEFAULT 'hex';
ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_canonicalization TEXT DEFAULT 'utf8-string';
ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_byte_length INTEGER;

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

ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256';
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT NOT NULL DEFAULT 'hex';
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string';
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_byte_length INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS integrity_version INTEGER NOT NULL DEFAULT 1;

-- DOCUMENT_HASH_INTEGRITY: 전자서명 문서 해시 무결성 보강 구간입니다.
-- LLM-BREADCRUMB: 운영 앱 코드 구현 시 같은 표식으로 해시 고정/재검증 로직을 연결하세요.
-- 무결성 관련 컬럼 및 제약 조건
-- 이 블록만 부분 실행해도 필요한 컬럼을 먼저 보장합니다.
DO $$
BEGIN
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash TEXT;
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT DEFAULT 'sha256';
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT DEFAULT 'hex';
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_canonicalization TEXT DEFAULT 'utf8-string';
    ALTER TABLE sign_requests ADD COLUMN IF NOT EXISTS document_byte_length INTEGER;

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

    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash_algorithm TEXT NOT NULL DEFAULT 'sha256';
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_hash_encoding TEXT NOT NULL DEFAULT 'hex';
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_canonicalization TEXT NOT NULL DEFAULT 'utf8-string';
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_byte_length INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE signatures ADD COLUMN IF NOT EXISTS integrity_version INTEGER NOT NULL DEFAULT 1;

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

-- 인덱스 설정 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_sign_requests_document_id ON sign_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_sign_requests_document_hash ON sign_requests(document_hash);
CREATE INDEX IF NOT EXISTS idx_sign_authentications_request_id ON sign_authentications(request_id);
CREATE INDEX IF NOT EXISTS idx_sign_authentications_auth_status ON sign_authentications(auth_status);
CREATE INDEX IF NOT EXISTS idx_sign_authentications_document_hash ON sign_authentications(document_hash);
CREATE INDEX IF NOT EXISTS idx_signatures_request_id ON signatures(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_signatures_request_id ON signatures(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sign_authentications_verified_request
    ON sign_authentications(request_id)
    WHERE auth_status = 'verified';
CREATE UNIQUE INDEX IF NOT EXISTS uq_sign_authentications_provider_receipt_id
    ON sign_authentications(provider_group, provider, receipt_id)
    WHERE receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON signature_audit_logs(request_id);

-- 트리거: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sign_requests_updated_at ON sign_requests;
CREATE TRIGGER update_sign_requests_updated_at
    BEFORE UPDATE ON sign_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_sign_authentications_updated_at ON sign_authentications;
CREATE TRIGGER update_sign_authentications_updated_at
    BEFORE UPDATE ON sign_authentications
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 요청 시점에 고정한 문서 해시는 한 번 설정되면 바꿀 수 없습니다.
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

-- 본인확인 증적 상태 전이 제약
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

-- 본인확인 증적은 sign_requests의 문서 해시와 동일한 대상 문서를 가리켜야 합니다.
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

-- DOCUMENT_HASH_INTEGRITY: 활성 서명 요청은 생성 시점부터 문서 해시가 있어야 합니다.
CREATE OR REPLACE FUNCTION enforce_sign_request_document_hash_required()
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
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS require_sign_request_document_hash ON sign_requests;
CREATE TRIGGER require_sign_request_document_hash
    BEFORE INSERT OR UPDATE ON sign_requests
    FOR EACH ROW
    EXECUTE PROCEDURE enforce_sign_request_document_hash_required();

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

-- DOCUMENT_HASH_INTEGRITY: signed 전환 전 요청 시점 해시와 서명 해시 메타데이터 일치를 강제합니다.
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

-- DOCUMENT_HASH_INTEGRITY: signature INSERT 자체도 요청 해시와 맞지 않으면 차단합니다.
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

-- 서명 결과와 감사 로그는 증거 보전을 위해 append-only로 취급합니다.
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
