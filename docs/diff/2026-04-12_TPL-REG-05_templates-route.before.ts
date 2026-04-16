import { NextResponse } from 'next/server';
import { TemplateService } from '../../../services/templateService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const template = await TemplateService.createTemplate(body);

    return NextResponse.json({ success: true, data: template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Templates API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
