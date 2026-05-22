import { NextResponse } from 'next/server';
import { DocumentService } from '../../../../../services/documentService';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

const normalizeFileTagNames = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((tagName) => String(tagName || '').trim()).filter((tagName) => Boolean(tagName)))
  );
};

const readFileTagsFromFormData = (formData: FormData) => {
  const rawValue = formData.get('fileTags');

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return [] as string[][];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [] as string[][];
    }

    return parsedValue.map(normalizeFileTagNames);
  } catch {
    return [] as string[][];
  }
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const url = new URL(request.url);
    const storageBucket = String(url.searchParams.get('bucket') || '');
    const storagePath = String(url.searchParams.get('path') || '');
    const result = await DocumentService.createDocumentValueFileSignedUrl({
      documentId,
      storageBucket,
      storagePath,
    });

    return NextResponse.redirect(result.signedUrl);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Documents Attachments API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const formData = await request.formData();
    const valueKey = String(formData.get('valueKey') || '');
    const fileTags = readFileTagsFromFormData(formData);
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      throw new Error('첨부파일 업로드 실패: 업로드할 파일이 필요합니다.');
    }

    const uploads = await DocumentService.uploadDocumentValueFiles({
      documentId,
      valueKey,
      files: await Promise.all(
        files.map(async (file, index) => ({
          originalFileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBytes: new Uint8Array(await file.arrayBuffer()),
          fileSizeBytes: file.size,
          uploadedBy: 'project-page',
          metadata: { tags: fileTags[index] || [] },
        }))
      ),
    });

    return NextResponse.json({ success: true, data: { uploads } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Documents Attachments API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
