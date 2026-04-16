import { NextResponse } from 'next/server';
import { ExportHwpHandoffService } from '../../../../../services/exportHwpHandoffService';

type RouteContext = {
  params: Promise<{
    exportJobId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { exportJobId } = await context.params;
    const origin = new URL(request.url).origin;
    const result = await ExportHwpHandoffService.createHandoff(exportJobId, origin);

    return NextResponse.json(
      { success: true, data: result },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Export HWP Handoff API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
