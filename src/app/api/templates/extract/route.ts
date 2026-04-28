import { NextResponse } from 'next/server';
import type {
  TemplateExtractExtractionStage,
  TemplateExtractFrameGroupVersion,
  TemplateExtractFrameTextMode,
  TemplateExtractImageFrameTextVersion,
  TemplateExtractNonImageFrameTextVersion,
} from '../../../../lib/templateExtractDtos';
import {
  toLegacyTemplateExtractFrameGroupVersion,
  toPublicTemplateExtractFrameGroupVersion,
} from '../../../../lib/templateExtractDtos';
import {
  TemplateExtractFrameFinalHtmlService,
  type TemplateExtractFrameTextDecision,
} from '../../../../services/templateExtractFrameFinalHtmlService';
import { TemplateExtractService } from '../../../../services/templateExtractService';
import { TemplateExtractVersionService } from '../../../../services/templateExtractVersionService';

const normalizeExtractionStage = (value: unknown): TemplateExtractExtractionStage =>
  value === 'frames' ? 'frames' : 'full';

const normalizeFrameGroupVersion = (value: unknown): TemplateExtractFrameGroupVersion => {
  const normalized = String(toLegacyTemplateExtractFrameGroupVersion(String(value || '').trim().toLowerCase()) || '');

  if (
    normalized === 'v1.01' ||
    normalized === 'v1.02' ||
    normalized === 'v1.03' ||
    normalized === 'v1.04' ||
    normalized === 'v1.05' ||
    normalized === 'v1.06' ||
    normalized === 'v1.07' ||
    normalized === 'v1.08' ||
    normalized === 'v1.09' ||
    normalized === 'v1.10' ||
    normalized === 'v1.11'
  ) {
    return toPublicTemplateExtractFrameGroupVersion(normalized) as TemplateExtractFrameGroupVersion;
  }

  if (/^v1\.09-[0-9a-z._\-\u3131-\u318e\uac00-\ud7a3]+$/i.test(normalized)) {
    return toPublicTemplateExtractFrameGroupVersion(normalized) as TemplateExtractFrameGroupVersion;
  }

  if (/^v1\.10-[0-9a-z._\-\u3131-\u318e\uac00-\ud7a3]+$/i.test(normalized)) {
    return toPublicTemplateExtractFrameGroupVersion(normalized) as TemplateExtractFrameGroupVersion;
  }

  if (/^v1\.11-[0-9a-z._\-\u3131-\u318e\uac00-\ud7a3]+$/i.test(normalized)) {
    return toPublicTemplateExtractFrameGroupVersion(normalized) as TemplateExtractFrameGroupVersion;
  }

  return 'fv1.11-default';
};

const getFileExtension = (fileName: string) => {
  const matched = String(fileName || '')
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);

  return matched?.[1] || '';
};

const isPdfUpload = (fileName: string, mimeType: string) => {
  const extension = getFileExtension(fileName);
  return mimeType === 'application/pdf' || extension === 'pdf';
};

const normalizeFrameTextExtractionMode = (value: unknown): TemplateExtractFrameTextMode | null => {
  switch (String(value || '').trim().toLowerCase()) {
    case 'image':
      return 'image';
    case 'non_image':
      return 'non_image';
    default:
      return null;
  }
};

const normalizeFrameTextExtractionVersion = (value: unknown): TemplateExtractNonImageFrameTextVersion => {
  switch (String(value || '').trim()) {
    case 'niv1.01':
    case 'niv1.02':
    case 'niv1.12':
      return String(value).trim() as TemplateExtractNonImageFrameTextVersion;
    default:
      return 'niv1.12';
  }
};

const normalizeImageFrameTextExtractionVersion = (value: unknown): TemplateExtractImageFrameTextVersion => {
  switch (String(value || '').trim()) {
    case 'iv3.00':
    case 'iv2.04':
    case 'iv2.03':
    case 'iv2.02':
    case 'iv2.01':
    case 'iv2.00':
    case 'iv1.00':
      return String(value).trim() as TemplateExtractImageFrameTextVersion;
    default:
      return 'iv1.00';
  }
};

