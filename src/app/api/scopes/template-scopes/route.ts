import { NextResponse } from 'next/server';
import { TemplateScopeRegistryService } from '../../../../services/templateScopeRegistryService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId') || '';
    const siteId = searchParams.get('siteId') || '';
    const scopeContext = await TemplateScopeRegistryService.loadTemplateScopeContext({
      templateId,
      siteId: siteId || null,
    });

    return NextResponse.json(
      { success: true, data: scopeContext },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Scopes API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scopeContext = await TemplateScopeRegistryService.saveTemplateScopeContext(body);

    return NextResponse.json(
      { success: true, data: scopeContext },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Scopes API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
