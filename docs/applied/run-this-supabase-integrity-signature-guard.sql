-- 2026-04-10 전자서명 무결성 추가 보강 SQL
-- 실행 대상: 서명이 실제 생성되는 Supabase 프로젝트의 SQL Editor
-- 목적:
-- 1. 구 서비스 코드가 signatures를 먼저 INSERT하고 sign_requests 상태 업데이트에서 실패하는 부분 저장을 차단합니다.
-- 2. signatures INSERT 시점에 요청 생성 시점의 document_hash 및 해시 메타데이터와 완전히 일치해야 합니다.
-- 3. 본인확인 전 임시 기간에는 pending/authenticated 요청만 signature INSERT를 허용합니다.
-- 실행 규칙:
-- 1. 이 파일은 추가 가드 스크립트입니다.
-- 2. CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER 형태이므로 재실행해도 됩니다.
-- 3. 기본 컬럼/제약/백필은 이 파일이 아니라 run-this-supabase-integrity.sql 또는 setup-db.sql의 책임입니다.

CREATE OR REPLACE FUNCTION enforce_signature_request_document_integrity()
RETURNS TRIGGER AS $$
DECLARE
    request_record sign_requests%ROWTYPE;
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

    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS enforce_signature_request_integrity ON signatures;
CREATE TRIGGER enforce_signature_request_integrity
    BEFORE INSERT ON signatures
    FOR EACH ROW
    EXECUTE PROCEDURE enforce_signature_request_document_integrity();

COMMENT ON FUNCTION enforce_signature_request_document_integrity()
IS 'DOCUMENT_HASH_INTEGRITY: prevents partial signature inserts unless request-time document hash metadata is fixed and matched.';
