import { NextResponse } from 'next/server';
import { SiteChecklistService } from '../../../services/siteChecklistService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const createdSite = await SiteChecklistService.createSite(body);

    return NextResponse.json({ success: true, data: createdSite });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Sites API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
