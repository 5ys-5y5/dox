-- sign_requests.id = be5f695b-e7a0-42d6-8628-06c3ccbd28b1 무결성 점검 SQL
-- 이 파일은 해당 서명이 존재하는 Supabase 프로젝트의 SQL Editor에서 실행하세요.
-- 현재 Codex MCP 연결 프로젝트(grfkmbrhbvcyahflqttl)에는 sign_requests/signatures 테이블이 없어 직접 조회할 수 없습니다.

WITH target AS (
    SELECT 'be5f695b-e7a0-42d6-8628-06c3ccbd28b1'::uuid AS request_id
),
sr AS (
    SELECT sr.*
    FROM sign_requests sr
    JOIN target t ON sr.id = t.request_id
),
sig AS (
    SELECT s.*
    FROM signatures s
    JOIN target t ON s.request_id = t.request_id
),
audit AS (
    SELECT l.*
    FROM signature_audit_logs l
    JOIN target t ON l.request_id = t.request_id
),
checks AS (
    SELECT
        'request_exists' AS check_name,
        CASE WHEN EXISTS (SELECT 1 FROM sr) THEN 'PASS' ELSE 'FAIL' END AS status,
        COALESCE((SELECT jsonb_build_object('id', id, 'status', status, 'document_id', document_id)::text FROM sr LIMIT 1), 'no sign_requests row') AS details

    UNION ALL
    SELECT
        'signature_count',
        CASE (SELECT count(*) FROM sig) WHEN 1 THEN 'PASS' WHEN 0 THEN 'FAIL' ELSE 'FAIL' END,
        jsonb_build_object('count', (SELECT count(*) FROM sig), 'signature_ids', COALESCE((SELECT jsonb_agg(id) FROM sig), '[]'::jsonb))::text

    UNION ALL
    SELECT
        'request_status',
        CASE WHEN (SELECT status FROM sr LIMIT 1) = 'signed' THEN 'PASS' ELSE 'WARN' END,
        COALESCE((SELECT status FROM sr LIMIT 1), 'missing request')::text

    UNION ALL
    SELECT
        'request_hash_present',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sr) THEN 'FAIL'
            WHEN (SELECT document_hash FROM sr LIMIT 1) IS NULL THEN 'WARN'
            WHEN (SELECT document_hash FROM sr LIMIT 1) ~ '^[a-f0-9]{64}$' THEN 'PASS'
            ELSE 'FAIL'
        END,
        COALESCE((SELECT document_hash FROM sr LIMIT 1), 'request document_hash is null')::text

    UNION ALL
    SELECT
        'signature_hash_valid',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN EXISTS (SELECT 1 FROM sig WHERE document_hash !~ '^[a-f0-9]{64}$') THEN 'FAIL'
            ELSE 'PASS'
        END,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('signature_id', id, 'document_hash', document_hash)) FROM sig)::text, 'no signature rows')

    UNION ALL
    SELECT
        'request_signature_hash_match',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sr) OR NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN (SELECT document_hash FROM sr LIMIT 1) IS NULL THEN 'WARN'
            WHEN EXISTS (SELECT 1 FROM sig WHERE document_hash IS DISTINCT FROM (SELECT document_hash FROM sr LIMIT 1)) THEN 'FAIL'
            ELSE 'PASS'
        END,
        jsonb_build_object(
            'request_hash', (SELECT document_hash FROM sr LIMIT 1),
            'signature_hashes', COALESCE((SELECT jsonb_agg(document_hash) FROM sig), '[]'::jsonb)
        )::text

    UNION ALL
    SELECT
        'signature_hash_metadata',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN EXISTS (
                SELECT 1
                FROM sig
                WHERE document_hash_algorithm <> 'sha256'
                   OR document_hash_encoding <> 'hex'
                   OR document_canonicalization NOT IN ('raw-bytes', 'utf8-string', 'canonical-json')
                   OR document_byte_length < 0
                   OR (document_byte_length = 0 AND document_hash <> 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
            ) THEN 'FAIL'
            ELSE 'PASS'
        END,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'signature_id', id,
                'algorithm', document_hash_algorithm,
                'encoding', document_hash_encoding,
                'canonicalization', document_canonicalization,
                'byte_length', document_byte_length,
                'integrity_version', integrity_version
            ))
            FROM sig
        )::text, 'no signature rows')

    UNION ALL
    SELECT
        'signature_byte_length_consistency',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN EXISTS (
                SELECT 1
                FROM sig
                WHERE document_byte_length = 0
                  AND document_hash <> 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
            ) THEN 'FAIL'
            ELSE 'PASS'
        END,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'signature_id', id,
                'document_hash', document_hash,
                'byte_length', document_byte_length,
                'reason', CASE
                    WHEN document_byte_length = 0
                     AND document_hash <> 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
                    THEN 'byte_length=0 is only consistent with empty-content sha256'
                    ELSE 'ok'
                END
            ))
            FROM sig
        )::text, 'no signature rows')

    UNION ALL
    SELECT
        'audit_request_created',
        CASE WHEN EXISTS (SELECT 1 FROM audit WHERE action = 'REQUEST_CREATED') THEN 'PASS' ELSE 'WARN' END,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'action', action, 'created_at', created_at)) FROM audit WHERE action = 'REQUEST_CREATED')::text, 'missing REQUEST_CREATED audit')

    UNION ALL
    SELECT
        'audit_sign_executed',
        CASE WHEN EXISTS (SELECT 1 FROM audit WHERE action = 'SIGN_EXECUTED') THEN 'PASS' ELSE 'FAIL' END,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'action', action, 'created_at', created_at, 'metadata', metadata)) FROM audit WHERE action = 'SIGN_EXECUTED')::text, 'missing SIGN_EXECUTED audit')

    UNION ALL
    SELECT
        'audit_hash_matches_signature',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN NOT EXISTS (SELECT 1 FROM audit WHERE action = 'SIGN_EXECUTED') THEN 'FAIL'
            WHEN EXISTS (
                SELECT 1
                FROM audit a
                WHERE a.action = 'SIGN_EXECUTED'
                  AND a.metadata ? 'documentHash'
                  AND (a.metadata ->> 'documentHash') IN (SELECT document_hash FROM sig)
            ) THEN 'PASS'
            ELSE 'WARN'
        END,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('audit_id', id, 'metadata_document_hash', metadata ->> 'documentHash'))
            FROM audit
            WHERE action = 'SIGN_EXECUTED'
        )::text, 'missing SIGN_EXECUTED audit metadata')

    UNION ALL
    SELECT
        'unique_signature_index_exists',
        CASE WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_signatures_request_id' AND relkind = 'i') THEN 'PASS' ELSE 'FAIL' END,
        'uq_signatures_request_id'::text

    UNION ALL
    SELECT
        'append_only_triggers_exist',
        CASE
            WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_signatures_append_only' AND NOT tgisinternal)
             AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_signature_audit_logs_append_only' AND NOT tgisinternal)
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        COALESCE((
            SELECT jsonb_agg(tgname)
            FROM pg_trigger
            WHERE tgname IN ('protect_signatures_append_only', 'protect_signature_audit_logs_append_only')
              AND NOT tgisinternal
        )::text, 'missing append-only triggers')

    UNION ALL
    SELECT
        'request_hash_immutability_trigger_exists',
        CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_sign_request_hash' AND NOT tgisinternal) THEN 'PASS' ELSE 'FAIL' END,
        'protect_sign_request_hash'::text

    UNION ALL
    SELECT
        'auth_gate_temporary_pending_signed',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_proc
                WHERE proname = 'validate_sign_request_status_transition'
                  AND pg_get_functiondef(oid) LIKE '%pending%'
                  AND pg_get_functiondef(oid) LIKE '%signed%'
            ) THEN 'WARN'
            ELSE 'PASS'
        END,
        'WARN is expected until BaroCert/PASS auth gate is implemented; then remove pending -> signed.'::text
)
SELECT check_name, status, details
FROM checks
ORDER BY
    CASE status WHEN 'FAIL' THEN 1 WHEN 'WARN' THEN 2 ELSE 3 END,
    check_name;
