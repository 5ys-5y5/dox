import { NextResponse } from 'next/server';
import { TemplateExtractService } from '../../../../../services/templateExtractService';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { draftId } = await context.params;
    const draft = await TemplateExtractService.getDraft(draftId);

    return NextResponse.json(
      { success: true, data: draft },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract Draft GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
