import { NextResponse } from 'next/server';
import { ExportService } from '../../../../../services/exportService';

type RouteContext = {
  params: Promise<{
    exportJobId: string;
  }>;
};

const buildContentDisposition = (fileName: string) => {
  const asciiFallback = `export-${Date.now()}.pdf`;
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { exportJobId } = await context.params;
    const result = await ExportService.getExportDownloadPayload(exportJobId);

    return new Response(result.bytes, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': buildContentDisposition(result.fileName),
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Export Download API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
