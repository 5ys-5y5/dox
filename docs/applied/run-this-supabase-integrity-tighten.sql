-- 2026-04-10 전자서명 무결성 추가 보강 SQL
-- 실행 대상: 서명이 실제 생성되는 Supabase 프로젝트의 SQL Editor
-- 목적:
-- 1. sign_requests.status가 signed로 전환되기 전에 요청 생성 시점의 document_hash가 반드시 고정되어 있어야 합니다.
-- 2. signed 전환 시 signatures의 해시/정규화/byte_length 메타데이터가 요청 해시와 일치해야 합니다.
-- 3. 본인확인 전 임시 pending -> signed 허용은 유지하되, 문서 무결성 없는 서명은 차단합니다.
-- AUTH_GATE_POST_INTEGRATION_REQUIRED
-- 이 파일 자체는 상태 허용 목록을 바꾸지 않지만, BaroCert/PASS 연동 후에는
-- validate_sign_request_status_transition()와 enforce_signature_request_document_integrity()를
-- 함께 수정해 authenticated -> signed만 남겼는지 반드시 확인해야 합니다.

CREATE OR REPLACE FUNCTION enforce_signed_request_document_integrity()
RETURNS TRIGGER AS $$
DECLARE
    request_signature_count INTEGER;
    matching_signature_count INTEGER;
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
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS enforce_signed_request_integrity ON sign_requests;
CREATE TRIGGER enforce_signed_request_integrity
    BEFORE INSERT OR UPDATE ON sign_requests
    FOR EACH ROW
    EXECUTE PROCEDURE enforce_signed_request_document_integrity();

COMMENT ON FUNCTION enforce_signed_request_document_integrity()
IS 'DOCUMENT_HASH_INTEGRITY: prevents signed status unless request-time document hash and signature hash metadata are complete and matched.';
