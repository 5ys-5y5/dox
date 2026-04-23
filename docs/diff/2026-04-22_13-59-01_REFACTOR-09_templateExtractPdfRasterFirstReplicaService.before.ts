import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  TemplateExtractPdfPipelineTrace,
  TemplateExtractPdfSourceMode,
  TemplateExtractResolvedSource,
} from '../lib/templateExtractDtos';
import { TemplateExtractReplicaHtmlNormalizerService } from './templateExtractReplicaHtmlNormalizerService';

const execFileAsync = promisify(execFile);

type RasterFirstReplicaResponse = {
  sourceTitle: string;
  html: string;
  pageCount: number;
  sourceMode: TemplateExtractPdfSourceMode;
  documentFamily: TemplateExtractPdfPipelineTrace['documentFamily'];
  cloneBuilder: string;
  modelSummary: {
    pageCount: number;
    tableCount: number;
    textBlockCount: number;
    cellCount: number;
    choiceMarkCount: number;
    rowBandCount: number;
    columnEdgeCount: number;
    horizontalSegmentCount: number;
    verticalSegmentCount: number;
  };
  diagnostics: {
    fallbackApplied: boolean;
    fallbackReason: string | null;
    dependencyWarnings: string[];
    referenceConverter: string;
  };
};

const PYTHON_SCRIPT_PATH = join(process.cwd(), 'scripts', 'template-extract-raster-first-replica.py');
const LOCAL_VENV_PYTHON_PATH = join(process.cwd(), '.venv-template-extract-v2', 'bin', 'python');

const resolvePythonBinary = () => {
  const configuredPythonBinary = process.env.TEMPLATE_EXTRACT_PYTHON_BIN?.trim();

  if (configuredPythonBinary) {
    return configuredPythonBinary;
  }

  if (existsSync(LOCAL_VENV_PYTHON_PATH)) {
    return LOCAL_VENV_PYTHON_PATH;
  }

  return 'python3';
};

const parseRasterFirstResponse = (stdout: string): RasterFirstReplicaResponse => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('템플릿 추출 실패: v2.01 raster-first 변환기 응답 JSON을 해석하지 못했습니다.');
  }

  const response = parsed as Partial<RasterFirstReplicaResponse>;

  if (!response.html || !response.html.includes('data-template-clone="pdf-raster-first-v2.01"')) {
    throw new Error('템플릿 추출 실패: v2.01 raster-first 변환기가 유효한 HTML clone을 반환하지 않았습니다.');
  }

  if (!response.modelSummary || typeof response.modelSummary.pageCount !== 'number') {
    throw new Error('템플릿 추출 실패: v2.01 raster-first 변환기 summary가 누락되었습니다.');
  }

  return response as RasterFirstReplicaResponse;
};

const buildPipelineTrace = (response: RasterFirstReplicaResponse): TemplateExtractPdfPipelineTrace => ({
  engineVersion: '32',
  sourceMode: response.sourceMode,
  documentFamily: response.documentFamily,
  familyConfidenceScore: 0.85,
  familyDetectionReasons: [
    'v2.01 raster-first reference converter',
    response.diagnostics.referenceConverter,
  ],
  topologySummary: {
    pageCount: response.modelSummary.pageCount,
    rowBandCount: response.modelSummary.rowBandCount,
    columnEdgeCount: response.modelSummary.columnEdgeCount,
    horizontalSegmentCount: response.modelSummary.horizontalSegmentCount,
    verticalSegmentCount: response.modelSummary.verticalSegmentCount,
    textBlockCount: response.modelSummary.textBlockCount,
    cellCandidateCount: response.modelSummary.cellCount,
  },
  cloneBuilder: response.cloneBuilder,
  frameDiagnostics: null,
});

const buildDependencyErrorMessage = (stderr: string, errorMessage: string, pythonBinary: string) => {
  const diagnostic = `${stderr}\n${errorMessage}`.trim();
  const runtimeHint = ` 사용 Python: ${pythonBinary}. 로컬에서는 TEMPLATE_EXTRACT_PYTHON_BIN으로 venv Python을 지정할 수 있습니다.`;

  if (/No module named ['"]?fitz|ModuleNotFoundError:.*fitz/i.test(diagnostic)) {
    return `템플릿 추출 실패: v2.01 변환기에 필요한 PyMuPDF(fitz)가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/No module named ['"]?cv2|ModuleNotFoundError:.*cv2/i.test(diagnostic)) {
    return `템플릿 추출 실패: v2.01 변환기에 필요한 OpenCV(cv2)가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/No module named ['"]?pytesseract|ModuleNotFoundError:.*pytesseract/i.test(diagnostic)) {
    return `템플릿 추출 실패: v2.01 변환기에 필요한 pytesseract가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/tesseract|TesseractNotFoundError/i.test(diagnostic)) {
    return `템플릿 추출 실패: v2.01 변환기에 필요한 Tesseract OCR 런타임을 찾지 못했습니다.${runtimeHint}`;
  }

  return `템플릿 추출 실패: v2.01 raster-first 변환기 실행 중 오류가 발생했습니다. (${errorMessage})${runtimeHint}`;
};

export const TemplateExtractPdfRasterFirstReplicaService = {
  // TEMPLATE_EXTRACT_RASTER_FIRST_V2_BOUNDARY
  // v2.01은 기존 v1.xx 계열의 PDFKit/Swift renderer를 수정하지 않고,
  // Python reference converter를 별도 executable boundary로 호출합니다.
  async extractPdfSource(fileName: string, bytes: Uint8Array): Promise<TemplateExtractResolvedSource> {
    const sourceTitle = fileName.replace(/\.pdf$/i, '').trim() || '업로드 PDF';
    const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-raster-first-'));
    const tempPdfPath = join(tempDir, fileName || 'upload.pdf');

    try {
      await writeFile(tempPdfPath, bytes);

      const pythonBinary = resolvePythonBinary();
      const { stdout } = await execFileAsync(
        pythonBinary,
        [
          PYTHON_SCRIPT_PATH,
          '--input-pdf',
          tempPdfPath,
          '--engine-version',
          '32',
          '--scale',
          '1.28',
          '--raster-scale',
          '3.2',
          '--ocr-lang',
          process.env.TEMPLATE_EXTRACT_RASTER_FIRST_OCR_LANG || 'kor+eng',
        ],
        {
          maxBuffer: 256 * 1024 * 1024,
        }
      );
      const response = parseRasterFirstResponse(stdout);
      const pipelineTrace = buildPipelineTrace(response);
      const sourceContent = TemplateExtractReplicaHtmlNormalizerService.embedPipelineTrace(
        response.html,
        pipelineTrace
      );

      return {
        sourceTitle: response.sourceTitle || sourceTitle,
        sourceKind: 'html',
        sourceContent,
        originalFileName: fileName,
        originalMimeType: 'application/pdf',
        pipelineTrace,
        qualityReport: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      const stderr = typeof (error as { stderr?: unknown }).stderr === 'string'
        ? String((error as { stderr: string }).stderr)
        : '';

      throw new Error(buildDependencyErrorMessage(stderr, message, resolvePythonBinary()));
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  },
};
