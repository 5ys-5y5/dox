-- 구성원 문서 접근 기능이 사용하는 member_access 스키마를 생성합니다.
-- 실행 위치:
--   Supabase Dashboard > SQL Editor
--
-- 주의:
--   앱 서버는 SUPABASE_SERVICE_ROLE_KEY 로 접근하므로 service_role 권한이 필요합니다.
--   앱은 public SECURITY DEFINER RPC 함수만 호출하고, member_access 스키마를 Data API에 직접 노출하지 않습니다.
--   anon/authenticated 에게는 member_access 스키마/테이블 권한과 RPC 실행 권한을 부여하지 않습니다.

CREATE SCHEMA IF NOT EXISTS member_access;

CREATE OR REPLACE FUNCTION member_access.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS member_access.member_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  display_name text,
  verification_status text NOT NULL DEFAULT 'invited',
  active_access_code_hash text NOT NULL DEFAULT '',
  active_access_code_last_sent_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_registry_phone_number_key UNIQUE (phone_number),
  CONSTRAINT member_registry_verification_status_check CHECK (
    verification_status IN ('invited', 'verified', 'revoked')
  ),
  CONSTRAINT member_registry_phone_number_digits_check CHECK (phone_number ~ '^[0-9]{8,15}$')
);

CREATE TABLE IF NOT EXISTS member_access.member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES member_access.member_registry(id) ON DELETE CASCADE,
  invite_status text NOT NULL DEFAULT 'active',
  invited_by_member_id uuid REFERENCES member_access.member_registry(id) ON DELETE SET NULL,
  invite_note text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_invites_member_id_key UNIQUE (member_id),
  CONSTRAINT member_invites_invite_status_check CHECK (invite_status IN ('active', 'revoked'))
);

CREATE TABLE IF NOT EXISTS member_access.member_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES member_access.member_registry(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  verification_source text NOT NULL DEFAULT 'sms_code',
  verification_status text NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_verification_events_source_check CHECK (verification_source IN ('sms_code')),
  CONSTRAINT member_verification_events_status_check CHECK (verification_status IN ('sent', 'verified', 'failed'))
);

CREATE TABLE IF NOT EXISTS member_access.site_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES member_access.member_registry(id) ON DELETE CASCADE,
  site_id uuid NOT NULL,
  access_role text NOT NULL,
  created_by_member_id uuid REFERENCES member_access.member_registry(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_memberships_member_site_key UNIQUE (member_id, site_id),
  CONSTRAINT site_memberships_access_role_check CHECK (access_role IN ('owner', 'manager', 'participant'))
);

