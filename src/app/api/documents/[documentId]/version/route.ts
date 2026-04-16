import { NextResponse } from 'next/server';
import { DocumentService } from '../../../../../services/documentService';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const { documentId } = await context.params;
    const createdVersion = await DocumentService.createVersion(documentId, body);

    return NextResponse.json({ success: true, data: createdVersion });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Documents Version API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
