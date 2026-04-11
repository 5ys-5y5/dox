-- 2026-04-10 전자서명 무결성 추가 보강 SQL
-- 실행 대상: 서명이 실제 생성되는 Supabase 프로젝트의 SQL Editor
-- 목적:
-- 1. 구 서비스 코드가 sign_requests를 document_hash 없이 생성하는 것을 차단합니다.
-- 2. pending/authenticating/authenticated/signed 같은 활성 서명 요청 상태에서는 요청 시점 문서 해시와 메타데이터를 필수화합니다.
-- 3. failed/expired 상태로 마감되는 기존 결함 요청은 허용해 정리 가능성을 남깁니다.
-- AUTH_GATE_POST_INTEGRATION_REQUIRED
-- 본인확인 연동 후에도 이 guard는 유지합니다. 후속 변경이 필요한 곳은
-- validate_sign_request_status_transition()와 enforce_signature_request_document_integrity()입니다.

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

COMMENT ON FUNCTION enforce_sign_request_document_hash_required()
IS 'DOCUMENT_HASH_INTEGRITY: prevents active sign_requests rows from being created or kept without request-time document hash metadata.';
