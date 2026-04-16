import { createClient } from '@supabase/supabase-js';
import type {
  PhotoCreateInput,
  PhotoCreateResult,
  PhotoUploadInput,
  PhotoUploadResult,
  PhotoLabelsSaveInput,
  PhotoLabelsSaveResult,
  PhotoListItemDto,
  PhotoManualLabelDto,
  PhotoRecordDto,
  PhotoSuggestedLabelDto,
} from '../lib/photoLabelDtos';

type PhotoRegistryRow = {
  id: string;
  site_id: string;
  photo_url: string | null;
  storage_path: string | null;
  storage_bucket: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  photo_title: string | null;
  description: string | null;
  captured_at: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
};

type PhotoLabelAssignmentRow = {
  id: string;
  photo_id: string;
  label_key: string;
  note: string | null;
  created_at: string;
};

type PhotoLabelSuggestionRow = {
  id: string;
  photo_id: string;
  label_key: string;
  confidence_score: number;
  suggestion_reason: string | null;
  suggestion_status: 'review_needed' | 'accepted' | 'rejected';
  created_at: string;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const PHOTO_LABELS_DB_SCHEMA = 'photo_labels';
const PHOTO_STORAGE_BUCKET = 'site-photo-labels';

// PHOTO_LABELS_SCHEMA_BOUNDARY
// 사진 라벨링 도메인 정본은 photo_labels 스키마만 사용합니다.
// photo_registry, photo_label_assignments, photo_label_suggestions 가 정본이며
// documents 나 sites 내부 테이블을 직접 수정하지 않습니다.
//
// PHOTO_LABEL_REVIEW_REQUIRED
// 추천 라벨은 자동 확정하지 않습니다.
// suggestion_status 로 review_needed / accepted / rejected 상태를 남깁니다.
const photosSchema = (client = getSupabase()) => client.schema(PHOTO_LABELS_DB_SCHEMA);

const toPhotoRecordDto = (row: PhotoRegistryRow): PhotoRecordDto => ({
  id: row.id,
  siteId: row.site_id,
  photoUrl: row.photo_url,
  storagePath: row.storage_path,
  storageBucket: row.storage_bucket,
  originalFileName: row.original_file_name,
  mimeType: row.mime_type,
  fileSizeBytes: row.file_size_bytes,
  photoTitle: row.photo_title,
  description: row.description,
  capturedAt: row.captured_at,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toManualLabelDto = (row: PhotoLabelAssignmentRow): PhotoManualLabelDto => ({
  id: row.id,
  photoId: row.photo_id,
  labelKey: row.label_key,
  note: row.note,
  createdAt: row.created_at,
});

const toSuggestedLabelDto = (row: PhotoLabelSuggestionRow): PhotoSuggestedLabelDto => ({
  id: row.id,
  photoId: row.photo_id,
  labelKey: row.label_key,
  confidenceScore: Number(row.confidence_score),
  suggestionReason: row.suggestion_reason,
  suggestionStatus: row.suggestion_status,
  createdAt: row.created_at,
});

const normalizeManualLabels = (labels = []) => {
  const seen = new Set<string>();

  return labels
    .map((label: any) => ({
      labelKey: String(label.labelKey || '').trim(),
      note: String(label.note || '').trim() || null,
    }))
    .filter((label) => {
      if (!label.labelKey || seen.has(label.labelKey)) {
        return false;
      }

      seen.add(label.labelKey);
      return true;
    });
};

const normalizeSuggestedLabels = (labels = []) => {
  const seen = new Set<string>();

  return labels
    .map((label: any) => {
      const confidenceScore =
        typeof label.confidenceScore === 'number' && !Number.isNaN(label.confidenceScore)
          ? label.confidenceScore
          : 0.5;

      const suggestionStatus =
        label.suggestionStatus === 'accepted' ||
        label.suggestionStatus === 'rejected' ||
        label.suggestionStatus === 'review_needed'
          ? label.suggestionStatus
          : 'review_needed';

      return {
        labelKey: String(label.labelKey || '').trim(),
        confidenceScore: Math.min(Math.max(confidenceScore, 0), 1),
        suggestionReason: String(label.suggestionReason || '').trim() || null,
        suggestionStatus,
      };
    })
    .filter((label) => {
      if (!label.labelKey || seen.has(label.labelKey)) {
        return false;
      }

      seen.add(label.labelKey);
      return true;
    });
};

const getPhotoById = async (photoId: string) => {
  const { data, error } = await photosSchema().from('photo_registry').select('*').eq('id', photoId).single();

  return {
    photo: data as PhotoRegistryRow | null,
    error,
  };
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'photo';

const getExtension = (fileName: string, mimeType: string) => {
  const explicitExtension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : null;

  if (explicitExtension) {
    return explicitExtension;
  }

  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
};

const buildStoragePath = (siteId: string, originalFileName: string, mimeType: string) => {
  const safeSiteId = siteId.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = getExtension(originalFileName, mimeType);
  const safeFileBase = sanitizeFileName(originalFileName).replace(new RegExp(`\\.${extension}$`), '');

  return `${safeSiteId}/${timestamp}-${crypto.randomUUID()}-${safeFileBase}.${extension}`;
};

const insertPhotoRecord = async (params: PhotoCreateInput): Promise<PhotoCreateResult> => {
  const { data, error } = await photosSchema()
    .from('photo_registry')
    .insert([
      {
        site_id: params.siteId.trim(),
        photo_url: params.photoUrl?.trim() || null,
        storage_path: params.storagePath?.trim() || null,
        storage_bucket: params.storageBucket?.trim() || null,
        original_file_name: params.originalFileName?.trim() || null,
        mime_type: params.mimeType?.trim() || null,
        file_size_bytes:
          typeof params.fileSizeBytes === 'number' && Number.isFinite(params.fileSizeBytes)
            ? Math.max(Math.trunc(params.fileSizeBytes), 0)
            : null,
        photo_title: params.photoTitle?.trim() || null,
        description: params.description?.trim() || null,
        captured_at: params.capturedAt?.trim() || null,
        status: 'active',
      },
    ])
    .select('*')
    .single();

  const photo = data as PhotoRegistryRow | null;

  if (error || !photo) {
    throw new Error(`사진 저장 실패: ${error?.message || '사진 메타데이터를 저장할 수 없습니다.'}`);
  }

  return {
    photo: toPhotoRecordDto(photo),
  };
};

export const PhotoLabelService = {
  async createPhoto(params: PhotoCreateInput): Promise<PhotoCreateResult> {
    const siteId = params.siteId.trim();
    const photoUrl = params.photoUrl?.trim() || null;
    const storagePath = params.storagePath?.trim() || null;

    if (!siteId) {
      throw new Error('사진 저장 실패: siteId가 필요합니다.');
    }

    if (!photoUrl && !storagePath) {
      throw new Error('사진 저장 실패: photoUrl 또는 storagePath 중 하나는 필요합니다.');
    }

    return insertPhotoRecord({
      ...params,
      siteId,
      photoUrl,
      storagePath,
    });
  },

  async uploadPhoto(params: PhotoUploadInput): Promise<PhotoUploadResult> {
    const siteId = params.siteId.trim();
    const originalFileName = params.originalFileName.trim();
    const mimeType = params.mimeType.trim();

    if (!siteId) {
      throw new Error('사진 업로드 실패: siteId가 필요합니다.');
    }

    if (!originalFileName) {
      throw new Error('사진 업로드 실패: 파일 이름이 비어 있습니다.');
    }

    if (!mimeType.startsWith('image/')) {
      throw new Error('사진 업로드 실패: image/* 형식의 파일만 업로드할 수 있습니다.');
    }

    if (!params.fileBytes || params.fileBytes.length === 0) {
      throw new Error('사진 업로드 실패: 업로드할 파일 바이트가 비어 있습니다.');
    }

    const client = getSupabase();
    const storagePath = buildStoragePath(siteId, originalFileName, mimeType);

    // PHOTO_LABEL_STORAGE_UPLOAD_FLOW
    // UI는 "사진 업로드" 버튼 하나만 보이지만, 실제로는
    // 1) Storage 버킷 업로드
    // 2) photo_registry 메타데이터 저장
    // 3) 메타데이터 저장 실패 시 Storage 파일 롤백
    // 순서로 처리합니다.
    const { error: uploadError } = await client.storage
      .from(PHOTO_STORAGE_BUCKET)
      .upload(storagePath, params.fileBytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`사진 업로드 실패: Storage 업로드 중 오류가 발생했습니다. (${uploadError.message})`);
    }

    const publicUrl = client.storage.from(PHOTO_STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;

    try {
      return await insertPhotoRecord({
        siteId,
        photoUrl: publicUrl,
        storagePath,
        storageBucket: PHOTO_STORAGE_BUCKET,
        originalFileName,
        mimeType,
        fileSizeBytes: params.fileSizeBytes,
        photoTitle: params.photoTitle?.trim() || originalFileName,
        description: params.description?.trim() || null,
        capturedAt: params.capturedAt?.trim() || null,
      });
    } catch (error) {
      await client.storage.from(PHOTO_STORAGE_BUCKET).remove([storagePath]);
      throw error;
    }
  },

  async listPhotos(siteId?: string, limit = 20): Promise<PhotoListItemDto[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 20;
    const client = getSupabase();
    const schemaClient = photosSchema(client);
    let photoQuery = schemaClient
      .from('photo_registry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (siteId?.trim()) {
      photoQuery = photoQuery.eq('site_id', siteId.trim());
    }

    const { data: photoRows, error: photoError } = await photoQuery;

    if (photoError) {
      throw new Error(`사진 목록 조회 실패: ${photoError.message}`);
    }

    const photos = (photoRows || []) as PhotoRegistryRow[];

    if (photos.length === 0) {
      return [];
    }

    const photoIds = photos.map((photo) => photo.id);
    const [manualResponse, suggestedResponse] = await Promise.all([
      schemaClient.from('photo_label_assignments').select('*').in('photo_id', photoIds),
      schemaClient.from('photo_label_suggestions').select('*').in('photo_id', photoIds),
    ]);

    if (manualResponse.error) {
      throw new Error(`사진 목록 조회 실패: 수동 라벨 조회 중 오류가 발생했습니다. (${manualResponse.error.message})`);
    }

    if (suggestedResponse.error) {
      throw new Error(
        `사진 목록 조회 실패: 추천 라벨 조회 중 오류가 발생했습니다. (${suggestedResponse.error.message})`
      );
    }

    const manualRows = (manualResponse.data || []) as PhotoLabelAssignmentRow[];
    const suggestedRows = (suggestedResponse.data || []) as PhotoLabelSuggestionRow[];

    return photos.map((photo) => ({
      photo: toPhotoRecordDto(photo),
      manualLabels: manualRows.filter((label) => label.photo_id === photo.id).map(toManualLabelDto),
      suggestedLabels: suggestedRows
        .filter((label) => label.photo_id === photo.id)
        .map(toSuggestedLabelDto),
    }));
  },

  async saveLabels(params: PhotoLabelsSaveInput): Promise<PhotoLabelsSaveResult> {
    const photoId = params.photoId.trim();

    if (!photoId) {
      throw new Error('사진 라벨 저장 실패: photoId가 필요합니다.');
    }

    const { photo, error: photoError } = await getPhotoById(photoId);

    if (photoError || !photo) {
      throw new Error(`사진 라벨 저장 실패: ${photoError?.message || '사진을 찾을 수 없습니다.'}`);
    }

    const manualLabels = normalizeManualLabels(params.manualLabels);
    const suggestedLabels = normalizeSuggestedLabels(params.suggestedLabels);
    const client = getSupabase();
    const schemaClient = photosSchema(client);

    const { error: deleteManualError } = await schemaClient
      .from('photo_label_assignments')
      .delete()
      .eq('photo_id', photoId);

    if (deleteManualError) {
      throw new Error(`사진 라벨 저장 실패: 기존 수동 라벨 삭제 중 오류가 발생했습니다. (${deleteManualError.message})`);
    }

    const { error: deleteSuggestionError } = await schemaClient
      .from('photo_label_suggestions')
      .delete()
      .eq('photo_id', photoId);

    if (deleteSuggestionError) {
      throw new Error(
        `사진 라벨 저장 실패: 기존 추천 라벨 삭제 중 오류가 발생했습니다. (${deleteSuggestionError.message})`
      );
    }

    let manualLabelCount = 0;
    let suggestedLabelCount = 0;

    if (manualLabels.length > 0) {
      const { data, error } = await schemaClient
        .from('photo_label_assignments')
        .insert(
          manualLabels.map((label) => ({
            photo_id: photoId,
            label_key: label.labelKey,
            note: label.note,
          }))
        )
        .select('id');

      if (error) {
        throw new Error(`사진 라벨 저장 실패: 수동 라벨 저장 중 오류가 발생했습니다. (${error.message})`);
      }

      manualLabelCount = (data || []).length;
    }

    if (suggestedLabels.length > 0) {
      const { data, error } = await schemaClient
        .from('photo_label_suggestions')
        .insert(
          suggestedLabels.map((label) => ({
            photo_id: photoId,
            label_key: label.labelKey,
            confidence_score: label.confidenceScore,
            suggestion_reason: label.suggestionReason,
            suggestion_status: label.suggestionStatus,
          }))
        )
        .select('id');

      if (error) {
        throw new Error(`사진 라벨 저장 실패: 추천 라벨 저장 중 오류가 발생했습니다. (${error.message})`);
      }

      suggestedLabelCount = (data || []).length;
    }

    return {
      photoId,
      manualLabelCount,
      suggestedLabelCount,
    };
  },
};
