import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TemplateExtractReplicaRenderModel } from '../lib/templateExtractDtos';

const execFileAsync = promisify(execFile);

const PYTHON_SCRIPT_PATH = join(process.cwd(), 'scripts', 'template-extract-frame-text-v112.py');
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

const buildDependencyErrorMessage = (stderr: string, errorMessage: string, pythonBinary: string) => {
  const diagnostic = `${stderr}\n${errorMessage}`.trim();
  const runtimeHint = ` 사용 Python: ${pythonBinary}.`;

  if (/No module named ['"]?fitz|ModuleNotFoundError:.*fitz/i.test(diagnostic)) {
    return `텍스트 추출 실패: 이미지 텍스트 추출기(v1.00)에 필요한 PyMuPDF(fitz)가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/No module named ['"]?pytesseract|ModuleNotFoundError:.*pytesseract/i.test(diagnostic)) {
    return `텍스트 추출 실패: 이미지 텍스트 추출기(v1.00)에 필요한 pytesseract가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/No module named ['"]?PIL|ModuleNotFoundError:.*PIL/i.test(diagnostic)) {
    return `텍스트 추출 실패: 이미지 텍스트 추출기(v1.00)에 필요한 Pillow(PIL)가 설치되어 있지 않습니다.${runtimeHint}`;
  }

  if (/tesseract|TesseractNotFoundError/i.test(diagnostic)) {
    return `텍스트 추출 실패: 이미지 텍스트 추출기(v1.00)에 필요한 Tesseract OCR 런타임을 찾지 못했습니다.${runtimeHint}`;
  }

  return `텍스트 추출 실패: 이미지 텍스트 추출기(v1.00) 실행 중 오류가 발생했습니다. (${errorMessage})${runtimeHint}`;
};

const parseRenderModel = (stdout: string): TemplateExtractReplicaRenderModel => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('텍스트 추출 실패: 이미지 텍스트 추출기(v1.00) 응답 JSON을 해석하지 못했습니다.');
  }

  const renderModel = parsed as Partial<TemplateExtractReplicaRenderModel> & {
    pages?: Array<{ pageNumber?: number; textItems?: unknown[] }>;
  };

  if (renderModel.version !== 'positioned-v1' || !Array.isArray(renderModel.pages)) {
    throw new Error('텍스트 추출 실패: 이미지 텍스트 추출기(v1.00)가 유효한 render model을 반환하지 않았습니다.');
  }

  return renderModel as TemplateExtractReplicaRenderModel;
};

export const TemplateExtractFrameTextService = {
  async extractPdfFrameText(
    fileName: string,
    bytes: Uint8Array,
    options?: {
      forceOcr?: boolean;
    }
  ): Promise<TemplateExtractReplicaRenderModel> {
    const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-frame-text-'));
    const tempPdfPath = join(tempDir, fileName || 'upload.pdf');

    try {
      await writeFile(tempPdfPath, bytes);
      const pythonBinary = resolvePythonBinary();
      const scriptArgs = [PYTHON_SCRIPT_PATH, '--input-pdf', tempPdfPath];

      if (options?.forceOcr) {
        scriptArgs.push('--force-ocr');
      }

      const { stdout } = await execFileAsync(
        pythonBinary,
        scriptArgs,
        {
          maxBuffer: 256 * 1024 * 1024,
        }
      );

      return parseRenderModel(stdout);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      const stderr =
        typeof (error as { stderr?: unknown }).stderr === 'string'
          ? String((error as { stderr: string }).stderr)
          : '';

      throw new Error(buildDependencyErrorMessage(stderr, message, resolvePythonBinary()));
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  },
};
