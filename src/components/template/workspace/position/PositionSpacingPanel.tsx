'use client';

import * as React from 'react';
import { Save, Trash2 } from 'lucide-react';
import { CardContent } from '../../../ui/Card';
import { PositionSpacingDeferredInput } from './PositionSpacingDeferredInput';

type PositionSpacingPanelProps = {
  positionSpacingSettingRelations: any[];
  positionSpacingNewPairSummaries: any[];
  positionSpacingBulkGapY: string;
  positionSpacingBulkGapError: boolean;
  positionSpacingSettingRelationDisplayRows: any[];
  definedPositionRelationGapDraftByKey: Record<string, { gapY: string }>;
  highlightedPositionSpacingSettingRelationKeySet: Set<string>;
  positionSpacingEntityVisualByKey: Map<string, any>;
  positionSpacingCheckedRowKeys: Record<string, boolean>;
  positionSpacingDraftByPairKey: Record<string, { gapY: string }>;
  positionSpacingDraftErrorByPairKey: Record<string, boolean>;
  onClose: () => void;
  onBulkGapCommit: (nextGapY: string) => void;
  onApplyBulkGap: () => void;
  onCheckedRowChange: (rowKey: string, checked: boolean) => void;
  onExistingRelationSelect: (relation: any) => void;
  onExistingRelationGapCommit: (relation: any, nextGapY: string) => void;
  onExistingRelationDelete: (relation: any) => void;
  onNewPairGapCommit: (pair: any, nextGapY: string) => void;
  onNewPairApply: (pair: any) => void;
};

