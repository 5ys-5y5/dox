'use client';

import * as React from 'react';
import { Badge } from './Badge';
import { Card } from './Card';
import { Divider } from './Divider';
import { EntityPicker } from './EntityPicker';
import { OwnerLoadingState } from './OwnerLoadingState';
import { OwnerPanelShell } from './OwnerPanelShell';
import { OptionButtonGroup } from './OptionButtonGroup';
import {
  OwnerSettingsActionBar,
  OwnerSettingsManagedTargetControls,
  OwnerSettingsSectionHeader,
  OwnerSettingsTabList,
} from './OwnerSettingsLayout';
import { SettingToggleRow } from './SettingToggleRow';
import { cn } from '../../lib/utils';

type OwnerSharedUiPreviewItemAttributes = (item: string, name: string) => Record<string, string>;

type OwnerSharedUiPreviewProps = {
  ownerLabel: string;
  itemAttributes: OwnerSharedUiPreviewItemAttributes;
  className?: string;
};

type OwnerSharedUiPreviewSectionProps = {
  ownerLabel: string;
  label: string;
  itemBase: string;
  itemAttributes: OwnerSharedUiPreviewItemAttributes;
  children: React.ReactNode;
};

const noop = () => {};
const noopBoolean = (_value: boolean) => {};
const noopString = (_value: string) => {};

function OwnerSharedUiPreviewSection({
  ownerLabel,
  label,
  itemBase,
  itemAttributes,
  children,
}: OwnerSharedUiPreviewSectionProps) {
  return (
    <section className="space-y-3" {...itemAttributes(`${itemBase}-preview`, `${label} 미리보기 영역`)}>
      <Divider
        label={`${ownerLabel} · ${label}`}
        className="py-0"
        {...itemAttributes(`${itemBase}-preview-divider`, `${label} 미리보기 구분선`)}
      />
      <Card className="border-slate-200" {...itemAttributes(`${itemBase}-preview-panel`, `${label} 미리보기 패널`)}>
        <OwnerPanelShell {...itemAttributes(`${itemBase}-preview-content`, `${label} 미리보기 내용`)}>
          {children}
        </OwnerPanelShell>
      </Card>
    </section>
  );
}

