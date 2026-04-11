WITH checks AS (
    SELECT
        'schema_exists'::text AS check_name,
        CASE WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'signing') THEN 'PASS' ELSE 'FAIL' END AS status,
        'signing schema must exist'::text AS details

    UNION ALL

    SELECT
        'signing_tables_exist',
        CASE
            WHEN (
                SELECT count(*)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND c.relkind = 'r'
                  AND c.relname IN ('sign_requests', 'sign_authentications', 'signatures', 'signature_audit_logs')
            ) = 4 THEN 'PASS'
            ELSE 'FAIL'
        END,
        COALESCE((
            SELECT jsonb_agg(c.relname ORDER BY c.relname)::text
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'signing'
              AND c.relkind = 'r'
              AND c.relname IN ('sign_requests', 'sign_authentications', 'signatures', 'signature_audit_logs')
        ), '[]')

    UNION ALL

    SELECT
        'public_tables_remaining',
        CASE
            WHEN (
                SELECT count(*)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relkind = 'r'
                  AND c.relname IN ('sign_requests', 'sign_authentications', 'signatures', 'signature_audit_logs')
            ) = 0 THEN 'PASS'
            ELSE 'WARN'
        END,
        COALESCE((
            SELECT jsonb_agg(c.relname ORDER BY c.relname)::text
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
              AND c.relname IN ('sign_requests', 'sign_authentications', 'signatures', 'signature_audit_logs')
        ), '[]')

    UNION ALL

    SELECT
        'signing_functions_exist',
        CASE
            WHEN (
                SELECT count(*)
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'signing'
                  AND p.proname IN (
                      'update_updated_at_column',
                      'prevent_sign_request_hash_mutation',
                      'validate_sign_authentication_status_transition',
                      'enforce_sign_authentication_request_integrity',
                      'enforce_sign_request_document_hash_required',
                      'validate_sign_request_status_transition',
                      'enforce_signed_request_document_integrity',
                      'enforce_signature_request_document_integrity',
                      'prevent_append_only_mutation'
                  )
            ) = 9 THEN 'PASS'
            ELSE 'WARN'
        END,
        'run docs/applied/setup-db.sql if signing trigger functions are missing'::text

    UNION ALL

    SELECT
        'signing_triggers_bound',
        CASE
            WHEN (
                SELECT count(*)
                FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'signing'
                  AND NOT t.tgisinternal
                  AND t.tgname IN (
                      'update_sign_requests_updated_at',
                      'update_sign_authentications_updated_at',
                      'protect_sign_request_hash',
                      'validate_sign_authentication_status',
                      'enforce_sign_authentication_integrity',
                      'require_sign_request_document_hash',
                      'validate_sign_request_status',
                      'enforce_signed_request_integrity',
                      'enforce_signature_request_integrity',
                      'protect_signatures_append_only',
                      'protect_signature_audit_logs_append_only'
                  )
            ) = 11 THEN 'PASS'
            ELSE 'WARN'
        END,
        'run docs/applied/setup-db.sql if signing triggers are missing'::text

    UNION ALL

    SELECT
        'supabase_api_exposed_schema',
        'WARN',
        'manual step required: add signing to Supabase Dashboard > Project Settings > API > Exposed schemas'::text
)
SELECT *
FROM checks;
