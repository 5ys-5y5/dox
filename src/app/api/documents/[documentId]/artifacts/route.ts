import { NextResponse } from 'next/server';
import { ExportService } from '../../../../../services/exportService';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const result = await ExportService.listDocumentArtifacts(documentId);

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

    console.error('Document Artifacts API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
