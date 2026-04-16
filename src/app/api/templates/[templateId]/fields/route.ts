import { NextResponse } from 'next/server';
import { TemplateService } from '../../../../../services/templateService';

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const { templateId } = await context.params;
    const saveResult = await TemplateService.saveTemplateFields(templateId, body);

    return NextResponse.json({ success: true, data: saveResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Fields API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