CREATE TABLE IF NOT EXISTS member_access.document_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES member_access.member_registry(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,
  access_role text NOT NULL,
  created_by_member_id uuid REFERENCES member_access.member_registry(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_memberships_member_document_key UNIQUE (member_id, document_id),
  CONSTRAINT document_memberships_access_role_check CHECK (access_role IN ('editor', 'viewer'))
);

CREATE INDEX IF NOT EXISTS member_registry_phone_number_idx
  ON member_access.member_registry (phone_number);

CREATE INDEX IF NOT EXISTS member_invites_member_id_idx
  ON member_access.member_invites (member_id);

CREATE INDEX IF NOT EXISTS member_verification_events_member_created_idx
  ON member_access.member_verification_events (member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS member_verification_events_phone_created_idx
  ON member_access.member_verification_events (phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS site_memberships_site_id_idx
  ON member_access.site_memberships (site_id);

CREATE INDEX IF NOT EXISTS site_memberships_member_id_idx
  ON member_access.site_memberships (member_id);

CREATE INDEX IF NOT EXISTS document_memberships_document_id_idx
  ON member_access.document_memberships (document_id);

CREATE INDEX IF NOT EXISTS document_memberships_member_id_idx
  ON member_access.document_memberships (member_id);

DROP TRIGGER IF EXISTS update_member_registry_updated_at ON member_access.member_registry;
CREATE TRIGGER update_member_registry_updated_at
  BEFORE UPDATE ON member_access.member_registry
  FOR EACH ROW
  EXECUTE FUNCTION member_access.update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_invites_updated_at ON member_access.member_invites;
CREATE TRIGGER update_member_invites_updated_at
  BEFORE UPDATE ON member_access.member_invites
  FOR EACH ROW
  EXECUTE FUNCTION member_access.update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_memberships_updated_at ON member_access.site_memberships;
CREATE TRIGGER update_site_memberships_updated_at
  BEFORE UPDATE ON member_access.site_memberships
  FOR EACH ROW
  EXECUTE FUNCTION member_access.update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_memberships_updated_at ON member_access.document_memberships;
CREATE TRIGGER update_document_memberships_updated_at
  BEFORE UPDATE ON member_access.document_memberships
  FOR EACH ROW
  EXECUTE FUNCTION member_access.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.member_access_list_site_members(p_site_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'membership', to_jsonb(site_membership),
        'member', to_jsonb(member_record),
        'invite', to_jsonb(member_invite)
      )
      ORDER BY site_membership.updated_at DESC
    ),
    '[]'::jsonb
  )
  FROM member_access.site_memberships AS site_membership
  JOIN member_access.member_registry AS member_record
    ON member_record.id = site_membership.member_id
  LEFT JOIN member_access.member_invites AS member_invite
    ON member_invite.member_id = site_membership.member_id
  WHERE site_membership.site_id = p_site_id;
$$;

CREATE OR REPLACE FUNCTION public.member_access_list_document_members(p_document_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'membership', to_jsonb(document_membership),
        'member', to_jsonb(member_record),
        'invite', to_jsonb(member_invite)
      )
      ORDER BY document_membership.updated_at DESC
    ),
    '[]'::jsonb
  )
  FROM member_access.document_memberships AS document_membership
  JOIN member_access.member_registry AS member_record
    ON member_record.id = document_membership.member_id
  LEFT JOIN member_access.member_invites AS member_invite
    ON member_invite.member_id = document_membership.member_id
  WHERE document_membership.document_id = p_document_id;
$$;

CREATE OR REPLACE FUNCTION public.member_access_invite_site_member(
  p_site_id uuid,
  p_phone_number text,
  p_display_name text,
  p_access_role text,
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
  v_existing_invite member_access.member_invites%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
  v_membership member_access.site_memberships%ROWTYPE;
  v_display_name text := NULLIF(BTRIM(COALESCE(p_display_name, '')), '');
  v_can_reuse_existing_access boolean := false;
  v_should_generate_access_code boolean := true;
  v_dispatch_mode text := 'send_code';
BEGIN
  IF p_access_role NOT IN ('owner', 'manager', 'participant') THEN
    RAISE EXCEPTION '구성원 초대 실패: 현장 권한 값이 올바르지 않습니다. (%)', p_access_role;
  END IF;

  SELECT *
    INTO v_member
    FROM member_access.member_registry
   WHERE phone_number = p_phone_number;

  IF FOUND THEN
    SELECT *
      INTO v_existing_invite
      FROM member_access.member_invites
     WHERE member_id = v_member.id;

    v_can_reuse_existing_access :=
      v_existing_invite.id IS NOT NULL
      AND v_existing_invite.invite_status = 'active'
      AND v_member.verification_status = 'verified';
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
    access_role,
    created_by_member_id
  )
  VALUES (
    v_member.id,
    p_site_id,
    p_access_role,
    p_invited_by_member_id
  )
  ON CONFLICT (member_id, site_id) DO UPDATE
     SET access_role = EXCLUDED.access_role,
         created_by_member_id = EXCLUDED.created_by_member_id
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
  p_access_role text,
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
  v_existing_invite member_access.member_invites%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
  v_membership member_access.document_memberships%ROWTYPE;
  v_display_name text := NULLIF(BTRIM(COALESCE(p_display_name, '')), '');
  v_can_reuse_existing_access boolean := false;
  v_should_generate_access_code boolean := true;
  v_dispatch_mode text := 'send_code';
