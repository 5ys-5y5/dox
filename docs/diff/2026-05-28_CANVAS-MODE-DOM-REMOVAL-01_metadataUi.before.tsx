'use client';

import { CircleDot, CornerDownRight, FileText, KeyRound, Minus, Paperclip, Signature } from 'lucide-react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import type { TemplateFrameBoxKind, TemplateFrameRole, TemplateFrameRuntimeMode } from '../../../../lib/templateFrameEditDtos';
import { FRAME_BOX_KIND_MARKER_LABELS, FRAME_ROLE_SHORT_LABELS, NULL_MARKER_LABEL } from '../constants';

const FrameKindIcon = ({
  boxKind,
  className = '',
  strokeWidth = 2.15,
}: {
  boxKind: TemplateFrameBoxKind | '';
  className?: string;
  strokeWidth?: number;
}) => {
  const IconComponent =
    boxKind === 'text' ? FileText : boxKind === 'attachment' ? Paperclip : boxKind === 'signature' ? Signature : Minus;
  return <IconComponent aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
};

const FrameRoleIcon = ({
  role,
  className = '',
  strokeWidth = 2.15,
}: {
  role: TemplateFrameRole | 'group' | '';
  className?: string;
  strokeWidth?: number;
}) => {
  const IconComponent =
    role === 'key'
      ? KeyRound
      : role === 'value'
        ? CornerDownRight
        : role === 'key_value' || role === 'group'
          ? CircleDot
          : Minus;
  return <IconComponent aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
};

const FrameMetadataMarker = ({
  boxKind,
  role,
  compact = false,
}: {
  boxKind: TemplateFrameBoxKind | '';
  role: TemplateFrameRole | 'group' | '';
  compact?: boolean;
}) => (
  <span className="v106-frame-kind-marker__stack" aria-hidden="true">
    <span
      className="v106-frame-kind-marker__pill"
      data-marker-pill="kind"
      data-marker-icon="kind"
      data-box-kind={boxKind || 'null'}
    >
      <span className="v106-frame-kind-marker__icon">
        <FrameKindIcon boxKind={boxKind} className="h-3 w-3" />
      </span>
      {!compact ? (
        <span className="v106-frame-kind-marker__text">
          {boxKind ? FRAME_BOX_KIND_MARKER_LABELS[boxKind] : NULL_MARKER_LABEL}
        </span>
      ) : null}
    </span>
    <span
      className="v106-frame-kind-marker__pill"
      data-marker-pill="role"
      data-marker-icon="role"
      data-frame-role={role || 'null'}
    >
      <span className="v106-frame-kind-marker__icon">
        <FrameRoleIcon role={role} className="h-3 w-3" />
      </span>
      {!compact ? (
        <span className="v106-frame-kind-marker__text">
          {role ? FRAME_ROLE_SHORT_LABELS[role] : NULL_MARKER_LABEL}
        </span>
      ) : null}
    </span>
  </span>
);

export const renderFrameMetadataMarkerMarkup = (
  boxKind: TemplateFrameBoxKind | '',
  role: TemplateFrameRole | 'group' | '',
  compact = false
) => renderToStaticMarkup(<FrameMetadataMarker boxKind={boxKind} role={role} compact={compact} />);

export const confirmPromoteRuntimeMode = (
  frameGroupId: string,
  currentRuntimeMode: string,
  nextRuntimeMode: TemplateFrameRuntimeMode
) => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.confirm(
    `${frameGroupId} 의 runtime mode ${currentRuntimeMode} 는 현재 상자 타입과 호환되지 않습니다.\n` +
      `호환 가능한 runtime mode(${nextRuntimeMode})로 변경할까요?`
  );
};

export const MetadataCanvasLegend = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">범례</div>
    <div className="mt-2 grid gap-2 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Box Kind</div>
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="text" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-teal-700" />
            <span>텍스트 상자</span>
          </div>
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="attachment" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-amber-700" />
            <span>첨부파일 상자</span>
          </div>
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="signature" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-rose-700" />
            <span>서명 상자</span>
          </div>
          <div className="flex items-center gap-2">
            <FrameKindIcon boxKind="" className="inline-flex h-4 w-4 items-center justify-center text-base leading-none text-slate-500" />
            <span>null (미지정)</span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Role</div>
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <FrameRoleIcon role="key" className="h-3.5 w-3.5" />
            </span>
            <span>상위 키</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-sky-50 text-sky-700 ring-1 ring-sky-200">
              <FrameRoleIcon role="value" className="h-3.5 w-3.5" />
            </span>
            <span>하위 값</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <FrameRoleIcon role="key_value" className="h-3.5 w-3.5" />
            </span>
            <span>독립 값</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-300">
              <FrameRoleIcon role="" className="h-3.5 w-3.5" />
            </span>
            <span>null (미지정)</span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">관계 강조</div>
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border border-slate-300 opacity-50" />
            <span>기본 연결 상태</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border-2 border-slate-700" />
            <span>현재 선택 관계군</span>
          </div>
          <div className="text-[10px] leading-4 text-slate-500">
            같은 그룹의 key/value 상자는 선택 시 함께 선명해집니다.
          </div>
        </div>
      </div>
    </div>
  </div>
);
