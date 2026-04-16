import { createClient } from '@supabase/supabase-js';
import { DocumentService } from './documentService';
import { SignAuthService, type VerifiedAuthenticationSummary } from './signAuthService';
import type {
  BulkCommitInput,
  BulkCommitRecordDto,
  BulkCommitResult,
  BulkLabelChangeInput,
  BulkPreviewInput,
  BulkPreviewItemDto,
  BulkPreviewItemStatus,
  BulkPreviewRecordDto,
  BulkPreviewResult,
  BulkSignatureAuthorizationInput,
  BulkScalarValue,
} from '../lib/bulkOperationDtos';

type BulkOperationPreviewRow = {
  id: string;
  status: BulkPreviewRecordDto['status'];
  requested_by: string | null;
  document_count: number;
  change_count: number;
  warnings: string[] | null;
  created_at: string;
  committed_at: string | null;
};

type BulkOperationPreviewItemRow = {
  id: string;
  preview_id: string;
  document_id: string;
  document_version_id: string | null;
  document_title: string;
  label_key: string;
  change_action: BulkPreviewItemDto['changeAction'];
  before_value: unknown;
  after_value: unknown;
  item_status: BulkPreviewItemStatus;
  warning_text: string | null;
  created_at: string;
};

type BulkOperationCommitRow = {
  id: string;
  preview_id: string;
  confirmed_by: string;
  updated_document_count: number;
  skipped_document_count: number;
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

const BULK_OPS_DB_SCHEMA = 'bulk_ops';

// BULK_OPS_SCHEMA_BOUNDARY
// 일괄 정보 입력 도메인의 정본은 bulk_ops 스키마에만 둡니다.
// preview / commit / field-level change log 성격의 데이터는 bulk_ops 에 저장하고,
// 실제 문서 버전 반영은 documents 서비스 계약만 호출합니다.
const bulkSchema = (client = getSupabase()) => client.schema(BULK_OPS_DB_SCHEMA);

// BULK_EDIT_SIGNATURE_BLOCKED_UNTIL_AUTH
// 서명 라벨은 본인확인/권한 조건이 붙기 전까지 일괄 수정 금지입니다.
// BULK-EDIT-04 구현 전까지 signature 계열 라벨은 preview 에서 blocked 로 남깁니다.
const isSignatureLabel = (labelKey: string) => /(^|_)signature($|_)/i.test(labelKey) || /sign/i.test(labelKey);

const toPreviewDto = (row: BulkOperationPreviewRow): BulkPreviewRecordDto => ({
  id: row.id,
  status: row.status,
  requestedBy: row.requested_by,
  documentCount: row.document_count,
  changeCount: row.change_count,
  warnings: row.warnings || [],
  createdAt: row.created_at,
  committedAt: row.committed_at,
});

const toPreviewItemDto = (row: BulkOperationPreviewItemRow): BulkPreviewItemDto => ({
  id: row.id,
  previewId: row.preview_id,
  documentId: row.document_id,
  documentVersionId: row.document_version_id,
  documentTitle: row.document_title,
  labelKey: row.label_key,
  changeAction: row.change_action,
  beforeValue: row.before_value,
  afterValue: row.after_value,
  itemStatus: row.item_status,
  warningText: row.warning_text,
  createdAt: row.created_at,
});

const toCommitDto = (row: BulkOperationCommitRow): BulkCommitRecordDto => ({
  id: row.id,
  previewId: row.preview_id,
  confirmedBy: row.confirmed_by,
  updatedDocumentCount: row.updated_document_count,
  skippedDocumentCount: row.skipped_document_count,
  createdAt: row.created_at,
});

const normalizeDocumentIds = (documentIds: string[]) => {
  const normalized = [...new Set(documentIds.map((value) => value.trim()).filter(Boolean))];

  if (normalized.length === 0) {
    throw new Error('일괄 수정 미리보기 실패: documentIds가 최소 1개 이상 필요합니다.');
  }

  return normalized;
};

const getScalarType = (value: unknown) => {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'unsupported';
};

const normalizeLabelChanges = (labelChanges: BulkLabelChangeInput[]) => {
  if (labelChanges.length === 0) {
    throw new Error('일괄 수정 미리보기 실패: labelChanges가 최소 1개 이상 필요합니다.');
  }

  const seen = new Set<string>();
  const normalized = labelChanges.map((change) => {
    const labelKey = String(change.labelKey || '').trim();
    const action = change.action === 'delete' ? 'delete' : 'upsert';

    if (!labelKey) {
      throw new Error('일괄 수정 미리보기 실패: labelKey는 비어 있을 수 없습니다.');
    }

    if (seen.has(labelKey)) {
      throw new Error(`일괄 수정 미리보기 실패: 중복 labelKey(${labelKey})는 허용되지 않습니다.`);
    }

    seen.add(labelKey);

    if (action === 'delete') {
      return {
        labelKey,
        action,
        value: null as BulkScalarValue,
        scalarType: 'null' as const,
      };
    }

    const scalarType = getScalarType(change.value);

    if (scalarType === 'unsupported') {
      throw new Error(
        `일괄 수정 미리보기 실패: ${labelKey} 값은 string/number/boolean/null 같은 단순 값만 허용됩니다.`
      );
    }

    return {
      labelKey,
      action,
      value: (change.value ?? null) as BulkScalarValue,
      scalarType,
    };
  });

  const upsertTypes = [...new Set(normalized.filter((item) => item.action === 'upsert').map((item) => item.scalarType))];

  if (upsertTypes.length > 1) {
    throw new Error('일괄 수정 미리보기 실패: 이번 1차 구현은 같은 타입의 라벨 값만 한 번에 처리합니다.');
  }

  return normalized;
};

const buildWarning = (documentTitle: string, labelKey: string, message: string) =>
  `${documentTitle} / ${labelKey}: ${message}`;

type SignatureAuthorizationResolution =
  | { ok: false; reason: string }
  | {
      ok: true;
      authorization: BulkSignatureAuthorizationInput;
      authentication: VerifiedAuthenticationSummary;
    };

const resolveSignatureAuthorization = async (
  input?: BulkSignatureAuthorizationInput | null
): Promise<SignatureAuthorizationResolution> => {
  const authenticationId = input?.authenticationId?.trim() || '';
  const approvedBy = input?.approvedBy?.trim() || '';

  if (!authenticationId) {
    return {
      ok: false,
      reason: '서명 라벨 변경에는 검증 완료된 본인확인 기록 선택이 필요합니다.',
    };
  }

  if (!approvedBy) {
    return {
      ok: false,
      reason: '서명 라벨 변경에는 추가 승인자(확정자) 정보가 필요합니다.',
    };
  }

  let authentication: VerifiedAuthenticationSummary | null = null;

  try {
    authentication = await SignAuthService.getVerifiedAuthenticationContext(authenticationId);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : '선택한 본인확인 기록을 확인할 수 없습니다.',
    };
  }

  if (!authentication) {
    return {
      ok: false,
      reason: '선택한 본인확인 기록을 찾을 수 없습니다.',
    };
  }

  return {
    ok: true,
    authorization: {
      authenticationId,
      approvedBy,
    },
    authentication,
  };
};

