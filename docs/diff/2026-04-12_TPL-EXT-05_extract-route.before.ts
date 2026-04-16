import { NextResponse } from 'next/server';
import { TemplateExtractService } from '../../../../services/templateExtractService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const draft = await TemplateExtractService.createDraft(body);

    return NextResponse.json({ success: true, data: draft });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Extract API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
