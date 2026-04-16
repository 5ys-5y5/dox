import { createClient } from '@supabase/supabase-js';
import type {
  PhotoLabelRequirementDto,
  PhotoLabelRequirementInput,
  PhotoLabelRequirementsSaveInput,
  PhotoLabelRequirementsSaveResult,
  SitePhotoLabelGapItemDto,
  SitePhotoLabelGapSummaryDto,
} from '../lib/photoLabelDtos';

type PhotoLabelRequirementRow = {
  id: string;
  site_id: string;
  label_key: string;
  label_name: string;
  description: string | null;
  document_type_key: string | null;
  minimum_photo_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type PhotoRegistryRow = {
  id: string;
  site_id: string;
  status: 'active' | 'archived';
};

type PhotoLabelAssignmentRow = {
  photo_id: string;
  label_key: string;
};

type PhotoLabelSuggestionRow = {
  photo_id: string;
  label_key: string;
  suggestion_status: 'review_needed' | 'accepted' | 'rejected';
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

// PHOTO-LABEL-04_SCHEMA_BOUNDARY
// 사진 요구 라벨 규칙과 누락 경고 계산은 photo_labels 스키마 안에서만 정본을 가집니다.
// sites 나 documents 테이블을 직접 수정하지 않고, siteId 와 documentTypeKey 계약만 참조합니다.
const photosSchema = (client = getSupabase()) => client.schema(PHOTO_LABELS_DB_SCHEMA);

const toRequirementDto = (row: PhotoLabelRequirementRow): PhotoLabelRequirementDto => ({
  id: row.id,
  siteId: row.site_id,
  labelKey: row.label_key,
  labelName: row.label_name,
  description: row.description,
  documentTypeKey: row.document_type_key,
  minimumPhotoCount: row.minimum_photo_count,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeRequirements = (requirements: PhotoLabelRequirementInput[]) => {
  const seen = new Set<string>();

  return requirements
    .map((requirement) => {
      const labelKey = String(requirement.labelKey || '').trim();
      const labelName = String(requirement.labelName || '').trim();
      const documentTypeKey = String(requirement.documentTypeKey || '').trim() || null;
      const minimumPhotoCountRaw = Number(requirement.minimumPhotoCount ?? 1);
      const minimumPhotoCount = Number.isFinite(minimumPhotoCountRaw)
        ? Math.max(1, Math.trunc(minimumPhotoCountRaw))
        : 1;

      if (!labelKey || !labelName) {
        throw new Error('사진 요구 라벨 저장 실패: labelKey 와 labelName 은 필수입니다.');
      }

      return {
        labelKey,
        labelName,
        description: String(requirement.description || '').trim() || null,
        documentTypeKey,
        minimumPhotoCount,
      };
    })
    .filter((requirement) => {
      const dedupeKey = `${requirement.labelKey}::${requirement.documentTypeKey || ''}`;

      if (seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    });
};

const groupPhotoIdsByLabel = (rows: Array<{ photo_id: string; label_key: string }>) => {
  const grouped = new Map<string, Set<string>>();

  for (const row of rows) {
    const bucket = grouped.get(row.label_key) || new Set<string>();
    bucket.add(row.photo_id);
    grouped.set(row.label_key, bucket);
  }

  return grouped;
};

export const PhotoLabelRequirementService = {
  async saveRequirements(params: PhotoLabelRequirementsSaveInput): Promise<PhotoLabelRequirementsSaveResult> {
    const siteId = params.siteId.trim();

    if (!siteId) {
      throw new Error('사진 요구 라벨 저장 실패: siteId가 필요합니다.');
    }

    const requirements = normalizeRequirements(params.requirements || []);
    const client = getSupabase();
    const schemaClient = photosSchema(client);

    const { error: deleteError } = await schemaClient
      .from('site_photo_label_requirements')
      .delete()
      .eq('site_id', siteId);

    if (deleteError) {
      throw new Error(`사진 요구 라벨 저장 실패: 기존 규칙 삭제 중 오류가 발생했습니다. (${deleteError.message})`);
    }

    if (requirements.length === 0) {
      return {
        siteId,
        requirementCount: 0,
        requirements: [],
      };
    }

    const { data, error } = await schemaClient
      .from('site_photo_label_requirements')
      .insert(
        requirements.map((requirement) => ({
          site_id: siteId,
          label_key: requirement.labelKey,
          label_name: requirement.labelName,
          description: requirement.description,
          document_type_key: requirement.documentTypeKey,
          minimum_photo_count: requirement.minimumPhotoCount,
          active: true,
        }))
      )
      .select('*');

    if (error) {
      throw new Error(`사진 요구 라벨 저장 실패: ${error.message}`);
    }

    const savedRequirements = ((data || []) as PhotoLabelRequirementRow[]).map(toRequirementDto);

    return {
      siteId,
      requirementCount: savedRequirements.length,
      requirements: savedRequirements,
    };
  },

  async getSitePhotoLabelGaps(siteId: string): Promise<SitePhotoLabelGapSummaryDto> {
    const normalizedSiteId = siteId.trim();

    if (!normalizedSiteId) {
      throw new Error('사진 라벨 누락 경고 조회 실패: siteId가 필요합니다.');
    }

    const client = getSupabase();
    const schemaClient = photosSchema(client);
    const { data: requirementRows, error: requirementError } = await schemaClient
      .from('site_photo_label_requirements')
      .select('*')
      .eq('site_id', normalizedSiteId)
      .eq('active', true)
      .order('document_type_key', { ascending: true })
      .order('label_key', { ascending: true });

    if (requirementError) {
      throw new Error(`사진 라벨 누락 경고 조회 실패: 요구 라벨 조회 중 오류가 발생했습니다. (${requirementError.message})`);
    }

    const requirements = (requirementRows || []) as PhotoLabelRequirementRow[];

    if (requirements.length === 0) {
      return {
        siteId: normalizedSiteId,
        requirementCount: 0,
        coveredCount: 0,
        reviewNeededCount: 0,
        missingCount: 0,
        requirements: [],
      };
    }

    const { data: photoRows, error: photoError } = await schemaClient
      .from('photo_registry')
      .select('id, site_id, status')
      .eq('site_id', normalizedSiteId)
      .eq('status', 'active');

    if (photoError) {
      throw new Error(`사진 라벨 누락 경고 조회 실패: 사진 조회 중 오류가 발생했습니다. (${photoError.message})`);
    }

    const photoIds = ((photoRows || []) as PhotoRegistryRow[]).map((photo) => photo.id);

    if (photoIds.length === 0) {
      const emptyResults = requirements.map<SitePhotoLabelGapItemDto>((requirement) => ({
        requirementId: requirement.id,
        siteId: requirement.site_id,
        labelKey: requirement.label_key,
        labelName: requirement.label_name,
        description: requirement.description,
        documentTypeKey: requirement.document_type_key,
        minimumPhotoCount: requirement.minimum_photo_count,
        matchedPhotoCount: 0,
        reviewPendingCount: 0,
        missingPhotoCount: requirement.minimum_photo_count,
        matchedPhotoIds: [],
        reviewPendingPhotoIds: [],
        coverageStatus: 'missing',
        createdAt: requirement.created_at,
        updatedAt: requirement.updated_at,
      }));

      return {
        siteId: normalizedSiteId,
        requirementCount: emptyResults.length,
        coveredCount: 0,
        reviewNeededCount: 0,
        missingCount: emptyResults.length,
        requirements: emptyResults,
      };
    }

    const [manualResponse, suggestionResponse] = await Promise.all([
      schemaClient.from('photo_label_assignments').select('photo_id, label_key').in('photo_id', photoIds),
      schemaClient
        .from('photo_label_suggestions')
        .select('photo_id, label_key, suggestion_status')
        .in('photo_id', photoIds),
    ]);

    if (manualResponse.error) {
      throw new Error(
        `사진 라벨 누락 경고 조회 실패: 수동 라벨 조회 중 오류가 발생했습니다. (${manualResponse.error.message})`
      );
    }

    if (suggestionResponse.error) {
      throw new Error(
        `사진 라벨 누락 경고 조회 실패: 추천 라벨 조회 중 오류가 발생했습니다. (${suggestionResponse.error.message})`
      );
    }

    const manualRows = (manualResponse.data || []) as PhotoLabelAssignmentRow[];
    const suggestionRows = (suggestionResponse.data || []) as PhotoLabelSuggestionRow[];
    const acceptedMap = groupPhotoIdsByLabel(
      suggestionRows
        .filter((row) => row.suggestion_status === 'accepted')
        .map((row) => ({ photo_id: row.photo_id, label_key: row.label_key }))
    );
    const reviewPendingMap = groupPhotoIdsByLabel(
      suggestionRows
        .filter((row) => row.suggestion_status === 'review_needed')
        .map((row) => ({ photo_id: row.photo_id, label_key: row.label_key }))
    );
    const manualMap = groupPhotoIdsByLabel(manualRows);

    const results = requirements.map<SitePhotoLabelGapItemDto>((requirement) => {
      const matchedPhotoIdSet = new Set<string>([
        ...(manualMap.get(requirement.label_key) || new Set<string>()),
        ...(acceptedMap.get(requirement.label_key) || new Set<string>()),
      ]);
      const reviewPendingPhotoIdSet = reviewPendingMap.get(requirement.label_key) || new Set<string>();
      const matchedPhotoIds = [...matchedPhotoIdSet].sort();
      const reviewPendingPhotoIds = [...reviewPendingPhotoIdSet].sort();
      const matchedPhotoCount = matchedPhotoIds.length;
      const reviewPendingCount = reviewPendingPhotoIds.length;
      const missingPhotoCount = Math.max(0, requirement.minimum_photo_count - matchedPhotoCount);
      const coverageStatus =
        matchedPhotoCount >= requirement.minimum_photo_count
          ? 'covered'
          : reviewPendingCount > 0
            ? 'review_needed'
            : 'missing';

      return {
        requirementId: requirement.id,
        siteId: requirement.site_id,
        labelKey: requirement.label_key,
        labelName: requirement.label_name,
        description: requirement.description,
        documentTypeKey: requirement.document_type_key,
        minimumPhotoCount: requirement.minimum_photo_count,
        matchedPhotoCount,
        reviewPendingCount,
        missingPhotoCount,
        matchedPhotoIds,
        reviewPendingPhotoIds,
        coverageStatus,
        createdAt: requirement.created_at,
        updatedAt: requirement.updated_at,
      };
    });

    return {
      siteId: normalizedSiteId,
      requirementCount: results.length,
      coveredCount: results.filter((item) => item.coverageStatus === 'covered').length,
      reviewNeededCount: results.filter((item) => item.coverageStatus === 'review_needed').length,
      missingCount: results.filter((item) => item.coverageStatus === 'missing').length,
      requirements: results,
    };
  },
};
