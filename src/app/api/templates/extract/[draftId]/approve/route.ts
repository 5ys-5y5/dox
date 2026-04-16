import { NextResponse } from 'next/server';
import { TemplateExtractService } from '../../../../../../services/templateExtractService';

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const { draftId } = await context.params;
    const approveResult = await TemplateExtractService.approveDraft(draftId, body);

    return NextResponse.json({ success: true, data: approveResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract Approve POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
