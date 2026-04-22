import { NextResponse } from 'next/server';
import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfPipelineTrace,
  TemplateExtractReplicaQualityReport,
} from '../../../../../../lib/templateExtractDtos';
import { TemplateExtractLogService } from '../../../../../../services/templateExtractLogService';

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

type DraftLogRequestBody = {
  sourceTitle?: string | null;
  sourceKind?: 'html' | 'text';
  engineVersion?: TemplateExtractEngineVersion | 'unknown';
  sourceContent?: string;
  generatedDraftHtml?: string | null;
  pipelineTrace?: TemplateExtractPdfPipelineTrace | null;
  qualityReport?: TemplateExtractReplicaQualityReport | null;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { draftId } = await context.params;
    const body = (await request.json()) as DraftLogRequestBody;
    const normalizedDraftId = draftId.trim();

    if (!normalizedDraftId) {
      throw new Error('로그 저장 실패: draftId가 필요합니다.');
    }

    const outputHtml = String(body.sourceContent || '').trim();

    if (!outputHtml) {
      throw new Error('로그 저장 실패: 기록할 output HTML이 없습니다.');
    }

    const result = await TemplateExtractLogService.writeDraftSummaryLog({
      draftId: normalizedDraftId,
      sourceTitle: body.sourceTitle?.trim() || null,
      sourceKind: body.sourceKind === 'text' ? 'text' : 'html',
      engineVersion: body.pipelineTrace?.engineVersion || body.engineVersion || 'unknown',
      outputHtml,
      generatedDraftHtml: body.generatedDraftHtml || null,
      pipelineTrace: body.pipelineTrace || null,
      qualityReport: body.qualityReport || null,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract Draft Log POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
