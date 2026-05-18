'use client';

import * as React from 'react';
import { FRAME_BOX_KIND_LABELS, FRAME_ROLE_LABELS, FRAME_RUNTIME_MODE_LABELS, POSITION_SUMMARY_LIST_COLLAPSE_THRESHOLD } from '../constants';

type SelectionSummaryOverlayProps = {
  isExpanded: boolean;
  onToggle: () => void;
  selectedPositionActiveGroup: any;
  normalizePositionGroupDisplayLabel: (label: string, id: string) => string;
  selectedPositionActiveGroupChildGroupLabels: string[];
  selectedPositionActiveGroupChildGroupIds: string[];
  selectedPositionActiveGroupDirectFrameGroupIds: string[];
  selectedFrameGroupIds: string[];
  selectedPositionParentGroupLabels: string[];
  selectedPositionParentGroupIds: string[];
  templateName: string;
  sourceDocumentName: string;
  selectedTemplateId: string;
  frameNodesAvailable: number;
  selectedPositionInfoTitle: string;
  primarySelectedPositionBoxGroup: any;
  selectedPositionGroupDetailRows: any[];
  primaryRelativeImpactGroupLabels: string[];
  primaryRelativeAffectedFrameGroupIds: string[];
  edgeSelectionTokensLength: number;
  selectedEdgeMemberCount: number;
  selectedEdgeMode: string;
  selectedEdgeAnchorIds: string[];
  edgeRoleDiagnostics: {
    selectedEdgeClickedIds: string[];
    selectedEdgeAutoMultiIds: string[];
    peerEdgeIds: string[];
    mismatchEdgeIds: string[];
  };
  frameMetadataDraft: { boxKind?: string; role?: string; runtimeMode?: string };
  currentParentKeyBoxLabel: string;
  valueBoxPickerSummary: string;
  expandedPositionSummarySections: Record<string, boolean>;
  onToggleExpandedSection: (sectionKey: string) => void;
  positionRelationFrameLabelById: Map<string, string>;
};

const renderPositionSummarySection = (title: string, children: React.ReactNode) => {
  const content = React.Children.toArray(children);

  if (content.length <= 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <div className="text-xs font-semibold text-slate-900">{title}</div>
      <div className="mt-1.5 space-y-1.5">{content}</div>
    </div>
  );
};

const renderPositionSummaryCountRow = (sectionKey: string, label: string, count: number) => {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  return (
    <div key={sectionKey} className="flex items-center justify-between gap-2 text-xs">
      <span className="font-medium text-slate-800">{label}</span>
      <span className="shrink-0 text-slate-600">{count}개</span>
    </div>
  );
};

const renderPositionSummaryTextRow = (sectionKey: string, label: string, value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  return (
    <div key={sectionKey} className="flex items-start justify-between gap-2 text-xs">
      <span className="shrink-0 font-medium text-slate-800">{label}</span>
      <span className="break-all text-right text-slate-600">{normalizedValue}</span>
    </div>
  );
};

const formatCollapsedSummaryValues = (values: string[]) => {
  const normalizedValues = values.map((value) => value.trim()).filter((value) => Boolean(value));

  if (normalizedValues.length <= 0) {
    return '-';
  }

  if (normalizedValues.length <= 3) {
    return normalizedValues.join(', ');
  }

  return `${normalizedValues.slice(0, 3).join(', ')} 외 ${normalizedValues.length - 3}개`;
};

