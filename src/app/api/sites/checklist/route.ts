import { NextResponse } from 'next/server';
import { SiteChecklistService } from '../../../../services/siteChecklistService';

// SITE_CHECKLIST_RULES_AND_REBUILD
// 현재 /api/sites/checklist 는 규칙 seed 저장과 체크리스트 재계산을 함께 다룹니다.
// requiredDocumentRules 를 함께 보내면 규칙을 먼저 upsert 한 뒤 최신 체크리스트를 다시 계산합니다.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rebuiltChecklist = await SiteChecklistService.rebuildChecklist(body);

    return NextResponse.json({ success: true, data: rebuiltChecklist });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Sites Checklist API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
