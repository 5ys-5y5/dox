'use client';

import * as React from 'react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import {
  FRAME_BOX_KIND_ACTIVE_BUTTON_CLASSES,
  FRAME_BOX_KIND_BUTTON_LABELS,
  FRAME_ROLE_ACTIVE_BUTTON_CLASSES,
  FRAME_ROLE_SHORT_LABELS,
  FRAME_RUNTIME_MODE_LABELS,
  TEMPLATE_FRAME_BOX_KIND_OPTIONS,
  TEMPLATE_FRAME_ROLE_OPTIONS,
} from '../constants';

type MetadataNameOverlayProps = {
  selectionValidationIssues: Array<{ frameGroupId: string; message: string }>;
  hasSelectedMetadataTarget: boolean;
  frameMetadataDraft: { label: string };
  selectedFrameGroupIds: string[];
  onLabelChange: (nextLabel: string) => void;
};

export const MetadataNameOverlay = ({
  selectionValidationIssues,
  hasSelectedMetadataTarget,
  frameMetadataDraft,
  selectedFrameGroupIds,
  onLabelChange,
}: MetadataNameOverlayProps) => (
  <div className="space-y-3">
    {selectionValidationIssues.length > 0 ? (
      <div className="text-xs text-rose-950">
        <div className="font-semibold">메타데이터 설정 오류</div>
        <div className="mt-1 text-[11px] leading-5">빨간색으로 표시된 상자는 아래 사유로 메타데이터를 반영할 수 없습니다.</div>
        <ul className="mt-2 space-y-1 text-[11px] leading-5">
          {selectionValidationIssues.slice(0, 5).map((issue, index) => (
            <li key={`metadata-canvas-validation:${issue.frameGroupId}:${index}`}>{issue.message}</li>
          ))}
        </ul>
        {selectionValidationIssues.length > 5 ? (
          <div className="mt-1 text-[11px] font-medium">외 {selectionValidationIssues.length - 5}개 오류</div>
        ) : null}
      </div>
    ) : null}
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-800">상자명</label>
        <Input
          data-metadata-field="label"
          value={hasSelectedMetadataTarget ? frameMetadataDraft.label : ''}
          disabled={!hasSelectedMetadataTarget || selectedFrameGroupIds.length !== 1}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder={
            hasSelectedMetadataTarget
              ? selectedFrameGroupIds.length === 1
                ? selectedFrameGroupIds[0] || '상자 ID'
                : '상자 1개만 선택하면 수정할 수 있습니다'
              : '상자를 선택하세요'
          }
          className="h-9 bg-white text-sm"
        />
        <div className="text-[11px] leading-4 text-slate-600">
          비워두면 상자 ID를 이름으로 사용합니다. 상자 안의 예시 텍스트는 이름으로 사용하지 않습니다.
        </div>
      </div>
    </div>
  </div>
);

type MetadataRolePrimaryOverlayProps = {
  hasSelectedMetadataTarget: boolean;
  displayedMetadataBoxKinds: Set<string>;
  frameMetadataDraft: { runtimeMode: string };
  runtimeModeOptions: string[];
  displayedRuntimeModeLabels: string[];
  frameRuntimeModeHelpText: string;
  onStageMetadataBoxKind: (boxKind: any) => void;
  onRuntimeModeChange: (runtimeMode: string) => void;
};