export const SelectionSummaryOverlay = ({
  isExpanded,
  onToggle,
  selectedPositionActiveGroup,
  normalizePositionGroupDisplayLabel,
  selectedPositionActiveGroupChildGroupLabels,
  selectedPositionActiveGroupChildGroupIds,
  selectedPositionActiveGroupDirectFrameGroupIds,
  selectedFrameGroupIds,
  selectedPositionParentGroupLabels,
  selectedPositionParentGroupIds,
  templateName,
  sourceDocumentName,
  selectedTemplateId,
  frameNodesAvailable,
  selectedPositionInfoTitle,
  primarySelectedPositionBoxGroup,
  selectedPositionGroupDetailRows,
  primaryRelativeImpactGroupLabels,
  primaryRelativeAffectedFrameGroupIds,
  edgeSelectionTokensLength,
  selectedEdgeMemberCount,
  selectedEdgeMode,
  selectedEdgeAnchorIds,
  edgeRoleDiagnostics,
  frameMetadataDraft,
  currentParentKeyBoxLabel,
  valueBoxPickerSummary,
  expandedPositionSummarySections,
  onToggleExpandedSection,
  positionRelationFrameLabelById,
}: SelectionSummaryOverlayProps) => {
  const renderPositionSummaryListRow = (sectionKey: string, label: string, values: string[]) => {
    const normalizedValues = values.map((value) => value.trim()).filter((value) => Boolean(value));

    if (normalizedValues.length <= 0) {
      return null;
    }

    const shouldCollapse = normalizedValues.length >= POSITION_SUMMARY_LIST_COLLAPSE_THRESHOLD;
    const sectionExpanded = !shouldCollapse || Boolean(expandedPositionSummarySections[sectionKey]);

    return (
      <div key={sectionKey} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-slate-800">{label}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-slate-600">
            <span>{normalizedValues.length}개</span>
            {shouldCollapse ? (
              <button
                type="button"
                className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-300 bg-white px-1 text-[11px] font-semibold leading-none text-slate-700 hover:bg-slate-100"
                onClick={() => onToggleExpandedSection(sectionKey)}
                aria-label={sectionExpanded ? `${label} 접기` : `${label} 펼치기`}
              >
                {sectionExpanded ? '−' : '+'}
              </button>
            ) : null}
          </span>
        </div>
        {sectionExpanded ? (
          <div className="mt-1 break-all text-[11px] leading-5 text-slate-600">{normalizedValues.join(', ')}</div>
        ) : null}
      </div>
    );
  };

  const formatCollapsedFrameSummaryLabel = (frameGroupId: string) => {
    const normalizedFrameGroupId = frameGroupId.trim();
    const frameLabel = positionRelationFrameLabelById.get(normalizedFrameGroupId)?.trim() || '';

    if (!normalizedFrameGroupId) {
      return '';
    }

    if (!frameLabel || frameLabel === normalizedFrameGroupId) {
      return normalizedFrameGroupId;
    }

    return `${frameLabel} (${normalizedFrameGroupId})`;
  };

  const collapsedSummaryRows = selectedPositionActiveGroup
    ? [
        {
          label: '그룹명',
          value: normalizePositionGroupDisplayLabel(selectedPositionActiveGroup.label, selectedPositionActiveGroup.id),
        },
        { label: '그룹 ID', value: selectedPositionActiveGroup.id },
      ]
    : selectedFrameGroupIds.length > 0
      ? [
          {
            label: selectedFrameGroupIds.length > 1 ? '선택 상자' : '상자명',
            value:
              selectedFrameGroupIds.length > 1
                ? `${selectedFrameGroupIds.length}개`
                : formatCollapsedFrameSummaryLabel(selectedFrameGroupIds[0] || ''),
          },
          {
            label: '상자 ID',
            value: formatCollapsedSummaryValues(selectedFrameGroupIds),
          },
        ]
      : [
          {
            label: '템플릿',
            value: templateName.trim() || sourceDocumentName.trim() || selectedTemplateId.trim() || '현재 템플릿',
          },
          { label: '상자 수', value: `${frameNodesAvailable}개` },
        ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{selectedPositionInfoTitle}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {collapsedSummaryRows.map((row) => (
              <span key={row.label} className="min-w-0">
                <span className="font-medium text-slate-800">{row.label}</span>
                <span className="mx-1 text-slate-400">·</span>
                <span className="break-all">{row.value}</span>
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold leading-none text-slate-700 hover:bg-slate-100"
          onClick={onToggle}
          aria-label={isExpanded ? '요약박스 접기' : '요약박스 펼치기'}
          title={isExpanded ? '요약박스 접기' : '요약박스 펼치기'}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      {isExpanded ? (
        <div className="mt-3 space-y-2">
          {renderPositionSummarySection(
            selectedPositionActiveGroup ? '선택 그룹' : '선택 상자',
            selectedPositionActiveGroup
              ? [
                  renderPositionSummaryTextRow('position-summary-selected-entity-kind', '선택 대상', '그룹'),
                  renderPositionSummaryTextRow(
                    'position-summary-selected-group-label',
                    '그룹 이름',
                    normalizePositionGroupDisplayLabel(selectedPositionActiveGroup.label, selectedPositionActiveGroup.id)
                  ),
                  renderPositionSummaryTextRow('position-summary-selected-group-id', '그룹 ID', selectedPositionActiveGroup.id),
                  renderPositionSummaryListRow(
                    'position-summary-selected-group-child-groups',
                    '하위 그룹',
                    selectedPositionActiveGroupChildGroupLabels
                  ),
                  renderPositionSummaryListRow(
                    'position-summary-selected-group-child-group-ids',
                    '하위 그룹 ID',
                    selectedPositionActiveGroupChildGroupIds
                  ),
                  renderPositionSummaryListRow(
                    'position-summary-selected-group-direct-boxes',
                    '하위 상자 ID',
                    selectedPositionActiveGroupDirectFrameGroupIds
                  ),
                  renderPositionSummaryListRow(
                    'position-summary-selected-group-all-boxes',
                    '포함 전체 상자 ID',
                    selectedPositionActiveGroup.frameGroupIds
                  ),
                ]
              : [
                  renderPositionSummaryTextRow(
                    'position-summary-selected-entity-kind',
                    '선택 대상',
                    selectedFrameGroupIds.length > 0 ? '상자' : ''
                  ),
                  renderPositionSummaryCountRow('position-summary-selected-count', '선택 상자', selectedFrameGroupIds.length),
                  renderPositionSummaryListRow('position-summary-selected-ids', '선택 상자 ID', selectedFrameGroupIds),
                  renderPositionSummaryListRow('position-summary-parent-groups', '상위 그룹', selectedPositionParentGroupLabels),
                  renderPositionSummaryListRow('position-summary-parent-group-ids', '상위 그룹 ID', selectedPositionParentGroupIds),
                ]
          )}
          {renderPositionSummarySection(
            '그룹 / 위치 영향',
            [
              renderPositionSummaryTextRow(
                'position-summary-current-group',
                '소속 그룹',
                primarySelectedPositionBoxGroup
                  ? `${normalizePositionGroupDisplayLabel(
                      primarySelectedPositionBoxGroup.label,
                      primarySelectedPositionBoxGroup.id
                    )} (${primarySelectedPositionBoxGroup.frameGroupIds.length}개)`
                  : ''
              ),
              ...selectedPositionGroupDetailRows.flatMap((groupDetail: any) => [
                renderPositionSummaryTextRow(
                  `position-summary-group-detail-id-${groupDetail.groupId}`,
                  groupDetail.isSelectedGroup ? '선택 그룹 ID' : '상위 그룹 ID',
                  groupDetail.groupId
                ),
                renderPositionSummaryListRow(
                  `position-summary-group-detail-members-${groupDetail.groupId}`,
                  `${groupDetail.label} 소속 상자 ID`,
                  groupDetail.frameGroupIds
                ),
              ]),
              renderPositionSummaryListRow('position-summary-impact-groups', '위치 영향 대상 그룹', primaryRelativeImpactGroupLabels),
              renderPositionSummaryListRow('position-summary-impact-ids', '위치 영향 대상', primaryRelativeAffectedFrameGroupIds),
            ]
          )}
          {renderPositionSummarySection(
            '선택 엣지',
            [
              renderPositionSummaryCountRow('position-summary-edge-token-count', '선택 엣지 토큰', edgeSelectionTokensLength),
              renderPositionSummaryCountRow('position-summary-edge-member-count', '선택 엣지', selectedEdgeMemberCount),
              renderPositionSummaryTextRow('position-summary-edge-mode', '선택 엣지 모드', selectedEdgeMode || ''),
              renderPositionSummaryListRow('position-summary-edge-anchors', '선택 엣지 앵커', selectedEdgeAnchorIds),
            ]
          )}
          {renderPositionSummarySection(
            '엣지 진단',
            [
              renderPositionSummaryListRow(
                'position-summary-selected-edge-clicked',
                'selected_edge_clicked',
                edgeRoleDiagnostics.selectedEdgeClickedIds
              ),
              renderPositionSummaryListRow(
                'position-summary-selected-edge-auto-multi',
                'selected_edge_auto_multi',
                edgeRoleDiagnostics.selectedEdgeAutoMultiIds
              ),
              renderPositionSummaryListRow('position-summary-peer-edge', 'peer_edge', edgeRoleDiagnostics.peerEdgeIds),
              renderPositionSummaryListRow(
                'position-summary-mismatch-edge',
                'movement mismatch edge',
                edgeRoleDiagnostics.mismatchEdgeIds
              ),
            ]
          )}
          {renderPositionSummarySection(
            '메타데이터 요약',
            [
              renderPositionSummaryTextRow(
                'position-summary-box-kind',
                'Box Kind',
                frameMetadataDraft.boxKind ? FRAME_BOX_KIND_LABELS[frameMetadataDraft.boxKind] : ''
              ),
              renderPositionSummaryTextRow(
                'position-summary-role',
                'Role',
                frameMetadataDraft.role ? FRAME_ROLE_LABELS[frameMetadataDraft.role] : ''
              ),
              renderPositionSummaryTextRow(
                'position-summary-runtime-mode',
                '상세 기능',
                frameMetadataDraft.runtimeMode ? FRAME_RUNTIME_MODE_LABELS[frameMetadataDraft.runtimeMode] : ''
              ),
              renderPositionSummaryTextRow(
                'position-summary-key-box',
                'Key Box',
                currentParentKeyBoxLabel !== 'null' ? currentParentKeyBoxLabel : ''
              ),
              renderPositionSummaryListRow(
                'position-summary-value-boxes',
                'Value Box',
                valueBoxPickerSummary !== '-'
                  ? valueBoxPickerSummary
                      .split(',')
                      .map((summaryItem) => summaryItem.trim())
                      .filter((summaryItem) => Boolean(summaryItem))
                  : []
              ),
            ]
          )}
          {renderPositionSummarySection(
            '템플릿',
            renderPositionSummaryCountRow('position-summary-frame-node-count', '프레임 상자', frameNodesAvailable)
          )}
        </div>
      ) : null}
    </div>
  );
};