BEGIN
  IF p_access_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION '구성원 초대 실패: 문서 권한 값이 올바르지 않습니다. (%)', p_access_role;
  END IF;

  SELECT *
    INTO v_member
    FROM member_access.member_registry
   WHERE phone_number = p_phone_number;

  IF FOUND THEN
    SELECT *
      INTO v_existing_invite
      FROM member_access.member_invites
     WHERE member_id = v_member.id;

    v_can_reuse_existing_access :=
      v_existing_invite.id IS NOT NULL
      AND v_existing_invite.invite_status = 'active'
      AND v_member.verification_status = 'verified';
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
    access_role,
    created_by_member_id
  )
  VALUES (
    v_member.id,
    p_document_id,
    p_access_role,
    p_invited_by_member_id
  )
  ON CONFLICT (member_id, document_id) DO UPDATE
     SET access_role = EXCLUDED.access_role,
         created_by_member_id = EXCLUDED.created_by_member_id
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

CREATE OR REPLACE FUNCTION public.member_access_remove_site_membership(p_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
DECLARE
  v_membership member_access.site_memberships%ROWTYPE;
  v_member member_access.member_registry%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
BEGIN
  SELECT *
    INTO v_membership
    FROM member_access.site_memberships
   WHERE id = p_membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '현장 권한 삭제 실패: 구성원을 찾을 수 없습니다.';
  END IF;

  SELECT * INTO v_member FROM member_access.member_registry WHERE id = v_membership.member_id;
  SELECT * INTO v_invite FROM member_access.member_invites WHERE member_id = v_membership.member_id;

  DELETE FROM member_access.site_memberships WHERE id = p_membership_id;

  RETURN jsonb_build_object(
    'membership', to_jsonb(v_membership),
    'member', to_jsonb(v_member),
    'invite', to_jsonb(v_invite)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_access_remove_document_membership(p_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
DECLARE
  v_membership member_access.document_memberships%ROWTYPE;
  v_member member_access.member_registry%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
BEGIN
  SELECT *
    INTO v_membership
    FROM member_access.document_memberships
   WHERE id = p_membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '문서 권한 삭제 실패: 구성원을 찾을 수 없습니다.';
  END IF;

  SELECT * INTO v_member FROM member_access.member_registry WHERE id = v_membership.member_id;
  SELECT * INTO v_invite FROM member_access.member_invites WHERE member_id = v_membership.member_id;

  DELETE FROM member_access.document_memberships WHERE id = p_membership_id;

  RETURN jsonb_build_object(
    'membership', to_jsonb(v_membership),
    'member', to_jsonb(v_member),
    'invite', to_jsonb(v_invite)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_access_get_session(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
DECLARE
  v_member member_access.member_registry%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
  v_site_memberships jsonb := '[]'::jsonb;
  v_document_memberships jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_member FROM member_access.member_registry WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '구성원 접근 확인 실패: 멤버를 찾을 수 없습니다.';
  END IF;

  SELECT * INTO v_invite FROM member_access.member_invites WHERE member_id = p_member_id;

  IF v_invite.id IS NULL OR v_invite.invite_status <> 'active' THEN
    RAISE EXCEPTION '구성원 접근 확인 실패: 현재 활성화된 초대가 없습니다.';
  END IF;

  IF v_member.verification_status = 'revoked' THEN
    RAISE EXCEPTION '구성원 접근 확인 실패: 철회된 번호입니다.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(site_membership) ORDER BY site_membership.updated_at DESC), '[]'::jsonb)
    INTO v_site_memberships
    FROM member_access.site_memberships AS site_membership
   WHERE site_membership.member_id = p_member_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(document_membership) ORDER BY document_membership.updated_at DESC), '[]'::jsonb)
    INTO v_document_memberships
    FROM member_access.document_memberships AS document_membership
   WHERE document_membership.member_id = p_member_id;

  RETURN jsonb_build_object(
    'member', to_jsonb(v_member),
    'invite', to_jsonb(v_invite),
    'siteMemberships', v_site_memberships,
    'documentMemberships', v_document_memberships
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_access_record_verification_event(
  p_member_id uuid,
  p_phone_number text,
  p_verification_status text,
  p_request_payload jsonb DEFAULT '{}'::jsonb,
  p_verified_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
DECLARE
  v_event member_access.member_verification_events%ROWTYPE;
BEGIN
  INSERT INTO member_access.member_verification_events (
    member_id,
    phone_number,
    verification_source,
    verification_status,
    request_payload,
    verified_at
  )
  VALUES (
    p_member_id,
    p_phone_number,
    'sms_code',
    p_verification_status,
    COALESCE(p_request_payload, '{}'::jsonb),
    p_verified_at
  )
  RETURNING * INTO v_event;

  RETURN to_jsonb(v_event);
END;
$$;

CREATE OR REPLACE FUNCTION public.member_access_verify(
  p_phone_number text,
  p_access_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, member_access
AS $$
DECLARE
  v_member member_access.member_registry%ROWTYPE;
  v_invite member_access.member_invites%ROWTYPE;
  v_verified_at timestamptz := now();
BEGIN
  SELECT *
    INTO v_member
    FROM member_access.member_registry
   WHERE phone_number = p_phone_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION '구성원 인증 실패: 초대된 번호를 찾을 수 없습니다. (%)', p_phone_number;
  END IF;

  SELECT *
    INTO v_invite
    FROM member_access.member_invites
   WHERE member_id = v_member.id;

  IF v_invite.id IS NULL OR v_invite.invite_status <> 'active' THEN
    INSERT INTO member_access.member_verification_events (
      member_id,
      phone_number,
      verification_source,
      verification_status,
      request_payload
    )
    VALUES (
      v_member.id,
      p_phone_number,
      'sms_code',
      'failed',
      jsonb_build_object('reason', 'invite_not_active')
    );
    RAISE EXCEPTION '구성원 인증 실패: 현재 활성화된 초대가 없습니다.';
  END IF;

  IF v_member.verification_status = 'revoked' THEN
    INSERT INTO member_access.member_verification_events (
      member_id,
      phone_number,
      verification_source,
      verification_status,
      request_payload
    )
    VALUES (
      v_member.id,
      p_phone_number,
      'sms_code',
      'failed',
      jsonb_build_object('reason', 'member_revoked')
    );
    RAISE EXCEPTION '구성원 인증 실패: 철회된 번호입니다.';
  END IF;

  IF p_access_code_hash <> v_member.active_access_code_hash THEN
    INSERT INTO member_access.member_verification_events (
      member_id,
      phone_number,
      verification_source,
      verification_status,
      request_payload
    )
    VALUES (
      v_member.id,
      p_phone_number,
      'sms_code',
      'failed',
      jsonb_build_object('reason', 'code_mismatch')
    );
    RAISE EXCEPTION '구성원 인증 실패: 인증번호가 올바르지 않습니다.';
  END IF;

  UPDATE member_access.member_registry
     SET verification_status = 'verified',
         last_verified_at = v_verified_at
   WHERE id = v_member.id
   RETURNING * INTO v_member;

  INSERT INTO member_access.member_verification_events (
    member_id,
    phone_number,
    verification_source,
    verification_status,
    request_payload,
    verified_at
  )
  VALUES (
    v_member.id,
    p_phone_number,
    'sms_code',
    'verified',
    jsonb_build_object('reason', 'code_match'),
    v_verified_at
  );

  RETURN jsonb_build_object(
    'member', to_jsonb(v_member),
    'invite', to_jsonb(v_invite),
    'authenticatedAt', v_verified_at
  );
END;
$$;

REVOKE ALL ON SCHEMA member_access FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA member_access FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA member_access FROM anon, authenticated;
GRANT USAGE ON SCHEMA member_access TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA member_access TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA member_access TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA member_access TO service_role;

REVOKE ALL ON FUNCTION public.member_access_list_site_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_list_document_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_invite_site_member(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_invite_document_member(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_remove_site_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_remove_document_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_get_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_record_verification_event(uuid, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_verify(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.member_access_list_site_members(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_list_document_members(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_invite_site_member(uuid, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_invite_document_member(uuid, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_remove_site_membership(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_remove_document_membership(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_get_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_record_verification_event(uuid, text, text, jsonb, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_access_verify(text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'member_access schema and public service_role RPC functions are ready.';
END;
$$;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'member_access'
ORDER BY table_name;

SELECT routine_schema, routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'member_access_%'
ORDER BY routine_name;