export function OwnerSharedUiPreview({
  ownerLabel,
  itemAttributes,
  className,
}: OwnerSharedUiPreviewProps) {
  return (
    <div
      className={cn('space-y-5', className)}
      {...itemAttributes('owner-settings-reusable-ui-preview', 'owner 공용 UI 미리보기 묶음')}
    >
      <OwnerSharedUiPreviewSection
        ownerLabel={ownerLabel}
        label="로딩 UI 확인"
        itemBase="owner-settings-loading"
        itemAttributes={itemAttributes}
      >
        <OwnerLoadingState
          itemAttributes={itemAttributes}
          stateItemKey="owner-settings-loading-preview-state"
          stateItemName="로딩 UI 확인 상태"
          titleItemKey="owner-settings-loading-preview-title"
          titleItemName="로딩 UI 확인 제목"
          descriptionItemKey="owner-settings-loading-preview-description"
          descriptionItemName="로딩 UI 확인 설명"
        />
      </OwnerSharedUiPreviewSection>

      <OwnerSharedUiPreviewSection
        ownerLabel={ownerLabel}
        label="검색 셀렉트 박스"
        itemBase="owner-settings-entity-picker"
        itemAttributes={itemAttributes}
      >
        <EntityPicker
          value="canvas"
          options={[
            { id: 'canvas', label: '공용 캔버스', meta: '/canvas', keywords: ['canvas', 'owner'] },
            { id: 'project', label: '현장 관리', meta: '/project', keywords: ['project', 'site'] },
          ]}
          onChange={noopString}
          placeholder="항목 검색"
          searchPlaceholder="이름이나 경로 검색"
          optionLayout="stacked"
          ownerItemKey="owner-settings-entity-picker-control"
          ownerItemName="검색 셀렉트 박스 선택기"
          ownerItemAttributes={itemAttributes}
        />
      </OwnerSharedUiPreviewSection>

      <OwnerSharedUiPreviewSection
        ownerLabel={ownerLabel}
        label="상태 배지"
        itemBase="owner-settings-status-badge"
        itemAttributes={itemAttributes}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="green">저장됨</Badge>
          <Badge variant="amber">저장 전</Badge>
          <Badge variant="blue">선택</Badge>
          <Badge variant="slate">대상</Badge>
        </div>
      </OwnerSharedUiPreviewSection>

      <details
        className="group rounded-lg border border-slate-200 bg-white"
        {...itemAttributes('owner-settings-settings-only-ui-preview', '설정 화면 전용 UI 미리보기 묶음')}
      >
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 marker:hidden"
          {...itemAttributes('owner-settings-settings-only-ui-preview-toggle', '설정 화면 전용 UI 미리보기 펼치기 버튼')}
        >
          <span className="min-w-0">
            <span className="block truncate">{ownerLabel} · 설정 화면 전용 UI 확인</span>
            <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
              설정 페이지 안에서만 쓰는 UI 샘플을 펼쳐서 확인합니다.
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-slate-500 group-open:hidden">펼치기</span>
          <span className="hidden shrink-0 text-xs font-medium text-slate-500 group-open:inline">접기</span>
        </summary>

        <div
          className="space-y-5 border-t border-slate-200 p-4"
          {...itemAttributes('owner-settings-settings-only-ui-preview-content', '설정 화면 전용 UI 미리보기 펼침 내용')}
        >
          <OwnerSharedUiPreviewSection
            ownerLabel={ownerLabel}
            label="설정 저장 액션바"
            itemBase="owner-settings-action-bar"
            itemAttributes={itemAttributes}
          >
            <OwnerSettingsActionBar dirty onReset={noop} onSave={noop} />
          </OwnerSharedUiPreviewSection>

          <OwnerSharedUiPreviewSection
            ownerLabel={ownerLabel}
            label="관리 대상 리스트"
            itemBase="owner-settings-managed-target"
            itemAttributes={itemAttributes}
          >
            <OwnerSettingsManagedTargetControls
              value="canvas"
              targets={[
                {
                  value: 'canvas',
                  label: '공용 캔버스',
                  path: '/canvas',
                  description: '상자 편집 캔버스 owner 설정을 관리합니다.',
                  badge: <Badge variant="blue" className="px-2 py-0 text-[10px]">선택</Badge>,
                  detailRows: [
                    { label: 'surface', value: 'canvas' },
                    { label: 'settings', value: 'page-owned' },
                  ],
                },
              ]}
              onChange={noopString}
            />
          </OwnerSharedUiPreviewSection>

          <OwnerSharedUiPreviewSection
            ownerLabel={ownerLabel}
            label="섹션 헤더"
            itemBase="owner-settings-section-header"
            itemAttributes={itemAttributes}
          >
            <OwnerSettingsSectionHeader
              label="상자 편집 캔버스 연동"
              description="공용 owner 설정 항목을 구분합니다."
              count="3개"
              badge={<Badge variant="slate" className="px-2 py-0 text-[10px]">공용</Badge>}
            />
          </OwnerSharedUiPreviewSection>

          <OwnerSharedUiPreviewSection
            ownerLabel={ownerLabel}
            label="탭 리스트"
            itemBase="owner-settings-tab-list"
            itemAttributes={itemAttributes}
          >
            <OwnerSettingsTabList
              value="page"
              ariaLabel="공용 UI 탭 리스트 미리보기"
              options={[
                { value: 'page', label: '페이지' },
                { value: 'settings', label: '설정' },
              ]}
              onChange={noopString}
            />
          </OwnerSharedUiPreviewSection>

          <OwnerSharedUiPreviewSection
            ownerLabel={ownerLabel}
            label="설정 토글 행"
            itemBase="owner-settings-toggle-row"
            itemAttributes={itemAttributes}
          >
            <SettingToggleRow
              label="상자 캔버스 환경"
              sectionLabel="문서 기능"
              definitionName="applyStoredCanvasOwnerSettings"
              description="/canvas에 저장된 해당 페이지 캔버스 설정을 적용합니다."
              checked
              onCheckedChange={noopBoolean}
            />
          </OwnerSharedUiPreviewSection>

          <OwnerSharedUiPreviewSection
            ownerLabel={ownerLabel}
            label="옵션 버튼 그룹"
            itemBase="owner-settings-option-button-group"
            itemAttributes={itemAttributes}
          >
            <OptionButtonGroup
              value="metadata"
              options={[
                { value: 'position', label: '크기 및 위치' },
                { value: 'metadata', label: '속성' },
              ]}
              onChange={noopString}
            />
          </OwnerSharedUiPreviewSection>
        </div>
      </details>
    </div>
  );
}
