import { NextResponse } from 'next/server';
import { TemplateService } from '../../../../services/templateService';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { templateId } = await context.params;
    const url = new URL(request.url);

    if (url.searchParams.get('deleteImpact') === '1') {
      const deleteImpact = await TemplateService.getTemplateDeleteImpact(templateId);

      return NextResponse.json(
        { success: true, data: deleteImpact },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const templateDetail = await TemplateService.getTemplate(templateId);

    // TEMPLATE_DETAIL_NO_CACHE_REQUIRED
    // 필드/서명영역 저장 직후 같은 templateId 를 다시 조회하므로
    // stale GET 캐시를 쓰면 필드 수가 0으로 남아 보일 수 있습니다.
    return NextResponse.json(
      { success: true, data: templateDetail },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Detail API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const { templateId } = await context.params;
    const updateResult = await TemplateService.updateTemplate(templateId, body);

    return NextResponse.json(
      { success: true, data: updateResult },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Detail API PATCH Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { templateId } = await context.params;
    const deleteResult = await TemplateService.deleteTemplate(templateId);

    return NextResponse.json(
      { success: true, data: deleteResult },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Template Detail API DELETE Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
