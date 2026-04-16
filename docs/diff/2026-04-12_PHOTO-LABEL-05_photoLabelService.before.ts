import { createClient } from '@supabase/supabase-js';
import type {
  PhotoCreateInput,
  PhotoCreateResult,
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

    const { data, error } = await photosSchema()
      .from('photo_registry')
      .insert([
        {
          site_id: siteId,
          photo_url: photoUrl,
          storage_path: storagePath,
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
