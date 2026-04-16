import { NextResponse } from 'next/server';
import { PhotoLabelRequirementService } from '../../../../../services/photoLabelRequirementService';

type RouteContext = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    const summary = await PhotoLabelRequirementService.getSitePhotoLabelGaps(siteId);

    return NextResponse.json(
      { success: true, data: summary },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Site Photo Label Gaps API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
