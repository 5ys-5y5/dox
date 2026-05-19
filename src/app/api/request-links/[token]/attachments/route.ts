import { NextResponse } from 'next/server';
import { DocumentService } from '../../../../../services/documentService';
import { RequestLinkService } from '../../../../../services/requestLinkService';

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const requestLink = await RequestLinkService.getPublicRequestLink(token);
    const url = new URL(request.url);
    const storageBucket = String(url.searchParams.get('bucket') || '');
    const storagePath = String(url.searchParams.get('path') || '');
    const result = await DocumentService.createDocumentValueFileSignedUrl({
      documentId: requestLink.documentSummary.documentId,
      storageBucket,
      storagePath,
    });

    return NextResponse.redirect(result.signedUrl);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    const status =
      message.includes('찾을 수 없습니다') ? 404 : message.includes('폐기') || message.includes('만료') ? 403 : 500;

    console.error('Request Link Attachments API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const requestLink = await RequestLinkService.getPublicRequestLink(token);

    if (requestLink.status !== 'active') {
      return NextResponse.json({ success: false, message: '현재 이 요청 링크는 첨부파일을 수정할 수 없습니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const valueKey = String(formData.get('valueKey') || '').trim();
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File);

    if (!valueKey) {
      throw new Error('첨부파일 업로드 실패: valueKey가 필요합니다.');
    }

    if (!requestLink.allowedLabels.includes(valueKey)) {
      return NextResponse.json({ success: false, message: '이 요청 링크에서는 해당 첨부파일 항목을 수정할 수 없습니다.' }, { status: 403 });
    }

    if (files.length === 0) {
      throw new Error('첨부파일 업로드 실패: 업로드할 파일이 필요합니다.');
    }

    const uploads = await DocumentService.uploadDocumentValueFiles({
      documentId: requestLink.documentSummary.documentId,
      valueKey,
      files: await Promise.all(
        files.map(async (file) => ({
          originalFileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBytes: new Uint8Array(await file.arrayBuffer()),
          fileSizeBytes: file.size,
          uploadedBy: `request-link:${requestLink.requestLinkId}`,
        }))
      ),
    });

    return NextResponse.json({ success: true, data: { uploads } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    const status =
      message.includes('찾을 수 없습니다') ? 404 : message.includes('폐기') || message.includes('만료') ? 403 : 500;

    console.error('Request Link Attachments API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status });
  }
}
