import { NextResponse } from 'next/server';
import { PhotoLabelRequirementService } from '../../../../services/photoLabelRequirementService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await PhotoLabelRequirementService.saveRequirements(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Photo Label Requirements API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