export const PositionSpacingPanel = ({
  positionSpacingSettingRelations,
  positionSpacingNewPairSummaries,
  positionSpacingBulkGapY,
  positionSpacingBulkGapError,
  positionSpacingSettingRelationDisplayRows,
  definedPositionRelationGapDraftByKey,
  highlightedPositionSpacingSettingRelationKeySet,
  positionSpacingEntityVisualByKey,
  positionSpacingCheckedRowKeys,
  positionSpacingDraftByPairKey,
  positionSpacingDraftErrorByPairKey,
  onClose,
  onBulkGapCommit,
  onApplyBulkGap,
  onCheckedRowChange,
  onExistingRelationSelect,
  onExistingRelationGapCommit,
  onExistingRelationDelete,
  onNewPairGapCommit,
  onNewPairApply,
}: PositionSpacingPanelProps) => (
  <CardContent className="px-6 pb-3 pt-0">
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-4 text-amber-900">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-amber-950">간격 설정</div>
        <button
          type="button"
          className="inline-flex h-6 items-center justify-center rounded border border-amber-300 bg-white px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
      <div>현재 템플릿에 적용된 상자/그룹 간격을 확인하고, 새 선택 항목은 저장 아이콘으로 추가합니다.</div>
      <div className="space-y-1">
        <div className="font-medium text-amber-950">적용된 간격 {positionSpacingSettingRelations.length}개</div>
        <div className="flex items-center gap-1.5 rounded border border-amber-200 bg-white px-1.5 py-1">
          <span className="shrink-0 text-[10px] font-medium text-amber-900">체크 항목 일괄 적용</span>
          <div className="relative min-w-[8rem] flex-1">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
              세로 간격
            </span>
            <PositionSpacingDeferredInput
              value={positionSpacingBulkGapY}
              onCommit={onBulkGapCommit}
              className={`h-7 pl-[52px] pr-6 text-[11px] ${
                positionSpacingBulkGapError
                  ? 'v106-position-spacing-input-error border-red-500 bg-red-50 text-red-700 focus-visible:ring-red-500'
                  : ''
              }`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
              px
            </span>
          </div>
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center justify-center rounded border border-amber-300 bg-amber-100 px-2 text-[11px] font-medium text-amber-950 hover:bg-amber-200"
            onClick={onApplyBulkGap}
          >
            적용
          </button>
        </div>
        {positionSpacingSettingRelations.length > 0 || positionSpacingNewPairSummaries.length > 0 ? (
          <div className="max-h-[13.5rem] space-y-1 overflow-y-auto pr-1">
            {positionSpacingSettingRelations.map((relation) => {
              const displayRow = positionSpacingSettingRelationDisplayRows.find((row) => row.key === relation.key);
              const relationDraft = definedPositionRelationGapDraftByKey[relation.key] || {
                gapY: String(Math.round(relation.gapYPx)),
              };
              const isHighlighted = highlightedPositionSpacingSettingRelationKeySet.has(relation.key);
              const anchorEntityKey =
                relation.anchorKind === 'group' ? `group:${relation.anchorGroupId}` : `frame:${relation.anchorFrameGroupId}`;
              const targetEntityKey =
                relation.targetKind === 'group'
                  ? `group:${relation.targetGroupId}`
                  : `frame:${relation.targetFrameGroupIds.find((frameGroupId: string) => Boolean(frameGroupId.trim())) || ''}`;
              const anchorVisual = positionSpacingEntityVisualByKey.get(anchorEntityKey);
              const targetVisual = positionSpacingEntityVisualByKey.get(targetEntityKey);
              const rowKey = `existing:${relation.key}`;

              return (
                <div
                  key={relation.key}
                  role="button"
                  tabIndex={0}
                  className={`flex items-center gap-1.5 overflow-x-auto whitespace-nowrap rounded border bg-white px-1.5 py-1 text-[11px] transition ${
                    isHighlighted ? 'border-amber-500 text-amber-950' : 'border-slate-200 text-slate-700 hover:border-amber-300'
                  }`}
                  onClick={() => onExistingRelationSelect(relation)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                      return;
                    }
                    event.preventDefault();
                    onExistingRelationSelect(relation);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(positionSpacingCheckedRowKeys[rowKey])}
                    onChange={(event) => {
                      onCheckedRowChange(rowKey, event.target.checked);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                    aria-label={`${displayRow?.anchorLabel || relation.anchorLabel}에서 ${displayRow?.targetLabel || relation.targetLabel} 간격 선택`}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                    <span
                      className="inline-flex max-w-[9rem] items-center truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: anchorVisual?.badgeColor || 'rgba(15, 23, 42, .92)',
                        color: anchorVisual?.badgeTextColor || '#fff',
                      }}
                    >
                      {displayRow?.anchorLabel || relation.anchorLabel}
                    </span>
                    <span className="shrink-0">→</span>
                    <span
                      className="inline-flex max-w-[9rem] items-center truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: targetVisual?.badgeColor || 'rgba(15, 23, 42, .92)',
                        color: targetVisual?.badgeTextColor || '#fff',
                      }}
                    >
                      {displayRow?.targetLabel || relation.targetLabel}
                    </span>
                  </div>
                  <div className="relative w-44 shrink-0" onClick={(event) => event.stopPropagation()}>
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                      세로 간격
                    </span>
                    <PositionSpacingDeferredInput
                      value={relationDraft.gapY}
                      onCommit={(nextGapY) => {
                        onExistingRelationGapCommit(relation, nextGapY);
                      }}
                      className="h-7 pl-[52px] pr-6 text-[11px]"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                      px
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-red-200 bg-white text-red-600 hover:bg-red-50"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onExistingRelationDelete(relation);
                    }}
                    aria-label={`${displayRow?.targetLabel || relation.targetLabel} 간격 설정 삭제`}
                    title="간격 설정 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {positionSpacingNewPairSummaries.map((pair) => {
              const pairDraft = positionSpacingDraftByPairKey[pair.pairKey] || { gapY: '' };
              const anchorVisual = positionSpacingEntityVisualByKey.get(`selection:${pair.anchorGroupId}`);
              const targetVisual = positionSpacingEntityVisualByKey.get(`selection:${pair.targetGroupId}`);
              const hasDraftError = Boolean(positionSpacingDraftErrorByPairKey[pair.pairKey]);
              const rowKey = `new:${pair.pairKey}`;

              return (
                <div
                  key={`new:${pair.pairKey}`}
                  className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap rounded border border-dashed border-amber-300 bg-white px-1.5 py-1 text-[11px] text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(positionSpacingCheckedRowKeys[rowKey])}
                    onChange={(event) => {
                      onCheckedRowChange(rowKey, event.target.checked);
                    }}
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                    aria-label={`${pair.anchorLabel}에서 ${pair.targetLabel} 신규 간격 선택`}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                    <span
                      className="inline-flex max-w-[9rem] items-center truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: anchorVisual?.badgeColor || 'rgba(15, 23, 42, .92)',
                        color: anchorVisual?.badgeTextColor || '#fff',
                      }}
                    >
                      {pair.anchorLabel}
                    </span>
                    <span className="shrink-0">→</span>
                    <span
                      className="inline-flex max-w-[9rem] items-center truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: targetVisual?.badgeColor || 'rgba(15, 23, 42, .92)',
                        color: targetVisual?.badgeTextColor || '#fff',
                      }}
                    >
                      {pair.targetLabel}
                    </span>
                  </div>
                  <div className="relative w-44 shrink-0">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                      세로 간격
                    </span>
                    <PositionSpacingDeferredInput
                      value={pairDraft.gapY}
                      onCommit={(nextGapY) => {
                        onNewPairGapCommit(pair, nextGapY);
                      }}
                      placeholder={String(Math.round(Math.max(0, pair.defaultGapY)))}
                      className={`h-7 pl-[52px] pr-6 text-[11px] ${
                        hasDraftError
                          ? 'v106-position-spacing-input-error border-red-500 bg-red-50 text-red-700 focus-visible:ring-red-500'
                          : ''
                      }`}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                      px
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    onClick={() => onNewPairApply(pair)}
                    aria-label={`${pair.anchorLabel}에서 ${pair.targetLabel} 새 간격 저장`}
                    title="새 간격 저장"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded border border-amber-200 bg-white px-2 py-1 text-[11px] text-amber-800">
            아직 설정된 상자/그룹 간격이 없습니다.
          </div>
        )}
      </div>
    </div>
  </CardContent>
);
