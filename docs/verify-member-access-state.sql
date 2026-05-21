-- member_access 초대/인증 상태를 한 번에 검증하는 진단 SQL입니다.
-- 실행 위치: Supabase Dashboard > SQL Editor
-- 아래 params 값만 현재 확인할 대상에 맞게 바꿔 실행하세요.
--
-- 해석 기준:
--   프로젝트 구성원 초대는 member_access.site_memberships 에 기록됩니다.
--   문서 구성원 초대만 member_access.document_memberships 에 기록됩니다.
--   따라서 프로젝트 초대만 했다면 document_memberships 가 비어 있는 것은 정상입니다.
--   문자 발송 성공/실패는 member_access.member_verification_events.request_payload 를 확인합니다.

DROP TABLE IF EXISTS pg_temp.member_access_debug_params;

CREATE TEMP TABLE member_access_debug_params AS
SELECT
  '01093107159'::text AS phone_number,
  '3eb83f6a-00c6-4bcc-997c-e08f5ca67dc5'::uuid AS member_id,
  '1b75a399-09c0-45b7-ab2a-c7cb4b7d791c'::uuid AS site_id,
  '2f6d0be2-8ba5-4d69-aacf-845275a66908'::uuid AS document_id;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'member_access'
ORDER BY table_name;

SELECT routine_schema, routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'member_access_%'
ORDER BY routine_name;

SELECT
  EXISTS (
    SELECT 1
    FROM member_access.member_registry AS member_record
    JOIN member_access_debug_params AS params
      ON member_record.id = params.member_id
      OR member_record.phone_number = params.phone_number
  ) AS has_member_registry,
  EXISTS (
    SELECT 1
    FROM member_access.member_invites AS invite
    JOIN member_access.member_registry AS member_record
      ON member_record.id = invite.member_id
    JOIN member_access_debug_params AS params
      ON invite.member_id = params.member_id
      OR member_record.phone_number = params.phone_number
  ) AS has_member_invite,
  EXISTS (
    SELECT 1
    FROM member_access.site_memberships AS membership
    JOIN member_access_debug_params AS params
      ON membership.member_id = params.member_id
     AND membership.site_id = params.site_id
  ) AS has_site_membership_for_project,
  EXISTS (
    SELECT 1
    FROM member_access.document_memberships AS membership
    JOIN member_access_debug_params AS params
      ON membership.member_id = params.member_id
     AND membership.document_id = params.document_id
  ) AS has_direct_document_membership,
  EXISTS (
    SELECT 1
    FROM member_access.member_verification_events AS event
    JOIN member_access.member_registry AS member_record
      ON member_record.id = event.member_id
    JOIN member_access_debug_params AS params
      ON event.member_id = params.member_id
      OR event.phone_number = params.phone_number
      OR member_record.phone_number = params.phone_number
  ) AS has_verification_event;

SELECT 'member_registry' AS section, member_record.*
FROM member_access.member_registry AS member_record
JOIN member_access_debug_params AS params
  ON member_record.id = params.member_id
  OR member_record.phone_number = params.phone_number
ORDER BY member_record.updated_at DESC;

SELECT 'member_invites' AS section, invite.*
FROM member_access.member_invites AS invite
JOIN member_access.member_registry AS member_record
  ON member_record.id = invite.member_id
JOIN member_access_debug_params AS params
  ON invite.member_id = params.member_id
  OR member_record.phone_number = params.phone_number
ORDER BY invite.updated_at DESC;

SELECT
  'site_memberships' AS section,
  membership.*,
  member_record.phone_number,
  member_record.display_name,
  member_record.verification_status
FROM member_access.site_memberships AS membership
JOIN member_access.member_registry AS member_record
  ON member_record.id = membership.member_id
JOIN member_access_debug_params AS params
  ON membership.site_id = params.site_id
WHERE membership.member_id = params.member_id
   OR member_record.phone_number = params.phone_number
ORDER BY membership.updated_at DESC;

SELECT
  'document_memberships' AS section,
  membership.*,
  member_record.phone_number,
  member_record.display_name,
  member_record.verification_status
FROM member_access.document_memberships AS membership
JOIN member_access.member_registry AS member_record
  ON member_record.id = membership.member_id
JOIN member_access_debug_params AS params
  ON membership.document_id = params.document_id
WHERE membership.member_id = params.member_id
   OR member_record.phone_number = params.phone_number
ORDER BY membership.updated_at DESC;

SELECT
  'verification_events' AS section,
  event.id,
  event.member_id,
  event.phone_number,
  event.verification_status,
  event.request_payload,
  event.verified_at,
  event.created_at
FROM member_access.member_verification_events AS event
JOIN member_access.member_registry AS member_record
  ON member_record.id = event.member_id
JOIN member_access_debug_params AS params
  ON event.member_id = params.member_id
  OR event.phone_number = params.phone_number
  OR member_record.phone_number = params.phone_number
ORDER BY event.created_at DESC;

SELECT
  'effective_document_access' AS section,
  params.document_id,
  site_membership.access_role AS project_role,
  document_membership.access_role AS direct_document_role,
  CASE
    WHEN document_membership.id IS NOT NULL THEN 'document'
    WHEN site_membership.id IS NOT NULL THEN 'site'
    ELSE 'none'
  END AS access_source
FROM member_access_debug_params AS params
LEFT JOIN documents.document_registry AS document_record
  ON document_record.id = params.document_id
LEFT JOIN member_access.site_memberships AS site_membership
  ON site_membership.member_id = params.member_id
 AND site_membership.site_id = document_record.site_id
LEFT JOIN member_access.document_memberships AS document_membership
  ON document_membership.member_id = params.member_id
 AND document_membership.document_id = params.document_id;
