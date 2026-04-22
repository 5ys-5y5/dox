import { NextResponse } from 'next/server';
import type {
  TemplateExtractEngineVersion,
  TemplateExtractVisualSimilarityReport,
} from '../../../../../../lib/templateExtractDtos';
import { TemplateExtractMeasurementLogService } from '../../../../../../services/templateExtractMeasurementLogService';

type StartBody = {
  action: 'start';
  draftId?: string | null;
  sourceTitle?: string | null;
  sourceFileName?: string | null;
  engineVersion?: TemplateExtractEngineVersion | 'unknown' | null;
};

type AppendBody = {
  action: 'append';
  fileName: string;
  level?: 'info' | 'warn' | 'error';
  phase: string;
  percent?: number | null;
  stage?: string | null;
  detail?: string | null;
  payload?: unknown;
};

type FinalizeBody = {
  action: 'finalize';
  fileName: string;
  status: 'completed' | 'failed';
  summary?: string | null;
  errorMessage?: string | null;
  visualSimilarityReport?: TemplateExtractVisualSimilarityReport | null;
};

type RequestBody = StartBody | AppendBody | FinalizeBody;

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (body.action === 'start') {
      const result = await TemplateExtractMeasurementLogService.startSession({
        draftId: body.draftId || null,
        sourceTitle: body.sourceTitle || null,
        sourceFileName: body.sourceFileName || null,
        engineVersion: body.engineVersion || 'unknown',
      });

      return NextResponse.json({ success: true, data: result });
    }

    if (body.action === 'append') {
      await TemplateExtractMeasurementLogService.appendEvent({
        fileName: body.fileName,
        level: body.level || 'info',
        phase: body.phase,
        percent: body.percent ?? null,
        stage: body.stage ?? null,
        detail: body.detail ?? null,
        payload: body.payload,
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === 'finalize') {
      await TemplateExtractMeasurementLogService.finalizeSession({
        fileName: body.fileName,
        status: body.status,
        summary: body.summary || null,
        errorMessage: body.errorMessage || null,
        visualSimilarityReport: body.visualSimilarityReport || null,
      });

      return NextResponse.json({ success: true });
    }

    throw new Error('측정 로그 요청 action 이 올바르지 않습니다.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract Measure Log POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
