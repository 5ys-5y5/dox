-- signing.sign_requests.id = f71663da-4014-4546-98c6-710bcbc30a0d 무결성 점검 SQL
-- 이 파일은 해당 서명이 존재하는 Supabase 프로젝트의 SQL Editor에서 실행하세요.
-- 전제:
-- 1. docs/run-this-supabase-signing-schema-migration.sql 실행 완료
-- 2. docs/setup-db.sql 실행 완료
-- 3. PostgREST schema reload SQL 실행 완료

WITH target AS (
    SELECT 'f71663da-4014-4546-98c6-710bcbc30a0d'::uuid AS request_id
),
sr AS (
    SELECT sr.*
    FROM signing.sign_requests sr
    JOIN target t ON sr.id = t.request_id
),
sig AS (
    SELECT s.*
    FROM signing.signatures s
    JOIN target t ON s.request_id = t.request_id
),
audit AS (
    SELECT l.*
    FROM signing.signature_audit_logs l
    JOIN target t ON l.request_id = t.request_id
),
checks AS (
    SELECT
        'request_exists' AS check_name,
        CASE WHEN EXISTS (SELECT 1 FROM sr) THEN 'PASS' ELSE 'FAIL' END AS status,
        COALESCE((SELECT jsonb_build_object('id', id, 'status', status, 'document_id', document_id)::text FROM sr LIMIT 1), 'no signing.sign_requests row') AS details

    UNION ALL
    SELECT
        'signature_count',
        CASE (SELECT count(*) FROM sig) WHEN 1 THEN 'PASS' ELSE 'FAIL' END,
        jsonb_build_object('count', (SELECT count(*) FROM sig), 'signature_ids', COALESCE((SELECT jsonb_agg(id) FROM sig), '[]'::jsonb))::text

    UNION ALL
    SELECT
        'request_status',
        CASE WHEN (SELECT status FROM sr LIMIT 1) = 'signed' THEN 'PASS' ELSE 'WARN' END,
        COALESCE((SELECT status FROM sr LIMIT 1), 'missing request')::text

    UNION ALL
    SELECT
        'unsigned_request_has_signature',
        CASE
            WHEN EXISTS (SELECT 1 FROM sr WHERE status <> 'signed')
             AND EXISTS (SELECT 1 FROM sig)
            THEN 'FAIL'
            ELSE 'PASS'
        END,
        jsonb_build_object(
            'request_status', (SELECT status FROM sr LIMIT 1),
            'signature_count', (SELECT count(*) FROM sig),
            'signature_ids', COALESCE((SELECT jsonb_agg(id) FROM sig), '[]'::jsonb)
        )::text

    UNION ALL
    SELECT
        'request_hash_metadata',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sr) THEN 'FAIL'
            WHEN EXISTS (
                SELECT 1
                FROM sr
                WHERE document_hash IS NULL
                   OR document_hash !~ '^[a-f0-9]{64}$'
                   OR document_hash_algorithm <> 'sha256'
                   OR document_hash_encoding <> 'hex'
                   OR document_canonicalization NOT IN ('raw-bytes', 'utf8-string', 'canonical-json')
                   OR document_byte_length IS NULL
                   OR document_byte_length <= 0
            ) THEN 'FAIL'
            ELSE 'PASS'
        END,
        COALESCE((
            SELECT jsonb_build_object(
                'document_hash', document_hash,
                'algorithm', document_hash_algorithm,
                'encoding', document_hash_encoding,
                'canonicalization', document_canonicalization,
                'byte_length', document_byte_length
            )::text
            FROM sr
            LIMIT 1
        ), 'no signing.sign_requests row')

    UNION ALL
    SELECT
        'signature_hash_metadata',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN EXISTS (
                SELECT 1
                FROM sig
                WHERE document_hash IS NULL
                   OR document_hash !~ '^[a-f0-9]{64}$'
                   OR document_hash_algorithm <> 'sha256'
                   OR document_hash_encoding <> 'hex'
                   OR document_canonicalization NOT IN ('raw-bytes', 'utf8-string', 'canonical-json')
                   OR document_byte_length IS NULL
                   OR document_byte_length <= 0
            ) THEN 'FAIL'
            ELSE 'PASS'
        END,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'signature_id', id,
                'document_hash', document_hash,
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
        'request_signature_hash_match',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sr) OR NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN EXISTS (SELECT 1 FROM sig WHERE document_hash IS DISTINCT FROM (SELECT document_hash FROM sr LIMIT 1)) THEN 'FAIL'
            ELSE 'PASS'
        END,
        jsonb_build_object(
            'request_hash', (SELECT document_hash FROM sr LIMIT 1),
            'signature_hashes', COALESCE((SELECT jsonb_agg(document_hash) FROM sig), '[]'::jsonb)
        )::text

    UNION ALL
    SELECT
        'request_signature_metadata_match',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sr) OR NOT EXISTS (SELECT 1 FROM sig) THEN 'FAIL'
            WHEN EXISTS (
                SELECT 1
                FROM sig s
                CROSS JOIN sr r
                WHERE s.document_hash IS DISTINCT FROM r.document_hash
                   OR s.document_hash_algorithm IS DISTINCT FROM r.document_hash_algorithm
                   OR s.document_hash_encoding IS DISTINCT FROM r.document_hash_encoding
                   OR s.document_canonicalization IS DISTINCT FROM r.document_canonicalization
                   OR s.document_byte_length IS DISTINCT FROM r.document_byte_length
            ) THEN 'FAIL'
            ELSE 'PASS'
        END,
        jsonb_build_object(
            'request', (SELECT jsonb_build_object(
                'hash', document_hash,
                'algorithm', document_hash_algorithm,
                'encoding', document_hash_encoding,
                'canonicalization', document_canonicalization,
                'byte_length', document_byte_length
            ) FROM sr LIMIT 1),
            'signatures', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'signature_id', id,
                    'hash', document_hash,
                    'algorithm', document_hash_algorithm,
                    'encoding', document_hash_encoding,
                    'canonicalization', document_canonicalization,
                    'byte_length', document_byte_length
                ))
                FROM sig
            ), '[]'::jsonb)
        )::text

    UNION ALL
    SELECT
        'audit_request_created',
        CASE WHEN EXISTS (SELECT 1 FROM audit WHERE action = 'REQUEST_CREATED') THEN 'PASS' ELSE 'WARN' END,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'action', action, 'created_at', created_at, 'metadata', metadata)) FROM audit WHERE action = 'REQUEST_CREATED')::text, 'missing REQUEST_CREATED audit')

    UNION ALL
    SELECT
        'audit_request_hash_matches_request',
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM sr) THEN 'FAIL'
            WHEN NOT EXISTS (SELECT 1 FROM audit WHERE action = 'REQUEST_CREATED') THEN 'WARN'
            WHEN EXISTS (
                SELECT 1
                FROM audit a
                WHERE a.action = 'REQUEST_CREATED'
                  AND a.metadata ? 'documentHash'
                  AND (a.metadata ->> 'documentHash') = (SELECT document_hash FROM sr LIMIT 1)
            ) THEN 'PASS'
            ELSE 'WARN'
        END,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('audit_id', id, 'metadata_document_hash', metadata ->> 'documentHash'))
            FROM audit
            WHERE action = 'REQUEST_CREATED'
        )::text, 'missing REQUEST_CREATED audit metadata')

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
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND c.relname = 'uq_signatures_request_id'
                  AND c.relkind = 'i'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'uq_signatures_request_id'::text

    UNION ALL
    SELECT
        'append_only_triggers_exist',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND t.tgname = 'protect_signatures_append_only'
                  AND NOT t.tgisinternal
            )
             AND EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND t.tgname = 'protect_signature_audit_logs_append_only'
                  AND NOT t.tgisinternal
            )
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        COALESCE((
            SELECT jsonb_agg(t.tgname ORDER BY t.tgname)
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'signing'
              AND t.tgname IN ('protect_signatures_append_only', 'protect_signature_audit_logs_append_only')
              AND NOT t.tgisinternal
        )::text, 'missing append-only triggers')

    UNION ALL
    SELECT
        'request_hash_immutability_trigger_exists',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND t.tgname = 'protect_sign_request_hash'
                  AND NOT t.tgisinternal
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'protect_sign_request_hash'::text

    UNION ALL
    SELECT
        'request_insert_hash_guard_exists',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND t.tgname = 'require_sign_request_document_hash'
                  AND NOT t.tgisinternal
            )
             AND EXISTS (
                SELECT 1
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'signing'
                  AND p.proname = 'enforce_sign_request_document_hash_required'
            )
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        'require_sign_request_document_hash'::text

    UNION ALL
    SELECT
        'signed_integrity_trigger_exists',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND t.tgname = 'enforce_signed_request_integrity'
                  AND NOT t.tgisinternal
            )
             AND EXISTS (
                SELECT 1
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'signing'
                  AND p.proname = 'enforce_signed_request_document_integrity'
            )
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        'enforce_signed_request_integrity'::text

    UNION ALL
    SELECT
        'signature_insert_integrity_trigger_exists',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND t.tgname = 'enforce_signature_request_integrity'
                  AND NOT t.tgisinternal
            )
             AND EXISTS (
                SELECT 1
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'signing'
                  AND p.proname = 'enforce_signature_request_document_integrity'
            )
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        'enforce_signature_request_integrity'::text

    UNION ALL
    SELECT
        'status_transition_trigger_exists',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND t.tgname = 'validate_sign_request_status'
                  AND NOT t.tgisinternal
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'validate_sign_request_status'::text

    UNION ALL
    SELECT
        'auth_gate_temporary_pending_signed',
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'signing'
                  AND p.proname = 'validate_sign_request_status_transition'
                  AND pg_get_functiondef(p.oid) LIKE '%pending%'
                  AND pg_get_functiondef(p.oid) LIKE '%signed%'
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
