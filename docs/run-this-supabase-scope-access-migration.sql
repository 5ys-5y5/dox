-- 기존 member_access 역할 모델 제거 마이그레이션입니다.
-- 실행 위치:
--   Supabase Dashboard > SQL Editor
--
-- 실행 결과:
--   1. site_memberships/document_memberships 에서 access_role 컬럼과 제약을 제거합니다.
--   2. p_access_role 을 받는 오래된 RPC 함수를 제거합니다.
--   3. 현장/문서 소속만 등록하는 RPC 함수로 교체합니다.
--   4. 보기 접근은 소속, 편집 가능 범위는 scopes 의 scope 배정만 사용합니다.
--
-- 주의:
--   이 파일은 사용자가 직접 실행해야 합니다. 앱/LLM이 원격 DB에 자동 적용하지 않습니다.
--   실행 전 운영 DB 백업 또는 Supabase PITR 상태를 확인하세요.

BEGIN;

DROP FUNCTION IF EXISTS public.member_access_invite_site_member(uuid, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.member_access_invite_document_member(uuid, text, text, text, text, uuid);

ALTER TABLE member_access.site_memberships
  DROP CONSTRAINT IF EXISTS site_memberships_access_role_check;

ALTER TABLE member_access.document_memberships
  DROP CONSTRAINT IF EXISTS document_memberships_access_role_check;

ALTER TABLE member_access.site_memberships
  DROP COLUMN IF EXISTS access_role;

ALTER TABLE member_access.document_memberships
  DROP COLUMN IF EXISTS access_role;

CREATE OR REPLACE FUNCTION public.member_access_invite_site_member(
  p_site_id uuid,
  p_phone_number text,
  p_display_name text,
  p_access_code_hash text,
  p_invited_by_member_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
DECLARE
  v_member member_access.member_registry%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
  v_membership member_access.site_memberships%ROWTYPE;
  v_display_name text := NULLIF(BTRIM(COALESCE(p_display_name, '')), '');
  v_should_generate_access_code boolean := true;
  v_dispatch_mode text := 'send_code';
BEGIN
  SELECT *
    INTO v_member
    FROM member_access.member_registry
   WHERE phone_number = p_phone_number;

  IF FOUND THEN
    v_should_generate_access_code := v_member.verification_status <> 'verified';

    UPDATE member_access.member_registry
       SET display_name = COALESCE(v_display_name, display_name),
           verification_status = CASE
             WHEN verification_status = 'verified' THEN 'verified'
             WHEN v_should_generate_access_code THEN 'invited'
             ELSE verification_status
           END,
           active_access_code_hash = CASE
             WHEN v_should_generate_access_code THEN p_access_code_hash
             ELSE active_access_code_hash
           END,
           active_access_code_last_sent_at = CASE
             WHEN v_should_generate_access_code THEN now()
             ELSE active_access_code_last_sent_at
           END
     WHERE id = v_member.id
     RETURNING * INTO v_member;
  ELSE
    INSERT INTO member_access.member_registry (
      phone_number,
      display_name,
      verification_status,
      active_access_code_hash,
      active_access_code_last_sent_at
    )
    VALUES (
      p_phone_number,
      v_display_name,
      'invited',
      p_access_code_hash,
      now()
    )
    RETURNING * INTO v_member;

    v_should_generate_access_code := true;
  END IF;

  INSERT INTO member_access.member_invites (
    member_id,
    invite_status,
    invited_by_member_id,
    invite_note,
    revoked_at
  )
  VALUES (
    v_member.id,
    'active',
    p_invited_by_member_id,
    NULL,
    NULL
  )
  ON CONFLICT (member_id) DO UPDATE
     SET invite_status = 'active',
         invited_by_member_id = EXCLUDED.invited_by_member_id,
         revoked_at = NULL
  RETURNING * INTO v_invite;

  INSERT INTO member_access.site_memberships (
    member_id,
    site_id,
    created_by_member_id
  )
  VALUES (
    v_member.id,
    p_site_id,
    p_invited_by_member_id
  )
  ON CONFLICT (member_id, site_id) DO UPDATE
     SET created_by_member_id = EXCLUDED.created_by_member_id
  RETURNING * INTO v_membership;

  v_dispatch_mode := CASE
    WHEN v_member.verification_status = 'verified' THEN 'reuse_existing_verified'
    WHEN v_should_generate_access_code THEN 'send_code'
    ELSE 'reuse_existing_pending'
  END;

  RETURN jsonb_build_object(
    'membership', to_jsonb(v_membership),
    'member', to_jsonb(v_member),
    'invite', to_jsonb(v_invite),
    'dispatchMode', v_dispatch_mode
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_access_invite_document_member(
  p_document_id uuid,
  p_phone_number text,
  p_display_name text,
  p_access_code_hash text,
  p_invited_by_member_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
DECLARE
  v_member member_access.member_registry%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
  v_membership member_access.document_memberships%ROWTYPE;
  v_display_name text := NULLIF(BTRIM(COALESCE(p_display_name, '')), '');
  v_should_generate_access_code boolean := true;
  v_dispatch_mode text := 'send_code';
BEGIN
  SELECT *
    INTO v_member
    FROM member_access.member_registry
   WHERE phone_number = p_phone_number;

  IF FOUND THEN
    v_should_generate_access_code := v_member.verification_status <> 'verified';

    UPDATE member_access.member_registry
       SET display_name = COALESCE(v_display_name, display_name),
           verification_status = CASE
             WHEN verification_status = 'verified' THEN 'verified'
             WHEN v_should_generate_access_code THEN 'invited'
             ELSE verification_status
           END,
           active_access_code_hash = CASE
             WHEN v_should_generate_access_code THEN p_access_code_hash
             ELSE active_access_code_hash
           END,
           active_access_code_last_sent_at = CASE
             WHEN v_should_generate_access_code THEN now()
             ELSE active_access_code_last_sent_at
           END
     WHERE id = v_member.id
     RETURNING * INTO v_member;
  ELSE
    INSERT INTO member_access.member_registry (
      phone_number,
      display_name,
      verification_status,
      active_access_code_hash,
      active_access_code_last_sent_at
    )
    VALUES (
      p_phone_number,
      v_display_name,
      'invited',
      p_access_code_hash,
      now()
    )
    RETURNING * INTO v_member;

    v_should_generate_access_code := true;
  END IF;

  INSERT INTO member_access.member_invites (
    member_id,
    invite_status,
    invited_by_member_id,
    invite_note,
    revoked_at
  )
  VALUES (
    v_member.id,
    'active',
    p_invited_by_member_id,
    NULL,
    NULL
  )
  ON CONFLICT (member_id) DO UPDATE
     SET invite_status = 'active',
         invited_by_member_id = EXCLUDED.invited_by_member_id,
         revoked_at = NULL
  RETURNING * INTO v_invite;

  INSERT INTO member_access.document_memberships (
    member_id,
    document_id,
    created_by_member_id
  )
  VALUES (
    v_member.id,
    p_document_id,
    p_invited_by_member_id
  )
  ON CONFLICT (member_id, document_id) DO UPDATE
     SET created_by_member_id = EXCLUDED.created_by_member_id
  RETURNING * INTO v_membership;

  v_dispatch_mode := CASE
    WHEN v_member.verification_status = 'verified' THEN 'reuse_existing_verified'
    WHEN v_should_generate_access_code THEN 'send_code'
    ELSE 'reuse_existing_pending'
  END;

  RETURN jsonb_build_object(
    'membership', to_jsonb(v_membership),
    'member', to_jsonb(v_member),
    'invite', to_jsonb(v_invite),
    'dispatchMode', v_dispatch_mode
  );
END;
$$;

REVOKE ALL ON FUNCTION public.member_access_invite_site_member(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_invite_document_member(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_access_invite_site_member(uuid, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_invite_document_member(uuid, text, text, text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- 검증 쿼리: 두 쿼리 모두 0행이어야 합니다.
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'member_access'
  AND column_name = 'access_role'
ORDER BY table_name;

SELECT n.nspname AS routine_schema, p.proname AS routine_name, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'member_access_%'
  AND pg_get_functiondef(p.oid) ~ '(access_role|p_access_role|editor|viewer|signer|manager|participant)';
