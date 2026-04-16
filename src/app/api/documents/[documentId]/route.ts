import { NextResponse } from 'next/server';
import { DocumentService } from '../../../../services/documentService';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const documentDetail = await DocumentService.getDocumentDetail(documentId);

    return NextResponse.json({ success: true, data: documentDetail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Documents Detail API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