const resolveFrameTextDecision = (source: {
  frameTextExtractionMode?: unknown;
  mode?: unknown;
  frameTextExtractionVersion?: unknown;
  imageFrameTextExtractionVersion?: unknown;
  imageOcrVersion?: unknown;
}): TemplateExtractFrameTextDecision | null => {
  const explicitMode =
    normalizeFrameTextExtractionMode(source.frameTextExtractionMode) ||
    normalizeFrameTextExtractionMode(source.mode);
  const hasNonImageVersion = Boolean(String(source.frameTextExtractionVersion || '').trim());
  const hasImageVersion = Boolean(
    String(source.imageFrameTextExtractionVersion || source.imageOcrVersion || '').trim()
  );
  const mode =
    explicitMode ||
    (hasImageVersion ? 'image' : hasNonImageVersion ? 'non_image' : null);

  if (!mode) {
    return null;
  }

  if (mode === 'image') {
    return {
      mode,
      imageFrameTextExtractionVersion: normalizeImageFrameTextExtractionVersion(
        source.imageFrameTextExtractionVersion || source.imageOcrVersion
      ),
    };
  }

  return {
    mode,
    frameTextExtractionVersion: normalizeFrameTextExtractionVersion(source.frameTextExtractionVersion),
  };
};

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let draft;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        throw new Error('템플릿 추출 실패: 업로드할 파일이 필요합니다.');
      }

      const engineVersion = TemplateExtractVersionService.normalizeVersion(formData.get('engineVersion'));
      const requestedExtractionStage = normalizeExtractionStage(formData.get('extractionStage'));
      const frameGroupVersion = normalizeFrameGroupVersion(formData.get('frameGroupVersion'));
      const frameTextDecision = resolveFrameTextDecision({
        frameTextExtractionMode: formData.get('frameTextExtractionMode'),
        mode: formData.get('mode'),
        frameTextExtractionVersion: formData.get('frameTextExtractionVersion'),
        imageFrameTextExtractionVersion: formData.get('imageFrameTextExtractionVersion'),
        imageOcrVersion: formData.get('imageOcrVersion'),
      });
      const uploadedBytes = new Uint8Array(await file.arrayBuffer());
      const shouldApplyFrameTextDecision =
        Boolean(frameTextDecision) && isPdfUpload(file.name, file.type || 'application/octet-stream');
      const extractionStage =
        shouldApplyFrameTextDecision && requestedExtractionStage !== 'frames'
          ? 'frames'
          : requestedExtractionStage;

      let resolvedSource = await TemplateExtractVersionService.resolveUploadSource(
        file.name,
        file.type || 'application/octet-stream',
        uploadedBytes,
        engineVersion,
        extractionStage,
        frameGroupVersion
      );

      if (shouldApplyFrameTextDecision && frameTextDecision) {
        resolvedSource = await TemplateExtractFrameFinalHtmlService.applyToResolvedSource(
          file.name,
          uploadedBytes,
          resolvedSource,
          frameTextDecision
        );
      }

      draft = await TemplateExtractService.createDraftFromResolvedSource(
        {
          ...resolvedSource,
          sourceTitle: String(formData.get('sourceTitle') || '').trim() || resolvedSource.sourceTitle,
        },
        String(formData.get('similarTemplateIds') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      );
    } else {
      const body = await request.json();
      draft = await TemplateExtractService.createDraft({
        ...body,
        engineVersion: TemplateExtractVersionService.normalizeVersion(body?.engineVersion),
        extractionStage: normalizeExtractionStage(body?.extractionStage),
        frameGroupVersion: normalizeFrameGroupVersion(body?.frameGroupVersion),
      });
    }

    return NextResponse.json({ success: true, data: draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
