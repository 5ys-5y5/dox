-- PHOTO-LABEL-12
-- 실행용 SQL은 docs/ 아래에 둡니다.
-- docs/applied/ 는 이미 실행한 SQL 아카이브용입니다.
--
-- 이 스크립트는 현재 연결된 Supabase 프로젝트에 아래 상태를 맞춥니다.
-- 1. photo_labels.photo_registry 의 storage metadata 컬럼
-- 2. photo_labels.photo_registry 의 EXIF/촬영 메타데이터 컬럼
-- 3. site-photo-labels storage bucket
--
-- 여러 번 실행해도 안전하도록 if not exists / on conflict 를 사용합니다.

alter table photo_labels.photo_registry
  add column if not exists storage_bucket text,
  add column if not exists original_file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists captured_location_text text,
  add column if not exists captured_latitude double precision,
  add column if not exists captured_longitude double precision;

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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'photo_registry_captured_latitude_check'
  ) then
    alter table photo_labels.photo_registry
      add constraint photo_registry_captured_latitude_check
      check (
        captured_latitude is null
        or (captured_latitude >= -90 and captured_latitude <= 90)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'photo_registry_captured_longitude_check'
  ) then
    alter table photo_labels.photo_registry
      add constraint photo_registry_captured_longitude_check
      check (
        captured_longitude is null
        or (captured_longitude >= -180 and captured_longitude <= 180)
      );
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

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
