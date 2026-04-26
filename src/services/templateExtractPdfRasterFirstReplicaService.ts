import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  TemplateExtractExtractionStage,
  TemplateExtractFrameGroupVersion,
  TemplateExtractPdfPipelineTrace,
  TemplateExtractPdfSourceMode,
  TemplateExtractEngineVersion,
  TemplateExtractResolvedSource,
} from '../lib/templateExtractDtos';
import { TemplateExtractReplicaHtmlNormalizerService } from './templateExtractReplicaHtmlNormalizerService';

const execFileAsync = promisify(execFile);

type RasterFirstReplicaVersion = Extract<TemplateExtractEngineVersion, '32' | '33' | '34' | '35' | '36' | '42' | '43' | '44' | '45' | '46' | '47'>;

type RasterFirstReplicaResponse = {
  sourceTitle: string;
  html: string;
  extractionStage?: TemplateExtractExtractionStage;
  frameGroupVersion?: TemplateExtractFrameGroupVersion;
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
const RASTER_FIRST_VERSION_INFO: Record<
  RasterFirstReplicaVersion,
  {
    label: string;
    cloneId: string;
  }
> = {
  '47': {
    label: 'v2.21',
    cloneId: 'pdf-raster-first-v2.21',
  },
  '46': {
    label: 'v2.2',
    cloneId: 'pdf-raster-first-v2.2',
  },
  '32': {
    label: 'v2.01',
    cloneId: 'pdf-raster-first-v2.01',
  },
  '33': {
    label: 'v2.02',
    cloneId: 'pdf-raster-first-v2.02',
  },
  '34': {
    label: 'v2.03',
    cloneId: 'pdf-raster-first-v2.03',
  },
  '35': {
    label: 'v2.04',
    cloneId: 'pdf-raster-first-v2.04',
  },
  '36': {
    label: 'v2.05',
    cloneId: 'pdf-raster-first-v2.05',
  },
  '42': {
    label: 'v2.11',
    cloneId: 'pdf-raster-first-v2.11',
  },
  '43': {
    label: 'v2.12',
    cloneId: 'pdf-raster-first-v2.12',
  },
  '44': {
    label: 'v2.13',
    cloneId: 'pdf-raster-first-v2.13',
  },
  '45': {
    label: 'v2.14',
    cloneId: 'pdf-raster-first-v2.14',
  },
};

const getRasterFirstVersionInfo = (version: RasterFirstReplicaVersion) =>
  RASTER_FIRST_VERSION_INFO[version] || RASTER_FIRST_VERSION_INFO['47'];

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

const parseRasterFirstResponse = (
  stdout: string,
  version: RasterFirstReplicaVersion
): RasterFirstReplicaResponse => {
  let parsed: unknown;
  const versionInfo = getRasterFirstVersionInfo(version);

  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`템플릿 추출 실패: ${versionInfo.label} raster-first 변환기 응답 JSON을 해석하지 못했습니다.`);
  }

  const response = parsed as Partial<RasterFirstReplicaResponse>;

  if (!response.html || !response.html.includes(`data-template-clone="${versionInfo.cloneId}"`)) {
    throw new Error(`템플릿 추출 실패: ${versionInfo.label} raster-first 변환기가 유효한 HTML clone을 반환하지 않았습니다.`);
  }

  if (!response.modelSummary || typeof response.modelSummary.pageCount !== 'number') {
    throw new Error(`템플릿 추출 실패: ${versionInfo.label} raster-first 변환기 summary가 누락되었습니다.`);
  }

  return response as RasterFirstReplicaResponse;
};

const buildPipelineTrace = (
  response: RasterFirstReplicaResponse,
  version: RasterFirstReplicaVersion
): TemplateExtractPdfPipelineTrace => ({
  engineVersion: version,
  extractionStage: response.extractionStage || 'full',
  frameGroupVersion: response.frameGroupVersion,
  sourceMode: response.sourceMode,
  documentFamily: response.documentFamily,
  familyConfidenceScore: 0.85,
  familyDetectionReasons: [
    `${getRasterFirstVersionInfo(version).label} raster-first reference converter`,
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

const buildDependencyErrorMessage = (
  stderr: string,
  errorMessage: string,
  pythonBinary: string,
  version: RasterFirstReplicaVersion
) => {
  const diagnostic = `${stderr}\n${errorMessage}`.trim();
  const versionInfo = getRasterFirstVersionInfo(version);
  const runtimeHint = ` 사용 Python: ${pythonBinary}. 로컬에서는 TEMPLATE_EXTRACT_PYTHON_BIN으로 venv Python을 지정할 수 있습니다.`;

  if (/No module named ['"]?fitz|ModuleNotFoundError:.*fitz/i.test(diagnostic)) {
    return `템플릿 추출 실패: ${versionInfo.label} 변환기에 필요한 PyMuPDF(fitz)가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/No module named ['"]?cv2|ModuleNotFoundError:.*cv2/i.test(diagnostic)) {
    return `템플릿 추출 실패: ${versionInfo.label} 변환기에 필요한 OpenCV(cv2)가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/No module named ['"]?pytesseract|ModuleNotFoundError:.*pytesseract/i.test(diagnostic)) {
    return `템플릿 추출 실패: ${versionInfo.label} 변환기에 필요한 pytesseract가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/tesseract|TesseractNotFoundError/i.test(diagnostic)) {
    return `템플릿 추출 실패: ${versionInfo.label} 변환기에 필요한 Tesseract OCR 런타임을 찾지 못했습니다.${runtimeHint}`;
  }

  return `템플릿 추출 실패: ${versionInfo.label} raster-first 변환기 실행 중 오류가 발생했습니다. (${errorMessage})${runtimeHint}`;
};

export const TemplateExtractPdfRasterFirstReplicaService = {
  // TEMPLATE_EXTRACT_RASTER_FIRST_V2_BOUNDARY
  // v2.0x는 기존 v1.xx 계열의 PDFKit/Swift renderer를 수정하지 않고,
  // Python reference converter를 별도 executable boundary로 호출합니다.
  async extractPdfSource(
    fileName: string,
    bytes: Uint8Array,
    version: RasterFirstReplicaVersion = '47',
    extractionStage: TemplateExtractExtractionStage = 'full',
    frameGroupVersion: TemplateExtractFrameGroupVersion = 'v1.10-default'
  ): Promise<TemplateExtractResolvedSource> {
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
          version,
          '--extraction-stage',
          extractionStage,
          '--frame-group-version',
          frameGroupVersion,
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
      const response = parseRasterFirstResponse(stdout, version);
      const actualExtractionStage = response.extractionStage || extractionStage;
      const actualFrameGroupVersion = response.frameGroupVersion || frameGroupVersion;
      const pipelineTrace = buildPipelineTrace(
        {
          ...response,
          extractionStage: actualExtractionStage,
          frameGroupVersion: actualFrameGroupVersion,
        },
        version
      );
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
        extractionStage: actualExtractionStage,
        frameGroupVersion: actualFrameGroupVersion,
        pipelineTrace,
        qualityReport: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      const stderr = typeof (error as { stderr?: unknown }).stderr === 'string'
        ? String((error as { stderr: string }).stderr)
        : '';

      throw new Error(buildDependencyErrorMessage(stderr, message, resolvePythonBinary(), version));
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  },
};
