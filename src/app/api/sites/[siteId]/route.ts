import { NextResponse } from 'next/server';
import { SiteChecklistService } from '../../../../services/siteChecklistService';

type RouteContext = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    const impact = await SiteChecklistService.getDeleteImpact(siteId);

    return NextResponse.json({ success: true, data: impact });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Sites Detail API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    const deletedSite = await SiteChecklistService.deleteSite(siteId);

    return NextResponse.json({ success: true, data: deletedSite });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Sites Detail API DELETE Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
