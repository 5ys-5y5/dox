import { NextResponse } from 'next/server';
import { DocumentService } from '../../../../../../services/documentService';
import { RequestLinkService } from '../../../../../../services/requestLinkService';
import type { DocumentRequestTaskUpdateInput } from '../../../../../../lib/documentDtos';

type RouteContext = {
  params: Promise<{
    token: string;
    taskId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { token, taskId } = await context.params;
    const requestLink = await RequestLinkService.getPublicRequestLink(token);

    if (requestLink.status !== 'active' && requestLink.status !== 'submitted') {
      return NextResponse.json({ success: false, message: '현재 이 요청 링크는 작업 상태를 수정할 수 없습니다.' }, { status: 403 });
    }

    const task = requestLink.requestTasks.find((item) => item.id === taskId) || null;

    if (!task) {
      return NextResponse.json({ success: false, message: '요청 링크에 포함된 작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const updates: DocumentRequestTaskUpdateInput = {};

    if (body?.status) {
      updates.status = body.status;
    }

    if (body && Object.prototype.hasOwnProperty.call(body, 'linkedExternalId')) {
      updates.linkedExternalId = body.linkedExternalId;
    }

    if (body?.payload && typeof body.payload === 'object') {
      updates.payload = body.payload;
    }

    const updatedTask = await DocumentService.updateDocumentRequestTask(requestLink.documentSummary.documentId, task.id, updates);

    return NextResponse.json({ success: true, data: updatedTask });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    const status =
      message.includes('찾을 수 없습니다') ? 404 : message.includes('폐기') || message.includes('만료') ? 403 : 500;

    console.error('Request Link Task API PATCH Error:', error);

    return NextResponse.json({ success: false, message }, { status });
  }
}
