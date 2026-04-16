-- PHOTO-LABEL-05
-- 실제 사진 업로드를 위해 Storage 버킷과 photo_registry 메타데이터 컬럼을 준비합니다.
-- 이 스크립트는 기존 PHOTO-LABEL-01~04를 적용한 DB 위에 추가로 실행합니다.

alter table photo_labels.photo_registry
  add column if not exists storage_bucket text,
  add column if not exists original_file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'photo_registry_file_size_bytes_check'
  ) then
    alter table photo_labels.photo_registry
      add constraint photo_registry_file_size_bytes_check
      check (file_size_bytes is null or file_size_bytes >= 0);
  end if;
end $$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'site-photo-labels',
  'site-photo-labels',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- PHOTO-LABEL-05 storage policy note
-- 현재 업로드는 서버에서 SUPABASE_SERVICE_ROLE_KEY로 수행하므로
-- anon/authenticated용 storage.objects 정책은 아직 만들지 않습니다.
-- 나중에 브라우저 직접 업로드로 바꾸면 그때 bucket policy를 별도로 설계해야 합니다.