export const MetadataRolePrimaryOverlay = ({
  hasSelectedMetadataTarget,
  displayedMetadataBoxKinds,
  frameMetadataDraft,
  runtimeModeOptions,
  displayedRuntimeModeLabels,
  frameRuntimeModeHelpText,
  onStageMetadataBoxKind,
  onRuntimeModeChange,
}: MetadataRolePrimaryOverlayProps) => (
  <div className="space-y-3">
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATE_FRAME_BOX_KIND_OPTIONS.map((boxKind) => {
          const isActive = hasSelectedMetadataTarget && displayedMetadataBoxKinds.has(boxKind);

          return (
            <button
              key={`metadata-canvas-box-kind:${boxKind}`}
              type="button"
              disabled={!hasSelectedMetadataTarget}
              onClick={() => onStageMetadataBoxKind(boxKind)}
              className={`min-h-9 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? FRAME_BOX_KIND_ACTIVE_BUTTON_CLASSES[boxKind]
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
              }`}
            >
              {FRAME_BOX_KIND_BUTTON_LABELS[boxKind]}
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-800">상세 기능</label>
        <select
          value={hasSelectedMetadataTarget ? frameMetadataDraft.runtimeMode : ''}
          disabled={!hasSelectedMetadataTarget}
          onChange={(event) => onRuntimeModeChange(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{hasSelectedMetadataTarget ? '혼합 / 자동 기본값 사용' : '-'}</option>
          {runtimeModeOptions.map((runtimeMode) => (
            <option key={`metadata-canvas-runtime:${runtimeMode}`} value={runtimeMode}>
              {FRAME_RUNTIME_MODE_LABELS[runtimeMode]}
            </option>
          ))}
        </select>
        {hasSelectedMetadataTarget && displayedRuntimeModeLabels.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {displayedRuntimeModeLabels.map((label) => (
              <span
                key={`metadata-selected-runtime-mode:${label}`}
                className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        <div className="text-[11px] leading-4 text-slate-600">
          {hasSelectedMetadataTarget && displayedRuntimeModeLabels.length > 1
            ? `선택된 상세 기능 ${displayedRuntimeModeLabels.length}개가 함께 표시됩니다.`
            : frameRuntimeModeHelpText}
        </div>
      </div>
    </div>
  </div>
);

type MetadataRoleSecondaryOverlayProps = {
  hasSelectedMetadataTarget: boolean;
  displayedMetadataRoles: Set<string>;
  onStageMetadataRole: (role: any) => void;
};

export const MetadataRoleSecondaryOverlay = ({
  hasSelectedMetadataTarget,
  displayedMetadataRoles,
  onStageMetadataRole,
}: MetadataRoleSecondaryOverlayProps) => (
  <div className="space-y-3">
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATE_FRAME_ROLE_OPTIONS.map((role) => {
          const isActive = hasSelectedMetadataTarget && displayedMetadataRoles.has(role);

          return (
            <button
              key={`metadata-canvas-role:${role}`}
              type="button"
              disabled={!hasSelectedMetadataTarget}
              onClick={() => onStageMetadataRole(role)}
              className={`min-h-9 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? FRAME_ROLE_ACTIVE_BUTTON_CLASSES[role]
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
              }`}
            >
              {FRAME_ROLE_SHORT_LABELS[role]}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

type MetadataRoleTertiaryOverlayProps = {
  metadataConnectionReasonLines: string[];
  metadataVirtualConnectionDraft: any;
  metadataRelationSelectionMode: any;
  metadataConnectionPickerOpen: boolean;
  metadataConnectionCtaState: { disabled: boolean; label: string };
  selectedMetadataValueConnectionOptions: any[];
  metadataConnectionPickerDisplayOptions: any[];
  metadataVirtualConnectionSuggestions: any[];
  onApplySelectionMetadataDraft: () => void;
  onApplySelectedMetadataBoxConnection: () => void;
  onRemoveMetadataValueConnectionTarget: (id: string) => void;
  onSetMetadataConnectionPickerOpen: (open: boolean) => void;
  onConnectionLabelChange: (nextLabel: string) => void;
  onConnectionLabelBlur: () => void;
  onConnectionIdChange: (nextId: string) => void;
  onConnectionIdBlur: () => void;
  onApplyMetadataConnectionSuggestion: (option: any) => void;
  onCancelVirtualConnection: () => void;
  onSaveVirtualConnection: () => void;
};

export const MetadataRoleTertiaryOverlay = ({
  metadataConnectionReasonLines,
  metadataVirtualConnectionDraft,
  metadataRelationSelectionMode,
  metadataConnectionPickerOpen,
  metadataConnectionCtaState,
  selectedMetadataValueConnectionOptions,
  metadataConnectionPickerDisplayOptions,
  metadataVirtualConnectionSuggestions,
  onApplySelectionMetadataDraft,
  onApplySelectedMetadataBoxConnection,
  onRemoveMetadataValueConnectionTarget,
  onSetMetadataConnectionPickerOpen,
  onConnectionLabelChange,
  onConnectionLabelBlur,
  onConnectionIdChange,
  onConnectionIdBlur,
  onApplyMetadataConnectionSuggestion,
  onCancelVirtualConnection,
  onSaveVirtualConnection,
}: MetadataRoleTertiaryOverlayProps) => (
  <div className="space-y-3">
    <div className="space-y-1 text-[11px] font-medium leading-4 text-slate-700">
      {metadataConnectionReasonLines.map((line, index) => (
        <div key={`metadata-connection-reason:${index}`}>{line}</div>
      ))}
    </div>
    <div className="space-y-2">
      <div>
        {metadataVirtualConnectionDraft.mode === 'idle' ? (
          metadataRelationSelectionMode.kind !== 'idle' ? (
            <Button
              type="button"
              className="w-full"
              onClick={onApplySelectionMetadataDraft}
              disabled={
                metadataRelationSelectionMode.kind === 'parent' ||
                (metadataRelationSelectionMode.kind === 'value' &&
                  metadataRelationSelectionMode.targetFrameGroupIds.length <= 0)
              }
            >
              {metadataRelationSelectionMode.kind === 'parent'
                ? 'key 상자 1개를 선택하세요'
                : metadataRelationSelectionMode.targetFrameGroupIds.length > 0
                  ? '박스 연결 반영'
                  : 'value 상자를 선택하세요'}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={onApplySelectedMetadataBoxConnection}
              disabled={metadataConnectionCtaState.disabled}
            >
              {metadataConnectionCtaState.label}
            </Button>
          )
        ) : (
          <div className="space-y-2 text-amber-900">
            <div className="text-[11px] font-semibold text-amber-900">
              {metadataVirtualConnectionDraft.mode === 'key'
                ? metadataRelationSelectionMode.kind === 'parent'
                  ? `선택된 하위 값 ${metadataRelationSelectionMode.sourceFrameGroupIds.length}개를 연결할 상위 키 상자 1개를 캔버스에서 선택하거나 이름으로 찾은 뒤 저장하세요.`
                  : '기존 key 상자를 선택하거나 새 key 정의를 입력한 뒤 저장합니다.'
                : metadataRelationSelectionMode.kind === 'value'
                  ? `현재 key 상자 ${metadataRelationSelectionMode.sourceKeyFrameGroupId}에 연결할 하위 값 상자를 선택하거나 이름으로 찾은 뒤 저장하세요. 이미 선택된 상자는 다시 클릭하면 해제됩니다.`
                  : '기존 value 상자를 선택하거나 새 입력값 정의를 입력한 뒤 저장합니다.'}
            </div>
            {selectedMetadataValueConnectionOptions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedMetadataValueConnectionOptions.map((option) => (
                  <span
                    key={`metadata-selected-value-target:${option.source}:${option.id}`}
                    className="inline-flex max-w-[110px] items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-950"
                    title={`${option.label} (${option.id})`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-amber-700 hover:bg-amber-100"
                      aria-label={`${option.label} 선택 해제`}
                      onClick={() => onRemoveMetadataValueConnectionTarget(option.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative">
              <Input
                value={metadataVirtualConnectionDraft.label}
                onFocus={() => onSetMetadataConnectionPickerOpen(true)}
                onChange={(event) => onConnectionLabelChange(event.target.value)}
                onBlur={onConnectionLabelBlur}
                placeholder={metadataVirtualConnectionDraft.mode === 'key' ? '키 상자명 입력' : '입력값 상자명 입력'}
                className={metadataVirtualConnectionDraft.error && !metadataVirtualConnectionDraft.label.trim() ? 'border-red-500' : ''}
              />
              {metadataConnectionPickerOpen ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-amber-200 bg-white py-1 text-[11px] text-amber-950">
                  {metadataConnectionPickerDisplayOptions.length > 0 ? (
                    metadataConnectionPickerDisplayOptions.map((option) => {
                      const isRecommended = metadataVirtualConnectionSuggestions.some(
                        (suggestion) => suggestion.source === option.source && suggestion.id === option.id
                      );
                      const isSelected =
                        metadataVirtualConnectionDraft.mode === 'value' &&
                        metadataRelationSelectionMode.kind === 'value' &&
                        metadataRelationSelectionMode.targetFrameGroupIds.includes(option.id);

                      return (
                        <div
                          key={`metadata-connection-picker:${option.source}:${option.id}`}
                          role="button"
                          tabIndex={0}
                          className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-amber-50 ${
                            isSelected ? 'bg-amber-100' : ''
                          }`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => onApplyMetadataConnectionSuggestion(option)}
                          title={`${option.label} (${option.id})`}
                        >
                          <span className="min-w-0 truncate">
                            {option.label}
                            <span className="ml-1 text-amber-700">({option.id})</span>
                          </span>
                          {isSelected ? (
                            <span className="flex shrink-0 items-center gap-1">
                              <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] text-white">선택됨</span>
                              <button
                                type="button"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-700 hover:bg-slate-200"
                                aria-label={`${option.label} 선택 해제`}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveMetadataValueConnectionTarget(option.id);
                                }}
                              >
                                ×
                              </button>
                            </span>
                          ) : isRecommended || option.source === 'shared' ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                              {isRecommended ? '추천' : '공유'}
                            </span>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-2 py-2 text-amber-800">일치하는 상자가 없습니다.</div>
                  )}
                </div>
              ) : null}
            </div>
            <Input
              value={metadataVirtualConnectionDraft.id}
              onFocus={() => onSetMetadataConnectionPickerOpen(true)}
              onChange={(event) => onConnectionIdChange(event.target.value)}
              onBlur={onConnectionIdBlur}
              placeholder={metadataVirtualConnectionDraft.mode === 'key' ? '키 상자 아이디 입력' : '입력값 상자 아이디 입력'}
              className={metadataVirtualConnectionDraft.error ? 'border-red-500 bg-red-50' : ''}
            />
            {metadataVirtualConnectionDraft.error ? (
              <div className="text-[11px] font-medium text-red-700">{metadataVirtualConnectionDraft.error}</div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={onCancelVirtualConnection}>
                취소
              </Button>
              <Button type="button" onClick={onSaveVirtualConnection}>
                저장
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
