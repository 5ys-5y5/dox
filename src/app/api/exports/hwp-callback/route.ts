import { NextResponse } from 'next/server';
import { ExportHwpHandoffService } from '../../../../services/exportHwpHandoffService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await ExportHwpHandoffService.handleCallback(body);

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

    console.error('Export HWP Callback API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