export const BulkEditService = {
  async createPreview(params: BulkPreviewInput): Promise<BulkPreviewResult> {
    const documentIds = normalizeDocumentIds(params.documentIds || []);
    const labelChanges = normalizeLabelChanges(params.labelChanges || []);
    const client = getSupabase();
    const bulkClient = bulkSchema(client);
    const warnings = new Set<string>();
    const hasSignatureLabelChanges = labelChanges.some((change) => isSignatureLabel(change.labelKey));
    const signatureAuthorization = hasSignatureLabelChanges
      ? await resolveSignatureAuthorization(params.signatureAuthorization)
      : null;
    const signatureMultiDocumentWarning =
      hasSignatureLabelChanges && documentIds.length > 1
        ? '서명 항목은 한 번에 한 문서만 수정할 수 있습니다. 문서를 1개만 선택하세요.'
        : null;

    const previewItemsSeed = (
      await Promise.all(
        documentIds.map(async (documentId) => {
          try {
            const detail = await DocumentService.getDocumentDetail(documentId);
            const latestVersion = detail.latestVersion;

            if (!latestVersion) {
              return labelChanges.map((change) => ({
                documentId,
                documentVersionId: null,
                documentTitle: detail.document.title,
                labelKey: change.labelKey,
                changeAction: change.action,
                beforeValue: null,
                afterValue: change.action === 'delete' ? null : change.value,
                itemStatus: 'blocked' as const,
                warningText: buildWarning(detail.document.title, change.labelKey, '최신 버전이 없어 일괄 수정할 수 없습니다.'),
              }));
            }

            const labelValues = latestVersion.labelValues || {};

            return labelChanges.map((change) => {
              const beforeValue = Object.prototype.hasOwnProperty.call(labelValues, change.labelKey)
                ? (labelValues as Record<string, unknown>)[change.labelKey]
                : null;

              if (isSignatureLabel(change.labelKey)) {
                if (signatureMultiDocumentWarning) {
                  return {
                    documentId,
                    documentVersionId: latestVersion.id,
                    documentTitle: detail.document.title,
                    labelKey: change.labelKey,
                    changeAction: change.action,
                    beforeValue,
                    afterValue: change.action === 'delete' ? null : change.value,
                    itemStatus: 'blocked' as const,
                    warningText: buildWarning(detail.document.title, change.labelKey, signatureMultiDocumentWarning),
                  };
                }

                if (!signatureAuthorization?.ok) {
                  return {
                    documentId,
                    documentVersionId: latestVersion.id,
                    documentTitle: detail.document.title,
                    labelKey: change.labelKey,
                    changeAction: change.action,
                    beforeValue,
                    afterValue: change.action === 'delete' ? null : change.value,
                    itemStatus: 'blocked' as const,
                    warningText: buildWarning(
                      detail.document.title,
                      change.labelKey,
                      signatureAuthorization?.reason || '검증 완료된 본인확인 기록을 선택하세요.'
                    ),
                  };
                }

                if (signatureAuthorization.authentication.documentId !== documentId) {
                  return {
                    documentId,
                    documentVersionId: latestVersion.id,
                    documentTitle: detail.document.title,
                    labelKey: change.labelKey,
                    changeAction: change.action,
                    beforeValue,
                    afterValue: change.action === 'delete' ? null : change.value,
                    itemStatus: 'blocked' as const,
                    warningText: buildWarning(
                      detail.document.title,
                      change.labelKey,
                      '선택한 본인확인 기록은 현재 문서용이 아닙니다. 이 문서에 대해 검증 완료된 기록을 다시 선택하세요.'
                    ),
                  };
                }

                return {
                  documentId,
                  documentVersionId: latestVersion.id,
                  documentTitle: detail.document.title,
                  labelKey: change.labelKey,
                  changeAction: change.action,
                  beforeValue,
                  afterValue: change.action === 'delete' ? null : change.value,
                  itemStatus: 'apply' as const,
                  warningText: null,
                };
              }

              const beforeType = getScalarType(beforeValue);

              if (beforeValue !== null && beforeType === 'unsupported') {
                return {
                  documentId,
                  documentVersionId: latestVersion.id,
                  documentTitle: detail.document.title,
                  labelKey: change.labelKey,
                  changeAction: change.action,
                  beforeValue,
                  afterValue: change.action === 'delete' ? null : change.value,
                  itemStatus: 'blocked' as const,
                  warningText: buildWarning(
                    detail.document.title,
                    change.labelKey,
                    '기존 값이 객체/배열이라 이번 1차 일괄 수정 범위에서 제외됩니다.'
                  ),
                };
              }

              if (change.action === 'delete') {
                if (!Object.prototype.hasOwnProperty.call(labelValues, change.labelKey)) {
                  return {
                    documentId,
                    documentVersionId: latestVersion.id,
                    documentTitle: detail.document.title,
                    labelKey: change.labelKey,
                    changeAction: change.action,
                    beforeValue,
                    afterValue: null,
                    itemStatus: 'skip' as const,
                    warningText: buildWarning(detail.document.title, change.labelKey, '삭제할 값이 없어 건너뜁니다.'),
                  };
                }

                return {
                  documentId,
                  documentVersionId: latestVersion.id,
                  documentTitle: detail.document.title,
                  labelKey: change.labelKey,
                  changeAction: change.action,
                  beforeValue,
                  afterValue: null,
                  itemStatus: 'apply' as const,
                  warningText: null,
                };
              }

              const afterType = getScalarType(change.value);

              if (beforeValue !== null && beforeType !== 'null' && beforeType !== afterType) {
                return {
                  documentId,
                  documentVersionId: latestVersion.id,
                  documentTitle: detail.document.title,
                  labelKey: change.labelKey,
                  changeAction: change.action,
                  beforeValue,
                  afterValue: change.value,
                  itemStatus: 'blocked' as const,
                  warningText: buildWarning(
                    detail.document.title,
                    change.labelKey,
                    `기존 타입(${beforeType})과 새 값 타입(${afterType})이 달라 차단했습니다.`
                  ),
                };
              }

              if (JSON.stringify(beforeValue) === JSON.stringify(change.value)) {
                return {
                  documentId,
                  documentVersionId: latestVersion.id,
                  documentTitle: detail.document.title,
                  labelKey: change.labelKey,
                  changeAction: change.action,
                  beforeValue,
                  afterValue: change.value,
                  itemStatus: 'skip' as const,
                  warningText: buildWarning(detail.document.title, change.labelKey, '변경 전후 값이 같아 건너뜁니다.'),
                };
              }

              return {
                documentId,
                documentVersionId: latestVersion.id,
                documentTitle: detail.document.title,
                labelKey: change.labelKey,
                changeAction: change.action,
                beforeValue,
                afterValue: change.value,
                itemStatus: 'apply' as const,
                warningText: null,
              };
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : '문서를 읽을 수 없습니다.';

            return labelChanges.map((change) => ({
              documentId,
              documentVersionId: null,
              documentTitle: '알 수 없는 문서',
              labelKey: change.labelKey,
              changeAction: change.action,
              beforeValue: null,
              afterValue: change.action === 'delete' ? null : change.value,
              itemStatus: 'blocked' as const,
              warningText: buildWarning('알 수 없는 문서', change.labelKey, message),
            }));
          }
        })
      )
    ).flat();

    for (const item of previewItemsSeed) {
      if (item.warningText) {
        warnings.add(item.warningText);
      }
    }

    const { data: previewRowData, error: previewError } = await bulkClient
      .from('bulk_operation_previews')
      .insert([
        {
          status: 'draft',
          requested_by: params.requestedBy?.trim() || null,
          document_count: documentIds.length,
          change_count: labelChanges.length,
          warnings: [...warnings],
        },
      ])
      .select('*')
      .single();

    const previewRow = previewRowData as BulkOperationPreviewRow | null;

    if (previewError || !previewRow) {
      throw new Error(`일괄 수정 미리보기 실패: preview 저장 중 오류가 발생했습니다. (${previewError?.message})`);
    }

    const { data: previewItemsData, error: itemsError } = await bulkClient
      .from('bulk_operation_preview_items')
      .insert(
        previewItemsSeed.map((item) => ({
          preview_id: previewRow.id,
          document_id: item.documentId,
          document_version_id: item.documentVersionId,
          document_title: item.documentTitle,
          label_key: item.labelKey,
          change_action: item.changeAction,
          before_value: item.beforeValue,
          after_value: item.afterValue,
          item_status: item.itemStatus,
          warning_text: item.warningText,
        }))
      )
      .select('*');

    if (itemsError) {
      throw new Error(`일괄 수정 미리보기 실패: preview item 저장 중 오류가 발생했습니다. (${itemsError.message})`);
    }

    return {
      preview: toPreviewDto(previewRow),
      items: ((previewItemsData || []) as BulkOperationPreviewItemRow[]).map(toPreviewItemDto),
      warnings: [...warnings],
    };
  },

  async commitPreview(params: BulkCommitInput): Promise<BulkCommitResult> {
    const previewId = params.previewId.trim();
    const confirmedBy = params.confirmedBy.trim();

    if (!previewId) {
      throw new Error('일괄 수정 반영 실패: previewId가 필요합니다.');
    }

    if (!confirmedBy) {
      throw new Error('일괄 수정 반영 실패: confirmedBy가 필요합니다.');
    }

    const client = getSupabase();
    const bulkClient = bulkSchema(client);
    const { data: previewData, error: previewError } = await bulkClient
      .from('bulk_operation_previews')
      .select('*')
      .eq('id', previewId)
      .single();

    const previewRow = previewData as BulkOperationPreviewRow | null;

    if (previewError || !previewRow) {
      throw new Error(`일괄 수정 반영 실패: ${previewError?.message || 'preview를 찾을 수 없습니다.'}`);
    }

    if (previewRow.status !== 'draft') {
      throw new Error(`일괄 수정 반영 실패: preview 상태가 ${previewRow.status} 이므로 다시 반영할 수 없습니다.`);
    }

    const { data: itemRowsData, error: itemError } = await bulkClient
      .from('bulk_operation_preview_items')
      .select('*')
      .eq('preview_id', previewId)
      .order('created_at', { ascending: true });

    if (itemError) {
      throw new Error(`일괄 수정 반영 실패: preview item 조회 중 오류가 발생했습니다. (${itemError.message})`);
    }

    const itemRows = ((itemRowsData || []) as BulkOperationPreviewItemRow[]).map(toPreviewItemDto);
    const signatureApplyItems = itemRows.filter(
      (item) => item.itemStatus === 'apply' && isSignatureLabel(item.labelKey)
    );
    const signatureAuthorization = signatureApplyItems.length
      ? await resolveSignatureAuthorization(params.signatureAuthorization)
      : null;
    const signatureDocumentIds = [...new Set(signatureApplyItems.map((item) => item.documentId))];
    const itemsByDocumentId = itemRows.reduce<Record<string, BulkPreviewItemDto[]>>((acc, item) => {
      acc[item.documentId] = acc[item.documentId] || [];
      acc[item.documentId].push(item);
      return acc;
    }, {});

    const updatedDocumentIds: string[] = [];
    const skippedDocumentIds: string[] = [];

    if (signatureApplyItems.length > 0 && !signatureAuthorization?.ok) {
      throw new Error(`일괄 수정 반영 실패: ${signatureAuthorization?.reason || '서명 라벨 승인 정보를 확인할 수 없습니다.'}`);
    }

    if (signatureDocumentIds.length > 1) {
      throw new Error('일괄 수정 반영 실패: 서명 항목은 한 번에 한 문서만 수정할 수 있습니다.');
    }

    for (const [documentId, items] of Object.entries(itemsByDocumentId)) {
      const applyItems = items.filter((item) => item.itemStatus === 'apply');

      if (applyItems.length === 0) {
        skippedDocumentIds.push(documentId);
        continue;
      }

      const detail = await DocumentService.getDocumentDetail(documentId);
      const latestVersion = detail.latestVersion;

      if (!latestVersion) {
        skippedDocumentIds.push(documentId);
        continue;
      }

      const hasSignatureApplyItems = applyItems.some((item) => isSignatureLabel(item.labelKey));

      if (
        hasSignatureApplyItems &&
        signatureAuthorization?.ok &&
        signatureAuthorization.authentication.documentId !== documentId
      ) {
        throw new Error(
          `일괄 수정 반영 실패: 선택한 본인확인 기록은 문서 ${detail.document.title}(${documentId})에 사용할 수 없습니다.`
        );
      }

      const previewVersionIds = [...new Set(applyItems.map((item) => item.documentVersionId).filter(Boolean))];

      if (previewVersionIds.length !== 1 || previewVersionIds[0] !== latestVersion.id) {
        skippedDocumentIds.push(documentId);
        continue;
      }

      const nextLabelValues = { ...(latestVersion.labelValues || {}) } as Record<string, unknown>;

      for (const item of applyItems) {
        if (item.changeAction === 'delete') {
          delete nextLabelValues[item.labelKey];
        } else {
          nextLabelValues[item.labelKey] = item.afterValue;
        }
      }

      if (JSON.stringify(nextLabelValues) === JSON.stringify(latestVersion.labelValues || {})) {
        skippedDocumentIds.push(documentId);
        continue;
      }

      await DocumentService.createVersion(documentId, {
        htmlCanonical: latestVersion.htmlCanonical,
        labelValues: nextLabelValues,
        changeReason: `bulk-commit:${previewId}`,
        createdBy: confirmedBy,
      });

      updatedDocumentIds.push(documentId);
    }

    const { data: commitData, error: commitError } = await bulkClient
      .from('bulk_operation_commits')
      .insert([
        {
          preview_id: previewId,
          confirmed_by: confirmedBy,
          updated_document_count: updatedDocumentIds.length,
          skipped_document_count: skippedDocumentIds.length,
        },
      ])
      .select('*')
      .single();

    const commitRow = commitData as BulkOperationCommitRow | null;

    if (commitError || !commitRow) {
      throw new Error(`일괄 수정 반영 실패: commit 이력 저장 중 오류가 발생했습니다. (${commitError?.message})`);
    }

    const { data: updatedPreviewData, error: updatePreviewError } = await bulkClient
      .from('bulk_operation_previews')
      .update({
        status: 'committed',
        committed_at: new Date().toISOString(),
      })
      .eq('id', previewId)
      .select('*')
      .single();

    const updatedPreviewRow = updatedPreviewData as BulkOperationPreviewRow | null;

    if (updatePreviewError || !updatedPreviewRow) {
      throw new Error(`일괄 수정 반영 실패: preview 상태 갱신 중 오류가 발생했습니다. (${updatePreviewError?.message})`);
    }

    return {
      commit: toCommitDto(commitRow),
      preview: toPreviewDto(updatedPreviewRow),
      updatedDocumentCount: updatedDocumentIds.length,
      skippedDocumentCount: skippedDocumentIds.length,
      updatedDocumentIds,
      skippedDocumentIds,
    };
  },
};
