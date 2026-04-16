import { NextResponse } from 'next/server';
import { DocumentService } from '../../../services/documentService';
import type { DocumentLifecycleStatus } from '../../../lib/documentDtos';

// DOC_CLOUD_HISTORY_API_PENDING
// 현재 /api/documents 는 list/create 1차 골격만 구현합니다.
// /api/documents/:documentId 와 /api/documents/:documentId/version 은
// DOC-CLOUD-03 체크리스트에서 별도 라우트로 이어서 구현해야 합니다.
const parseLatestOnly = (value: string | null) => {
  if (!value) return true;

  return value !== 'false';
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documents = await DocumentService.listDocuments({
      siteId: searchParams.get('siteId'),
      status: searchParams.get('status') as DocumentLifecycleStatus | null,
      documentTypeKey: searchParams.get('documentTypeKey'),
      latestOnly: parseLatestOnly(searchParams.get('latestOnly')),
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Documents API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const createdDocument = await DocumentService.createDocument(body);

    return NextResponse.json({ success: true, data: createdDocument });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Documents API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
