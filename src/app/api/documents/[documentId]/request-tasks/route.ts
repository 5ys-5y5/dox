import { NextResponse } from 'next/server';
import { DocumentService } from '../../../../../services/documentService';

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

const isMissingRequestTasksTableError = (message: string) =>
  message.includes('document_request_tasks') && message.includes('schema cache');

export async function GET(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const requestLinkId = searchParams.get('requestLinkId') || null;
    const data = await DocumentService.listDocumentRequestTasks({ documentId, requestLinkId });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    if (isMissingRequestTasksTableError(message)) {
      return NextResponse.json({ success: true, data: [] });
    }

    console.error('Document Request Tasks API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const body = await request.json();
    const data = await DocumentService.saveDocumentRequestTasks(documentId, body);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Document Request Tasks API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
